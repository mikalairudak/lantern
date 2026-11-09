import type { Sql } from "@/lib/db/sql";
import type { ProductEvent } from "./event.schema";
import {
  EVENT_LIMITS,
  newSalt,
  type EventEntry,
  type EventLimits,
  type EventStore,
} from "./event-store";

/**
 * The product's events in Postgres (`db/migrations/0005_product_events.sql`). A day's salt
 * is read once per process and day; after that an event is one statement, which counts the
 * visitor, counts the app and keeps the row together, or does none of it.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/events/postgres-event-store.ts holds the day's salt and runs only on the server",
  );
}

/** Days past lose their salts and their visitors' counts; today's salt is made if none is. */
const DROP_PAST_DAYS = `DELETE FROM event_days WHERE utc_day < $1::date`;
const DROP_PAST_VISITORS = `DELETE FROM event_visitors WHERE utc_day < $1::date`;
const OPEN_DAY = `
  INSERT INTO event_days (environment, utc_day, salt) VALUES ($1, $2::date, $3)
  ON CONFLICT (environment, utc_day) DO NOTHING`;
const SALT_OF_DAY = `SELECT salt FROM event_days WHERE environment = $1 AND utc_day = $2::date`;

/**
 * Counts the visitor, then the app, then keeps the event, each only if the one before it
 * took. A visitor's first event of the day is counted only while the app has room, so a
 * spent day adds no rows; the app's count rises only below its limit, re-read once its row
 * is locked, so two events at once never both pass it. A visitor counted when the app's
 * last place went to another event at the same moment keeps that count, which costs them
 * one event of the day.
 */
const RECORD = `
  WITH visitor AS (
    INSERT INTO event_visitors AS counter (environment, utc_day, visitor_key, events)
    SELECT $1, $2::date, $3, 1
    WHERE EXISTS (
      SELECT 1 FROM event_days
      WHERE environment = $1 AND utc_day = $2::date AND events < $5::integer
    )
    ON CONFLICT (environment, utc_day, visitor_key)
    DO UPDATE SET events = counter.events + 1
    WHERE counter.events < $4::integer
    RETURNING 1
  ), app AS (
    UPDATE event_days SET events = events + 1
    WHERE environment = $1 AND utc_day = $2::date AND events < $5::integer
      AND EXISTS (SELECT 1 FROM visitor)
    RETURNING 1
  )
  INSERT INTO product_events (
    id, environment, utc_day, visitor_key, kind, city, via, written, outcome, stage, word
  )
  SELECT $6::uuid, $1, $2::date, $3, $7, $8::text, $9::text, $10::boolean, $11::text,
    $12::text, $13::text
  WHERE EXISTS (SELECT 1 FROM app)
  RETURNING id`;

/** The event's fields as the table's columns, null where its kind has none. */
export function columnsOf(event: ProductEvent): {
  city: string | null;
  via: string | null;
  written: boolean | null;
  outcome: string | null;
  stage: string | null;
  word: string | null;
} {
  return {
    city: "city" in event ? event.city : null,
    via: "via" in event ? event.via : null,
    written: "written" in event ? event.written : null,
    outcome: "outcome" in event ? event.outcome : null,
    stage: "stage" in event ? event.stage : null,
    word: "word" in event ? event.word : null,
  };
}

/**
 * One row per event. `environment` is where it arrived (`VERCEL_ENV`, or `development`),
 * since the laptop and preview deploys share a database; each environment counts its own.
 */
export class PostgresEventStore implements EventStore {
  private today: { day: string; salt: string } | null = null;

  constructor(
    private readonly sql: Sql,
    private readonly environment: string,
    private readonly limits: EventLimits = EVENT_LIMITS,
  ) {}

  async saltOn(day: string): Promise<string> {
    if (this.today?.day === day) return this.today.salt;
    const [, , , rows] = await this.sql.transaction([
      { text: DROP_PAST_DAYS, params: [day] },
      { text: DROP_PAST_VISITORS, params: [day] },
      { text: OPEN_DAY, params: [this.environment, day, newSalt()] },
      { text: SALT_OF_DAY, params: [this.environment, day] },
    ]);
    const salt = (rows?.[0] as { salt?: unknown } | undefined)?.salt;
    if (typeof salt !== "string") throw new Error(`No salt was kept for ${day}`);
    this.today = { day, salt };
    return salt;
  }

  async record({ id, visitor, day, event }: EventEntry): Promise<boolean> {
    const { city, via, written, outcome, stage, word } = columnsOf(event);
    const rows = await this.sql.query(RECORD, [
      this.environment,
      day,
      visitor,
      this.limits.perVisitor,
      this.limits.perApp,
      id,
      event.kind,
      city,
      via,
      written,
      outcome,
      stage,
      word,
    ]);
    return rows.length === 1;
  }
}
