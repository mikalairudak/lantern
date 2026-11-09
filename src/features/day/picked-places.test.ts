import { describe, expect, it } from "vitest";
import { PICKED_DAYS_KEPT } from "@/lib/browser-storage";
import { modelPicks } from "@/features/abacus/curve";
import { replanForEnergy } from "@/features/abacus/replan";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { keptSeenKeyOf, seenKeyOf } from "./seen-days";
import {
  PICKED_PLACES_KEY,
  departuresOf,
  forgetKeptPicks,
  keepPickedPlaces,
  picksWithin,
  readPickedPlaces,
} from "./picked-places";
import type { DayStorage } from "./your-days";

/** A browser's storage held in a map. */
function memoryStorage(): DayStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

/** A storage that throws on every call, as a blocked one does. */
const BLOCKED: DayStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

/** A stop as the picks read it: its id, its versions' ids, and the one it was written with. */
function stopOf(id: string, places: readonly string[], selected = places[0]!) {
  const [primary, ...alternatives] = places.map((place) => ({ id: place }));
  return { id, primary: primary!, alternatives, selectedPlaceId: selected };
}

const MORNING = stopOf("s1", ["s1:p", "s1:a1", "s1:a2"]);
const LUNCH = stopOf("s2", ["s2:p", "s2:a1"]);
const WALK = stopOf("s3", ["s3:p"]);
const DAY = [MORNING, LUNCH, WALK];

const KYOTO = seenKeyOf("kyoto", "0123456789abcdef");

describe("the places picked on a day", () => {
  it("keeps a day's places by its key and reads them back", () => {
    const storage = memoryStorage();
    keepPickedPlaces(storage, KYOTO, { s1: "s1:a2" });
    keepPickedPlaces(storage, keptSeenKeyOf("a-day"), { s2: "s2:a1" });

    expect(readPickedPlaces(storage, KYOTO)).toEqual({ s1: "s1:a2" });
    expect(readPickedPlaces(storage, keptSeenKeyOf("a-day"))).toEqual({ s2: "s2:a1" });
  });

  it("reads none for the same day in another version, as a later build writes it", () => {
    const storage = memoryStorage();
    keepPickedPlaces(storage, KYOTO, { s1: "s1:a2" });

    expect(readPickedPlaces(storage, seenKeyOf("kyoto", "fedcba9876543210"))).toEqual({});
  });

  it("keeps the day changed last first, and lets the oldest go past the limit", () => {
    const storage = memoryStorage();
    for (let day = 0; day <= PICKED_DAYS_KEPT; day += 1) {
      keepPickedPlaces(storage, keptSeenKeyOf(`day-${day}`), { s1: "s1:a1" });
    }
    keepPickedPlaces(storage, keptSeenKeyOf("day-1"), { s1: "s1:a2" });

    const kept = JSON.parse(storage.items.get(PICKED_PLACES_KEY)!) as { day: string }[];
    expect(kept).toHaveLength(PICKED_DAYS_KEPT);
    expect(kept[0]?.day).toBe(keptSeenKeyOf("day-1"));
    expect(readPickedPlaces(storage, keptSeenKeyOf("day-0"))).toEqual({});
    expect(readPickedPlaces(storage, keptSeenKeyOf(`day-${PICKED_DAYS_KEPT}`))).toEqual({
      s1: "s1:a1",
    });
  });

  it("lets a day go once it shows its written places again, and the key with the last one", () => {
    const storage = memoryStorage();
    keepPickedPlaces(storage, KYOTO, { s1: "s1:a2" });
    keepPickedPlaces(storage, keptSeenKeyOf("a-day"), { s2: "s2:a1" });

    keepPickedPlaces(storage, KYOTO, {});
    expect(readPickedPlaces(storage, KYOTO)).toEqual({});
    expect(readPickedPlaces(storage, keptSeenKeyOf("a-day"))).toEqual({ s2: "s2:a1" });

    keepPickedPlaces(storage, keptSeenKeyOf("a-day"), {});
    expect(storage.items.has(PICKED_PLACES_KEY)).toBe(false);
  });

  it("reads a list another version wrote, or one edited by hand, as none", () => {
    const storage = memoryStorage();
    for (const kept of ["not json", "{}", '[{"day":"kyoto"}]', '[{"day":1,"places":{}}]']) {
      storage.items.set(PICKED_PLACES_KEY, kept);
      expect(readPickedPlaces(storage, KYOTO)).toEqual({});
    }
    // Written over, rather than kept beside what it could not read.
    keepPickedPlaces(storage, KYOTO, { s1: "s1:a1" });
    expect(readPickedPlaces(storage, KYOTO)).toEqual({ s1: "s1:a1" });
  });

  it("keeps nothing and breaks nothing without storage", () => {
    expect(() => keepPickedPlaces(BLOCKED, KYOTO, { s1: "s1:a1" })).not.toThrow();
    expect(() => keepPickedPlaces(null, KYOTO, { s1: "s1:a1" })).not.toThrow();
    expect(readPickedPlaces(BLOCKED, KYOTO)).toEqual({});
    expect(readPickedPlaces(null, KYOTO)).toEqual({});
  });
});

describe("forgetKeptPicks", () => {
  it("forgets the places chosen on every kept day, and keeps those on written days", () => {
    const storage = memoryStorage();
    keepPickedPlaces(storage, keptSeenKeyOf("mine"), { s1: "s1:a1" });
    keepPickedPlaces(storage, KYOTO, { s1: "s1:a2" });
    keepPickedPlaces(storage, keptSeenKeyOf("from-a-link"), { s2: "s2:a1" });

    forgetKeptPicks(storage);

    expect(readPickedPlaces(storage, keptSeenKeyOf("mine"))).toEqual({});
    expect(readPickedPlaces(storage, keptSeenKeyOf("from-a-link"))).toEqual({});
    expect(readPickedPlaces(storage, KYOTO)).toEqual({ s1: "s1:a2" });
  });

  it("lets the key go once nothing is left, and breaks nothing without storage", () => {
    const storage = memoryStorage();
    keepPickedPlaces(storage, keptSeenKeyOf("mine"), { s1: "s1:a1" });
    forgetKeptPicks(storage);
    expect(storage.items.has(PICKED_PLACES_KEY)).toBe(false);

    expect(() => forgetKeptPicks(BLOCKED)).not.toThrow();
    expect(() => forgetKeptPicks(null)).not.toThrow();
  });
});

describe("departuresOf", () => {
  it("names the stops that show another place than the one written, by its id", () => {
    expect(departuresOf(DAY, DAY, [2, 0, 0])).toEqual({ s1: "s1:a2" });
    expect(departuresOf(DAY, DAY, [0, 0, 0])).toEqual({});
  });

  it("counts an energy picked again against the day as written, so its places are kept", () => {
    const written = ABACUS_DAY.stops;
    const lively = replanForEnergy(written, 1, 4);
    const moved = lively.filter(
      (stop, index) => stop.selectedPlaceId !== written[index]!.selectedPlaceId,
    );
    expect(moved.length).toBeGreaterThan(0);

    // The re-picked day shows its new plan, nothing chosen on it: every move is kept.
    expect(departuresOf(written, lively, modelPicks(lively))).toEqual(
      Object.fromEntries(moved.map((stop) => [stop.id, stop.selectedPlaceId])),
    );
  });

  it("leaves out a stop the written day does not have, and one not yet let in", () => {
    expect(departuresOf([MORNING], DAY, [1, 1])).toEqual({ s1: "s1:a1" });
    expect(departuresOf(DAY, [LUNCH], [1])).toEqual({ s2: "s2:a1" });
  });
});

describe("picksWithin", () => {
  it("keeps a place that is one of its stop's versions", () => {
    expect(picksWithin(DAY, { s1: "s1:a2", s2: "s2:a1" })).toEqual({
      s1: "s1:a2",
      s2: "s2:a1",
    });
  });

  it("lets go a stop the day no longer has, a place none of its versions, and its written one", () => {
    expect(
      picksWithin(DAY, {
        gone: "gone:a1",
        s1: "s2:a1",
        s2: "s2:p",
        s3: "s3:a1",
      }),
    ).toEqual({});
  });

  it("reads only the places kept, never the list's own properties", () => {
    const named = stopOf("constructor", ["c:p", "c:a1"]);
    expect(picksWithin([named], {})).toEqual({});
  });

  it("reads a stop written with another of its versions against that one", () => {
    const written = [stopOf("s1", ["s1:p", "s1:a1"], "s1:a1")];
    expect(picksWithin(written, { s1: "s1:p" })).toEqual({ s1: "s1:p" });
    expect(picksWithin(written, { s1: "s1:a1" })).toEqual({});
  });
});
