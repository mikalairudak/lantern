import type { Sql } from "@/lib/db/sql";

/**
 * How long the generation log keeps what a visitor typed (`docs/decisions.md`, "What Lantern keeps
 * is said on one page"). The privacy page states the period from here.
 */
export const VISITOR_TEXT_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The most rows one clearing touches, so a backlog never makes one statement long. */
export const CLEAR_BATCH_ROWS = 1_000;

/**
 * Clears every column of an intake's row that could quote the visitor, oldest rows first:
 * the text itself; the model's output, raw and parsed, whose `unplaced` quotes it and whose
 * `city` is read from it; and the error's message, since a parse error quotes the output.
 * Tokens, cost, timings, outcome, model, prompt version, the request (Geoapify's city and
 * closed words) and the error's status, type and code stay for the eval and the bill.
 * `visitor_text` is NULL only on a cleared intake, since every intake is written with its
 * text, so a cleared row is never cleared again. A day's and a shadow's rows hold nothing
 * the visitor typed, since a day is written from the request's fixed words alone, so they
 * stay whole.
 */
const CLEAR_EXPIRED_INTAKES = `
  UPDATE generation_log
  SET visitor_text = NULL, output_text = '', output = NULL, error = error - 'message'
  WHERE id IN (
    SELECT id FROM generation_log
    WHERE role = 'intake' AND visitor_text IS NOT NULL AND created_at < $1::timestamptz
    ORDER BY created_at
    LIMIT $2::integer
  )
  RETURNING id`;

/** The moment before which a row's visitor text has been kept long enough. */
export function retentionCutoffOf(now: Date): Date {
  return new Date(now.getTime() - VISITOR_TEXT_RETENTION_DAYS * DAY_MS);
}

/**
 * Clears what visitors typed from intake rows written more than the retention before `now`,
 * at most `batchRows` of them, and says how many it cleared.
 */
export async function clearExpiredVisitorText(
  sql: Sql,
  now: Date,
  batchRows: number = CLEAR_BATCH_ROWS,
): Promise<number> {
  const rows = await sql.query(CLEAR_EXPIRED_INTAKES, [
    retentionCutoffOf(now).toISOString(),
    batchRows,
  ]);
  return rows.length;
}

/**
 * A visitor's counts are read only on their own UTC day, and a call given back after midnight
 * reaches the day before at most (`src/lib/live/limits.ts`), so a count older than that is no
 * longer needed. Each row is a salted hash of an address and a day, and the salt never
 * changes, so kept for good they would be a history of the days each address used Lantern;
 * `/privacy` says the counts start again each day (`docs/security.md`, S5).
 */
const CLEAR_PAST_COUNTERS = `
  DELETE FROM visitor_counters WHERE utc_day < $1::date
  RETURNING visitor_key`;

/** The first UTC day whose counts are still kept: yesterday's. */
export function countersCutoffOf(now: Date): string {
  return new Date(now.getTime() - DAY_MS).toISOString().slice(0, "YYYY-MM-DD".length);
}

/** Deletes every visitor's counts from before yesterday, and says how many rows went. */
export async function clearPastCounters(sql: Sql, now: Date): Promise<number> {
  const rows = await sql.query(CLEAR_PAST_COUNTERS, [countersCutoffOf(now)]);
  return rows.length;
}
