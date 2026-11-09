import { describe, expect, it } from "vitest";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import {
  ALTERNATIVES_PER_STOP,
  MAX_STOP_MINUTES,
  type GeneratedDay,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import { minutesOf } from "@/lib/time/clock";
import { keptAsWrittenOf, normalizeDay, type Repair, type RepairKind } from "./normalize";

// Roughly 2.2 km of latitude: far outside a ten-minute swap walk.
const FAR_LATITUDE_STEP = 0.02;

/** A fresh copy of the hero day to break one thing in. */
function kyotoDay(): GeneratedDay {
  return structuredClone(KYOTO_DAY.day);
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Nothing at index ${index}`);
  return item;
}

function normalized(day: GeneratedDay): { itinerary: Itinerary; repairs: Repair[] } {
  const result = normalizeDay(KYOTO_DAY.request, day);
  if (!result.ok) throw new Error(`Refused: ${result.reason}`);
  return result;
}

function kindsOf(repairs: readonly Repair[]): RepairKind[] {
  return repairs.map((repair) => repair.kind);
}

/** The first stop whose set holds a quieter and a livelier option. */
function stopWithPair(day: GeneratedDay): number {
  const set = day.alternatives.find((each) => each.options.length === ALTERNATIVES_PER_STOP);
  if (!set) throw new Error("No stop with two options");
  return set.stopIndex;
}

describe.each(CURATED_DAYS)("the curated day in $request.city", ({ request, day }) => {
  const result = normalizeDay(request, day);

  it("normalizes without a single repair", () => {
    expect(result).toMatchObject({ ok: true, repairs: [] });
  });

  it("keeps every stop and option, in order, with the primary shown", () => {
    if (!result.ok) throw new Error(result.reason);
    const { itinerary } = result;
    expect(itinerary).toMatchObject({
      dek: day.dek,
      city: request.city,
      date: request.date,
      timezone: request.timezone,
    });
    expect(itinerary.stops.map((stop) => stop.primary.name)).toEqual(
      day.stops.map((stop) => stop.place.name),
    );
    itinerary.stops.forEach((stop, index) => {
      expect(stop.selectedPlaceId).toBe(stop.primary.id);
      expect(stop.alternatives.map((option) => option.name)).toEqual(
        at(day.alternatives, index).options.map((option) => option.name),
      );
    });
  });
});

// A card keyed by its index while the day streamed must keep its key once the day is
// complete, so ids name positions in the generation, not in the itinerary.
describe("ids", () => {
  it("follow positions in the generation and are unique across the day", () => {
    const { itinerary } = normalized(kyotoDay());
    const first = at(itinerary.stops, 0);
    expect(first.id).toBe("stop-0");
    expect(first.primary.id).toBe("stop-0:p");
    expect(first.alternatives.map((option) => option.id)).toEqual(
      first.alternatives.map((_, k) => `stop-0:a${k + 1}`),
    );
  });

  it("stay with their stop when a stop before it is dropped", () => {
    const day = kyotoDay();
    at(day.stops, 2).startTime = at(day.stops, 1).startTime;

    const { itinerary } = normalized(day);

    expect(itinerary.stops.map((stop) => stop.id)).toEqual(
      day.stops.map((_, index) => `stop-${index}`).filter((id) => id !== "stop-2"),
    );
  });

  it("stay with their option when a pair is sorted", () => {
    const day = kyotoDay();
    const stopIndex = stopWithPair(day);
    const options = at(day.alternatives, stopIndex).options.reverse();

    const { itinerary } = normalized(day);

    expect(at(itinerary.stops, stopIndex).alternatives).toMatchObject([
      { id: `stop-${stopIndex}:a2`, name: at(options, 1).name },
      { id: `stop-${stopIndex}:a1`, name: at(options, 0).name },
    ]);
  });

  it("stay with their option when the one before it is dropped", () => {
    const day = kyotoDay();
    const stopIndex = stopWithPair(day);
    const options = at(day.alternatives, stopIndex).options;
    at(options, 0).coordinates.lat += FAR_LATITUDE_STEP;

    const { itinerary } = normalized(day);

    expect(at(itinerary.stops, stopIndex).alternatives).toMatchObject([
      { id: `stop-${stopIndex}:a2`, name: at(options, 1).name },
    ]);
  });
});

describe("repairs", () => {
  it("trims space and invisible characters around text", () => {
    const day = kyotoDay();
    const name = at(day.stops, 0).place.name;
    at(day.stops, 0).place.name = `  ${name}​ `;

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).primary.name).toBe(name);
    expect(repairs).toEqual([
      expect.objectContaining({ kind: "trimmed-text", path: ["stops", 0, "place", "name"] }),
    ]);
  });

  it.each([
    ["7:30", "07:30"],
    ["07:30:00", "07:30"],
  ])("writes the start time %s as %s", (written, expected) => {
    const day = kyotoDay();
    at(day.stops, 0).startTime = written;

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).startTime).toBe(expected);
    expect(kindsOf(repairs)).toEqual(["reformatted-time"]);
  });

  it("rounds a duration to whole minutes", () => {
    const day = kyotoDay();
    at(day.stops, 0).durationMinutes = 42.5;

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).durationMinutes).toBe(43);
    expect(kindsOf(repairs)).toEqual(["rounded-duration"]);
  });

  it(`clamps a stay longer than ${MAX_STOP_MINUTES} minutes`, () => {
    const day = kyotoDay();
    const last = day.stops.length - 1;
    at(day.stops, last).durationMinutes = 600;
    // A stay that long runs past midnight, the end the day then keeps.
    day.assumptions.end = "late";

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, last).durationMinutes).toBe(MAX_STOP_MINUTES);
    expect(kindsOf(repairs)).toEqual(["clamped-duration"]);
  });

  it("cuts a stop short where the next one starts", () => {
    const day = kyotoDay();
    const gap = minutesOf(at(day.stops, 1).startTime) - minutesOf(at(day.stops, 0).startTime);
    at(day.stops, 0).durationMinutes = gap + 30;

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).durationMinutes).toBe(gap);
    expect(repairs).toEqual([
      expect.objectContaining({ kind: "shortened-overlap", path: ["stops", 0, "durationMinutes"] }),
    ]);
  });

  it("drops a stop that starts no later than the one before it, with its options", () => {
    const day = kyotoDay();
    const out = at(day.stops, 2);
    out.startTime = at(day.stops, 1).startTime;

    const { itinerary, repairs } = normalized(day);

    expect(itinerary.stops).toHaveLength(day.stops.length - 1);
    expect(itinerary.stops.map((stop) => stop.primary.name)).not.toContain(out.place.name);
    expect(at(itinerary.stops, 2)).toMatchObject({
      id: "stop-3",
      primary: { name: at(day.stops, 3).place.name },
    });
    expect(repairs).toEqual([
      expect.objectContaining({ kind: "dropped-stop", path: ["stops", 2] }),
    ]);
  });

  it.each<[string, (day: GeneratedDay) => void]>([
    ["a start time that is not a time", (day) => (at(day.stops, 1).startTime = "25:99")],
    ["a stay of no minutes", (day) => (at(day.stops, 1).durationMinutes = 0)],
    ["a blank summary", (day) => (at(day.stops, 1).place.summary = " ​")],
    ["coordinates off the map", (day) => (at(day.stops, 1).place.coordinates.lat = 135)],
    ["no aesthetic tags", (day) => (at(day.stops, 1).place.aesthetic = [" ", ""])],
  ])("drops a stop with %s", (_name, breakDay) => {
    const day = kyotoDay();
    breakDay(day);

    const { itinerary, repairs } = normalized(day);

    expect(itinerary.stops).toHaveLength(day.stops.length - 1);
    expect(repairs).toContainEqual(
      expect.objectContaining({ kind: "dropped-stop", path: ["stops", 1] }),
    );
  });

  it("keeps the first three tags, trimmed", () => {
    const day = kyotoDay();
    at(day.stops, 0).place.aesthetic = [" moss ", "", "raw timber", "gravel", "paper screens"];

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).primary.aesthetic).toEqual(["moss", "raw timber", "gravel"]);
    expect(kindsOf(repairs)).toEqual(["trimmed-tags"]);
  });
});

describe("a place's light", () => {
  it("reads the model's none as no direction and no best window, with no repair", () => {
    const day = kyotoDay();
    at(day.stops, 0).place.light = {
      ...at(day.stops, 0).place.light,
      orientation: "none",
      bestWindow: "none",
    };
    at(day.stops, 1).place.light = {
      ...at(day.stops, 1).place.light,
      orientation: "se",
      bestWindow: "sunset",
    };

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).primary.light).toMatchObject({
      orientation: null,
      bestWindow: null,
    });
    expect(at(itinerary.stops, 1).primary.light).toMatchObject({
      orientation: "se",
      bestWindow: "sunset",
    });
    expect(repairs).toEqual([]);
  });
});

describe("stops after midnight", () => {
  it("keep their clock time, in order and without a repair", () => {
    const day = kyotoDay();
    const last = day.stops.length - 1;
    at(day.stops, last - 1).startTime = "22:30";
    at(day.stops, last - 1).durationMinutes = 90;
    at(day.stops, last).startTime = "00:15";
    day.assumptions.end = "late";

    const { itinerary, repairs } = normalized(day);

    expect(itinerary.stops.slice(-2).map((stop) => stop.startTime)).toEqual(["22:30", "00:15"]);
    expect(repairs).toEqual([]);
  });

  it("cut a stop that runs through midnight short where the next one starts", () => {
    const day = kyotoDay();
    const last = day.stops.length - 1;
    at(day.stops, last - 1).startTime = "23:00";
    at(day.stops, last - 1).durationMinutes = 120;
    at(day.stops, last).startTime = "00:30";
    day.assumptions.end = "late";

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, last - 1).durationMinutes).toBe(90);
    expect(repairs).toEqual([
      expect.objectContaining({
        kind: "shortened-overlap",
        path: ["stops", last - 1, "durationMinutes"],
      }),
    ]);
  });

  it("are out of order after a day that ended in the afternoon", () => {
    const day = kyotoDay();
    const last = day.stops.length - 1;
    at(day.stops, last - 1).startTime = "16:00";
    at(day.stops, last - 1).durationMinutes = 60;
    at(day.stops, last).startTime = "00:30";

    const { itinerary, repairs } = normalized(day);

    expect(itinerary.stops).toHaveLength(day.stops.length - 1);
    expect(repairs).toEqual([
      expect.objectContaining({
        kind: "dropped-stop",
        path: ["stops", last],
        note: "it starts at 00:30, no later than the stop before it",
      }),
    ]);
  });
});

describe("alternatives", () => {
  it("puts a reversed pair quieter first", () => {
    const day = kyotoDay();
    const stopIndex = stopWithPair(day);
    const set = at(day.alternatives, stopIndex);
    set.options.reverse();

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, stopIndex).alternatives.map((option) => option.name)).toEqual(
      [...set.options].reverse().map((option) => option.name),
    );
    expect(repairs).toEqual([
      expect.objectContaining({
        kind: "sorted-alternatives",
        path: ["alternatives", stopIndex, "options"],
      }),
    ]);
  });

  it("drops an option beyond a short walk from its stop", () => {
    const day = kyotoDay();
    const option = at(at(day.alternatives, 0).options, 0);
    option.coordinates.lat += FAR_LATITUDE_STEP;

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).alternatives.map((each) => each.name)).not.toContain(option.name);
    expect(repairs).toEqual([
      expect.objectContaining({
        kind: "dropped-alternative",
        path: ["alternatives", 0, "options", 0],
      }),
    ]);
  });

  it("drops an option that names another stop of the day, whatever its spelling", () => {
    const day = kyotoDay();
    const later = at(day.stops, 2);
    const option = at(at(day.alternatives, 0).options, 0);
    option.name = later.place.name.toUpperCase();

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).alternatives.map((each) => each.name)).not.toContain(option.name);
    expect(repairs).toEqual([
      {
        kind: "dropped-repeat",
        path: ["alternatives", 0, "options", 0],
        note: `${option.name} is the day's stop at ${later.startTime}`,
      },
    ]);
  });

  it("drops an option it cannot show", () => {
    const day = kyotoDay();
    at(at(day.alternatives, 0).options, 0).sensory.texture = "";

    const { repairs } = normalized(day);

    expect(kindsOf(repairs)).toEqual(["dropped-alternative"]);
  });

  it("drops an option without a reason", () => {
    const day = kyotoDay();
    at(at(day.alternatives, 0).options, 0).reason = "  ";

    const { repairs } = normalized(day);

    expect(kindsOf(repairs)).toEqual(["dropped-alternative"]);
  });

  it(`keeps the first ${ALTERNATIVES_PER_STOP} options of a longer list`, () => {
    const day = kyotoDay();
    const stopIndex = stopWithPair(day);
    const set = at(day.alternatives, stopIndex);
    set.options.push(structuredClone(at(set.options, 0)));

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, stopIndex).alternatives).toHaveLength(ALTERNATIVES_PER_STOP);
    expect(kindsOf(repairs)).toEqual(["dropped-alternative"]);
  });

  it.each<[string, number]>([
    ["a stop past the last one", 99],
    ["a stop index that is not whole", 1.5],
    ["a stop that already has a set", 0],
  ])("drops a set for %s", (_name, stopIndex) => {
    const day = kyotoDay();
    day.alternatives.push({ ...structuredClone(at(day.alternatives, 1)), stopIndex });

    const { itinerary, repairs } = normalized(day);

    expect(repairs).toEqual([
      expect.objectContaining({
        kind: "dropped-alternatives",
        path: ["alternatives", day.alternatives.length - 1],
      }),
    ]);
    expect(at(itinerary.stops, 0).alternatives.map((option) => option.name)).toEqual(
      at(KYOTO_DAY.day.alternatives, 0).options.map((option) => option.name),
    );
  });

  it("leaves a stop without a set with no alternatives", () => {
    const day = kyotoDay();
    day.alternatives = day.alternatives.filter((set) => set.stopIndex !== 0);

    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).alternatives).toEqual([]);
    expect(repairs).toEqual([]);
  });
});

describe("the request's words", () => {
  it("say what the visitor chose, what the model assumed and the one word it asks", () => {
    const { itinerary } = normalized(kyotoDay());

    expect(itinerary.facts).toEqual({
      energy: { value: "calm", source: "chosen" },
      travel: { value: "on-foot", source: "assumed" },
      start: { value: "early", source: "assumed" },
      dinner: { value: "early", source: "assumed" },
      end: { value: "evening", source: "assumed" },
      company: { value: null, source: "asked" },
    });
  });

  it("say an end Lantern assumed as the one the day's hours keep, and list it as tidying", () => {
    // Kyoto's last stop ends at 19:30, home by eight; assumed home by eleven, it said an hour
    // three and a half hours past its end.
    const day = kyotoDay();
    day.assumptions.end = "early";

    const { itinerary, repairs } = normalized(day);

    expect(itinerary.facts.end).toEqual({ value: "evening", source: "assumed" });
    expect(repairs).toEqual([
      expect.objectContaining({ kind: "fitted-end", path: ["assumptions", "end"] }),
    ]);
  });

  it("never promise home by eight for a day that runs past it", () => {
    const day = kyotoDay();
    at(day.stops, day.stops.length - 1).startTime = "20:15";

    const { itinerary } = normalized(day);

    expect(itinerary.facts.end).toEqual({ value: "early", source: "assumed" });
  });

  it("say out late for a day Lantern assumed home by eleven that runs past it", () => {
    const day = kyotoDay();
    at(day.stops, day.stops.length - 1).startTime = "23:20";

    const { itinerary } = normalized(day);

    expect(itinerary.facts.end).toEqual({ value: "late", source: "assumed" });
  });

  it("keep the visitor's own end, and the one Lantern asks about, whatever the hours", () => {
    const chosen = normalizeDay({ ...KYOTO_DAY.request, end: "late" }, kyotoDay());
    const day = kyotoDay();
    day.assumptions.end = null;
    const asked = normalizeDay(KYOTO_DAY.request, day);

    expect(chosen.ok && chosen.itinerary.facts.end).toEqual({ value: "late", source: "chosen" });
    expect(asked.ok && asked.itinerary.facts.end).toEqual({ value: null, source: "asked" });
  });

  it("take the energy word's source from the request, the intake's when it assumed one", () => {
    const result = normalizeDay({ ...KYOTO_DAY.request, energySource: "assumed" }, kyotoDay());
    if (!result.ok) throw new Error(result.reason);

    expect(result.itinerary.facts.energy).toEqual({ value: "calm", source: "assumed" });
  });

  it("keep the visitor's word over an assumption that contradicts it, and say so", () => {
    const day = kyotoDay();
    day.assumptions.company = "friends";
    const result = normalizeDay({ ...KYOTO_DAY.request, company: "family" }, day);
    if (!result.ok) throw new Error(result.reason);

    expect(result.itinerary.facts.company).toEqual({ value: "family", source: "chosen" });
    expect(result.repairs).toEqual([
      {
        kind: "kept-choice",
        path: ["assumptions", "company"],
        note: 'kept the visitor\'s "family" over the assumed "friends"',
      },
    ]);
  });

  it("take an assumption that only repeats the visitor's word without a repair", () => {
    const day = kyotoDay();
    day.assumptions.travel = "transit";
    const result = normalizeDay({ ...KYOTO_DAY.request, travel: "transit" }, day);

    expect(result).toMatchObject({ ok: true, repairs: [] });
  });

  it("list what a stop depends on with the energy word first, each word once", () => {
    const day = kyotoDay();
    at(day.stops, 0).dependsOn = ["start", "travel", "start"];
    const { itinerary, repairs } = normalized(day);

    expect(at(itinerary.stops, 0).dependsOn).toEqual(["energy", "travel", "start"]);
    expect(at(itinerary.stops, 2).dependsOn).toEqual(["energy"]);
    expect(at(itinerary.stops, 7).dependsOn).toEqual(["energy", "dinner", "end", "company"]);
    expect(repairs).toEqual([
      {
        kind: "deduplicated-dependencies",
        path: ["stops", 0, "dependsOn"],
        note: 'kept ["start","travel"]',
      },
    ]);
  });
});

describe("refusals", () => {
  it("refuses a day without a line about it", () => {
    const day = kyotoDay();
    day.dek = "​";

    expect(normalizeDay(KYOTO_DAY.request, day)).toMatchObject({
      ok: false,
      reason: "the line about the day is blank",
    });
  });

  it("refuses a day with no stop it can show, and says why each went", () => {
    const day = kyotoDay();
    for (const stop of day.stops) stop.startTime = "noon";

    const result = normalizeDay(KYOTO_DAY.request, day);

    expect(result).toMatchObject({ ok: false, reason: "no stop could be shown" });
    expect(kindsOf(result.repairs)).toEqual(day.stops.map(() => "dropped-stop"));
  });
});

describe("the request", () => {
  // The request is parsed where it comes in; one that was not is the caller's bug.
  it("throws when it was never checked", () => {
    expect(() => normalizeDay({ ...KYOTO_DAY.request, city: " " }, kyotoDay())).toThrow(
      /invalid itinerary/,
    );
  });
});

describe("a day broken in many ways at once", () => {
  it("still comes out as an itinerary the app layer accepts", () => {
    const day = kyotoDay();
    at(day.stops, 0).startTime = "7:30";
    at(day.stops, 0).durationMinutes = 2000.4;
    at(day.stops, 1).place.name = " ​ ";
    at(day.stops, 3).place.aesthetic = ["", " a ", "b", "c", "d"];
    at(day.alternatives, 2).options.reverse();
    day.alternatives.push({ stopIndex: -1, options: [] });

    const { itinerary, repairs } = normalized(day);

    expect(itinerary.stops.length).toBe(day.stops.length - 1);
    expect(new Set(kindsOf(repairs))).toEqual(
      new Set<RepairKind>([
        "reformatted-time",
        "rounded-duration",
        "clamped-duration",
        "shortened-overlap",
        "dropped-stop",
        "trimmed-tags",
        "sorted-alternatives",
        "dropped-alternatives",
      ]),
    );
  });
});

describe("keptAsWrittenOf, as a day streams", () => {
  const firstTwo = (day: GeneratedDay) => day.stops.slice(0, 2);
  const startOf = (day: GeneratedDay, index: number) => at(day.stops, index).startTime;

  it("keeps every stop of a day written cleanly, the next stop's start known", () => {
    const day = kyotoDay();
    expect(keptAsWrittenOf(firstTwo(day), startOf(day, 2))).toEqual([true, true]);
  });

  it("does not keep a stop the next one cuts short", () => {
    const day = kyotoDay();
    const gap = minutesOf(startOf(day, 2)) - minutesOf(startOf(day, 1));
    at(day.stops, 1).durationMinutes = gap + 30;

    expect(keptAsWrittenOf(firstTwo(day), startOf(day, 2))).toEqual([true, false]);
  });

  it("does not keep a stop it clamps or trims", () => {
    const day = kyotoDay();
    at(day.stops, 0).durationMinutes = MAX_STOP_MINUTES + 30;
    at(day.stops, 1).place.name = ` ${at(day.stops, 1).place.name}`;

    expect(keptAsWrittenOf(firstTwo(day), startOf(day, 2))).toEqual([false, false]);
  });

  it("does not keep a stop it drops", () => {
    const day = kyotoDay();
    at(day.stops, 1).place.sensory.texture = " ";

    expect(keptAsWrittenOf(firstTwo(day), startOf(day, 2))).toEqual([true, false]);
  });

  it("does not yet keep the stop before an out-of-order next stop", () => {
    // What ends the second stop is still to come: the next start is no later than its own.
    const day = kyotoDay();
    expect(keptAsWrittenOf(firstTwo(day), startOf(day, 1))).toEqual([true, false]);
    expect(keptAsWrittenOf(firstTwo(day), "noon")).toEqual([true, false]);
  });

  it("judges the day's last stop on its own once no stop comes after it", () => {
    expect(keptAsWrittenOf(kyotoDay().stops, null).every(Boolean)).toBe(true);
  });
});
