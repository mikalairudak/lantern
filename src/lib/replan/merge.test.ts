import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { DayRequest, GeneratedStop } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { KYOTO_SLOW_MORNING_WITH_VERSIONS } from "@/lib/fixtures/replan/kyoto-morning";
import {
  keptPlaceNamesOf,
  mergeReplan,
  mergeShownReplan,
  MIN_MERGED_STOP_MINUTES,
  movedStopsOf,
  replannedFactsOf,
  shownPlaceOf,
  type MergeOptions,
} from "./merge";
import { checkReplanDrops, checkReplanWindows } from "@/lib/quality/replan-checks";
import { withPicks } from "./request";

const normalized = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
if (!normalized.ok) throw new Error("The written Kyoto day normalizes");
const KYOTO = normalized.itinerary;
const SLOW: DayRequest = { ...KYOTO_DAY.request, start: "slow" };
// Kyoto's morning: its two first stops, before the garden at ten.
const MORNING = [{ from: 0, to: 1 }];
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Kyoto has nothing at ${index}`);
  return item;
}

const FIRST = at(KYOTO_DAY.day.stops, 0);
const SECOND = at(KYOTO_DAY.day.stops, 1);
const FIRST_SET = at(KYOTO_DAY.day.alternatives, 0);

function newStop(stop: GeneratedStop, name: string, startTime: string, minutes: number) {
  return {
    ...stop,
    startTime,
    durationMinutes: minutes,
    place: { ...stop.place, name },
  };
}

/** A slow morning: a temple at nine and a shrine at a quarter to ten, which runs past ten. */
function slowMorning(overrides: Partial<GeneratedReplan> = {}): GeneratedReplan {
  return {
    stops: [newStop(FIRST, "Shoren-in", "09:00", 40), newStop(SECOND, "Awata Shrine", "09:45", 30)],
    alternatives: [
      { ...FIRST_SET, stopIndex: 0 },
      { ...FIRST_SET, stopIndex: 1 },
    ],
    dek: "Shoren-in at nine, the shrine above it, then the garden at ten and the rest as before.",
    ...overrides,
  };
}

const BASIS: Omit<MergeOptions, "replan"> = {
  itinerary: KYOTO,
  request: SLOW,
  changed: "start",
  windows: MORNING,
  idPrefix: "r1",
};

function merge(replan: GeneratedReplan, options: Partial<MergeOptions> = {}) {
  return mergeReplan({ ...BASIS, replan, ...options });
}

/** Elche's kept basilica, its quieter version, Plaça de Baix, off screen, and where each stands. */
const BASILICA = (() => {
  const stops = ELCHE_DINNER_BASIS.itinerary.stops;
  const index = stops.findIndex(({ alternatives }) =>
    alternatives.some(({ name }) => name === "Plaça de Baix"),
  );
  const stop = stops[index];
  const quieterAt = stop?.alternatives.findIndex(({ name }) => name === "Plaça de Baix") ?? -1;
  const quieter = stop?.alternatives[quieterAt];
  if (stop === undefined || quieter === undefined) throw new Error("Elche keeps its basilica");
  return { index, stop, quieter, quieterAt };
})();

/** Elche's late dinner with its first new stop at the basilica's quieter version. */
const AT_BASILICAS_VERSION: GeneratedReplan = {
  ...ELCHE_LATE_DINNER_UNREPEATED,
  stops: ELCHE_LATE_DINNER_UNREPEATED.stops.map((stop, index) =>
    index === 0 ? { ...stop, place: { ...stop.place, name: "Plaça de Baix" } } : stop,
  ),
};

describe("mergeReplan", () => {
  it("keeps every stop outside the window as it was, the same object, and writes the window anew", () => {
    const result = merge(slowMorning());
    if (!result.ok) throw new Error(result.reason);
    const { stops } = result.itinerary;

    expect(stops.slice(2)).toEqual(KYOTO.stops.slice(2));
    for (const [index, stop] of stops.slice(2).entries()) expect(stop).toBe(KYOTO.stops[index + 2]);
    expect(stops.slice(0, 2).map(({ primary }) => primary.name)).toEqual([
      "Shoren-in",
      "Awata Shrine",
    ]);
  });

  it("gives the new places ids under the re-plan's prefix, never one the day has shown", () => {
    const result = merge(slowMorning());
    if (!result.ok) throw new Error(result.reason);
    const before = new Set(
      KYOTO.stops.flatMap((stop) => [
        stop.id,
        stop.primary.id,
        ...stop.alternatives.map(({ id }) => id),
      ]),
    );
    const added = result.itinerary.stops
      .slice(0, 2)
      .flatMap((stop) => [stop.id, stop.primary.id, ...stop.alternatives.map(({ id }) => id)]);

    expect(added.every((id) => id.startsWith("r1-stop-"))).toBe(true);
    expect(added.some((id) => before.has(id))).toBe(false);
  });

  it("takes the re-plan's line about the day, and the changed word as the visitor's", () => {
    const result = merge(slowMorning());
    if (!result.ok) throw new Error(result.reason);

    expect(result.itinerary.dek).toBe(slowMorning().dek);
    expect(result.itinerary.facts.start).toEqual({ value: "slow", source: "chosen" });
    expect(result.itinerary.facts.dinner).toEqual(KYOTO.facts.dinner);
  });

  it("cuts a new stop short at the kept stop after it, never the kept one", () => {
    const result = merge(slowMorning());
    if (!result.ok) throw new Error(result.reason);

    expect(result.itinerary.stops[1]?.durationMinutes).toBe(MIN_MERGED_STOP_MINUTES);
    expect(result.mergeRepairs).toContainEqual(
      expect.objectContaining({ kind: "shortened-at-kept", note: "cut to 15 minutes" }),
    );
    expect(result.itinerary.stops[2]?.startTime).toBe(KYOTO.stops[2]?.startTime);
  });

  it("gives the day the words its prompt read: the kept day's, and the changed one as the visitor's", () => {
    const result = merge(slowMorning());
    if (!result.ok) throw new Error(result.reason);

    expect(result.itinerary.facts).toEqual(replannedFactsOf(BASIS));
  });

  it("drops a new stop with no time left before the kept stop after it", () => {
    const replan = slowMorning({
      stops: [
        newStop(FIRST, "Shoren-in", "09:00", 40),
        newStop(SECOND, "Awata Shrine", "09:50", 30),
      ],
    });

    const result = merge(replan);
    if (!result.ok) throw new Error(result.reason);

    expect(result.mergeRepairs).toEqual([
      { kind: "dropped-at-kept", path: ["stops", 1], note: "no time left before a kept stop" },
    ]);
    expect(result.itinerary.stops).toHaveLength(KYOTO.stops.length - 1);
  });

  it("keeps a window stop written again at its place and start: its id and place, the re-plan's length and versions", () => {
    const old = at(KYOTO.stops, 1);
    const result = merge(
      slowMorning({
        stops: [
          newStop(FIRST, "Shoren-in", "07:30", 40),
          newStop(SECOND, "philosophers path", "08:25", 60),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.reason);
    const [first, second] = result.itinerary.stops;

    expect(first?.id).toBe("r1-stop-0");
    expect(second?.id).toBe(old.id);
    // The place as the day had it, the same object, its point and check with it.
    expect(second?.primary).toBe(old.primary);
    expect(second?.selectedPlaceId).toBe(old.primary.id);
    expect(second?.durationMinutes).toBe(60);
    expect(second?.alternatives.length).toBeGreaterThan(0);
    expect(second?.alternatives.every(({ id }) => id.startsWith("r1-stop-1:"))).toBe(true);
    expect(result.mergeRepairs).toEqual([]);
  });

  it("writes the same place at another start as a new stop, under the re-plan's prefix", () => {
    const result = merge(
      slowMorning({
        stops: [
          newStop(FIRST, "Shoren-in", "07:30", 40),
          newStop(SECOND, "Philosopher's Path", "08:40", 60),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.reason);

    expect(result.itinerary.stops[1]?.id).toBe("r1-stop-1");
    expect(result.itinerary.stops[1]?.primary.id).toBe("r1-stop-1:p");
  });

  it("keeps every window stop written again, a window written as it was keeping all its rows", () => {
    const old = at(KYOTO.stops, 0);
    const result = merge(
      slowMorning({
        stops: [
          newStop(FIRST, "Honen-in", "07:30", 30),
          newStop(SECOND, "Philosopher's Path", "08:25", 60),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.reason);

    expect(result.itinerary.stops.map(({ id }) => id).slice(0, 2)).toEqual([
      old.id,
      at(KYOTO.stops, 1).id,
    ]);
  });

  it("drops a new stop that repeats a kept place, and one outside every window", () => {
    const kept = KYOTO.stops[4]?.primary.name ?? "";
    const replan = slowMorning({
      stops: [
        newStop(FIRST, "Shoren-in", "09:00", 40),
        newStop(SECOND, kept, "09:10", 20),
        newStop(SECOND, "Yasaka Shrine", "13:00", 30),
      ],
      alternatives: [{ ...FIRST_SET, stopIndex: 0 }],
    });

    const result = merge(replan);
    if (!result.ok) throw new Error(result.reason);

    expect(result.mergeRepairs.map(({ kind }) => kind)).toEqual([
      "dropped-repeat",
      "outside-windows",
    ]);
    expect(result.itinerary.stops).toHaveLength(KYOTO.stops.length - 1);
  });

  it("fails as a whole when a window is left without a stop, and the day stays as it was", () => {
    const replan = slowMorning({
      stops: [newStop(FIRST, "Yasaka Shrine", "13:00", 30)],
      alternatives: [],
    });

    expect(merge(replan)).toMatchObject({
      ok: false,
      reason: "the re-plan left window 1 without a stop",
    });
  });
});

describe("the merged day's time words", () => {
  it("say an end Lantern assumed as the merged day keeps it: Elche's evening, run to 23:45, is out late", () => {
    const shown = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
    if (!shown.ok) throw new Error(shown.reason);

    expect(ELCHE_DINNER_BASIS.itinerary.facts.end).toEqual({ value: "early", source: "assumed" });
    expect(shown.itinerary.facts.end).toEqual({ value: "late", source: "assumed" });
    // The words the re-plan was asked to keep stay the kept day's.
    expect(replannedFactsOf(ELCHE_DINNER_BASIS).end).toEqual({ value: "early", source: "assumed" });
  });

  it("give way to the changed word they cannot stand beside: home by eight takes an early dinner", () => {
    const dinner = { value: "late", source: "chosen" } as const;
    const facts = replannedFactsOf({
      itinerary: { ...KYOTO, facts: { ...KYOTO.facts, dinner } },
      request: { ...KYOTO_DAY.request, end: "evening" },
      changed: "end",
    });

    expect(facts.end).toEqual({ value: "evening", source: "chosen" });
    expect(facts.dinner).toEqual({ value: "early", source: "assumed" });
  });

  it("give way to a late dinner: an evening end becomes Lantern's home by eleven", () => {
    const facts = replannedFactsOf({
      itinerary: KYOTO,
      request: { ...KYOTO_DAY.request, dinner: "late" },
      changed: "dinner",
    });

    expect(KYOTO.facts.end.value).toBe("evening");
    expect(facts.dinner).toEqual({ value: "late", source: "chosen" });
    expect(facts.end).toEqual({ value: "early", source: "assumed" });
  });
});

describe("a window stop the visitor picked a version of", () => {
  // Kyoto's first stop, in the morning's window, with a version no kept stop holds too, which the
  // merge would drop as a repeat.
  const temple = at(KYOTO.stops, 0);
  const kept = keptPlaceNamesOf(KYOTO, MORNING);
  const pick = temple.alternatives.find(({ name }) => !kept.includes(name));
  if (pick === undefined) throw new Error("Kyoto's temple has a version of its own");
  const basis: MergeOptions["itinerary"] = withPicks(KYOTO, { [temple.id]: pick.id });
  // The temple's hour written again as the prompt names it: the version on screen.
  const pickAgain = slowMorning({
    stops: [newStop(FIRST, pick.name, temple.startTime, 60)],
    alternatives: [],
  });

  it("is the place its row shows", () => {
    expect(shownPlaceOf(temple)).toBe(temple.primary);
    expect(shownPlaceOf(at(basis.stops, 0))).toBe(pick);
  });

  it("keeps its id and its pick, its point and its check, when the re-plan writes the pick again at its start", () => {
    const merged = mergeShownReplan({ ...BASIS, itinerary: basis, replan: pickAgain });
    if (!merged.ok) throw new Error(merged.reason);
    const stop = merged.itinerary.stops[0];

    expect(stop?.id).toBe(temple.id);
    expect(stop?.selectedPlaceId).toBe(pick.id);
    const { reason, ...place } = pick;
    expect(reason).not.toBe("");
    expect(stop?.primary).toEqual(place);
    expect(merged.mergeRepairs).toEqual([]);
  });

  it("is a new stop when the re-plan writes the primary the row did not show", () => {
    const primaryAgain = slowMorning({
      stops: [newStop(FIRST, temple.primary.name, temple.startTime, 60)],
      alternatives: [],
    });
    const merged = mergeShownReplan({ ...BASIS, itinerary: basis, replan: primaryAgain });
    if (!merged.ok) throw new Error(merged.reason);

    expect(merged.itinerary.stops[0]?.id).toBe("r1-stop-0");
  });
});

describe("movedStopsOf", () => {
  const timed = (id: string, name: string, startTime: string) => ({
    id,
    startTime,
    durationMinutes: 30,
    primary: { name },
  });

  it("says which way each of a part's own places moved, and nothing of a new place or a kept stop", () => {
    const stops = [
      // The path was at 08:25 and the temple at 07:30.
      timed("r1-stop-0", "Philosopher's Path", "07:00"),
      timed("r1-stop-1", "Shoren-in", "09:00"),
      timed("r1-stop-2", "Honen-in", "09:40"),
      ...KYOTO.stops.slice(2),
    ];

    expect([...movedStopsOf(BASIS, stops)]).toEqual([
      ["r1-stop-0", "earlier"],
      ["r1-stop-2", "later"],
    ]);
  });

  it("matches each old stop once, and never one a stop that stays stands for", () => {
    const stops = [
      // The path written again at its own hour stays, under its own id.
      at(KYOTO.stops, 1),
      timed("r1-stop-0", "Honen-in", "09:00"),
      timed("r1-stop-1", "Honen-in", "09:30"),
      timed("r1-stop-2", "Philosopher's Path", "09:50"),
    ];

    expect([...movedStopsOf(BASIS, stops)]).toEqual([["r1-stop-0", "later"]]);
  });

  it("lets a stop written at its own hour take its old stop, so one of the same name moves from the other", () => {
    // Two visits to one temple in the morning, at 07:30 and 08:25.
    const twice = {
      ...BASIS,
      itinerary: {
        ...KYOTO,
        stops: KYOTO.stops.map((stop, index) =>
          index === 1 ? { ...stop, primary: { ...stop.primary, name: "Honen-in" } } : stop,
        ),
      },
    };
    const rest = KYOTO.stops.slice(2);

    // The one at 08:25 stands where it stood; the other, at 07:30 before, comes at 09:00.
    expect([
      ...movedStopsOf(twice, [
        timed("r1-stop-0", "Honen-in", "08:25"),
        timed("r1-stop-1", "Honen-in", "09:00"),
        ...rest,
      ]),
    ]).toEqual([["r1-stop-1", "later"]]);
    // The one at 07:30 stands where it stood; the other, at 08:25 before, comes at 08:00.
    expect([
      ...movedStopsOf(twice, [
        timed("r1-stop-0", "Honen-in", "07:30"),
        timed("r1-stop-1", "Honen-in", "08:00"),
        ...rest,
      ]),
    ]).toEqual([["r1-stop-1", "earlier"]]);
  });

  it("reads an old stop as its row showed it: the version picked, not the one written", () => {
    const first = at(KYOTO.stops, 0);
    const picked = at(first.alternatives, 0);
    // The day as the route reads it, with the visitor's pick planned.
    const swapped = { ...BASIS, itinerary: withPicks(KYOTO, { [first.id]: picked.id }) };
    const rest = KYOTO.stops.slice(1);

    expect([...movedStopsOf(swapped, [timed("r1-stop-0", picked.name, "09:00"), ...rest])]).toEqual(
      [["r1-stop-0", "later"]],
    );
    // The temple the row no longer showed is a new place to it.
    expect([
      ...movedStopsOf(swapped, [timed("r1-stop-0", first.primary.name, "09:00"), ...rest]),
    ]).toEqual([]);
  });

  it("agrees with the merge on a pick: written again at its start it stays and says nothing, an hour on it moved", () => {
    const temple = at(KYOTO.stops, 0);
    const kept = keptPlaceNamesOf(KYOTO, MORNING);
    const pick = temple.alternatives.find(({ name }) => !kept.includes(name));
    if (pick === undefined) throw new Error("Kyoto's temple has a version of its own");
    const picked = { ...BASIS, itinerary: withPicks(KYOTO, { [temple.id]: pick.id }) };
    const mergedAt = (startTime: string) => {
      const replan = slowMorning({
        stops: [newStop(FIRST, pick.name, startTime, 60)],
        alternatives: [],
      });
      const merged = mergeShownReplan({ ...picked, replan });
      if (!merged.ok) throw new Error(merged.reason);
      return merged.itinerary.stops;
    };

    const again = mergedAt(temple.startTime);
    expect(again[0]?.id).toBe(temple.id);
    expect([...movedStopsOf(picked, again)]).toEqual([]);
    expect([...movedStopsOf(picked, mergedAt("08:30"))]).toEqual([["r1-stop-0", "later"]]);
  });
});

describe("keptPlaceNamesOf", () => {
  it("names each kept stop's own place and the version on screen, once each, and none of a window's", () => {
    const { itinerary, windows } = ELCHE_DINNER_BASIS;

    const names = keptPlaceNamesOf(itinerary, windows);

    expect(names).toContain("Coffee on Plaça de Baix");
    // The basilica's quieter version, off screen: it yields to a new stop at its place.
    expect(names).not.toContain("Plaça de Baix");
    expect(names).not.toContain("Rice dinner on Passeig de l'Estació");
    expect(new Set(names).size).toBe(names.length);
    // Picked, the version is on screen and holds its place.
    const picked = withPicks(itinerary, { [BASILICA.stop.id]: BASILICA.quieter.id });
    expect(keptPlaceNamesOf(picked, windows)).toContain("Plaça de Baix");
  });
});

describe("a new stop at a kept stop's version", () => {
  it("takes the place of a version off screen, which the kept stop gives up, and is shown", () => {
    const shown = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: AT_BASILICAS_VERSION });
    if (!shown.ok) throw new Error(shown.reason);

    const basilica = shown.itinerary.stops.find(({ id }) => id === BASILICA.stop.id);
    expect(basilica).toEqual({
      ...BASILICA.stop,
      alternatives: BASILICA.stop.alternatives.filter(({ name }) => name !== "Plaça de Baix"),
    });
    expect(shown.itinerary.stops.map(({ primary }) => primary.name)).toContain("Plaça de Baix");
    expect(shown.mergeRepairs).toEqual([
      {
        kind: "yielded-version",
        path: ["stops", BASILICA.index, "alternatives", BASILICA.quieterAt],
        note: "Plaça de Baix is a new stop",
      },
    ]);
    expect(checkReplanDrops(ELCHE_DINNER_BASIS, AT_BASILICAS_VERSION)).toMatchObject({
      passed: true,
      value: 0,
    });
    // The model could not know the place was a version: its windows hold.
    expect(checkReplanWindows(ELCHE_DINNER_BASIS, AT_BASILICAS_VERSION)).toMatchObject({
      passed: true,
      findings: [],
    });
  });

  it("is a repeat of the version the visitor shows, and the re-plan is not shown", () => {
    const basis = {
      ...ELCHE_DINNER_BASIS,
      itinerary: withPicks(ELCHE_DINNER_BASIS.itinerary, {
        [BASILICA.stop.id]: BASILICA.quieter.id,
      }),
    };

    expect(mergeShownReplan({ ...basis, replan: AT_BASILICAS_VERSION })).toMatchObject({
      // The stop was its window's only one, so the window is left without a stop too.
      ok: false,
      reason: "the re-plan left window 1 without a stop",
      mergeRepairs: [
        expect.objectContaining({ kind: "dropped-repeat", note: "Plaça de Baix is kept" }),
      ],
    });
    expect(checkReplanDrops(basis, AT_BASILICAS_VERSION)).toMatchObject({
      passed: false,
      value: 1,
    });
  });
});

describe("mergeShownReplan", () => {
  it("fails a re-plan whose merge drops a new stop: its line may name it and its hour stands empty", () => {
    const result = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER });

    expect(result).toMatchObject({
      ok: false,
      reason: "the re-plan dropped stops[2]: Coffee on Plaça de Baix is kept",
      mergeRepairs: [expect.objectContaining({ kind: "dropped-repeat" })],
    });
  });

  it("fails one whose stop the normalizer drops, as it fails one the merge drops", () => {
    const replan = slowMorning({
      stops: [
        newStop(FIRST, "Shoren-in", "09:00", 40),
        newStop(SECOND, "Awata Shrine", "nine", 20),
      ],
    });

    expect(mergeShownReplan({ ...BASIS, replan })).toMatchObject({
      ok: false,
      reason: 'the re-plan dropped stops[1]: its start time "nine" is not a time',
    });
  });

  // Only a new stop's drop is fatal. The normalizer's repeat of an option shares its kind's name
  // with the merge's repeat of a stop, so a set that read kinds alone would fail this.
  it("shows a merge whose new stops lost options, one past the walk and one at another new stop", () => {
    const replan: GeneratedReplan = {
      ...KYOTO_SLOW_MORNING_WITH_VERSIONS,
      alternatives: KYOTO_SLOW_MORNING_WITH_VERSIONS.alternatives.map((set) =>
        set.stopIndex === 1
          ? { ...set, options: [...set.options, { ...at(set.options, 0), name: "Shoren-in" }] }
          : set,
      ),
    };

    const shown = mergeShownReplan({ ...BASIS, replan });
    if (!shown.ok) throw new Error(shown.reason);

    expect(shown.repairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "dropped-alternative",
          path: ["alternatives", 0, "options", 1],
        }),
        expect.objectContaining({
          kind: "dropped-repeat",
          path: ["alternatives", 1, "options", 1],
        }),
      ]),
    );
    expect(shown.mergeRepairs).toEqual([]);
    expect(
      shown.itinerary.stops.slice(0, 2).map(({ alternatives }) => alternatives.length),
    ).toEqual([1, 1]);
  });

  // A window's stop is no kept place: the same garden at the same hour is the window's own,
  // written again, not a repeat of a stop the re-plan keeps.
  it("shows Elche's garden written again at 16:30 as the stop it was, never as a repeat", () => {
    const shown = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
    if (!shown.ok) throw new Error(shown.reason);
    const garden = ELCHE_DINNER_BASIS.itinerary.stops[6];

    expect(shown.mergeRepairs).toEqual([]);
    expect(shown.itinerary.stops.map(({ id, startTime }) => `${id} ${startTime}`)).toEqual([
      "stop-0 07:45",
      "stop-1 08:45",
      "stop-2 11:00",
      "stop-3 12:30",
      "r1-stop-0 13:15",
      "stop-5 15:00",
      "stop-6 16:30",
      "r1-stop-2 21:00",
      "r1-stop-3 23:15",
    ]);
    expect(shown.itinerary.stops[6]?.primary).toBe(garden?.primary);
  });

  it("shows a merge that only cut a new stop short, as the merge made it", () => {
    const shown = mergeShownReplan({ ...BASIS, replan: slowMorning() });

    expect(shown).toEqual(merge(slowMorning()));
    expect(
      mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED }).ok,
    ).toBe(true);
  });
});
