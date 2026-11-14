// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations, readMigrations } from "@/lib/db/migrate";
import {
  emptyDatabase,
  migratedDatabase,
  MIGRATIONS_DIRECTORY,
  type TestDatabase,
} from "@/lib/fixtures/db/pglite";
import { KYOTO_DRAGGED, ONE_EVENT_OF_EACH_KIND } from "@/lib/fixtures/events";
import { hashVisitor } from "@/lib/live/visitor";
import {
  answerEventRequest,
  MAX_EVENT_BYTES,
  NOT_KEPT,
  type EventDeps,
} from "./answer-event-request";
import { InMemoryEventStore, type EventLimits, type EventStore } from "./event-store";
import { PostgresEventStore } from "./postgres-event-store";

const URL = "http://lantern.test/api/events";
const ADDRESS = "203.0.113.7";
const OTHER_ADDRESS = "198.51.100.4";
const NOW = new Date("2026-10-30T12:00:00Z");
const DRAGGED = JSON.stringify(KYOTO_DRAGGED);
/**
 * A dotted IPv4 address, or an IPv6 one written out or compressed, as the live routes'
 * test looks for one.
 */
const IP_PATTERN =
  /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){3,7}\b|[0-9a-f]{1,4}::|::[0-9a-f]{1,4}/i;

/**
 * What `navigator.sendBeacon(url, string)` sends from Lantern's own page: a POST whose
 * string is `text/plain;charset=UTF-8`, with the browser's fetch metadata, and no header of
 * the page's own. Vercel's edge adds `x-real-ip`.
 */
function beacon(body: string, headers: Record<string, string> = {}): Request {
  return new Request(URL, {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin", "x-real-ip": ADDRESS, ...headers },
    body,
  });
}

/** One line of the server's log: its event and fields, as `logToConsole` writes them. */
type Line = Record<string, unknown>;

interface Bench {
  deps: EventDeps;
  lines: Line[];
}

function bench(store: EventStore, now: Date = NOW): Bench {
  const lines: Line[] = [];
  return {
    lines,
    deps: {
      store,
      log: (event, fields) => {
        lines.push({ event, ...fields });
      },
      now: () => now,
      newId: () => crypto.randomUUID(),
    },
  };
}

/** The line the log writes for an event not kept, for this reason. */
const notKept = (fields: Line): Line => ({ event: NOT_KEPT, ...fields });

function inMemory(limits?: EventLimits): InMemoryEventStore {
  return new InMemoryEventStore(limits);
}

describe("POST /api/events", () => {
  it.each(ONE_EVENT_OF_EACH_KIND)("keeps a $kind event sent as a beacon", async (event) => {
    const store = inMemory();

    const response = await answerEventRequest(beacon(JSON.stringify(event)), bench(store).deps);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(store.entries.map((entry) => entry.event)).toEqual([event]);
  });

  it("keeps one sent by fetch as JSON, and one with no fetch metadata, as from curl", async () => {
    const store = inMemory();
    const { deps } = bench(store);

    const fetched = await answerEventRequest(
      beacon(DRAGGED, { "content-type": "application/json" }),
      deps,
    );
    const curled = await answerEventRequest(
      new Request(URL, { method: "POST", headers: { "x-real-ip": ADDRESS }, body: DRAGGED }),
      deps,
    );

    expect([fetched.status, curled.status]).toEqual([204, 204]);
    expect(store.entries).toHaveLength(2);
  });

  it.each(["cross-site", "same-site"])(
    "refuses one a page on a %s origin sent, openly, logging nothing",
    async (site) => {
      const store = inMemory();
      const { deps, lines } = bench(store);

      const response = await answerEventRequest(beacon(DRAGGED, { "sec-fetch-site": site }), deps);

      expect(response.status).toBe(403);
      expect(store.entries).toEqual([]);
      expect(lines).toEqual([]);
    },
  );

  it.each([
    ["not JSON", "kind=curve-dragged&city=kyoto", { reason: "not-json" }],
    ["empty", "", { reason: "not-json" }],
    [
      "of an unknown kind",
      JSON.stringify({ kind: "page-viewed", city: "kyoto" }),
      { reason: "not-an-event", issues: ["kind"] },
    ],
    [
      "with a field its kind does not have",
      JSON.stringify({ ...KYOTO_DRAGGED, ua: "Mozilla/5.0" }),
      { reason: "not-an-event", issues: ["request"] },
    ],
    [
      "with a city that is not an address's",
      JSON.stringify({ ...KYOTO_DRAGGED, city: "São Paulo" }),
      { reason: "not-an-event", issues: ["city"] },
    ],
    [
      "with a word changed and no control, as a page from before the control was told sends it",
      JSON.stringify({ kind: "word-changed", city: "kyoto", word: "energy" }),
      { reason: "not-an-event", issues: ["control"] },
    ],
    [
      "with a control the page has none of",
      JSON.stringify({ kind: "word-changed", city: "kyoto", word: "energy", control: "slider" }),
      { reason: "not-an-event", issues: ["control"] },
    ],
  ])("answers a body %s with 204, keeps nothing, and logs why", async (_name, body, why) => {
    const store = inMemory();
    const { deps, lines } = bench(store);

    const response = await answerEventRequest(beacon(body), deps);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(store.entries).toEqual([]);
    expect(lines).toEqual([notKept(why)]);
  });

  it("answers a body past a kilobyte by its length with 204, before reading it", async () => {
    const store = inMemory();
    const { deps, lines } = bench(store);

    const response = await answerEventRequest(
      beacon(DRAGGED, { "content-length": String(MAX_EVENT_BYTES + 1) }),
      deps,
    );

    expect(response.status).toBe(204);
    expect(store.entries).toEqual([]);
    expect(lines).toEqual([notKept({ reason: "too-large" })]);
  });

  it("stops reading a body past a kilobyte that gives no length", async () => {
    const chunk = new TextEncoder().encode(" ".repeat(512));
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    const request = new Request(URL, {
      method: "POST",
      headers: { "x-real-ip": ADDRESS },
      body: endless,
      duplex: "half",
    } as RequestInit);

    const { deps, lines } = bench(inMemory());

    const response = await answerEventRequest(request, deps);

    expect(response.status).toBe(204);
    expect(pulled).toBeLessThan(10);
    expect(lines).toEqual([notKept({ reason: "too-large" })]);
  });

  it("takes a kilobyte, padding included", async () => {
    const padded = DRAGGED.padEnd(MAX_EVENT_BYTES, " ");

    const response = await answerEventRequest(beacon(padded), bench(inMemory()).deps);

    expect(response.status).toBe(204);
  });

  it("keeps no more once the visitor's events of the day are spent, and keeps others'", async () => {
    const store = inMemory({ perVisitor: 2, perApp: 10 });
    const { deps, lines } = bench(store);

    const statuses = [];
    for (let index = 0; index < 3; index += 1) {
      statuses.push((await answerEventRequest(beacon(DRAGGED), deps)).status);
    }
    const other = await answerEventRequest(beacon(DRAGGED, { "x-real-ip": OTHER_ADDRESS }), deps);

    // The page that sent the third is answered as for the others: it can do nothing about it.
    expect(statuses).toEqual([204, 204, 204]);
    expect(other.status).toBe(204);
    expect(store.entries).toHaveLength(3);
    expect(lines).toEqual([notKept({ reason: "spent", kind: "curve-dragged" })]);
  });

  it("keeps no more once the app's events of the day are spent", async () => {
    const store = inMemory({ perVisitor: 10, perApp: 1 });
    const { deps, lines } = bench(store);

    await answerEventRequest(beacon(DRAGGED), deps);
    const other = await answerEventRequest(beacon(DRAGGED, { "x-real-ip": OTHER_ADDRESS }), deps);

    expect(other.status).toBe(204);
    expect(store.entries).toHaveLength(1);
    expect(lines).toEqual([notKept({ reason: "spent", kind: "curve-dragged" })]);
  });

  it("answers 204 when the store fails, and logs why on one line", async () => {
    const failing: EventStore = {
      saltOn: () => Promise.reject(new Error("canceling statement due to statement timeout")),
      record: () => Promise.resolve(true),
    };
    const { deps, lines } = bench(failing);

    const response = await answerEventRequest(beacon(DRAGGED), deps);

    expect(response.status).toBe(204);
    expect(lines).toEqual([
      notKept({
        reason: "store-failed",
        kind: "curve-dragged",
        message: expect.stringContaining("statement timeout"),
      }),
    ]);
  });

  it("answers 204 when the store does not answer before its deadline", async () => {
    const silent: EventStore = {
      saltOn: () => new Promise<string>(() => undefined),
      record: () => Promise.resolve(true),
    };
    const { deps, lines } = bench(silent);

    const response = await answerEventRequest(beacon(DRAGGED), { ...deps, deadlineMs: 10 });

    expect(response.status).toBe(204);
    expect(lines).toEqual([
      notKept({ reason: "store-failed", kind: "curve-dragged", message: expect.any(String) }),
    ]);
  });

  it("logs no address and nothing the request wrote, whatever the refusal", async () => {
    const failing: EventStore = {
      saltOn: () => Promise.reject(new Error("connection refused")),
      record: () => Promise.resolve(true),
    };
    const spent = inMemory({ perVisitor: 0, perApp: 0 });
    const typed = { "x-real-ip": "2001:db8:85a3::8a2e:370:7334" };
    const refusals: [EventStore, string][] = [
      [inMemory(), "Mozilla/5.0 from 203.0.113.7"],
      [inMemory(), JSON.stringify({ ...KYOTO_DRAGGED, ua: "Mozilla/5.0" })],
      [inMemory(), JSON.stringify({ kind: "word-changed", city: "kyoto", word: "my secret" })],
      [spent, DRAGGED],
      [failing, DRAGGED],
    ];
    const logged: Line[] = [];

    for (const [store, body] of refusals) {
      const { deps, lines } = bench(store);
      await answerEventRequest(beacon(body), deps);
      await answerEventRequest(beacon(body, typed), deps);
      logged.push(...lines);
    }

    expect(logged).toHaveLength(refusals.length * 2);
    const text = JSON.stringify(logged);
    expect(text).not.toMatch(IP_PATTERN);
    expect(text).not.toMatch(/Mozilla|secret/);
  });
});

describe("POST /api/events on Postgres", () => {
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

  async function keyOf(request: Request, store: PostgresEventStore): Promise<string> {
    await answerEventRequest(request, bench(store).deps);
    const rows = await database.session.query<{ visitor_key: string }>(
      "SELECT visitor_key FROM product_events ORDER BY visitor_key",
    );
    return rows.at(-1)?.visitor_key ?? "";
  }

  it("keeps a visitor's events of one day under one key, which is not the limits' key", async () => {
    const store = new PostgresEventStore(database.session, "production");
    const { deps } = bench(store);

    await answerEventRequest(beacon(DRAGGED), deps);
    await answerEventRequest(beacon(DRAGGED), deps);
    await answerEventRequest(beacon(DRAGGED, { "x-real-ip": OTHER_ADDRESS }), deps);

    const keys = await database.session.query<{ visitor_key: string; events: number }>(
      "SELECT visitor_key, count(*)::integer AS events FROM product_events GROUP BY 1 ORDER BY 2",
    );
    expect(keys.map(({ events }) => events)).toEqual([1, 2]);
    const [salt] = await database.session.query<{ salt: string }>("SELECT salt FROM event_days");
    expect(keys[1]?.visitor_key).toBe(await hashVisitor(ADDRESS, salt?.salt ?? ""));
    expect(keys[1]?.visitor_key).not.toBe(await hashVisitor(ADDRESS, "the limits' salt"));
  });

  it("knows the same visitor by another key the next day", async () => {
    const today = await keyOf(
      beacon(DRAGGED),
      new PostgresEventStore(database.session, "production"),
    );
    await database.session.exec("DELETE FROM product_events");

    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const store = new PostgresEventStore(database.session, "production");
    await answerEventRequest(beacon(DRAGGED), bench(store, tomorrow).deps);
    const [row] = await database.session.query<{ visitor_key: string; day: string }>(
      "SELECT visitor_key, utc_day::text AS day FROM product_events",
    );

    expect(row?.day).toBe("2026-10-31");
    expect(row?.visitor_key).not.toBe(today);
  });

  it("stores no address anywhere", async () => {
    const store = new PostgresEventStore(database.session, "production");
    for (const event of ONE_EVENT_OF_EACH_KIND) {
      await answerEventRequest(beacon(JSON.stringify(event)), bench(store).deps);
      await answerEventRequest(
        beacon(JSON.stringify(event), { "x-real-ip": "2001:db8:85a3::8a2e:370:7334" }),
        bench(store).deps,
      );
    }

    for (const table of ["event_days", "event_visitors", "product_events"]) {
      const rows = await database.session.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        for (const value of Object.values(row)) {
          expect(JSON.stringify(value)).not.toMatch(IP_PATTERN);
        }
      }
    }
  });
});

describe("POST /api/events on a database never migrated", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await emptyDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it("answers 204, so no visitor's console shows it, and logs that the store failed", async () => {
    const { deps, lines } = bench(new PostgresEventStore(database.session, "production"));

    const response = await answerEventRequest(beacon(DRAGGED), deps);

    expect(response.status).toBe(204);
    expect(lines).toEqual([
      notKept({ reason: "store-failed", kind: "curve-dragged", message: expect.any(String) }),
    ]);
  });
});

describe("POST /api/events on a database short of its latest migration", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await emptyDatabase();
    const migrations = await readMigrations(MIGRATIONS_DIRECTORY);
    await applyMigrations(
      database.session,
      migrations.filter(({ name }) => name !== "0010_event_control.sql"),
    );
  });

  afterAll(async () => {
    await database.close();
  });

  // The store names every column in its one insert: this is why production is migrated before
  // the release that writes a new one (docs/harness.md, "Database").
  it("keeps no event of any kind, the ones without the new column too", async () => {
    const { deps, lines } = bench(new PostgresEventStore(database.session, "production"));

    const response = await answerEventRequest(beacon(DRAGGED), deps);

    expect(response.status).toBe(204);
    expect(lines).toEqual([
      notKept({
        reason: "store-failed",
        kind: "curve-dragged",
        message: expect.stringContaining("control"),
      }),
    ]);
    expect(await database.session.query("SELECT id FROM product_events")).toEqual([]);
  });
});

describe("answerEventRequest from a browser that sends no Sec-Fetch-Site", () => {
  it("refuses a beacon whose Origin is another site, and keeps one from Lantern's own host", async () => {
    const store = inMemory();
    const { deps } = bench(store);
    const send = (origin: string) =>
      answerEventRequest(
        new Request("http://192.168.1.20:3000/api/events", {
          method: "POST",
          headers: { host: "192.168.1.20:3000", origin, "x-real-ip": ADDRESS },
          body: DRAGGED,
        }),
        deps,
      );

    expect((await send("https://example.com")).status).toBe(403);
    expect((await send("http://192.168.1.20:3000")).status).toBe(204);
    expect(store.entries).toHaveLength(1);
  });
});
