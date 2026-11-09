import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import type { WrittenDay } from "@/lib/days/written/written-day";
import { CROWDED_DAY, MINIMAL_DAY, NEVER_QUIET_DAY } from "@/lib/fixtures/edge/edge-days";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { CANDIDATE_ATTRIBUTE, ChartStop } from "./chart-stop";
import { midOf, modelPick } from "./curve";
import { completeDraftOf, hasEnergy, type StopDraft } from "./day-draft";
import { chartScale, dayBounds } from "./geometry";

const CHART_WIDTH = 358;
const CHART_HEIGHT = 640;

function stopsOf({ request, day }: Pick<WrittenDay, "request" | "day">): StopDraft[] {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`The fixture does not normalize: ${normalized.reason}`);
  return completeDraftOf(normalized.itinerary).stops;
}

interface RenderOptions {
  /** The place the pointer names, as the chart passes it down. */
  hoveredPlace?: string | null;
  /** False draws the stop as a copy no pointer or key reaches. */
  isInteractive?: boolean;
  onChoose?: (candidate: number) => void;
  /** A still's slider held as the keys' focus holds it. */
  isKeyed?: boolean;
}

/** One stop of a finished day drawn on its wire, found by its start time. */
function drawStop(
  stops: readonly StopDraft[],
  startTime: string,
  {
    hoveredPlace = null,
    isInteractive = true,
    onChoose = () => undefined,
    isKeyed = false,
  }: RenderOptions = {},
): void {
  const stop = stops.find((each) => each.startTime === startTime);
  if (!stop || !hasEnergy(stop)) throw new Error(`No stop with its energy starts at ${startTime}`);
  const bounds = dayBounds(stops);
  const shown = modelPick(stop);
  render(
    <svg>
      <ChartStop
        stop={stop}
        scale={chartScale(CHART_WIDTH, CHART_HEIGHT, bounds.start, bounds.end)}
        selected={shown}
        committed={shown}
        mid={midOf(stops, stop)}
        isRewritten={false}
        beadEnergy={0}
        isFilled
        isArriving={false}
        isFollowing={false}
        isInteractive={isInteractive}
        curveEnergy={null}
        hoveredPlace={hoveredPlace}
        onHoverPlace={() => undefined}
        onPullTo={() => undefined}
        onChoose={onChoose}
        isKeyed={isKeyed}
        onFocusChange={() => undefined}
      />
    </svg>,
  );
}

/** One stop of a finished day on its wire, ready for the keyboard: its energy slider. */
function renderStop(stops: readonly StopDraft[], startTime: string): HTMLElement {
  drawStop(stops, startTime);
  return screen.getByRole("slider", { name: `Energy at ${startTime}` });
}

/** The slider's range as it says it: its least and its greatest value. */
function rangeOf(slider: HTMLElement): [number, number] {
  return [
    Number(slider.getAttribute("aria-valuemin")),
    Number(slider.getAttribute("aria-valuemax")),
  ];
}

describe("a stop's energy slider", () => {
  const kyoto = stopsOf(KYOTO_DAY);

  it.each([
    ["07:30", "reflective to calm", [0, 1]],
    ["08:25", "reflective to balanced", [0, 2]],
    ["15:00", "calm to lively", [1, 3]],
  ] as const)(
    "at %s runs from its quietest version to its liveliest, %s",
    (startTime, _words, range) => {
      expect(rangeOf(renderStop(kyoto, startTime))).toEqual(range);
    },
  );

  it("holds a stop with one version at that version's energy", () => {
    const slider = renderStop(stopsOf(MINIMAL_DAY), "10:00");

    expect(rangeOf(slider)).toEqual([0, 0]);
    expect(slider).toHaveAttribute("aria-valuenow", "0");
  });

  it("spans the whole scale when a stop's versions reach both ends of it", () => {
    expect(rangeOf(renderStop(stopsOf(CROWDED_DAY), "11:00"))).toEqual([0, 4]);
  });
});

describe("a stop whose three versions share one energy", () => {
  it("draws each on the wire with a whole target of its own", () => {
    drawStop(stopsOf(NEVER_QUIET_DAY), "12:00");

    const targets = [...document.querySelectorAll(`[${CANDIDATE_ATTRIBUTE}] path`)].map(
      (path) => path.getAttribute("d") ?? "",
    );
    // The shown version and its two twins: two beads drawn hollow, each a 24 px circle.
    expect(targets).toHaveLength(2);
    for (const d of targets) {
      const [right, left] = [...d.matchAll(/[ML]([\d.]+) /g)].map((match) => Number(match[1]));
      expect(d).toMatch(/A12 12 0 0 0 [\d.]+ [\d.]+ L[\d.]+ [\d.]+ A12 12 0 0 0/);
      expect(right! - left!).toBeCloseTo(24);
    }
  });
});

describe("a stop's beads", () => {
  const kyoto = stopsOf(KYOTO_DAY);
  const stop = kyoto.find((each) => each.startTime === "08:25");
  const named = stop?.alternatives[0]?.id ?? null;

  /** The classes of the bead drawn for a place, one by one. */
  const fillOf = (placeId: string | null) =>
    document
      .querySelector(`[${CANDIDATE_ATTRIBUTE}="${placeId}"] circle`)
      ?.getAttribute("class")
      ?.split(" ");

  it("fills the bead the pointer names, as its hover does", () => {
    drawStop(kyoto, "08:25", { hoveredPlace: named });
    expect(fillOf(named)).toContain("fill-swap-drawn");
    expect(fillOf(named)).not.toContain("fill-ground");
  });

  // The beads above an open sheet are drawn again over it; no pointer reaches that copy.
  it("fills it in a copy no pointer reaches, so the two halves agree", () => {
    drawStop(kyoto, "08:25", { hoveredPlace: named, isInteractive: false });
    expect(fillOf(named)).toContain("fill-swap-drawn");
  });

  it("leaves the others to their own hover", () => {
    drawStop(kyoto, "08:25");
    expect(fillOf(named)).toEqual(
      expect.arrayContaining(["fill-ground", "group-hover:fill-swap-drawn"]),
    );
    expect(fillOf(named)).not.toContain("fill-swap-drawn");
  });
});

describe("a version's bead to a screen reader", () => {
  const kyoto = stopsOf(KYOTO_DAY);

  it("is named by its version and the way it goes, and is no stop of the Tab order", () => {
    drawStop(kyoto, "11:15");
    const beads = screen.getAllByRole("button");

    expect(beads.map((bead) => bead.getAttribute("aria-label"))).toEqual([
      "Tofu on the approach road, quieter",
      "Tofu courses near Keage, livelier",
    ]);
    for (const bead of beads) expect(bead).toHaveAttribute("tabindex", "-1");
  });

  it("is picked by a screen reader's press, which comes with no pointer behind it", () => {
    const chosen: number[] = [];
    drawStop(kyoto, "11:15", { onChoose: (candidate) => chosen.push(candidate) });

    fireEvent.click(screen.getByRole("button", { name: /Keage/ }), { detail: 0 });
    expect(chosen).toEqual([2]);
  });

  it("leaves the reader on the stop's slider once it is taken, never nowhere", () => {
    drawStop(kyoto, "11:15");

    fireEvent.click(screen.getByRole("button", { name: /Keage/ }), { detail: 0 });
    expect(screen.getByRole("slider", { name: "Energy at 11:15" })).toHaveFocus();
  });

  it("is picked by Enter, and by Space on its release, as a button is, and scrolls nothing", () => {
    const chosen: number[] = [];
    drawStop(kyoto, "11:15", { onChoose: (candidate) => chosen.push(candidate) });
    const bead = () => screen.getByRole("button", { name: /Keage/ });

    // A default prevented is no scroll: fireEvent says false.
    expect(fireEvent.keyDown(bead(), { key: "Enter" })).toBe(false);
    expect(chosen).toEqual([2]);
    expect(fireEvent.keyDown(bead(), { key: " " })).toBe(false);
    expect(chosen).toEqual([2]);
    fireEvent.keyUp(bead(), { key: " " });
    expect(chosen).toEqual([2, 2]);
    // Any other key is the page's.
    expect(fireEvent.keyDown(bead(), { key: "a" })).toBe(true);
    expect(chosen).toEqual([2, 2]);
  });

  it("leaves a pointer's click to the chart, which picks it from the press", () => {
    const chosen: number[] = [];
    drawStop(kyoto, "11:15", { onChoose: (candidate) => chosen.push(candidate) });

    fireEvent.click(screen.getByRole("button", { name: /Keage/ }), { detail: 1 });
    expect(chosen).toEqual([]);
  });

  it("leaves its slider's ring to the keys' focus, but in a still that holds that focus", () => {
    drawStop(kyoto, "11:15");
    const ringOf = () => screen.getByRole("slider").querySelector("circle")?.getAttribute("class");
    expect(ringOf()).toContain("opacity-0");
    cleanup();

    drawStop(kyoto, "11:15", { isKeyed: true });
    expect(ringOf()).toContain("opacity-100");
    expect(ringOf()).not.toContain("opacity-0");
  });

  it("is unheard in a copy no pointer reaches, and while the day is written", () => {
    drawStop(kyoto, "11:15", { isInteractive: false });
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
