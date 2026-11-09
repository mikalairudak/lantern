import { render, screen, waitFor, within } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { READING_NOTE } from "@/features/itinerary/use-still";
import {
  CHECKING,
  DIRECTIONS_TO_THE_AREA,
  FOUND_BY_NAME,
  NOT_CONFIRMED,
  OPEN_IN_GOOGLE_MAPS,
  SEARCH_IN_GOOGLE_MAPS,
} from "./map-action";
import { CheckMark, ON_THE_MAP } from "./place-check";
import { PlaceCheckCell, type CheckState } from "./place-check-cell";
import { PLACE_CHECK_MATRIX } from "./place-check-matrix";
import { STOP_ROW_EXAMPLES } from "./stop-row-examples";

const CELL_WIDTH = 390;
const CALM = STOP_ROW_EXAMPLES.findIndex(
  ({ label }) => label === "a calm place, at its best light",
);
const LUNCH = STOP_ROW_EXAMPLES.findIndex(
  ({ label }) => label === "a lunch named by its food and where",
);
const LONG_QUARTER = STOP_ROW_EXAMPLES.findIndex(({ label }) => label === "a long neighbourhood");
const CALM_CITY = STOP_ROW_EXAMPLES[CALM]?.fixture.request.city;

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

async function renderCheck(
  check: CheckState,
  state: "complete" | "open" | "swapped" | "unweighed",
  example = CALM,
) {
  const view = render(
    <PlaceCheckCell example={example} state={state} density={null} check={check} />,
  );
  await waitFor(() => expect(screen.queryByText(READING_NOTE)).not.toBeInTheDocument(), {
    timeout: 5000,
  });
  return view;
}

/** The marks on the rows on screen, not on the unseen copies that measure them. */
const marks = () =>
  screen.queryAllByTitle(ON_THE_MAP).filter((mark) => mark.closest("[aria-hidden=true]") === null);

describe("a place's check in its row", () => {
  it("marks only a confirmed place, by its name or by places of its kind around it", async () => {
    const named = await renderCheck("confirmed by name", "complete");
    // It comes once the pen has written where the place is, a frame or more after the row.
    await waitFor(() => expect(marks()).toHaveLength(1), { timeout: 5000 });
    // A screen reader hears it after where the place is.
    expect(screen.getByRole("button", { name: /^Playa del Postiguet/ })).toHaveAccessibleName(
      /viewpoint, on the map/,
    );
    named.unmount();
    // Only a place to eat or drink is confirmed by the places of its kind around it.
    const lunch = await renderCheck("confirmed by area", "complete", LUNCH);
    await waitFor(() => expect(marks()).toHaveLength(1), { timeout: 5000 });
    lunch.unmount();
    for (const check of [null, "checking", "unconfirmed", "unchecked"] as const) {
      const view = await renderCheck(check, "complete");
      expect(marks()).toHaveLength(0);
      view.unmount();
    }
  });

  it("draws no mark while its row waits for its energy, folded beside its hollow bead", async () => {
    await renderCheck("confirmed by name", "unweighed");
    expect(marks()).toHaveLength(0);
  });

  // A row hung left of its bead ends its words at the bead: room that came later, as the
  // check came or the pen finished the name, moved every word of it 16 px left.
  it.each([
    ["before its place is checked", null],
    ["while its bead waits to be weighed", "confirmed by name"],
  ] as const)("holds the crosshair's room, unseen and unheard, %s", async (_, check) => {
    await renderCheck(check, "unweighed");
    const row = await screen.findByRole("button", { name: /^Playa del Postiguet/, hidden: true });
    const room = row.querySelector(".lucide-crosshair")?.parentElement;
    expect(room).toHaveClass("invisible");
    expect(row).not.toHaveAccessibleName(/on the map/);
  });

  it("says a check by area is a meal's, and a meal is never checked by its name", async () => {
    const viewpoint = await renderCheck("confirmed by area", "complete");
    expect(
      screen.getByText(
        "Only a place to eat or drink is confirmed by the places of its kind around it.",
      ),
    ).toBeInTheDocument();
    viewpoint.unmount();
    render(
      <PlaceCheckCell example={LUNCH} state="complete" density={null} check="confirmed by name" />,
    );
    expect(
      screen.getByText(
        "A place to eat or drink is confirmed by the places of its kind around it, not by its name.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the mark on one line with the last word of where the place is, as a name's sun", async () => {
    await renderCheck("confirmed by name", "complete", LONG_QUARTER);
    await waitFor(() => expect(marks()).toHaveLength(1), { timeout: 5000 });
    // "Sant Pere, Santa Caterina i la" may wrap where it likes; "Ribera" goes with its mark.
    const kept = marks()[0]!.parentElement!;
    expect(kept).toHaveClass("inline-block");
    expect(kept.firstChild).toHaveTextContent(/^Ribera$/);
    expect(kept.parentElement).toHaveTextContent(/Santa Caterina i la Ribera/);
  });

  it("keeps the mark with a kind said alone, where the name says its quarter", async () => {
    await renderCheck("confirmed by name", "complete");
    await waitFor(() => expect(marks()).toHaveLength(1), { timeout: 5000 });
    const kept = marks()[0]!.parentElement!;
    expect(kept).toHaveClass("inline-block");
    expect(kept).toHaveTextContent(/^viewpoint/);
  });

  it("leaves the mark to the sheet of a version swapped in, whose row says which way it went", async () => {
    await renderCheck("confirmed by name", "swapped");
    expect(marks()).toHaveLength(0);
  });
});

/** The open sheet on screen, not the unseen copies that measure it. */
const openSheet = () => screen.findByRole("region", { name: /^About / });

/** What its map row asks the map for. */
function mapParamsOf(link: HTMLElement): Record<string, string> {
  return Object.fromEntries(new URL(link.getAttribute("href") ?? "").searchParams);
}

/** The map row's words: the link's, then the line under it, if it has one. */
function mapRowOf(sheet: HTMLElement): string {
  return within(sheet).getByText("map", { selector: "dt" }).nextElementSibling?.textContent ?? "";
}

/** The name the sheet is about, as a search for it names it. */
const nameOf = (sheet: HTMLElement) => sheet.getAttribute("aria-label")?.replace(/^About /, "");

describe("a place's check in its sheet", () => {
  it("opens a place confirmed by its name in Google Maps, by its name and city", async () => {
    await renderCheck("confirmed by name", "open");

    const sheet = await openSheet();
    const link = within(sheet).getByRole("link", { name: OPEN_IN_GOOGLE_MAPS });
    expect(link).toHaveAttribute("target", "_blank");
    expect(mapParamsOf(link)).toEqual({ api: "1", query: `${nameOf(sheet)}, ${CALM_CITY}` });
    expect(sheet).toHaveTextContent(FOUND_BY_NAME);
  });

  it("leads to a meal's own point, an area to choose a place in, and what is around it", async () => {
    await renderCheck("confirmed by area", "open", LUNCH);

    const sheet = await openSheet();
    const link = within(sheet).getByRole("link", { name: DIRECTIONS_TO_THE_AREA });
    expect(mapParamsOf(link).destination).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    expect(sheet).toHaveTextContent("choose a place when you arrive");
    expect(sheet).toHaveTextContent("found around it on OpenStreetMap.");
  });

  it("searches for a meal's area by its name while no check vouches for its point", async () => {
    await renderCheck("unconfirmed", "open", LUNCH);

    const sheet = await openSheet();
    const link = within(sheet).getByRole("link", { name: SEARCH_IN_GOOGLE_MAPS });
    expect(mapParamsOf(link).query).toBe(`${nameOf(sheet)}, ${CALM_CITY}`);
    expect(sheet).toHaveTextContent(NOT_CONFIRMED);
  });

  it("sends a place not confirmed to a search by its name and city, and says how far it got", async () => {
    for (const [check, said] of [
      ["unconfirmed", NOT_CONFIRMED],
      ["unchecked", NOT_CONFIRMED],
      ["checking", CHECKING],
    ] as const) {
      const view = await renderCheck(check, "open");

      const sheet = await openSheet();
      const link = within(sheet).getByRole("link", { name: SEARCH_IN_GOOGLE_MAPS });
      expect(mapParamsOf(link).query).toBe(`${nameOf(sheet)}, ${CALM_CITY}`);
      expect(mapRowOf(sheet)).toBe(`${SEARCH_IN_GOOGLE_MAPS}${said}`);
      view.unmount();
    }
  });

  it("says nothing of the map on a day never checked, and still searches for the place", async () => {
    await renderCheck(null, "open");

    const sheet = await openSheet();
    expect(mapRowOf(sheet)).toBe(SEARCH_IN_GOOGLE_MAPS);
  });
});

describe("CheckMark", () => {
  const CONFIRMED = { placeId: "p", state: "confirmed", by: "area" } as const;

  it("fades in where its room is held", () => {
    const { container } = render(<CheckMark check={CONFIRMED} />);
    expect(container.firstElementChild).toHaveStyle({ opacity: "0" });
  });

  it("holds its room unseen and unheard until its words are written", () => {
    const { container } = render(<CheckMark check={CONFIRMED} isShown={false} />);
    const room = container.firstElementChild;
    expect(room).toHaveClass("invisible");
    expect(room).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByTitle(ON_THE_MAP)).toBeNull();
  });

  it("keeps its room unseen and says nothing while its place has no check", () => {
    const { container } = render(<CheckMark check={null} />);
    expect(container.firstElementChild).toHaveStyle({ opacity: "0" });
    expect(container.querySelector(".lucide-crosshair")).not.toBeNull();
    expect(screen.queryByTitle(ON_THE_MAP)).toBeNull();
    expect(container).not.toHaveTextContent(ON_THE_MAP);
  });

  it("is there in one step with reduced motion, as the sun is", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <CheckMark check={CONFIRMED} />
      </MotionConfig>,
    );
    expect(container.firstElementChild).toHaveStyle({ opacity: "1" });
  });
});

describe("PLACE_CHECK_MATRIX", () => {
  it("sets every check against a row in each state, and examples a check reads differently on", () => {
    expect(PLACE_CHECK_MATRIX.axes.map(({ name, labels }) => [name, labels.length])).toEqual([
      ["check", 6],
      ["row", 5],
      ["data", 6],
      ["density", 4],
    ]);
  });

  it("shoots each check against each moment of the row and against each example", () => {
    expect(PLACE_CHECK_MATRIX.baseline).toEqual([
      { rows: 0, columns: 1 },
      { rows: 0, columns: 2 },
    ]);
  });
});
