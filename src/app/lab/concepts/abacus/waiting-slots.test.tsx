import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { chartScale } from "@/features/abacus/geometry";
import { ALICANTE_HOURS } from "./request-sentence";
import { waitingInPlace, waitingOver, type Waiting } from "@/features/abacus/waiting";
import { ChartWaiting } from "@/features/abacus/waiting-chart";
import { ListWaiting, type WaitingPlace } from "@/features/abacus/waiting-list";

const SCALE = chartScale(448, 800, ALICANTE_HOURS.start, ALICANTE_HOURS.end);
const MORNING = ABACUS_DAY.stops.slice(0, 2);
const WHOLE_PLAN = ABACUS_DAY.stops;
/** Right of a calm bead, as the first row's name would be. */
const BESIDE_BEAD: WaitingPlace = { side: "right", inset: 180, maxWidth: 200 };

function renderChart(shown: Waiting | null) {
  return render(
    <svg>
      <ChartWaiting waiting={shown} scale={SCALE} />
    </svg>,
  );
}

const shownIn = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-waiting]")].map((element) =>
    element.getAttribute("data-waiting"),
  );

describe("waitingOver", () => {
  it("puts the pen after the last stop and names what follows", () => {
    expect(waitingOver(MORNING, ALICANTE_HOURS)).toEqual({
      pen: { next: "stop", minutes: 9 * 60 + 30 },
      phrase: "the morning",
    });
  });
});

describe("waitingInPlace", () => {
  it("names the meal a rewritten place to eat or drink stands for, on its wire", () => {
    const tapas = ABACUS_DAY.stops.at(-1)!;

    expect(waitingInPlace(tapas, 1290)).toEqual({
      pen: { next: "stop", minutes: 1290 },
      phrase: "dinner",
      isInPlace: true,
    });
  });
});

describe("the waiting line", () => {
  it("draws in the chart and the row together", () => {
    const shown = waitingOver(MORNING, ALICANTE_HOURS);

    expect(shownIn(renderChart(shown).container)).toEqual(["voice"]);
    expect(shownIn(render(<ListWaiting waiting={shown} place={BESIDE_BEAD} />).container)).toEqual([
      "voice",
    ]);
  });

  it("draws nothing while data flows", () => {
    expect(shownIn(renderChart(null).container)).toEqual([]);
    expect(shownIn(render(<ListWaiting waiting={null} place={BESIDE_BEAD} />).container)).toEqual(
      [],
    );
  });

  it("names the next part of the day where the next row will be, never a place", () => {
    const { container } = render(
      <ListWaiting waiting={waitingOver(MORNING, ALICANTE_HOURS)} place={BESIDE_BEAD} />,
    );

    expect(container).toHaveTextContent("the morning");
    expect(container).not.toHaveTextContent(ABACUS_DAY.stops[2]?.primary.name ?? "");
  });

  it("leaves the next row's place at once when the silence ends, rather than fading there", () => {
    const { container, rerender } = render(
      <ListWaiting waiting={waitingOver(MORNING, ALICANTE_HOURS)} place={BESIDE_BEAD} />,
    );
    expect(shownIn(container)).toEqual(["voice"]);

    rerender(<ListWaiting waiting={null} place={BESIDE_BEAD} />);

    // Still fading, it would ride down a row as the arriving one pushed the list's end.
    expect(shownIn(container)).toEqual([]);
  });

  it("sits beside the bead the next name will be written by, on its side", () => {
    const { container, rerender } = render(
      <ListWaiting waiting={waitingOver(MORNING, ALICANTE_HOURS)} place={BESIDE_BEAD} />,
    );
    const line = () => container.querySelector<HTMLElement>('[data-waiting="voice"]');
    expect(line()?.style.paddingLeft).toBe("180px");

    rerender(
      <ListWaiting
        waiting={waitingOver(MORNING, ALICANTE_HOURS)}
        place={{ side: "left", inset: 60, maxWidth: 200 }}
      />,
    );
    expect(line()?.style.paddingRight).toBe("60px");
  });

  it("speaks of the other versions once the plan is written", () => {
    const { container } = render(
      <ListWaiting waiting={waitingOver(WHOLE_PLAN, ALICANTE_HOURS)} place={BESIDE_BEAD} />,
    );

    expect(container).toHaveTextContent("other versions");
  });
});
