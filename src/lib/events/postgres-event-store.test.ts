// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "@/lib/db/sql";
import { migratedDatabase, type TestDatabase } from "@/lib/fixtures/db/pglite";
import { ONE_EVENT_OF_EACH_KIND } from "@/lib/fixtures/events";
import { DAY_OUTCOMES, HEADER_WORDS, INTAKE_OUTCOMES, LEFT_STAGES, DAY_VIAS } from "./event.schema";
import type { EventEntry } from "./event-store";
import { columnsOf, PostgresEventStore } from "./postgres-event-store";

const TODAY = "2026-10-30";
const TOMORROW = "2026-10-31";
const VISITOR = "a".repeat(64);
const OTHER_VISITOR = "b".repeat(64);

function entry(
  visitor: string,
  event: EventEntry["event"] = { kind: "curve-dragged", city: "kyoto" },
  day: string = TODAY,
): EventEntry {
  return { id: crypto.randomUUID(), visitor, day, event };
}

/** Counts every statement the store sends, so a test can say how many round trips it takes. */
function counting(sql: Sql): { sql: Sql; calls: () => number } {
  let calls = 0;
  return {
    sql: {
      query: (text, params) => {
        calls += 1;
        return sql.query(text, params);
      },
      transaction: (statements) => {
        calls += 1;
        return sql.transaction(statements);
      },
    },
    calls: () => calls,
  };
}

describe("the Postgres event store", () => {
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

  it("makes a day's salt once, and reads it from the database only once per process", async () => {
    const { sql, calls } = counting(database.session);
    const store = new PostgresEventStore(sql, "production");
    const otherInstance = new PostgresEventStore(database.session, "production");

    const salt = await store.saltOn(TODAY);

    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    expect(await store.saltOn(TODAY)).toBe(salt);
    expect(await otherInstance.saltOn(TODAY)).toBe(salt);
    expect(calls()).toBe(1);
  });

  it("drops the days past, their salts and their visitors' counts, when a new day opens", async () => {
    const store = new PostgresEventStore(database.session, "production");
    const today = await store.saltOn(TODAY);
    await store.record(entry(VISITOR));

    const tomorrow = await store.saltOn(TOMORROW);

    expect(tomorrow).not.toBe(today);
    expect(await database.session.query("SELECT utc_day::text AS day FROM event_days")).toEqual([
      { day: TOMORROW },
    ]);
    expect(await database.session.query("SELECT * FROM event_visitors")).toEqual([]);
    // The event itself stays.
    expect(await database.session.query("SELECT kind FROM product_events")).toEqual([
      { kind: "curve-dragged" },
    ]);
  });

  it("keeps an event in one statement once the day's salt is known", async () => {
    const { sql, calls } = counting(database.session);
    const store = new PostgresEventStore(sql, "preview");
    await store.saltOn(TODAY);
    const event = {
      kind: "day-left",
      city: "sao-paulo",
      via: "typed",
      written: false,
      stage: "before-first-stop",
    } as const;

    expect(await store.record(entry(VISITOR, event))).toBe(true);

    expect(calls()).toBe(2);
    expect(
      await database.session.query(
        `SELECT environment, utc_day::text AS utc_day, visitor_key, kind, city, via, written,
          outcome, stage, word FROM product_events`,
      ),
    ).toEqual([
      {
        environment: "preview",
        utc_day: TODAY,
        visitor_key: VISITOR,
        kind: "day-left",
        city: "sao-paulo",
        via: "typed",
        written: false,
        outcome: null,
        stage: "before-first-stop",
        word: null,
      },
    ]);
  });

  it("stores every kind and every word of every vocabulary", async () => {
    const store = new PostgresEventStore(database.session, "production", {
      perVisitor: 1_000,
      perApp: 1_000,
    });
    await store.saltOn(TODAY);
    const everyWord = [
      ...ONE_EVENT_OF_EACH_KIND,
      ...DAY_VIAS.map(
        (via) => ({ kind: "day-opened", city: "kyoto", via, written: true }) as const,
      ),
      ...DAY_OUTCOMES.map(
        (outcome) =>
          ({ kind: "day-ended", city: "kyoto", via: "link", written: false, outcome }) as const,
      ),
      ...LEFT_STAGES.map(
        (stage) =>
          ({ kind: "day-left", city: "kyoto", via: "word", written: true, stage }) as const,
      ),
      ...HEADER_WORDS.map((word) => ({ kind: "word-changed", city: "kyoto", word }) as const),
      ...INTAKE_OUTCOMES.map((outcome) => ({ kind: "intake-ended", outcome }) as const),
    ];

    for (const event of everyWord) expect(await store.record(entry(VISITOR, event))).toBe(true);

    const rows = await database.session.query<Record<string, unknown>>(
      "SELECT kind, city, via, written, outcome, stage, word FROM product_events",
    );
    expect(rows).toHaveLength(everyWord.length);
    expect(rows).toEqual(
      expect.arrayContaining(everyWord.map((event) => ({ kind: event.kind, ...columnsOf(event) }))),
    );
  });

  it("keeps a visitor's events up to their limit, each visitor on their own", async () => {
    const store = new PostgresEventStore(database.session, "production", {
      perVisitor: 2,
      perApp: 10,
    });
    await store.saltOn(TODAY);

    const kept = [];
    for (let index = 0; index < 3; index += 1) kept.push(await store.record(entry(VISITOR)));

    expect(kept).toEqual([true, true, false]);
    expect(await store.record(entry(OTHER_VISITOR))).toBe(true);
    expect(
      await database.session.query(
        "SELECT visitor_key, events FROM event_visitors ORDER BY visitor_key",
      ),
    ).toEqual([
      { visitor_key: VISITOR, events: 2 },
      { visitor_key: OTHER_VISITOR, events: 1 },
    ]);
  });

  it("keeps no more than the app's limit, and adds no visitor's row once it is spent", async () => {
    const store = new PostgresEventStore(database.session, "production", {
      perVisitor: 10,
      perApp: 2,
    });
    await store.saltOn(TODAY);
    await store.record(entry(VISITOR));
    await store.record(entry(OTHER_VISITOR));

    const late = await Promise.all(
      ["c", "d", "e"].map((letter) => store.record(entry(letter.repeat(64)))),
    );

    expect(late).toEqual([false, false, false]);
    expect(await database.session.query("SELECT events FROM event_days")).toEqual([{ events: 2 }]);
    expect(await database.session.query("SELECT visitor_key FROM event_visitors")).toHaveLength(2);
    expect(await database.session.query("SELECT id FROM product_events")).toHaveLength(2);
  });

  it("never lets events at once pass the app's limit", async () => {
    const store = new PostgresEventStore(database.session, "production", {
      perVisitor: 100,
      perApp: 5,
    });
    await store.saltOn(TODAY);

    const kept = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        store.record(entry(index % 2 ? VISITOR : OTHER_VISITOR)),
      ),
    );

    expect(kept.filter(Boolean)).toHaveLength(5);
    expect(await database.session.query("SELECT id FROM product_events")).toHaveLength(5);
  });

  it("counts each environment apart, under its own salt", async () => {
    const limits = { perVisitor: 1, perApp: 1 };
    const development = new PostgresEventStore(database.session, "development", limits);
    const preview = new PostgresEventStore(database.session, "preview", limits);

    expect(await development.saltOn(TODAY)).not.toBe(await preview.saltOn(TODAY));
    expect(await development.record(entry(VISITOR))).toBe(true);
    expect(await preview.record(entry(VISITOR))).toBe(true);
    expect(await development.record(entry(OTHER_VISITOR))).toBe(false);
  });

  it("keeps nothing for a day whose salt is gone", async () => {
    const store = new PostgresEventStore(database.session, "production");
    await store.saltOn(TOMORROW);

    expect(await store.record(entry(VISITOR, undefined, TODAY))).toBe(false);
    expect(await database.session.query("SELECT id FROM product_events")).toEqual([]);
  });

  it("refuses an address, or anything else that is not such a hash, for a visitor", async () => {
    const store = new PostgresEventStore(database.session, "production");
    await store.saltOn(TODAY);

    await expect(store.record(entry("203.0.113.7"))).rejects.toThrow(/check constraint/);
  });
});
