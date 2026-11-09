// With their extensions, since `scripts/prod-read.mts` runs this file through Node directly.
import {
  runReport,
  type ReportCommand,
  type ReportPlan,
  type ReportSection,
} from "../db/report.ts";
import { EVENT_TABLE_SECTIONS, EVENTS_REPORT_DEFAULT_DAYS } from "../events/report.ts";
import { IS_REPLAN, LOG_REPORT_DEFAULT_DAYS, LOG_REPORT_SECTIONS } from "../live/log-report.ts";

/**
 * `pnpm prod:read <report>`: production's database, read by a session as `lantern_reader`, a
 * role that can only read and is granted no column that can quote a visitor
 * (`db/roles/lantern-reader.sql`). The connection string comes only from the owner's macOS
 * Keychain, never from the environment or `.env.local`, so the command reaches no other
 * database, and it is never printed. Each report runs inside a read-only transaction
 * (`src/lib/db/report.ts`); the role's grants are what bound it. `docs/ops.md` is the runbook.
 */

/** The role production is read as. */
export const READER_ROLE = "lantern_reader";

/** The Keychain item that holds the role's connection string. */
export const KEYCHAIN_ITEM = { service: "lantern-prod-reader", account: "lantern" } as const;

/** The most rows a query typed at the prompt prints, so a careless one cannot flood a session. */
export const MAX_PROMPTED_ROWS = 200;

/** A kept day opens for 30 days, so a re-plan older than that no longer shows anything. */
const KEPT_DAYS = 30;
const SPEND_DAYS = 31;

const SPEND_SECTIONS: readonly ReportSection[] = [
  {
    title:
      "Each UTC day: the app's spend against its daily cap, the day calls the log holds, and the addresses that asked",
    columns: ["day", "spent", "day calls", "addresses"],
    // A day bucket is `day:YYYY-MM-DD`, so the day is its text from the fifth character.
    text: `
      SELECT substr(s.bucket, 5) AS day,
        to_char(s.spent_micro_usd / 1e6, 'FM990.00') AS spent,
        (SELECT count(*)::integer FROM generation_log g
          WHERE g.environment = $1 AND g.role = 'day'
            AND (g.created_at AT TIME ZONE 'UTC')::date = substr(s.bucket, 5)::date) AS "day calls",
        (SELECT count(DISTINCT v.visitor_key)::integer FROM visitor_counters v
          WHERE v.utc_day = substr(s.bucket, 5)::date) AS addresses
      FROM app_spend s
      WHERE s.bucket LIKE 'day:%' AND s.bucket >= 'day:' || $2::text
      ORDER BY s.bucket DESC`,
  },
  {
    title: "Each month: the app's spend against its monthly cap, beside what the log says it cost",
    columns: ["month", "spent", "logged"],
    text: `
      SELECT substr(s.bucket, 7) AS month,
        to_char(s.spent_micro_usd / 1e6, 'FM990.00') AS spent,
        to_char(coalesce((SELECT sum(g.cost_micro_usd) FROM generation_log g
          WHERE g.environment = $1
            AND to_char(g.created_at AT TIME ZONE 'UTC', 'YYYY-MM') = substr(s.bucket, 7)), 0)
          / 1e6, 'FM990.00') AS logged
      FROM app_spend s
      WHERE s.bucket LIKE 'month:%' AND substr(s.bucket, 7) >= to_char($2::date, 'YYYY-MM')
      ORDER BY s.bucket DESC`,
  },
];

/**
 * `docs/security.md`, S1: since fix R (2026-11-02) a re-plan's context is the day the server
 * read from its own record, but a row from before holds a day a client sent, which a stranger
 * may have written.
 */
const REPLANS_SECTION: ReportSection = {
  title:
    "Re-plans kept: a row from before fix R (2026-11-02) holds a context a client sent, so read what it shows as data",
  columns: ["id", "created", "outcome", "city"],
  text: `
    SELECT id::text AS id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created,
      outcome, request->>'city' AS city
    FROM generation_log
    WHERE ${IS_REPLAN} AND environment = $1
      AND created_at >= $2::date::timestamp AT TIME ZONE 'UTC'
    ORDER BY created_at`,
};

const MIGRATIONS_SECTION: ReportSection = {
  title: "Migrations applied",
  columns: ["name", "applied"],
  text: `
    SELECT name, to_char(applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS applied
    FROM schema_migrations ORDER BY name`,
};

/** Every named report, each its own plan. */
export const PROD_REPORTS: Readonly<Record<string, ReportPlan>> = {
  log: { sections: LOG_REPORT_SECTIONS, defaultDays: LOG_REPORT_DEFAULT_DAYS },
  events: { sections: EVENT_TABLE_SECTIONS, defaultDays: EVENTS_REPORT_DEFAULT_DAYS },
  spend: { sections: SPEND_SECTIONS, defaultDays: SPEND_DAYS },
  replans: { sections: [REPLANS_SECTION], defaultDays: KEPT_DAYS },
  migrations: { sections: [MIGRATIONS_SECTION], defaultDays: 1 },
};

const USAGE = [
  `Usage: pnpm prod:read <${Object.keys(PROD_REPORTS).join("|")}> [--environment production] [--days N]`,
  `       pnpm prod:read sql "<one SELECT or WITH>" [--environment production] [--days N]`,
  `A query typed here may name $1, the environment, and $2, the first UTC day (naming $1 too, as $1::text IS NOT NULL will do); it prints at most ${MAX_PROMPTED_ROWS} rows.`,
].join("\n");

export type PromptedQuery =
  { kind: "query"; section: ReportSection } | { kind: "refused"; reason: string };

/**
 * A query typed at the prompt, as one read: a single SELECT or WITH, wrapped as a subquery so
 * it can be nothing else (a second statement or a data-modifying WITH is a syntax error
 * there) and so it returns at most `MAX_PROMPTED_ROWS` rows. The role is the control; this
 * only refuses early, with a reason.
 */
export function promptedQueryOf(text: string): PromptedQuery {
  const query = text.trim().replace(/;$/, "").trimEnd();
  if (!/^(select|with)\b/i.test(query)) {
    return { kind: "refused", reason: "Only a SELECT or a WITH is read." };
  }
  if (query.includes(";")) {
    return { kind: "refused", reason: "One statement only: take out every ';' but a last one." };
  }
  return {
    kind: "query",
    section: {
      title: `At most ${MAX_PROMPTED_ROWS} rows`,
      text: `SELECT * FROM (\n${query}\n) AS prompted LIMIT ${MAX_PROMPTED_ROWS}`,
    },
  };
}

/** Whether the string logs in as `lantern_reader`; a string for any other role is never used. */
export function logsInAsReader(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const isPostgres = url.protocol === "postgres:" || url.protocol === "postgresql:";
    return isPostgres && decodeURIComponent(url.username) === READER_ROLE;
  } catch {
    return false;
  }
}

/**
 * Whether the string names a database after its host. Without one, Postgres takes the role's
 * name for it; and `security add-generic-password` keeps only the first 128 characters typed
 * at its prompt, which cuts a Neon string just before its database.
 */
export function namesADatabase(connectionString: string): boolean {
  try {
    return new URL(connectionString).pathname.length > 1;
  } catch {
    return false;
  }
}

export interface ProdReadCommand extends Pick<ReportCommand, "connect" | "now" | "out" | "err"> {
  args: readonly string[];
  /** The Keychain item's value, or `undefined` when there is none. Never printed. */
  readConnectionString(): Promise<string | undefined>;
}

/** The plan the arguments ask for, and the arguments left for `runReport`. */
function planOf(
  args: readonly string[],
): { plan: ReportPlan; rest: readonly string[] } | { refused: string } {
  const [name = "", ...rest] = args;
  if (name === "sql") {
    const [text = "", ...options] = rest;
    const prompted = promptedQueryOf(text);
    if (prompted.kind === "refused") return { refused: prompted.reason };
    return { plan: { sections: [prompted.section], defaultDays: 1 }, rest: options };
  }
  const plan = PROD_REPORTS[name];
  return plan === undefined ? { refused: `No report "${name}".` } : { plan, rest };
}

/** Resolves with the process's exit code. */
export async function runProdRead(command: ProdReadCommand): Promise<number> {
  const asked = planOf(command.args);
  if ("refused" in asked) {
    command.err(asked.refused);
    command.err(USAGE);
    return 1;
  }
  const connectionString = await command.readConnectionString();
  if (connectionString === undefined || connectionString === "") {
    command.err(
      `No Keychain item "${KEYCHAIN_ITEM.service}". docs/ops.md says how the owner adds it.`,
    );
    return 1;
  }
  if (!logsInAsReader(connectionString)) {
    command.err(
      `The Keychain item "${KEYCHAIN_ITEM.service}" does not log in as ${READER_ROLE}, so it is not used.`,
    );
    return 1;
  }
  if (!namesADatabase(connectionString)) {
    command.err(
      `The Keychain item "${KEYCHAIN_ITEM.service}" names no database after its host, as a string cut at 128 characters does. docs/ops.md says how to add it again.`,
    );
    return 1;
  }
  return runReport(
    {
      env: { DATABASE_URL_UNPOOLED: connectionString },
      args: asked.rest,
      connect: command.connect,
      now: command.now,
      out: command.out,
      err: command.err,
      source: `the Keychain, as ${READER_ROLE}`,
    },
    asked.plan,
  );
}
