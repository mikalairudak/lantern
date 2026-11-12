import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AbacusConcept } from "./abacus-concept";
import { ABACUS_DAY, ABACUS_WEATHER } from "@/lib/fixtures/hand-made/abacus-candidates";
import { CURVE_NAME } from "@/features/abacus/chart-axes";
import { INVITATION_DELAY_MS } from "@/features/abacus/use-invitation";
import type { Keyframe } from "./pacing";

/**
 * Where the stream stands, in seconds (null writes the whole day at once), and whether it
 * has been silent long enough to wait.
 */
const replay = vi.hoisted(() => ({ seconds: null as number | null, isWaiting: false }));

vi.mock("./use-playback", async () => {
  const { budgetAt } = await import("./pacing");
  return {
    usePlayback: (
      keyframes: readonly Keyframe[],
      { startsComplete = false }: { startsComplete?: boolean } = {},
    ) => ({
      written:
        startsComplete || replay.seconds === null
          ? (keyframes.at(-1)?.budget ?? 0)
          : budgetAt(keyframes, replay.seconds),
      isWaiting: replay.isWaiting,
    }),
  };
});

afterEach(() => {
  replay.seconds = null;
  replay.isWaiting = false;
});

/**
 * Skips the header's unseen copy, which holds the header at its tallest so the chart never
 * moves when the headline gains a clause.
 */
const SEEN = { ignore: "[aria-hidden] *" };

/** The clause writes in and out on a spring. */
const CLAUSE_TIMEOUT = { timeout: 3000 };

const CHART_WIDTH = 448;
const CHART_HEIGHT = 640;

/** jsdom has no layout, so the chart's container reports a laptop-sized box. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CHART_WIDTH, height: CHART_HEIGHT } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  // Motion keeps the page's scroll while it measures a height unfolding to auto; jsdom
  // has no scrolling and would say so on every unfold.
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  // An open stop's sheet brings itself into view; jsdom has nothing to scroll.
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Renders the day complete, once it has taken its places and can be used. */
async function renderDay() {
  const view = render(
    <AbacusConcept itinerary={ABACUS_DAY} weather={ABACUS_WEATHER} isInitiallyComplete />,
  );
  const list = screen.getByRole("list", { name: "The day" });
  await screen.findAllByRole("slider", { name: /^Energy at/ });
  return { ...view, list };
}

const slider = (time: string) => screen.getByRole("slider", { name: `Energy at ${time}` });

/** A version's bead on the chart, by its place id. */
function beadOf(container: HTMLElement, placeId: string): Element {
  const bead = container.querySelector(`[data-candidate="${placeId}"]`);
  if (!bead) throw new Error(`No bead for ${placeId}`);
  return bead;
}

/** The list's row for a stop, by its button, whose name starts with the place's. */
function rowOf(list: HTMLElement, name: string): HTMLElement {
  const button = within(list).getByRole("button", {
    name: (accessible) => accessible.startsWith(name),
  });
  const row = button.closest("li");
  if (!row) throw new Error(`No row shows ${name}`);
  return row;
}

/** Renders the day part-way through its replay, while the options are still arriving. */
function renderWriting() {
  replay.seconds = 4.6;
  const view = render(<AbacusConcept itinerary={ABACUS_DAY} weather={ABACUS_WEATHER} />);
  const list = screen.getByRole("list", { name: "The day" });
  const chart = screen.getByRole("group", { name: /The day's energy/ });
  return { ...view, list, chart };
}

describe("AbacusConcept", () => {
  it("shows the model's picks in the list and one energy control per stop", async () => {
    const { list } = await renderDay();

    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(within(list).getByText("Paella on the marina")).toBeInTheDocument();
    expect(screen.getAllByRole("slider", { name: /^Energy at/ })).toHaveLength(8);
    expect(slider("14:00")).toHaveAttribute("aria-valuetext", "calm: Paella on the marina");
  });

  it("marks only the model's assumptions in the request, with a key to the mark", async () => {
    await renderDay();

    const request = screen.getByRole("heading", { level: 1 });
    // Each word as it is heard: the comma after it sits in its box, unheard.
    const heard = (word: Element) =>
      [...word.childNodes]
        .filter((node) => !(node instanceof Element && node.hasAttribute("aria-hidden")))
        .map((node) => node.textContent)
        .join("");
    const marked = [...request.querySelectorAll(".decoration-dotted")].map(heard);

    expect(marked).toEqual(["on foot", "early start", "eating late", "home by eleven"]);
    expect(request.querySelectorAll(".underline")).toHaveLength(marked.length);
    expect(screen.getByText("assumed", SEEN)).toHaveClass("decoration-dotted");
  });

  it("moves a stop to its quieter version with the arrow keys", async () => {
    const user = userEvent.setup();
    const { list } = await renderDay();

    slider("14:00").focus();
    await user.keyboard("{ArrowLeft}");

    expect(slider("14:00")).toHaveAttribute(
      "aria-valuetext",
      "reflective: Arroz a banda by the port",
    );
    expect(within(list).getByText("Arroz a banda by the port")).toBeInTheDocument();
    // Which way it went in energy's colour, what it replaced in the swap's.
    const way = within(list).getByText("quieter");
    expect(way).toHaveClass("text-energy");
    expect(way.parentElement).toHaveTextContent(/^quieter · instead of Paella on the marina$/);
    expect(way.parentElement).toHaveClass("text-swap");
  });

  it("changes only the keyed stop: lunch livelier leaves the museum after it as it was", async () => {
    const user = userEvent.setup();
    const sliders = () => screen.getAllByRole("slider").map((each) => each.ariaValueText);
    await renderDay();
    const before = sliders();

    slider("14:00").focus();
    await user.keyboard("{ArrowRight}");

    expect(slider("14:00")).toHaveAttribute("aria-valuetext", "lively: Tapas on San Fernando");
    expect(sliders().filter((text, index) => text !== before[index])).toEqual([
      "lively: Tapas on San Fernando",
    ]);
  });

  it("keeps a stop when it has nothing quieter", async () => {
    const user = userEvent.setup();
    await renderDay();

    slider("07:45").focus();
    await user.keyboard("{ArrowLeft}");

    expect(slider("07:45")).toHaveAttribute("aria-valuetext", "reflective: Playa del Postiguet");
  });

  it("jumps to a stop's liveliest and quietest versions with End and Home", async () => {
    const user = userEvent.setup();
    await renderDay();

    slider("14:00").focus();
    await user.keyboard("{End}");
    expect(slider("14:00")).toHaveAttribute("aria-valuetext", "lively: Tapas on San Fernando");

    await user.keyboard("{Home}");
    expect(slider("14:00")).toHaveAttribute(
      "aria-valuetext",
      "reflective: Arroz a banda by the port",
    );
  });

  it("picks a candidate when its bead is tapped, and opens nothing", async () => {
    const user = userEvent.setup();
    const { container, list } = await renderDay();

    const bead = container.querySelector('[data-candidate="stop-6:a2"]');
    if (!bead) throw new Error("The promenade's livelier bead is missing");
    await user.click(bead);

    expect(slider("17:20")).toHaveAttribute("aria-valuetext", "lively: Ice cream on the Explanada");
    expect(
      within(list).getByRole("button", { name: /Ice cream on the Explanada/, expanded: false }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: /^About/ })).not.toBeInTheDocument();
  });

  it("lets the day be read but not dragged, keyed or opened while it is written", async () => {
    const user = userEvent.setup();
    const { container, list, chart } = renderWriting();
    const lunch = within(list).getByRole("button", { name: /^Paella on the marina/ });
    const bead = container.querySelector('[data-candidate="stop-0:a1"]');
    if (!bead) throw new Error("The beach's livelier bead has not arrived");

    expect(chart).toHaveAttribute("aria-busy", "true");
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    // The scale names the curve only once it can be dragged.
    expect(screen.queryByText(CURVE_NAME)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(lunch).toBeDisabled();

    await user.click(lunch);
    await user.click(bead);
    await user.pointer([
      { keys: "[MouseLeft>]", target: chart, coords: { clientX: 240, clientY: 300 } },
      { target: chart, coords: { clientX: 140, clientY: 300 } },
      { keys: "[/MouseLeft]" },
    ]);
    await user.tab();

    expect(lunch).toHaveAttribute("aria-expanded", "false");
    expect(within(list).getByRole("button", { name: /^Playa del Postiguet/ })).toBeInTheDocument();
    expect(within(list).queryByText("Churros in the old town")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });

  it("writes the day again from the start on Replay, with Reset off until it is done", async () => {
    const user = userEvent.setup();
    await renderDay();

    replay.seconds = 2;
    await user.click(screen.getByRole("button", { name: "Replay" }));
    const list = screen.getByRole("list", { name: "The day" });

    expect(within(list).getAllByRole("listitem").length).toBeLessThan(8);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("discards the visitor's picks on Replay", async () => {
    const user = userEvent.setup();
    await renderDay();

    slider("14:00").focus();
    await user.keyboard("{ArrowLeft}");
    expect(slider("14:00")).toHaveAttribute(
      "aria-valuetext",
      "reflective: Arroz a banda by the port",
    );

    await user.click(screen.getByRole("button", { name: "Replay" }));

    expect(await screen.findByRole("slider", { name: "Energy at 14:00" })).toHaveAttribute(
      "aria-valuetext",
      "calm: Paella on the marina",
    );
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
  });

  it("shows the day's voice in a silence of a realistic stream, and nothing in a replay", async () => {
    const user = userEvent.setup();
    replay.seconds = 2.2;
    replay.isWaiting = true;
    const { container } = render(<AbacusConcept itinerary={ABACUS_DAY} weather={ABACUS_WEATHER} />);

    expect(container.querySelector("[data-waiting]")).toBeNull();
    expect(screen.queryByRole("group", { name: "Waiting" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "realistic" }));

    expect(screen.getByRole("status")).toHaveTextContent("Writing the day");
    expect(container.querySelectorAll('[data-waiting="voice"]')).toHaveLength(2);
  });

  it("marks the stops at their best light apart, sunrise from sunset", async () => {
    const { list } = await renderDay();

    expect(
      within(rowOf(list, "Playa del Postiguet")).getByRole("img", { name: "Best light: sunrise" }),
    ).toBeInTheDocument();
    expect(
      within(rowOf(list, "Explanada de España")).getByRole("img", { name: "Best light: sunset" }),
    ).toBeInTheDocument();
    expect(within(list).getAllByRole("img", { name: /Best light/ })).toHaveLength(2);
  });

  it("names the day's sunrise and sunset in the facts line", async () => {
    await renderDay();

    expect(screen.getByText("sunrise 07:43", SEEN)).toBeInTheDocument();
    expect(screen.getByText("sunset 17:51", SEEN)).toBeInTheDocument();
  });

  it("swaps on the chart and resets to the model's picks", async () => {
    const user = userEvent.setup();
    const { container } = await renderDay();

    await user.click(beadOf(container, "stop-2:a1"));

    expect(slider("09:45")).toHaveAttribute("aria-valuetext", "calm: MUBAG");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(slider("09:45")).toHaveAttribute(
      "aria-valuetext",
      "balanced: Castillo de Santa Bárbara",
    );
  });

  it("says how the day changed after the visitor's energy word, until Reset", async () => {
    const user = userEvent.setup();
    const { container } = await renderDay();
    const headline = screen.getByRole("heading", { level: 1 });

    await user.click(beadOf(container, "stop-4:a2"));

    await waitFor(
      () => expect(headline).toHaveTextContent("A calm Saturday, livelier at lunch, in Alicante,"),
      CLAUSE_TIMEOUT,
    );
    expect(within(headline).getByText("livelier at lunch")).toHaveClass("text-energy");
    expect(within(headline).getByText("calm")).toHaveClass("text-energy");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(
      () => expect(headline).toHaveTextContent(/^A calm Saturday in Alicante,/),
      CLAUSE_TIMEOUT,
    );
  });
});

describe("the request sentence", () => {
  /** Opens a word of the headline and chooses one of its options. */
  async function answer(user: ReturnType<typeof userEvent.setup>, word: string, option: RegExp) {
    await user.click(screen.getByRole("button", { name: word }));
    await user.click(screen.getByRole("option", { name: option }));
  }

  it("answers the question: dinner is rewritten for a family, and the rest stays", async () => {
    const user = userEvent.setup();
    const { list } = await renderDay();
    const headline = screen.getByRole("heading", { level: 1 });
    const before = within(list)
      .getAllByRole("listitem")
      .slice(0, 7)
      .map((row) => row.textContent);

    expect(screen.getByText("click a word to change it", SEEN)).toBeInTheDocument();

    await answer(user, "with anyone", /with family/);

    await waitFor(() => expect(within(list).getByText("Rice on Calle Mayor")).toBeInTheDocument());
    expect(within(headline).getByText("eating late").closest("del")).toBeInTheDocument();
    await waitFor(
      () =>
        expect(within(headline).getByRole("button", { name: "early dinner" })).toHaveClass(
          "decoration-dotted",
        ),
      CLAUSE_TIMEOUT,
    );
    expect(screen.getByText("an earlier dinner suits a family", SEEN)).toBeInTheDocument();
    expect(screen.queryByText("click a word to change it", SEEN)).not.toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole("listitem")
        .slice(0, 7)
        .map((row) => row.textContent),
    ).toEqual(before);
    expect(within(list).queryByText("Tapas on Calle Villegas")).not.toBeInTheDocument();
  });

  it("confirms an assumption: it loses its dotted mark and nothing is re-composed", async () => {
    const user = userEvent.setup();
    const { list } = await renderDay();

    await answer(user, "on foot", /on foot/);

    const word = screen.getByRole("button", { name: "on foot" });
    expect(word).not.toHaveClass("decoration-dotted");
    expect(word).toHaveClass("text-ink");
    expect(within(list).getByRole("button", { name: /^Explanada de España/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("re-plans every stop for a livelier energy word, with no clause in the headline", async () => {
    const user = userEvent.setup();
    await renderDay();
    const headline = screen.getByRole("heading", { level: 1 });

    await answer(user, "calm", /^lively/);

    expect(slider("14:00")).toHaveAttribute("aria-valuetext", "lively: Tapas on San Fernando");
    expect(slider("21:00")).toHaveAttribute("aria-valuetext", "social: Tapas on Calle Villegas");
    await waitFor(
      () => expect(headline).toHaveTextContent(/^A lively Saturday in Alicante,/),
      CLAUSE_TIMEOUT,
    );
    expect(screen.queryByText(/instead of/)).not.toBeInTheDocument();
  });

  it("keeps the day when a change fails, puts the question back and retries it", async () => {
    const user = userEvent.setup();
    const { list } = await renderDay();

    await user.click(screen.getByRole("button", { name: "fail" }));
    await answer(user, "with anyone", /with family/);

    const retry = await screen.findByRole("button", { name: "family" }, { timeout: 3000 });
    expect(screen.getByText(/Couldn.t re-plan\. Try/, SEEN)).toBeInTheDocument();
    expect(within(list).getByText("Tapas on Calle Villegas")).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByRole("button", { name: "with anyone" })).toBeInTheDocument(),
      CLAUSE_TIMEOUT,
    );
    expect(screen.getByRole("button", { name: "ok" })).toHaveAttribute("aria-pressed", "true");

    await user.click(retry);

    await waitFor(() => expect(within(list).getByText("Rice on Calle Mayor")).toBeInTheDocument());
  });

  it("lights the stops a word shaped while it is hovered", async () => {
    const user = userEvent.setup();
    const { list } = await renderDay();

    await user.hover(screen.getByRole("button", { name: "eating late" }));

    expect(rowOf(list, "Tapas on Calle Villegas")).toHaveAttribute("data-lit", "true");
    expect(rowOf(list, "Paella on the marina")).not.toHaveAttribute("data-lit");
  });
});

describe("an open stop", () => {
  /** Opens lunch from its row and returns its sheet. */
  async function openLunch(user: ReturnType<typeof userEvent.setup>) {
    const view = await renderDay();
    const name = () => within(view.list).getByRole("button", { name: /^Paella on the marina/ });
    await user.click(name());
    const sheet = () => screen.getByRole("region", { name: "About Paella on the marina" });
    return { ...view, name, sheet };
  }

  it("says what the place is, and offers no versions to choose from", async () => {
    const { name, sheet, list } = await openLunch(userEvent.setup());
    const texture = "Spoons on pans, unhurried talk, halyards ringing on the masts.";

    expect(name()).toHaveAttribute("aria-expanded", "true");
    expect(name()).toHaveAttribute("aria-controls", sheet().id);
    // A place to eat around says its hours and its quarter: its name says what is eaten.
    expect(sheet()).toHaveTextContent("14:00–15:45 · 1 h 45 min · Puerto");
    // How full and how loud, under the margin's "feel".
    expect(sheet()).toHaveTextContent("feelsteady · murmur");
    // A calm row already says how it sounds, on the sheet's top; the sheet says it once.
    expect(within(list).getAllByText(texture)).toHaveLength(1);
    expect(sheet()).not.toHaveTextContent(texture);
    expect(sheet()).toHaveTextContent("lightbest at midday · roofed, open sides");
    expect(within(sheet()).queryByText("Arroz a banda by the port")).not.toBeInTheDocument();
    expect(sheet()).toHaveFocus();
  });

  it("follows a version swapped in on the chart, saying why: what it trades", async () => {
    const user = userEvent.setup();
    await openLunch(user);

    slider("14:00").focus();
    await user.keyboard("{End}");

    const sheet = screen.getByRole("region", { name: "About Tapas on San Fernando" });
    expect(sheet).toHaveTextContent(
      "Rice for lunch still, at a crowded counter instead of a table on the water.",
    );
  });

  it("closes with Escape and gives the focus back to its name", async () => {
    const user = userEvent.setup();
    const { name } = await openLunch(user);

    await user.keyboard("{Escape}");

    expect(name()).toHaveAttribute("aria-expanded", "false");
    expect(name()).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
  });

  it("closes from its close button, from its name, and from a press outside the day", async () => {
    const user = userEvent.setup();
    const { name, sheet } = await openLunch(user);

    await user.click(within(sheet()).getByRole("button", { name: "Close Paella on the marina" }));
    expect(name()).toHaveAttribute("aria-expanded", "false");
    expect(name()).toHaveFocus();

    await user.click(name());
    await user.click(name());
    expect(name()).toHaveAttribute("aria-expanded", "false");

    await user.click(name());
    await user.click(screen.getByRole("heading", { level: 1 }));
    expect(name()).toHaveAttribute("aria-expanded", "false");
  });

  it("marks its light when its visit holds its best window", async () => {
    const user = userEvent.setup();
    const { list } = await renderDay();

    await user.click(within(list).getByRole("button", { name: /^Explanada de España/ }));

    const sheet = screen.getByRole("region", { name: "About Explanada de España" });
    expect(within(sheet).getByRole("img", { name: "Best light: sunset" })).toBeInTheDocument();
  });

  it("passes the curve under each stop's line of words, which it steps back for", async () => {
    // jsdom lays no text out, so each piece of text reports one line of its own.
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () {
      return [{ left: 10, top: 4, width: 80, height: 20 }] as unknown as DOMRectList;
    };
    try {
      const { container, list } = await renderDay();
      const curve = container.querySelector("path.stroke-curve[mask]");
      const maskId = /url\(#(.+)\)/.exec(curve?.getAttribute("mask") ?? "")?.[1] ?? "";
      const lines = container.querySelectorAll(`mask[id="${maskId}"] g rect`);

      // One line a stop: every piece of a row's words reports the same line here.
      expect(lines).toHaveLength(within(list).getAllByRole("listitem").length);
    } finally {
      Range.prototype.getClientRects = original;
    }
  });

  it("names the curve on the energy scale, and keeps its ring off while its stop is open", async () => {
    const user = userEvent.setup();
    const { container, list } = await renderDay();
    const ring = () => container.querySelector("[data-invitation] circle");

    expect(screen.getAllByText(CURVE_NAME).length).toBeGreaterThan(0);
    // The ring lands a moment after the day can be dragged, where it can be seen: here all
    // of the day, so at lunch.
    await waitFor(() => expect(ring()).toBeInTheDocument(), {
      timeout: INVITATION_DELAY_MS + 1000,
    });

    await user.click(within(list).getByRole("button", { name: /^Paella on the marina/ }));
    expect(ring()).not.toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: /^Paella on the marina/ }));
    expect(ring()).toBeInTheDocument();
    expect(screen.getAllByText(CURVE_NAME).length).toBeGreaterThan(0);
  });
});

describe("the light on the time axis", () => {
  /** The axis's runs of light, top to bottom, by the light each is drawn in. */
  const runsOf = () =>
    [...document.querySelectorAll("line[data-light]")]
      .map((run) => ({ light: run.getAttribute("data-light"), y: Number(run.getAttribute("y1")) }))
      .sort((a, b) => a.y - b.y)
      .map((run) => run.light);
  /** A stop's time in the list, by the time it says. */
  const timeOf = (list: HTMLElement, time: string) => within(list).getByText(time);

  it("runs Alicante's axis dotted to sunrise, gold at dawn and dusk, dotted after, and asks for no hand", async () => {
    await renderDay();

    expect(runsOf()).toEqual(["dark", "golden", "golden", "dark"]);
    expect(screen.queryByRole("slider", { name: "The sun" })).not.toBeInTheDocument();
  });

  it("says a stop's time in amber where it starts in golden hour, and the others as before", async () => {
    const { list } = await renderDay();

    // The Explanada at 17:20 starts in the evening's gold; lunch at 14:00 in plain day.
    expect(timeOf(list, "17:20")).toHaveClass("text-amber");
    expect(timeOf(list, "14:00")).toHaveClass("text-muted");
  });

  it("leaves every hollow bead on the page's own ground", async () => {
    const user = userEvent.setup();
    await renderDay();
    // A second after the day can be dragged, the chart invites the first drag, and its
    // example names the version a pull would swap in, in the swap's colour, until the first
    // gesture. On a loaded machine that second could pass before the check, and fail it. A
    // pull there and back retires the invitation as a visitor's first pull does, and leaves
    // the day as it was, so the check reads every hollow bead at rest whenever it runs.
    const [first] = screen.getAllByRole("slider", { name: /^Energy at/ });
    first?.focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");

    const beads = [...document.querySelectorAll("[data-candidate] circle")];
    expect(beads.length).toBeGreaterThan(0);
    expect(beads.every((bead) => bead.classList.contains("fill-ground"))).toBe(true);
  });
});
