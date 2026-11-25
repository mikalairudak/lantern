import { act, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(
      within(group).getByRole("radio", { name: "eating late Take, proposed" }),
    ).not.toBeChecked();
  });

  it("names each answer by the words it shows, and says what each version is beside it", () => {
    const { rerender, props } = renderSlip(LUNCH, momentOf("writing: no line"));
    const other = () => screen.getByRole("radio", { checked: false });

    // While written, "Take" is held unseen, and the name is the answer alone.
    expect(other()).toHaveAccessibleName("eating late, being written");

    rerender(<PartSlip {...props} {...slipStillOf(LUNCH, momentOf("whole"))} />);
    expect(other()).toHaveAccessibleName("eating late Take, proposed");

    rerender(<PartSlip {...props} {...slipStillOf(LUNCH, momentOf("taken"))} />);
    expect(other()).toHaveAccessibleName("early dinner Take, the day before");
    const shown = screen.getByRole("radio", { checked: true });
    expect(shown).toHaveAccessibleName("eating late, your day");
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
      "13:15Arròs on Passeig de l'Estació\u00a0·\u00a0lunch\u00a0· until\u00a014:45",
    ]);
    expect(slipOf(container)).toHaveTextContent("in place of 13:15");
    expect(screen.getByRole("status")).toHaveTextContent("eating late is ready beside your day");
  });

  it("says the receipt once, in the first part: a later part lists its lines alone", () => {
    const { container } = renderSlip(EVENING, momentOf("whole"));

    expect(slipOf(container)).not.toHaveTextContent("Dinner 21:00");
    expect(linesOf(container)).toEqual([
      "16:30Huerto del Cura\u00a0·\u00a0stays",
      "21:00Tapas along Carrer Major de la Vila\u00a0·\u00a0dinner\u00a0· until\u00a022:45",
      "23:15Plaça de Baix at night\u00a0·\u00a0walk\u00a0· until\u00a023:45",
    ]);
    expect(slipOf(container)).toHaveTextContent("in place of 18:15 and 20:00");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("binds a line's first dot to the words either side with no-break spaces, so a line never ends on it", () => {
    const { container } = renderSlip(EVENING, momentOf("whole"));

    // The first dot alone, its spaces both U+00A0: where else a line may break, in its name or
    // inside a mark of two words, is the browser's to choose.
    for (const line of linesOf(container)) expect(line).toMatch(/\u00a0·\u00a0/);
  });

  it("takes the proposal at its answer, and keeps the day at the fork line's", async () => {
    const user = userEvent.setup();
    const { onChoose } = renderSlip(LUNCH, momentOf("whole"));

    await user.click(screen.getByRole("radio", { name: "eating late Take, proposed" }));
    await user.click(screen.getByRole("radio", { name: "early dinner, your day" }));

    expect(onChoose.mock.calls).toEqual([["to"], ["from"]]);
  });

  it("takes no second press of a double press on the same control", async () => {
    const user = userEvent.setup();
    const { onChoose, rerender, props } = renderSlip(EVENING, momentOf("whole"));
    const control = screen.getByRole("radio", {
      name: "eating late Take, proposed",
    });

    await user.click(control);
    // Taken, the same control now offers the day before, where the finger still is.
    rerender(<PartSlip {...props} {...slipStillOf(EVENING, momentOf("taken"))} />);
    await user.click(control);

    expect(onChoose.mock.calls).toEqual([["to"]]);
  });

  it("remembers no press that did nothing, as on a proposal still being written", async () => {
    const user = userEvent.setup();
    const { onChoose, rerender, props } = renderSlip(LUNCH, momentOf("writing: every"));

    await user.click(screen.getByRole("radio", { name: "eating late, being written" }));
    rerender(<PartSlip {...props} {...slipStillOf(LUNCH, momentOf("whole"))} />);
    await user.click(screen.getByRole("radio", { name: "eating late Take, proposed" }));

    expect(onChoose.mock.calls).toEqual([["to"]]);
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

    await user.click(screen.getByRole("radio", { name: "eating late Take, proposed" }));
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
    // Its foot's room is held unseen and unheard, its words said once the proposal is whole.
    const said = [...(slipOf(container)?.querySelectorAll("p") ?? [])].filter(
      (line) => line.closest("[aria-hidden]") === null,
    );
    expect(said.some((line) => line.textContent?.includes("in place of"))).toBe(false);
    // The lunch's one stop and one more, held as they would wrap.
    const held = [...(slipOf(container)?.querySelectorAll("li[aria-hidden]") ?? [])];
    expect(held.map((line) => line.textContent)).toEqual([
      "13:15Menú del día on Carrer Major de la Vila\u00a0·\u00a0lunch\u00a0· until\u00a014:30",
      "13:15Menú del día on Carrer Major de la Vila\u00a0·\u00a0lunch\u00a0· until\u00a014:30",
    ]);
  });

  it("says nothing of the search before it is due, its room still held", () => {
    const { container } = renderSlip(LUNCH, momentOf("nothing yet"));

    expect(slipOf(container)).not.toHaveTextContent("Looking");
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(2);
  });

  it("lets each line in once its stop is finished, into a line of room held for each stop", async () => {
    const { container, rerender, props } = renderSlip(EVENING, momentOf("writing: its first"));
    expect(linesOf(container)).toEqual(["16:30Huerto del Cura\u00a0·\u00a0stays"]);
    // Three stops and one more, the first of them filled.
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(3);

    const { other } = slipStillOf(EVENING, momentOf("writing: every"));
    rerender(<PartSlip {...props} other={other} />);

    await waitFor(() =>
      expect(linesOf(container)[1]).toBe(
        "21:00Tapas along Carrer Major de la Vila\u00a0·\u00a0dinner\u00a0· until\u00a022:45",
      ),
    );
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(1);
  });

  it("lists a version already written whole on a take, writing none of its lines in again", () => {
    const { container, rerender, props } = renderSlip(EVENING, momentOf("whole"));
    const taken = slipStillOf(EVENING, momentOf("taken"));

    rerender(<PartSlip {...props} {...taken} />);

    // The day before's lines are new to this slip, yet whole: nothing is being written.
    expect(linesOf(container)).toHaveLength(3);
    expect(slipOf(container)?.querySelectorAll("ol .invisible")).toHaveLength(0);
  });

  it("lists a version taken back whole, though its lines were written in as it arrived", async () => {
    const { container, rerender, props } = renderSlip(EVENING, momentOf("writing: no line"));
    const at = (moment: string) => ({ ...props, ...slipStillOf(EVENING, momentOf(moment)) });
    // Its lines written in as the proposal arrives, then whole, taken and taken back: the
    // garden that stays keeps the slip in its place throughout.
    rerender(<PartSlip {...at("writing: every")} />);
    await waitFor(() =>
      expect(
        slipOf(container)?.querySelectorAll("ol li:not([aria-hidden]) .invisible"),
      ).toHaveLength(0),
    );
    rerender(<PartSlip {...at("whole")} />);
    rerender(<PartSlip {...at("taken")} />);

    rerender(<PartSlip {...at("kept")} />);

    expect(linesOf(container)).toHaveLength(3);
    expect(slipOf(container)?.querySelectorAll("ol li:not([aria-hidden]) .invisible")).toHaveLength(
      0,
    );
  });

  it("holds the room it will take in the margin too, so the row beside it holds it once", () => {
    const { container } = renderSlip(LUNCH, momentOf("writing: no line"), "margin");

    expect(slipOf(container)).toBeInTheDocument();
    expect(slipOf(container)?.querySelectorAll("li[aria-hidden]")).toHaveLength(2);
  });

  it("once taken, lists the day before under its answer, its receipt and foot turned", async () => {
    const user = userEvent.setup();
    const { container, onChoose } = renderSlip(EVENING, momentOf("taken"));

    expect(screen.getByRole("radio", { name: "eating late, your day" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "early dinner Take, the day before" }));
    expect(onChoose).toHaveBeenCalledWith("from");
    expect(linesOf(container)).toEqual([
      "16:30Huerto del Cura\u00a0·\u00a0stays",
      "18:15Rice dinner on Passeig de l'Estació\u00a0·\u00a0dinner\u00a0· until\u00a019:45",
      "20:00Plaça de Baix at dusk\u00a0·\u00a0walk\u00a0· until\u00a020:45",
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
    expect(screen.getByRole("radio", { name: "eating late Take, proposed" })).toHaveTextContent(
      "Take",
    );
    expect(linesOf(container)).toHaveLength(1);
  });

  it("ends without a proposal at the first part alone, with why and a way to ask again", async () => {
    const user = userEvent.setup();
    const { container, onAskAgain } = renderSlip(LUNCH, momentOf("an ending: didn't fit"));

    expect(slipOf(container)).toBeNull();
    // One line for the whole fork: it counts no part of two.
    const group = screen.getByRole("radiogroup", { name: "early dinner or eating late" });
    expect(group).toHaveTextContent("The new dinner didn't fit");
    expect(group).not.toHaveTextContent("1 of 2");
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

  it("takes the slip out of reach while it fades, its proposal no answer to take", () => {
    const { container, rerender, props } = renderSlip(LUNCH, momentOf("writing: its first"));
    const { view } = slipStillOf(LUNCH, momentOf("an ending: cut"));

    rerender(<PartSlip {...props} view={view} />);

    const fading = slipOf(container);
    if (fading === null) throw new Error("The slip is still fading");
    expect(fading.closest("[inert]")).not.toBeNull();
    // The answer of the version that stays is still the visitor's to press.
    expect(screen.getByRole("radio", { checked: true }).closest("[inert]")).toBeNull();
  });

  it("hands a focus on the fading slip to the fork line's answer, the version that stays", () => {
    const { container, rerender, props } = renderSlip(LUNCH, momentOf("writing: its first"));
    const proposal = slipOf(container)?.querySelector<HTMLElement>('[role="radio"]');
    if (!proposal) throw new Error("The slip offers its proposal");
    // A pointer's press gives it the focus, though it cannot be taken yet.
    act(() => proposal.focus());
    const { view } = slipStillOf(LUNCH, momentOf("an ending: cut"));

    rerender(<PartSlip {...props} view={view} />);

    expect(screen.getByRole("radio", { checked: true })).toHaveFocus();
  });

  it("leaves a focus elsewhere where it is as the slip fades", () => {
    const { rerender, props } = renderSlip(LUNCH, momentOf("writing: its first"));
    const elsewhere = document.body.appendChild(document.createElement("button"));
    act(() => elsewhere.focus());
    const { view } = slipStillOf(LUNCH, momentOf("an ending: cut"));

    rerender(<PartSlip {...props} view={view} />);

    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it("times a part past midnight on the day's clock: a late supper, the river moved", () => {
    const { container } = renderSlip(exampleOf("a part past midnight"), momentOf("whole"));

    expect(linesOf(container)).toEqual([
      "00:50Tinned fish on Pink Street\u00a0·\u00a0late supper\u00a0· until\u00a001:30",
      "01:30Late drinks on the river\u00a0·\u00a0was\u00a001:00",
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
      "07:30Coffee on the Oudegracht\u00a0·\u00a0was\u00a010:00",
      "08:30Domtoren\u00a0·\u00a0was\u00a011:15",
      "10:00Park Lepelenburg\u00a0·\u00a0garden\u00a0· until\u00a011:30",
    ]);
  });

  it("once taken, names the hour the day now gives a moved place, not the one it had", () => {
    const { container } = renderSlip(exampleOf("a part past midnight"), momentOf("taken"));

    expect(linesOf(container)).toEqual([
      "01:00Late drinks on the river\u00a0·\u00a0now\u00a0at\u00a001:30",
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
