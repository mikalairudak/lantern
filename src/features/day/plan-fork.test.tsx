import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { completeDraftOf, type StopDraft } from "@/features/abacus/day-draft";
import { replanForEnergy } from "@/features/abacus/replan";
import { WHOLE_DAY_WINDOW } from "@/features/abacus/replan-frame";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { ENERGY_LEVELS } from "@/lib/schema/itinerary.schema";
import { asShownOf, forkOtherAt, planForkOf, slipPlacementOf, useSlipPlacement } from "./plan-fork";

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

/** A column and the box as wide as it is whole, each at a width the test sets. */
function Placed({ column, whole }: { column: number; whole: number }) {
  const [columnBox, setColumnBox] = useState<HTMLDivElement | null>(null);
  const [wholeBox, setWholeBox] = useState<HTMLDivElement | null>(null);
  const placement = useSlipPlacement(columnBox, wholeBox);
  return (
    <div>
      <div ref={setColumnBox} data-width={column} />
      <div ref={setWholeBox} data-width={whole} />
      <p>{placement}</p>
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

  it("stands the slip in the column until both boxes are measured", () => {
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
});
