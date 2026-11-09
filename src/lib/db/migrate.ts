import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
// With its extension, since `scripts/db-migrate.mts` runs this file through Node directly.
import { redacted, secretsOf } from "./redact.ts";

/**
 * Applies the schema's migrations: plain SQL files in `db/migrations/`, numbered, applied in
 * order, each once, and never edited after (forward only: a change is a new file). Run by
 * `pnpm db:migrate` (`scripts/db-migrate.mts`, through Node's own type stripping, so this
 * file imports at run time only Node's modules and `redact.ts`) and by the tests on PGlite.
 */

/** Four digits, then lower-case words: `0001_cost_protection.sql`. */
const MIGRATION_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

/**
 * The advisory lock a run holds while it reads and applies, so a second run at once waits
 * for the first and then finds nothing to do, rather than fail on a table that exists.
 */
const MIGRATION_LOCK = 742_617_001;

export interface Migration {
  name: string;
  sql: string;
  /** SHA-256 of the file, so a file edited after it was applied is caught. */
  checksum: string;
}

/** A connection that holds one session, so a migration and its record are one transaction. */
export interface MigrationSession {
  /** Runs a file's statements as they are written, with no parameters. */
  exec(text: string): Promise<void>;
  query<Row extends object>(text: string, params?: readonly unknown[]): Promise<Row[]>;
}

/** Every migration in the directory, in the order they apply. */
export async function readMigrations(directory: string): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const misnamed = names.filter((name) => !MIGRATION_NAME.test(name));
  if (misnamed.length > 0) {
    throw new Error(`Migrations are named like 0001_words.sql; rename ${misnamed.join(", ")}`);
  }
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(join(directory, name), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }),
  );
}

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

interface AppliedRow {
  name: string;
  checksum: string;
}

/** What the database has applied, by name; nothing if it has never been migrated. */
async function appliedIn(session: MigrationSession): Promise<Map<string, string>> {
  const [table] = await session.query<{ present: boolean }>(
    "SELECT to_regclass('schema_migrations') IS NOT NULL AS present",
  );
  if (table?.present !== true) return new Map();
  const rows = await session.query<AppliedRow>("SELECT name, checksum FROM schema_migrations");
  return new Map(rows.map(({ name, checksum }) => [name, checksum]));
}

/** The migrations still to apply; refuses if one already applied has been edited since. */
function pendingOf(applied: Map<string, string>, migrations: readonly Migration[]): Migration[] {
  const edited = migrations.filter(
    ({ name, checksum }) => applied.has(name) && applied.get(name) !== checksum,
  );
  if (edited.length > 0) {
    const names = edited.map(({ name }) => name).join(", ");
    throw new Error(`${names} changed after being applied; write a new migration instead`);
  }
  return migrations.filter(({ name }) => !applied.has(name));
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** The names of the migrations a run would apply, changing nothing. */
export async function pendingMigrations(
  session: MigrationSession,
  migrations: readonly Migration[],
): Promise<string[]> {
  return pendingOf(await appliedIn(session), migrations).map(({ name }) => name);
}

/**
 * Applies the migrations the database has not had yet, each in its own transaction with
 * the row that records it, and resolves with their names. One that fails rolls back whole
 * and stops the run; one already applied whose file has changed stops it before anything.
 * The run holds an advisory lock throughout, so runs at once take turns.
 */
export async function applyMigrations(
  session: MigrationSession,
  migrations: readonly Migration[],
): Promise<string[]> {
  await session.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK]);
  try {
    await session.exec(CREATE_MIGRATIONS_TABLE);
    const pending = pendingOf(await appliedIn(session), migrations);
    for (const { name, sql, checksum } of pending) {
      await session.exec("BEGIN");
      try {
        await session.exec(sql);
        await session.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          name,
          checksum,
        ]);
        await session.exec("COMMIT");
      } catch (cause) {
        // A rollback that fails too must not hide why the migration failed.
        await session.exec("ROLLBACK").catch(() => undefined);
        throw new Error(`${name} failed and was rolled back: ${messageOf(cause)}`);
      }
    }
    return pending.map(({ name }) => name);
  } finally {
    // A session that cannot unlock has died, and its lock went with it.
    await session.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK]).catch(() => undefined);
  }
}

/** A connection a run migrates over, and how to let it go. */
export interface MigrationConnection {
  session: MigrationSession;
  close(): Promise<void>;
}

export interface MigrateCommand {
  env: Readonly<Record<string, string | undefined>>;
  args: readonly string[];
  directory: string;
  connect(connectionString: string): Promise<MigrationConnection>;
  out(line: string): void;
  err(line: string): void;
}

/** The flag that lets a run change the database; without it, a run only says what it would do. */
const APPLY_FLAG = "--yes";

/** The database a command reaches, and where it is, by host and name and never its password. */
export type DatabaseTarget =
  | { kind: "found"; connectionString: string; source: string; target: string }
  | { kind: "missing" }
  | { kind: "invalid"; source: string };

/** `DATABASE_URL_UNPOOLED`, or else `DATABASE_URL`, as the database commands read them. */
export function databaseTargetOf(
  env: Readonly<Record<string, string | undefined>>,
): DatabaseTarget {
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim() ?? "";
  const source = unpooled === "" ? "DATABASE_URL" : "DATABASE_URL_UNPOOLED";
  const connectionString = unpooled === "" ? (env.DATABASE_URL?.trim() ?? "") : unpooled;
  if (connectionString === "") return { kind: "missing" };
  try {
    const { hostname, pathname } = new URL(connectionString);
    return { kind: "found", connectionString, source, target: `${hostname}${pathname}` };
  } catch {
    return { kind: "invalid", source };
  }
}

/**
 * `pnpm db:migrate`: names the database it would change, by host and name and never with its
 * password, and the migrations it would apply; applies them only with `--yes`. Resolves with
 * the process's exit code.
 */
export async function runMigrateCommand({
  env,
  args,
  directory,
  connect,
  out,
  err,
}: MigrateCommand): Promise<number> {
  const found = databaseTargetOf(env);
  if (found.kind === "missing") {
    err("Set DATABASE_URL_UNPOOLED, or DATABASE_URL, to the database to migrate.");
    return 1;
  }
  if (found.kind === "invalid") {
    err(`${found.source} is not a valid URL.`);
    return 1;
  }
  const { connectionString, source, target } = found;
  out(`Target: ${target} (${source})`);

  const secrets = secretsOf(connectionString);
  let connection: MigrationConnection | undefined;
  try {
    const migrations = await readMigrations(directory);
    connection = await connect(connectionString);
    if (!args.includes(APPLY_FLAG)) {
      const pending = await pendingMigrations(connection.session, migrations);
      out(pending.length === 0 ? "Up to date." : `Would apply: ${pending.join(", ")}`);
      out(`Nothing changed. Run again with ${APPLY_FLAG} to apply.`);
      return 0;
    }
    const applied = await applyMigrations(connection.session, migrations);
    out(applied.length === 0 ? "Up to date: nothing applied." : `Applied: ${applied.join(", ")}`);
    return 0;
  } catch (cause) {
    err(`Not migrated: ${redacted(describeFailure(cause), secrets)}`);
    return 1;
  } finally {
    await connection?.close();
  }
}

/**
 * What went wrong: an error's message, or the one inside the `ErrorEvent` a WebSocket that
 * cannot connect fires, which often has none.
 */
export function describeFailure(cause: unknown): string {
  const { message, error } = (typeof cause === "object" && cause !== null ? cause : {}) as {
    message?: unknown;
    error?: unknown;
  };
  for (const candidate of [message, error instanceof Error ? error.message : undefined]) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }
  return "the database could not be reached";
}
