import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { completeDraftOf } from "@/features/abacus/day-draft";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { draggedTo, lockOf, neighboursOf, sideTaken, VersionCarousel } from "./version-carousel";

const STOPS = completeDraftOf(itineraryOf(KYOTO_DAY)).stops;
/** A stop with a version either side of its planned one, and one with none. */
const BOTH = STOPS.find((stop) => {
  const { before, after } = neighboursOf(stop, 0);
  return before !== null && after !== null;
})!;

class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

describe("a stop's versions along its wire", () => {
  it("names the version on each side, quieter on the left, livelier on the right", () => {
    const { before, after } = neighboursOf(BOTH, 0);
    expect(before?.side).toBe("Quieter");
    expect(after?.side).toBe("Livelier");
  });

  it("has nothing on a side past the stop's end", () => {
    const last = BOTH.alternatives.length;
    const sides = [0, ...BOTH.alternatives.map((_, index) => index + 1)].map((pick) =>
      neighboursOf(BOTH, pick),
    );
    expect(sides.some(({ before }) => before === null)).toBe(true);
    expect(sides.some(({ after }) => after === null)).toBe(true);
    expect(last).toBeGreaterThan(0);
  });
});

/** The carousel as the list holds it: the version shown is the one last taken. */
function Picking() {
  const [pick, setPick] = useState(0);
  return (
    <VersionCarousel
      stop={BOTH}
      pick={pick}
      name="The stop"
      onPick={setPick}
      renderVersion={(candidate) => <p>{`version ${candidate}`}</p>}
    >
      <h2>The stop</h2>
    </VersionCarousel>
  );
}

describe("the carousel", () => {
  it("keeps the focus on the stop when the arrow pressed goes with the version it named", async () => {
    const user = userEvent.setup();
    render(<Picking />);
    const { before } = neighboursOf(BOTH, 0);
    await user.click(screen.getByRole("button", { name: `Quieter: ${before?.name}` }));
    // The version taken is shown; the arrow that named it may be gone, and the focus is not lost.
    expect(screen.getByRole("group", { name: "The stop" })).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("is drawn as it will stand while the day is written, its arrows waiting", async () => {
    const user = userEvent.setup();
    render(
      <VersionCarousel stop={BOTH} pick={0} name="The stop" renderVersion={() => null}>
        <h2>The stop</h2>
      </VersionCarousel>,
    );
    const { before } = neighboursOf(BOTH, 0);
    const arrow = screen.getByRole("button", { name: `Quieter: ${before?.name}` });
    expect(arrow).toHaveAttribute("aria-disabled", "true");
    await user.click(arrow);
    expect(screen.getByRole("group", { name: "The stop" })).not.toHaveAttribute("tabindex", "0");
  });

  it("swaps from its arrows and from the arrow keys, leaving the focus on the stop", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { before, after } = neighboursOf(BOTH, 0);
    render(
      <VersionCarousel
        stop={BOTH}
        pick={0}
        name="The stop"
        onPick={onPick}
        renderVersion={(candidate) => <p>{`version ${candidate}`}</p>}
      >
        <h2>The stop</h2>
      </VersionCarousel>,
    );
    await user.click(screen.getByRole("button", { name: `Quieter: ${before?.name}` }));
    expect(onPick).toHaveBeenLastCalledWith(before?.index);
    await user.click(screen.getByRole("button", { name: `Livelier: ${after?.name}` }));
    expect(onPick).toHaveBeenLastCalledWith(after?.index);

    const stop = screen.getByRole("group", { name: "The stop" });
    stop.focus();
    await user.keyboard("{ArrowLeft}");
    expect(onPick).toHaveBeenLastCalledWith(before?.index);
    await user.keyboard("{ArrowRight}");
    expect(onPick).toHaveBeenLastCalledWith(after?.index);
    expect(stop).toHaveFocus();
    expect(stop).toHaveAccessibleDescription(/left arrow for .* right arrow for/);
    // The versions waiting beside it are drawn for the eye alone.
    expect(screen.getByText(`version ${before?.index}`).parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("leans toward the version an arrow names under a pointer, and home once it leaves", async () => {
    render(<Picking />);
    const { before, after } = neighboursOf(BOTH, 0);
    const stop = screen.getByRole("group", { name: "The stop" });
    const livelier = screen.getByRole("button", { name: `Livelier: ${after?.name}` });
    fireEvent.pointerEnter(livelier, { pointerType: "mouse" });
    // The livelier version waits on the right, so the stop leans left, toward it.
    await waitFor(() => expect(stop.style.transform).toBe("translateX(-12px)"));
    fireEvent.pointerLeave(livelier, { pointerType: "mouse" });
    await waitFor(() => expect(stop.style.transform).toBe("none"));
    const quieter = screen.getByRole("button", { name: `Quieter: ${before?.name}` });
    fireEvent.pointerEnter(quieter, { pointerType: "pen" });
    await waitFor(() => expect(stop.style.transform).toBe("translateX(12px)"));
  });

  it("goes home from a lean once it can no longer swap, though the arrow is still pointed at", async () => {
    const onPick = vi.fn();
    const carousel = (canPick: boolean) => (
      <VersionCarousel
        stop={BOTH}
        pick={0}
        name="The stop"
        onPick={canPick ? onPick : undefined}
        renderVersion={(candidate) => <p>{`version ${candidate}`}</p>}
      >
        <h2>The stop</h2>
      </VersionCarousel>
    );
    const { rerender } = render(carousel(true));
    const { after } = neighboursOf(BOTH, 0);
    const stop = screen.getByRole("group", { name: "The stop" });
    fireEvent.pointerEnter(screen.getByRole("button", { name: `Livelier: ${after?.name}` }), {
      pointerType: "mouse",
    });
    await waitFor(() => expect(stop.style.transform).toBe("translateX(-12px)"));
    rerender(carousel(false));
    await waitFor(() => expect(stop.style.transform).toBe("none"));
  });

  it("leans nothing for a finger, which cannot hover", async () => {
    render(<Picking />);
    const { after } = neighboursOf(BOTH, 0);
    const stop = screen.getByRole("group", { name: "The stop" });
    fireEvent.pointerEnter(screen.getByRole("button", { name: `Livelier: ${after?.name}` }), {
      pointerType: "touch",
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(stop.style.transform).not.toMatch(/translateX/);
  });

  it("sets its arrows in a line that wraps, each on its own side and none held to half of it", () => {
    render(<Picking />);
    const quieter = screen.getByRole("button", { name: /^Quieter: / });
    const livelier = screen.getByRole("button", { name: /^Livelier: / });
    // Layout alone decides one line or two: the two share a wrapping row, the left one first.
    const line = quieter.parentElement!;
    expect(livelier.parentElement).toBe(line);
    expect(line).toHaveClass("flex", "flex-wrap", "gap-x-3", "gap-y-2");
    expect([...line.children]).toEqual([quieter, livelier]);
    // The right one keeps to the right edge on a line of its own too.
    expect(livelier).toHaveClass("ml-auto", "text-right");
    for (const arrow of [quieter, livelier]) {
      expect(arrow).toHaveClass("max-w-full");
      expect(arrow.className).not.toMatch(/basis-/);
    }
  });

  it("stands a lone version on its own side, with nothing held on the other", () => {
    const order = [0, ...BOTH.alternatives.map((_, index) => index + 1)];
    const last = order.find((pick) => neighboursOf(BOTH, pick).after === null)!;
    render(
      <VersionCarousel stop={BOTH} pick={last} name="Last" renderVersion={() => null}>
        <h2>Last</h2>
      </VersionCarousel>,
    );
    const arrows = screen.getAllByRole("button");
    expect(arrows).toHaveLength(1);
    expect(arrows[0]!.parentElement!.children).toHaveLength(1);
  });

  it("neither moves nor says anything for a stop with no versions", () => {
    const lone = { ...BOTH, alternatives: [] };
    render(
      <VersionCarousel
        stop={lone}
        pick={0}
        name="Alone"
        onPick={vi.fn()}
        renderVersion={() => null}
      >
        <h2>Alone</h2>
      </VersionCarousel>,
    );
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the drag's rules", () => {
  it("locks to the axis the pointer first travels 6 px along, and to none before", () => {
    expect(lockOf(5, -5)).toBeNull();
    expect(lockOf(6, 2)).toBe("x");
    expect(lockOf(-7, 3)).toBe("x");
    expect(lockOf(2, -6)).toBe("y");
  });

  it("follows the pointer from where it caught the stop, and gives 0.08 past its reach", () => {
    const reach = { left: -324, right: 324 };
    expect(draggedTo(0, 100, reach)).toBe(100);
    // Caught halfway through a slide, the stop goes on from there.
    expect(draggedTo(-300, 50, reach)).toBe(-250);
    expect(draggedTo(0, 424, reach)).toBeCloseTo(332);
    // A side with no version barely gives.
    expect(draggedTo(0, 100, { left: -324, right: 0 })).toBeCloseTo(8);
    expect(draggedTo(0, -100, { left: 0, right: 324 })).toBeCloseTo(-8);
  });

  it("takes the version on the side it was pulled from once past a third of the width", () => {
    const both = { hasBefore: true, hasAfter: true };
    expect(sideTaken(100, 300, both)).toBe("before");
    expect(sideTaken(99, 300, both)).toBeNull();
    expect(sideTaken(-100, 300, both)).toBe("after");
    expect(sideTaken(-99, 300, both)).toBeNull();
    expect(sideTaken(150, 300, { hasBefore: false, hasAfter: true })).toBeNull();
    expect(sideTaken(-150, 300, { hasBefore: true, hasAfter: false })).toBeNull();
  });
});

/** The stop's box, 300 px wide where jsdom lays nothing out. */
const WIDTH_PX = 300;

/**
 * A pointer pressed on `element` at `from`, moved to each point with its button down, and let go
 * there or cancelled. A finger's word holds its pointer from the press, as a browser holds it, and
 * loses it once the drag has locked and the stop takes it (`losesAt`, the point it is lost at).
 */
function dragOn(
  element: Element,
  from: { x: number; y: number },
  points: readonly { x: number; y: number }[],
  end: "up" | "cancel" | "none" = "up",
  { pointerType = "mouse", losesAt }: { pointerType?: "mouse" | "touch"; losesAt?: number } = {},
): void {
  const pointer = { pointerId: 7, pointerType, button: 0 };
  fireEvent.pointerDown(element, { ...pointer, buttons: 1, clientX: from.x, clientY: from.y });
  points.forEach((point, at) => {
    if (at === losesAt) fireEvent.lostPointerCapture(element, pointer);
    fireEvent.pointerMove(element, { ...pointer, buttons: 1, clientX: point.x, clientY: point.y });
  });
  const last = points.at(-1) ?? from;
  if (end === "up") fireEvent.pointerUp(element, { ...pointer, clientX: last.x, clientY: last.y });
  if (end === "cancel") fireEvent.pointerCancel(element, pointer);
}

/** Steps from `x` to `x + by` along one line, as a hand drags. */
function across(x: number, by: number, y = 100): { x: number; y: number }[] {
  return [1, 2, 3, 4, 5].map((step) => ({ x: x + (by * step) / 5, y }));
}

describe("the drag", () => {
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(WIDTH_PX);
  });
  afterAll(() => vi.restoreAllMocks());

  function renderPicking(pick = 0, content = <h2>The stop</h2>) {
    const onPick = vi.fn();
    const onClick = vi.fn();
    render(
      // A click that reaches past the stop, as one on the page around it would.
      <div onClick={onClick}>
        <VersionCarousel
          stop={BOTH}
          pick={pick}
          name="The stop"
          onPick={onPick}
          renderVersion={(candidate) => <p>{`version ${candidate}`}</p>}
        >
          {content}
        </VersionCarousel>
      </div>,
    );
    return { onPick, onClick, stop: screen.getByRole("group", { name: "The stop" }) };
  }

  it("takes the version on its left once dragged right past a third, and the click is the drag's", () => {
    const { onPick, onClick, stop } = renderPicking();
    const { before } = neighboursOf(BOTH, 0);
    dragOn(stop, { x: 10, y: 100 }, across(10, WIDTH_PX / 3 + 5));
    expect(onPick).toHaveBeenCalledWith(before?.index);
    fireEvent.click(stop);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("takes the version on its right once dragged left past a third", () => {
    const { onPick, stop } = renderPicking();
    const { after } = neighboursOf(BOTH, 0);
    dragOn(stop, { x: 200, y: 100 }, across(200, -(WIDTH_PX / 3 + 5)));
    expect(onPick).toHaveBeenCalledWith(after?.index);
  });

  it("follows the pointer while held, and springs home short of a third with nothing taken", async () => {
    const { onPick, stop } = renderPicking();
    dragOn(stop, { x: 10, y: 100 }, across(10, 60), "none");
    await waitFor(() => expect(stop.style.transform).toBe("translateX(60px)"));
    fireEvent.pointerUp(stop, { pointerId: 7, pointerType: "mouse", clientX: 70, clientY: 100 });
    expect(onPick).not.toHaveBeenCalled();
    await waitFor(() => expect(stop.style.transform).toMatch(/^(none|translateX\(0px\))$/), {
      timeout: 2000,
    });
  });

  it("barely gives toward a side with no version", async () => {
    const order = [0, ...BOTH.alternatives.map((_, index) => index + 1)];
    const last = order.find((pick) => neighboursOf(BOTH, pick).after === null)!;
    const { onPick, stop } = renderPicking(last);
    dragOn(stop, { x: 200, y: 100 }, across(200, -100), "none");
    await waitFor(() => expect(stop.style.transform).toBe("translateX(-8px)"));
    fireEvent.pointerUp(stop, { pointerId: 7, pointerType: "mouse", clientX: 100, clientY: 100 });
    expect(onPick).not.toHaveBeenCalled();
  });

  it("leaves a drag down or up to the page, and a press that does not travel to what it pressed", async () => {
    const { onPick, onClick, stop } = renderPicking();
    dragOn(stop, { x: 10, y: 100 }, [
      { x: 12, y: 110 },
      { x: 30, y: 160 },
    ]);
    expect(onPick).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(stop.style.transform).not.toMatch(/translateX\((?!0px)/);
    dragOn(stop, { x: 10, y: 100 }, [{ x: 12, y: 101 }]);
    fireEvent.click(stop);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("goes home with nothing taken when the page takes the pointer mid-drag", async () => {
    const { onPick, stop } = renderPicking();
    dragOn(stop, { x: 10, y: 100 }, across(10, WIDTH_PX / 2), "cancel");
    expect(onPick).not.toHaveBeenCalled();
    await waitFor(() => expect(stop.style.transform).toMatch(/^(none|translateX\(0px\))$/), {
      timeout: 2000,
    });
  });

  it("leaves a press on a button among the stop's words to the button", () => {
    const onButton = vi.fn();
    const { onPick, stop } = renderPicking(
      0,
      <button type="button" onClick={onButton}>
        Open
      </button>,
    );
    const button = screen.getByRole("button", { name: "Open" });
    dragOn(button, { x: 10, y: 100 }, [{ x: 11, y: 100 }]);
    fireEvent.click(button);
    expect(onButton).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
    expect(stop.style.transform).not.toMatch(/translateX\((?!0px)/);
  });

  it("takes a version for a finger dragged from the stop's name, which held the pointer first", () => {
    const { onPick } = renderPicking();
    const { before } = neighboursOf(BOTH, 0);
    const name = screen.getByRole("heading", { name: "The stop" });
    // The name loses its hold on the pointer at the second move, as the stop takes it.
    dragOn(name, { x: 10, y: 100 }, across(10, WIDTH_PX / 3 + 5), "up", {
      pointerType: "touch",
      losesAt: 1,
    });
    expect(onPick).toHaveBeenCalledWith(before?.index);
  });

  it("goes home with nothing taken when the stop's own hold on the pointer is lost", async () => {
    const { onPick, stop } = renderPicking();
    dragOn(stop, { x: 10, y: 100 }, across(10, WIDTH_PX / 2), "none");
    fireEvent.lostPointerCapture(stop, { pointerId: 7, pointerType: "mouse" });
    fireEvent.pointerUp(stop, { pointerId: 7, pointerType: "mouse", clientX: 160, clientY: 100 });
    expect(onPick).not.toHaveBeenCalled();
    await waitFor(() => expect(stop.style.transform).toMatch(/^(none|translateX\(0px\))$/), {
      timeout: 2000,
    });
  });
});
