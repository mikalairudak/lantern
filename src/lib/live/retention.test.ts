// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "@/lib/db/sql";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { migratedDatabase, type TestDatabase } from "@/lib/fixtures/db/pglite";
import { DayRequestSchema, type DayRequest } from "@/lib/schema/itinerary.schema";
import type { GenerationRecord } from "./generation-log";
import { PostgresGenerationLog } from "./postgres-stores";
import {
  clearExpiredVisitorText,
  clearPastCounters,
  countersCutoffOf,
  retentionCutoffOf,
  VISITOR_TEXT_RETENTION_DAYS,
} from "./retention";

const NOW = new Date("2026-11-19T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/** Just past the retention, and a day short of it. */
const EXPIRED = new Date(NOW.getTime() - VISITOR_TEXT_RETENTION_DAYS * DAY_MS - MINUTE_MS);
const TWENTY_NINE_DAYS_OLD = new Date(NOW.getTime() - 29 * DAY_MS);

const VISITOR_TEXT = "Lisbon with my dog, vegetarian";
/** Phrases only the visitor wrote, which the model quoted back. */
const VISITOR_PHRASES = ["with my dog", "vegetarian"];
const LISBON_REQUEST: DayRequest = { ...KYOTO_REQUEST, city: "Lisbon", timezone: "Europe/Lisbon" };

/** An intake read into a request, its whole output quoting the visitor in `unplaced`. */
const READ_INTAKE: GenerationRecord = {
  id: "7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  pairId: null,
  role: "intake",
  model: "claude-haiku-5-5",
  promptVersion: "intake-v2",
  startedAt: "2026-10-20T10:00:00.000Z",
  tokens: { input: 1_800, output: 150, thinking: null },
  costUsd: 0.002_55,
  msToFirstToken: null,
  msToFinish: 1_900,
  finishReason: "stop",
  outcome: "request",
  salvaged: null,
  placeChecks: null,
  repairs: null,
  checks: null,
  visitorText: VISITOR_TEXT,
  request: LISBON_REQUEST,
  outputText: JSON.stringify({ city: "Lisbon", unplaced: VISITOR_PHRASES }),
  warnings: [],
  requestId: "req_intake",
  error: null,
};

/** An intake whose output stopped partway, and whose parse error quotes it. */
const UNPARSABLE_INTAKE: GenerationRecord = {
  ...READ_INTAKE,
  id: "8e2f3a41-5b6c-4d7e-9f00-1a2b3c4d5e6f",
  outcome: "unavailable",
  request: null,
  outputText: '{"city":"Lisbon","unplaced":["with my dog","vegetar',
  error: {
    status: null,
    type: "intake-output-unparsable",
    errorCode: null,
    requestId: "req_intake",
    message: `Unterminated string in JSON: "vegetar"`,
  },
};

/** A day and its shadow: written from the request's words alone. */
const DAY: GenerationRecord = {
  ...READ_INTAKE,
  id: "9f3a4b52-6c7d-4e8f-a011-2b3c4d5e6f70",
  pairId: "0c9d8e7f-6a5b-4c3d-8e1f-0a1b2c3d4e5f",
  role: "day",
  model: "claude-sonnet-5-5",
  promptVersion: "day-v2",
  visitorText: null,
  outcome: "complete",
  outputText: '{"title":"A slow Lisbon day"}',
};
const SHADOW: GenerationRecord = {
  ...DAY,
  id: "a04b5c63-7d8e-4f90-b122-3c4d5e6f7081",
  role: "shadow",
  model: "claude-haiku-5-5",
};

let database: TestDatabase;
/**
 * The log a test's rows are written with. Its one clearing of the day runs on the first row,
 * before any row is made old, so setting a test up never clears what it set up.
 */
let writer: PostgresGenerationLog;

beforeAll(async () => {
  database = await migratedDatabase();
});

beforeEach(async () => {
  await database.empty();
  writer = logAt();
});

afterAll(async () => {
  await database.close();
});

function logAt(now: () => Date = () => NOW, sql: Sql = database.session): PostgresGenerationLog {
  return new PostgresGenerationLog(sql, "production", { now, log: () => undefined });
}

/** Writes the record as if it had been written at `createdAt`. */
async function writtenAt(record: GenerationRecord, createdAt: Date): Promise<void> {
  await writer.record(record);
  await database.session.query(
    "UPDATE generation_log SET created_at = $1::timestamptz WHERE id = $2::uuid",
    [createdAt.toISOString(), record.id],
  );
}

function rowOf(id: string): Promise<Record<string, unknown> | undefined> {
  return database.session
    .query<Record<string, unknown>>("SELECT * FROM generation_log WHERE id = $1::uuid", [id])
    .then((rows) => rows[0]);
}

/** Every column a clearing must leave as it was. */
const KEPT_COLUMNS = [
  "environment",
  "role",
  "model",
  "prompt_version",
  "started_at",
  "input_tokens",
  "output_tokens",
  "thinking_tokens",
  "cost_micro_usd",
  "ms_to_first_token",
  "ms_to_finish",
  "finish_reason",
  "outcome",
  "repairs",
  "checks",
  "request",
  "warnings",
  "request_id",
  "salvaged",
  "created_at",
] as const;

function keptOf(row: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(KEPT_COLUMNS.map((column) => [column, row?.[column]]));
}

describe("clearing what visitors typed", () => {
  it.each([
    ["read into a request", READ_INTAKE],
    ["whose output stopped partway", UNPARSABLE_INTAKE],
  ])(
    "clears an intake %s once it is past the retention, and keeps its numbers",
    async (_name, record) => {
      await writtenAt(record, EXPIRED);
      const before = await rowOf(record.id);

      expect(await clearExpiredVisitorText(database.session, NOW)).toBe(1);

      const after = await rowOf(record.id);
      expect(after).toMatchObject({ visitor_text: null, output_text: "", output: null });
      expect(keptOf(after)).toEqual(keptOf(before));
      expect(after?.error).toEqual(
        record.error === null
          ? null
          : { status: null, type: record.error.type, errorCode: null, requestId: "req_intake" },
      );
      for (const phrase of [VISITOR_TEXT, ...VISITOR_PHRASES]) {
        expect(JSON.stringify(after)).not.toContain(phrase);
      }
    },
  );

  it("keeps an intake 29 days old whole", async () => {
    await writtenAt(UNPARSABLE_INTAKE, TWENTY_NINE_DAYS_OLD);
    const before = await rowOf(UNPARSABLE_INTAKE.id);

    expect(await clearExpiredVisitorText(database.session, NOW)).toBe(0);

    expect(await rowOf(UNPARSABLE_INTAKE.id)).toEqual(before);
    expect(before).toMatchObject({ visitor_text: VISITOR_TEXT });
  });

  it("keeps a day and its shadow whole, however old: nothing in them is the visitor's", async () => {
    await writtenAt(DAY, EXPIRED);
    await writtenAt(SHADOW, EXPIRED);
    const before = await database.session.query("SELECT * FROM generation_log ORDER BY role");

    expect(await clearExpiredVisitorText(database.session, NOW)).toBe(0);

    expect(await database.session.query("SELECT * FROM generation_log ORDER BY role")).toEqual(
      before,
    );
  });

  it("clears a bounded batch at a time, the oldest first, and never a row twice", async () => {
    await writtenAt(READ_INTAKE, new Date(EXPIRED.getTime() - DAY_MS));
    await writtenAt(UNPARSABLE_INTAKE, EXPIRED);

    expect(await clearExpiredVisitorText(database.session, NOW, 1)).toBe(1);
    expect(await rowOf(READ_INTAKE.id)).toMatchObject({ visitor_text: null });
    expect(await rowOf(UNPARSABLE_INTAKE.id)).toMatchObject({ visitor_text: VISITOR_TEXT });

    expect(await clearExpiredVisitorText(database.session, NOW, 1)).toBe(1);
    expect(await clearExpiredVisitorText(database.session, NOW, 1)).toBe(0);
  });

  it("counts the retention back from now", () => {
    expect(retentionCutoffOf(NOW)).toEqual(new Date("2026-10-20T10:00:00Z"));
  });

  // The day's row is kept whole because its request holds no free text of the visitor's: the
  // city is Geoapify's name for it, signed by the intake, and the rest are closed words. A
  // field added here that could carry the visitor's words must be cleared with the intake's.
  it("relies on a day's request holding nothing the visitor typed", () => {
    expect(Object.keys(DayRequestSchema.shape).sort()).toEqual([
      "city",
      "citySource",
      "company",
      "date",
      "dinner",
      "end",
      "energy",
      "energySource",
      "start",
      "timezone",
      "travel",
    ]);
  });
});

/** Says which statements a log sends, and fails the clearing when asked to. */
function watching(
  sql: Sql,
  { isClearingFailing = false } = {},
): { sql: Sql; clearings: () => number } {
  let clearings = 0;
  return {
    clearings: () => clearings,
    sql: {
      query: (text, params) => {
        if (!text.trimStart().startsWith("UPDATE generation_log")) return sql.query(text, params);
        clearings += 1;
        return isClearingFailing
          ? Promise.reject(new Error("canceling statement due to statement timeout"))
          : sql.query(text, params);
      },
      transaction: (statements) => sql.transaction(statements),
    },
  };
}

describe("the generation log's clearing", () => {
  it("clears on the first record of each UTC day in a process, and no other", async () => {
    let now = NOW;
    const { sql, clearings } = watching(database.session);
    const log = logAt(() => now, sql);

    await log.record(DAY);
    await log.record(SHADOW);
    expect(clearings()).toBe(1);

    now = new Date(NOW.getTime() + DAY_MS);
    await log.record(READ_INTAKE);
    await log.record(UNPARSABLE_INTAKE);
    expect(clearings()).toBe(2);
  });

  it("clears an expired text as the day's first record goes in", async () => {
    await writtenAt(READ_INTAKE, TWENTY_NINE_DAYS_OLD);
    const twoDaysLater = new Date(NOW.getTime() + 2 * DAY_MS);

    await logAt(() => twoDaysLater).record(DAY);

    expect(await rowOf(READ_INTAKE.id)).toMatchObject({ visitor_text: null, output: null });
    expect(await rowOf(DAY.id)).toMatchObject({ output: { title: "A slow Lisbon day" } });
  });

  it("keeps the record and says why when the clearing fails, and waits for the next day", async () => {
    const lines: string[] = [];
    const { sql, clearings } = watching(database.session, { isClearingFailing: true });
    const log = new PostgresGenerationLog(sql, "production", {
      now: () => NOW,
      log: (event, fields) => lines.push(`${event}: ${String(fields.message)}`),
    });

    await expect(log.record(READ_INTAKE)).resolves.toBeUndefined();
    await expect(log.record(UNPARSABLE_INTAKE)).resolves.toBeUndefined();

    expect(await database.session.query("SELECT id FROM generation_log ORDER BY id")).toEqual([
      { id: READ_INTAKE.id },
      { id: UNPARSABLE_INTAKE.id },
    ]);
    expect(lines).toEqual([
      "visitor-text-not-cleared: canceling statement due to statement timeout",
    ]);
    expect(clearings()).toBe(1);
  });

  it("clears only after a record went in, so a record that fails leaves the day's clearing", async () => {
    await logAt().record(DAY);
    const { sql, clearings } = watching(database.session);
    const log = logAt(() => NOW, sql);

    await expect(log.record(DAY)).rejects.toThrow("generation_log");
    expect(clearings()).toBe(0);

    await log.record(SHADOW);
    expect(clearings()).toBe(1);
  });
});

describe("clearing visitors' counts", () => {
  const VISITOR = "a".repeat(64);

  async function countOn(day: string): Promise<void> {
    await database.session.query(
      "INSERT INTO visitor_counters (visitor_key, utc_day, kind, count) VALUES ($1, $2::date, 'day', 3)",
      [VISITOR, day],
    );
  }

  async function daysKept(): Promise<string[]> {
    const rows = await database.session.query<{ day: string }>(
      "SELECT to_char(utc_day, 'YYYY-MM-DD') AS day FROM visitor_counters ORDER BY utc_day",
    );
    return rows.map(({ day }) => day);
  }

  it("keeps today's and yesterday's counts, and deletes every day before", async () => {
    for (const day of ["2026-10-01", "2026-11-17", "2026-11-18", "2026-11-19"]) await countOn(day);

    expect(await clearPastCounters(database.session, NOW)).toBe(2);
    expect(await daysKept()).toEqual(["2026-11-18", "2026-11-19"]);
  });

  it("counts yesterday back from now, in UTC", () => {
    expect(countersCutoffOf(NOW)).toBe("2026-11-18");
    expect(countersCutoffOf(new Date("2026-12-01T00:30:00Z"))).toBe("2026-11-30");
  });

  it("clears them with the day's first record, beside the visitors' texts", async () => {
    await countOn("2026-11-01");
    await countOn("2026-11-19");

    await logAt().record(DAY);

    expect(await daysKept()).toEqual(["2026-11-19"]);
  });
});
