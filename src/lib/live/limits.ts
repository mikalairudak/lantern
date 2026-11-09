import { utcDayOf, utcMonthOf } from "@/lib/time/utc-day";

/**
 * Cost protection: what a visitor may ask of a model in a day, and what the whole app may spend
 * (`docs/decisions.md`, "Every model call holds its worst case against the spend caps before it is
 * made"). Both are checked before any model call; over either, the route answers 429 and the client
 * shows `limited`. A written day is served from its file and never counts. Interfaces here, with
 * in-memory implementations for tests and a laptop; the Postgres adapters (`postgres-stores.ts`)
 * keep the same contracts.
 *
 * A day is a calendar day in UTC, for every visitor alike: the counters turn over at one
 * moment, whatever a visitor's zone (`src/lib/time/utc-day.ts`).
 */

/** What a visitor's counters count: days a model writes and texts the intake reads. */
export type LimitKind = "day" | "intake";

/**
 * Per visitor, per day (`docs/decisions.md`, "Every model call holds its worst case against the
 * spend caps before it is made"). A changed word that rewrites the day counts.
 */
export const VISITOR_DAILY_LIMITS: Readonly<Record<LimitKind, number>> = { day: 10, intake: 20 };

/** One call counted against a visitor, kept so a call never made can be given back. */
export interface Take {
  visitor: string;
  kind: LimitKind;
  /** The UTC day it was counted in. */
  day: string;
}

export interface VisitorLimits {
  /**
   * Counts one call for the visitor today, or resolves null, counting nothing, when today's
   * are spent. Checking and counting are one step, so two requests at once cannot both take
   * the last one; in Postgres an upsert that increments only below the limit.
   */
  take(visitor: string, kind: LimitKind, now: Date): Promise<Take | null>;
  /** Gives a take back for a call that was never made; a day already over keeps it. */
  giveBack(take: Take): Promise<void>;
}

/** What the whole app may spend, counting the visitor's day, the shadow and the intake. */
export interface SpendCaps {
  dailyUsd: number;
  /** null turns the month's ceiling off. */
  monthlyUsd: number | null;
}

/**
 * $10 a day and $95 a calendar month (`docs/decisions.md`, "Every model call holds its worst case
 * against the spend caps before it is made"). Production's monthly workspace limit is $100, so ours
 * stops first and the month ends in `limited`, which offers the written days, rather than in the
 * provider's `unavailable` for every day at once.
 */
export const APP_SPEND_CAPS: SpendCaps = { dailyUsd: 10, monthlyUsd: 95 };

/**
 * How long a hold counts if it is never settled. A settle can fail to come: a log write that
 * fails first, a response lost after the store committed the hold, a function stopped at its
 * time limit. So every hold expires, well past the longest a route may run (the day's 150 s
 * `maxDuration`, `after()` included), and a lost one costs the cap ten minutes, not a month.
 */
export const HOLD_TTL_MS = 10 * 60 * 1000;

/**
 * One deadline for everything a request asks of the stores before its model call, so a slow
 * database answers 503 in seconds rather than eat the route's `maxDuration` (30 s for the
 * intake). Neon wakes a sleeping database in about a second.
 */
export const PRE_CALL_DEADLINE_MS = 8_000;

/** What the visitors' counts and the app's spend are called when they miss that deadline. */
export const LIMITS_STORE = "The limits' store";

/** Budget held for one call until it is settled with what the call cost. */
export interface Reservation {
  /** The hold's own name, so settling removes exactly it. */
  id: string;
  usd: number;
  /** The UTC day and month it was held in, so a call that ends past midnight settles there. */
  day: string;
  month: string;
}

export interface AppSpend {
  /**
   * Holds the most a call can cost against today's and this month's caps, or resolves null,
   * holding nothing, when that would pass either. Holding the worst case before the call is
   * what keeps the endpoint under the cap while calls run at once. A hold never settled stops
   * counting `HOLD_TTL_MS` after `now`.
   */
  reserve(usd: number, now: Date): Promise<Reservation | null>;
  /**
   * Replaces a reservation with what the call cost, 0 for a call never made. A call settled
   * after its hold expired still counts what it cost.
   */
  settle(reservation: Reservation, spentUsd: number): Promise<void>;
}

/** A reservation with what to settle it at. */
export interface Settlement {
  reservation: Reservation;
  spentUsd: number;
}

/** What a request holds before its calls are handed to `after()`, which would settle them. */
export interface Held {
  /**
   * The visitor's count, until it is given back: by a request that fails before `after()`,
   * or, for a day, once its stream ends with no stops (`live-day.ts`). Never both.
   */
  take: Take | null;
  /** Each reservation with what to settle it at if the request fails before `after()`. */
  reservations: Settlement[];
}

function rejectionsOf(results: readonly PromiseSettledResult<unknown>[]): unknown[] {
  return results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
}

/**
 * Settles each reservation on its own, so one the store refuses leaves the others settled.
 * Resolves with what the store refused, for the log.
 */
export async function settleAll(
  appSpend: AppSpend,
  settlements: readonly Settlement[],
): Promise<unknown[]> {
  return rejectionsOf(
    await Promise.allSettled(
      settlements.map(({ reservation, spentUsd }) => appSpend.settle(reservation, spentUsd)),
    ),
  );
}

/**
 * Gives back what a request held when it failed before `after()` took its calls over: the
 * visitor's take returns, and each reservation settles at what its call spent, nothing for a
 * call never made. Resolves with whatever the stores failed to take back, for the log.
 */
export async function giveBackHeld(
  { take, reservations }: Held,
  stores: { visitorLimits: VisitorLimits; appSpend: AppSpend },
): Promise<unknown[]> {
  const [unsettled, givenBack] = await Promise.all([
    settleAll(stores.appSpend, reservations),
    Promise.allSettled(take === null ? [] : [stores.visitorLimits.giveBack(take)]),
  ]);
  return [...unsettled, ...rejectionsOf(givenBack)];
}

/**
 * Counters in one process, for tests and a laptop. On Vercel each instance would keep its
 * own and lose them on a cold start, so a deploy counts in Postgres (`postgres-stores.ts`).
 */
export class InMemoryVisitorLimits implements VisitorLimits {
  private day = "";
  private readonly counts = new Map<string, number>();

  constructor(
    private readonly limits: Readonly<Record<LimitKind, number>> = VISITOR_DAILY_LIMITS,
  ) {}

  take(visitor: string, kind: LimitKind, now: Date): Promise<Take | null> {
    const day = utcDayOf(now);
    if (day !== this.day) {
      // Yesterday's counts are never read again, so they go.
      this.day = day;
      this.counts.clear();
    }
    const key = `${kind}:${visitor}`;
    const count = this.counts.get(key) ?? 0;
    if (count >= this.limits[kind]) return Promise.resolve(null);
    this.counts.set(key, count + 1);
    return Promise.resolve({ visitor, kind, day });
  }

  giveBack({ visitor, kind, day }: Take): Promise<void> {
    const key = `${kind}:${visitor}`;
    const count = this.counts.get(key) ?? 0;
    if (day === this.day && count > 0) this.counts.set(key, count - 1);
    return Promise.resolve();
  }
}

interface Hold {
  reservation: Reservation;
  expiresAt: number;
}

/** The app's spend in one process, with the same caveat as `InMemoryVisitorLimits`. */
export class InMemoryAppSpend implements AppSpend {
  private readonly spentByDay = new Map<string, number>();
  private readonly spentByMonth = new Map<string, number>();
  private readonly holds = new Map<string, Hold>();

  constructor(private readonly caps: SpendCaps = APP_SPEND_CAPS) {}

  reserve(usd: number, now: Date): Promise<Reservation | null> {
    for (const [id, { expiresAt }] of this.holds) {
      if (expiresAt <= now.getTime()) this.holds.delete(id);
    }
    const reservation = {
      id: crypto.randomUUID(),
      usd,
      day: utcDayOf(now),
      month: utcMonthOf(now),
    };
    const dayTotal = this.usedOn(reservation.day, now) + usd;
    const monthTotal = this.usedIn(reservation.month, now) + usd;
    const isOverMonth = this.caps.monthlyUsd !== null && monthTotal > this.caps.monthlyUsd;
    if (dayTotal > this.caps.dailyUsd || isOverMonth) return Promise.resolve(null);
    this.holds.set(reservation.id, { reservation, expiresAt: now.getTime() + HOLD_TTL_MS });
    return Promise.resolve(reservation);
  }

  settle({ id, day, month }: Reservation, spentUsd: number): Promise<void> {
    this.holds.delete(id);
    this.spentByDay.set(day, (this.spentByDay.get(day) ?? 0) + spentUsd);
    this.spentByMonth.set(month, (this.spentByMonth.get(month) ?? 0) + spentUsd);
    return Promise.resolve();
  }

  /** What today has cost so far, holds that still count included. */
  spentOn(now: Date): number {
    return this.usedOn(utcDayOf(now), now);
  }

  private usedOn(day: string, now: Date): number {
    return (this.spentByDay.get(day) ?? 0) + this.heldWhere((hold) => hold.day === day, now);
  }

  private usedIn(month: string, now: Date): number {
    return (
      (this.spentByMonth.get(month) ?? 0) + this.heldWhere((hold) => hold.month === month, now)
    );
  }

  private heldWhere(matches: (hold: Reservation) => boolean, now: Date): number {
    let held = 0;
    for (const { reservation, expiresAt } of this.holds.values()) {
      if (expiresAt > now.getTime() && matches(reservation)) held += reservation.usd;
    }
    return held;
  }
}
