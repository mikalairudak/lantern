import { describe, expect, it } from "vitest";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import type { WrittenDay } from "@/lib/days/written/written-day";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { WRITTEN_DAYS } from "@/lib/days/written/days";
import { distanceInMeters } from "@/lib/geo/distance";
import { normalizeDay } from "@/lib/normalizer/normalize";
import {
  DAY_ENDS,
  DAY_STARTS,
  DINNER_TIMES,
  EARLY_END_BY,
  EARLY_START_AIM,
  EVENING_END_AIM,
  EVENING_END_BY,
  LATE_END_AIM,
  SLOW_START_FROM,
  type DayRequest,
  type FactKey,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import { minutesOf, runningSpans } from "@/lib/time/clock";
import { replanInputOf, replanPlanOf, type WindowSpan } from "./windows";

const normalized = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
if (!normalized.ok) throw new Error("The written Kyoto day normalizes");
const KYOTO = normalized.itinerary;
const STOPS = KYOTO.stops.length;
// The other words set as the visitor would change them, so each test reads one rule.
const EARLY: DayRequest = { ...KYOTO_DAY.request, start: "early" };
const SLOW: DayRequest = { ...KYOTO_DAY.request, start: "slow" };

function normalizedOf({ request, day }: WrittenDay): Itinerary {
  const result = normalizeDay(request, day);
  if (!result.ok) throw new Error(`${request.city}'s day normalizes: ${result.reason}`);
  return result.itinerary;
}

/** Kyoto's day with each stop naming the words given at its index. */
function dayNaming(words: readonly (readonly FactKey[])[]): Itinerary {
  return {
    ...KYOTO,
    stops: KYOTO.stops.map((stop, index) => ({
      ...stop,
      dependsOn: ["energy", ...(words[index] ?? [])],
    })),
  };
}

describe("replanPlanOf", () => {
  it("rewrites the morning through the last stop the start shaped, a lunch it named included", () => {
    const day = dayNaming([["start"], [], ["start"]]);

    expect(replanPlanOf(day, EARLY, "start")).toEqual({
      kind: "targeted",
      windows: [{ from: 0, to: 2 }],
    });
  });

  it("takes into a slow start's morning every stop that begins before mid-morning, as Kyoto's 08:25 walk", () => {
    // Kyoto's temple at 07:30 names the start; its walk at 08:25 does not.
    const day = dayNaming([["start"]]);

    expect(replanPlanOf(day, EARLY, "start")).toEqual({
      kind: "targeted",
      windows: [{ from: 0, to: 0 }],
    });
    expect(replanPlanOf(day, SLOW, "start")).toEqual({
      kind: "targeted",
      windows: [{ from: 0, to: 1 }],
    });
  });

  it("takes into a slow start's morning every stop that begins in its first hour, as Kanazawa's 09:15 coffee", () => {
    // Kenroku-en at 07:30 names the start; the coffee at 09:15 does not, and the walk at 10:30 stays.
    const kanazawa = normalizedOf(KANAZAWA_START_DAY);
    const slow: DayRequest = { ...KANAZAWA_START_DAY.request, start: "slow" };

    expect(replanPlanOf(kanazawa, slow, "start")).toEqual({
      kind: "targeted",
      windows: [{ from: 0, to: 1 }],
    });
  });

  it("never counts a stop past midnight as morning", () => {
    // A late evening to 23:30, then a last drink at half past midnight.
    const late = { [STOPS - 2]: { startTime: "21:30", durationMinutes: 120 } };
    const small = { [STOPS - 1]: { startTime: "00:30", durationMinutes: 30 } };
    const day: Itinerary = {
      ...dayNaming([["start"]]),
      stops: dayNaming([["start"]]).stops.map((stop, index) => ({
        ...stop,
        ...late[index],
        ...small[index],
      })),
    };

    expect(replanPlanOf(day, SLOW, "start")).toEqual({
      kind: "targeted",
      windows: [{ from: 0, to: 1 }],
    });
  });

  it("rewrites the evening from the first stop the end shaped", () => {
    const words: FactKey[][] = KYOTO.stops.map(() => []);
    words[STOPS - 2] = ["end"];

    expect(replanPlanOf(dayNaming(words), EARLY, "end")).toEqual({
      kind: "targeted",
      windows: [{ from: STOPS - 2, to: STOPS - 1 }],
    });
  });

  it("rewrites each run of stops the dinner shaped as its own window", () => {
    const words: FactKey[][] = KYOTO.stops.map(() => []);
    words[3] = ["dinner"];
    words[STOPS - 1] = ["dinner"];

    expect(replanPlanOf(dayNaming(words), EARLY, "dinner")).toEqual({
      kind: "targeted",
      windows: [
        { from: 3, to: 3 },
        { from: STOPS - 1, to: STOPS - 1 },
      ],
    });
  });

  it("takes into an early dinner the stops before it that end after half past seven", () => {
    // A garden from 16:05 runs to 19:45, past where an early dinner starts; dinner follows at 19:50.
    const words: FactKey[][] = KYOTO.stops.map(() => []);
    words[STOPS - 1] = ["dinner"];
    const day: Itinerary = {
      ...dayNaming(words),
      stops: dayNaming(words).stops.map((stop, index) =>
        index === STOPS - 2
          ? { ...stop, durationMinutes: 220 }
          : index === STOPS - 1
            ? { ...stop, startTime: "19:50" }
            : stop,
      ),
    };

    expect(replanPlanOf(day, { ...EARLY, dinner: "early" }, "dinner")).toEqual({
      kind: "targeted",
      windows: [{ from: STOPS - 2, to: STOPS - 1 }],
    });
    expect(replanPlanOf(dayNaming(words), { ...EARLY, dinner: "early" }, "dinner")).toEqual({
      kind: "targeted",
      windows: [{ from: STOPS - 1, to: STOPS - 1 }],
    });
  });

  it("takes into an early end the stops before it that end after eleven", () => {
    // A late dinner from 21:30 to 23:30 names no end; the drink after it does.
    const late = {
      [STOPS - 2]: { startTime: "21:30", durationMinutes: 120 },
      [STOPS - 1]: { startTime: "23:45", durationMinutes: 60 },
    };
    const words: FactKey[][] = KYOTO.stops.map(() => []);
    words[STOPS - 1] = ["end"];
    const day: Itinerary = {
      ...dayNaming(words),
      stops: dayNaming(words).stops.map((stop, index) => ({ ...stop, ...late[index] })),
    };

    expect(replanPlanOf(day, { ...EARLY, end: "early" }, "end")).toEqual({
      kind: "targeted",
      windows: [{ from: STOPS - 2, to: STOPS - 1 }],
    });
    expect(replanPlanOf(day, { ...EARLY, end: "late" }, "end")).toEqual({
      kind: "targeted",
      windows: [{ from: STOPS - 1, to: STOPS - 1 }],
    });
  });

  it("takes into an evening end the stops before it that end after eight, a late dinner among them", () => {
    // A late dinner from 20:30 to 22:00 names no end; the walk after it does.
    const late = {
      [STOPS - 2]: { startTime: "20:30", durationMinutes: 90 },
      [STOPS - 1]: { startTime: "22:15", durationMinutes: 45 },
    };
    const words: FactKey[][] = KYOTO.stops.map(() => []);
    words[STOPS - 1] = ["end"];
    const day: Itinerary = {
      ...dayNaming(words),
      stops: dayNaming(words).stops.map((stop, index) => ({ ...stop, ...late[index] })),
    };

    expect(replanPlanOf(day, { ...EARLY, end: "evening" }, "end")).toEqual({
      kind: "targeted",
      windows: [{ from: STOPS - 2, to: STOPS - 1 }],
    });
  });

  it("re-plans each run of the stops company shaped, as dinner's, and changes travel's word alone", () => {
    const words: FactKey[][] = KYOTO.stops.map(() => []);
    words[1] = ["travel", "company"];
    words[2] = ["company"];
    words[4] = ["travel"];

    expect(replanPlanOf(dayNaming(words), EARLY, "travel")).toEqual({
      kind: "word",
      reason: "travel changes no stop",
    });
    expect(replanPlanOf(dayNaming(words), EARLY, "company")).toEqual({
      kind: "targeted",
      windows: [{ from: 1, to: 2 }],
    });
  });

  it("re-plans in part windows that hold two thirds of the stops exactly, and the whole day past them", () => {
    const six = { ...KYOTO, stops: KYOTO.stops.slice(0, 6) };
    const naming = (word: FactKey, at: readonly number[]): Itinerary => ({
      ...six,
      stops: six.stops.map((stop, index) => ({
        ...stop,
        dependsOn: at.includes(index) ? ["energy", word] : ["energy"],
      })),
    });

    expect(replanPlanOf(naming("company", [0, 1, 3, 4]), EARLY, "company")).toEqual({
      kind: "targeted",
      windows: [
        { from: 0, to: 1 },
        { from: 3, to: 4 },
      ],
    });
    expect(replanPlanOf(naming("company", [0, 1, 2, 3, 4]), EARLY, "company")).toEqual({
      kind: "full",
      reason: "company would rewrite 5 of 6 stops",
    });
  });

  it("changes company's word alone where no stop names it, and re-plans the whole day for a time word no stop names, and past two thirds", () => {
    expect(replanPlanOf(dayNaming([]), EARLY, "company")).toEqual({
      kind: "word",
      reason: "no stop names company",
    });
    expect(replanPlanOf(dayNaming([]), EARLY, "start")).toEqual({
      kind: "full",
      reason: "no stop names start",
    });
    const mostly = KYOTO.stops.map((_, index): FactKey[] => (index < STOPS - 1 ? ["start"] : []));
    expect(replanPlanOf(dayNaming(mostly), EARLY, "start").kind).toBe("full");
  });
});

/** The least room a window leaves its new stops: the shortest first stop the written days hold. */
const MIN_WINDOW_MINUTES = 45;
const MINUTES_PER_DAY = 24 * 60;

type TimeWord = "start" | "dinner" | "end";

/** Each time word with every value a visitor can change it to. */
const TIME_WORDS: readonly { changed: TimeWord; values: readonly string[] }[] = [
  { changed: "start", values: DAY_STARTS },
  { changed: "dinner", values: DINNER_TIMES },
  { changed: "end", values: DAY_ENDS },
];

/**
 * Each window's minutes as the merge bounds it (`boundsOf` in `merge.ts`), from the kept stop
 * before it ends to the kept stop after it starts; at the day's edge, from where the merged
 * day's start word lets it begin, 09:00 for a slow start and the aim, 07:30, for an early one,
 * to where its end word lets it end, 20:00 for an evening end, 23:00 for an early one and the
 * aim, 01:00, for a late one.
 */
function windowMinutesOf(
  day: Itinerary,
  request: DayRequest,
  changed: TimeWord,
  windows: readonly WindowSpan[],
): number[] {
  const spans = runningSpans(day.stops);
  const start = changed === "start" ? request.start : day.facts.start.value;
  const end = changed === "end" ? request.end : day.facts.end.value;
  const dayOpens = minutesOf(start === "slow" ? SLOW_START_FROM : EARLY_START_AIM);
  const dayCloses =
    end === "evening"
      ? minutesOf(EVENING_END_BY)
      : end === "early"
        ? minutesOf(EARLY_END_BY)
        : minutesOf(LATE_END_AIM) + MINUTES_PER_DAY;
  return windows.map(
    ({ from, to }) => (spans[to + 1]?.from ?? dayCloses) - (spans[from - 1]?.to ?? dayOpens),
  );
}

/** Every written day, and the curated ones the lab and the tests play, with each time word changed. */
const WORD_CHANGES = [...WRITTEN_DAYS, ...CURATED_DAYS].flatMap((written) => {
  const day = normalizedOf(written);
  return TIME_WORDS.flatMap(({ changed, values }) =>
    values
      .filter((value) => value !== day.facts[changed].value)
      .map((value) => {
        const request = { ...written.request, [changed]: value } as DayRequest;
        return { city: written.request.city, changed, value, day, request };
      }),
  );
});

describe("every written day's time words", () => {
  it.each(WORD_CHANGES)(
    "leave each window of $city's day 45 minutes or more when its $changed becomes $value",
    ({ day, request, changed }) => {
      const plan = replanPlanOf(day, request, changed);
      // A whole day's re-plan, or a word's alone, has no window to leave short.
      if (plan.kind !== "targeted") return;

      for (const minutes of windowMinutesOf(day, request, changed, plan.windows)) {
        expect(minutes).toBeGreaterThanOrEqual(MIN_WINDOW_MINUTES);
      }
    },
  );

  it("re-plan some of each written day's words in windows", () => {
    const targeted = WORD_CHANGES.filter(
      ({ day, request, changed }) => replanPlanOf(day, request, changed).kind === "targeted",
    );

    expect(new Set(targeted.map(({ city }) => city))).toEqual(
      new Set([...WRITTEN_DAYS, ...CURATED_DAYS].map(({ request }) => request.city)),
    );
  });
});

describe("replanInputOf", () => {
  it("keeps the stops outside the window as the visitor sees them, a swap included, and names the window's sides", () => {
    const swappedStop = KYOTO.stops[3];
    const version = swappedStop?.alternatives[0];
    if (swappedStop === undefined || version === undefined) throw new Error("Kyoto swaps stop 3");
    const day: Itinerary = {
      ...KYOTO,
      stops: KYOTO.stops.map((stop, index) =>
        index === 3 ? { ...stop, selectedPlaceId: version.id } : stop,
      ),
    };

    const input = replanInputOf(day, { ...KYOTO_DAY.request, start: "slow" }, "start", [
      { from: 0, to: 1 },
    ]);

    expect(input.kept).toHaveLength(STOPS - 2);
    expect(input.kept[1]?.name).toBe(version.name);
    expect(input.windows).toEqual([
      {
        after: null,
        before: { startTime: KYOTO.stops[2]?.startTime, name: KYOTO.stops[2]?.primary.name },
        dayStartsAt: null,
        dayEndsAt: null,
        oldStops: KYOTO.stops
          .slice(0, 2)
          .map(({ primary }) => ({ name: primary.name, kind: primary.kind })),
      },
    ]);
  });

  it("gives a window inside the day the time the stop before it ends", () => {
    const input = replanInputOf(KYOTO, KYOTO_DAY.request, "dinner", [{ from: 3, to: 3 }]);
    const before = KYOTO.stops[2];
    if (before === undefined) throw new Error("Kyoto has a third stop");
    const [hours = 0, minutes = 0] = before.startTime.split(":").map(Number);
    const end = hours * 60 + minutes + before.durationMinutes;

    expect(input.windows[0]?.after).toEqual({
      endTime: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
      name: before.primary.name,
    });
    expect(input.windows[0]).toMatchObject({ dayStartsAt: null, dayEndsAt: null });
  });

  // replan-v4's calm late evening ended at 23:50: its window ended the day with no hour in it.
  it("gives a window that opens or ends the day its hour to reach, where the word has an aim", () => {
    const first = [{ from: 0, to: 0 }];
    const last = [{ from: STOPS - 1, to: STOPS - 1 }];
    const windowOf = (request: DayRequest, spans: typeof first) =>
      replanInputOf(KYOTO, request, "start", spans).windows[0];

    expect(windowOf(EARLY, first)).toMatchObject({ dayStartsAt: EARLY_START_AIM, dayEndsAt: null });
    expect(windowOf({ ...KYOTO_DAY.request, end: "late" }, last)).toMatchObject({
      dayStartsAt: null,
      dayEndsAt: LATE_END_AIM,
    });
    expect(windowOf({ ...KYOTO_DAY.request, end: "evening" }, last)?.dayEndsAt).toBe(
      EVENING_END_AIM,
    );
    // A slow start and an early end have a limit alone, which a number would read as the target.
    expect(windowOf(SLOW, first)?.dayStartsAt).toBeNull();
    expect(windowOf({ ...KYOTO_DAY.request, end: "early" }, last)?.dayEndsAt).toBeNull();
  });

  it("adds up the legs between kept stops as the visitor sees them, none into or out of a window", () => {
    const swapped = KYOTO.stops[5];
    const version = swapped?.alternatives[0];
    if (swapped === undefined || version === undefined) throw new Error("Kyoto swaps stop 5");
    const day: Itinerary = {
      ...KYOTO,
      stops: KYOTO.stops.map((stop, index) =>
        index === 5 ? { ...stop, selectedPlaceId: version.id } : stop,
      ),
    };
    const shown = day.stops.map((stop, index) =>
      index === 5 ? version.coordinates : stop.primary.coordinates,
    );
    // Leg n runs from stop n - 1 to stop n; the window [3..3] owns legs 3 and 4.
    const keptLegs = shown.flatMap((at, index) => {
      const previous = shown[index - 1];
      return previous === undefined || index === 3 || index === 4
        ? []
        : [distanceInMeters(previous, at)];
    });

    const input = replanInputOf(day, KYOTO_DAY.request, "dinner", [{ from: 3, to: 3 }]);

    expect(keptLegs).toHaveLength(STOPS - 3);
    expect(input.keptFlowMeters).toBe(Math.round(keptLegs.reduce((sum, leg) => sum + leg, 0)));
  });
});
