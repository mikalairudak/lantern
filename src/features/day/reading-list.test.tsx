import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeDraftOf, draftDayOf, openableStopsOf } from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { revealedOf } from "@/features/itinerary/revealed";
import { firstAt, partialAt } from "@/features/itinerary/stream-frames";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { enteredOf, versionsWrittenOf } from "./reading-gates";
import { ReadingList } from "./reading-list";
import { FORK_EXAMPLES, forkViewAt } from "@/features/abacus/fork-row-examples";

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

  it("draws a proposal's stops in blue, said proposed under their time, with nothing to swap", () => {
    const proposed = new Set([KYOTO.stops[1]!.id]);
    render(<ReadingList {...KYOTO} proposed={proposed} onChoose={vi.fn()} />);

    const row = rowsOf()[1]!;
    const word = within(row).getByText("proposed");
    expect(word).toHaveClass("text-ink-soft");
    // In the gutter under its time, so its line wraps as it would without it.
    expect(word.parentElement).toHaveTextContent(/^08:25proposed$/);
    expect(within(row).getByRole("heading")).toHaveTextContent("Philosopher's Path");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    // The day's own stops stay the day's: their versions offered, nothing said under them.
    expect(within(rowsOf()[0]!).getAllByRole("button").length).toBeGreaterThan(0);
    expect(within(rowsOf()[0]!).queryByText("proposed")).toBeNull();
  });

  it("stands a fork's row over the stop it forks, its answers a group of two", () => {
    const view = forkViewAt(FORK_EXAMPLES[2]!.example, { status: "proposed" });
    const onChoose = vi.fn();
    render(
      <ReadingList
        {...KYOTO}
        fork={{
          view,
          anchors: [KYOTO.stops[1]!.id],
          onChoose,
          onCompare: vi.fn(),
          onAskAgain: vi.fn(),
        }}
      />,
    );

    const group = within(rowsOf()[1]!).getByRole("radiogroup");
    expect(group).toHaveAccessibleName("early dinner or eating late");
    within(group)
      .getByRole("radio", { name: /eating late/ })
      .click();
    expect(onChoose).toHaveBeenCalledWith("to");
    expect(within(rowsOf()[0]!).queryByRole("radiogroup")).toBeNull();
  });

  it("keeps the focus on a fork row's answer as the row moves to another stop", async () => {
    const proposed = forkViewAt(FORK_EXAMPLES[2]!.example, { status: "proposed" });
    const taken = forkViewAt(FORK_EXAMPLES[2]!.example, { status: "taken" });
    const forkOf = (view: typeof proposed, anchor: string) => ({
      view,
      anchors: [anchor],
      onChoose: vi.fn(),
      onCompare: vi.fn(),
      onAskAgain: vi.fn(),
    });
    const { rerender } = render(
      <ReadingList {...KYOTO} fork={forkOf(proposed, KYOTO.stops[1]!.id)} />,
    );
    within(rowsOf()[1]!)
      .getByRole("radio", { name: /eating late/ })
      .focus();

    // Taken, the old part's stop folds away and the row stands over the next one.
    rerender(
      <ReadingList
        {...KYOTO}
        fork={forkOf(taken, KYOTO.stops[2]!.id)}
        fading={new Set([KYOTO.stops[1]!.id])}
      />,
    );

    const row = screen
      .getAllByRole("listitem")
      .find((item) => item.getAttribute("data-stop") === KYOTO.stops[2]!.id)!;
    await waitFor(() =>
      expect(within(row).getByRole("radio", { name: /eating late/ })).toHaveFocus(),
    );
  });

  it("folds a version the fork folds away out of the list", async () => {
    render(<ReadingList {...KYOTO} fading={new Set([KYOTO.stops[1]!.id])} />);

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
