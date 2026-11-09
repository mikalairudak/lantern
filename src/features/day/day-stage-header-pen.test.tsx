import { act, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CURATED_REQUESTS, KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { sentenceFactsOf } from "./sentence";
import { DayStageHeader } from "./day-stage-header";

// The clock stands still until the test moves it, so a pen stopped mid-sentence is caught
// there however long a busy machine pauses. Set before any import runs, since Motion takes
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

const ignore = () => undefined;
/** A frame of the frozen clock. */
const FRAME_MS = 16;
/** How long a pen that writes on would take to change what it shows. */
const STILL_MS = 400;

/** What a line shows: its letters, not the room it holds unseen for words still to come. */
function seenTextOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let seen = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(".invisible")) seen += node.textContent ?? "";
  }
  return seen;
}
/** Far more frames than the pen takes to reach a word: a pen that never gets there fails. */
const MOST_FRAMES = 400;

/** jsdom lays nothing out; the header's gliding boxes only need to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

/** Kyoto's day as Lantern wrote it: every word but the company assumed, and that one asked. */
const KYOTO_ASSUMPTIONS: PartialDay["assumptions"] = {
  travel: "on-foot",
  start: "early",
  dinner: "early",
  end: "early",
  company: null,
};

/** Kyoto's header with what the stream has assumed so far, the day leaving or not. */
function headerOf(request: DayRequest, assumptions: PartialDay["assumptions"], isLeaving = false) {
  const facts = sentenceFactsOf(request, assumptions);
  return (
    <DayStageHeader
      request={request}
      facts={facts}
      reservedFacts={facts}
      clause={null}
      dek="Food carts at noon, the river at dusk."
      reservedDek="Food carts at noon, the river at dusk."
      isDekWriting={false}
      sunrise={null}
      sunset={null}
      isSunShown={false}
      slot={null}
      reservedSlot={null}
      notice={null}
      isLeaving={isLeaving}
      isEnabled
      isWaiting={false}
      written={CURATED_REQUESTS}
      cityOpenAt={null}
      isCityFocused={false}
      onCityOpenChange={ignore}
      onChooseWritten={ignore}
      onChooseCity={ignore}
      onChoose={ignore}
      onLight={ignore}
      onRetry={ignore}
    />
  );
}

/** Moves the frozen clock on, a frame at a time. */
async function frames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FRAME_MS);
    });
  }
}

/** Moves the frozen clock on a frame at a time until the moment a test is about. */
async function framesUntil(isThere: () => boolean): Promise<void> {
  for (let frame = 0; frame < MOST_FRAMES && !isThere(); frame += 1) await frames(1);
}

describe("DayStageHeader's pen", () => {
  it("stops every pen where it is while the day leaves, a word half written too", async () => {
    const view = render(headerOf(KYOTO_REQUEST, {}));
    const headline = screen.getByRole("heading", { level: 1 });
    view.rerender(headerOf(KYOTO_REQUEST, KYOTO_ASSUMPTIONS));
    await framesUntil(() => /Kyoto, on/.test(seenTextOf(headline)));
    expect(seenTextOf(headline)).toMatch(/Kyoto, on/);

    view.rerender(headerOf(KYOTO_REQUEST, KYOTO_ASSUMPTIONS, true));
    const still = seenTextOf(headline);
    await frames(STILL_MS / FRAME_MS);

    expect(seenTextOf(headline)).toBe(still);
    expect(still).not.toMatch(/with …\?/);
  });
});
