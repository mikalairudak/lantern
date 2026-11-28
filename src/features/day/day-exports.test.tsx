import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { DAY_END_EXAMPLES, type DayEndExample } from "./day-end-examples";
import { COPIED_FOR_MS, type DayExport } from "./day-export-words";
import { useDayExports } from "./day-exports";
import { DayMenu } from "./day-menu";
import { SAID_AGAIN_PAUSE_MS } from "./said-again";
import { REVOKE_AFTER_MS } from "./save-file";
import { ADD_TO_YOUR_CALENDAR, COPY_THE_LINK, takeAlongOf } from "./take-along";
import { MAX_ROUTE_WAYPOINTS } from "./walk-route";

const TIED = "\u00A0";

function exampleOf(label: RegExp): DayEndExample {
  const found = DAY_END_EXAMPLES.find((example) => label.test(example.label));
  if (!found) throw new Error(`No example ${label}`);
  return found;
}

const KANAZAWA = exampleOf(/^a written day/);

/** The day menu as a finished day holds it: its ways, worked out from the day as shown. */
function TakeAlong({
  example,
  onExport,
}: {
  example: DayEndExample;
  onExport?: (way: DayExport) => void;
}) {
  const { day, shown, checks, address, isCut } = example;
  const exports = useDayExports({ day, shown, checks, address, calendarKey: "test-day", onExport });
  const items = takeAlongOf({
    day,
    shown,
    checks,
    isCut,
    exports,
    onRoute: () => onExport?.("route"),
    hasLink: address !== null,
  });
  return <DayMenu items={items} isOpenAtFirst />;
}

/** A press, and whatever it waits on settled: the clipboard's answer, a state set after it. */
async function pressed(element: HTMLElement): Promise<void> {
  fireEvent.click(element);
  await act(() => Promise.resolve());
}

/** The status's pause after a send, by the end of which it says how the send went. */
async function pauseAfterSend(): Promise<void> {
  await act(() => new Promise((resolve) => setTimeout(resolve, SAID_AGAIN_PAUSE_MS)));
}

/** What a file made in the page holds: jsdom's Blob has no `text()`. */
function textOf(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

const routeItem = () => screen.getByRole("menuitem", { name: /^Walk/ });
const linkItem = () => screen.getByRole("menuitem", { name: /^(Copy the link|Link)/ });

describe("the ways to take a finished day along, from its menu", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("walks the places shown, in order, on foot, in a tab of its own", () => {
    render(<TakeAlong example={KANAZAWA} />);

    const route = new URL(routeItem().getAttribute("href")!);
    expect(route.origin + route.pathname).toBe("https://www.google.com/maps/dir/");
    expect(route.searchParams.get("travelmode")).toBe("walking");
    expect(route.searchParams.get("waypoints")?.split("|")).toHaveLength(6);
    expect(routeItem()).toHaveAttribute("target", "_blank");
  });

  it("follows the version the visitor picked", () => {
    const { rerender } = render(<TakeAlong example={KANAZAWA} />);
    const written = routeItem().getAttribute("href");

    rerender(<TakeAlong example={exampleOf(/^a version swapped in/)} />);

    expect(routeItem().getAttribute("href")).not.toBe(written);
  });

  it("says how far the map takes a day past its waypoints", () => {
    render(<TakeAlong example={exampleOf(/^twelve stops/)} />);

    const route = screen.getByRole("menuitem", {
      name: new RegExp(`^Walk the first 11${TIED}stops in Google Maps`),
    });
    const waypoints = new URL(route.getAttribute("href")!).searchParams.get("waypoints");
    expect(waypoints?.split("|")).toHaveLength(MAX_ROUTE_WAYPOINTS);
  });

  it("copies the day's link on this site, says so a moment, and counts it once sent", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const onExport = vi.fn();
    render(<TakeAlong example={KANAZAWA} onExport={onExport} />);

    // A press, not user-event, which puts a clipboard of its own on the page.
    await pressed(linkItem());

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/day/kanazawa`);
    expect(linkItem()).toHaveTextContent(/^Link copied/);
    act(() => vi.advanceTimersByTime(SAID_AGAIN_PAUSE_MS));
    expect(screen.getByRole("status")).toHaveTextContent("The day's link is copied");
    expect(onExport).toHaveBeenCalledWith("link");

    act(() => vi.advanceTimersByTime(COPIED_FOR_MS - SAID_AGAIN_PAUSE_MS));
    expect(linkItem()).toHaveTextContent(new RegExp(`^${COPY_THE_LINK}`));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("says when the link could not be copied, and counts nothing", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    const onExport = vi.fn();
    render(<TakeAlong example={KANAZAWA} onExport={onExport} />);

    await pressed(linkItem());

    expect(linkItem()).toHaveTextContent(/^Link not copied/);
    await pauseAfterSend();
    expect(screen.getByRole("status")).toHaveTextContent("could not be copied");
    expect(onExport).not.toHaveBeenCalled();
  });

  it("says a second failed copy again, its words unchanged on screen", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    render(<TakeAlong example={KANAZAWA} />);
    const status = screen.getByRole("status");
    const heard: string[] = [];
    const observer = new MutationObserver(() => {
      const text = status.textContent ?? "";
      if (text !== heard.at(-1)) heard.push(text);
    });
    observer.observe(status, { subtree: true, childList: true, characterData: true });

    await pressed(linkItem());
    await pauseAfterSend();
    await pressed(linkItem());
    expect(linkItem()).toHaveTextContent(/^Link not copied/);
    await pauseAfterSend();
    observer.disconnect();

    // The status empties at the second press and says it again: a change a screen reader hears.
    expect(heard).toEqual([
      "The day's link could not be copied",
      "",
      "The day's link could not be copied",
    ]);
    expect(linkItem()).toHaveTextContent(/^Link not copied/);
  });

  it("keeps a second send's words their whole time from that send", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    render(<TakeAlong example={KANAZAWA} />);

    await pressed(linkItem());
    act(() => vi.advanceTimersByTime(COPIED_FOR_MS - SAID_AGAIN_PAUSE_MS));
    await pressed(linkItem());
    // Past the first send's time, inside the second's.
    act(() => vi.advanceTimersByTime(COPIED_FOR_MS - 1));
    expect(linkItem()).toHaveTextContent(/^Link not copied/);
    act(() => vi.advanceTimersByTime(1));
    expect(linkItem()).toHaveTextContent(new RegExp(`^${COPY_THE_LINK}`));
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
    render(<TakeAlong example={KANAZAWA} onExport={onExport} />);

    await pressed(screen.getByRole("menuitem", { name: new RegExp(`^${ADD_TO_YOUR_CALENDAR}`) }));

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

  it("counts the route opened", async () => {
    const onExport = vi.fn();
    render(<TakeAlong example={KANAZAWA} onExport={onExport} />);
    const route = routeItem();
    route.addEventListener("click", (event) => event.preventDefault());

    await userEvent.click(route);

    expect(onExport).toHaveBeenCalledWith("route");
  });
});
