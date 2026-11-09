import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations, readMigrations, type MigrationSession } from "@/lib/db/migrate";
import type { Sql } from "@/lib/db/sql";

/**
 * Postgres in the test's own process: PGlite is Postgres compiled to WebAssembly, so the
 * stores' SQL runs as written, with no network and no server. It serves one connection and
 * runs its queries one at a time, so a test of calls at once checks that each check and
 * change is one step, not how Postgres's row locks order real connections; the opt-in
 * `postgres-concurrency.test.ts` does that against a real server.
 */

export const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL("../../../../db/migrations/", import.meta.url),
);

/** Every table the migrations make, emptied between tests. */
const TABLES = [
  "visitor_counters",
  "app_spend",
  "spend_holds",
  "generation_log",
  "event_days",
  "event_visitors",
  "product_events",
] as const;

/** What the stores and the migrations ask of a database, both. */
export type TestSession = Sql & MigrationSession;

export interface TestDatabase {
  session: TestSession;
  /** Empties every table, so each test starts from a fresh store. */
  empty(): Promise<void>;
  close(): Promise<void>;
}

function sessionOf(db: PGlite): TestSession {
  return {
    async query<Row extends object>(text: string, params: readonly unknown[] = []) {
      return (await db.query<Row>(text, [...params])).rows;
    },
    async exec(text) {
      await db.exec(text);
    },
    transaction(statements) {
      return db.transaction(async (tx) => {
        const results: object[][] = [];
        for (const { text, params = [] } of statements) {
          results.push((await tx.query<object>(text, [...params])).rows);
        }
        return results;
      });
    },
  };
}

/** A database with no tables at all, as one never migrated. */
export async function emptyDatabase(): Promise<TestDatabase> {
  const db = await PGlite.create();
  return {
    session: sessionOf(db),
    empty: async () => {
      await db.exec(`TRUNCATE ${TABLES.join(", ")}`);
    },
    close: () => db.close(),
  };
}

/** A database with every migration applied. */
export async function migratedDatabase(): Promise<TestDatabase> {
  const database = await emptyDatabase();
  await applyMigrations(database.session, await readMigrations(MIGRATIONS_DIRECTORY));
  return database;
}
