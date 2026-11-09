// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyDatabase, MIGRATIONS_DIRECTORY, type TestDatabase } from "@/lib/fixtures/db/pglite";
import {
  applyMigrations,
  pendingMigrations,
  readMigrations,
  runMigrateCommand,
  type MigrateCommand,
  type Migration,
  type MigrationSession,
} from "./migrate";

let database: TestDatabase;

beforeEach(async () => {
  database = await emptyDatabase();
});

afterEach(async () => {
  await database.close();
});

async function tablesOf(db: TestDatabase): Promise<string[]> {
  const rows = await db.session.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
  );
  return rows.map(({ table_name }) => table_name);
}

/** The schema's migrations by name, in the order they apply. */
async function migrationNames(): Promise<string[]> {
  return (await readMigrations(MIGRATIONS_DIRECTORY)).map(({ name }) => name);
}

function migration(name: string, sql: string): Migration {
  return { name, sql, checksum: `checksum of ${sql}` };
}

describe("the schema's migrations", () => {
  it("apply in order on an empty database", async () => {
    const names = await migrationNames();

    const applied = await applyMigrations(
      database.session,
      await readMigrations(MIGRATIONS_DIRECTORY),
    );

    // Every file, in the order of its number, whichever branch added it.
    expect(applied).toEqual(names);
    expect(names.slice(0, 4)).toEqual([
      "0001_cost_protection.sql",
      "0002_generation_log.sql",
      "0003_expiring_holds.sql",
      "0004_salvaged_cut.sql",
    ]);
    expect(names).toContain("0005_product_events.sql");
    // Its tables, and the one view, which lantern_reader reads in place of a day's output.
    expect(await tablesOf(database)).toEqual([
      "app_spend",
      "day_place_enums",
      "event_days",
      "event_visitors",
      "generation_log",
      "product_events",
      "schema_migrations",
      "spend_holds",
      "visitor_counters",
    ]);
  });

  it("take turns: a run holds the migration lock from before it reads until it is done", async () => {
    const statements: string[] = [];
    const recording: MigrationSession = {
      exec: (text) => {
        statements.push(text.trim().split(/\s+/).slice(0, 3).join(" "));
        return database.session.exec(text);
      },
      query: (text, params) => {
        statements.push(text.trim().split(/\s+/).slice(0, 2).join(" "));
        return database.session.query(text, params);
      },
    };

    await applyMigrations(recording, [
      migration("0001_first.sql", "CREATE TABLE first (id integer)"),
    ]);

    expect(statements[0]).toBe("SELECT pg_advisory_lock($1)");
    expect(statements.at(-1)).toBe("SELECT pg_advisory_unlock($1)");
    expect(statements.indexOf("CREATE TABLE IF")).toBeGreaterThan(0);
  });

  it("report why a migration failed even when its rollback fails too", async () => {
    const brokenRollback: MigrationSession = {
      exec: (text) =>
        text === "ROLLBACK"
          ? Promise.reject(new Error("the connection was lost"))
          : database.session.exec(text),
      query: (text, params) => database.session.query(text, params),
    };

    await expect(
      applyMigrations(brokenRollback, [
        migration("0001_typo.sql", "CREATE TABEL typo (id integer)"),
      ]),
    ).rejects.toThrow(/0001_typo.sql failed and was rolled back: syntax error/);
    await database.session.exec("ROLLBACK");
  });

  it("say what a run would apply, changing nothing", async () => {
    const migrations = await readMigrations(MIGRATIONS_DIRECTORY);

    expect(await pendingMigrations(database.session, migrations)).toHaveLength(migrations.length);
    expect(await tablesOf(database)).toEqual([]);

    await applyMigrations(database.session, migrations.slice(0, 1));
    expect(await pendingMigrations(database.session, migrations)).toEqual(
      (await migrationNames()).slice(1),
    );
  });

  it("apply nothing the second time", async () => {
    const migrations = await readMigrations(MIGRATIONS_DIRECTORY);
    await applyMigrations(database.session, migrations);

    expect(await applyMigrations(database.session, migrations)).toEqual([]);
  });

  it("apply only the ones a database has not had", async () => {
    const first = migration("0001_first.sql", "CREATE TABLE first (id integer)");
    const second = migration("0002_second.sql", "CREATE TABLE second (id integer)");
    await applyMigrations(database.session, [first]);

    expect(await applyMigrations(database.session, [first, second])).toEqual(["0002_second.sql"]);
  });

  it("roll back a migration that fails partway, its record with it", async () => {
    const broken = migration(
      "0001_broken.sql",
      "CREATE TABLE half (id integer); CREATE TABLE half (id integer);",
    );

    await expect(applyMigrations(database.session, [broken])).rejects.toThrow(
      "0001_broken.sql failed and was rolled back",
    );
    expect(await tablesOf(database)).toEqual(["schema_migrations"]);
    expect(await database.session.query("SELECT name FROM schema_migrations")).toEqual([]);
  });

  it("refuse to run when an applied migration has been edited since", async () => {
    await applyMigrations(database.session, [migration("0001_first.sql", "SELECT 1")]);

    await expect(
      applyMigrations(database.session, [migration("0001_first.sql", "SELECT 2")]),
    ).rejects.toThrow("0001_first.sql changed after being applied");
  });
});

describe("readMigrations", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "lantern-migrations-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true });
  });

  it("reads the SQL files in the order of their numbers, with each one's checksum", async () => {
    await writeFile(join(directory, "0002_later.sql"), "SELECT 2");
    await writeFile(join(directory, "0001_first.sql"), "SELECT 1");
    await writeFile(join(directory, "notes.txt"), "not a migration");

    const migrations = await readMigrations(directory);

    expect(migrations.map(({ name }) => name)).toEqual(["0001_first.sql", "0002_later.sql"]);
    expect(migrations[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a file not named like the others", async () => {
    await writeFile(join(directory, "add-table.sql"), "SELECT 1");

    await expect(readMigrations(directory)).rejects.toThrow("rename add-table.sql");
  });
});

describe("pnpm db:migrate", () => {
  const DEV = "postgresql://lantern:p%40ss%20word@ep-dev-1234.us-east-1.aws.neon.tech/neondb";

  interface Run {
    code: number;
    out: string[];
    err: string[];
  }

  async function run(
    env: Record<string, string>,
    args: string[] = [],
    connect: MigrateCommand["connect"] = () =>
      Promise.resolve({ session: database.session, close: () => Promise.resolve() }),
  ): Promise<Run> {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runMigrateCommand({
      env,
      args,
      directory: MIGRATIONS_DIRECTORY,
      connect,
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    });
    return { code, out, err };
  }

  it("names the target and what it would apply, and changes nothing without --yes", async () => {
    const { code, out } = await run({ DATABASE_URL: DEV });

    expect(code).toBe(0);
    expect(out).toEqual([
      "Target: ep-dev-1234.us-east-1.aws.neon.tech/neondb (DATABASE_URL)",
      `Would apply: ${(await migrationNames()).join(", ")}`,
      "Nothing changed. Run again with --yes to apply.",
    ]);
    expect(await tablesOf(database)).toEqual([]);
  });

  it("applies with --yes, and prefers the direct string to the pooled one", async () => {
    const pooled = "postgresql://lantern:other@ep-dev-1234-pooler.us-east-1.aws.neon.tech/neondb";

    const first = await run({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: DEV }, ["--yes"]);
    const second = await run({ DATABASE_URL: DEV }, ["--yes"]);

    expect(first.code).toBe(0);
    expect(first.out[0]).toBe(
      "Target: ep-dev-1234.us-east-1.aws.neon.tech/neondb (DATABASE_URL_UNPOOLED)",
    );
    expect(first.out[1]).toMatch(/^Applied: 0001_cost_protection.sql/);
    expect(second.out[1]).toBe("Up to date: nothing applied.");
  });

  it("says a string is not a valid URL without printing it", async () => {
    const { code, out, err } = await run({ DATABASE_URL: "p@ss word, pasted where the URL goes" });

    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual(["DATABASE_URL is not a valid URL."]);
  });

  it("asks for a connection string when there is none", async () => {
    expect((await run({})).err).toEqual([
      "Set DATABASE_URL_UNPOOLED, or DATABASE_URL, to the database to migrate.",
    ]);
  });

  it("never prints the password, raw or decoded, when the database fails", async () => {
    const refused = (): Promise<never> =>
      Promise.reject(new Error('password "p@ss word" (p%40ss%20word) was refused'));

    const { code, err } = await run({ DATABASE_URL: DEV }, [], refused);

    expect(code).toBe(1);
    expect(err).toEqual(['Not migrated: password "[DATABASE_URL]" ([DATABASE_URL]) was refused']);
  });

  it("says the database could not be reached when a socket fails without a message", async () => {
    const socketFailed = (): Promise<never> => Promise.reject({ type: "error", message: "" });

    expect((await run({ DATABASE_URL: DEV }, [], socketFailed)).err).toEqual([
      "Not migrated: the database could not be reached",
    ]);
  });
});
