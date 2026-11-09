// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/day/[id]/route";
import { writtenDayAt } from "@/lib/days/written/days";
import { DAY_ID_HEADER, DAY_LINK_DAYS } from "@/lib/days/stored-day";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { migratedDatabase, type TestDatabase } from "@/lib/fixtures/db/pglite";
import { fakeClaude } from "@/lib/fixtures/live/mock-claude";
import { KYOTO_LATE_EVENING, KYOTO_OUT_LATE } from "@/lib/fixtures/replan/kyoto-evening";
import {
  KYOTO_ITINERARY,
  KYOTO_MORNING_BASIS,
  KYOTO_SLOW_MORNING,
  KYOTO_SLOW_START,
} from "@/lib/fixtures/replan/kyoto-morning";
import { writtenChecksOf } from "@/lib/days/written/checks";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { mergeReplan } from "@/lib/replan/merge";
import type { DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { placeCheckOf, type PlaceCheck } from "@/lib/stream/place-checks";
import { readDayStream } from "@/lib/stream/read-day-stream";
import { dayText, dayTextOffsets, simulatedModel } from "@/lib/stream/simulate-day-stream";
import { CITY_SIGNATURE_HEADER } from "@/lib/intake/signed-city";
import { citySignatureKey, signCity } from "./city-signature";
import {
  InMemoryGenerationLog,
  type GenerationLog,
  type GenerationRecord,
  type ReplanContext,
} from "./generation-log";
import { InMemoryAppSpend, InMemoryVisitorLimits } from "./limits";
import { liveDayOf, type LiveDayDeps } from "./live-day";
import { answerReplanRequest } from "./live-replan";
import { PostgresGenerationLog } from "./postgres-stores";
import { storesFor } from "./stores";
import { keptBasisOf, readStoredDay, storedDayOf } from "./stored-days";

const STARTED = "2026-11-19T10:00:00.000Z";
const MS_TO_FINISH = 48_400;
const WRITTEN_AT = "2026-11-19T10:00:48.400Z";
const NOW = new Date("2026-11-19T12:00:00Z");
const LIVELY_KYOTO: DayRequest = { ...KYOTO_REQUEST, energy: "lively" };
const POINT = { lat: 35.0268, lng: 135.7954 };
const CONFIRMED_FIRST: Record<string, PlaceCheck> = {
  "stop-0:p": { placeId: "stop-0:p", state: "confirmed", by: "name", coordinates: POINT },
};

const DAY_RECORD: GenerationRecord = {
  id: "day-1",
  pairId: null,
  role: "day",
  model: "claude-sonnet-5-5",
  promptVersion: "day-v8",
  startedAt: STARTED,
  tokens: { input: 6_000, output: 6_400, thinking: null },
  costUsd: 0.076,
  msToFirstToken: 3_500,
  msToFinish: MS_TO_FINISH,
  finishReason: "stop",
  outcome: "complete",
  salvaged: false,
  placeChecks: CONFIRMED_FIRST,
  repairs: 0,
  checks: null,
  visitorText: null,
  request: LIVELY_KYOTO,
  outputText: dayText(KYOTO_DAY.day),
  warnings: [],
  requestId: "req_1",
  error: null,
};

const REPLAN_CONTEXT: ReplanContext = {
  changed: "start",
  round: 1,
  windows: [{ from: 0, to: 1 }],
  itinerary: KYOTO_ITINERARY,
  basis: { kind: "written", slug: "kyoto" },
};

/** The written Kyoto day's start re-planned slow, as the route keeps it. */
const REPLAN_RECORD: GenerationRecord = {
  ...DAY_RECORD,
  id: "replan-1",
  promptVersion: "replan-v1",
  request: KYOTO_SLOW_START,
  outputText: JSON.stringify(KYOTO_SLOW_MORNING),
  context: REPLAN_CONTEXT,
};

/** Ids as the server makes them, numbered for the test: the walk reads only a real id. */
function dayIdOf(n: number): string {
  return `7a2d4c1e-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const GARDEN_POINT = { lat: 35.0105, lng: 135.7867 };

function confirmedByName(placeId: string, coordinates = POINT): PlaceCheck {
  return { placeId, state: "confirmed", by: "name", coordinates };
}

/** A live Kyoto day as the log keeps it, a place checked in each part of the day. */
const LIVE_ID = dayIdOf(1);
const LIVE_RECORD: GenerationRecord = {
  ...DAY_RECORD,
  id: LIVE_ID,
  request: KYOTO_DAY.request,
  placeChecks: {
    // The temple the slow morning rewrites.
    "stop-0:p": confirmedByName("stop-0:p"),
    // Murin-an at ten and one of its versions, which both re-plans keep.
    "stop-2:p": confirmedByName("stop-2:p", GARDEN_POINT),
    "stop-2:a1": { placeId: "stop-2:a1", state: "confirmed", by: "area" },
    // Dinner on Pontocho, which the morning's re-plan keeps and the evening's rewrites.
    "stop-7:p": { placeId: "stop-7:p", state: "confirmed", by: "area" },
  },
};

/** Its start re-planned slow, the shrine checked as the re-plan's stream keys it. */
const MORNING_ID = dayIdOf(2);
const MORNING_RECORD: GenerationRecord = {
  ...REPLAN_RECORD,
  id: MORNING_ID,
  placeChecks: { "stop-1:p": confirmedByName("stop-1:p") },
  context: { ...REPLAN_CONTEXT, basis: { kind: "kept", id: LIVE_ID } },
};

function mergedMorning(): Itinerary {
  const merged = mergeReplan({ ...KYOTO_MORNING_BASIS, replan: KYOTO_SLOW_MORNING });
  if (!merged.ok) throw new Error(merged.reason);
  return merged.itinerary;
}

/** Then its end re-planned late, the second round, from the morning's merged day. */
const EVENING_ID = dayIdOf(3);
const EVENING_RECORD: GenerationRecord = {
  ...REPLAN_RECORD,
  id: EVENING_ID,
  request: { ...KYOTO_SLOW_START, end: "late" },
  outputText: JSON.stringify(KYOTO_LATE_EVENING),
  placeChecks: { "stop-0:p": { placeId: "stop-0:p", state: "unconfirmed" } },
  context: {
    changed: "end",
    round: 2,
    windows: [{ from: 7, to: 7 }],
    itinerary: mergedMorning(),
    basis: { kind: "kept", id: MORNING_ID },
  },
};

function writtenKanazawa() {
  const written = writtenDayAt("kanazawa");
  if (written === null) throw new Error("Kanazawa has a written day");
  return written;
}

const KANAZAWA = writtenKanazawa();
const KANAZAWA_ODEN = KANAZAWA_START_DAY.day.stops[6];
if (KANAZAWA_ODEN === undefined) throw new Error("Kanazawa's day has dinner seventh");

/** Kanazawa's dinner moved late by hand: the same oden at a quarter to nine, the evening's walk gone. */
const KANAZAWA_LATE_DINNER: GeneratedReplan = {
  stops: [{ ...KANAZAWA_ODEN, startTime: "20:45", durationMinutes: 90 }],
  alternatives: [],
  dek: "Kenroku-en at half past seven, the teahouses, the market, the castle and the museum, then oden at a quarter to nine.",
};

/** A written day's dinner re-planned, as the route keeps it. */
const KANAZAWA_ID = dayIdOf(4);
function kanazawaRecord(itinerary: Itinerary = KANAZAWA.itinerary): GenerationRecord {
  return {
    ...REPLAN_RECORD,
    id: KANAZAWA_ID,
    request: { ...KANAZAWA.request, dinner: "late" },
    outputText: JSON.stringify(KANAZAWA_LATE_DINNER),
    placeChecks: null,
    context: {
      changed: "dinner",
      round: 1,
      windows: [{ from: 6, to: 7 }],
      itinerary,
      basis: { kind: "written", slug: "kanazawa" },
    },
  };
}

/** Kanazawa's recorded checks as its page plays them, but the dinner's and the walk's after it. */
function kanazawaKeptChecks(): Record<string, PlaceCheck> {
  const kept = Object.entries(writtenChecksOf("Kanazawa")).filter(
    ([id]) => !id.startsWith("stop-6:") && !id.startsWith("stop-7:"),
  );
  return Object.fromEntries(kept.map(([id, result]) => [id, placeCheckOf(id, result)]));
}

async function logOf(log: GenerationLog, ...records: GenerationRecord[]): Promise<void> {
  for (const record of records) await log.record(record);
}

async function read(...records: GenerationRecord[]) {
  const log = new InMemoryGenerationLog();
  for (const record of records) await log.record(record);
  return (id: string, now = NOW) => readStoredDay(id, log, now);
}

function normalized(request: DayRequest = LIVELY_KYOTO) {
  const result = normalizeDay(request, KYOTO_DAY.day);
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary;
}

describe("readStoredDay", () => {
  it("opens a finished day as the visitor was shown it, a place confirmed by name at the provider's point", async () => {
    const stored = await (await read(DAY_RECORD))("day-1");

    if (stored.status !== "written") throw new Error(stored.status);
    expect(stored.request).toEqual(LIVELY_KYOTO);
    expect(stored.itinerary.stops[0]?.primary.coordinates).toEqual(POINT);
    expect(stored.itinerary.stops.slice(1)).toEqual(normalized().stops.slice(1));
    expect(stored.checks).toEqual(CONFIRMED_FIRST);
    expect(stored).toMatchObject({ writtenAt: WRITTEN_AT, seconds: 48 });
  });

  it("opens a cut day with the stops the salvage rule kept, at the model's points as a cut is shown", async () => {
    const options = dayTextOffsets(KYOTO_DAY.day).options ?? 0;
    const cut: GenerationRecord = {
      ...DAY_RECORD,
      outcome: "cut",
      salvaged: true,
      outputText: dayText(KYOTO_DAY.day).slice(0, options + 400),
    };

    const stored = await (await read(cut))("day-1");

    if (stored.status !== "cut") throw new Error(stored.status);
    expect(stored.itinerary.stops.map(({ id }) => id)).toEqual(
      normalized().stops.map(({ id }) => id),
    );
    expect(stored.itinerary.stops[0]?.primary.coordinates).toEqual(
      normalized().stops[0]?.primary.coordinates,
    );
  });

  it("answers failed, with what was asked, for a call that showed no day", async () => {
    const reader = await read(
      { ...DAY_RECORD, id: "invalid", outcome: "invalid" },
      { ...DAY_RECORD, id: "cut-bare", outcome: "cut", salvaged: false, outputText: '{"dek":"A' },
    );

    expect(await reader("invalid")).toEqual({ status: "failed", request: LIVELY_KYOTO });
    expect(await reader("cut-bare")).toEqual({ status: "failed", request: LIVELY_KYOTO });
  });

  it("knows no shadow, no intake and no id it never wrote", async () => {
    const reader = await read(
      { ...DAY_RECORD, id: "shadow", role: "shadow", model: "claude-haiku-5-5" },
      { ...DAY_RECORD, id: "intake", role: "intake", visitorText: "Kyoto, lively" },
    );

    expect(await reader("shadow")).toEqual({ status: "unknown" });
    expect(await reader("intake")).toEqual({ status: "unknown" });
    expect(await reader("never")).toEqual({ status: "unknown" });
  });

  it("closes the link once its days have passed since the day was written, keeping what was asked", async () => {
    const reader = await read(DAY_RECORD);
    const written = Date.parse(WRITTEN_AT);
    const day = 24 * 60 * 60 * 1000;

    expect((await reader("day-1", new Date(written + DAY_LINK_DAYS * day))).status).toBe("written");
    expect(await reader("day-1", new Date(written + DAY_LINK_DAYS * day + 1))).toEqual({
      status: "expired",
      request: LIVELY_KYOTO,
    });
  });

  it("opens a re-plan as the day it merged into, its places' checks under the round's prefix", async () => {
    const merged = mergeReplan({ ...KYOTO_MORNING_BASIS, replan: KYOTO_SLOW_MORNING });
    if (!merged.ok) throw new Error(merged.reason);

    const stored = await (await read(REPLAN_RECORD))("replan-1");

    if (stored.status !== "written") throw new Error(stored.status);
    expect(stored.checks).toEqual({
      "r1-stop-0:p": { ...CONFIRMED_FIRST["stop-0:p"], placeId: "r1-stop-0:p" },
    });
    expect(stored.itinerary.stops[0]?.primary.coordinates).toEqual(POINT);
    expect(stored.itinerary.stops.slice(2)).toEqual(merged.itinerary.stops.slice(2));
  });

  it("says how many re-plans a day has taken: none for a live day, whole or cut, and a re-plan's round", async () => {
    const options = dayTextOffsets(KYOTO_DAY.day).options ?? 0;
    const cut: GenerationRecord = {
      ...DAY_RECORD,
      id: "cut-1",
      outcome: "cut",
      salvaged: true,
      outputText: dayText(KYOTO_DAY.day).slice(0, options + 400),
    };
    const reader = await read(DAY_RECORD, cut, REPLAN_RECORD);

    expect(await reader("day-1")).toMatchObject({ status: "written", round: 0 });
    expect(await reader("cut-1")).toMatchObject({ status: "cut", round: 0 });
    expect(await reader("replan-1")).toMatchObject({ status: "written", round: 1 });
  });

  it("opens no re-plan whose day the server did not read itself, only what was asked", async () => {
    // Written before the server read the day, its context held a client's day and words.
    const { basis: _, ...clients } = REPLAN_CONTEXT;
    const record: GenerationRecord = { ...REPLAN_RECORD, context: clients };

    expect(await (await read(record))("replan-1")).toEqual({
      status: "failed",
      request: KYOTO_SLOW_START,
    });
  });
});

describe("a re-plan opened again", () => {
  it("marks its kept places as the day it was made from had them, and none of the places its window rewrote", async () => {
    const stored = await (await read(LIVE_RECORD, MORNING_RECORD))(MORNING_ID);

    if (stored.status !== "written") throw new Error(stored.status);
    expect(stored.checks).toEqual({
      "r1-stop-1:p": confirmedByName("r1-stop-1:p"),
      "stop-2:p": LIVE_RECORD.placeChecks?.["stop-2:p"],
      "stop-2:a1": LIVE_RECORD.placeChecks?.["stop-2:a1"],
      "stop-7:p": LIVE_RECORD.placeChecks?.["stop-7:p"],
    });
    // Only the marks are carried: the kept stops stay as the re-plan read them.
    expect(stored.itinerary.stops.slice(2)).toEqual(KYOTO_ITINERARY.stops.slice(2));
  });

  it("carries every round's marks back to the day the re-plans began with", async () => {
    const stored = await (await read(LIVE_RECORD, MORNING_RECORD, EVENING_RECORD))(EVENING_ID);

    if (stored.status !== "written") throw new Error(stored.status);
    expect(stored.round).toBe(2);
    expect(stored.checks).toEqual({
      "r2-stop-0:p": { placeId: "r2-stop-0:p", state: "unconfirmed" },
      "r1-stop-1:p": confirmedByName("r1-stop-1:p"),
      "stop-2:p": LIVE_RECORD.placeChecks?.["stop-2:p"],
      "stop-2:a1": LIVE_RECORD.placeChecks?.["stop-2:a1"],
    });
  });

  it("marks a written day's kept places with the checks its run recorded", async () => {
    const stored = await (await read(kanazawaRecord()))(KANAZAWA_ID);

    if (stored.status !== "written") throw new Error(stored.status);
    expect(stored.checks).toEqual(kanazawaKeptChecks());
    expect(stored.checks["stop-0:p"]).toMatchObject({ state: "confirmed", by: "name" });
  });

  it("takes no written check for a place the written day no longer holds under that name", async () => {
    // As the day read before its file was written again, a new coffee at the old one's id.
    const before: Itinerary = {
      ...KANAZAWA.itinerary,
      stops: KANAZAWA.itinerary.stops.map((stop, index) =>
        index === 1 ? { ...stop, primary: { ...stop.primary, name: "Coffee by the gate" } } : stop,
      ),
    };

    const stored = await (await read(kanazawaRecord(before)))(KANAZAWA_ID);

    if (stored.status !== "written") throw new Error(stored.status);
    const { "stop-1:p": _, ...others } = kanazawaKeptChecks();
    expect(stored.checks).toEqual(others);
  });

  it("keeps its own marks alone when the day it was made from is not in the log, or never comes before it", async () => {
    const own = { "r1-stop-1:p": confirmedByName("r1-stop-1:p") };
    const looping: GenerationRecord = {
      ...MORNING_RECORD,
      id: dayIdOf(5),
      context: { ...REPLAN_CONTEXT, basis: { kind: "kept", id: dayIdOf(5) } },
    };
    const unreadable: GenerationRecord = {
      ...MORNING_RECORD,
      id: dayIdOf(6),
      context: { ...REPLAN_CONTEXT, basis: { kind: "kept", id: "not-a-day" } },
    };
    const reader = await read(MORNING_RECORD, looping, unreadable);

    expect(await reader(MORNING_ID)).toMatchObject({ status: "written", checks: own });
    expect(await reader(dayIdOf(5))).toMatchObject({ status: "written", checks: own });
    expect(await reader(dayIdOf(6))).toMatchObject({ status: "written", checks: own });
  });

  it("answers its round, so the page's next re-plan of it, sent as that round and one, is taken", async () => {
    const generationLog = new InMemoryGenerationLog();
    await logOf(generationLog, LIVE_RECORD, MORNING_RECORD);
    const scheduled: (() => Promise<void>)[] = [];
    const claude = fakeClaude({
      kind: "message",
      text: JSON.stringify(KYOTO_LATE_EVENING),
      usage: { input: 4_200, output: 1_100 },
    });
    const ask = (round: number) =>
      answerReplanRequest(
        new Request("http://lantern.test/api/replan", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-real-ip": "203.0.113.7" },
          body: JSON.stringify({
            basis: { kind: "kept", id: MORNING_ID },
            request: { ...KYOTO_SLOW_START, end: KYOTO_OUT_LATE.end },
            changed: "end",
            round,
          }),
        }),
        {
          config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
          model: claude.provider("claude-sonnet-5-5"),
          visitorLimits: new InMemoryVisitorLimits(),
          appSpend: new InMemoryAppSpend({ dailyUsd: 10, monthlyUsd: null }),
          generationLog,
          dayArchive: generationLog,
          basisRetryMs: 0,
          schedule: (task) => {
            scheduled.push(task);
          },
          log: () => undefined,
          now: () => NOW,
          newId: () => crypto.randomUUID(),
          maxRetries: 0,
        },
      );

    const stored = await readStoredDay(MORNING_ID, generationLog, NOW);
    if (stored.status !== "written") throw new Error(stored.status);
    // A page that sends round 1 again, as one that never learnt the round, is sent to the whole day.
    const again = await ask(1);
    const next = await ask((stored.round ?? 0) + 1);
    await next.text();
    await Promise.all(scheduled.splice(0).map((task) => task()));

    expect(stored.round).toBe(1);
    expect(again.status).toBe(409);
    expect(next.status).toBe(200);
    expect(generationLog.records.at(-1)?.context).toMatchObject({
      round: 2,
      basis: { kind: "kept", id: MORNING_ID },
    });
  });
});

describe("a re-plan opened again from Postgres", () => {
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

  // `context` comes back from jsonb with its keys reordered, so nothing compares it as text.
  it("carries its round and its kept places' marks through the log's own columns", async () => {
    const log = new PostgresGenerationLog(database.session, "preview");
    await logOf(log, LIVE_RECORD, MORNING_RECORD, EVENING_RECORD, kanazawaRecord());

    const evening = await readStoredDay(EVENING_ID, log, NOW);
    const kanazawa = await readStoredDay(KANAZAWA_ID, log, NOW);

    if (evening.status !== "written") throw new Error(evening.status);
    if (kanazawa.status !== "written") throw new Error(kanazawa.status);
    expect(evening.round).toBe(2);
    expect(Object.keys(evening.checks).sort()).toEqual([
      "r1-stop-1:p",
      "r2-stop-0:p",
      "stop-2:a1",
      "stop-2:p",
    ]);
    expect(kanazawa.round).toBe(1);
    expect(kanazawa.checks).toEqual(kanazawaKeptChecks());
  });
});

describe("keptBasisOf", () => {
  it("reads a day the visitor saw whole as a re-plan's basis, with no re-plans in it yet", async () => {
    const log = new InMemoryGenerationLog();
    await log.record(DAY_RECORD);

    const reading = await keptBasisOf("day-1", log, NOW);

    if (reading.kind !== "kept") throw new Error(reading.status);
    expect(reading.basis.request).toEqual(LIVELY_KYOTO);
    expect(reading.basis.itinerary.stops[0]?.primary.coordinates).toEqual(POINT);
    expect(reading.basis.round).toBe(0);
  });

  it("reads a merged re-plan with its round, for the next one to follow", async () => {
    const log = new InMemoryGenerationLog();
    await log.record(REPLAN_RECORD);

    const reading = await keptBasisOf("replan-1", log, NOW);

    if (reading.kind !== "kept") throw new Error(reading.status);
    expect(reading.basis.round).toBe(1);
    expect(reading.basis.itinerary.stops[0]?.id).toBe("r1-stop-0");
  });

  it("names why a day is no basis: not landed yet, not whole, or past its link's days", async () => {
    const log = new InMemoryGenerationLog();
    await log.record({ ...DAY_RECORD, id: "cut-1", outcome: "cut", salvaged: false });
    await log.record(DAY_RECORD);
    const later = new Date(Date.parse(WRITTEN_AT) + (DAY_LINK_DAYS + 1) * 24 * 60 * 60 * 1000);

    expect(await keptBasisOf("nobody", log, NOW)).toEqual({ kind: "not-kept", status: "unknown" });
    expect(await keptBasisOf("cut-1", log, NOW)).toEqual({ kind: "not-kept", status: "failed" });
    expect(await keptBasisOf("day-1", log, later)).toEqual({
      kind: "not-kept",
      status: "expired",
    });
  });
});

describe("a live day kept to be opened again", () => {
  it("reads back by the id its answer named as the day the visitor's reader made", async () => {
    const generationLog = new InMemoryGenerationLog();
    const scheduled: (() => Promise<void>)[] = [];
    const model = () =>
      simulatedModel({
        day: KYOTO_DAY.day,
        ending: { kind: "finished" },
        pace: { deltaChars: 256 },
      });
    const deps: LiveDayDeps = {
      config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
      models: { day: model(), shadow: model() },
      visitorLimits: new InMemoryVisitorLimits(),
      appSpend: new InMemoryAppSpend(),
      generationLog,
      dayArchive: generationLog,
      schedule: (task) => {
        scheduled.push(task);
      },
      log: () => undefined,
      now: () => NOW,
      newId: () => crypto.randomUUID(),
      maxRetries: 0,
    };
    // Kyoto has no written day: its city comes signed, as the intake signs it.
    const { signature } = await signCity(await citySignatureKey("test-salt"), LIVELY_KYOTO);
    const request = new Request("http://lantern.test/api/day", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": "203.0.113.7",
        [CITY_SIGNATURE_HEADER]: signature,
      },
      body: JSON.stringify(LIVELY_KYOTO),
    });

    const response = answerDayRequest(request, { deltaChars: 256 }, liveDayOf(deps));
    const id = (await response).headers.get(DAY_ID_HEADER) ?? "";
    const outcome = await readDayStream({
      request: LIVELY_KYOTO,
      response,
      onPartial: () => undefined,
    });
    await Promise.all(scheduled.splice(0).map((task) => task()));

    if (outcome.kind !== "complete") throw new Error(outcome.kind);
    expect(await readStoredDay(id, generationLog, NOW)).toMatchObject({
      status: "written",
      itinerary: outcome.itinerary,
    });
  });
});

describe("GET /api/day/<id>", () => {
  const get = (id: string) =>
    GET(new Request(`http://lantern.test/api/day/${id}`), { params: Promise.resolve({ id }) });

  it("is a 404 only for a string that cannot be an id", async () => {
    expect((await get("not-a-day")).status).toBe(404);
  });

  it("gives the page that opens a day an unknown day, never a failed query, for such a string", async () => {
    expect(await storedDayOf("../not-a-day")).toEqual({ status: "unknown" });
  });

  it("answers a re-plan's round, and none for a live day", async () => {
    const live = dayIdOf(11);
    const replan = dayIdOf(12);
    await logOf(
      storesFor(process.env).generationLog,
      { ...LIVE_RECORD, id: live },
      {
        ...MORNING_RECORD,
        id: replan,
        context: { ...REPLAN_CONTEXT, basis: { kind: "kept", id: live } },
      },
    );

    expect(await (await get(replan)).json()).toMatchObject({
      status: "written",
      round: 1,
      checks: { "stop-2:p": LIVE_RECORD.placeChecks?.["stop-2:p"] },
    });
    expect(await (await get(live)).json()).toMatchObject({ status: "written", round: 0 });
  });

  it("answers a day nobody wrote with a 200 and its status, never cached", async () => {
    const response = await get("0b6d7f2e-4a1c-4e8b-9d3f-5a6b7c8d9e0f");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unknown" });
  });
});
