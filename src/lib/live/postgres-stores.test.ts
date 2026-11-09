// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  emptyDatabase,
  migratedDatabase,
  MIGRATIONS_DIRECTORY,
  type TestDatabase,
} from "@/lib/fixtures/db/pglite";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import { applyMigrations, readMigrations } from "@/lib/db/migrate";
import type { Sql } from "@/lib/db/sql";
import type { GenerationRecord, ReplanContext } from "./generation-log";
import { HOLD_TTL_MS } from "./limits";
import { appSpendContract, visitorLimitsContract } from "./limits-contract";
import {
  microUsdOf,
  PostgresAppSpend,
  PostgresGenerationLog,
  PostgresVisitorLimits,
  withoutNul,
} from "./postgres-stores";
import { hashVisitor } from "./visitor";

const NOW = new Date("2026-11-19T10:00:00Z");
const VISITOR_ADDRESS = "203.0.113.7";

let database: TestDatabase;

beforeAll(async () => {
  database = await migratedDatabase();
});

beforeEach(async () => {
  await database.empty();
});

afterAll(async () => {
  await database.close();
});

appSpendContract("PostgresAppSpend", (caps) => new PostgresAppSpend(database.session, caps));
visitorLimitsContract(
  "PostgresVisitorLimits",
  (limits) => new PostgresVisitorLimits(database.session, limits),
);

function spentRows(): Promise<object[]> {
  return database.session.query("SELECT bucket, spent_micro_usd FROM app_spend ORDER BY bucket");
}

function holdRows(): Promise<object[]> {
  return database.session.query(
    "SELECT day_bucket, month_bucket, amount_micro_usd, expires_at FROM spend_holds",
  );
}

/** Counts what each store call asks of the database. */
function counting(sql: Sql): { sql: Sql; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    sql: {
      query: (text, params) => {
        calls.push("query");
        return sql.query(text, params);
      },
      transaction: (statements) => {
        calls.push("transaction");
        return sql.transaction(statements);
      },
    },
  };
}

describe("the app's spend in Postgres", () => {
  it("holds each call as a row of its own, in whole micro-dollars, until it expires", async () => {
    const spend = new PostgresAppSpend(database.session);

    await spend.reserve(0.6, NOW);

    expect(await holdRows()).toEqual([
      {
        day_bucket: "day:2026-11-19",
        month_bucket: "month:2026-11",
        amount_micro_usd: 600_000,
        expires_at: new Date(NOW.getTime() + HOLD_TTL_MS),
      },
    ]);
    expect(await spentRows()).toEqual([
      { bucket: "day:2026-11-19", spent_micro_usd: 0 },
      { bucket: "month:2026-11", spent_micro_usd: 0 },
    ]);
  });

  it("settles with less than was held: the hold goes, what the call cost stays", async () => {
    const spend = new PostgresAppSpend(database.session);

    const held = await spend.reserve(0.113_7, NOW);
    if (held === null) throw new Error("The call should fit");
    await spend.settle(held, 0.004_25);

    expect(await holdRows()).toEqual([]);
    expect(await spentRows()).toEqual([
      { bucket: "day:2026-11-19", spent_micro_usd: 4_250 },
      { bucket: "month:2026-11", spent_micro_usd: 4_250 },
    ]);
  });

  it("clears expired holds away as the next call is held", async () => {
    const spend = new PostgresAppSpend(database.session);

    await spend.reserve(0.6, NOW);
    await spend.reserve(0.1, new Date(NOW.getTime() + HOLD_TTL_MS));

    expect(await holdRows()).toEqual([expect.objectContaining({ amount_micro_usd: 100_000 })]);
  });

  it("asks the database once to hold a call, and once to settle it", async () => {
    const { sql, calls } = counting(database.session);
    const spend = new PostgresAppSpend(sql);

    const held = await spend.reserve(0.6, NOW);
    if (held === null) throw new Error("The call should fit");
    await spend.settle(held, 0.1);

    expect(calls).toEqual(["transaction", "transaction"]);
  });

  it("refuses to settle in buckets nothing was ever held in", async () => {
    const spend = new PostgresAppSpend(database.session);

    await expect(
      spend.settle({ id: crypto.randomUUID(), usd: 0.5, day: "2026-11-19", month: "2026-11" }, 0),
    ).rejects.toThrow("Nothing was held on 2026-11-19 and 2026-11");
  });
});

describe("microUsdOf", () => {
  it("counts dollars in whole micro-dollars", () => {
    expect(microUsdOf(0.000_255)).toBe(255);
    expect(microUsdOf(95)).toBe(95_000_000);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01])("refuses %d", (usd) => {
    expect(() => microUsdOf(usd)).toThrow("Not an amount of dollars");
  });
});

describe("the visitors' counters in Postgres", () => {
  it("keep the visitor under the salted hash, never the address", async () => {
    const limits = new PostgresVisitorLimits(database.session);
    const visitor = await hashVisitor(VISITOR_ADDRESS, "test-salt");

    await limits.take(visitor, "intake", NOW);

    const rows = await database.session.query<{ visitor_key: string; count: number }>(
      "SELECT visitor_key, utc_day::text AS utc_day, kind, count FROM visitor_counters",
    );
    expect(rows).toEqual([
      { visitor_key: visitor, utc_day: "2026-11-19", kind: "intake", count: 1 },
    ]);
    expect(rows[0]?.visitor_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(VISITOR_ADDRESS);
  });

  it("refuse to store a key that is not such a hash, an address least of all", async () => {
    const limits = new PostgresVisitorLimits(database.session);

    await expect(limits.take(VISITOR_ADDRESS, "day", NOW)).rejects.toThrow("visitor_counters");
  });
});

const RECORD: GenerationRecord = {
  id: "5b0f3c1e-7a2d-4c8e-9f10-2b3c4d5e6f70",
  pairId: "0c9d8e7f-6a5b-4c3d-8e1f-0a1b2c3d4e5f",
  role: "day",
  model: "claude-sonnet-5-5",
  promptVersion: "day-v0",
  startedAt: "2026-11-19T10:00:00.000Z",
  tokens: { input: 3_000, output: 4_300, thinking: null },
  costUsd: 0.073_5,
  msToFirstToken: 1_400,
  msToFinish: 61_000,
  finishReason: "stop",
  outcome: "complete",
  salvaged: false,
  placeChecks: null,
  repairs: 2,
  checks: [
    { id: "shape", kind: "hard", passed: true, value: null, threshold: null, findings: [] },
    {
      id: "banned-phrases",
      kind: "hard",
      passed: false,
      value: null,
      threshold: null,
      findings: ['stops[2].note: "hidden gem"'],
    },
  ],
  visitorText: "A slow Sunday in Lisbon",
  request: KYOTO_REQUEST,
  outputText: '{"title":"A day"}',
  warnings: ['{"type":"unsupported","feature":"temperature"}'],
  requestId: "req_1",
  error: null,
};

const REPLAN_CONTEXT: ReplanContext = {
  changed: "start",
  round: 1,
  windows: [{ from: 0, to: 1 }],
  itinerary: KYOTO_ITINERARY,
};

describe("the generation log in Postgres", () => {
  it("writes every field of a record, with where it ran", async () => {
    const log = new PostgresGenerationLog(database.session, "preview");

    await log.record(RECORD);

    const [row] = await database.session.query<Record<string, unknown>>(
      "SELECT * FROM generation_log",
    );
    expect(row).toMatchObject({
      id: RECORD.id,
      environment: "preview",
      pair_id: RECORD.pairId,
      role: "day",
      model: "claude-sonnet-5-5",
      prompt_version: "day-v0",
      started_at: new Date(RECORD.startedAt),
      input_tokens: 3_000,
      output_tokens: 4_300,
      thinking_tokens: null,
      cost_micro_usd: 73_500,
      ms_to_first_token: 1_400,
      ms_to_finish: 61_000,
      finish_reason: "stop",
      outcome: "complete",
      salvaged: false,
      repairs: 2,
      checks: RECORD.checks,
      visitor_text: "A slow Sunday in Lisbon",
      request: KYOTO_REQUEST,
      output_text: RECORD.outputText,
      output: { title: "A day" },
      warnings: RECORD.warnings,
      request_id: "req_1",
      error: null,
    });
    expect(row?.created_at).toBeInstanceOf(Date);
  });

  it("keeps an output the model stopped partway as text alone", async () => {
    const log = new PostgresGenerationLog(database.session, "development");

    await log.record({ ...RECORD, outputText: '{"title":"A d', costUsd: null });

    const [row] = await database.session.query<{ output: unknown; output_text: string }>(
      "SELECT output, output_text, cost_micro_usd FROM generation_log",
    );
    expect(row).toEqual({ output: null, output_text: '{"title":"A d', cost_micro_usd: null });
  });

  it.each([
    ["a cut the salvage rule kept a day of", true],
    ["an intake, which no salvage reads", null],
  ] as const)("marks %s as such", async (_name, salvaged) => {
    const log = new PostgresGenerationLog(database.session, "development");

    await log.record({ ...RECORD, outcome: "cut", salvaged });

    const [row] = await database.session.query("SELECT salvaged FROM generation_log");
    expect(row).toEqual({ salvaged });
  });

  it("reads a day back by its id: its own environment's day alone, never a shadow or an intake", async () => {
    const preview = new PostgresGenerationLog(database.session, "preview");
    const production = new PostgresGenerationLog(database.session, "production");
    const ids = {
      day: "1a2b3c4d-0000-4000-8000-000000000001",
      shadow: "1a2b3c4d-0000-4000-8000-000000000002",
      intake: "1a2b3c4d-0000-4000-8000-000000000003",
      replan: "1a2b3c4d-0000-4000-8000-000000000004",
    };
    const placeChecks = {
      "stop-0:p": { placeId: "stop-0:p", state: "unchecked" as const },
    };
    await production.record({ ...RECORD, id: ids.day, placeChecks });
    await production.record({ ...RECORD, id: ids.shadow, role: "shadow" });
    await production.record({ ...RECORD, id: ids.intake, role: "intake" });
    await production.record({ ...RECORD, id: ids.replan, context: REPLAN_CONTEXT });

    expect(await production.dayRecordOf(ids.day)).toEqual({
      id: ids.day,
      promptVersion: RECORD.promptVersion,
      startedAt: RECORD.startedAt,
      msToFinish: RECORD.msToFinish,
      outcome: RECORD.outcome,
      salvaged: RECORD.salvaged,
      request: RECORD.request,
      outputText: RECORD.outputText,
      placeChecks,
    });
    expect((await production.dayRecordOf(ids.replan))?.context).toEqual(REPLAN_CONTEXT);
    expect(await production.dayRecordOf(ids.shadow)).toBeNull();
    expect(await production.dayRecordOf(ids.intake)).toBeNull();
    expect(await preview.dayRecordOf(ids.day)).toBeNull();
  });

  it("writes a day's place checks, the provider's points with them", async () => {
    const log = new PostgresGenerationLog(database.session, "development");
    const placeChecks = {
      "stop-0:p": {
        placeId: "stop-0:p",
        state: "confirmed" as const,
        by: "name" as const,
        coordinates: { lat: 35.0268, lng: 135.7954 },
      },
      "stop-1:p": { placeId: "stop-1:p", state: "unchecked" as const },
    };

    await log.record({ ...RECORD, placeChecks });

    const [row] = await database.session.query("SELECT place_checks FROM generation_log");
    expect(row).toEqual({ place_checks: placeChecks });
  });

  it("writes a re-plan's context, and leaves the column empty for every other call", async () => {
    const log = new PostgresGenerationLog(database.session, "development");

    await log.record({ ...RECORD, promptVersion: "replan-v1", context: REPLAN_CONTEXT });
    await log.record({ ...RECORD, id: "6c1f4d2e-8b3e-4d9f-8a21-3c4d5e6f7081" });

    const rows = await database.session.query<{ prompt_version: string; context: unknown }>(
      "SELECT prompt_version, context FROM generation_log ORDER BY prompt_version",
    );
    expect(rows).toEqual([
      { prompt_version: "day-v0", context: null },
      { prompt_version: "replan-v1", context: REPLAN_CONTEXT },
    ]);
  });

  /** A database with every migration but the ones named, as production is until it takes them. */
  /**
   * The migrations but these. 0008's view reads 0006's `context`, so a database without 0006
   * is one without 0008 too.
   */
  async function migratedWithout(...left: string[]): Promise<TestDatabase> {
    const database = await emptyDatabase();
    const migrations = await readMigrations(MIGRATIONS_DIRECTORY);
    await applyMigrations(
      database.session,
      migrations.filter(({ name }) => !left.some((prefix) => name.startsWith(prefix))),
    );
    return database;
  }

  it("fails every day's record on a database without 0007, which is why production takes it before the push", async () => {
    const before = await migratedWithout("0006", "0007", "0008");
    const log = new PostgresGenerationLog(before.session, "production");

    await expect(log.record(RECORD)).rejects.toThrow("place_checks");

    expect(await before.session.query("SELECT id FROM generation_log")).toEqual([]);
    await before.close();
  });

  // Migrations apply in order, so no database has 0007 without 0006: this one is made by hand.
  it("names the context column in every record, so a database without 0006 takes none", async () => {
    const before = await migratedWithout("0006", "0008");
    const log = new PostgresGenerationLog(before.session, "production");

    await expect(log.record(RECORD)).rejects.toThrow("context");
    await expect(
      log.record({
        ...RECORD,
        id: "6c1f4d2e-8b3e-4d9f-8a21-3c4d5e6f7081",
        context: REPLAN_CONTEXT,
      }),
    ).rejects.toThrow("context");

    expect(await before.session.query("SELECT id FROM generation_log")).toEqual([]);
    await before.close();
  });

  it("writes a record whose text holds NUL characters, without them", async () => {
    const log = new PostgresGenerationLog(database.session, "development");

    await log.record({
      ...RECORD,
      visitorText: "Lisbon\u0000 on Sunday",
      // A raw NUL, and one the JSON escapes, which parses into a NUL.
      outputText: '{"title":"A\u0000 day","note":"\\u0000quiet"}',
      warnings: ["a\u0000warning"],
    });

    const [row] = await database.session.query(
      "SELECT visitor_text, output_text, output, warnings FROM generation_log",
    );
    expect(row).toEqual({
      visitor_text: "Lisbon on Sunday",
      output_text: '{"title":"A day","note":"\\u0000quiet"}',
      output: { title: "A day", note: "quiet" },
      warnings: ["awarning"],
    });
  });
});

describe("withoutNul", () => {
  it("takes NUL out of strings, keys and values at any depth, and leaves the rest", () => {
    expect(withoutNul({ "a\u0000": ["b\u0000", { c: "\u0000d" }], n: 1, x: null })).toEqual({
      a: ["b", { c: "d" }],
      n: 1,
      x: null,
    });
  });
});
