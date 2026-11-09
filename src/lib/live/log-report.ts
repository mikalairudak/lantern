// With their extensions, since `scripts/log-report.mts` runs this file through Node directly.
import { runReport, type ReportCommand, type ReportSection } from "../db/report.ts";

/**
 * `pnpm log:report [--environment production] [--days 7]`: what the generation log says of
 * one environment's model calls over the last days, in UTC, so the eval reads live traffic as
 * it reads its rounds: the calls by role and prompt with their cost and waits, how they ended,
 * each check's share passed and mean, the targeted re-plans, and the spend by day. It reads
 * no column that may quote the visitor or the model's words: never `visitor_text`,
 * `output_text`, `output` nor `error` (a test holds every query to that). It reads the
 * database as `pnpm db:migrate` does, inside a read-only transaction (`src/lib/db/report.ts`).
 */

export const LOG_REPORT_DEFAULT_DAYS = 7;

/** The environment asked for, `$1`, from the first UTC day counted, `$2`. */
const IN_SPAN = `environment = $1 AND created_at >= $2::date::timestamp AT TIME ZONE 'UTC'`;
/**
 * A targeted re-plan's row: the one call that writes `context` (`0006`). It is written in the
 * day's role, so the archive opens it as a day, and this is what tells it apart, in every
 * report as in the archive (`src/lib/live/generation-log.ts`, `context`).
 */
export const IS_REPLAN = "context IS NOT NULL";
const CALL = `CASE WHEN ${IS_REPLAN} THEN 'replan' ELSE role END`;
const COST = `to_char(coalesce(sum(cost_micro_usd), 0) / 1e6, 'FM999990.0000')`;

/** The wait at this quantile of the calls, in seconds to one decimal. */
function secondsAt(quantile: number, column: string): string {
  return `round((percentile_cont(${quantile}) WITHIN GROUP (ORDER BY ${column}) / 1000)::numeric, 1)`;
}

/** The report's tables, in the order printed. */
export const LOG_REPORT_SECTIONS: readonly ReportSection[] = [
  {
    title: "Calls, by role and prompt: cost in dollars, mean tokens, waits in seconds",
    columns: [
      "call",
      "prompt",
      "calls",
      "cost",
      "in",
      "out",
      "first p50",
      "first p90",
      "end p50",
      "end p90",
    ],
    text: `
      SELECT ${CALL} AS call, prompt_version AS prompt, count(*)::integer AS calls,
        ${COST} AS cost,
        round(avg(input_tokens))::integer AS "in", round(avg(output_tokens))::integer AS "out",
        ${secondsAt(0.5, "ms_to_first_token")} AS "first p50",
        ${secondsAt(0.9, "ms_to_first_token")} AS "first p90",
        ${secondsAt(0.5, "ms_to_finish")} AS "end p50",
        ${secondsAt(0.9, "ms_to_finish")} AS "end p90"
      FROM generation_log WHERE ${IN_SPAN}
      GROUP BY 1, 2 ORDER BY call, prompt`,
  },
  {
    title: "How calls ended (a cut the salvage rule kept a day of, marked salvaged)",
    columns: ["call", "prompt", "outcome", "calls"],
    text: `
      SELECT ${CALL} AS call, prompt_version AS prompt,
        outcome || CASE WHEN salvaged THEN ', salvaged' ELSE '' END AS outcome,
        count(*)::integer AS calls
      FROM generation_log WHERE ${IN_SPAN}
      GROUP BY 1, 2, 3 ORDER BY call, prompt, calls DESC, outcome`,
  },
  {
    title: "Checks: the calls scored, the share passed and the mean measure",
    columns: ["call", "check", "kind", "scored", "passed", "share", "mean"],
    text: `
      SELECT ${CALL} AS call, item->>'id' AS "check", item->>'kind' AS kind,
        count(*)::integer AS scored,
        count(*) FILTER (WHERE (item->>'passed')::boolean)::integer AS passed,
        round(avg(CASE WHEN (item->>'passed')::boolean THEN 1 ELSE 0 END), 2) AS share,
        round(avg((item->>'value')::numeric), 2) AS mean
      FROM generation_log CROSS JOIN LATERAL jsonb_array_elements(checks) AS item
      WHERE ${IN_SPAN}
      GROUP BY 1, 2, 3 ORDER BY call, "check"`,
  },
  {
    title: "Targeted re-plans: the windows kept as asked, and the merge's repairs",
    columns: ["prompt", "re-plans", "windows kept", "mean repairs"],
    text: `
      SELECT prompt_version AS prompt, count(*)::integer AS "re-plans",
        count(*) FILTER (WHERE checks @> '[{"id": "replan-windows", "passed": true}]')::integer
          AS "windows kept",
        round(avg(repairs), 1) AS "mean repairs"
      FROM generation_log WHERE ${IN_SPAN} AND ${IS_REPLAN}
      GROUP BY 1 ORDER BY prompt`,
  },
  {
    title: "Spend by UTC day, in dollars (a call whose usage never came counts nothing here)",
    columns: ["day", "calls", "no usage", "cost"],
    text: `
      SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
        count(*)::integer AS calls,
        count(*) FILTER (WHERE cost_micro_usd IS NULL)::integer AS "no usage",
        ${COST} AS cost
      FROM generation_log WHERE ${IN_SPAN}
      GROUP BY 1 ORDER BY day`,
  },
];

/** Resolves with the process's exit code. */
export function runLogReport(command: ReportCommand): Promise<number> {
  return runReport(command, {
    sections: LOG_REPORT_SECTIONS,
    defaultDays: LOG_REPORT_DEFAULT_DAYS,
  });
}
