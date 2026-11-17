import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FORK_ROW_ATTRIBUTE, ForkLine, ForkRow, ForkStatus, shownFirstForkRow } from "./fork-row";
import { FORK_EXAMPLES, FORK_MOMENTS, forkViewAt, type ForkMoment } from "./fork-row-examples";
import { FORK_ROW_MATRIX } from "./fork-row-matrix";
import { DEFAULT_DRAWING } from "./rows";

/** jsdom lays nothing out; the row only needs to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

/** Elche's dinner, the first of its two parts. */
const ELCHE = FORK_EXAMPLES[0]!.example;
/** A whole day written again for a family. */
const WHOLE = FORK_EXAMPLES[3]!.example;

function momentOf(label: string): ForkMoment {
  const found = FORK_MOMENTS.find((each) => each.label === label);
  if (!found) throw new Error(`No moment ${label}`);
  return found.moment;
}

function renderRow(
  moment: ForkMoment,
  {
    example = ELCHE,
    lineAt = "under",
    onMeasure = vi.fn(),
  }: { example?: typeof ELCHE; lineAt?: "under" | "margin"; onMeasure?: () => void } = {},
) {
  const acts = { onChoose: vi.fn(), onCompare: vi.fn(), onAskAgain: vi.fn() };
  render(
    <ForkRow
      view={forkViewAt(example, moment)}
      index={example.index}
      count={example.count}
      timeWidth={45}
      wordsLeft={66}
      drawing={DEFAULT_DRAWING}
      lineAt={lineAt}
      onMeasure={onMeasure}
      {...acts}
    />,
  );
  return acts;
}

const answer = (name: RegExp) => screen.getByRole("radio", { name });

describe("ForkRow", () => {
  it("says both answers as a group of two, the visitor's day chosen, and which part it is", () => {
    renderRow(momentOf("writing: looking"));

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAccessibleName("early dinner or eating late, 1 of 2");
    expect(answer(/^early dinner, your day$/)).toHaveAttribute("aria-checked", "true");
    expect(answer(/^eating late, being written$/)).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    // Only the chosen answer is in the Tab order, as a radio group's is.
    expect(answer(/^early dinner/)).toHaveAttribute("tabindex", "0");
    expect(answer(/^eating late/)).toHaveAttribute("tabindex", "-1");
  });

  it("takes nothing while its proposal is written, its answer lit, and says what Lantern is doing", async () => {
    const user = userEvent.setup();
    const acts = renderRow(momentOf("writing: its new stops"));

    const proposal = answer(/^eating late, being written$/);
    expect(proposal).toHaveAttribute("aria-disabled", "true");
    expect(within(proposal).getByText("eating late").className).toContain("animate-pass-steady");
    await user.click(proposal);
    expect(acts.onChoose).not.toHaveBeenCalled();
    expect(screen.getByText("Writing the new stops")).toBeInTheDocument();
    expect(screen.getByText("1 so far")).toBeInTheDocument();
  });

  it("says the proposal is ready once, and not again as its receipt follows an energy", () => {
    const ready = forkViewAt(ELCHE, momentOf("ready: take it"));
    const { rerender } = render(<ForkStatus view={ready} />);
    const said = "eating late is ready beside your day: Dinner 21:00, not 18:15 · 3 new stops";
    expect(screen.getByRole("status")).toHaveTextContent(said);

    // The same proposal at another energy: what it would change reads otherwise in the row.
    const line = ready.line === null ? null : { ...ready.line, words: "1 new stop, 1 later" };
    rerender(<ForkStatus view={{ ...ready, line }} />);
    expect(screen.getByRole("status")).toHaveTextContent(said);

    // Chosen, nothing is said; ready anew for another answer, it is said for that one.
    rerender(<ForkStatus view={{ ...ready, isReady: false, isChosen: true, line: null }} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    rerender(<ForkStatus view={{ ...ready, to: "home by eleven", line }} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "home by eleven is ready beside your day: 1 new stop, 1 later",
    );
  });

  it("offers the whole proposal to take, with what it would change, in one control", async () => {
    const user = userEvent.setup();
    const acts = renderRow(momentOf("ready: take it"));

    const proposal = answer(/^eating late, proposed$/);
    expect(proposal).toHaveTextContent("eating late· Take");
    expect(screen.getByText("Dinner 21:00, not 18:15 · 3 new stops")).toBeInTheDocument();
    expect(screen.getByText("ends 23:45, not 20:45")).toBeInTheDocument();
    // Said once, from the first row's live region.
    expect(screen.getByRole("status")).toHaveTextContent(
      "eating late is ready beside your day: Dinner 21:00, not 18:15 · 3 new stops",
    );

    await user.click(proposal);
    expect(acts.onChoose).toHaveBeenCalledWith("to");
  });

  it("moves between the answers with the arrows and takes the one it lands on", async () => {
    const user = userEvent.setup();
    const acts = renderRow(momentOf("ready: take it"));

    answer(/^early dinner/).focus();
    await user.keyboard("{ArrowRight}");

    expect(acts.onChoose).toHaveBeenCalledWith("to");
    expect(answer(/^eating late/)).toHaveFocus();
  });

  it("folds to its answers once a version is taken, the day before a press away, and compares", async () => {
    const user = userEvent.setup();
    const acts = renderRow(momentOf("taken, folded"));

    expect(answer(/^eating late, your day$/)).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(/not 18:15/)).toBeNull();
    await user.click(answer(/^early dinner, the day before$/));
    expect(acts.onChoose).toHaveBeenCalledWith("from");

    const compare = screen.getByRole("button", { name: "Compare" });
    expect(compare).toHaveAttribute("aria-pressed", "false");
    await user.click(compare);
    expect(acts.onCompare).toHaveBeenCalledOnce();
  });

  it("says the day before's receipt once compared beside the proposal taken", () => {
    renderRow(momentOf("taken, compared"));

    expect(screen.getByRole("button", { name: "Compare" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Dinner 18:15, not 21:00")).toBeInTheDocument();
  });

  it("says why it failed with the visitor's answer alone, and asks again where it might mend", async () => {
    const user = userEvent.setup();
    const acts = renderRow(momentOf("failed: didn't fit"));

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getAllByText("The new dinner didn't fit").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Ask again" }));
    expect(acts.onAskAgain).toHaveBeenCalledOnce();
  });

  it("asks nothing again at our limit", () => {
    renderRow(momentOf("failed: our limit"));

    expect(screen.getAllByText("No more re-plans for now").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Ask again" })).toBeNull();
  });

  it("offers a whole day's proposal to take, and nothing to compare once taken", () => {
    renderRow(momentOf("taken, folded"), { example: WHOLE });

    expect(screen.getByRole("radiogroup")).toHaveAccessibleName("with anyone or with family");
    expect(screen.queryByText(/of 1/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Compare" })).toBeNull();
  });

  it("holds two lines of room under its answers while unfolded, and none in the margin", () => {
    renderRow(momentOf("writing: looking"));
    const row = document.querySelector(`[${FORK_ROW_ATTRIBUTE}="0"]`);
    // Its line and the receipt's second line, held while empty.
    expect(row?.querySelectorAll("p.min-h-5")).toHaveLength(2);
  });

  it("leaves its line to the margin on a laptop, holding a line of room alone", () => {
    renderRow(momentOf("ready: take it"), { lineAt: "margin" });

    expect(screen.queryByText("Dinner 21:00, not 18:15 · 3 new stops")).toBeNull();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("tells its height as it lays out, the room the day holds for it", () => {
    const onMeasure = vi.fn();
    renderRow(momentOf("ready: take it"), { onMeasure });

    expect(onMeasure).toHaveBeenCalled();
  });
});

describe("ForkLine", () => {
  it("says a receipt's two lines, and holds no room it does not need", () => {
    render(<ForkLine view={forkViewAt(ELCHE, momentOf("ready: take it"))} onAskAgain={vi.fn()} />);

    expect(screen.getByText("Dinner 21:00, not 18:15 · 3 new stops")).toBeInTheDocument();
    expect(screen.getByText("ends 23:45, not 20:45")).toBeInTheDocument();
  });
});

describe("shownFirstForkRow", () => {
  /**
   * Both views' first fork rows, the chart's before the plan's as the page holds them, each
   * given a box where its view is laid out (jsdom lays nothing out) and hidden as `hidden` says.
   */
  function renderBothViews(hidden: "chart" | "plan") {
    render(
      <>
        <div>
          <div {...{ [FORK_ROW_ATTRIBUTE]: 0 }}>the chart&apos;s</div>
        </div>
        <div>
          <div {...{ [FORK_ROW_ATTRIBUTE]: 0 }}>the plan&apos;s</div>
        </div>
      </>,
    );
    const [chartRow, planRow] = [screen.getByText("the chart's"), screen.getByText("the plan's")];
    const box = () => [new DOMRect(0, 0, 320, 66)] as unknown as DOMRectList;
    // The chart is laid out in either view, unseen behind the plan; the plan is not drawn
    // behind the chart. jsdom has no stylesheet, so the plan's hiding is set here.
    chartRow.getClientRects = box;
    if (hidden === "chart") {
      planRow.getClientRects = box;
      chartRow.parentElement?.style.setProperty("visibility", "hidden");
    }
    return { chartRow, planRow };
  }

  it("finds the plan's row on the plan, past the chart's laid out unseen before it", () => {
    const { planRow } = renderBothViews("chart");

    expect(shownFirstForkRow()).toBe(planRow);
  });

  it("finds the chart's row on the chart, the plan's not drawn", () => {
    const { chartRow } = renderBothViews("plan");

    expect(shownFirstForkRow()).toBe(chartRow);
  });

  it("finds none while no fork row is seen", () => {
    render(<div {...{ [FORK_ROW_ATTRIBUTE]: 0 }}>not laid out</div>);

    expect(shownFirstForkRow()).toBeNull();
  });
});

describe("FORK_ROW_MATRIX", () => {
  it("sets every moment of every example, at a phone's width and on a laptop", () => {
    const moments = FORK_ROW_MATRIX.axes[0]?.labels ?? [];
    const examples = FORK_ROW_MATRIX.axes[1]?.labels ?? [];
    expect(moments.length * examples.length).toBe(FORK_MOMENTS.length * FORK_EXAMPLES.length);

    for (const width of ["phone", "wide"] as const) {
      const view = render(<>{FORK_ROW_MATRIX.renderCell([3, 0], width)}</>);
      expect(screen.getByRole("radio", { name: /^eating late, proposed$/ })).toBeInTheDocument();
      // On a laptop the receipt stands in the margin beside the row.
      expect(screen.getByText("Dinner 21:00, not 18:15 · 3 new stops")).toBeInTheDocument();
      view.unmount();
    }
  });
});
