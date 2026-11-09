// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import {
  KYOTO_ITINERARY,
  KYOTO_MORNING_BASIS,
  KYOTO_SLOW_MORNING,
  KYOTO_SLOW_MORNING_WITH_VERSIONS,
} from "@/lib/fixtures/replan/kyoto-morning";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { keptPlaceNamesOf, mergeReplan, type ReplanBasis } from "@/lib/replan/merge";
import { replanBasisOf } from "@/features/itinerary/replan-route";
import type { GeneratedStop, Itinerary, Stop } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { readReplanStream } from "@/lib/stream/read-replan-stream";
import {
  WHOLE_DAY_WINDOW,
  dayAfterReplan,
  forkAnchorsOf,
  forkFrameOf,
  frameStopsOf,
  newStopsOf,
  replanFrameOf,
  windowsOf,
  type PartialReplanDraft,
  type ReplanFrame,
} from "./replan-frame";

// The written Kyoto day: 07:30 and 08:25 before the garden at 10:00, then 11:15, 13:00,
// 15:00, 16:05 and dinner at 18:00.
const TEN = 600;

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Nothing at ${index}`);
  return item;
}

const TEMPLATE = at(KYOTO_DAY.day.stops, 0);

function stopAt(name: string, startTime: string, durationMinutes: number): GeneratedStop {
  return { ...TEMPLATE, startTime, durationMinutes, place: { ...TEMPLATE.place, name } };
}

/** The re-plan with these stops written, the last still being written unless more follows. */
function writing(stops: GeneratedStop[], more: PartialReplanDraft = {}): PartialReplanDraft {
  return { stops, ...more };
}

function whole(stops: GeneratedStop[], dek = "A slower morning."): GeneratedReplan {
  return { stops, alternatives: [], dek };
}

function sourcesOf(frame: ReplanFrame): string[] {
  return frame.rows.map((row) => `${row.source} ${row.stop.id}`);
}

function merged(basis: ReplanBasis, replan: GeneratedReplan) {
  const result = mergeReplan({ ...basis, replan });
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary;
}

/** The re-plan's text sent a few letters at a time, as a model streams it, ending whole. */
function streamOf(replan: GeneratedReplan): Response {
  const text = JSON.stringify(replan);
  const deltas: string[] = [];
  for (let from = 0; from < text.length; from += 4) deltas.push(text.slice(from, from + 4));
  const events = [
    ...deltas.map((delta) => ({ type: "text-delta", id: "t", delta })),
    { type: "finish", finishReason: "stop" },
  ];
  const body = [...events.map((event) => JSON.stringify(event)), "[DONE]"]
    .map((line) => `data: ${line}\n\n`)
    .join("");
  return new Response(body);
}

/** Each row the merged day keeps, by id, with its start and length: what moves if they differ. */
function timesOf(frame: ReplanFrame): string[] {
  return frame.rows
    .filter((row) => row.source !== "replaced")
    .map(({ stop }) => `${stop.id} ${stop.startTime} ${stop.durationMinutes}`);
}

function timesOfDay(itinerary: { stops: readonly Stop[] }): string[] {
  return itinerary.stops.map(
    ({ id, startTime, durationMinutes }) => `${id} ${startTime} ${durationMinutes}`,
  );
}

describe("replanFrameOf", () => {
  it("keeps the day's morning as it is and lands each new stop beside it, once whole", () => {
    const shoren = stopAt("Shoren-in", "09:00", 20);
    const awata = stopAt("Awata Shrine", "09:25", 15);
    const tea = stopAt("Tea at the Awata gate", "09:45", 10);

    const first = replanFrameOf(KYOTO_MORNING_BASIS, writing([shoren]));
    const second = replanFrameOf(KYOTO_MORNING_BASIS, writing([shoren, awata]));
    const done = replanFrameOf(
      KYOTO_MORNING_BASIS,
      writing([shoren, awata, tea], { alternatives: [] }),
    );

    expect(first.windows).toEqual([{ opens: null, closes: TEN }]);
    // Nothing of the day goes: its window's stops stand as the day's, the proposal's beside.
    expect(first.replaced).toEqual(["stop-0", "stop-1"]);
    expect(first.proposed).toEqual([]);
    expect(second.replaced).toEqual(["stop-0", "stop-1"]);
    expect(second.proposed).toEqual(["r1-stop-0"]);
    expect(done.replaced).toEqual(["stop-0", "stop-1"]);
    expect(done.proposed).toEqual(["r1-stop-0", "r1-stop-1", "r1-stop-2"]);
    expect(sourcesOf(done).slice(0, 6)).toEqual([
      "replaced stop-0",
      "replaced stop-1",
      "proposed r1-stop-0",
      "proposed r1-stop-1",
      "proposed r1-stop-2",
      "kept stop-2",
    ]);
    // Every row but the day's own the proposal replaces, under the id the merged day gives it.
    expect(timesOf(done)).toEqual(
      timesOfDay(merged(KYOTO_MORNING_BASIS, whole([shoren, awata, tea]))),
    );
    done.rows
      .filter((row) => row.source === "kept" || row.source === "replaced")
      .forEach((row) => expect(KYOTO_ITINERARY.stops).toContain(row.stop));
  });

  it("orders the rows by the minute each wire stands at, the day's first where two meet", () => {
    const slow = stopAt("Shoren-in", "07:30", 20);

    const frame = replanFrameOf(KYOTO_MORNING_BASIS, writing([slow], { dek: "" }));
    const mids = frameStopsOf(frame).map(({ startTime, durationMinutes }) => {
      const [hours = 0, minutes = 0] = startTime.split(":").map(Number);
      return hours * 60 + minutes + durationMinutes / 2;
    });

    expect(mids).toEqual([...mids].sort((a, b) => a - b));
    // Both start at 07:30: the proposal's shorter stop's wire stands first.
    expect(sourcesOf(frame).slice(0, 2)).toEqual(["proposed r1-stop-0", "replaced stop-0"]);
  });

  it("leaves the day as it was when the stream is cut in the middle of the window", async () => {
    const text = JSON.stringify(KYOTO_SLOW_MORNING);
    const cutAt = text.indexOf('"Awata Shrine"') + '"Awa'.length;
    const events = [
      { type: "text-delta", id: "t", delta: text.slice(0, cutAt) },
      { type: "finish", finishReason: "length" },
    ];
    const body = [...events.map((event) => JSON.stringify(event)), "[DONE]"]
      .map((line) => `data: ${line}\n\n`)
      .join("");
    const frames: ReplanFrame[] = [];

    const outcome = await readReplanStream({
      basis: KYOTO_MORNING_BASIS,
      response: Promise.resolve(new Response(body)),
      onPartial: (partial) => frames.push(replanFrameOf(KYOTO_MORNING_BASIS, partial)),
    });

    expect(frames.at(-1)?.replaced).toEqual(["stop-0", "stop-1"]);
    expect(outcome).toEqual({ kind: "cut", itinerary: null });
    expect(dayAfterReplan(KYOTO_MORNING_BASIS, outcome)).toBe(KYOTO_ITINERARY);
  });

  it("draws a proposal in each of two windows beside the day's own stops there", () => {
    const basis: ReplanBasis = {
      itinerary: KYOTO_ITINERARY,
      request: { ...KYOTO_DAY.request, dinner: "late" },
      changed: "dinner",
      windows: [
        { from: 4, to: 4 },
        { from: 6, to: 7 },
      ],
      idPrefix: "r2",
    };
    const lunch = stopAt("Soba near Okazaki", "13:10", 60);
    const walk = stopAt("Kamo River at Sanjo", "16:00", 60);
    const dinner = stopAt("Izakaya along Kiyamachi", "20:30", 90);

    const done = replanFrameOf(basis, writing([lunch, walk, dinner], { alternatives: [] }));

    // From 12:30, when the 11:15 stop ends, to 15:00; and from 15:50 to the day's end.
    expect(done.windows).toEqual([
      { opens: 750, closes: 900 },
      { opens: 950, closes: null },
    ]);
    expect(done.replaced).toEqual(["stop-4", "stop-6", "stop-7"]);
    expect(done.proposed).toEqual(["r2-stop-0", "r2-stop-1", "r2-stop-2"]);
    expect(windowsOf(basis.itinerary, basis.windows)).toEqual(done.windows);
  });

  it("shows a whole new stop as the merge will: one outside the window gone, one past it cut short", () => {
    const early = stopAt("Shoren-in", "09:00", 20);
    const long = stopAt("Awata Shrine", "09:30", 60);
    const afternoon = stopAt("Heian Shrine", "15:00", 45);

    const frame = replanFrameOf(
      KYOTO_MORNING_BASIS,
      writing([early, long, afternoon], { dek: "" }),
    );
    const news = frame.rows.flatMap((row) => (row.source === "proposed" ? [row.stop] : []));

    expect(news.map(({ id, durationMinutes }) => [id, durationMinutes])).toEqual([
      ["r1-stop-0", 20],
      ["r1-stop-1", 30],
    ]);
    expect(frame.isLost).toBe(true);
    expect(timesOf(frame)).toEqual(
      timesOfDay(merged(KYOTO_MORNING_BASIS, whole([early, long, afternoon]))),
    );
  });

  it("keeps a short stop that fits, before the next kept stop or at the day's open end", () => {
    const basis: ReplanBasis = {
      ...KYOTO_MORNING_BASIS,
      windows: [
        { from: 0, to: 1 },
        { from: 7, to: 7 },
      ],
    };
    const temple = stopAt("Shoren-in", "09:00", 40);
    const tea = stopAt("Tea at the Awata gate", "09:48", 10);
    const nightcap = stopAt("Sake along Kiyamachi", "22:30", 10);
    const stops = [temple, tea, nightcap];

    const frame = replanFrameOf(basis, writing(stops, { alternatives: [] }));

    expect(timesOf(frame)).toEqual(timesOfDay(merged(basis, whole(stops))));
    expect(frame.rows.at(-1)?.stop).toMatchObject({ id: "r1-stop-2", durationMinutes: 10 });
  });

  it("cuts a new stop at the next new one, as the normalizer will before the merge", () => {
    const temple = stopAt("Shoren-in", "09:00", 40);
    const shrine = stopAt("Awata Shrine", "09:30", 15);

    const frame = replanFrameOf(KYOTO_MORNING_BASIS, writing([temple, shrine], { dek: "" }));

    expect(frame.rows.find((row) => row.stop.id === "r1-stop-0")?.stop.durationMinutes).toBe(30);
    expect(timesOf(frame)).toEqual(
      timesOfDay(merged(KYOTO_MORNING_BASIS, whole([temple, shrine]))),
    );
  });

  it("knows production's Elche is lost in the frame its repeated coffee is whole", () => {
    const text = JSON.stringify(ELCHE_LATE_DINNER);
    const coffee = text.indexOf('"Coffee on');
    const after = text.indexOf('"startTime"', coffee);

    const before = replanFrameOf(ELCHE_DINNER_BASIS, {
      ...ELCHE_LATE_DINNER,
      stops: ELCHE_LATE_DINNER.stops.slice(0, 2),
      alternatives: undefined,
      dek: undefined,
    });
    const lost = replanFrameOf(ELCHE_DINNER_BASIS, {
      ...ELCHE_LATE_DINNER,
      stops: ELCHE_LATE_DINNER.stops.slice(0, 4),
      alternatives: undefined,
      dek: undefined,
    });

    expect(after).toBeGreaterThan(coffee);
    expect(before.isLost).toBe(false);
    expect(lost.isLost).toBe(true);
  });
});

describe("frameStopsOf", () => {
  it("draws the day's stops, and a proposal's only once whole, with its plan alone", () => {
    // The first new stop whole, the second only placed, its start still being written.
    const partial: PartialReplanDraft = {
      stops: [
        at(KYOTO_SLOW_MORNING.stops, 0),
        { startTime: "09:40", durationMinutes: 15, place: { name: "Awata Sh" } },
      ],
    };
    const frame = replanFrameOf(KYOTO_MORNING_BASIS, partial);
    const drawn = frameStopsOf(frame);

    expect(frame.rows.some((row) => row.source === "proposed" && !row.isWhole)).toBe(true);
    expect(drawn.map(({ id }) => id)).toEqual(
      frame.rows
        .filter((row) => row.source !== "proposed" || row.isWhole)
        .map((row) => row.stop.id),
    );
    // Whole, the frame draws the day and the proposal beside it, the proposal's with no versions.
    const done = frameStopsOf(replanFrameOf(KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING_WITH_VERSIONS));
    const proposed = done.filter(({ id }) => id.startsWith("r1-"));
    expect(done.length).toBe(KYOTO_ITINERARY.stops.length + proposed.length);
    expect(proposed.every((stop) => stop.alternatives.length === 0)).toBe(true);
    expect(proposed.every((stop) => stop.selectedPlaceId === stop.primary.id)).toBe(true);
  });
});

describe("the versions a proposal's stream writes", () => {
  // The new stops' versions are read by the rule the merge's normalizer applies, so a version
  // written while the proposal streams is never one the merged day lets go.
  it("writes the new stops' versions within the walk, and none that leave as it lands", async () => {
    const written = new Map<string, string>();

    const outcome = await readReplanStream({
      basis: KYOTO_MORNING_BASIS,
      response: Promise.resolve(streamOf(KYOTO_SLOW_MORNING_WITH_VERSIONS)),
      onPartial: (partial) => {
        for (const row of replanFrameOf(KYOTO_MORNING_BASIS, partial).rows) {
          if (row.source !== "proposed") continue;
          for (const version of row.stop.alternatives) {
            written.set(version.id, version.name ?? "");
          }
        }
      },
    });
    const day = dayAfterReplan(KYOTO_MORNING_BASIS, outcome);
    const kept = new Set(day.stops.flatMap((stop) => stop.alternatives.map(({ id }) => id)));

    expect(outcome.kind).toBe("complete");
    expect([...written].map(([, name]) => name)).toEqual(["Chion-in", "Okazaki Park"]);
    expect([...written].filter(([id]) => !kept.has(id))).toEqual([]);
  });
});

describe("a stop the visitor picked a version of, written again as it at its hour", () => {
  it("stands as the day's own row, one for both paths, and merges as the server merges it", async () => {
    const temple = at(KYOTO_ITINERARY.stops, 0);
    const kept = keptPlaceNamesOf(KYOTO_ITINERARY, KYOTO_MORNING_BASIS.windows);
    const pick = temple.alternatives.find(({ name }) => !kept.includes(name));
    if (pick === undefined) throw new Error("Kyoto's temple has a version of its own");
    // The page's own basis, its picked stop planned on the visitor's place.
    const basis = replanBasisOf({
      itinerary: KYOTO_ITINERARY,
      basis: null,
      request: KYOTO_MORNING_BASIS.request,
      changed: "start",
      windows: KYOTO_MORNING_BASIS.windows,
      round: 1,
      picks: { [temple.id]: pick.id },
    });
    const first = at(KYOTO_SLOW_MORNING.stops, 0);
    const replan: GeneratedReplan = {
      ...KYOTO_SLOW_MORNING,
      stops: [
        { ...first, startTime: temple.startTime, place: { ...first.place, name: pick.name } },
      ],
      alternatives: [],
    };
    const frames: ReplanFrame[] = [];

    const outcome = await readReplanStream({
      basis,
      response: Promise.resolve(streamOf(replan)),
      onPartial: (partial) => frames.push(replanFrameOf(basis, partial)),
    });

    const last = at(frames, frames.length - 1);
    const row = last.rows.find(({ stop }) => stop.id === temple.id);
    expect(row?.source).toBe("stays");
    // Drawn as the day has it, the visitor's pick on it.
    expect(frameStopsOf(last).find(({ id }) => id === temple.id)).toBe(
      basis.itinerary.stops.find(({ id }) => id === temple.id),
    );
    const day = dayAfterReplan(basis, outcome);
    const result = mergeReplan({ ...basis, replan });
    if (!result.ok) throw new Error(result.reason);
    expect(day.stops[0]).toEqual(result.itinerary.stops[0]);
    expect(day.stops[0]).toMatchObject({ id: temple.id, selectedPlaceId: pick.id });
  });
});

describe("Elche's dinner, a fork of two parts", () => {
  const garden = at(ELCHE_DINNER_BASIS.itinerary.stops, 6);

  /** Every frame of Elche's dinner proposal as the page reads its stream, and its end. */
  async function elcheFrames(): Promise<{ frames: ReplanFrame[]; day: Itinerary }> {
    const frames: ReplanFrame[] = [];
    const outcome = await readReplanStream({
      basis: ELCHE_DINNER_BASIS,
      response: Promise.resolve(streamOf(ELCHE_LATE_DINNER_UNREPEATED)),
      onPartial: (partial) => frames.push(replanFrameOf(ELCHE_DINNER_BASIS, partial)),
    });
    return { frames, day: dayAfterReplan(ELCHE_DINNER_BASIS, outcome) };
  }

  it("keeps the garden one row of the day's from first to last, shared by both paths", async () => {
    const { frames, day } = await elcheFrames();
    const gardens = frames.map((frame) => frameStopsOf(frame).find(({ id }) => id === garden.id));

    expect(gardens.every((stop) => stop === garden)).toBe(true);
    expect(frames.at(-1)?.replaced).not.toContain(garden.id);
    expect(day.stops.find(({ id }) => id === garden.id)?.primary).toBe(garden.primary);
  });

  it("draws the day whole beside its proposal: lunch and evening both, nothing of the day gone", async () => {
    const { frames } = await elcheFrames();
    const last = at(frames, frames.length - 1);

    expect(last.replaced).toEqual(["stop-4", "stop-7", "stop-8"]);
    expect(last.proposed).toEqual(["r1-stop-0", "r1-stop-2", "r1-stop-3"]);
    // Every frame draws every stop of the day.
    for (const frame of frames) {
      const ids = new Set(frameStopsOf(frame).map(({ id }) => id));
      expect(ELCHE_DINNER_BASIS.itinerary.stops.every(({ id }) => ids.has(id))).toBe(true);
    }
  });

  it("writes a new row's versions all at once, when its set is whole", async () => {
    const { frames } = await elcheFrames();
    const countsOf = (id: string) => [
      ...new Set(
        frames.flatMap((frame) => {
          const row = frame.rows.find((each) => each.stop.id === id);
          return row?.source === "proposed" ? [row.stop.alternatives.length] : [];
        }),
      ),
    ];

    for (const id of ["r1-stop-0", "r1-stop-2", "r1-stop-3"]) {
      // None, then the whole set: never a version at a time.
      expect(countsOf(id)).toHaveLength(2);
      expect(countsOf(id)[0]).toBe(0);
    }
  });

  it("says which stops a proposal adds by its prefix, the garden keeping an id of its own", () => {
    const frame = replanFrameOf(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED);
    const added = frame.rows.filter((row) => row.stop.id.startsWith(`${frame.idPrefix}-`));

    expect(frame.idPrefix).toBe("r1");
    expect(added.map(({ source }) => source)).toEqual(["proposed", "proposed", "proposed"]);
  });
});

describe("newStopsOf", () => {
  it("says no stop is new where no re-plan's are, and each prefix's own stops where they are", () => {
    const stops = [
      { id: "stop-0" },
      { id: "r1-stop-0" },
      { id: "r12-stop-0" },
      { id: "r2-stop-1" },
    ];

    expect([...newStopsOf(stops, [])]).toEqual([]);
    expect([...newStopsOf(stops, ["r1"])]).toEqual(["r1-stop-0"]);
    expect([...newStopsOf(stops, ["r1", "r2"])]).toEqual(["r1-stop-0", "r2-stop-1"]);
  });
});

describe("forkFrameOf", () => {
  const before = ELCHE_DINNER_BASIS.itinerary.stops;
  const after = merged(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED).stops;
  const windows = windowsOf(ELCHE_DINNER_BASIS.itinerary, ELCHE_DINNER_BASIS.windows);

  it("draws the proposal whole beside the day, as the stream's last frame drew it", () => {
    const frame = forkFrameOf(before, after, "r1", windows, "proposed");
    const streamed = replanFrameOf(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED);

    expect(frame.proposed).toEqual(streamed.proposed);
    expect(frame.replaced).toEqual(streamed.replaced);
    expect(frameStopsOf(frame).map(({ id }) => id)).toEqual(
      frameStopsOf(streamed).map(({ id }) => id),
    );
    expect(frame.fading).toBeUndefined();
  });

  it("draws the day before beside the proposal taken, its own stops the other's", () => {
    const frame = forkFrameOf(after, before, "r1", windows, "proposed");

    expect(frame.proposed).toEqual(["stop-4", "stop-7", "stop-8"]);
    expect(frame.replaced).toEqual(["r1-stop-0", "r1-stop-2", "r1-stop-3"]);
  });

  it("fades the other version where it stands as the fork folds it, none of it proposed", () => {
    const taking = forkFrameOf(after, before, "r1", windows, "fading");
    const leaving = forkFrameOf(before, after, "r1", windows, "fading");

    expect(taking.fading).toEqual(["stop-4", "stop-7", "stop-8"]);
    expect(taking.proposed).toEqual([]);
    expect(taking.replaced).toEqual([]);
    expect(leaving.fading).toEqual(["r1-stop-0", "r1-stop-2", "r1-stop-3"]);
    // Every stop of the day stays drawn while the other's fade.
    const drawn = new Set(frameStopsOf(taking).map(({ id }) => id));
    expect(after.every(({ id }) => drawn.has(id))).toBe(true);
  });
});

describe("forkAnchorsOf", () => {
  const before = ELCHE_DINNER_BASIS.itinerary.stops;
  const after = merged(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED).stops;
  const windows = windowsOf(ELCHE_DINNER_BASIS.itinerary, ELCHE_DINNER_BASIS.windows);

  it("stands each part's row over its first stop on screen, whichever version is the day", () => {
    const proposed = frameStopsOf(forkFrameOf(before, after, "r1", windows, "proposed"));

    expect(forkAnchorsOf(before, windows)).toEqual(["stop-4", "stop-6"]);
    expect(forkAnchorsOf(after, windows)).toEqual(["r1-stop-0", "stop-6"]);
    expect(forkAnchorsOf(proposed, windows)).toEqual([proposed[4]?.id, "stop-6"]);
  });

  it("stands a whole day's one row over its first stop, and none over an empty day", () => {
    expect(forkAnchorsOf(before, [WHOLE_DAY_WINDOW])).toEqual(["stop-0"]);
    expect(forkAnchorsOf([], [WHOLE_DAY_WINDOW])).toEqual([null]);
  });
});
