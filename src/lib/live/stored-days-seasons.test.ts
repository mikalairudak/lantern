// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import type { WrittenSeason } from "@/lib/days/written/seasons";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { InMemoryGenerationLog, type GenerationRecord } from "./generation-log";

// Kanazawa given a second season from Saturday 21 November: the same day, so every place is
// shared, but its run checked the garden, the first stop, and could not confirm it.
vi.mock("@/lib/days/written/start-days", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/days/written/start-days")>();
  const START_SEASONS = actual.START_SEASONS.map((seasons): readonly WrittenSeason[] => {
    const [autumn] = seasons;
    if (autumn?.written.request.city !== "Kanazawa") return seasons;
    const winter: WrittenSeason = {
      from: "2026-11-21",
      through: null,
      written: { ...autumn.written, request: { ...autumn.written.request, date: "2026-11-21" } },
      checks: { ...autumn.checks, "stop-0:p": { kind: "unverified", reason: "too-few-places" } },
    };
    return [{ ...autumn, through: "2026-11-20" }, winter];
  });
  return { ...actual, START_SEASONS };
});

const { writtenDayOn } = await import("@/lib/days/written/days");
const { readStoredDay } = await import("./stored-days");

const NOW = new Date("2026-11-21T12:00:00Z");
const ID = "7a2d4c1e-0000-4000-8000-000000000021";

function basisOn(date: string): Itinerary {
  const basis = writtenDayOn("kanazawa", date, NOW);
  if (basis === null) throw new Error("Kanazawa has a written day");
  return basis.itinerary;
}

/** Kanazawa's dinner moved late, re-planned from its written day as read on a date. */
function replanFrom(itinerary: Itinerary): GenerationRecord {
  const dinner = KANAZAWA_START_DAY.day.stops[6];
  if (dinner === undefined) throw new Error("Kanazawa's day has dinner seventh");
  const replan: GeneratedReplan = {
    stops: [{ ...dinner, startTime: "20:45", durationMinutes: 90 }],
    alternatives: [],
    dek: "Kenroku-en at half past seven, the teahouses, the market, the castle and the museum, then oden at a quarter to nine.",
  };
  return {
    id: ID,
    pairId: null,
    role: "day",
    model: "claude-sonnet-5-5",
    promptVersion: "replan-v1",
    startedAt: "2026-11-21T10:00:00.000Z",
    tokens: { input: 6_000, output: 1_000, thinking: null },
    costUsd: 0.03,
    msToFirstToken: 2_000,
    msToFinish: 20_000,
    finishReason: "stop",
    outcome: "complete",
    salvaged: false,
    placeChecks: null,
    repairs: 0,
    checks: null,
    visitorText: null,
    request: { ...KANAZAWA_START_DAY.request, date: itinerary.date, dinner: "late" },
    outputText: JSON.stringify(replan),
    warnings: [],
    requestId: "req_21",
    error: null,
    context: {
      changed: "dinner",
      round: 1,
      windows: [{ from: 6, to: 7 }],
      itinerary,
      basis: { kind: "written", slug: "kanazawa" },
    },
  };
}

async function checksOfReplanFrom(date: string) {
  const log = new InMemoryGenerationLog();
  await log.record(replanFrom(basisOn(date)));
  const stored = await readStoredDay(ID, log, NOW);
  if (stored.status !== "written") throw new Error(stored.status);
  return stored.checks;
}

describe("a re-plan of a written day in a city of two seasons that share a place", () => {
  it("marks the shared place with the check of the season it was read from", async () => {
    expect((await checksOfReplanFrom("2026-11-14"))["stop-0:p"]).toMatchObject({
      state: "confirmed",
    });
    expect((await checksOfReplanFrom("2026-11-21"))["stop-0:p"]).toEqual({
      placeId: "stop-0:p",
      state: "unconfirmed",
    });
  });
});
