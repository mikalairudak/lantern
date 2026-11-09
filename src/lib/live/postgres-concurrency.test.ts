// @vitest-environment node
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations, readMigrations, type MigrationSession } from "@/lib/db/migrate";
import type { Sql } from "@/lib/db/sql";
import { MIGRATIONS_DIRECTORY } from "@/lib/fixtures/db/pglite";
import { PostgresAppSpend } from "./postgres-stores";

/**
 * The stores against a real Postgres, from many connections at once: what PGlite, with its
 * one connection, cannot show. Opt in with `TEST_DATABASE_URL`, a local Postgres or a
 * throwaway Neon branch (its direct string: the pooler refuses the `search_path` option).
 * Everything happens in a schema of its own, dropped afterwards. It connects over TCP with
 * `pg`, since Neon's driver reaches only Neon.
 */

const DATABASE_URL = process.env.TEST_DATABASE_URL?.trim() ?? "";
const NOW = new Date("2026-11-19T10:00:00Z");
const CALLS_AT_ONCE = 20;

function poolIn(schema: string): pg.Pool {
  return new pg.Pool({
    connectionString: DATABASE_URL,
    options: `-c search_path=${schema}`,
    max: CALLS_AT_ONCE,
  });
}

/** The stores' `Sql` over a pool: each transaction on a connection of its own. */
function sqlOver(pool: pg.Pool): Sql {
  return {
    query: async (text, params = []) => (await pool.query(text, [...params])).rows,
    async transaction(statements) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        const results: object[][] = [];
        for (const { text, params = [] } of statements) {
          results.push((await client.query(text, [...params])).rows);
        }
        await client.query("COMMIT");
        return results;
      } catch (cause) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw cause;
      } finally {
        client.release();
      }
    },
  };
}

function sessionOn(client: pg.PoolClient): MigrationSession {
  return {
    exec: async (text) => {
      await client.query(text);
    },
    query: async (text, params = []) => (await client.query(text, [...params])).rows,
  };
}

describe.skipIf(DATABASE_URL === "")(
  "the stores on a real Postgres, from many connections (set TEST_DATABASE_URL to run)",
  () => {
    const schema = `lantern_test_${randomBytes(6).toString("hex")}`;
    let admin: pg.Pool;
    let pool: pg.Pool;
    let migrationNames: string[];
    let migrationRuns: PromiseSettledResult<string[]>[];

    // The schema starts empty, and two runs migrate it at once, as two terminals might.
    beforeAll(async () => {
      admin = new pg.Pool({ connectionString: DATABASE_URL });
      await admin.query(`CREATE SCHEMA ${schema}`);
      pool = poolIn(schema);
      const migrations = await readMigrations(MIGRATIONS_DIRECTORY);
      migrationNames = migrations.map(({ name }) => name);
      const clients = await Promise.all([pool.connect(), pool.connect()]);
      migrationRuns = await Promise.allSettled(
        clients.map((client) => applyMigrations(sessionOn(client), migrations)),
      );
      for (const client of clients) client.release();
    });

    afterAll(async () => {
      await pool?.end();
      await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin?.end();
    });

    it("applies each migration once when two runs start at once", () => {
      expect(migrationRuns.map(({ status }) => status)).toEqual(["fulfilled", "fulfilled"]);
      const applied = migrationRuns.flatMap((run) => (run.status === "fulfilled" ? run.value : []));
      expect(applied.sort()).toEqual(migrationNames);
    });

    describe("the app's spend", () => {
      beforeEach(async () => {
        await pool.query("TRUNCATE app_spend, spend_holds");
      });

      async function heldMicroUsd(column: "day_bucket" | "month_bucket"): Promise<number> {
        const {
          rows: [row],
        } = await pool.query<{ held: number }>(
          `SELECT coalesce(sum(amount_micro_usd), 0)::integer AS held FROM spend_holds
           WHERE ${column} = $1`,
          [column === "day_bucket" ? "day:2026-11-19" : "month:2026-11"],
        );
        return row?.held ?? Number.NaN;
      }

      it(`admits exactly what the day has room for, from ${CALLS_AT_ONCE} connections at once`, async () => {
        const spend = new PostgresAppSpend(sqlOver(pool), { dailyUsd: 1, monthlyUsd: null });

        const holds = await Promise.all(
          Array.from({ length: CALLS_AT_ONCE }, () => spend.reserve(0.15, NOW)),
        );

        // Six of $0.15 fit under $1; a seventh would make $1.05.
        expect(holds.filter((hold) => hold !== null)).toHaveLength(6);
        expect(await heldMicroUsd("day_bucket")).toBe(900_000);
        expect(await heldMicroUsd("month_bucket")).toBe(900_000);
        expect(pool.totalCount).toBe(CALLS_AT_ONCE);
      });

      it("admits exactly what the month has room for, when the day has plenty", async () => {
        const spend = new PostgresAppSpend(sqlOver(pool), { dailyUsd: 10, monthlyUsd: 0.5 });

        const holds = await Promise.all(
          Array.from({ length: CALLS_AT_ONCE }, () => spend.reserve(0.15, NOW)),
        );

        expect(holds.filter((hold) => hold !== null)).toHaveLength(3);
        expect(await heldMicroUsd("month_bucket")).toBe(450_000);
      });

      it("holds and settles at once without a deadlock, and counts every cost", async () => {
        const spend = new PostgresAppSpend(sqlOver(pool), { dailyUsd: 10, monthlyUsd: 95 });

        await Promise.all(
          Array.from({ length: CALLS_AT_ONCE }, async () => {
            const held = await spend.reserve(0.01, NOW);
            if (held === null) throw new Error("Every call should fit");
            await spend.settle(held, 0.005);
          }),
        );

        const spent = await pool.query("SELECT bucket, spent_micro_usd FROM app_spend ORDER BY 1");
        expect(spent.rows).toEqual([
          { bucket: "day:2026-11-19", spent_micro_usd: CALLS_AT_ONCE * 5_000 },
          { bucket: "month:2026-11", spent_micro_usd: CALLS_AT_ONCE * 5_000 },
        ]);
        expect(await heldMicroUsd("day_bucket")).toBe(0);
      });
    });
  },
);
