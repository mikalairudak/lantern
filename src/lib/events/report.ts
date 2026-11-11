// With their extensions, since `scripts/events-report.mts` runs this file through Node directly.
import type { DayAnswer } from "./event.schema";
import { runReport, type ReportCommand, type ReportSection } from "../db/report.ts";

export type { ReportCommand } from "../db/report.ts";

/**
 * `pnpm events:report [--environment production] [--days 30]`: prints the product's counts
 * for one environment over the last days, in UTC: the way from the start screen to a day taken
 * along, the days taken along by way in and by view, the days answered by view, the days opened
 * by city, how they were reached, how attempts ended, whether visitors waited, the gestures, the days taken along,
 * the days opened again and the cities Lantern could not do. It reads the database as
 * `pnpm db:migrate` does, and reads only, inside a read-only transaction
 * (`src/lib/db/report.ts`).
 */

export const EVENTS_REPORT_DEFAULT_DAYS = 30;

/**
 * The fewest visitors a group needs before the report gives it a share, as a percentage beside
 * its counts: below it a share moves by several points with one visitor, so the group gets its
 * counts alone, and two groups are compared by share only when both have this many.
 */
export const SHARE_MIN_VISITORS = 30;

const EVENTS_IN_SPAN = `FROM product_events WHERE environment = $1 AND utc_day >= $2::date`;
const DAY_SOURCE = `CASE WHEN written THEN 'written' ELSE 'model' END`;
/** The three ways a day is taken along from the line under it. */
const TAKEN_ALONG = `'link-shared', 'calendar-saved', 'route-opened'`;
/**
 * Visitors, each once a UTC day. A visitor key is made under its day's salt, and the day is
 * counted with it, so the rule never rests on two days' keys being unalike.
 */
const VISITORS = `count(DISTINCT (utc_day, visitor_key))::integer`;

/**
 * Whether the visitor of the row `base` (in `base`'s UTC day) also sent an event of `kinds`
 * with the same `group` (`via` or `view`), so a count of it is a part of the group's whole
 * and its share never passes 100%.
 */
function alsoSent(base: string, kinds: string, group: string): string {
  return `EXISTS (
    SELECT 1 FROM product_events AS also
    WHERE also.environment = $1 AND also.utc_day = ${base}.utc_day
      AND also.visitor_key = ${base}.visitor_key AND also.${group} = ${base}.${group}
      AND also.kind IN (${kinds}))`;
}

/**
 * Each visitor once a UTC day who sent `whole` in a group, with whether they also sent each
 * of `parts` in it: the rows a share's whole and its parts are counted from.
 */
function visitorsOf(group: string, whole: string, parts: Record<string, string>): string {
  const flags = Object.entries(parts).map(
    ([name, kinds]) => `${alsoSent("whole", kinds, group)} AS ${name}`,
  );
  return `
    SELECT DISTINCT whole.${group}, whole.utc_day, whole.visitor_key, ${flags.join(", ")}
    FROM product_events AS whole
    WHERE whole.environment = $1 AND whole.utc_day >= $2::date AND whole.kind = '${whole}'`;
}

/** Whether the visitor of the row `base` answered the day's end `answer` in `base`'s view and day. */
function answeredIn(base: string, answer: DayAnswer): string {
  return `EXISTS (
    SELECT 1 FROM product_events AS also
    WHERE also.environment = $1 AND also.utc_day = ${base}.utc_day
      AND also.visitor_key = ${base}.visitor_key AND also.view = ${base}.view
      AND also.kind = 'day-answered' AND also.answer = '${answer}')`;
}

/** What a group is called whose events were kept before they said it. */
const NOT_TOLD = `'not told'`;

/** `part` of `whole` as a whole percentage, or how few `whole` is for one. */
function shareOf(part: string, whole: string): string {
  return `CASE WHEN ${whole} >= ${SHARE_MIN_VISITORS}
    THEN round(100.0 * ${part} / ${whole})::integer || '%'
    ELSE 'n < ${SHARE_MIN_VISITORS}' END`;
}

/** The sections read from the product's own tables, which hold no visitor's words. */
export const EVENT_TABLE_SECTIONS: readonly ReportSection[] = [
  {
    title: "From the start screen to a day taken along, by way in (visitors, once a UTC day)",
    columns: ["step", "via", "visitors"],
    text: `
      SELECT step, via, ${VISITORS} AS visitors FROM (
        SELECT CASE kind WHEN 'home-viewed' THEN 1 WHEN 'day-opened' THEN 2
            WHEN 'day-ended' THEN 3 ELSE 4 END AS rank,
          CASE kind WHEN 'home-viewed' THEN 'home viewed' WHEN 'day-opened' THEN 'day opened'
            WHEN 'day-ended' THEN 'day ended' ELSE 'taken along' END AS step,
          CASE WHEN kind = 'home-viewed' THEN '' ELSE coalesce(via, ${NOT_TOLD}) END AS via,
          utc_day, visitor_key
        ${EVENTS_IN_SPAN} AND kind IN ('home-viewed', 'day-opened', 'day-ended', ${TAKEN_ALONG})
      ) AS steps
      GROUP BY rank, step, via ORDER BY rank, visitors DESC, via`,
  },
  {
    title: `Days taken along, by way in (visitors who opened a day that way, and of them who took one along; a share from ${SHARE_MIN_VISITORS})`,
    columns: ["via", "opened", "taken along", "share"],
    text: `
      SELECT via, opened, taken AS "taken along", ${shareOf("taken", "opened")} AS share FROM (
        SELECT coalesce(via, ${NOT_TOLD}) AS via, count(*)::integer AS opened,
          (count(*) FILTER (WHERE taken))::integer AS taken
        FROM (${visitorsOf("via", "day-opened", { taken: TAKEN_ALONG })}) AS visitors
        GROUP BY 1
      ) AS ways
      ORDER BY opened DESC, taken DESC, via`,
  },
  {
    title: `Days taken along, by view (visitors whose day ended in that view, and of them who did each in it; a share from ${SHARE_MIN_VISITORS})`,
    columns: ["view", "ended", "read to end", "taken along", "share"],
    text: `
      SELECT view, ended, read_to_end AS "read to end", taken AS "taken along",
        ${shareOf("taken", "ended")} AS share FROM (
        SELECT coalesce(view, ${NOT_TOLD}) AS view, count(*)::integer AS ended,
          (count(*) FILTER (WHERE read_to_end))::integer AS read_to_end,
          (count(*) FILTER (WHERE taken))::integer AS taken
        FROM (${visitorsOf("view", "day-ended", {
          read_to_end: "'day-read-to-end'",
          taken: TAKEN_ALONG,
        })}) AS visitors
        GROUP BY 1
      ) AS views
      ORDER BY ended DESC, taken DESC, view`,
  },
  {
    title: `Days answered, by view (visitors whose day ended in that view, and of them who answered "Would you follow this day?"; a share of yes from ${SHARE_MIN_VISITORS} answers)`,
    columns: ["view", "ended", "answered", "yes", "not quite", "yes share"],
    text: `
      SELECT view, ended, answered, yes, not_quite AS "not quite",
        ${shareOf("yes", "answered")} AS "yes share" FROM (
        SELECT coalesce(view, ${NOT_TOLD}) AS view, count(*)::integer AS ended,
          (count(*) FILTER (WHERE said_yes OR said_not_quite))::integer AS answered,
          (count(*) FILTER (WHERE said_yes))::integer AS yes,
          (count(*) FILTER (WHERE said_not_quite))::integer AS not_quite
        -- A visitor once a UTC day in the view their day ended in, as "taken along" counts, with
        -- whether they answered yes and whether not quite in that view. No time of day is kept,
        -- so a visitor who answered both ways that day counts in both, never past the whole.
        FROM (
          SELECT DISTINCT whole.view, whole.utc_day, whole.visitor_key,
            ${answeredIn("whole", "yes")} AS said_yes,
            ${answeredIn("whole", "not-quite")} AS said_not_quite
          FROM product_events AS whole
          WHERE whole.environment = $1 AND whole.utc_day >= $2::date AND whole.kind = 'day-ended'
        ) AS visitors
        GROUP BY 1
      ) AS views
      ORDER BY ended DESC, answered DESC, view`,
  },
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
