import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PartSlip, SLIP_ATTRIBUTE, type SlipPlacement } from "./part-slip";
import {
  SLIP_EXAMPLES,
  SLIP_MOMENTS,
  slipStillOf,
  type SlipExample,
  type SlipMoment,
} from "./part-slip-examples";

/** jsdom lays nothing out; the slip's glide only needs to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

function exampleOf(start: string): SlipExample {
  const found = SLIP_EXAMPLES.find(({ label }) => label.startsWith(start));
  if (!found) throw new Error(`No example ${start}`);
  return found.example;
}

function momentOf(start: string): SlipMoment {
  const found = SLIP_MOMENTS.find(({ label }) => label.startsWith(start));
  if (!found) throw new Error(`No moment ${start}`);
  return found.moment;
}

/** Elche's lunch, the first of its two parts: one stop. */
const LUNCH = exampleOf("one stop");
/** Elche's evening, the second part: three stops, one that stays. */
const EVENING = exampleOf("three");
/** A whole day written again, sixteen stops. */
const WHOLE_DAY = exampleOf("sixteen");

function renderSlip(example: SlipExample, moment: SlipMoment, placement: SlipPlacement = "column") {
  const acts = { onChoose: vi.fn(), onAskAgain: vi.fn() };
  const { view, shown, other } = slipStillOf(example, moment);
  const props = {
    view,
    shown,
    other,
    opens: example.opens,
    index: example.fork.index,
    count: example.fork.count,
    reach: example.fork.reach,
    placement,
    ...acts,
  };
  const { container, rerender } = render(<PartSlip {...props} />);
  return { ...acts, container, rerender, props };
}

const slipOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(`[${SLIP_ATTRIBUTE}]`);

const linesOf = (container: HTMLElement) =>
  [...(slipOf(container)?.querySelectorAll("li:not([aria-hidden])") ?? [])].map(
    (line) => line.textContent,
  );

describe("PartSlip", () => {
  it("says the two answers as one group, the day's chosen at the fork line, the part counted", () => {
    renderSlip(LUNCH, momentOf("whole"));

    const group = screen.getByRole("radiogroup", { name: "early dinner or eating late, 1 of 2" });
    expect(within(group).getByRole("radio", { name: "early dinner, your day" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "eating late, proposed" })).not.toBeChecked();
  });

  it("draws the part's count for the eye alone, since the group's name says it", () => {
    renderSlip(LUNCH, momentOf("whole"));

    const count = within(screen.getByRole("radiogroup")).getByText("1 of 2");
    expect(count.closest("[aria-hidden]")).not.toBeNull();
  });

  it("lists the other version once whole: its receipt, one line a stop, the hours it takes", () => {
    const { container } = renderSlip(LUNCH, momentOf("whole"));

    expect(slipOf(container)).toHaveTextContent("Dinner 21:00, not 18:15 · 3 new stops");
    expect(slipOf(container)).toHaveTextContent("ends 23:45, not 20:45");
    expect(linesOf(container)).toEqual([
      "13:15Arròs on Passeig de l'Estació\u00a0· lunch\u00a0· until\u00a014:45",
    ]);
    expect(slipOf(container)).toHaveTextContent("in place of 13:15");
    expect(screen.getByRole("status")).toHaveTextContent("eating late is ready beside your day");
  });

  it("says the receipt once, in the first part: a later part lists its lines alone", () => {
    const { container } = renderSlip(EVENING, momentOf("whole"));

    expect(slipOf(container)).not.toHaveTextContent("Dinner 21:00");
    expect(linesOf(container)).toEqual([
      "16:30Huerto del Cura\u00a0· stays",
      "21:00Tapas along Carrer Major de la Vila\u00a0· dinner\u00a0· until\u00a022:45",
      "23:15Plaça de Baix at night\u00a0· walk\u00a0· until\u00a023:45",
    ]);
    expect(slipOf(container)).toHaveTextContent("in place of 18:15 and 20:00");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("takes the proposal at its answer, and keeps the day at the fork line's", async () => {
    const user = userEvent.setup();
    const { onChoose } = renderSlip(LUNCH, momentOf("whole"));

    await user.click(screen.getByRole("radio", { name: "eating late, proposed" }));
    await user.click(screen.getByRole("radio", { name: "early dinner, your day" }));

    expect(onChoose.mock.calls).toEqual([["to"], ["from"]]);
  });

  it("takes the other answer by the arrows, the focus on the checked one as the choice flips", async () => {
    const user = userEvent.setup();
    const { onChoose, rerender, props } = renderSlip(LUNCH, momentOf("whole"));

    screen.getByRole("radio", { name: "early dinner, your day" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChoose).toHaveBeenCalledWith("to");
    const taken = slipStillOf(LUNCH, momentOf("taken"));
    rerender(<PartSlip {...props} {...taken} />);

    expect(screen.getByRole("radio", { name: "eating late, your day" })).toHaveFocus();
  });

  it("gives the focus to the checked answer when the slip's own answer is taken", async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderSlip(LUNCH, momentOf("whole"));

    await user.click(screen.getByRole("radio", { name: "eating late, proposed" }));
    const taken = slipStillOf(LUNCH, momentOf("taken"));
    rerender(<PartSlip {...props} {...taken} />);

    const checked = screen.getByRole("radio", { checked: true });
    expect(checked).toHaveAccessibleName("eating late, your day");
    expect(checked).toHaveFocus();
  });

  it("while written, says what Lantern is doing, cannot be taken, and holds the part's room", async () => {
    const user = userEvent.setup();
    const { container, onChoose } = renderSlip(LUNCH, momentOf("writing: no line"));

    const answer = screen.getByRole("radio", { name: "eating late, being written" });
    expect(answer).toHaveAttribute("aria-disabled", "true");
    await user.click(answer);
    await user.keyboard("{ArrowRight}");
    expect(onChoose).not.toHaveBeenCalled();
    expect(slipOf(container)).toHaveTextContent("Looking for a dinner after nine");
    expect(slipOf(container)).not.toHaveTextContent("in place of");
    // The lunch's one stop and one more.
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(2);
  });

  it("says nothing of the search before it is due, its room still held", () => {
    const { container } = renderSlip(LUNCH, momentOf("nothing yet"));

    expect(slipOf(container)).not.toHaveTextContent("Looking");
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(2);
  });

  it("lets each line in once its stop is finished, into a line of room held for each stop", async () => {
    const { container, rerender, props } = renderSlip(EVENING, momentOf("writing: its first"));
    expect(linesOf(container)).toEqual(["16:30Huerto del Cura\u00a0· stays"]);
    // Three stops and one more, the first of them filled.
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(3);

    const { other } = slipStillOf(EVENING, momentOf("writing: every"));
    rerender(<PartSlip {...props} other={other} />);

    await waitFor(() =>
      expect(linesOf(container)[1]).toBe(
        "21:00Tapas along Carrer Major de la Vila\u00a0· dinner\u00a0· until\u00a022:45",
      ),
    );
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(1);
  });

  it("holds no room in the margin, where nothing it does moves the plan", () => {
    const { container } = renderSlip(LUNCH, momentOf("writing: no line"), "margin");

    expect(slipOf(container)).toBeInTheDocument();
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(0);
  });

  it("once taken, lists the day before under its answer, its receipt and foot turned", async () => {
    const user = userEvent.setup();
    const { container, onChoose } = renderSlip(EVENING, momentOf("taken"));

    expect(screen.getByRole("radio", { name: "eating late, your day" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "early dinner, the day before" }));
    expect(onChoose).toHaveBeenCalledWith("from");
    expect(linesOf(container)).toEqual([
      "16:30Huerto del Cura\u00a0· stays",
      "18:15Rice dinner on Passeig de l'Estació\u00a0· dinner\u00a0· until\u00a019:45",
      "20:00Plaça de Baix at dusk\u00a0· walk\u00a0· until\u00a020:45",
    ]);
    expect(slipOf(container)).toHaveTextContent("in place of 21:00 and 23:15");
  });

  it("turns the first part's receipt once taken, the hour alone", () => {
    const { container } = renderSlip(LUNCH, momentOf("taken"));

    expect(slipOf(container)).toHaveTextContent("Dinner 18:15, not 21:00");
    expect(slipOf(container)).not.toHaveTextContent("new stops");
  });

  it("keeps the proposal beside the day once the visitor keeps their own, still to take", () => {
    const { container } = renderSlip(LUNCH, momentOf("kept"));

    expect(screen.getByRole("radio", { name: "early dinner, your day" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "eating late, proposed" })).toHaveTextContent("Take");
    expect(linesOf(container)).toHaveLength(1);
  });

  it("ends without a proposal at the first part alone, with why and a way to ask again", async () => {
    const user = userEvent.setup();
    const { container, onAskAgain } = renderSlip(LUNCH, momentOf("an ending: didn't fit"));

    expect(slipOf(container)).toBeNull();
    const group = screen.getByRole("radiogroup", { name: "early dinner or eating late, 1 of 2" });
    expect(group).toHaveTextContent("The new dinner didn't fit");
    await user.click(screen.getByRole("button", { name: "Ask again" }));
    expect(onAskAgain).toHaveBeenCalled();
  });

  it("offers no second try where one would meet the same end, and draws no later part", () => {
    renderSlip(LUNCH, momentOf("an ending: our limit"));
    expect(screen.queryByRole("button", { name: "Ask again" })).not.toBeInTheDocument();

    const { container } = renderSlip(EVENING, momentOf("an ending: our limit"));
    expect(container).toBeEmptyDOMElement();
  });

  it("fades the slip away when the fork ends while it stands", async () => {
    const { container, rerender, props } = renderSlip(LUNCH, momentOf("writing: its first"));
    const { view } = slipStillOf(LUNCH, momentOf("an ending: cut"));

    rerender(<PartSlip {...props} view={view} />);

    await waitFor(() => expect(slipOf(container)).toBeNull());
  });

  it("times a part past midnight on the day's clock: a late supper, the river moved", () => {
    const { container } = renderSlip(exampleOf("a part past midnight"), momentOf("whole"));

    expect(linesOf(container)).toEqual([
      "00:50Tinned fish on Pink Street\u00a0· late supper\u00a0· until\u00a001:30",
      "01:30Late drinks on the river\u00a0· was\u00a001:00",
    ]);
    expect(slipOf(container)).toHaveTextContent("in place of 01:00");
  });

  it("takes no line for a receipt with nothing to say, its end said alone", () => {
    const { container } = renderSlip(exampleOf("the longest answers"), momentOf("taken"));

    expect(slipOf(container)).toHaveTextContent("ends 20:45, not 23:45");
    const notes = [...(slipOf(container)?.querySelectorAll("p") ?? [])];
    expect(notes.filter((note) => note.textContent === "")).toHaveLength(0);
  });

  it("ties each dot to the word before it and a moved line's hour to its word", () => {
    const { container } = renderSlip(exampleOf("two of the day's"), momentOf("whole"));

    expect(linesOf(container)).toEqual([
      "07:30Coffee on the Oudegracht\u00a0· was\u00a010:00",
      "08:30Domtoren\u00a0· was\u00a011:15",
      "10:00Park Lepelenburg\u00a0· garden\u00a0· until\u00a011:30",
    ]);
  });

  it("once taken, names the hour the day now gives a moved place, not the one it had", () => {
    const { container } = renderSlip(exampleOf("a part past midnight"), momentOf("taken"));

    expect(linesOf(container)).toEqual([
      "01:00Late drinks on the river\u00a0· now\u00a0at\u00a001:30",
    ]);
    expect(slipOf(container)).toHaveTextContent("in place of 00:50 and 01:30");
  });

  it("counts no part for a whole day, and takes the whole of it", () => {
    const { container } = renderSlip(WHOLE_DAY, momentOf("whole"));

    expect(
      screen.getByRole("radiogroup", { name: "with anyone or with friends" }),
    ).not.toHaveTextContent("1 of 1");
    expect(linesOf(container)).toHaveLength(16);
    expect(slipOf(container)).toHaveTextContent("in place of the whole day");
  });
});
