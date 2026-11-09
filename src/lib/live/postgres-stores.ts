import type { Sql } from "@/lib/db/sql";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import type {
  DayArchive,
  GenerationLog,
  GenerationRecord,
  KeptRecord,
  ReplanContext,
} from "./generation-log";
import {
  APP_SPEND_CAPS,
  HOLD_TTL_MS,
  VISITOR_DAILY_LIMITS,
  type AppSpend,
  type LimitKind,
  type Reservation,
  type SpendCaps,
  type Take,
  type VisitorLimits,
} from "./limits";
import { logToConsole, messageOf, type ServerLog } from "./provider-error";
import { clearExpiredVisitorText, clearPastCounters } from "./retention";
import { utcDayOf, utcMonthOf } from "@/lib/time/utc-day";

/**
 * The limits and the log in Postgres (`db/migrations/`), shared by every instance of every
 * function, so the caps hold however many run at once. Every check and its change happen
 * together, against rows locked or re-read once the lock is held: two requests at once can
 * never both take the last call, nor both fit under a cap that has room for one.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/live/postgres-stores.ts writes the app's spend and runs only on the server",
  );
}

const MICRO_USD_PER_USD = 1_000_000;

/** Money is kept in whole micro-dollars, never as a float. */
export function microUsdOf(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) throw new Error(`Not an amount of dollars: ${usd}`);
  return Math.round(usd * MICRO_USD_PER_USD);
}

/**
 * Counts one call, or nothing once the limit is reached: the upsert increments only while
 * the count is below it, and a first call of the day inserts only if the limit allows one.
 */
const TAKE = `
  INSERT INTO visitor_counters AS counter (visitor_key, utc_day, kind, count)
  SELECT $1, $2::date, $3, 1
  WHERE $4::integer > 0
  ON CONFLICT (visitor_key, utc_day, kind)
  DO UPDATE SET count = counter.count + 1
  WHERE counter.count < $4::integer
  RETURNING counter.count`;

const GIVE_BACK = `
  UPDATE visitor_counters SET count = count - 1
  WHERE visitor_key = $1 AND utc_day = $2::date AND kind = $3 AND count > 0`;

export class PostgresVisitorLimits implements VisitorLimits {
  constructor(
    private readonly sql: Sql,
    private readonly limits: Readonly<Record<LimitKind, number>> = VISITOR_DAILY_LIMITS,
  ) {}

  /**
   * A take the database commits but whose answer never arrives, past the route's deadline
   * or lost on the way, stays counted: the route answers 503 and that visitor has one call
   * fewer that day. It fails closed, and costs one visitor one call, so it is accepted.
   */
  async take(visitor: string, kind: LimitKind, now: Date): Promise<Take | null> {
    const day = utcDayOf(now);
    const rows = await this.sql.query(TAKE, [visitor, day, kind, this.limits[kind]]);
    return rows.length === 1 ? { visitor, kind, day } : null;
  }

  /** Takes the call off the day it was counted in; a new day's count is never touched. */
  async giveBack({ visitor, kind, day }: Take): Promise<void> {
    await this.sql.query(GIVE_BACK, [visitor, day, kind]);
  }
}

/** A day's and a month's rows start at nothing spent, so a hold has rows to lock. */
const OPEN_BUCKETS = `
  INSERT INTO app_spend (bucket) VALUES ($1), ($2)
  ON CONFLICT (bucket) DO NOTHING`;

/** Always in the same order, so two transactions that lock both never deadlock. */
const LOCK_BUCKETS = `
  SELECT bucket FROM app_spend
  WHERE bucket IN ($1, $2)
  ORDER BY bucket
  FOR UPDATE`;

/**
 * Holds the amount if both buckets have room for it: what they spent, the holds that have
 * not expired, and this one. It runs after the buckets are locked, in a statement of its
 * own, so it reads every hold committed by whoever held the lock before. A null month cap
 * leaves the month counted but unbounded.
 */
const HOLD_IF_ROOM = `
  INSERT INTO spend_holds (id, day_bucket, month_bucket, amount_micro_usd, expires_at)
  SELECT $1::uuid, $2, $3, $4::integer, $8::timestamptz
  WHERE (SELECT spent_micro_usd FROM app_spend WHERE bucket = $2)
      + (SELECT coalesce(sum(amount_micro_usd), 0) FROM spend_holds
         WHERE day_bucket = $2 AND expires_at > $7::timestamptz)
      + $4::integer <= $5::integer
    AND ($6::integer IS NULL
      OR (SELECT spent_micro_usd FROM app_spend WHERE bucket = $3)
       + (SELECT coalesce(sum(amount_micro_usd), 0) FROM spend_holds
          WHERE month_bucket = $3 AND expires_at > $7::timestamptz)
       + $4::integer <= $6::integer)
  RETURNING id`;

const DROP_EXPIRED_HOLDS = `DELETE FROM spend_holds WHERE expires_at <= $1::timestamptz`;

const RELEASE_HOLD = `DELETE FROM spend_holds WHERE id = $1::uuid`;

const ADD_SPENT = `
  UPDATE app_spend SET spent_micro_usd = spent_micro_usd + $3::integer
  WHERE bucket IN ($1, $2)
  RETURNING bucket`;

function bucketsOf({ day, month }: { day: string; month: string }): [string, string] {
  return [`day:${day}`, `month:${month}`];
}

/**
 * The app's spend: what each day and month spent in their rows, and each call's hold as a
 * row of its own that stops counting when it expires, so a hold whose settle never comes
 * costs the cap `HOLD_TTL_MS`, not the rest of the month. A reservation and a settle are
 * each one transaction in one round trip.
 */
export class PostgresAppSpend implements AppSpend {
  constructor(
    private readonly sql: Sql,
    private readonly caps: SpendCaps = APP_SPEND_CAPS,
  ) {}

  async reserve(usd: number, now: Date): Promise<Reservation | null> {
    const reservation = {
      id: crypto.randomUUID(),
      usd,
      day: utcDayOf(now),
      month: utcMonthOf(now),
    };
    const buckets = bucketsOf(reservation);
    const at = now.toISOString();
    const expiresAt = new Date(now.getTime() + HOLD_TTL_MS).toISOString();
    const monthCap = this.caps.monthlyUsd === null ? null : microUsdOf(this.caps.monthlyUsd);
    const [, , held] = await this.sql.transaction([
      { text: OPEN_BUCKETS, params: buckets },
      { text: LOCK_BUCKETS, params: buckets },
      {
        text: HOLD_IF_ROOM,
        params: [
          reservation.id,
          ...buckets,
          microUsdOf(usd),
          microUsdOf(this.caps.dailyUsd),
          monthCap,
          at,
          expiresAt,
        ],
      },
      { text: DROP_EXPIRED_HOLDS, params: [at] },
    ]);
    return held?.length === 1 ? reservation : null;
  }

  /** Releases the hold, if it has not expired and gone, and adds what the call cost. */
  async settle(reservation: Reservation, spentUsd: number): Promise<void> {
    const buckets = bucketsOf(reservation);
    const [, , added] = await this.sql.transaction([
      { text: LOCK_BUCKETS, params: buckets },
      { text: RELEASE_HOLD, params: [reservation.id] },
      { text: ADD_SPENT, params: [...buckets, microUsdOf(spentUsd)] },
    ]);
    if (added?.length !== buckets.length) {
      throw new Error(`Nothing was held on ${reservation.day} and ${reservation.month}`);
    }
  }
}

/**
 * One row per call, every column named, `context` (`0006`) null for every call but a re-plan.
 * A record has needed `place_checks` (`0007`) since it came, and migrations apply in order, so
 * every database a record can be written to has `0006` as well.
 */
const RECORD = `
  INSERT INTO generation_log (
    id, environment, pair_id, role, model, prompt_version, started_at,
    input_tokens, output_tokens, thinking_tokens, cost_micro_usd,
    ms_to_first_token, ms_to_finish, finish_reason, outcome, repairs, checks,
    visitor_text, request, output_text, output, warnings, request_id, error, salvaged,
    place_checks, context
  ) VALUES (
    $1::uuid, $2, $3::uuid, $4, $5, $6, $7::timestamptz,
    $8::integer, $9::integer, $10::integer, $11::integer,
    $12::integer, $13::integer, $14, $15, $16::integer, $17::jsonb,
    $18, $19::jsonb, $20, $21::jsonb, $22::jsonb, $23, $24::jsonb, $25::boolean,
    $26::jsonb, $27::jsonb
  )`;

const NUL = "\u0000";

/**
 * The value with every NUL character taken out of its strings and keys. Postgres refuses
 * NUL in `text` and `jsonb`, and a model's output or a visitor's text can hold one; kept,
 * it would cost the whole record.
 */
export function withoutNul(value: unknown): unknown {
  if (typeof value === "string") return value.replaceAll(NUL, "");
  if (Array.isArray(value)) return value.map(withoutNul);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key.replaceAll(NUL, ""), withoutNul(inner)]),
    );
  }
  return value;
}

function jsonOrNull(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}

/** The output as JSON when it is whole, or null when the model stopped partway. */
function parsedOutput(text: string): unknown {
  try {
    return withoutNul(JSON.parse(text));
  } catch {
    return null;
  }
}

export interface GenerationLogOptions {
  /** The clock the retention reads: which UTC day it is, and which rows are old enough. */
  now?: () => Date;
  /** Where a clearing that failed is said. */
  log?: ServerLog;
}

/**
 * One row per model call. `environment` is where it ran (`VERCEL_ENV`, or `development`),
 * since the laptop and preview deploys share a database. The first record of each UTC day
 * in a process also clears what visitors typed past its retention (`retention.ts`), from
 * every environment's rows, as the first event of a day drops the days past.
 */
/** A day's own record, by its id, in this environment: never a shadow's or an intake's. */
const DAY_RECORD = `
  SELECT id, prompt_version, started_at, ms_to_finish, outcome, salvaged, request, output_text,
    place_checks, context
  FROM generation_log
  WHERE id = $1::uuid AND environment = $2 AND role = 'day'`;

interface DayRow {
  id: string;
  prompt_version: string;
  started_at: Date | string;
  ms_to_finish: number;
  outcome: string;
  salvaged: boolean | null;
  request: DayRequest | null;
  output_text: string;
  place_checks: Record<string, PlaceCheck> | null;
  context: ReplanContext | null;
}

export class PostgresGenerationLog implements GenerationLog, DayArchive {
  /** The UTC day this process last tried to clear expired texts on. */
  private clearedOn: string | null = null;
  private readonly now: () => Date;
  private readonly log: ServerLog;

  constructor(
    private readonly sql: Sql,
    private readonly environment: string,
    { now = () => new Date(), log = logToConsole }: GenerationLogOptions = {},
  ) {
    this.now = now;
    this.log = log;
  }

  async record(original: GenerationRecord): Promise<void> {
    const entry = withoutNul(original) as GenerationRecord;
    const values = [
      entry.id,
      this.environment,
      entry.pairId,
      entry.role,
      entry.model,
      entry.promptVersion,
      entry.startedAt,
      entry.tokens.input,
      entry.tokens.output,
      entry.tokens.thinking,
      entry.costUsd === null ? null : microUsdOf(entry.costUsd),
      entry.msToFirstToken,
      entry.msToFinish,
      entry.finishReason,
      entry.outcome,
      entry.repairs,
      jsonOrNull(entry.checks),
      entry.visitorText,
      jsonOrNull(entry.request),
      entry.outputText,
      jsonOrNull(parsedOutput(entry.outputText)),
      JSON.stringify(entry.warnings),
      entry.requestId,
      jsonOrNull(entry.error),
      entry.salvaged,
      jsonOrNull(entry.placeChecks),
      jsonOrNull(entry.context ?? null),
    ];
    await this.sql.query(RECORD, values);
    await this.clearExpiredOncePerDay();
  }

  async dayRecordOf(id: string): Promise<KeptRecord | null> {
    const [row] = await this.sql.query<DayRow>(DAY_RECORD, [id, this.environment]);
    if (row === undefined) return null;
    return {
      id: row.id,
      promptVersion: row.prompt_version,
      // A Date from PGlite; a driver that hands back text is read the same way.
      startedAt: new Date(row.started_at).toISOString(),
      msToFinish: row.ms_to_finish,
      outcome: row.outcome,
      salvaged: row.salvaged,
      request: row.request,
      outputText: row.output_text,
      placeChecks: row.place_checks,
      ...(row.context === null ? {} : { context: row.context }),
    };
  }

  /**
   * Clears what visitors typed past its retention, and their counts from before yesterday
   * (`src/lib/live/retention.ts`). Runs once the record is in, and both routes record inside
   * `after()`, so no visitor waits for it. It never throws: a clearing that fails is one line in the log, costs the record
   * nothing, and is tried again on the process's next UTC day rather than on every record.
   * Each process clears once a day; when several do, every one after the first finds nothing
   * left to clear.
   */
  private async clearExpiredOncePerDay(): Promise<void> {
    const now = this.now();
    const day = utcDayOf(now);
    if (this.clearedOn === day) return;
    this.clearedOn = day;
    try {
      await clearExpiredVisitorText(this.sql, now);
    } catch (cause) {
      this.log("visitor-text-not-cleared", { message: messageOf(cause) });
    }
    try {
      await clearPastCounters(this.sql, now);
    } catch (cause) {
      this.log("visitor-counters-not-cleared", { message: messageOf(cause) });
    }
  }
}
