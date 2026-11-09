import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import {
  MAX_KEPT_TEXT_CHARS,
  MAX_REPLAN_BODY_BYTES,
  MAX_REPLAN_ROUND,
  MAX_REPLAN_STOPS,
  picksIssueOf,
  picksOf,
  ReplanRequestSchema,
  replanBoundsIssueOf,
  requestMismatchOf,
  withPicks,
} from "./request";

const normalized = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
if (!normalized.ok) throw new Error("The written Kyoto day normalizes");
const KYOTO = normalized.itinerary;

const DAY_ID = "0b6d7f2e-4a1c-4e8b-9d3f-5a6b7c8d9e0f";

const VALID = {
  basis: { kind: "written", slug: "kyoto" },
  request: { ...KYOTO_DAY.request, start: "slow" as const },
  changed: "start" as const,
  round: 1,
};

function issuesOf(body: unknown): string[] {
  const parsed = ReplanRequestSchema.safeParse(body);
  return parsed.success ? [] : parsed.error.issues.map(({ message }) => message);
}

function withFirstPlace(change: Partial<Itinerary["stops"][number]["primary"]>): Itinerary {
  return {
    ...KYOTO,
    stops: KYOTO.stops.map((stop, index) =>
      index === 0 ? { ...stop, primary: { ...stop.primary, ...change } } : stop,
    ),
  };
}

describe("ReplanRequestSchema", () => {
  it("takes a written day by its address, or a kept day by its id, with the changed request", () => {
    expect(issuesOf(VALID)).toEqual([]);
    expect(issuesOf({ ...VALID, basis: { kind: "kept", id: DAY_ID } })).toEqual([]);
  });

  it("takes no day from the page, only the name of one the server holds", () => {
    expect(issuesOf({ ...VALID, itinerary: KYOTO })).not.toEqual([]);
    expect(issuesOf({ ...VALID, basis: { kind: "kept", id: "not-an-id" } })).toContain(
      "A kept day's id",
    );
    expect(issuesOf({ ...VALID, basis: { kind: "written", slug: "Kyoto day" } })).toContain(
      "A written day's address",
    );
  });

  it("refuses a changed word without a value, which the merge could not make the visitor's", () => {
    expect(issuesOf({ ...VALID, request: { ...VALID.request, start: null } })).toContain(
      "The changed word needs a value",
    );
  });

  it("refuses the energy word, which re-picks among the versions with no call", () => {
    expect(issuesOf({ ...VALID, changed: "energy" })).not.toEqual([]);
  });

  it("bounds the round", () => {
    expect(issuesOf({ ...VALID, round: MAX_REPLAN_ROUND + 1 })).not.toEqual([]);
    expect(issuesOf({ ...VALID, round: 0 })).not.toEqual([]);
  });

  it("takes picks as ids alone, a stop's for each stop at most, and none from a page that sends none", () => {
    expect(ReplanRequestSchema.parse(VALID).picks).toEqual({});
    expect(issuesOf({ ...VALID, picks: { "r12-stop-3": "r12-stop-3:a2" } })).toEqual([]);
    expect(issuesOf({ ...VALID, picks: { "stop-2": "Murin-an's garden" } })).toContain(
      "A stop's or a place's id",
    );
    expect(issuesOf({ ...VALID, picks: { "stop-2": "x".repeat(33) } })).not.toEqual([]);
    expect(issuesOf({ ...VALID, picks: { "stop-2": 2 } })).not.toEqual([]);
    const tooMany = Object.fromEntries(
      Array.from({ length: MAX_REPLAN_STOPS + 1 }, (_, at) => [`stop-${at}`, `stop-${at}:p`]),
    );
    expect(issuesOf({ ...VALID, picks: tooMany })).toContain(
      `A pick for each stop at most, ${MAX_REPLAN_STOPS}`,
    );
  });

  it("fits a pick for each of the most stops, at the longest ids a page can hold, in the body", () => {
    const id = `r${MAX_REPLAN_ROUND}-stop-${MAX_REPLAN_STOPS - 1}`;
    const picks = Object.fromEntries(
      Array.from({ length: MAX_REPLAN_STOPS }, (_, at) => [`${id}${at}`.slice(0, 32), `${id}:a2`]),
    );
    const body = { ...VALID, basis: { kind: "kept", id: DAY_ID }, picks };

    expect(issuesOf(body)).toEqual([]);
    expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeLessThan(
      MAX_REPLAN_BODY_BYTES,
    );
  });
});

describe("the visitor's picks", () => {
  const garden = KYOTO.stops[2];
  const option = garden?.alternatives[0];
  if (garden === undefined || option === undefined) throw new Error("Kyoto's garden has options");

  it("are the places a page shows that its day does not plan", () => {
    const shown = Object.fromEntries(KYOTO.stops.map((stop) => [stop.id, stop.selectedPlaceId]));

    expect(picksOf(KYOTO, shown)).toEqual({});
    expect(picksOf(KYOTO, { ...shown, [garden.id]: option.id })).toEqual({
      [garden.id]: option.id,
    });
  });

  it("are read against the server's day: a stop it holds, and one of that stop's own places", () => {
    expect(picksIssueOf(KYOTO, { [garden.id]: option.id })).toBeNull();
    expect(picksIssueOf(KYOTO, { [garden.id]: garden.primary.id })).toBeNull();
    expect(picksIssueOf(KYOTO, { "stop-99": "stop-99:p" })).toBe("The day holds no stop stop-99");
    expect(picksIssueOf(KYOTO, { [garden.id]: KYOTO.stops[3]?.primary.id ?? "" })).toMatch(
      /is not one of stop-\d+'s places/,
    );
  });

  it("plan each picked stop on its place, the places and every other stop as they were", () => {
    const shown = withPicks(KYOTO, { [garden.id]: option.id });

    expect(shown.stops[2]).toEqual({ ...garden, selectedPlaceId: option.id });
    expect(shown.stops[2]?.alternatives).toBe(garden.alternatives);
    for (const [index, stop] of shown.stops.entries()) {
      if (index !== 2) expect(stop).toBe(KYOTO.stops[index]);
    }
    expect(withPicks(KYOTO, {})).toBe(KYOTO);
  });
});

describe("requestMismatchOf", () => {
  it("takes a request whose words differ from the day's, in its city, date and zone", () => {
    expect(requestMismatchOf(VALID.request, KYOTO_DAY.request)).toBeNull();
  });

  it("refuses another city, date or zone than the day was written for", () => {
    const osaka = { ...VALID.request, city: "Osaka" };
    const later = { ...VALID.request, date: "2027-01-01", timezone: "Asia/Seoul" };

    expect(requestMismatchOf(osaka, KYOTO_DAY.request)).toMatch(/\(city\)$/);
    expect(requestMismatchOf(later, KYOTO_DAY.request)).toMatch(/\(date, timezone\)$/);
  });
});

describe("replanBoundsIssueOf", () => {
  it("takes a day the model wrote", () => {
    expect(replanBoundsIssueOf(KYOTO)).toBeNull();
  });

  it("bounds the stops and every name and neighbourhood the prompt carries", () => {
    const first = KYOTO.stops[0];
    if (first === undefined) throw new Error("Kyoto has a first stop");
    const many = { ...KYOTO, stops: Array.from({ length: MAX_REPLAN_STOPS + 1 }, () => first) };
    const long = "a".repeat(MAX_KEPT_TEXT_CHARS + 1);
    const bound = `A place's name or neighbourhood is at most ${MAX_KEPT_TEXT_CHARS} characters`;

    expect(replanBoundsIssueOf(many)).toBe(
      `A day re-planned holds at most ${MAX_REPLAN_STOPS} stops`,
    );
    expect(replanBoundsIssueOf(withFirstPlace({ name: long }))).toBe(bound);
    expect(replanBoundsIssueOf(withFirstPlace({ neighborhood: long }))).toBe(bound);
  });
});
