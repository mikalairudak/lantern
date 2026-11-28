import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { detailsOf } from "./stop-details";
import { DetailsPanel } from "./stop-details-view";
import { SCALE_BAND_ATTRIBUTE } from "./sticky-scale";

// The clock stands still until a test moves it, so a sheet rolling up is still rolling up
// however long a busy machine pauses. Set before any import runs, since Motion takes
// requestAnimationFrame when its module loads (`docs/harness.md`, "Test harness: unit tests that
// catch an in-between frame").
vi.hoisted(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
});

const SHEET_ID = "stop-0-details";
/** A frame of the frozen clock. */
const FRAME_MS = 16;
/** Long enough for a sheet to roll up and leave. */
const LEAVING_FRAMES = 120;
/** Long enough for a sheet to come into view on the gentle spring. */
const REVEAL_FRAMES = 120;
/** The energy scale's band, held at the screen's top, and where the page stands as a sheet opens. */
const BAND_PX = 35;
const SCROLLED_PX = 1000;
const PAGE_PX = 4000;

/** Kyoto's first stop, as its sheet tells it. */
function firstStopOfKyoto() {
  const normalized = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
  const stop = normalized.ok ? normalized.itinerary.stops[0] : undefined;
  if (!stop?.primary.name) throw new Error("Kyoto's day does not normalize");
  return {
    name: stop.primary.name,
    details: detailsOf(stop, stop.primary, KYOTO_DAY.request.city),
  };
}

const { name: NAME, details: DETAILS } = firstStopOfKyoto();

/** A stop's name and its sheet, opened and closed as a row of the day does. */
function Stop() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? SHEET_ID : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        {NAME}
      </button>
      <AnimatePresence>
        {isOpen && (
          <DetailsPanel
            key="sheet"
            id={SHEET_ID}
            name={NAME}
            details={DETAILS}
            light={null}
            onClose={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

beforeAll(() => {
  // The sheet brings itself into view; jsdom has no layout to scroll.
  Element.prototype.scrollIntoView = () => undefined;
  // Testing Library moves fake timers only when it sees `jest`; this hands it Vitest's clock.
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
});

/** Moves the frozen clock on, a frame at a time. */
async function frames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FRAME_MS);
    });
  }
}

async function openSheet() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<Stop />);
  const name = screen.getByRole("button", { name: NAME });
  name.focus();
  await user.keyboard("{Enter}");
  const sheet = screen.getByRole("region", { name: `About ${NAME}` });
  return { user, name, sheet };
}

afterEach(() => {
  document.querySelector(`[${SCALE_BAND_ATTRIBUTE}]`)?.remove();
  Reflect.deleteProperty(document.documentElement, "scrollHeight");
  vi.unstubAllGlobals();
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
});

describe("DetailsPanel", () => {
  it("draws its focus ring inside its edge, and its close button's outside", async () => {
    const { sheet } = await openSheet();

    expect(sheet).toHaveFocus();
    expect(sheet).toHaveClass("focus-ring-inset");
    expect(screen.getByRole("button", { name: `Close ${NAME}` })).toHaveClass("focus-ring");
  });

  it("comes into view clear of the energy scale's band held at the screen's top", async () => {
    let scrolled = SCROLLED_PX;
    vi.stubGlobal("scrollY", scrolled);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: PAGE_PX,
    });
    vi.stubGlobal("scrollTo", ({ top }: ScrollToOptions) => {
      scrolled = top ?? scrolled;
      vi.stubGlobal("scrollY", scrolled);
    });
    const band = document.createElement("div");
    band.setAttribute(SCALE_BAND_ATTRIBUTE, "held");
    band.getBoundingClientRect = () => ({ top: 0, bottom: BAND_PX }) as DOMRect;
    document.body.append(band);
    const { sheet } = await openSheet();
    // Its top 10 px down the screen, under the band.
    sheet.getBoundingClientRect = () =>
      ({ top: SCROLLED_PX + 10 - scrolled, bottom: SCROLLED_PX + 300 - scrolled }) as DOMRect;
    await frames(REVEAL_FRAMES);

    expect(scrolled).toBe(SCROLLED_PX + 10 - BAND_PX);
  });

  it("reopened while it rolls up, takes the focus again", async () => {
    const { user, name, sheet } = await openSheet();

    await user.keyboard("{Escape}");
    // Still rolling up: the same sheet is there, and the focus is on the stop's name.
    expect(sheet).toBeInTheDocument();
    expect(name).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("region", { name: `About ${NAME}` })).toBe(sheet);
    expect(sheet).toHaveFocus();

    // Once the clock moves on, a sheet closed again rolls up and leaves.
    await user.keyboard("{Escape}");
    await frames(LEAVING_FRAMES);
    expect(screen.queryByRole("region", { name: `About ${NAME}` })).not.toBeInTheDocument();
  });
});
