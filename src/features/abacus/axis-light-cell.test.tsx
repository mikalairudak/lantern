import { render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AxisLightCell } from "./axis-light-cell";
import { LIGHT_DAYS, LIGHT_STATES } from "./axis-light-examples";

const CELL_WIDTH = 390;

/** jsdom has no layout, so the cell reports a phone's width. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CELL_WIDTH, height: 0 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function dayIndexOf(label: string): number {
  const index = LIGHT_DAYS.findIndex((day) => day.label === label);
  if (index === -1) throw new Error(`No day "${label}"`);
  return index;
}

/** The axis's runs of light, top to bottom, once the day has its rows. */
async function runsOf(): Promise<(string | null)[]> {
  await screen.findByRole("list", { name: "The day" });
  return [...document.querySelectorAll("line[data-light]")]
    .map((run) => ({ light: run.getAttribute("data-light"), y: Number(run.getAttribute("y1")) }))
    .sort((a, b) => a.y - b.y)
    .map((run) => run.light);
}

const CELLS = LIGHT_STATES.flatMap(({ label: stateLabel, key }) =>
  LIGHT_DAYS.map(({ label }, day) => [label, stateLabel, day, key] as const),
);

describe("AxisLightCell", () => {
  it.each(CELLS)("draws %s, %s", async (_day, _state, day, state) => {
    render(<AxisLightCell day={day} state={state} />);

    expect(await screen.findByRole("list", { name: "The day" })).toBeInTheDocument();
  });

  it("runs Kyoto's axis in gold to the sunset and dotted after, with nothing over the rows", async () => {
    render(<AxisLightCell day={dayIndexOf("Kyoto")} state="whole" />);

    await waitFor(async () => expect(await runsOf()).toEqual(["golden", "dark"]));
    expect(document.querySelector('[data-sun="sunset"]')).toBeInTheDocument();
    expect(document.querySelector("rect[data-light]")).not.toBeInTheDocument();
  });

  it("dots a polar day's axis from end to end", async () => {
    render(<AxisLightCell day={dayIndexOf("polar night")} state="whole" />);

    await waitFor(async () => expect(await runsOf()).toEqual(["dark"]));
    expect(document.querySelector("[data-sun]")).not.toBeInTheDocument();
  });

  it("gives a sun that never sets no dots and no sun, only its gold around midnight", async () => {
    render(<AxisLightCell day={dayIndexOf("midnight sun")} state="whole" />);

    await waitFor(async () => expect(await runsOf()).toEqual(["golden"]));
    expect(document.querySelector("[data-sun]")).not.toBeInTheDocument();
  });

  it("brings in a day's evening light only once the day is whole", async () => {
    render(<AxisLightCell day={dayIndexOf("Kyoto")} state="writing" />);

    // Written down to lunch, the light has come no further than the stops placed.
    expect(await runsOf()).toEqual([]);
    expect(document.querySelector("[data-sun]")).not.toBeInTheDocument();
  });

  it("keeps a polar day's dots down to the last stop placed while it is written", async () => {
    render(<AxisLightCell day={dayIndexOf("polar night")} state="writing" />);

    await waitFor(async () => expect(await runsOf()).toEqual(["dark"]));
  });

  it("opens the last stop's sheet beside the axis", async () => {
    render(<AxisLightCell day={dayIndexOf("Kyoto")} state="open" />);

    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: /^About Obanzai along Pontocho/ }),
      ).toBeInTheDocument(),
    );
    expect(await runsOf()).toContain("dark");
  });
});
