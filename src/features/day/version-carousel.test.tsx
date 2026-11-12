import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { completeDraftOf } from "@/features/abacus/day-draft";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { neighboursOf, VersionCarousel } from "./version-carousel";

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
