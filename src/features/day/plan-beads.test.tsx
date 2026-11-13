import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeDraftOf, draftDayOf, openableStopsOf } from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf, type ExampleDay } from "@/features/abacus/stop-row-examples";
import { revealedOf } from "@/features/itinerary/revealed";
import { partialAt } from "@/features/itinerary/stream-frames";
import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import {
  LATE_NIGHT_DAY,
  MIDNIGHT_SUN_DAY,
  MINIMAL_DAY,
  POLAR_NIGHT_DAY,
} from "@/lib/fixtures/edge/edge-days";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { runningSpans } from "@/lib/time/clock";
import { lightAt } from "./light-rail";
import { enteredOf } from "./reading-gates";
import { ReadingList } from "./reading-list";

/**
 * A stop's bead on the plan is lit exactly where the rail beside it begins dotted, after sunset
 * and before sunrise alike (`docs/decisions.md`, "A day opens on its plan, lit by the day's
 * light"), never on a proposal's stop, and never changes once its row is on the plan.
 */

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function wholeOf(fixture: ExampleDay) {
  const itinerary = itineraryOf(fixture);
  const { stops } = completeDraftOf(itinerary);
  return {
    stops,
    entered: stops.length,
    versionsShown: new Set(stops.map((stop) => stop.id)),
    picks: stops.map(() => 0),
    daylight: dayContextOf(itinerary),
  };
}

/** Each stop's bead on the plan, and whether the rail beside it begins dotted. */
function beadsOf(container: HTMLElement): { isLit: boolean; isDotted: boolean }[] {
  return [...container.querySelectorAll<HTMLElement>("[data-bead]")].map((bead) => {
    const firstLine = bead.parentElement?.querySelector("svg line");
    return {
      isLit: bead.dataset.bead === "lit",
      isDotted: firstLine?.getAttribute("stroke-dasharray") != null,
    };
  });
}

const EDGE_DAYS = [
  { name: "a polar night", fixture: POLAR_NIGHT_DAY },
  { name: "a midnight sun", fixture: MIDNIGHT_SUN_DAY },
  { name: "a night past midnight", fixture: LATE_NIGHT_DAY },
  { name: "one stop", fixture: MINIMAL_DAY },
];

describe("the plan's beads", () => {
  it.each(EDGE_DAYS)("are lit exactly where the rail is dotted, on $name", ({ fixture }) => {
    const { container } = render(<ReadingList {...wholeOf(fixture)} />);
    const beads = beadsOf(container);
    expect(beads).toHaveLength(fixture.day.stops.length);
    for (const bead of beads) expect(bead.isLit).toBe(bead.isDotted);
  });

  it("are every one lit on a polar night, none under a midnight sun", () => {
    const polar = render(<ReadingList {...wholeOf(POLAR_NIGHT_DAY)} />);
    expect(beadsOf(polar.container).every(({ isLit }) => isLit)).toBe(true);
    polar.unmount();
    const midnightSun = render(<ReadingList {...wholeOf(MIDNIGHT_SUN_DAY)} />);
    expect(beadsOf(midnightSun.container).some(({ isLit }) => isLit)).toBe(false);
  });

  it("are lit through a night past midnight, and ink by day", () => {
    const night = render(<ReadingList {...wholeOf(LATE_NIGHT_DAY)} />);
    expect(beadsOf(night.container).map(({ isLit }) => isLit)).toEqual([true, true, true]);
    night.unmount();
    const morning = render(<ReadingList {...wholeOf(MINIMAL_DAY)} />);
    expect(beadsOf(morning.container).map(({ isLit }) => isLit)).toEqual([false]);
  });

  it("draw a lit bead with its glow, and an ink one with none", () => {
    const { container } = render(<ReadingList {...wholeOf(KYOTO_DAY)} />);
    const beads = [...container.querySelectorAll<HTMLElement>("[data-bead]")];
    const lit = beads.find((bead) => bead.dataset.bead === "lit")!;
    const ink = beads.find((bead) => bead.dataset.bead === "ink")!;
    expect(lit.querySelector(".bg-lamp-glow")).not.toBeNull();
    expect(lit.querySelector(".border-lamp")).not.toBeNull();
    expect(ink.querySelector(".bg-lamp-glow")).toBeNull();
    expect(ink.querySelector(".border-ink")).not.toBeNull();
  });

  it("are never lit on a proposal's stop, and light once the proposal is taken", () => {
    const night = wholeOf(LATE_NIGHT_DAY);
    const proposed = new Set(night.stops.slice(1, 3).map((stop) => stop.id));
    const { container, rerender } = render(<ReadingList {...night} proposed={proposed} />);
    expect(beadsOf(container).map(({ isLit }) => isLit)).toEqual([true, false, false]);
    rerender(<ReadingList {...night} />);
    expect(beadsOf(container).map(({ isLit }) => isLit)).toEqual([true, true, true]);
    // The glow lit from the first frame stands whole; a taken stop's grows from the bead.
    const glows = [...container.querySelectorAll<HTMLElement>("[data-bead] .bg-lamp-glow")];
    expect(glows.map((glow) => glow.style.transform)).toEqual(["none", "scale(0.5)", "scale(0.5)"]);
  });
});

/**
 * Frames of a day's stream, every `step` characters, read as the plan reads them, and the day
 * complete as the stream's end leaves it, every stop let in.
 */
async function framesOf(fixture: ExampleDay, step: number) {
  const text = dayText(fixture.day);
  const frames = [];
  for (let at = 0; at < text.length; at += step) {
    const revealed = revealedOf(await partialAt(text, at), null);
    const draft = draftDayOf(revealed);
    frames.push({ draft, entered: enteredOf(draft.stops, openableStopsOf(revealed.day, draft)) });
  }
  const complete = completeDraftOf(itineraryOf(fixture));
  frames.push({ draft: complete, entered: complete.stops.length });
  return frames;
}

const FRAME_STEP = 40;

describe("the plan while a day streams", () => {
  it.each([
    { name: "Alicante", fixture: ALICANTE_DAY },
    { name: "a night past midnight", fixture: LATE_NIGHT_DAY },
  ])("lets no row in while the day has no position, on $name", async ({ fixture }) => {
    for (const { draft, entered } of await framesOf(fixture, FRAME_STEP)) {
      if (entered === 0) continue;
      const position = draft.stops[0]?.primary.coordinates;
      expect(position?.lat).toBeTypeOf("number");
      expect(position?.lng).toBeTypeOf("number");
    }
  });

  it.each([
    { name: "Alicante", fixture: ALICANTE_DAY },
    { name: "a night past midnight", fixture: LATE_NIGHT_DAY },
  ])(
    "lights each bead from its row's first frame as the whole day does, on $name",
    async ({ fixture }) => {
      const itinerary = itineraryOf(fixture);
      const daylight = dayContextOf(itinerary);
      const isLitAt = (from: number) => ["blue", "dark"].includes(lightAt(daylight, from));
      const whole = runningSpans(itinerary.stops).map(({ from }) => isLitAt(from));
      let seen = 0;
      for (const { draft, entered } of await framesOf(fixture, FRAME_STEP)) {
        const shown = runningSpans(draft.stops.slice(0, entered)).map(({ from }) => isLitAt(from));
        expect(shown).toEqual(whole.slice(0, entered));
        seen = Math.max(seen, entered);
      }
      expect(seen).toBe(whole.length);
    },
  );
});
