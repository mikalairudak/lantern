// With their extensions, since `scripts/events-report.mts` runs this file through Node directly.
import { runReport, type ReportCommand, type ReportSection } from "../db/report.ts";

export type { ReportCommand } from "../db/report.ts";

/**
 * `pnpm events:report [--environment production] [--days 30]`: prints the product's counts
 * for one environment over the last days, in UTC: the days opened by city, how they were
 * reached, how attempts ended, whether visitors waited, the gestures, the days taken along,
 * the days opened again and the cities Lantern could not do. It reads the database as `pnpm db:migrate` does, and
 * reads only, inside a read-only transaction (`src/lib/db/report.ts`).
 */

export const EVENTS_REPORT_DEFAULT_DAYS = 30;

const EVENTS_IN_SPAN = `FROM product_events WHERE environment = $1 AND utc_day >= $2::date`;
const DAY_SOURCE = `CASE WHEN written THEN 'written' ELSE 'model' END`;

/** The sections read from the product's own tables, which hold no visitor's words. */
export const EVENT_TABLE_SECTIONS: readonly ReportSection[] = [
  {
    title: "Days opened, by city (a visitor counts once a UTC day)",
    columns: ["city", "opened", "visitors"],
    text: `
      SELECT city, count(*)::integer AS opened, count(DISTINCT visitor_key)::integer AS visitors
      ${EVENTS_IN_SPAN} AND kind = 'day-opened'
      GROUP BY city ORDER BY opened DESC, city LIMIT 10`,
  },
  {
    title: "How days were reached",
    columns: ["via", "day", "opened"],
    text: `
      SELECT via, ${DAY_SOURCE} AS day, count(*)::integer AS opened
      ${EVENTS_IN_SPAN} AND kind = 'day-opened'
      GROUP BY 1, 2 ORDER BY opened DESC, via, day`,
  },
  {
    title: "How attempts ended",
    columns: ["attempt", "outcome", "times"],
    text: `
      SELECT CASE kind WHEN 'intake-ended' THEN 'text read' ELSE 'day' END AS attempt,
        outcome, count(*)::integer AS times
      ${EVENTS_IN_SPAN} AND kind IN ('intake-ended', 'day-ended')
      GROUP BY 1, 2 ORDER BY attempt, times DESC, outcome`,
  },
  {
    title: "Whether visitors waited",
    columns: ["day", "wait", "days"],
    text: `
      SELECT ${DAY_SOURCE} AS day,
        CASE kind WHEN 'day-left' THEN 'left ' || stage ELSE 'stayed to the end' END AS wait,
        count(*)::integer AS days
      ${EVENTS_IN_SPAN} AND kind IN ('day-left', 'day-ended')
      GROUP BY 1, 2 ORDER BY day, wait`,
  },
  {
    title: "Gestures",
    columns: ["gesture", "word", "times"],
    text: `
      SELECT kind AS gesture, coalesce(word, '') AS word, count(*)::integer AS times
      ${EVENTS_IN_SPAN} AND kind IN ('curve-dragged', 'stop-swapped', 'word-changed')
      GROUP BY 1, 2 ORDER BY times DESC, gesture, word`,
  },
  {
    title: "Days taken along (each way counts once a day opened)",
    columns: ["way", "days"],
    text: `
      SELECT kind AS way, count(*)::integer AS days
      ${EVENTS_IN_SPAN} AND kind IN ('link-shared', 'calendar-saved', 'route-opened')
      GROUP BY 1 ORDER BY days DESC, way`,
  },
  {
    title: "Days opened again by the same visitor on the same UTC day",
    columns: ["city", "visitors"],
    text: `
      SELECT city, count(*)::integer AS visitors FROM (
        SELECT city, visitor_key ${EVENTS_IN_SPAN} AND kind = 'day-opened'
        GROUP BY city, visitor_key HAVING count(*) > 1
      ) AS again
      GROUP BY city ORDER BY visitors DESC, city`,
  },
];

/**
 * From the generation log, which holds every model call: a day the model did not finish, and
 * a text whose city the intake read but could not answer. An intake's `output` may quote the
 * visitor, so `pnpm prod:read`'s role is not granted it and its events report leaves this out.
 */
const FAILED_CITIES_SECTION: ReportSection = {
  title: "Cities Lantern could not do (from the generation log)",
  columns: ["city", "times"],
  text: `
      SELECT city, count(*)::integer AS times FROM (
        SELECT lower(request->>'city') AS city FROM generation_log
        WHERE environment = $1 AND created_at >= $2::date::timestamp AT TIME ZONE 'UTC'
          AND role = 'day' AND outcome NOT IN ('complete', 'aborted')
        UNION ALL
        SELECT lower(output->>'city') FROM generation_log
        WHERE environment = $1 AND created_at >= $2::date::timestamp AT TIME ZONE 'UTC'
          AND role = 'intake' AND outcome = 'unavailable'
      ) AS failed
      WHERE city IS NOT NULL
      GROUP BY city ORDER BY times DESC, city LIMIT 10`,
};

/** Resolves with the process's exit code. */
export function runEventsReport(command: ReportCommand): Promise<number> {
  return runReport(command, {
    sections: [...EVENT_TABLE_SECTIONS, FAILED_CITIES_SECTION],
    defaultDays: EVENTS_REPORT_DEFAULT_DAYS,
  });
}
