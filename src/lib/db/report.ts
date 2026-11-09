// With their extensions, since the report scripts run this file through Node directly.
import { databaseTargetOf, describeFailure } from "./migrate.ts";
import type { MigrationConnection } from "./migrate.ts";
import { redacted, secretsOf } from "./redact.ts";

/**
 * A read-only report over one environment's last days, printed as aligned tables: what
 * `pnpm events:report` and `pnpm log:report` share. It reads the database as
 * `pnpm db:migrate` does, and reads only, inside a read-only transaction. Run by scripts
 * through Node's own type stripping, so this file imports at run time only `src/lib/db`'s
 * two Node-only modules.
 */

export interface ReportCommand {
  env: Readonly<Record<string, string | undefined>>;
  args: readonly string[];
  connect(connectionString: string): Promise<MigrationConnection>;
  now: Date;
  out(line: string): void;
  err(line: string): void;
  /**
   * Where the connection string came from, printed beside the target, when it was not read
   * from `env` (the Keychain, for `pnpm prod:read`).
   */
  source?: string;
}

/** One table of a report: a title, its columns, and the query that fills them. */
export interface ReportSection {
  title: string;
  /** Left out for a query typed at the prompt, which prints the columns it returns. */
  columns?: readonly string[];
  /**
   * May read `$1`, the environment, and `$2`, the first UTC day counted; it is sent only the
   * parameters up to the highest it names, since Postgres refuses one it was not asked for.
   */
  text: string;
}

export interface ReportPlan {
  sections: readonly ReportSection[];
  /** The span read without `--days`. */
  defaultDays: number;
}

const DEFAULT_ENVIRONMENT = "production";
const MAX_DAYS = 3_650;
const DAY_MS = 24 * 60 * 60 * 1000;
/** What `VERCEL_ENV` can say, and `development` on a laptop. */
const ENVIRONMENT_NAME = /^[a-z]+$/;

function optionOf(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : (args[index + 1] ?? "");
}

const LAST_C0_CONTROL = 0x1f;
const FIRST_DEL_OR_C1_CONTROL = 0x7f;
const LAST_C1_CONTROL = 0x9f;

/**
 * The text with every control character (C0, DEL and C1) written as `\uXXXX`. A cell can hold
 * words a stranger wrote (a re-plan's context, `docs/security.md`, S1), and an escape sequence
 * printed as it is can retitle the terminal or write to the clipboard (OSC 52).
 */
function printable(text: string): string {
  return [...text]
    .map((character) => {
      const code = character.charCodeAt(0);
      const isControl =
        code <= LAST_C0_CONTROL || (code >= FIRST_DEL_OR_C1_CONTROL && code <= LAST_C1_CONTROL);
      return isControl ? `\\u${code.toString(16).padStart(4, "0")}` : character;
    })
    .join("");
}

/** A cell as one printable line: nothing for null, JSON for jsonb, ISO for a timestamp. */
function cellOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return printable(JSON.stringify(value));
  return printable(String(value));
}

/** The section as lines: its title, then its columns and rows, aligned; "none" when empty. */
function linesOf(section: ReportSection, rows: readonly Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [section.title, "  none"];
  const columns = section.columns ?? Object.keys(rows[0] ?? {});
  const cells = [
    columns.map(printable),
    ...rows.map((row) => columns.map((column) => cellOf(row[column]))),
  ];
  const widths = columns.map((_, index) =>
    Math.max(...cells.map((line) => line[index]?.length ?? 0)),
  );
  return [
    section.title,
    ...cells.map((line) =>
      `  ${line.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ")}`.trimEnd(),
    ),
  ];
}

/** The parameters a query names: `$1` alone is sent the environment, `$2` the first day too. */
function parametersOf(text: string, values: readonly unknown[]): unknown[] {
  const named = [...text.matchAll(/\$(\d+)/g)].map(([, index]) => Number(index));
  return values.slice(0, Math.max(0, ...named));
}

/**
 * `[--environment production] [--days N]`: prints the plan's sections for one environment
 * over its last days, in UTC. Resolves with the process's exit code.
 */
export async function runReport(
  { env, args, connect, now, out, err, source }: ReportCommand,
  { sections, defaultDays }: ReportPlan,
): Promise<number> {
  const environment = optionOf(args, "--environment") ?? DEFAULT_ENVIRONMENT;
  const days = Number(optionOf(args, "--days") ?? defaultDays);
  if (!ENVIRONMENT_NAME.test(environment)) {
    err("--environment names one, such as production, preview or development.");
    return 1;
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    err(`--days is a whole number from 1 to ${MAX_DAYS}.`);
    return 1;
  }
  const found = databaseTargetOf(env);
  if (found.kind === "missing") {
    err("Set DATABASE_URL_UNPOOLED, or DATABASE_URL, to the database to read.");
    return 1;
  }
  if (found.kind === "invalid") {
    err(`${found.source} is not a valid URL.`);
    return 1;
  }
  const since = new Date(now.getTime() - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  out(`Target: ${found.target} (${source ?? found.source})`);
  out(`${environment}, ${since} to ${now.toISOString().slice(0, 10)}, in UTC`);

  let connection: MigrationConnection | undefined;
  try {
    connection = await connect(found.connectionString);
    const { session } = connection;
    await session.exec("BEGIN READ ONLY");
    try {
      for (const section of sections) {
        const rows = await session.query<Record<string, unknown>>(
          section.text,
          parametersOf(section.text, [environment, since]),
        );
        out("");
        for (const line of linesOf(section, rows)) out(line);
      }
    } finally {
      // A rollback that fails must not hide why a query failed; nothing was written either way.
      await session.exec("ROLLBACK").catch(() => undefined);
    }
    return 0;
  } catch (cause) {
    err(`Not read: ${redacted(describeFailure(cause), secretsOf(found.connectionString))}`);
    return 1;
  } finally {
    await connection?.close();
  }
}
