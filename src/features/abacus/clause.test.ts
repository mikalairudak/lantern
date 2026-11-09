import { describe, expect, it } from "vitest";
import type { PlaceKind } from "@/lib/schema/itinerary.schema";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { candidatesOf } from "./curve";
import { changesOf, clauseOf, possibleClauses, type Direction, type StopChange } from "./clause";
import type { StopDraft } from "./day-draft";
import { minutesOf } from "@/lib/time/clock";

const STOPS: readonly StopDraft[] = ABACUS_DAY.stops;
const AT_REST = STOPS.map(() => 0);
const LUNCH = 4;
const PROMENADE = 6;

const MINUTES_PER_DAY = 24 * 60;

/** A change at a clock time; `isPastMidnight` puts it on the running clock's next day. */
function change(
  startTime: string,
  kind: PlaceKind,
  direction: Direction | null,
  isPastMidnight = false,
): StopChange {
  return {
    start: minutesOf(startTime) + (isPastMidnight ? MINUTES_PER_DAY : 0),
    kind,
    direction,
  };
}

/** The candidate index of a place in a stop, by name. */
function indexOf(stop: StopDraft, name: string): number {
  const index = candidatesOf(stop).findIndex((place) => place.name === name);
  if (index === -1) throw new Error(`${name} is not a version of ${stop.id}`);
  return index;
}

function showing(stopIndex: number, name: string): number[] {
  return AT_REST.map((pick, index) =>
    index === stopIndex ? indexOf(STOPS[stopIndex]!, name) : pick,
  );
}

describe("clauseOf", () => {
  it("adds nothing while every stop shows what the model planned", () => {
    expect(clauseOf([])).toBeNull();
    expect(clauseOf([change("09:00", "walk", null), change("14:00", "food", null)])).toBeNull();
  });

  it("names a food stop's meal as its row does: lunch before 15:00, the afternoon's snack before 18:00, dinner from 18:00", () => {
    expect(clauseOf([change("14:00", "food", "livelier")])).toBe("livelier at lunch");
    expect(clauseOf([change("14:59", "food", "quieter")])).toBe("quieter at lunch");
    expect(clauseOf([change("15:00", "food", "quieter")])).toBe("quieter in the afternoon");
    expect(clauseOf([change("17:00", "food", "quieter")])).toBe("quieter in the afternoon");
    expect(clauseOf([change("18:00", "food", "quieter")])).toBe("quieter at dinner");
    expect(clauseOf([change("21:30", "food", "livelier")])).toBe("livelier at dinner");
  });

  it("names any stop past midnight late at night, never the morning", () => {
    expect(clauseOf([change("00:30", "food", "livelier", true)])).toBe("livelier late at night");
    expect(clauseOf([change("01:00", "bar", "quieter", true)])).toBe("quieter late at night");
    expect(clauseOf([change("02:00", "coffee", "quieter", true)])).toBe("quieter late at night");
  });

  it("names a food or coffee stop before 11:00 breakfast, as a slow morning's churros at nine", () => {
    expect(clauseOf([change("09:00", "coffee", "livelier")])).toBe("livelier at breakfast");
    expect(clauseOf([change("10:59", "food", "quieter")])).toBe("quieter at breakfast");
    expect(clauseOf([change("11:00", "food", "quieter")])).toBe("quieter at lunch");
    expect(clauseOf([change("11:00", "coffee", "quieter")])).toBe("quieter in the morning");
  });

  it("names any other stop's part of the day: morning before 12:00, afternoon before 18:00", () => {
    expect(clauseOf([change("07:45", "viewpoint", "livelier")])).toBe("livelier in the morning");
    expect(clauseOf([change("11:59", "market", "quieter")])).toBe("quieter in the morning");
    expect(clauseOf([change("12:00", "museum", "quieter")])).toBe("quieter in the afternoon");
    expect(clauseOf([change("17:59", "walk", "livelier")])).toBe("livelier in the afternoon");
    expect(clauseOf([change("18:00", "bar", "quieter")])).toBe("quieter in the evening");
  });

  it("merges neighbouring stops with the same direction and part of the day", () => {
    const morning = [
      change("08:45", "walk", "livelier"),
      change("09:45", "architecture", "livelier"),
    ];

    expect(clauseOf(morning)).toBe("livelier in the morning");
  });

  it("merges them across a stop that shows the plan, since nothing else comes between", () => {
    const morning = [
      change("07:45", "viewpoint", "livelier"),
      change("08:45", "walk", null),
      change("09:45", "architecture", "livelier"),
    ];

    expect(clauseOf(morning)).toBe("livelier in the morning");
  });

  it("joins two groups with 'and'", () => {
    expect(
      clauseOf([change("09:45", "architecture", "livelier"), change("21:00", "bar", "quieter")]),
    ).toBe("livelier in the morning and quieter in the evening");
  });

  it("says a shared direction or part of the day once when it joins two groups", () => {
    expect(
      clauseOf([change("09:45", "architecture", "livelier"), change("14:00", "food", "livelier")]),
    ).toBe("livelier in the morning and at lunch");
    expect(
      clauseOf([change("08:45", "walk", "quieter"), change("09:45", "architecture", "livelier")]),
    ).toBe("quieter and livelier in the morning");
  });

  it("reads 'in places' for three groups or more, naming the directions in them", () => {
    const parts: readonly [string, PlaceKind][] = [
      ["09:45", "architecture"],
      ["14:00", "food"],
      ["16:15", "museum"],
    ];
    const all = (direction: Direction) =>
      parts.map(([time, kind]) => change(time, kind, direction));

    expect(clauseOf(all("livelier"))).toBe("livelier in places");
    expect(clauseOf(all("quieter"))).toBe("quieter in places");
    expect(
      clauseOf([
        change("09:45", "architecture", "livelier"),
        change("14:00", "food", "quieter"),
        change("16:15", "museum", "livelier"),
      ]),
    ).toBe("quieter and livelier in places");
  });
});

describe("changesOf", () => {
  it("reads each stop's direction against the plan from the versions shown", () => {
    expect(clauseOf(changesOf(STOPS, AT_REST))).toBeNull();
    expect(clauseOf(changesOf(STOPS, showing(LUNCH, "Tapas on San Fernando")))).toBe(
      "livelier at lunch",
    );
    expect(clauseOf(changesOf(STOPS, showing(LUNCH, "Arroz a banda by the port")))).toBe(
      "quieter at lunch",
    );
  });

  it("names the part of the day from the planned place, not the version shown", () => {
    // The promenade at 17:20 is a walk; its livelier version is an ice cream shop.
    expect(clauseOf(changesOf(STOPS, showing(PROMENADE, "Ice cream on the Explanada")))).toBe(
      "livelier in the afternoon",
    );
  });

  it("leaves out a version with the planned energy, which is neither quieter nor livelier", () => {
    const lunch = ABACUS_DAY.stops[LUNCH]!;
    const sameEnergy = { ...lunch.primary, id: `${lunch.id}:same` };
    const stops = STOPS.map((stop, index) =>
      index === LUNCH ? { ...stop, alternatives: [...stop.alternatives, sameEnergy] } : stop,
    );
    const shown = AT_REST.map((pick, index) => (index === LUNCH ? 3 : pick));

    expect(clauseOf(changesOf(stops, shown))).toBeNull();
  });
});

describe("possibleClauses", () => {
  it("lists every clause the day's versions can produce, once each", () => {
    const clauses = possibleClauses(STOPS);

    expect(new Set(clauses).size).toBe(clauses.length);
    expect(clauses).toContain("livelier at lunch");
    expect(clauses).toContain("quieter in the evening");
    expect(clauses).toContain("livelier in the morning and quieter in the evening");
    expect(clauses).toContain("quieter and livelier in places");
  });

  it("leaves out what no version can say", () => {
    const clauses = possibleClauses(STOPS);

    // The last stop is already the liveliest, and no food is planned after 17:00.
    expect(clauses).not.toContain("livelier in the evening");
    expect(clauses.some((clause) => clause.includes("at dinner"))).toBe(false);
  });

  it("has nothing to list for a day without versions", () => {
    expect(possibleClauses(STOPS.map((stop) => ({ ...stop, alternatives: [] })))).toEqual([]);
  });
});
