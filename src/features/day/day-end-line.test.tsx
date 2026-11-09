import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import {
  ADD_TO_CALENDAR,
  COPIED_FOR_MS,
  COPY_LINK,
  DayEnd,
  LINK_COPIED,
  LINK_NOT_COPIED,
  PLAN_ANOTHER_DAY,
  type DayEndProps,
} from "./day-end-line";
import { DAY_END_EXAMPLES, KANAZAWA_CHECKS, writtenPicksOf } from "./day-end-examples";
import { REVOKE_AFTER_MS } from "./save-file";
import { MAX_ROUTE_WAYPOINTS } from "./walk-route";

const TIED = " ";

function exampleOf(label: RegExp): DayEndProps {
  const found = DAY_END_EXAMPLES.find((example) => label.test(example.label));
  if (!found) throw new Error(`No example ${label}`);
  const { day, shown, checks, address, isCut } = found;
  return { day, shown, checks, address, isCut, calendarKey: "test-day", onPlanAnother: () => {} };
}

/** A press, and whatever it waits on settled: the clipboard's answer, a state set after it. */
async function pressed(element: HTMLElement): Promise<void> {
  fireEvent.click(element);
  await act(() => Promise.resolve());
}

/** What a file made in the page holds: jsdom's Blob has no `text()`. */
function textOf(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

const KANAZAWA = exampleOf(/^a quick start/);

/** The line's ways, by what each says. */
function waysOf(): string[] {
  return [...screen.getAllByRole("button"), ...screen.queryAllByRole("link")]
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((way) => way.textContent ?? "");
}

describe("DayEnd", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("says when the day ends, its stops and how far, what the map found, and its ways", () => {
    render(<DayEnd {...KANAZAWA} />);

    expect(screen.getByText("20:15")).toBeInTheDocument();
    // Each count whole on a line, and a dot never starting one.
    expect(screen.getByText(/^Home by quarter past eight/).textContent).toMatch(
      new RegExp(`^Home by quarter past eight ·${TIED}8${TIED}stops ·${TIED}about${TIED}`),
    );
    expect(screen.getByText(/places found on OpenStreetMap$/)).toHaveTextContent(
      "3 of 8 places found on OpenStreetMap",
    );
    expect(waysOf()).toEqual([
      COPY_LINK,
      ADD_TO_CALENDAR,
      "Walk it in Google Maps",
      PLAN_ANOTHER_DAY,
    ]);
  });

  it("walks the places shown, in order, on foot", () => {
    render(<DayEnd {...KANAZAWA} />);

    const route = new URL(
      screen.getByRole("link", { name: "Walk it in Google Maps" }).getAttribute("href")!,
    );
    expect(route.origin + route.pathname).toBe("https://www.google.com/maps/dir/");
    expect(route.searchParams.get("travelmode")).toBe("walking");
    expect(route.searchParams.get("waypoints")?.split("|")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Walk it in Google Maps" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("follows the version the visitor picked", () => {
    const { rerender } = render(<DayEnd {...KANAZAWA} />);
    const written = screen.getByRole("link", { name: /^Walk/ }).getAttribute("href");

    rerender(<DayEnd {...exampleOf(/^a version swapped in/)} />);

    expect(screen.getByRole("link", { name: /^Walk/ }).getAttribute("href")).not.toBe(written);
  });

  it("says how far the map takes a day past its waypoints", () => {
    render(<DayEnd {...exampleOf(/^twelve stops/)} />);

    const route = screen.getByRole("link", {
      name: `Walk the first 11${TIED}stops in Google Maps`,
    });
    const waypoints = new URL(route.getAttribute("href")!).searchParams.get("waypoints");
    expect(waypoints?.split("|")).toHaveLength(MAX_ROUTE_WAYPOINTS);
  });

  it("offers no route and says no distance for a day of one stop", () => {
    render(<DayEnd {...exampleOf(/^one stop/)} />);

    expect(screen.getByText(/^Home by/).textContent).toBe(`Home by noon ·${TIED}1${TIED}stop`);
    expect(screen.queryByRole("link", { name: /^Walk/ })).toBeNull();
  });

  it("says a day past midnight ends in the morning", () => {
    render(<DayEnd {...exampleOf(/^past midnight/)} />);

    expect(screen.getByText("04:00")).toBeInTheDocument();
    expect(screen.getByText(/^Home by/)).toHaveTextContent(/^Home by four in the morning/);
  });

  it("says nothing found where no check ran, or while one still runs", () => {
    const { rerender } = render(<DayEnd {...exampleOf(/^written by hand/)} />);
    expect(screen.queryByText(/found on OpenStreetMap/)).toBeNull();

    rerender(<DayEnd {...exampleOf(/^a place still being looked up/)} />);
    expect(screen.queryByText(/found on OpenStreetMap/)).toBeNull();

    rerender(<DayEnd {...exampleOf(/^every place looked up, none found/)} />);
    expect(screen.getByText(/found on OpenStreetMap/)).toHaveTextContent(/^0 of 8 places/);
  });

  it("offers a cut day its link alone, and a day with no address no link", () => {
    const { rerender } = render(<DayEnd {...exampleOf(/^cut in its swaps/)} />);
    expect(waysOf()).toEqual([COPY_LINK]);

    rerender(<DayEnd {...exampleOf(/^no address of its own/)} />);
    expect(waysOf()).toEqual([ADD_TO_CALENDAR, "Walk it in Google Maps", PLAN_ANOTHER_DAY]);

    rerender(<DayEnd {...exampleOf(/^cut, with no address/)} />);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getByText(/^Home by/)).toBeInTheDocument();
  });

  it("offers another day only where the page can open one", () => {
    render(<DayEnd {...KANAZAWA} onPlanAnother={undefined} />);

    expect(screen.queryByRole("button", { name: PLAN_ANOTHER_DAY })).toBeNull();
  });

  describe("its ways", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", () => ({ matches: false }));
    });

    it("copies the day's link on this site, says so a moment, and counts it once sent", async () => {
      vi.useFakeTimers();
      const writeText = vi.fn(async () => undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      const onExport = vi.fn();
      render(<DayEnd {...KANAZAWA} onExport={onExport} />);

      // A press, not user-event, which puts a clipboard of its own on the page.
      await pressed(screen.getByRole("button", { name: COPY_LINK }));

      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/day/kanazawa`);
      expect(screen.getByRole("button", { name: LINK_COPIED })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("The day's link is copied");
      expect(onExport).toHaveBeenCalledWith("link");

      act(() => vi.advanceTimersByTime(COPIED_FOR_MS));
      expect(screen.getByRole("button", { name: COPY_LINK })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("");
    });

    it("says when the link could not be copied, and counts nothing", async () => {
      vi.stubGlobal("navigator", {
        clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
      });
      const onExport = vi.fn();
      render(<DayEnd {...KANAZAWA} onExport={onExport} />);

      await pressed(screen.getByRole("button", { name: COPY_LINK }));

      expect(screen.getByRole("button", { name: LINK_NOT_COPIED })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("could not be copied");
      expect(onExport).not.toHaveBeenCalled();
    });

    it("keeps the room of its words while it says it copied, so the line never wraps anew", async () => {
      vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(async () => undefined) } });
      render(<DayEnd {...KANAZAWA} />);

      await pressed(screen.getByRole("button", { name: COPY_LINK }));

      const button = screen.getByRole("button", { name: LINK_COPIED });
      const room = within(button).getByText(COPY_LINK);
      expect(room).toHaveClass("invisible");
      expect(room).toHaveAttribute("aria-hidden", "true");
    });

    it("saves the day as a calendar file made in the page, for the versions shown", async () => {
      vi.useFakeTimers();
      let saved: Blob | null = null;
      const revokeObjectURL = vi.fn();
      // jsdom makes no addresses for files: stand in for the browser's, then put back its own.
      const own = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
      onTestFinished(() => {
        Object.assign(URL, own);
      });
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => {
          saved = blob;
          return "blob:day";
        },
        revokeObjectURL,
      });
      const clicked: HTMLAnchorElement[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        clicked.push(this);
      });
      const onExport = vi.fn();
      render(<DayEnd {...KANAZAWA} onExport={onExport} />);

      await pressed(screen.getByRole("button", { name: ADD_TO_CALENDAR }));

      expect(clicked).toHaveLength(1);
      expect(clicked[0]!.download).toBe(`lantern-kanazawa-${KANAZAWA.day.date}.ics`);
      expect(clicked[0]!.getAttribute("href")).toBe("blob:day");
      expect(clicked[0]!.isConnected).toBe(false);
      act(() => vi.advanceTimersByTime(REVOKE_AFTER_MS));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:day");
      vi.useRealTimers();
      const text = await textOf(saved!);
      expect(saved!.type).toBe("text/calendar;charset=utf-8");
      expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(KANAZAWA.day.stops.length);
      expect(text).toContain(`URL:${window.location.origin}/day/kanazawa`);
      expect(text).toContain("UID:test-day-stop-0@lanternday.com");
      expect(onExport).toHaveBeenCalledWith("calendar");
    });

    it("counts the route opened, and opens another day from its city", async () => {
      const onExport = vi.fn();
      const onPlanAnother = vi.fn();
      render(<DayEnd {...KANAZAWA} onExport={onExport} onPlanAnother={onPlanAnother} />);
      const route = screen.getByRole("link", { name: /^Walk/ });
      route.addEventListener("click", (event) => event.preventDefault());

      await userEvent.click(route);
      await userEvent.click(screen.getByRole("button", { name: PLAN_ANOTHER_DAY }));

      expect(onExport).toHaveBeenCalledWith("route");
      expect(onPlanAnother).toHaveBeenCalledOnce();
    });
  });
});

describe("the day's end examples", () => {
  it("check Kanazawa's places as its run did, and pick what the model picked", () => {
    expect(Object.keys(KANAZAWA_CHECKS).length).toBeGreaterThan(0);
    expect(KANAZAWA.shown).toEqual(writtenPicksOf(KANAZAWA.day));
  });
});
