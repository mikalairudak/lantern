import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CURATED_REQUESTS, KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { COPY_LINK, LINK_COPIED, LINK_NOT_COPIED } from "./day-export-words";
import type { DayExports } from "./day-exports";
import { DAY_END_EXAMPLES } from "./day-end-examples";
import { DayEnd } from "./day-end-line";
import { DayMenu, TAKE_THIS_DAY, type DayMenuItem } from "./day-menu";
import { DayStageHeader } from "./day-stage-header";
import { Masthead } from "./masthead";
import { sentenceFactsOf } from "./sentence";
import { ADD_TO_YOUR_CALENDAR, COPY_THE_LINK, takeAlongOf, WAITING_NOTE } from "./take-along";

const ignore = () => undefined;

/** jsdom lays nothing out; the header's gliding box only needs to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

const ITEMS: DayMenuItem[] = [
  { key: "link", label: "Copy the link", note: "Opens this day", keepsOpen: true },
  { key: "calendar", label: "Add to your calendar", note: "8 events" },
  { key: "route", label: "Walk it in Google Maps", note: "The 8 stops", href: "https://maps" },
  { key: "another", label: "Plan another day", note: "Elsewhere", isApart: true },
];

function menuItems(): string[] {
  return screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
}

describe("the day menu", () => {
  it("opens from a press or the keyboard, moves with the arrows, and closes with Escape back to its button", async () => {
    const user = userEvent.setup();
    render(<DayMenu items={ITEMS} />);
    const button = screen.getByRole("button", { name: TAKE_THIS_DAY });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).toBeNull();

    // A press opens it with the focus left on the button; the arrows take it in.
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(menuItems()).toHaveLength(4);
    expect(button).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
    await user.keyboard("{Escape}");

    // From the keyboard it opens on its first item.
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("menuitem")[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getAllByRole("menuitem")[3]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getAllByRole("menuitem")[3]).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("closes from its button with Escape, and on Tab past it, after a press opened it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DayMenu items={ITEMS} />
        <button type="button">Next</button>
      </>,
    );
    const button = screen.getByRole("button", { name: TAKE_THIS_DAY });
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.tab();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("opens on its last item from the up arrow, and closes on Tab and on a press outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DayMenu items={ITEMS} />
        <p>Outside</p>
      </>,
    );
    const button = screen.getByRole("button", { name: TAKE_THIS_DAY });
    button.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("menuitem")[3]).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(button);
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("runs an item and closes, stays open for one that says how it went, and opens a route in a new tab", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const onCalendar = vi.fn();
    render(
      <DayMenu
        items={[
          { ...ITEMS[0]!, onSelect: onCopy },
          { ...ITEMS[1]!, onSelect: onCalendar },
          ITEMS[2]!,
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Copy the link/ }));
    expect(onCopy).toHaveBeenCalledOnce();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    const route = screen.getByRole("menuitem", { name: /Walk it/ });
    expect(route).toHaveAttribute("href", "https://maps");
    expect(route).toHaveAttribute("target", "_blank");

    await user.click(screen.getByRole("menuitem", { name: /Add to your calendar/ }));
    expect(onCalendar).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    // The focus goes back to the button, not to the page's body.
    expect(screen.getByRole("button", { name: TAKE_THIS_DAY })).toHaveFocus();
  });

  it("leaves the focus where an item sends it, and runs a locked item to say why", async () => {
    const user = userEvent.setup();
    const onAnother = vi.fn(() => screen.getByRole("textbox").focus());
    const onLocked = vi.fn();
    const { rerender } = render(
      <>
        <DayMenu items={[{ ...ITEMS[3]!, onSelect: onAnother, movesFocus: true }]} />
        <input aria-label="City" />
      </>,
    );
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    expect(screen.getByRole("textbox")).toHaveFocus();

    rerender(
      <>
        <DayMenu items={[{ ...ITEMS[3]!, onSelect: onLocked, isLocked: true }]} />
        <input aria-label="City" />
      </>,
    );
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    const locked = screen.getByRole("menuitem", { name: /Plan another day/ });
    expect(locked).toHaveAttribute("aria-disabled", "true");
    await user.click(locked);
    expect(onLocked).toHaveBeenCalledOnce();
  });

  it("lists a waiting item without running it, and says an item's status to a screen reader", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DayMenu
        items={[
          { ...ITEMS[1]!, onSelect, isDisabled: true },
          { ...ITEMS[0]!, status: "The day's link is copied" },
        ]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("The day's link is copied");
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    const waiting = screen.getByRole("menuitem", { name: /Add to your calendar/ });
    expect(waiting).toHaveAttribute("aria-disabled", "true");
    await user.click(waiting);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});

const KANAZAWA = DAY_END_EXAMPLES[0]!;

function exportsOf(copied: DayExports["copied"] = COPY_LINK): DayExports {
  return { copied, sendLink: async () => undefined, saveCalendar: ignore };
}

describe("the ways to take a day along", () => {
  const options = {
    shown: KANAZAWA.shown,
    checks: KANAZAWA.checks,
    isCut: false,
    onRoute: ignore,
    hasLink: true,
  };

  it("says what each way does for the day as shown", () => {
    const items = takeAlongOf({ ...options, day: KANAZAWA.day, exports: exportsOf() });
    const stops = KANAZAWA.day.stops.length;
    expect(items.map((item) => item.label)).toEqual([
      COPY_THE_LINK,
      ADD_TO_YOUR_CALENDAR,
      "Walk it in Google Maps",
    ]);
    expect(items[1]?.note).toBe(
      `${stops} events, one for each stop, at its hour in ${KANAZAWA.day.city}`,
    );
    expect(items[2]?.note).toBe(`The ${stops} stops in order, as a walk`);
    expect(items[2]?.href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(items.some((item) => item.isDisabled)).toBe(false);
  });

  it("lists every way while the day is written, each waiting", () => {
    const items = takeAlongOf({ ...options, day: null, exports: exportsOf() });
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.isDisabled && item.note === WAITING_NOTE)).toBe(true);
    expect(items[2]?.href).toBeUndefined();
  });

  it("offers a cut day its link alone, a day with no address no link, and one stop no route", () => {
    expect(
      takeAlongOf({ ...options, day: KANAZAWA.day, isCut: true, exports: exportsOf() }).map(
        (item) => item.key,
      ),
    ).toEqual(["link"]);
    expect(
      takeAlongOf({
        ...options,
        day: KANAZAWA.day,
        hasLink: false,
        exports: { ...exportsOf(), sendLink: null },
      }).map((item) => item.key),
    ).toEqual(["calendar", "route"]);
    const oneStop = { ...KANAZAWA.day, stops: KANAZAWA.day.stops.slice(0, 1) };
    const single = takeAlongOf({ ...options, day: oneStop, shown: [0], exports: exportsOf() });
    expect(single.map((item) => item.key)).toEqual(["link", "calendar"]);
    expect(single[1]?.note).toMatch(/^1 event, for the day's one stop/);
  });

  it("says how the link's send went, in its words and to a screen reader", () => {
    const copied = takeAlongOf({ ...options, day: KANAZAWA.day, exports: exportsOf(LINK_COPIED) });
    expect(copied[0]).toMatchObject({ label: "Link copied", status: "The day's link is copied" });
    const failed = takeAlongOf({
      ...options,
      day: KANAZAWA.day,
      exports: exportsOf(LINK_NOT_COPIED),
    });
    expect(failed[0]).toMatchObject({
      label: "Link not copied",
      status: "The day's link could not be copied",
    });
  });
});

describe("the line under a day whose ways the menu holds", () => {
  it("offers no way but keeps its summary, and its walking route for a page without script", () => {
    const { container } = render(
      <DayEnd {...KANAZAWA} calendarKey="kanazawa" hasWaysAlong={false} />,
    );
    expect(screen.getByText(/8 stops/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("noscript")).not.toBeNull();
  });
});

describe("the masthead", () => {
  it("sets the wordmark's mark in ems of the word, and the action and theme as one group", () => {
    render(<Masthead action={<button type="button">Plan another day</button>} />);
    const home = screen.getByRole("link", { name: "Lantern" });
    expect(home.querySelector("svg")).toHaveStyle({ height: "1.75em" });
    expect(screen.getByRole("button", { name: "Plan another day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
  });

  it("puts the day's menu in the action's place, and draws no rule with no action", () => {
    const { unmount } = render(
      <Masthead action={<span>Plan another day</span>} menu={<DayMenu items={ITEMS} />} />,
    );
    expect(screen.getByRole("button", { name: TAKE_THIS_DAY })).toBeInTheDocument();
    expect(screen.queryByText("Plan another day")).toBeNull();
    unmount();

    const { container } = render(<Masthead isHome />);
    expect(container.querySelector(".w-px")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("the day header's menu", () => {
  it("holds the ways along and opens the city's field from “Plan another day”", async () => {
    const user = userEvent.setup();
    const onCityOpenChange = vi.fn();
    const facts = sentenceFactsOf(KYOTO_REQUEST, {});
    render(
      <DayStageHeader
        request={KYOTO_REQUEST}
        facts={facts}
        reservedFacts={facts}
        clause={null}
        dek="Food carts at noon, the river at dusk."
        reservedDek="Food carts at noon, the river at dusk."
        isDekWriting={false}
        sunrise={null}
        sunset={null}
        isSunShown={false}
        slot={null}
        reservedSlot={null}
        notice={null}
        isEnabled
        isWaiting={false}
        written={CURATED_REQUESTS}
        cityOpenAt={null}
        isCityFocused={false}
        onCityOpenChange={onCityOpenChange}
        takeAlong={[ITEMS[1]!]}
        onChooseWritten={ignore}
        onChooseCity={ignore}
        onChoose={ignore}
        onLight={ignore}
        onRetry={ignore}
      />,
    );
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    expect(menuItems()).toHaveLength(2);
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    expect(onCityOpenChange).toHaveBeenCalledWith("elsewhere");
  });
});
