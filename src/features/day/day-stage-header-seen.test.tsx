import { act, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CURATED_REQUESTS, KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { noticeOf } from "./stream-ending";
import { sentenceFactsOf } from "./sentence";
import { DayStageHeader, type HeaderNotice } from "./day-stage-header";
import { NOTICE_HEARD_MS } from "./notice-status";

// The beat a notice waits before it is written is longer here than its hold, so the hold is
// over while the notice is not yet whole, as when its words glide for longer than the hold.
vi.mock("./use-pen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./use-pen")>()),
  PEN_BEAT_MS: 9000,
}));

const ignore = () => undefined;

/** jsdom lays nothing out; the header's gliding boxes only need to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});

/** Kyoto's header, with the notice that stands in the day's place. */
function headerOf(request: DayRequest, notice: HeaderNotice | null) {
  const facts = sentenceFactsOf(request, {});
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
      notice={notice}
      isNoticeWrittenIn
      isLeaving={false}
      isEnabled
      isDayBeingWritten={false}
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

/** The header's own live line; the day menu beside it holds one of its own. */
function headerStatus(): HTMLElement {
  const status = screen.getAllByRole("status").find((each) => each.tagName === "P");
  if (!status) throw new Error("The header has no live line");
  return status;
}

/** The page seen, or hidden behind another tab, as a browser tells it. */
function showPage(isSeen: boolean): void {
  act(() => {
    Object.defineProperty(document, "visibilityState", {
      value: isSeen ? "visible" : "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("a notice heard out before it stands whole", () => {
  it("stands through a hidden page, so a return does not say it again", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const notice = noticeOf({ kind: "cut", itinerary: null }, KYOTO_REQUEST);
    const view = render(headerOf(KYOTO_REQUEST, null));
    view.rerender(headerOf(KYOTO_REQUEST, notice));
    const said = headerStatus().textContent;
    expect(said).toMatch(/^Lantern couldn't finish this day\./);

    act(() => vi.advanceTimersByTime(NOTICE_HEARD_MS));
    expect(headerStatus().textContent).toBe(said);
    // Emptied behind the tab, it would be written again, a change said again, on return.
    showPage(false);
    expect(headerStatus().textContent).toBe(said);
    showPage(true);
    expect(headerStatus().textContent).toBe(said);

    // Once it stands whole, the status falls quiet.
    act(() => vi.advanceTimersByTime(9000));
    expect(headerStatus().textContent).toBe("");
  });
});
