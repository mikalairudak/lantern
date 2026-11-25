import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NAME_HOLD_GRACE_MS, useNameHold, type BeadHover, type ScreenBox } from "./use-name-hold";

/**
 * A version's name shown for a bead stays while the pointer moves from the bead onto the name
 * and rests there, and goes a moment after the pointer is off both (WCAG 1.4.13).
 */

const BEAD = "kyoto-08:25-quieter";
const OTHER_BEAD = "kyoto-08:25-livelier";
/** Where the bead's name is drawn, to the right of its bead. */
const NAME_BOX: ScreenBox = { left: 120, right: 260, top: 90, bottom: 110 };
/** The same name once the page has scrolled it up past a pointer that has not moved. */
const NAME_BOX_SCROLLED: ScreenBox = { left: 120, right: 260, top: 10, bottom: 30 };
const ON_THE_NAME = { clientX: 190, clientY: 100 };
const OFF_THE_NAME = { clientX: 40, clientY: 300 };
/** Short of the grace, so a hold still stands. */
const A_MOMENT = NAME_HOLD_GRACE_MS / 2;

/** The hold as the chart keeps it, its parent's hover kept as its parent keeps it. */
function holdNames() {
  const parent: { hoveredPlace: string | null } = { hoveredPlace: null };
  // Where the name stands now, as the page's scroll moves it, and whether its version still
  // has one to show.
  const name = { box: NAME_BOX, isShown: true };
  const onHoverPlace = (placeId: string | null) => {
    parent.hoveredPlace = placeId;
  };
  const view = renderHook(
    ({ isNameable }: { isNameable: boolean }) =>
      useNameHold({
        hoveredPlace: parent.hoveredPlace,
        isNameable,
        onHoverPlace,
        hasName: (placeId) => placeId !== BEAD || name.isShown,
        nameBoxOf: (placeId) => (placeId === BEAD ? name.box : null),
      }),
    { initialProps: { isNameable: true } },
  );
  const rerender = (isNameable = true) => view.rerender({ isNameable });
  // The bead the pointer is on, which it leaves next.
  let onBead = "";
  /** The pointer comes onto a bead, or off the one it is on, whose name is shown or not. */
  const hover = (placeId: string | null, isNameShown = true, isOffThePage = false) => {
    const bead: BeadHover =
      placeId === null
        ? { placeId: onBead, isOn: false, isPressed: false, isOffThePage }
        : { placeId, isOn: true, isPressed: false, isOffThePage: false };
    onBead = placeId ?? "";
    act(() => view.result.current.onHoverPlace(bead, isNameShown));
    rerender();
  };
  return { view, parent, name, hover, rerender };
}

function movePointer(to: { clientX: number; clientY: number }): void {
  act(() => {
    fireEvent.pointerMove(document, to);
  });
}

function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a version's name held under the pointer", () => {
  it("stays with the pointer resting on the name, past the grace", () => {
    const { view, parent, hover } = holdNames();
    hover(BEAD);
    hover(null);

    movePointer(ON_THE_NAME);
    wait(NAME_HOLD_GRACE_MS * 4);

    expect(view.result.current.heldPlace).toBe(BEAD);
    // The chart's parent hears the bead left, as before: the hold is the chart's own.
    expect(parent.hoveredPlace).toBeNull();
  });

  it("stays with the pointer that crossed a gap on its way to the name", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);

    movePointer(OFF_THE_NAME);
    movePointer(ON_THE_NAME);
    wait(NAME_HOLD_GRACE_MS * 4);

    expect(view.result.current.heldPlace).toBe(BEAD);
  });

  it("stays with a pointer that left the bead onto the name in one move", () => {
    const { view, hover } = holdNames();
    hover(BEAD);

    // The move is heard before the bead's leave makes the hold: no later move comes.
    movePointer(ON_THE_NAME);
    hover(null);
    wait(NAME_HOLD_GRACE_MS * 4);

    expect(view.result.current.heldPlace).toBe(BEAD);
  });

  it("stays with a pointer flicked off the bead and onto the name before the hold begins", () => {
    const { view, hover } = holdNames();
    hover(BEAD);

    movePointer(OFF_THE_NAME);
    movePointer(ON_THE_NAME);
    hover(null);
    wait(NAME_HOLD_GRACE_MS * 4);

    expect(view.result.current.heldPlace).toBe(BEAD);
  });

  it("goes after the grace once the pointer left the bead for elsewhere in one move", () => {
    const { view, hover } = holdNames();
    hover(BEAD);

    movePointer(OFF_THE_NAME);
    hover(null);
    wait(A_MOMENT);
    expect(view.result.current.heldPlace).toBe(BEAD);
    wait(NAME_HOLD_GRACE_MS);

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("goes after the grace once the pointer is off the bead and never reaches the name", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);

    wait(A_MOMENT);
    expect(view.result.current.heldPlace).toBe(BEAD);
    wait(NAME_HOLD_GRACE_MS);

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("goes after the grace once the pointer moves off the name", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);
    wait(NAME_HOLD_GRACE_MS * 2);

    movePointer(OFF_THE_NAME);
    wait(A_MOMENT);
    expect(view.result.current.heldPlace).toBe(BEAD);
    wait(NAME_HOLD_GRACE_MS);

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("keeps its whole grace for a pointer back on the bead and off it again", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    wait(A_MOMENT);
    hover(BEAD);
    hover(null);

    // The first leave's grace would end here: it ended with the pointer back on the bead.
    wait(A_MOMENT + 1);

    expect(view.result.current.heldPlace).toBe(BEAD);
  });

  it("lets go at once for another bead the pointer comes onto", () => {
    const { view, parent, hover } = holdNames();
    hover(BEAD);
    hover(null);

    hover(OTHER_BEAD);

    expect(view.result.current.heldPlace).toBeNull();
    expect(parent.hoveredPlace).toBe(OTHER_BEAD);
  });

  it("holds nothing for a bead whose name is not shown, as one put away", () => {
    const { view, hover } = holdNames();
    hover(BEAD, false);

    hover(null, false);

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("lets go as names can no longer show, and holds nothing once they can again", () => {
    const { view, hover, rerender } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    rerender(false);
    expect(view.result.current.heldPlace).toBeNull();
    rerender(true);

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("goes after the grace once the page scrolls the name from under a resting pointer", () => {
    const { view, name, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    name.box = NAME_BOX_SCROLLED;
    // A scroll of the page or of a box within it, heard as it passes the window.
    act(() => {
      fireEvent.scroll(document.body);
    });
    wait(A_MOMENT);
    expect(view.result.current.heldPlace).toBe(BEAD);
    wait(NAME_HOLD_GRACE_MS);

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("stays through a scroll after which the names place it back under the pointer", () => {
    const { view, name, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    // A name kept under the screen's top moves up with the page as it scrolls, and is placed
    // back under it, and under the pointer, a frame later.
    name.box = NAME_BOX_SCROLLED;
    act(() => {
      fireEvent.scroll(document.body);
    });
    name.box = NAME_BOX;
    wait(NAME_HOLD_GRACE_MS * 4);

    expect(view.result.current.heldPlace).toBe(BEAD);
  });

  it("stays through a scroll that leaves the name under the pointer", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    act(() => {
      fireEvent.scroll(document.body);
    });
    wait(NAME_HOLD_GRACE_MS * 4);

    expect(view.result.current.heldPlace).toBe(BEAD);
  });

  it("lets go at once as its version no longer has a name to show, the pointer on it", () => {
    const { view, name, hover, rerender } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    // Picked under the name, or gone from the day in a re-plan.
    name.isShown = false;
    rerender();

    expect(view.result.current.heldPlace).toBeNull();
    expect(view.result.current.isPointerOnName()).toBe(false);
  });

  it("lets go at once as the pointer leaves the page", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    act(() => {
      fireEvent.pointerOut(document.body, { relatedTarget: null });
    });

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("holds nothing for a bead the pointer leaves the page from", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null, true, true);

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("stays as the pointer passes from one thing on the page to another", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    act(() => {
      fireEvent.pointerOut(document.body, { relatedTarget: document.documentElement });
    });
    wait(NAME_HOLD_GRACE_MS * 4);

    expect(view.result.current.heldPlace).toBe(BEAD);
  });

  it("lets go at once as the window loses the focus", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    act(() => {
      fireEvent.blur(window);
    });

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("lets go at once when told, with the pointer resting on the name", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    movePointer(ON_THE_NAME);

    act(() => view.result.current.letGo());

    expect(view.result.current.heldPlace).toBeNull();
  });

  it("says the pointer is on the held name only while it stands on it", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);
    // Not known to be anywhere until it moves.
    expect(view.result.current.isPointerOnName()).toBe(false);

    movePointer(OFF_THE_NAME);
    expect(view.result.current.isPointerOnName()).toBe(false);
    movePointer(ON_THE_NAME);
    expect(view.result.current.isPointerOnName()).toBe(true);

    act(() => view.result.current.letGo());
    expect(view.result.current.isPointerOnName()).toBe(false);
  });

  it("leaves no grace running once the chart is gone", () => {
    const { view, hover } = holdNames();
    hover(BEAD);
    hover(null);

    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
