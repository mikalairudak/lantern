import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { completeDraftOf, type StopDraft } from "@/features/abacus/day-draft";
import { replanForEnergy } from "@/features/abacus/replan";
import {
  WHOLE_DAY_WINDOW,
  frameStopsOf,
  replanFrameOf,
  windowsOf,
  writtenVersionOf,
} from "@/features/abacus/replan-frame";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { useArrivals } from "@/features/abacus/use-arrivals";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER_UNREPEATED,
  ELCHE_REQUEST,
} from "@/lib/fixtures/replan/elche-dinner";
import { KYOTO_ITINERARY, KYOTO_MORNING_BASIS } from "@/lib/fixtures/replan/kyoto-morning";
import { mergeShownReplan, type ReplanBasis } from "@/lib/replan/merge";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import { forkReceiptOf, slipLinesOf } from "./part-slip-lines";
import {
  asShownOf,
  chartArrivalsOf,
  forkOtherAt,
  headKeysOf,
  planForkOf,
  proposedAtOf,
  slipPlacementOf,
  useSlipPlacement,
} from "./plan-fork";

/** A stop at a place, as far as the plan's fork reads it. */
function stopAt(id: string, startTime: string, durationMinutes: number, name: string): StopDraft {
  return {
    id,
    startTime,
    durationMinutes,
    primary: { id: `${id}:p`, name, kind: "museum" },
    alternatives: [],
    selectedPlaceId: `${id}:p`,
  };
}

const HOUR = 60;
const COFFEE = stopAt("stop-0", "10:00", 60, "Coffee on the Oudegracht");
const TOWER = stopAt("stop-1", "11:15", 75, "Domtoren");
const LUNCH = stopAt("stop-2", "12:45", 60, "Pancakes on the Domplein");
const MUSEUM = stopAt("stop-3", "14:15", 90, "Centraal Museum");

describe("headKeysOf", () => {
  it("keeps a part's key through a take, whose windows stand", () => {
    const windows = [
      { opens: 720, closes: 900 },
      { opens: 1080, closes: null },
    ];
    expect(headKeysOf(windows)).toEqual(headKeysOf([...windows]));
    expect(new Set(headKeysOf(windows)).size).toBe(2);
  });

  it("keeps the key of a part that opens the day when the change is sent on to the whole day", () => {
    expect(headKeysOf([{ opens: null, closes: 900 }])).toEqual(headKeysOf([WHOLE_DAY_WINDOW]));
  });

  it("gives another key to a part that opens at another hour", () => {
    expect(headKeysOf([{ opens: 1080, closes: null }])).not.toEqual(headKeysOf([WHOLE_DAY_WINDOW]));
  });
});

describe("slipPlacementOf", () => {
  it("stands the slip in the margin once the day's column is whole, and in the column short of it", () => {
    expect(slipPlacementOf(1024, 1024)).toBe("margin");
    expect(slipPlacementOf(1134, 1134)).toBe("margin");
    // A classic scrollbar's 15 px short of whole, at a viewport a breakpoint would call wide.
    expect(slipPlacementOf(1009, 1024)).toBe("column");
    expect(slipPlacementOf(358, 1024)).toBe("column");
  });

  it("reads a column a part of a pixel short as whole, and one not yet measured as short", () => {
    expect(slipPlacementOf(1023.6, 1024)).toBe("margin");
    expect(slipPlacementOf(1023.4, 1024)).toBe("column");
    expect(slipPlacementOf(0, 0)).toBe("column");
  });
});

describe("planForkOf", () => {
  const DAY = [COFFEE, TOWER, LUNCH, MUSEUM];

  it("gives each part its stops in either version, its slip over the part's first stop", () => {
    const park = stopAt("r1-stop-2", "10:00", 90, "Park Lepelenburg");
    const morning = { opens: null, closes: 12 * HOUR + 45 };
    const afternoon = { opens: 13 * HOUR + 45, closes: null };

    const fork = planForkOf(DAY, [park, LUNCH, MUSEUM], [morning, afternoon]);

    expect(fork.shown).toEqual([[COFFEE, TOWER], [MUSEUM]]);
    expect(fork.other).toEqual([[park], [MUSEUM]]);
    // A part that starts the day stands over the day's first stop.
    expect(fork.anchors).toEqual(["stop-0", "stop-3"]);
  });

  it("stands the slip of a part the day has no stop in over the first stop after it", () => {
    const evening = stopAt("r1-stop-0", "18:00", 90, "Dinner on the Oudegracht");
    const gap = { opens: 11 * HOUR + 15 + 75, closes: 14 * HOUR + 15 };

    const fork = planForkOf([COFFEE, TOWER, MUSEUM], [evening], [gap]);

    expect(fork.shown).toEqual([[]]);
    expect(fork.anchors).toEqual(["stop-3"]);
  });

  it("stands a part with no stop of the day after it under the last row", () => {
    const night = { opens: 15 * HOUR + 45, closes: null };

    expect(planForkOf(DAY, [], [night]).anchors).toEqual([null]);
  });

  it("takes every stop into a whole day's one part, from none of the other written to all", () => {
    expect(planForkOf(DAY, [], [WHOLE_DAY_WINDOW])).toEqual({
      shown: [DAY],
      other: [[]],
      anchors: ["stop-0"],
    });
    expect(planForkOf(DAY, [LUNCH], [WHOLE_DAY_WINDOW]).other).toEqual([[LUNCH]]);
  });

  it("finds a part past midnight on the day's running clock", () => {
    const cocktails = stopAt("stop-0", "23:30", 60, "Cocktails in Príncipe Real");
    const river = stopAt("stop-1", "00:45", 120, "Late drinks on the river");
    const afterMidnight = { opens: 24 * HOUR + 30, closes: null };

    expect(planForkOf([cocktails, river], [], [afterMidnight]).anchors).toEqual(["stop-1"]);
  });
});

describe("planForkOf while a part past midnight is written", () => {
  // Kyoto run late: its last three stops at 19:00, 21:30 and midnight, the last one the window,
  // which opens at 23:00, as the frame's own test reads it.
  const lateTimes: Readonly<Record<number, [string, number]>> = {
    5: ["19:00", 120],
    6: ["21:30", 90],
    7: ["00:00", 45],
  };
  const basis: ReplanBasis = {
    ...KYOTO_MORNING_BASIS,
    windows: [{ from: 7, to: 7 }],
    itinerary: {
      ...KYOTO_ITINERARY,
      stops: KYOTO_ITINERARY.stops.map((stop, index) => {
        const [startTime, durationMinutes] = lateTimes[index] ?? [
          stop.startTime,
          stop.durationMinutes,
        ];
        return { ...stop, startTime, durationMinutes };
      }),
    },
  };
  const template = KYOTO_DAY.day.stops[0]!;
  const stopAtNight = (name: string, startTime: string, durationMinutes: number) => ({
    ...template,
    startTime,
    durationMinutes,
    place: { ...template.place, name },
  });

  it("lists each stop of the part once it is written, on the day's running clock", () => {
    const sake = stopAtNight("Sake along Kiyamachi", "00:10", 40);
    const ramen = stopAtNight("Ramen on Kiyamachi", "01:00", 30);
    // The first written, the second begun: the first's line is due.
    const frame = replanFrameOf(basis, { stops: [sake, ramen] });
    const proposed = new Set(frame.proposed);
    const day = frameStopsOf(frame).filter(({ id }) => !proposed.has(id));

    const fork = planForkOf(day, writtenVersionOf(frame), frame.windows);

    expect(fork.other[0]?.map(({ primary }) => primary.name)).toEqual(["Sake along Kiyamachi"]);
  });
});

describe("asShownOf", () => {
  it("shows each stop as the visitor sees it: a version swapped in, the plan elsewhere", () => {
    const [market] = completeDraftOf(itineraryOf(LISBON_DAY)).stops;
    if (!market?.alternatives[0]) throw new Error("Lisbon's first stop has a version");
    const version = market.alternatives[0].id;

    const [shown, tower] = asShownOf([market, TOWER], { [market.id]: version });

    expect(shown?.selectedPlaceId).toBe(version);
    expect(tower).toBe(TOWER);
  });
});

describe("chartArrivalsOf", () => {
  it("has a proposal's row the chart draws re-picked arrive as its stop has, its bead filled", () => {
    // Kyoto's day on the chart, there from its first render, with motion: each stop settled.
    const { stops } = completeDraftOf(itineraryOf(KYOTO_DAY));
    const { result } = renderHook(() => useArrivals(stops, 1));
    const stop = stops.find(({ alternatives }) => alternatives.length > 0)!;
    // Its other version re-picks it to a version: the chart draws that place alone.
    const repicked = { ...stop, selectedPlaceId: stop.alternatives[0]!.id };
    const [row] = proposedAtOf([stop], new Set([stop.id]), [repicked]);
    expect(row!.primary.id).not.toBe(stop.primary.id);

    const arrival = chartArrivalsOf(result.current, stops).of(row!);

    expect(arrival).toEqual(result.current.of(stop));
    expect(arrival.isReady).toBe(true);
  });

  it("slides a proposal's row re-picked as it arrives towards the place it draws, not the one written", async () => {
    // A stop written reflective, its version social, arriving on a chart asked balanced.
    const [base] = completeDraftOf(itineraryOf(KYOTO_DAY)).stops.filter(
      ({ alternatives }) => alternatives.length > 0,
    );
    const written = {
      ...base!.primary,
      sensory: { ...base!.primary.sensory!, energy: "reflective" },
    };
    const version = {
      ...base!.alternatives[0]!,
      sensory: { ...base!.alternatives[0]!.sensory, energy: "social" },
    };
    const stop: StopDraft = {
      ...base!,
      primary: written,
      alternatives: [version],
      selectedPlaceId: written.id,
    } as StopDraft;
    const balanced = ENERGY_LEVELS.indexOf("balanced");
    const { result, rerender } = renderHook(({ day }) => useArrivals(day, balanced), {
      initialProps: { day: [] as StopDraft[] },
    });
    rerender({ day: [stop] });
    // Re-picked to its social version while its bead slides in.
    const [row] = proposedAtOf([stop], new Set([stop.id]), [
      { ...stop, selectedPlaceId: version.id },
    ]);

    const slide = await waitFor(() => {
      const now = result.current.of(stop).slide;
      if (now === null || now === balanced) throw new Error("Not sliding yet");
      return chartArrivalsOf(result.current, [stop]).of(row!).slide;
    });

    // On its way up, to the social place the row draws, never down to the written one.
    expect(slide).toBeGreaterThan(balanced);
  });
});

describe("forkOtherAt", () => {
  const LISBON = completeDraftOf(itineraryOf(LISBON_DAY)).stops;
  const lively = ENERGY_LEVELS.indexOf("lively");

  it("re-picks the other version for the energy chosen, from the one it was planned for", () => {
    const repicked = forkOtherAt({ stops: LISBON, energy: "calm" }, "lively");

    expect(repicked).toEqual(replanForEnergy(LISBON, ENERGY_LEVELS.indexOf("calm"), lively));
    expect(repicked.map(({ selectedPlaceId }) => selectedPlaceId)).not.toEqual(
      LISBON.map(({ selectedPlaceId }) => selectedPlaceId),
    );
  });

  it("lists it as written where it was planned for that energy, or none was chosen", () => {
    expect(forkOtherAt({ stops: LISBON, energy: "lively" }, "lively")).toEqual(LISBON);
    expect(forkOtherAt({ stops: LISBON, energy: "calm" }, null)).toBe(LISBON);
    expect(forkOtherAt(null, "lively")).toEqual([]);
  });
});

describe("forkReceiptOf", () => {
  // Elche's dinner eaten late, which rewrites its lunch and its evening: the day before and the
  // proposal, each re-picked as the page draws it at an energy.
  const merged = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
  if (!merged.ok) throw new Error("Elche's proposal merges");
  const windows = windowsOf(ELCHE_DINNER_BASIS.itinerary, ELCHE_DINNER_BASIS.windows);
  const change = { word: "dinner", from: "early dinner", to: "eating late" } as const;
  const drawnAt = (stops: StopDraft[], level: EnergyLevel | null) =>
    forkOtherAt({ stops, energy: ELCHE_REQUEST.energy }, level);
  const before = completeDraftOf(ELCHE_DINNER_BASIS.itinerary).stops;
  const after = completeDraftOf(merged.itinerary).stops;
  const forkAt = (level: EnergyLevel | null) => ({
    change,
    reach: "part" as const,
    windows,
    day: drawnAt(before, level),
    other: drawnAt(after, level),
  });
  /** The lines the slips list, every part's. */
  const linesAt = (level: EnergyLevel | null) => {
    const { day, other } = forkAt(level);
    const fork = planForkOf(day, other, windows);
    return fork.other.flatMap((part, at) =>
      slipLinesOf(fork.shown[at] ?? [], part, windows[at]?.opens ?? null),
    );
  };

  it("says the proposal as written: its hour, and the new stops its slips list", () => {
    expect(forkReceiptOf({ ...forkAt(null), side: "to" })).toEqual({
      words: "Dinner 21:00, not 18:15 · 3 new stops",
      end: "ends 23:45, not 20:45",
    });
  });

  it("counts what the slips list at the energy chosen, and names the meal the place drawn is", () => {
    // Social, the lunch and the afternoon stay, the night's walk moves from 20:00, and the late
    // stop is a bar, no dinner.
    expect(forkReceiptOf({ ...forkAt("social"), side: "to" })).toEqual({
      words: "1 new stop, 1 later",
      end: "ends 23:45, not 20:45",
    });
    expect(linesAt("social").map(({ mark }) => mark.kind)).toEqual([
      "stays",
      "stays",
      "new",
      "moved",
    ]);
  });

  it("counts as many new stops as its slips mark new, at every energy", () => {
    for (const level of [null, ...ENERGY_LEVELS]) {
      const words = forkReceiptOf({ ...forkAt(level), side: "to" }).words;
      const added = linesAt(level).filter(({ mark }) => mark.kind === "new").length;
      expect(words, `at ${level}`).toContain(added === 1 ? "1 new stop" : `${added} new stops`);
    }
  });

  it("says the day before's hour alone once the proposal is taken, by the place each shows", () => {
    const taken = (level: EnergyLevel | null) => {
      const { day, other } = forkAt(level);
      return forkReceiptOf({ ...forkAt(level), side: "from", day: other, other: day }).words;
    };

    expect(taken(null)).toBe("Dinner 18:15, not 21:00");
    // The proposal's late stop a bar, the day before's dinner is said at its own hour.
    expect(taken("social")).toBe("Dinner at 18:15");
  });

  it("counts a whole day's places kept, staying or moved, as the same", () => {
    const park = stopAt("stop-0", "09:00", 60, "Park Lepelenburg");
    const tower = { ...TOWER, startTime: "12:00" };

    const receipt = forkReceiptOf({
      change: { word: "company", from: "with anyone", to: "with friends" },
      reach: "whole",
      side: "to",
      day: [COFFEE, TOWER, LUNCH],
      other: [park, tower, LUNCH],
      windows: [WHOLE_DAY_WINDOW],
    });

    expect(receipt.words).toBe("With friends · 1 new stop, 2 the same");
  });
});

/** A column and the box as wide as it is whole, each at a width the test sets. */
function Placed({
  column,
  whole,
  isWholeDrawn = true,
}: {
  column: number;
  whole: number;
  isWholeDrawn?: boolean;
}) {
  const [columnBox, setColumnBox] = useState<HTMLDivElement | null>(null);
  const [wholeBox, setWholeBox] = useState<HTMLDivElement | null>(null);
  const placement = useSlipPlacement(columnBox, isWholeDrawn ? wholeBox : null);
  return (
    <div>
      <div ref={setColumnBox} data-width={column} />
      <div ref={setWholeBox} data-width={whole} />
      <p>{placement ?? "not yet"}</p>
    </div>
  );
}

describe("useSlipPlacement", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the day's column against its whole width, again as either is resized", () => {
    const resized: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(onResize: () => void) {
          resized.push(onResize);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return { width: Number(this.dataset.width ?? 0) } as DOMRect;
    });

    const { rerender } = render(<Placed column={1024} whole={1024} />);
    expect(screen.getByText("margin")).toBeInTheDocument();

    // A classic scrollbar appears: the column is 15 px short, and the browser says so.
    rerender(<Placed column={1009} whole={1024} />);
    act(() => resized.forEach((onResize) => onResize()));
    expect(screen.getByText("column")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("stands the slip in the column where both boxes measure nothing", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<Placed column={0} whole={0} />);

    expect(screen.getByText("column")).toBeInTheDocument();
  });

  it("says no place until both boxes are there to measure", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<Placed column={1024} whole={1024} isWholeDrawn={false} />);

    expect(screen.getByText("not yet")).toBeInTheDocument();
  });
});
