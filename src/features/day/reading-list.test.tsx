import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeDraftOf,
  draftDayOf,
  openableStopsOf,
  type StopDraft,
} from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { revealedOf } from "@/features/itinerary/revealed";
import { firstAt, partialAt } from "@/features/itinerary/stream-frames";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { enteredOf, versionsWrittenOf } from "./reading-gates";
import { PartSlip } from "./part-slip";
import { SLIP_EXAMPLES, SLIP_MOMENTS, slipStillOf } from "./part-slip-examples";
import { BESIDE_ATTRIBUTE, ReadingList, type PlanParts } from "./reading-list";

/** Longer than a row's fold takes to open on the layout spring. */
const GLIDE_SETTLED_MS = 3000;

function wholeOf(fixture: typeof KYOTO_DAY) {
  const itinerary = itineraryOf(fixture);
  const { stops } = completeDraftOf(itinerary);
  return {
    stops,
    entered: stops.length,
    versionsShown: new Set(stops.map((stop) => stop.id)),
    picks: stops.map(() => 0),
    daylight: dayContextOf(itinerary),
  };
}

const KYOTO = wholeOf(KYOTO_DAY);

/** Elche's lunch, the first of its fork's two parts, as its slip stands at a moment. */
function slipOf(moment: "whole" | "taken", { onChoose = vi.fn() } = {}) {
  const lunch = SLIP_EXAMPLES.find(({ label }) => label.startsWith("one stop"))!.example;
  const at = SLIP_MOMENTS.find(({ label }) => label.startsWith(moment))!.moment;
  const { view, shown, other } = slipStillOf(lunch, at);
  return (
    <PartSlip
      view={view}
      shown={shown}
      other={other}
      opens={lunch.opens}
      index={0}
      count={2}
      reach="part"
      placement="column"
      onChoose={onChoose}
      onAskAgain={vi.fn()}
    />
  );
}

/** Kyoto's list at the first frame of its stream that meets `isReached`, let in as the day lets it. */
async function kyotoAt(isReached: Parameters<typeof firstAt>[1]) {
  const text = dayText(KYOTO_DAY.day);
  const revealed = revealedOf(await partialAt(text, await firstAt(text, isReached)), null);
  const draft = draftDayOf(revealed);
  return {
    ...KYOTO,
    stops: draft.stops,
    entered: enteredOf(draft.stops, openableStopsOf(revealed.day, draft)),
    versionsShown: versionsWrittenOf(draft.stops, revealed.day.alternatives, draft.isComplete),
    picks: draft.stops.map(() => 0),
  };
}

function rowsOf(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "The day, to read" })).queryAllByRole("listitem");
}

/** The list's own items, its rows and its parts' heads, without the lists a slip holds. */
function itemsOf(): HTMLElement[] {
  const list = screen.getByRole("list", { name: "The day, to read" });
  return [...list.querySelectorAll<HTMLElement>(":scope > li")];
}

/** A row's words as they are read: the versions waiting beside its stop are drawn unheard. */
function readTextOf(row: HTMLElement): string {
  const copy = row.cloneNode(true) as HTMLElement;
  for (const unheard of copy.querySelectorAll("[aria-hidden]")) unheard.remove();
  return copy.textContent ?? "";
}

/** The arrows that swipe a stop to a version beside it. */
const ARROW_NAME = /^(Quieter|Livelier|Same energy): /;

// Motion as on a screen that moves, so the pen can be watched: a row on the list when it is
// first drawn stands whole all the same.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ReadingList", () => {
  it("reads each stop as a timetable: its time, name, what and where until when, its one line", () => {
    render(<ReadingList {...KYOTO} />);

    const rows = rowsOf();
    expect(rows).toHaveLength(KYOTO.stops.length);
    const first = rows[0]!;
    expect(first).toHaveTextContent("07:30");
    expect(within(first).getByRole("heading", { name: "Honen-in" })).toBeVisible();
    expect(first).toHaveTextContent("sacred · Shishigatani · until 08:15");
    expect(first).toHaveTextContent(KYOTO.stops[0]!.primary.summary ?? "");
  });

  it("says a loud place's line too, where the chart folds its row to its name", () => {
    const lisbon = wholeOf(LISBON_DAY);
    render(<ReadingList {...lisbon} />);

    // Lisbon's flea market, social: its row on the chart says only its name and kind.
    const market = rowsOf()[0]!;
    expect(market).toHaveTextContent("Feira da Ladra");
    expect(market).toHaveTextContent(lisbon.stops[0]!.primary.summary ?? "");
  });

  it("says a version's own line once it is swapped in, not what it trades", () => {
    const lisbon = wholeOf(LISBON_DAY);
    const stop = lisbon.stops[0]!;
    const version = stop.alternatives[0]!;
    render(<ReadingList {...lisbon} picks={[1, ...lisbon.picks.slice(1)]} />);

    const market = rowsOf()[0]!;
    expect(within(market).getByRole("heading", { name: version.name ?? "" })).toBeVisible();
    expect(readTextOf(market)).toContain(version.summary ?? "");
    expect(readTextOf(market)).not.toContain(stop.primary.summary ?? "");
  });

  it("swaps a stop to a version the chart would show, says the original beside it, and keeps the focus", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const { rerender } = render(<ReadingList {...KYOTO} onChoose={onChoose} />);
    const [version] = KYOTO.stops[0]!.alternatives;

    await user.click(
      within(rowsOf()[0]!).getByRole("button", { name: new RegExp(`: ${version!.name}$`) }),
    );
    expect(onChoose).toHaveBeenCalledWith(0, 1);

    rerender(
      <ReadingList
        {...KYOTO}
        picks={KYOTO.picks.map((pick, at) => (at === 0 ? 1 : pick))}
        onChoose={onChoose}
      />,
    );
    const swapped = rowsOf()[0]!;
    expect(within(swapped).getByRole("heading", { name: version!.name })).toBeVisible();
    // The planned place waits beside it, an arrow's press away.
    expect(within(swapped).getByRole("button", { name: /: Honen-in$/ })).toBeInTheDocument();
    // The arrow pressed may have gone with its version: the focus stands on the stop.
    expect(within(swapped).getByRole("group", { name: version!.name })).toHaveFocus();
  });

  it("lets a stop in only once all its row says is final, while the next stop's line is written", async () => {
    // Murin-an's one line mid-word: Honen-in and Philosopher's Path are whole, Murin-an is not.
    const day = await kyotoAt(({ day }) => (day.stops?.[2]?.place?.summary ?? "").length >= 12);
    render(<ReadingList {...day} />);

    expect(rowsOf()).toHaveLength(2);
    expect(screen.queryByText(/Murin-an/)).not.toBeInTheDocument();
    // No versions yet: the stream writes them after every stop.
    expect(screen.queryAllByRole("button", { name: ARROW_NAME })).toHaveLength(0);
  });

  it("says a stop's versions once the stream has written its set whole, a second pass", async () => {
    // The fourth stop's set just begun: the first three stops' versions are written.
    const day = await kyotoAt(({ day }) =>
      (day.alternatives ?? []).some((set) => set?.stopIndex === 3),
    );
    render(<ReadingList {...day} />);

    const rows = rowsOf();
    expect(rows).toHaveLength(KYOTO.stops.length);
    expect(
      within(rows[2]!).getByRole("button", { name: "Quieter: Konchi-in" }),
    ).toBeInTheDocument();
    expect(within(rows[3]!).queryAllByRole("button", { name: ARROW_NAME })).toHaveLength(0);
  });

  it("writes a row in with the pen once it comes in, its words holding their room", async () => {
    const { rerender } = render(<ReadingList {...KYOTO} entered={1} />);
    rerender(<ReadingList {...KYOTO} entered={2} />);

    // The new row's name is not yet written whole, but its room is held.
    const row = rowsOf()[1]!;
    expect(within(row).getByRole("heading").querySelector(".invisible")).not.toBeNull();
    await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));
    const written = within(rowsOf()[1]!).getByRole("heading", { name: "Philosopher's Path" });
    expect(written.querySelector(".invisible")).toBeNull();
  });

  it("is busy until it says all the day will, as the chart is", () => {
    const { rerender } = render(<ReadingList {...KYOTO} isWritten={false} />);
    expect(screen.getByRole("list", { name: "The day, to read" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    rerender(<ReadingList {...KYOTO} isWritten />);
    expect(screen.getByRole("list", { name: "The day, to read" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("lists the day alone: a fork's other version stands in no row of it", () => {
    const other = new Set([KYOTO.stops[1]!.id]);
    render(<ReadingList {...KYOTO} hidden={other} onChoose={vi.fn()} />);

    const rows = rowsOf();
    expect(rows).toHaveLength(KYOTO.stops.length - 1);
    expect(screen.queryByText("Philosopher's Path")).toBeNull();
    expect(screen.queryByText("proposed")).toBeNull();
    // The day's own stops stay the day's, their versions offered.
    expect(within(rows[0]!).getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("stands each part's slip over the stop it heads, its answers a group of two", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <ReadingList
        {...KYOTO}
        parts={{ anchors: [KYOTO.stops[1]!.id], headOf: () => slipOf("whole", { onChoose }) }}
      />,
    );

    // The head is an item of its own, just before the stop it heads.
    const [, head, row] = itemsOf();
    expect(row).toHaveAttribute("data-stop", KYOTO.stops[1]!.id);
    const group = within(head!).getByRole("radiogroup");
    expect(group).toHaveAccessibleName("early dinner or eating late, 1 of 2");
    await user.click(within(group).getByRole("radio", { name: "eating late, proposed" }));
    expect(onChoose).toHaveBeenCalledWith("to");
    expect(within(rowsOf()[0]!).queryByRole("radiogroup")).toBeNull();
  });

  it("stands what a caller gives over a stop's row, outside its fold, and nothing elsewhere", () => {
    const second = KYOTO.stops[1]!.id;
    const head = "the part's head";
    render(<ReadingList {...KYOTO} parts={{ anchors: [second], headOf: () => <p>{head}</p> }} />);

    const row = rowsOf().find((item) => item.getAttribute("data-stop") === second)!;
    // In an item of its own before the row: the row's fold clips, and a slip in the margin
    // stands out of it.
    expect(row.previousElementSibling).toHaveTextContent(head);
    expect(within(row).queryByText(head)).toBeNull();
    expect(screen.getAllByText(head)).toHaveLength(1);
  });

  it("folds a head beside the list with no feather, and one in the column with it", () => {
    const head = (part: number) => <p>{`head ${part}`}</p>;
    const anchors = [KYOTO.stops[1]!.id];
    const { rerender } = render(<ReadingList {...KYOTO} parts={{ anchors, headOf: head }} />);
    // The head, its press guard, the fold's content box, the fold.
    const fold = () => screen.getByText("head 0").parentElement?.parentElement?.parentElement;
    expect(fold()).toHaveClass("overflow-hidden");

    rerender(<ReadingList {...KYOTO} parts={{ anchors, headOf: head, isBeside: true }} />);

    // Its item stands it beside the list, from the item's own top, outside the fold.
    expect(fold()).not.toHaveClass("overflow-hidden");
    expect(screen.getByText("head 0").closest("li")).toHaveClass("relative");

    // The page narrowed: back in the column, the fold clips again, nothing left open.
    rerender(<ReadingList {...KYOTO} parts={{ anchors, headOf: head }} />);
    expect(fold()).toHaveClass("overflow-hidden");
    expect(fold()?.style.overflowY).toBe("");
  });

  it("holds the room a slip beside it takes after its part's last row, its rows together", () => {
    // jsdom lays nothing out: the slip beside the list is 300 px tall, its fork line 49, and each
    // row's words 100, as each stands at rest, whatever its fold is doing.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute(BESIDE_ATTRIBUTE)) return 300;
      if (this.hasAttribute("data-part-head")) return 49;
      if (this.hasAttribute("data-row-at-rest")) return 100;
      return 0;
    });
    const head = () => (
      <div>
        <p>fork line</p>
        <div {...{ [BESIDE_ATTRIBUTE]: "" }}>the slip</div>
      </div>
    );
    const [, first, second, third] = KYOTO.stops;
    // A part of two rows, and one under the last row.
    const parts = {
      anchors: [first!.id, null],
      ends: [second!.id, null],
      headOf: head,
      isBeside: true,
    };

    render(<ReadingList {...KYOTO} parts={parts} />);

    const roomOf = (place: string) =>
      document.querySelector<HTMLElement>(`[data-room-beside="${place}"] > div > div > div`)?.style
        .height;
    // 300 less the fork line and the part's two rows: 51 px, under its second row.
    expect(roomOf("0")).toBe("51px");
    expect(
      document
        .querySelector(`li[data-stop="${second!.id}"]`)
        ?.contains(document.querySelector('[data-room-beside="0"]')),
    ).toBe(true);
    expect(document.querySelector(`li[data-stop="${third!.id}"] [data-room-beside]`)).toBeNull();
    // Under the last row, the slip less its fork line.
    expect(roomOf("1")).toBe("251px");
    vi.restoreAllMocks();
  });

  it("lets the room beside a part go by the same glide as the fork goes, never at once", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute(BESIDE_ATTRIBUTE)) return 300;
      if (this.hasAttribute("data-part-head")) return 49;
      if (this.hasAttribute("data-row-at-rest") || this.hasAttribute("data-row-words")) return 100;
      return 0;
    });
    const head = () => <div {...{ [BESIDE_ATTRIBUTE]: "" }}>the slip</div>;
    const parts = { anchors: [KYOTO.stops[1]!.id], headOf: head, isBeside: true };
    const { rerender } = render(<ReadingList {...KYOTO} parts={parts} />);
    const room = () => document.querySelector('[data-room-beside="0"]');
    expect(room()).not.toBeNull();

    // The fork settled: its heads fold away, and the room under its part with them.
    rerender(<ReadingList {...KYOTO} parts={null} />);

    expect(room()).not.toBeNull();
    await waitFor(() => expect(room()).toBeNull(), { timeout: GLIDE_SETTLED_MS });
    vi.restoreAllMocks();
  });

  it("holds the room beside a part by its rows at rest, not as they glide", () => {
    // Each row's words glide to a new height, 60 px drawn this frame, 100 at rest.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute(BESIDE_ATTRIBUTE)) return 300;
      if (this.hasAttribute("data-part-head")) return 49;
      if (this.hasAttribute("data-row-at-rest")) return 100;
      if (this.hasAttribute("data-row-words")) return 60;
      return 0;
    });
    const head = () => <div {...{ [BESIDE_ATTRIBUTE]: "" }}>the slip</div>;
    const [, first, second] = KYOTO.stops;
    const parts = { anchors: [first!.id], ends: [second!.id], headOf: head, isBeside: true };

    render(<ReadingList {...KYOTO} parts={parts} />);

    // 300 less the fork line and the part's two rows as they will rest.
    const room = document.querySelector<HTMLElement>('[data-room-beside="0"] > div > div > div');
    expect(room?.style.height).toBe("51px");
    vi.restoreAllMocks();
  });

  it("holds the room beside a part through a take by its one head and the rows of the version taken", () => {
    // The slip of the proposal is 500 px tall, the one of the day before 300.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute(BESIDE_ATTRIBUTE)) return this.textContent === "proposal" ? 500 : 300;
      if (this.hasAttribute("data-part-head")) return 49;
      if (this.hasAttribute("data-row-at-rest") || this.hasAttribute("data-row-words")) return 100;
      return 0;
    });
    const slipSaying = (words: string) =>
      function SlipSaying() {
        return <div {...{ [BESIDE_ATTRIBUTE]: "" }}>{words}</div>;
      };
    const [, first, second] = KYOTO.stops;
    const { rerender } = render(
      <ReadingList
        {...KYOTO}
        hidden={new Set([second!.id])}
        parts={{ anchors: [first!.id], headOf: slipSaying("proposal"), isBeside: true }}
      />,
    );

    // Taken: the day's row folds away under the head, and the version taken's comes in.
    rerender(
      <ReadingList
        {...KYOTO}
        hidden={new Set([first!.id])}
        parts={{ anchors: [second!.id], headOf: slipSaying("the day before"), isBeside: true }}
      />,
    );

    expect(document.querySelectorAll('[data-part-head="0"]')).toHaveLength(1);
    expect(screen.queryByText("proposal")).toBeNull();
    const room = document.querySelector<HTMLElement>(
      `li[data-stop="${second!.id}"] [data-room-beside="0"] > div > div > div`,
    );
    // 300 less the fork line and the part's one row.
    expect(room?.style.height).toBe("151px");
    vi.restoreAllMocks();
  });

  it("opens a room that comes to another row from nothing, never at the height the fork before it measured", async () => {
    // Each slip beside the list 300 px tall, its fork line 49, each row's words 100.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute(BESIDE_ATTRIBUTE)) return 300;
      if (this.hasAttribute("data-part-head")) return 49;
      if (this.hasAttribute("data-row-at-rest")) return 100;
      return 0;
    });
    // A room's box as tall as the room it holds, as a page lays it out.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const room = [this, ...this.querySelectorAll<HTMLElement>("div")].find((each) =>
        each.parentElement?.parentElement?.parentElement?.hasAttribute("data-room-beside"),
      );
      return DOMRect.fromRect({ height: Number.parseFloat(room?.style.height ?? "") || 0 });
    });
    const slip = () => <div {...{ [BESIDE_ATTRIBUTE]: "" }}>the slip</div>;
    const [, first, second] = KYOTO.stops;
    const forkOver = (stop: StopDraft) => ({
      keys: [stop.id],
      anchors: [stop.id],
      headOf: slip,
      isBeside: true,
    });
    const { rerender } = render(<ReadingList {...KYOTO} parts={forkOver(first!)} />);
    // Painted, as the page is before a visitor changes another word.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // Another word: the fork's one part now ends at the next row.
    rerender(<ReadingList {...KYOTO} parts={forkOver(second!)} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // The room glides from nothing to the 151 px it holds there, a frame or two in.
    const box = document.querySelector<HTMLElement>(
      `li[data-stop="${second!.id}"] [data-room-beside="0"] > div`,
    );
    expect(Number.parseFloat(box?.style.height ?? "")).toBeLessThan(151);
    vi.restoreAllMocks();
  });

  it("counts a row folding away as nothing in the room beside its part", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute(BESIDE_ATTRIBUTE)) return 400;
      if (this.hasAttribute("data-part-head")) return 49;
      if (this.hasAttribute("data-row-at-rest")) return 100;
      return 0;
    });
    const slip = () => <div {...{ [BESIDE_ATTRIBUTE]: "" }}>the slip</div>;
    const [, first, second, third] = KYOTO.stops;
    // A part of three rows, its slip beside them.
    const parts = { anchors: [first!.id], ends: [third!.id], headOf: slip, isBeside: true };
    const { rerender } = render(<ReadingList {...KYOTO} parts={parts} />);

    // Its middle row taken away: it folds away where it stands, its rest nothing.
    rerender(<ReadingList {...KYOTO} parts={parts} hidden={new Set([second!.id])} />);

    expect(document.querySelector(`li[data-stop="${second!.id}"]`)).not.toBeNull();
    // 400 less the fork line and the two rows that stay.
    const room = document.querySelector<HTMLElement>('[data-room-beside="0"] > div > div > div');
    expect(room?.style.height).toBe("151px");
    vi.restoreAllMocks();
  });

  it("stands whole the heads of a fork already there when the list is first painted", () => {
    // The page knows where its slips stand only once it has measured its column, in the render
    // before the first paint: the heads arrive then, as a day taken whole is drawn.
    function Remounted() {
      const [parts, setParts] = useState<PlanParts | null>(null);
      useLayoutEffect(() => {
        setParts({
          anchors: [KYOTO.stops[1]!.id, null],
          headOf: (part) => <p>{`head ${part}`}</p>,
        });
      }, []);
      return <ReadingList {...KYOTO} parts={parts} />;
    }

    render(<Remounted />);

    // The head, its press guard, the fold's content box, the fold: open from the first frame.
    for (const part of [0, 1]) {
      const fold = screen.getByText(`head ${part}`).parentElement?.parentElement?.parentElement;
      expect(fold?.style.height).not.toBe("0px");
    }
  });

  it("stands the head of a part with no stop on the list under the last row", () => {
    const head = "a part past the day's last stop";
    render(<ReadingList {...KYOTO} parts={{ anchors: [null], headOf: () => <p>{head}</p> }} />);

    const rows = rowsOf();
    expect(rows).toHaveLength(KYOTO.stops.length + 1);
    expect(rows.at(-1)).toHaveTextContent(head);
  });

  it("keeps a part's head where it stands through a take, the focus on its answer", async () => {
    const [, day, proposed] = KYOTO.stops;
    const { rerender } = render(
      <ReadingList
        {...KYOTO}
        hidden={new Set([proposed!.id])}
        parts={{ anchors: [day!.id], headOf: () => slipOf("whole") }}
      />,
    );
    const head = screen.getByRole("radiogroup").closest("li");
    screen.getByRole("radio", { name: "eating late, proposed" }).focus();

    // Taken: the day's row folds away under the head, and the version taken's comes in.
    rerender(
      <ReadingList
        {...KYOTO}
        hidden={new Set([day!.id])}
        parts={{ anchors: [proposed!.id], headOf: () => slipOf("taken") }}
      />,
    );

    // One head, the same one, before the version taken's row.
    expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
    expect(screen.getByRole("radiogroup").closest("li")).toBe(head);
    const items = itemsOf();
    expect(items[items.indexOf(head!) + 1]).toHaveAttribute("data-stop", day!.id);
    expect(items[items.indexOf(head!) + 2]).toHaveAttribute("data-stop", proposed!.id);
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "eating late, your day" })).toHaveFocus(),
    );
  });

  it("folds in anew the head of a part that opens at another hour, and keeps one that opens at the same", () => {
    const head = (part: number) => <p>{`head ${part}`}</p>;
    const anchors = [KYOTO.stops[1]!.id];
    const { rerender } = render(
      <ReadingList {...KYOTO} parts={{ anchors, keys: ["13:00"], headOf: head }} />,
    );
    const first = screen.getByText("head 0").closest("li");

    // Another change that opens at the same hour: the same head, its words changed in place.
    rerender(<ReadingList {...KYOTO} parts={{ anchors, keys: ["13:00"], headOf: head }} />);
    expect(screen.getByText("head 0").closest("li")).toBe(first);

    // A part that opens at another hour: the head before it folds out, and its own folds in.
    rerender(<ReadingList {...KYOTO} parts={{ anchors, keys: ["18:00"], headOf: head }} />);
    const heads = screen.getAllByText("head 0").map((each) => each.closest("li"));
    expect(heads).toHaveLength(2);
    expect(heads.filter((each) => each?.querySelector("[inert]"))).toEqual([first]);
  });

  it("takes no press on a slip whose fork is folding away", () => {
    const { rerender } = render(
      <ReadingList
        {...KYOTO}
        parts={{ anchors: [KYOTO.stops[1]!.id], headOf: () => slipOf("whole") }}
      />,
    );

    rerender(<ReadingList {...KYOTO} parts={null} />);

    // The slip still stands as its fork folds out, its closures those of the proposal.
    const leaving = screen.getByRole("radio", { name: "eating late, proposed", hidden: true });
    expect(leaving.closest("[inert]")).not.toBeNull();
  });

  it("brings a version taken in whole, its words not written in again", () => {
    const other = new Set([KYOTO.stops[1]!.id]);
    const { rerender } = render(<ReadingList {...KYOTO} hidden={other} />);

    rerender(<ReadingList {...KYOTO} />);

    const taken = within(rowsOf()[1]!).getByRole("heading", { name: "Philosopher's Path" });
    expect(taken.querySelector(".invisible")).toBeNull();
  });

  it("folds the version a take leaves out of the list", async () => {
    const { rerender } = render(<ReadingList {...KYOTO} />);

    rerender(<ReadingList {...KYOTO} hidden={new Set([KYOTO.stops[1]!.id])} />);

    await waitFor(() => expect(rowsOf()).toHaveLength(KYOTO.stops.length - 1));
    expect(screen.queryByText(KYOTO.stops[1]!.primary.name!)).toBeNull();
  });

  it("says nothing glides on a list drawn whole", async () => {
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    render(<ReadingList {...KYOTO} onGlide={onGlide} />);

    await act(() => new Promise((settle) => setTimeout(settle, GLIDE_SETTLED_MS)));
    expect(onGlide).not.toHaveBeenCalled();
  });

  it("tells once as rows let in set off, and once as the last has come to rest", async () => {
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const { rerender } = render(<ReadingList {...KYOTO} entered={1} onGlide={onGlide} />);

    rerender(<ReadingList {...KYOTO} entered={3} onGlide={onGlide} />);

    expect(onGlide.mock.calls).toEqual([[true]]);
    await waitFor(() => expect(onGlide.mock.calls).toEqual([[true], [false]]), {
      timeout: GLIDE_SETTLED_MS,
    });
  });
});

describe("the list as the day's plan", () => {
  it("runs the rail of the day's light beside the times, with the sun's minutes where they fall", () => {
    const { container } = render(<ReadingList {...KYOTO} />);
    // A rail beside each stop, its stretch drawn in the light's own lines.
    expect(container.querySelectorAll("svg line").length).toBeGreaterThanOrEqual(
      KYOTO.stops.length,
    );
    expect(container.querySelector("line.stroke-lamp")).not.toBeNull();
    expect(container.querySelector("line[stroke-dasharray]")).not.toBeNull();
    expect(screen.getByText("Sunset")).toBeInTheDocument();
    // No rule between the rows: the rail does that work.
    expect(container.querySelector(".border-t.py-4")).toBeNull();
  });

  it("lets a stop swipe along its versions in place of the line of them, and swaps through the list", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<ReadingList {...KYOTO} onChoose={onChoose} />);
    const arrows = screen.getAllByRole("button", { name: ARROW_NAME });
    expect(arrows.length).toBeGreaterThan(0);
    await user.click(arrows[0]!);
    expect(onChoose).toHaveBeenCalledOnce();
  });
});
