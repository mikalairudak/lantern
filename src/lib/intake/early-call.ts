/**
 * When the intake may call Claude before its limits have answered (`docs/decisions.md`,
 * "The limits and the log live in Postgres, and every hold expires"). Neon's free plan sleeps after
 * five minutes idle and takes about 1.2 s to wake, the cold intake's largest wait, so a process
 * that has heard nothing from the database for four minutes starts Haiku's read beside the
 * limits instead of after them. A read the limits then refuse is stopped, left unread and
 * charged to the app's spend.
 *
 * Each early call opens a new quiet spell, so requests that come together share one, and a
 * flood, which keeps the database answering, starts none. Refused early calls therefore cost
 * at most one intake's hold per process every four minutes, however many requests come.
 */

/** A minute under Neon's five, so a database this process heard from is still awake. */
export const QUIET_DATABASE_MS = 4 * 60 * 1000;

/** One process's view of whether the database may be asleep. */
export class EarlyCallGate {
  private lastHeardAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly quietMs: number = QUIET_DATABASE_MS) {}

  /**
   * Whether this request may call before the limits answer: only when the database has said
   * nothing to this process for `quietMs`. A yes opens a new quiet spell, so the next request
   * waits for the limits as before.
   */
  mayCallEarly(now: Date): boolean {
    if (now.getTime() - this.lastHeardAt < this.quietMs) return false;
    this.lastHeardAt = now.getTime();
    return true;
  }

  /** The database answered: it stays awake for a while yet. */
  heardFromDatabase(now: Date): void {
    this.lastHeardAt = Math.max(this.lastHeardAt, now.getTime());
  }
}
