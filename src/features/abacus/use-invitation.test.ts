import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import type { StopDraft } from "./day-draft";
import {
  INVITATION_DELAY_MS,
  noteCurveDragged,
  useInvitation,
  type InvitationMemory,
} from "./use-invitation";

const STOPS: readonly StopDraft[] = ABACUS_DAY.stops;
const LUNCH = 4;

/** Renders the invitation for a day still being written; `rerender` makes it draggable. */
function renderInvitation(stops: readonly StopDraft[] = STOPS, isInteractive = false) {
  return renderHook((props) => useInvitation(props), {
    initialProps: { stops, isInteractive },
  });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useInvitation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("chooses no stop while the day is written, nor in the moment after it can be dragged", () => {
    const view = renderInvitation();
    wait(INVITATION_DELAY_MS * 3);
    expect(view.result.current.stopIndex).toBeNull();

    view.rerender({ stops: STOPS, isInteractive: true });
    wait(INVITATION_DELAY_MS - 1);

    expect(view.result.current.stopIndex).toBeNull();
  });

  it("invites at lunch a moment after the day can be dragged", () => {
    const view = renderInvitation();
    view.rerender({ stops: STOPS, isInteractive: true });
    wait(INVITATION_DELAY_MS);

    expect(view.result.current.stopIndex).toBe(LUNCH);
  });

  it("invites where the day says it can be seen, as on a phone's first screen", () => {
    const view = renderInvitation();
    view.result.current.seenRef.current = (index) => index < 3;
    view.rerender({ stops: STOPS, isInteractive: true });
    wait(INVITATION_DELAY_MS);

    // The beach has nothing quieter; of the two after it the castle is nearer midday.
    expect(view.result.current.stopIndex).toBe(2);
  });

  it("invites a day that could be dragged from its first render, a moment after it", () => {
    const view = renderInvitation(STOPS, true);
    wait(INVITATION_DELAY_MS);

    expect(view.result.current.stopIndex).toBe(LUNCH);
  });

  it("keeps the stop it chose while the day can be dragged, however its stops change", () => {
    const view = renderInvitation(STOPS, true);
    wait(INVITATION_DELAY_MS);
    view.result.current.seenRef.current = () => false;

    view.rerender({ stops: STOPS.slice(0, 2), isInteractive: true });
    wait(INVITATION_DELAY_MS * 3);

    expect(view.result.current.stopIndex).toBe(LUNCH);
  });

  it("puts it away for good once the day can no longer be dragged, as while a re-plan writes", () => {
    const view = renderInvitation(STOPS, true);
    wait(INVITATION_DELAY_MS);
    expect(view.result.current.stopIndex).toBe(LUNCH);

    view.rerender({ stops: STOPS, isInteractive: false });
    expect(view.result.current.stopIndex).toBeNull();
    view.rerender({ stops: STOPS, isInteractive: true });
    wait(INVITATION_DELAY_MS * 3);

    expect(view.result.current.stopIndex).toBeNull();
  });

  describe("with the page's memory", () => {
    afterEach(() => localStorage.clear());

    function remembering(isShown: boolean): InvitationMemory {
      return { isShown, onShown: vi.fn() };
    }

    it("invites once on a page: the page is told, and a day it draws after has no ring", () => {
      const memory = remembering(false);
      const first = renderHook(() => useInvitation({ stops: STOPS, isInteractive: true, memory }));
      wait(INVITATION_DELAY_MS);
      expect(first.result.current.stopIndex).toBe(LUNCH);
      expect(memory.onShown).toHaveBeenCalledOnce();

      const next = renderHook(() =>
        useInvitation({ stops: STOPS, isInteractive: true, memory: remembering(true) }),
      );
      wait(INVITATION_DELAY_MS * 3);
      expect(next.result.current.stopIndex).toBeNull();
    });

    it("keeps the page load's memory past a page drawn again, as after the wordmark's way back", async () => {
      vi.resetModules();
      const fresh = await import("./use-invitation");
      const memory = fresh.PAGE_INVITATION_MEMORY;
      const first = renderHook(() =>
        fresh.useInvitation({ stops: STOPS, isInteractive: true, memory }),
      );
      wait(INVITATION_DELAY_MS);
      expect(first.result.current.stopIndex).toBe(LUNCH);
      first.unmount();

      const again = renderHook(() =>
        fresh.useInvitation({ stops: STOPS, isInteractive: true, memory }),
      );
      wait(INVITATION_DELAY_MS * 3);
      expect(memory.isShown).toBe(true);
      expect(again.result.current.stopIndex).toBeNull();
    });

    it("invites no one who has dragged a day's curve on this device", () => {
      noteCurveDragged();
      const memory = remembering(false);
      const view = renderHook(() => useInvitation({ stops: STOPS, isInteractive: true, memory }));
      wait(INVITATION_DELAY_MS * 3);

      expect(view.result.current.stopIndex).toBeNull();
      expect(memory.onShown).not.toHaveBeenCalled();
    });
  });

  it("reads the stops as they stand when it chooses, not as they were when it began to wait", () => {
    const view = renderInvitation([], true);
    view.rerender({ stops: STOPS, isInteractive: true });
    wait(INVITATION_DELAY_MS);

    expect(view.result.current.stopIndex).toBe(LUNCH);
  });

  it("has no stop to invite to when none sits on the curve", () => {
    const view = renderInvitation([], true);
    wait(INVITATION_DELAY_MS);

    expect(view.result.current.stopIndex).toBeNull();
  });
});
