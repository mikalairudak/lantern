import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROOT_PX } from "@/lib/tokens/root";
import {
  CURVE_NAME,
  ChartAxes,
  SCALE_ARROWS_MIN_REMS,
  SCALE_NAME_MIN_REMS,
  type SunLabels,
} from "./chart-axes";
import { CHART, chartScale } from "./geometry";
import type { AxisRun } from "./light";

const CHART_HEIGHT = 640;
const MINUTES_PER_HOUR = 60;
const DAY_START = 8 * MINUTES_PER_HOUR;
const DAY_END = 20 * MINUTES_PER_HOUR;
/** What the chart keeps beside the lanes: the time axis on the left, the beads' reach on the right. */
const LANE_MARGINS = CHART.axisWidth + CHART.laneInsetStart + CHART.laneInsetEnd;
/** A 320 px phone's chart, with the page's gutters either side. */
const SMALL_PHONE_CHART_WIDTH = 288;
/** The narrowest chart whose scale names the curve at the default text size. */
const NAMED_CHART_WIDTH = Math.ceil(SCALE_NAME_MIN_REMS * DEFAULT_ROOT_PX) + LANE_MARGINS;
/** A 390 px phone's chart. */
const PHONE_CHART_WIDTH = 358;
/** The scale's least span for arrows at the default text size, in whole pixels. */
const ARROWS_MIN_SPAN = Math.ceil(SCALE_ARROWS_MIN_REMS * DEFAULT_ROOT_PX);
/** The root's font size with the browser's text at 125 %. */
const LARGE_ROOT_PX = DEFAULT_ROOT_PX * 1.25;
/**
 * The page's gutters in that text, a rem either side. The chart's drawing stays as written:
 * it grows only with the root's growth on a large screen, never with the visitor's text.
 */
const LARGE_TEXT_GUTTERS = 2 * LARGE_ROOT_PX;
/** A 390 px phone's chart, and a 360 px one's, with the browser's text at 125 %. */
const PHONE_CHART_WIDTH_LARGE_TEXT = 390 - LARGE_TEXT_GUTTERS;
const NARROW_PHONE_CHART_WIDTH_LARGE_TEXT = 360 - LARGE_TEXT_GUTTERS;

/** jsdom sets no font sizes: the root reads at the size a browser at 125 % sets it. */
function setRootSize(px: number) {
  const read = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = read(element, pseudo);
    return element === document.documentElement
      ? Object.assign(Object.create(style) as CSSStyleDeclaration, { fontSize: `${px}px` })
      : style;
  });
}

afterEach(() => vi.restoreAllMocks());

function renderScale(width: number, isCurveNamed: boolean) {
  const axes = (isNamed: boolean) => (
    <svg>
      <ChartAxes
        scale={chartScale(width, CHART_HEIGHT, DAY_START, DAY_END)}
        sunrise={null}
        sunset={null}
        stops={[]}
        litStops={[]}
        isCurveNamed={isNamed}
      />
    </svg>
  );
  const view = render(axes(isCurveNamed));
  return { ...view, nameCurve: () => view.rerender(axes(true)) };
}

/** The scale's two end words, as drawn. */
function endWords(): string[] {
  return [
    screen.getByText(/quieter/).textContent ?? "",
    screen.getByText(/livelier/).textContent ?? "",
  ];
}

describe("the energy scale's words", () => {
  it("point both ways on a phone's chart", () => {
    renderScale(PHONE_CHART_WIDTH, true);

    expect(endWords()).toEqual(["← quieter", "livelier →"]);
    expect(screen.getByText(CURVE_NAME)).toBeInTheDocument();
  });

  it("drop their arrows and leave the curve unnamed on a 320 px phone's chart, where the three words would run together", () => {
    renderScale(SMALL_PHONE_CHART_WIDTH, true);

    expect(endWords()).toEqual(["quieter", "livelier"]);
    expect(screen.queryByText(CURVE_NAME)).not.toBeInTheDocument();
  });

  it("keep their arrows from the scale's least span, and lose them a pixel under it", () => {
    const { unmount } = renderScale(ARROWS_MIN_SPAN + LANE_MARGINS, false);
    expect(endWords()).toEqual(["← quieter", "livelier →"]);
    unmount();

    renderScale(ARROWS_MIN_SPAN + LANE_MARGINS - 1, false);
    expect(endWords()).toEqual(["quieter", "livelier"]);
  });

  it("lose their arrows on a 390 px phone with the browser's text at 125 %, and still name the curve", () => {
    setRootSize(LARGE_ROOT_PX);
    renderScale(PHONE_CHART_WIDTH_LARGE_TEXT, true);

    expect(endWords()).toEqual(["quieter", "livelier"]);
    expect(screen.getByText(CURVE_NAME)).toBeInTheDocument();
  });

  it("leave the curve unnamed on a 360 px phone with the browser's text at 125 %", () => {
    setRootSize(LARGE_ROOT_PX);
    renderScale(NARROW_PHONE_CHART_WIDTH_LARGE_TEXT, true);

    expect(endWords()).toEqual(["quieter", "livelier"]);
    expect(screen.queryByText(CURVE_NAME)).not.toBeInTheDocument();
  });

  it("name the curve from its least span in rems, and not a pixel under it", () => {
    const nameSpan = Math.ceil(SCALE_NAME_MIN_REMS * LARGE_ROOT_PX);
    setRootSize(LARGE_ROOT_PX);
    const { unmount } = renderScale(nameSpan + LANE_MARGINS, true);
    expect(screen.getByText(CURVE_NAME)).toBeInTheDocument();
    unmount();

    renderScale(nameSpan + LANE_MARGINS - 1, true);
    expect(screen.queryByText(CURVE_NAME)).not.toBeInTheDocument();
  });

  it.each([
    ["the narrowest named", NAMED_CHART_WIDTH],
    ["a phone's", PHONE_CHART_WIDTH],
  ])("never change on %s chart when the curve's name comes in between them", (_label, width) => {
    const { nameCurve } = renderScale(width, false);
    const before = endWords();
    expect(screen.queryByText(CURVE_NAME)).not.toBeInTheDocument();

    nameCurve();

    expect(screen.getByText(CURVE_NAME)).toBeInTheDocument();
    expect(endWords()).toEqual(before);
  });
});

describe("the time axis in the light", () => {
  const SCALE = chartScale(PHONE_CHART_WIDTH, CHART_HEIGHT, DAY_START, DAY_END);
  const SUNSET = 17 * MINUTES_PER_HOUR;
  /** An evening: gold for half an hour to the sunset, then dotted to the frame's end. */
  const EVENING: readonly AxisRun[] = [
    { light: "golden", from: SUNSET - 30, to: SUNSET, key: SUNSET - 30 },
    { light: "dark", from: SUNSET, to: DAY_END, key: SUNSET },
  ];

  function drawAxis(
    light: readonly AxisRun[],
    sunLabels?: SunLabels,
    sunrise: number | null = null,
  ) {
    render(
      <svg>
        <ChartAxes
          scale={SCALE}
          light={light}
          sunrise={sunrise}
          sunset={SUNSET}
          sunLabels={sunLabels}
          timesRight={45}
          stops={[]}
          litStops={[]}
        />
      </svg>,
    );
  }

  /** The axis's own lines down the plot, top to bottom: hairline, lamp or dots. */
  function axisLines() {
    return [...document.querySelectorAll("line")]
      .filter(
        (line) =>
          !line.closest("[data-sun]") &&
          line.getAttribute("x1") === String(SCALE.axisX) &&
          line.getAttribute("x2") === String(SCALE.axisX),
      )
      .map((line) => ({
        className: line.getAttribute("class"),
        top: Number(line.getAttribute("y1")),
        bottom: Number(line.getAttribute("y2")),
        isDotted: line.hasAttribute("stroke-dasharray"),
      }))
      .sort((a, b) => a.top - b.top);
  }

  it("runs the lamp through golden hour and dots from sunset, in place of the hairline", () => {
    drawAxis(EVENING);
    const lines = axisLines();

    expect(lines.map((line) => [line.className, line.isDotted])).toEqual([
      ["stroke-line", false],
      ["stroke-lamp", false],
      ["stroke-wire", true],
    ]);
    // The hairline stops where the dots begin; the lamp lies over it, inside its minutes.
    expect(lines[0]!.bottom).toBeCloseTo(SCALE.yOf(SUNSET));
    expect(lines[1]!.top).toBeGreaterThan(SCALE.yOf(SUNSET - 30));
    expect(lines[1]!.bottom).toBeLessThan(SCALE.yOf(SUNSET));
    expect(lines[2]!.top).toBeCloseTo(SCALE.yOf(SUNSET));
    expect(lines[2]!.bottom).toBeCloseTo(SCALE.plotBottom);
  });

  it('runs the lamp on over the sun\'s disc into its arrow, with no gap to read as "!"', () => {
    drawAxis(EVENING);

    const join = document.querySelector('[data-sun="sunset"] [data-sun-join]');
    const glyphTail = SCALE.yOf(SUNSET) - (SCALE.chart.sunMark * 10) / 24;
    expect(join).toHaveAttribute("data-sun-join", "above");
    expect(join).toHaveClass("stroke-lamp");
    // From under the run's own end, outside the disc, to the arrow's tail, over the disc.
    expect(Number(join!.getAttribute("y1"))).toBeLessThan(SCALE.yOf(SUNSET) - SCALE.chart.sunHalo);
    expect(Number(join!.getAttribute("y2"))).toBeCloseTo(glyphTail);
    expect(
      join!.compareDocumentPosition(document.querySelector('[data-sun="sunset"] circle')!),
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });

  it("meets a sunrise from below, at its horizon", () => {
    const sunrise = DAY_START + MINUTES_PER_HOUR;
    drawAxis(
      [{ light: "golden", from: sunrise, to: sunrise + 40, key: sunrise }],
      undefined,
      sunrise,
    );

    const join = document.querySelector('[data-sun="sunrise"] [data-sun-join]');
    expect(join).toHaveAttribute("data-sun-join", "below");
    expect(Number(join!.getAttribute("y2"))).toBeCloseTo(
      SCALE.yOf(sunrise) + (SCALE.chart.sunMark * 10) / 24,
    );
  });

  it("joins no sun the light has not reached yet", () => {
    // As the day comes in, the golden run is cut where the stream has got to.
    drawAxis([{ light: "golden", from: SUNSET - 30, to: SUNSET - 15, key: SUNSET - 30 }]);

    expect(document.querySelector('[data-sun="sunset"]')).toBeInTheDocument();
    expect(document.querySelector("[data-sun-join]")).toBeNull();
  });

  it("is a plain hairline down the whole plot where the light never turns", () => {
    drawAxis([]);

    expect(axisLines()).toEqual([
      { className: "stroke-line", top: SCALE.plotTop, bottom: SCALE.plotBottom, isDotted: false },
    ]);
  });

  /** The axis drawn as far as `axisTo`, as a day still written draws it, with no light yet. */
  function drawAxisTo(axisTo: number) {
    render(
      <svg>
        <ChartAxes
          scale={SCALE}
          sunrise={null}
          sunset={null}
          stops={[]}
          litStops={[]}
          axisTo={axisTo}
        />
      </svg>,
    );
  }

  /** Where each hour's tick stands, top to bottom. */
  function hourTicks(): number[] {
    return [...document.querySelectorAll("line")]
      .filter((line) => line.getAttribute("x1") === String(SCALE.axisX - SCALE.chart.hourTick))
      .map((line) => Number(line.getAttribute("y1")));
  }

  it("draws no axis and no hours before the day has a stop", () => {
    drawAxisTo(DAY_START);

    expect(axisLines()).toEqual([]);
    expect(hourTicks()).toEqual([]);
    // The scale's words stand at once, where they stay.
    expect(endWords()).toEqual(["← quieter", "livelier →"]);
  });

  it("reaches only as far down as the day is drawn, its hours with it", () => {
    const drawnTo = 11 * MINUTES_PER_HOUR + 20;
    drawAxisTo(drawnTo);

    expect(axisLines()).toEqual([
      { className: "stroke-line", top: SCALE.plotTop, bottom: SCALE.yOf(drawnTo), isDotted: false },
    ]);
    const ticks = hourTicks();
    expect(ticks.length).toBeGreaterThan(0);
    expect(Math.max(...ticks)).toBeLessThanOrEqual(SCALE.yOf(drawnTo));
    expect(ticks).toContain(SCALE.yOf(11 * MINUTES_PER_HOUR));
    expect(ticks).not.toContain(SCALE.yOf(12 * MINUTES_PER_HOUR));
  });

  it("says the sun's minute beside it in amber only when the day lets it", () => {
    drawAxis(EVENING, { sunrise: false, sunset: true });

    const minute = screen.getByText("17:00");
    // A size under the stops' times, so it is never read as one of them.
    expect(minute).toHaveClass("text-caption", "tabular-nums", "fill-amber");
    expect(minute).not.toHaveClass("type-time");
    expect(minute).toHaveAttribute("text-anchor", "end");
    expect(Number(minute.getAttribute("y"))).toBeCloseTo(SCALE.yOf(SUNSET));
  });

  it("draws the sun alone where its minute would crowd a stop's time", () => {
    drawAxis(EVENING, { sunrise: false, sunset: false });

    expect(document.querySelector('[data-sun="sunset"]')).toBeInTheDocument();
    expect(screen.queryByText("17:00")).not.toBeInTheDocument();
  });

  it("draws no sun, and so no minute, outside the frame", () => {
    drawAxis(EVENING, { sunrise: true, sunset: true }, 6 * MINUTES_PER_HOUR);

    expect(document.querySelector('[data-sun="sunrise"]')).not.toBeInTheDocument();
    expect(screen.queryByText("06:00")).not.toBeInTheDocument();
  });
});
