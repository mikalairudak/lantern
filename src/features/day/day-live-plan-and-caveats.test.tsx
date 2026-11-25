import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { forgetDays } from "./use-your-days";
import { keepCaveats, readCaveats } from "./caveats";
import { keptViewOf } from "./kept-day";
import {
  KYOTO_SLOW_MORNING,
  KYOTO_SLOW_MORNING_WITH_VERSIONS,
} from "@/lib/fixtures/replan/kyoto-morning";
import { Day, type DayHandle } from "./day";
import { DOUBLE_PRESS_MS } from "./plan-fork";
import {
  DAY_TIMEOUT,
  SIGNED_KYOTO,
  dayReplies,
  replanReplies,
  dayIds,
  REPLAN_ID,
  SHARED_DAY_ID,
  KYOTO_KEPT,
  KYOTO_DAY_ID,
  headline,
  dayList,
  planList,
  renderLive,
  ask,
  answered,
  waitForTheDay,
  landOnMadrid,
  askForKyoto,
  changeWord,
  takeProposal,
  stubLiveRoutes,
  forgetLiveAsks,
  unstubLiveRoutes,
} from "./day-live-harness";

/**
 * A changed word's fork on the plan, with live generation on, and a day's caveats kept on this
 * device.
 */

// The product's events, caught where a page that counts them sends them.
vi.mock("@/lib/events/send-event", () => ({ sendProductEvent: vi.fn() }));

beforeAll(() => stubLiveRoutes());
beforeEach(forgetLiveAsks);
afterAll(unstubLiveRoutes);

describe("a day's caveats, kept on this device", () => {
  const SLOWLY = "Lantern can't plan around “she walks slowly”.";

  /** Kyoto's day asked from the start screen with a phrase Lantern cannot plan around. */
  async function askSlowly() {
    window.localStorage.clear();
    dayIds.push(KYOTO_DAY_ID);
    const user = renderLive(
      answered({
        kind: "request",
        request: KYOTO_REQUEST,
        readings: [],
        unplaced: ["she walks slowly"],
        signed: [SIGNED_KYOTO],
      }),
    );
    await ask(user, "Kyoto, she walks slowly");
    await waitForTheDay();
    return user;
  }

  /** The kept day under `id`, opened at its address on this device. */
  function openKept(id: string) {
    const view = keptViewOf(
      id,
      {
        status: "written",
        ...KYOTO_KEPT,
        checks: {},
        writtenAt: "2026-10-31T20:00:00.000Z",
        seconds: 46,
        round: 0,
      },
      null,
      false,
    );
    if (view.kind !== "day") throw new Error("A kept day lands as a day");
    render(<Day kept={view.landing} isLive isAddressed />);
  }

  it("keeps them under the day's id once its answer names it", async () => {
    await askSlowly();

    await waitFor(() =>
      expect(readCaveats(window.localStorage, KYOTO_DAY_ID)).toEqual(["she walks slowly"]),
    );
    expect(screen.getAllByText(SLOWLY)[0]).toBeVisible();
  });

  it("says them again where the day opens on this device: reloaded, from the list or at its link", async () => {
    window.localStorage.clear();
    keepCaveats(window.localStorage, KYOTO_DAY_ID, ["she walks slowly"]);

    openKept(KYOTO_DAY_ID);
    await waitForTheDay();

    expect(screen.getAllByText(SLOWLY)[0]).toBeVisible();
  });

  it("says none on a day this device kept none for, as someone's link opened here", async () => {
    window.localStorage.clear();
    keepCaveats(window.localStorage, KYOTO_DAY_ID, ["she walks slowly"]);

    openKept(SHARED_DAY_ID);
    await waitForTheDay();

    expect(screen.queryByText(SLOWLY)).toBeNull();
  });

  it("carries them to a re-plan merged into the day, under its own id", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    const user = await askSlowly();

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitFor(() =>
      expect(readCaveats(window.localStorage, REPLAN_ID)).toEqual(["she walks slowly"]),
    );
    expect(screen.getAllByText(SLOWLY)[0]).toBeVisible();
  });

  it("never keeps them again once the visitor's days are forgotten, through the next change", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    const user = await askSlowly();
    await waitFor(() =>
      expect(readCaveats(window.localStorage, KYOTO_DAY_ID)).toEqual(["she walks slowly"]),
    );

    act(() => forgetDays());
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(readCaveats(window.localStorage, REPLAN_ID)).toEqual([]);
    expect(readCaveats(window.localStorage, KYOTO_DAY_ID)).toEqual([]);
  });

  it("carries a kept day's, opened at its address, to its re-plan", async () => {
    window.localStorage.clear();
    keepCaveats(window.localStorage, KYOTO_DAY_ID, ["she walks slowly"]);
    replanReplies.push(KYOTO_SLOW_MORNING);
    openKept(KYOTO_DAY_ID);
    await waitForTheDay();
    const user = userEvent.setup();

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() =>
      expect(readCaveats(window.localStorage, REPLAN_ID)).toEqual(["she walks slowly"]),
    );
  });
});

describe("a changed word's fork on the plan, with live generation on", () => {
  // On the plan, where the fork's other version stands as a slip; the chart is laid out unseen.
  beforeEach(() => document.documentElement.setAttribute("data-day-view", "read"));

  /** The rows of the plan, without the slips over them: the day's stops' names. */
  const planNames = () =>
    within(planList())
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
  const slipRadio = (name: string, description: string) =>
    within(planList()).getByRole("radio", { name: `${name}, ${description}` });
  /** The names the slip lists, a line each, without the unseen lines holding its room. */
  const slipNames = () =>
    [
      ...planList().querySelectorAll(
        "[data-slip] ol li:not([aria-hidden]) span.min-w-0 > span:first-child",
      ),
    ].map((name) => name.textContent);
  /** A moment later than any press a test has made, for presses whose clock the test sets. */
  const FIRST_PRESS_AT = 1e9;
  /** A press whose event says when it was made, as the double-press guard reads it. */
  const pressAt = (control: HTMLElement, timeStamp: number) => {
    const click = createEvent.click(control);
    Object.defineProperty(click, "timeStamp", { value: timeStamp });
    fireEvent(control, click);
  };
  /** A press on the same control within a double press's time does nothing: wait it out. */
  const pastADoublePress = () =>
    act(() => new Promise((resolve) => setTimeout(resolve, DOUBLE_PRESS_MS)));

  it("lists the day alone while a proposal is written, each stop finished standing in its slip", async () => {
    replanReplies.push({ held: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const before = planNames();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));
    expect(slipRadio("slow morning", "being written")).toHaveAttribute("aria-disabled", "true");
    expect(planNames()).toEqual(before);
    expect(planNames()).not.toContain("Shoren-in");
    await waitFor(() =>
      expect(planList().querySelector("[data-slip] ol")).toHaveTextContent("09:00Shoren-in"),
    );
  });

  it("takes the proposal from its slip by the keyboard and the day before back, the focus on the day's answer", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const before = planNames();
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);

    // Whole: the slip lists the proposal's morning; the plan is still the day.
    expect(within(planList()).getByText("Shoren-in")).toBeInTheDocument();
    expect(planNames()).toEqual(before);
    const take = slipRadio("slow morning Take", "proposed");
    expect(take).toHaveTextContent("slow morning· Take");
    take.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitFor(() => expect(slipRadio("slow morning", "your day")).toHaveFocus());
    await waitFor(() => expect(planNames()).toContain("Shoren-in"));
    // The day before stands in the slip under the same control, to take back.
    const back = slipRadio("early start Take", "the day before");
    expect(back).toHaveTextContent("early start· Take");

    await pastADoublePress();
    await user.click(back);

    await waitFor(() => expect(day.current?.replan().status).toBe("left"), DAY_TIMEOUT);
    await waitFor(() => expect(planNames()).toEqual(before), DAY_TIMEOUT);
    expect(slipRadio("slow morning Take", "proposed")).toBeInTheDocument();
  });

  it("re-picks a proposal standing on the chart as in its slip, and takes it as both say", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING_WITH_VERSIONS);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    const slipFirst = () =>
      planList().querySelector("[data-slip] ol li span.min-w-0 > span")?.textContent ?? "";
    const before = slipFirst();

    await user.click(
      within(screen.getByRole("group", { name: "How lively the day is" })).getByRole("button", {
        name: "social",
      }),
    );

    // The slip's first stop re-picked, and the chart's proposal row naming the same place.
    const repicked = slipFirst();
    expect(repicked).not.toBe(before);
    expect(within(dayList()).getByText(repicked)).toBeInTheDocument();
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    expect(within(dayList()).getByText(repicked)).toBeInTheDocument();
  });

  it("lists in a taken proposal's slip the day before as taking it back draws it", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    // The morning's first stop swapped to its quieter version, then the word changed.
    const bar = () => screen.getByRole("group", { name: "How lively the day is" });
    await user.click(within(planList()).getAllByRole("button", { name: /^Quieter: / })[0]!);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    // Another energy pressed with the proposal standing.
    await user.click(within(bar()).getByRole("button", { name: "balanced" }));
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    const listed = [
      ...planList().querySelectorAll("[data-slip] ol li span.min-w-0 > span:first-child"),
    ].map((name) => name.textContent);

    await pastADoublePress();
    await user.click(slipRadio("early start Take", "the day before"));

    await waitFor(() => expect(day.current?.replan().status).toBe("left"), DAY_TIMEOUT);
    await waitFor(() => expect(planNames().slice(0, listed.length)).toEqual(listed), DAY_TIMEOUT);
  });

  it("lists a whole day written again as taking it draws it, with none of the day before's picks", async () => {
    const user = await landOnMadrid();
    // A pick on the first stop of the day before; then a word that writes the whole day again,
    // the new day's stops and their versions numbered from the start as the day before's are.
    await user.click(
      within(planList()).getAllByRole("button", { name: /^(Quieter|Livelier): / })[0]!,
    );
    dayReplies.push(KANAZAWA_START_REQUEST);
    // Every name each of the slip's lines says from the press to the proposal whole, a line a
    // stop: a name the pen is writing grows to the one it ends on, and is never another place's.
    const said = new Set<string>();
    const watch = new MutationObserver(() => {
      slipNames().forEach((name, line) => said.add(`${line}|${name}`));
    });
    watch.observe(document.body, { subtree: true, childList: true, characterData: true });
    onTestFinished(() => watch.disconnect());
    await changeWord(user, "with friends", "with family");
    const take = await waitFor(() => slipRadio("with family Take", "proposed"), DAY_TIMEOUT);
    watch.disconnect();
    const listed = slipNames();
    const strays = [...said].filter((each) => {
      const [line, name] = each.split("|");
      return !(listed[Number(line)] ?? "").startsWith(name ?? "");
    });
    expect(strays).toEqual([]);

    await pastADoublePress();
    await user.click(take);

    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(planNames()).toEqual(listed);

    // Taken, the slip lists the day before as taking it back draws it.
    const before = slipNames();
    await pastADoublePress();
    await user.click(slipRadio("with friends Take", "the day before"));
    await waitFor(() => expect(headline()).toHaveTextContent(/with friends$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(planNames()).toEqual(before);
  });

  it("takes no second press of a double press on a whole day's slip, drawn anew as its own run", async () => {
    const user = await landOnMadrid();
    dayReplies.push(KANAZAWA_START_REQUEST);
    await changeWord(user, "with friends", "with family");
    const take = await waitFor(() => slipRadio("with family Take", "proposed"), DAY_TIMEOUT);

    // The two presses of a double press, 300 ms apart on the clock their events carry, however
    // long the day between them takes to be drawn anew.
    pressAt(take, FIRST_PRESS_AT);
    // The day taken is drawn anew, its slip in the same place; the finger presses again.
    const back = await waitFor(() => slipRadio("with friends Take", "the day before"), DAY_TIMEOUT);
    pressAt(back, FIRST_PRESS_AT + 300);

    await waitForTheDay();
    expect(headline()).toHaveTextContent(/with family$/);
  });

  it("names on the chart's compared day before the place its slip and a take-back name", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    // A stop of the morning swapped, no energy chosen; the proposal taken, then compared.
    await user.click(within(planList()).getAllByRole("button", { name: /^Quieter: / })[0]!);
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitForTheDay();
    // Each line of the slip: the stop's time and the place it names.
    const listed = [...planList().querySelectorAll("[data-slip] ol li:not([aria-hidden])")].map(
      (line) => ({
        time: line.querySelector(":scope > span")?.textContent ?? "",
        name: line.querySelector("span.min-w-0 > span:first-child")?.textContent ?? "",
      }),
    );
    expect(listed.length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Compare" })[0]!);

    // The chart's row of each stop, at its time, names the place its line does.
    const namesAt = (time: string) =>
      within(dayList())
        .getAllByRole("listitem")
        .filter((row) => row.querySelector(`[data-start-time="${time}"]`) !== null)
        .flatMap((row) => listed.filter(({ name }) => within(row).queryByText(name) !== null));
    await waitFor(() => {
      for (const line of listed) expect(namesAt(line.time)).toContainEqual(line);
    });
  });

  it("re-picks the day from its own plan when an energy is pressed again with a proposal standing", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const bar = () => screen.getByRole("group", { name: "How lively the day is" });
    await user.click(within(bar()).getByRole("button", { name: "quiet" }));
    const quiet = planNames();
    await user.click(within(bar()).getByRole("button", { name: "lively" }));
    expect(planNames()).not.toEqual(quiet);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);

    // The re-plan's day holds its stops as they showed, lively; pressed quiet again, they are
    // re-picked from the day's own plan, as on the day with no proposal beside it.
    await user.click(within(bar()).getByRole("button", { name: "quiet" }));

    expect(day.current?.replan().status).toBe("proposed");
    expect(planNames()).toEqual(quiet);
  });

  it("keeps an energy re-picked before a word on the day's rows, written, whole, taken and taken back", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "calm", "lively");
    await waitForTheDay();
    const repicked = planNames();

    await changeWord(user, "early start", "slow morning");

    // While written, then whole: the frame holds the day as it showed at the press.
    expect(planNames()).toEqual(repicked);
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    expect(planNames()).toEqual(repicked);

    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    // The day before's morning stands in the slip; every row outside it is where it was.
    const slip = planList().querySelector("[data-slip]")?.textContent ?? "";
    const outside = repicked.filter((name) => !slip.includes(name ?? ""));
    await waitFor(() => expect(planNames()).toEqual(expect.arrayContaining(outside)), DAY_TIMEOUT);

    await pastADoublePress();
    await user.click(slipRadio("early start Take", "the day before"));
    await waitFor(() => expect(planNames()).toEqual(repicked), DAY_TIMEOUT);
  });

  it("says an ending without a proposal once, at the first part, and lets its slip go", async () => {
    replanReplies.push({ cut: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(day.current?.replan().status).toBe("failed"), DAY_TIMEOUT);
    // The slip leaves with the proposal's answer once its exit has run, a frame or more after
    // the ending is drawn, so the fork is read once it has gone.
    await waitFor(() => expect(planList().querySelector("[data-slip]")).toBeNull(), DAY_TIMEOUT);
    const fork = within(planList()).getByRole("radiogroup");
    expect(within(fork).getAllByRole("radio")).toHaveLength(1);
    expect(within(fork).getByRole("button", { name: "Ask again" })).toBeInTheDocument();
  });
});
