// @vitest-environment node
import { neonConfig } from "@neondatabase/serverless";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { neonSql, type Sql } from "@/lib/db/sql";
import { emptyDatabase, migratedDatabase, type TestDatabase } from "@/lib/fixtures/db/pglite";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { GOLDEN_NOW } from "@/lib/fixtures/intake/golden";
import { searchWrittenPlaces } from "@/lib/fixtures/intake/places";
import { fakeClaude, type FakeClaude } from "@/lib/fixtures/live/mock-claude";
import { answerIntakeRequest, type LiveIntakeDeps } from "@/lib/intake/answer-intake-request";
import { EarlyCallGate } from "@/lib/intake/early-call";
import type { GeneratedIntake } from "@/lib/schema/intake.schema";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { ServerTiming } from "@/lib/server-timing";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { liveDayOf, type LiveDayDeps } from "./live-day";
import { PostgresAppSpend, PostgresGenerationLog, PostgresVisitorLimits } from "./postgres-stores";
import { hashVisitor } from "./visitor";

/**
 * The live routes on the Postgres stores, as a deploy runs them: a day and an intake that
 * count, settle and log in the database, and a database that is down, never migrated or
 * failing a statement, which must never let a model call through.
 */

const LIVELY_KANAZAWA: DayRequest = { ...KANAZAWA_START_REQUEST, energy: "lively" };
const VISITOR_ADDRESS = "203.0.113.7";
const SALT = "test-salt";
const LISBON_INTAKE: GeneratedIntake = {
  city: "Lisbon",
  cityReadings: [],
  energy: null,
  energyGuess: null,
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
  date: null,
  unplaced: [],
};
/**
 * A dotted IPv4 address, or an IPv6 one written out or compressed. A time of day has two
 * colons only, so it is not one.
 */
const IP_PATTERN =
  /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){3,7}\b|[0-9a-f]{1,4}::|::[0-9a-f]{1,4}/i;

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": VISITOR_ADDRESS },
    body: JSON.stringify(body),
  });
}

interface Bench {
  scheduled: (() => Promise<void>)[];
  lines: string[];
  afterResponse: () => Promise<void>;
}

function bench(): Bench {
  const scheduled: (() => Promise<void>)[] = [];
  return {
    scheduled,
    lines: [],
    afterResponse: async () => {
      await Promise.all(scheduled.splice(0).map((task) => task()));
    },
  };
}

function storesOn(sql: Sql) {
  const generationLog = new PostgresGenerationLog(sql, "preview");
  return {
    visitorLimits: new PostgresVisitorLimits(sql),
    appSpend: new PostgresAppSpend(sql),
    generationLog,
    dayArchive: generationLog,
  };
}

function common(sql: Sql, { scheduled, lines }: Bench) {
  return {
    config: { kind: "ready", config: { visitorHashSalt: SALT } } as const,
    ...storesOn(sql),
    schedule: (task: () => Promise<void>) => {
      scheduled.push(task);
    },
    log: (event: string) => {
      lines.push(event);
    },
    now: () => GOLDEN_NOW,
    newId: () => crypto.randomUUID(),
    maxRetries: 0,
  };
}

function dayDeps(sql: Sql, claude: FakeClaude, at: Bench): LiveDayDeps {
  return {
    ...common(sql, at),
    models: {
      day: claude.provider("claude-sonnet-5-5"),
      shadow: claude.provider("claude-haiku-5-5"),
    },
  };
}

function intakeDeps(sql: Sql, claude: FakeClaude, at: Bench): LiveIntakeDeps {
  return {
    ...common(sql, at),
    model: claude.provider("claude-haiku-5-5"),
    search: searchWrittenPlaces,
  };
}

function writesTheDay(): FakeClaude {
  return fakeClaude({ kind: "message", text: dayText(KANAZAWA_START_DAY.day) });
}

function readsLisbon(): FakeClaude {
  return fakeClaude({
    kind: "message",
    text: JSON.stringify(LISBON_INTAKE),
    usage: { input: 1_800, output: 150 },
  });
}

async function askForADay(deps: LiveDayDeps): Promise<Response> {
  const response = await liveDayOf(deps)(
    post("http://lantern.test/api/day", LIVELY_KANAZAWA),
    LIVELY_KANAZAWA,
    new ServerTiming(),
  );
  // The visitor reads the day to its end, as the client does.
  await response.text();
  return response;
}

function askForAnIntake(deps: LiveIntakeDeps): Promise<Response> {
  return answerIntakeRequest(post("http://lantern.test/api/intake", { text: "Lisbon" }), deps);
}

describe("the live routes on Postgres", () => {
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

  it("count the visitor's day, settle what it cost and log it as a pair", async () => {
    const at = bench();

    const response = await askForADay(dayDeps(database.session, writesTheDay(), at));
    await at.afterResponse();

    expect(response.status).toBe(200);
    const log = await database.session.query<{ role: string; pair_id: string }>(
      "SELECT role, pair_id, outcome, environment FROM generation_log ORDER BY role",
    );
    expect(log).toEqual([
      { role: "day", pair_id: expect.any(String), outcome: "complete", environment: "preview" },
      { role: "shadow", pair_id: log[0]?.pair_id, outcome: "complete", environment: "preview" },
    ]);
    const spend = await database.session.query<{ spent_micro_usd: number }>(
      "SELECT spent_micro_usd FROM app_spend",
    );
    expect(spend).toHaveLength(2);
    for (const bucket of spend) expect(bucket.spent_micro_usd).toBeGreaterThan(0);
    expect(await database.session.query("SELECT id FROM spend_holds")).toEqual([]);
    expect(at.lines).toEqual([]);
  });

  it("give a day with no stops back before its stream closes, and keep what it cost", async () => {
    const at = bench();
    const empty = fakeClaude({
      kind: "message",
      text: dayText({ ...KANAZAWA_START_DAY.day, stops: [], alternatives: [] }),
    });

    await askForADay(dayDeps(database.session, empty, at));
    // Read before `after()` runs, as the page asking for the day again would find it.
    const counters = await database.session.query("SELECT kind, count FROM visitor_counters");
    await at.afterResponse();

    expect(counters).toEqual([{ kind: "day", count: 0 }]);
    const spend = await database.session.query<{ spent_micro_usd: number }>(
      "SELECT spent_micro_usd FROM app_spend",
    );
    for (const bucket of spend) expect(bucket.spent_micro_usd).toBeGreaterThan(0);
    expect(at.lines).toEqual(["empty-day-given-back"]);
  });

  it("log the intake with the visitor's text, and count the visitor by the hash alone", async () => {
    const at = bench();

    const response = await askForAnIntake(intakeDeps(database.session, readsLisbon(), at));
    await at.afterResponse();

    expect(response.status).toBe(200);
    const [record] = await database.session.query<Record<string, unknown>>(
      "SELECT role, visitor_text, outcome FROM generation_log",
    );
    expect(record).toEqual({ role: "intake", visitor_text: "Lisbon", outcome: "request" });
    const counters = await database.session.query<{ visitor_key: string }>(
      "SELECT visitor_key, kind, count FROM visitor_counters",
    );
    expect(counters).toEqual([
      { visitor_key: await hashVisitor(VISITOR_ADDRESS, SALT), kind: "intake", count: 1 },
    ]);
  });

  it("charge an early intake the cap refused, though no hold covered it", async () => {
    const at = bench();
    const claude = readsLisbon();

    const response = await askForAnIntake({
      ...intakeDeps(database.session, claude, at),
      appSpend: new PostgresAppSpend(database.session, { dailyUsd: 0, monthlyUsd: null }),
      earlyCalls: new EarlyCallGate(),
    });
    await at.afterResponse();

    expect(response.status).toBe(429);
    expect(at.lines).toEqual([]);
    const spend = await database.session.query<{ spent_micro_usd: number }>(
      "SELECT spent_micro_usd FROM app_spend",
    );
    expect(spend).toHaveLength(2);
    for (const bucket of spend) expect(bucket.spent_micro_usd).toBeGreaterThan(0);
    const holds = await database.session.query("SELECT id FROM spend_holds");
    expect(holds).toEqual([]);
    const records = await database.session.query("SELECT id FROM generation_log");
    expect(records).toEqual([]);
  });

  it("answer the visitor and keep the record when clearing old texts fails", async () => {
    const at = bench();
    // Every statement answers but the one that clears expired texts.
    const failingClear: Sql = {
      query: (text, params) =>
        text.trimStart().startsWith("UPDATE generation_log")
          ? Promise.reject(new Error("canceling statement due to statement timeout"))
          : database.session.query(text, params),
      transaction: (statements) => database.session.transaction(statements),
    };
    const deps = intakeDeps(database.session, readsLisbon(), at);
    deps.generationLog = new PostgresGenerationLog(failingClear, "preview", {
      log: (event) => at.lines.push(event),
    });

    const response = await askForAnIntake(deps);
    await at.afterResponse();

    expect(response.status).toBe(200);
    expect(await database.session.query("SELECT role, outcome FROM generation_log")).toEqual([
      { role: "intake", outcome: "request" },
    ]);
    expect(at.lines).toEqual(["visitor-text-not-cleared"]);
  });

  it.each([
    VISITOR_ADDRESS,
    "2001:db8:85a3:0:0:8a2e:370:7334",
    "2001:db8::1",
    "2001:db8:85a3:0::/64",
  ])("would know %s for an address", (address) => {
    expect(JSON.stringify({ visitor: address })).toMatch(IP_PATTERN);
  });

  it("store no address anywhere", async () => {
    const at = bench();

    await askForADay(dayDeps(database.session, writesTheDay(), at));
    await askForAnIntake(intakeDeps(database.session, readsLisbon(), at));
    await at.afterResponse();

    for (const table of ["visitor_counters", "app_spend", "generation_log"]) {
      const rows = await database.session.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        for (const value of Object.values(row))
          expect(JSON.stringify(value)).not.toMatch(IP_PATTERN);
      }
    }
  });

  it("hold nothing and call no model when a statement fails after the visitor was counted", async () => {
    const at = bench();
    const claude = writesTheDay();
    // The visitors' counters answer; every hold of the spend fails.
    const failingSpend: Sql = {
      query: (text, params) => database.session.query(text, params),
      transaction: () => Promise.reject(new Error("canceling statement due to statement timeout")),
    };

    const response = await askForADay(dayDeps(failingSpend, claude, at));

    expect(response.status).toBe(503);
    expect(claude.requests).toHaveLength(0);
    // The visitor's count was given back.
    expect(await database.session.query("SELECT count FROM visitor_counters")).toEqual([
      { count: 0 },
    ]);
    expect(at.lines).toEqual(["live-day-failed"]);
  });
});

describe("the live routes on a database never migrated", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await emptyDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it("answer 503 and call no model, for the day and for the intake", async () => {
    const at = bench();
    const claude = writesTheDay();

    const day = await askForADay(dayDeps(database.session, claude, at));
    const intake = await askForAnIntake(intakeDeps(database.session, claude, at));

    expect([day.status, intake.status]).toEqual([503, 503]);
    expect(claude.requests).toHaveLength(0);
    expect(at.lines).toEqual(["live-day-failed", "live-intake-failed"]);
  });
});

describe("the live routes when the database cannot be reached", () => {
  const originalFetch: unknown = neonConfig.fetchFunction;

  beforeEach(() => {
    neonConfig.fetchFunction = () => Promise.reject(new TypeError("fetch failed"));
  });

  afterEach(() => {
    neonConfig.fetchFunction = originalFetch;
  });

  it("answer 503 and call no model, for the day and for the intake", async () => {
    const at = bench();
    const claude = writesTheDay();
    const unreachable = neonSql(
      "postgresql://lantern:s3cret@ep-test-1234.us-east-1.aws.neon.tech/neondb",
    );

    const day = await askForADay(dayDeps(unreachable, claude, at));
    const intake = await askForAnIntake(intakeDeps(unreachable, claude, at));

    expect([day.status, intake.status]).toEqual([503, 503]);
    expect(claude.requests).toHaveLength(0);
    expect(at.lines).toEqual(["live-day-failed", "live-intake-failed"]);
  });
});
