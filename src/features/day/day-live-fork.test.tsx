import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import { keptViewOf } from "./kept-day";
import { CANDIDATE_ATTRIBUTE } from "@/features/abacus/chart-stop";
import { KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import { KYOTO_LATE_EVENING } from "@/lib/fixtures/replan/kyoto-evening";
import { Day, type DayHandle } from "./day";
import { readIntakeRoute } from "./intake-route";
import { TAKE_THIS_DAY } from "./day-menu";
import { ONE_CHANGE_AT_A_TIME } from "./day-stage-header";
import { NOTICE_HEARD_MS } from "./notice-status";
import { sendProductEvent } from "@/lib/events/send-event";
import type { ProductEvent } from "@/lib/events/event.schema";
import {
  DAY_TIMEOUT,
  POOL,
  SIGNED_KYOTO,
  intakeReplies,
  dayReplies,
  dayPosts,
  replanPosts,
  replanReplies,
  dayIds,
  REPLAN_ID,
  KYOTO_KEPT,
  KYOTO_DAY_ID,
  NEXT_DAY_ID,
  seenTextOf,
  headline,
  dayList,
  planList,
  ask,
  answered,
  waitForTheDay,
  landOnMadrid,
  factsLineText,
  askForKyoto,
  changeWord,
  takeProposal,
  takeBack,
  rowTexts,
  keptDays,
  stubLiveRoutes,
  forgetLiveAsks,
  unstubLiveRoutes,
} from "./day-live-harness";

/** A changed word's fork on the chart, with live generation on: taken, left and taken back. */

// The product's events, caught where a page that counts them sends them.
vi.mock("@/lib/events/send-event", () => ({ sendProductEvent: vi.fn() }));

/** The id the re-plan's answer names; null for an answer that names none. */
let replanId: string | null = REPLAN_ID;

beforeAll(() => stubLiveRoutes(() => replanId));
beforeEach(() => {
  forgetLiveAsks();
  replanId = REPLAN_ID;
});
afterAll(unstubLiveRoutes);

describe("a changed word's fork: taken, left and taken back, with live generation on", () => {
  beforeEach(() => window.localStorage.clear());

  it("re-plans a re-plan opened at its address in part, as the round after its record's", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    replanId = NEXT_DAY_ID;
    // The visitor's re-plan, reopened at its address: its record has taken one re-plan.
    const view = keptViewOf(
      REPLAN_ID,
      {
        status: "written",
        ...KYOTO_KEPT,
        checks: {},
        writtenAt: "2026-11-05T20:00:00.000Z",
        seconds: 34,
        round: 1,
      },
      null,
      false,
    );
    if (view.kind !== "day") throw new Error("A re-plan's record lands as a day");
    const user = userEvent.setup();
    render(<Day kept={view.landing} isLive isAddressed />);
    await waitForTheDay();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts[0]?.body).toEqual({
      basis: { kind: "kept", id: REPLAN_ID },
      request: expect.objectContaining({ start: "slow" }),
      changed: "start",
      round: 2,
      picks: {},
    });
    // Proposed in part, never sent on to the whole day, and taken.
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    expect(dayPosts).toEqual([]);
  });

  it("keeps the day the visitor's while its proposal is written: whole, live, the proposal beside it", async () => {
    replanReplies.push({ held: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const before = rowTexts();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));
    expect(day.current?.replan().change).toEqual({
      word: "start",
      from: "early start",
      to: "slow morning",
    });
    expect(day.current?.replan().reach).toBe("part");
    // Named as its answer came: a row of its own, so no day paid for is lost.
    await waitFor(() =>
      expect(keptDays()).toEqual([
        [REPLAN_ID, "writing"],
        [KYOTO_DAY_ID, "written"],
      ]),
    );
    await waitFor(
      () => expect(within(dayList()).getByText(/^Shoren-in$/)).toBeInTheDocument(),
      DAY_TIMEOUT,
    );
    // Every row of the day stands as it was, and the day can be dragged and swapped.
    expect(before.every((text) => rowTexts().includes(text))).toBe(true);
    await waitFor(
      () =>
        expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
          "aria-busy",
          "false",
        ),
      DAY_TIMEOUT,
    );
    // The proposal cannot be taken until it is whole; the day keeps its address.
    const proposal = screen.getAllByRole("radio", {
      name: "slow morning, being written",
    })[0];
    expect(proposal).toHaveAttribute("aria-disabled", "true");
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    // The facts line's "see it" leads to the proposal, and says so to a screen reader.
    expect(
      screen.getByRole("button", { name: "see it: “slow morning” beside the morning" }),
    ).toHaveTextContent(/^see it$/);
  });

  it("takes the day before back from memory, with no call, and the proposal again, in the run's place", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const entries = window.history.length;
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(day.current?.replan().status).toBe("taken");
    // Both versions are the visitor's days, each a row of its own.
    expect(keptDays()).toEqual([
      [REPLAN_ID, "written"],
      [KYOTO_DAY_ID, "written"],
    ]);
    const list = dayList();

    await takeBack(user, "early start");

    // The day before, from memory, at its own address: no model call, and no stage drawn anew.
    await waitFor(
      () => expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Honen-in/),
      DAY_TIMEOUT,
    );
    expect(dayList()).toBe(list);
    expect(replanPosts).toHaveLength(1);
    expect(dayPosts).toEqual([]);
    expect(headline()).toHaveTextContent("on foot, early start, early dinner");
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    expect(day.current?.replan().status).toBe("left");
    // Both still the visitor's, the day on screen now first.
    expect(keptDays()).toEqual([
      [KYOTO_DAY_ID, "written"],
      [REPLAN_ID, "written"],
    ]);
    await waitForTheDay();

    // The word's list takes the proposal again, as its fork row does.
    await changeWord(user, "early start", "slow morning");

    await waitFor(
      () => expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Shoren-in/),
      DAY_TIMEOUT,
    );
    expect(dayList()).toBe(list);
    expect(replanPosts).toHaveLength(1);
    expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`);
    expect(day.current?.replan().status).toBe("taken");
    // Each address replaced the last: Back leaves the day as it did before the change.
    expect(window.history.length).toBe(entries);
    await waitForTheDay();

    act(() => window.history.back());

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toBeVisible(),
    );
  });

  it("lets a swap's line go when a version of the fork is taken inside its hold", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitForTheDay();
    const list = dayList();
    const slider = screen.getAllByRole("slider").at(-1);
    if (slider === undefined) throw new Error("Kyoto's day has stops on its curve");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    const shown = slider.getAttribute("aria-valuetext") ?? "";
    const place = shown.slice(shown.indexOf(": ") + 2);
    const sayingThePlace = () =>
      screen.getAllByRole("status").filter((status) => status.textContent?.startsWith(place));
    await waitFor(() => expect(sayingThePlace()).toHaveLength(1));

    await takeBack(user, "early start");

    expect(day.current?.replan().status).toBe("left");
    expect(dayList()).toBe(list);
    // Well inside the hold, which would empty the status by itself.
    await waitFor(() => expect(sayingThePlace()).toEqual([]), { timeout: NOTICE_HEARD_MS / 3 });
  });

  it("lets a swap's line go when the day as it was is kept over a whole proposal inside its hold", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    const slider = screen.getAllByRole("slider").at(-1);
    if (slider === undefined) throw new Error("Kyoto's day has stops on its curve");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    const shown = slider.getAttribute("aria-valuetext") ?? "";
    const place = shown.slice(shown.indexOf(": ") + 2);
    const sayingThePlace = () =>
      screen.getAllByRole("status").filter((status) => status.textContent?.startsWith(place));
    await waitFor(() => expect(sayingThePlace()).toHaveLength(1));

    const kept = screen.getAllByRole("radio", { name: "early start, your day" })[0];
    if (!kept) throw new Error("The day as it was has its radio");
    await user.click(kept);

    expect(day.current?.replan().status).toBe("left");
    // Well inside the hold, which would empty the status by itself.
    await waitFor(() => expect(sayingThePlace()).toEqual([]), { timeout: NOTICE_HEARD_MS / 3 });
  });

  it("keeps a swap's line through a press of the version already taken", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitForTheDay();
    const slider = screen.getAllByRole("slider").at(-1);
    if (slider === undefined) throw new Error("Kyoto's day has stops on its curve");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    const shown = slider.getAttribute("aria-valuetext") ?? "";
    const place = shown.slice(shown.indexOf(": ") + 2);
    const sayingThePlace = () =>
      screen.getAllByRole("status").filter((status) => status.textContent?.startsWith(place));
    await waitFor(() => expect(sayingThePlace()).toHaveLength(1));

    // The version the day already has: nothing is taken, so the line is no one's to let go.
    const taken = screen.getAllByRole("radio", { name: "slow morning, your day" })[0];
    if (!taken) throw new Error("The version taken has its radio");
    await user.click(taken);

    expect(day.current?.replan().status).toBe("taken");
    await new Promise((done) => setTimeout(done, NOTICE_HEARD_MS / 3));
    expect(sayingThePlace()).toHaveLength(1);
  });

  it("comes Back to a day left with its fork standing as the day on screen was, the fork settled, with no call", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);

    await user.click(within(headline()).getByRole("button", { name: "Kyoto" }));
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));
    await waitFor(() => expect(window.location.pathname).toBe("/day/bologna"), DAY_TIMEOUT);
    await waitForTheDay();
    expect(dayPosts).toHaveLength(1);

    act(() => window.history.back());

    // The day as it stood, its own morning, at its own address: the proposal not taken stays
    // among the visitor's days, and nothing is asked again.
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`));
    await waitFor(() =>
      expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Honen-in/),
    );
    expect(within(dayList()).queryByText(/^Shoren-in$/)).toBeNull();
    expect(headline()).toHaveTextContent("on foot, early start, early dinner");
    expect(day.current?.replan().status).toBe("idle");
    expect(keptDays()).toContainEqual([REPLAN_ID, "written"]);
    expect(replanPosts).toHaveLength(1);
    expect(dayPosts).toHaveLength(1);
    await waitForTheDay();
  });

  it("counts nothing again on a day with a part taken, come back to by Back", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    vi.mocked(sendProductEvent).mockClear();
    intakeReplies.push(
      answered({
        kind: "request",
        request: KYOTO_REQUEST,
        readings: [],
        unplaced: [],
        signed: [SIGNED_KYOTO],
      }),
    );
    const user = userEvent.setup();
    render(<Day start={{ pool: POOL, read: readIntakeRoute }} isLive isAddressed isCounted />);
    await ask(user, "Kyoto");
    await waitForTheDay();
    const menu = () => screen.getByRole("button", { name: TAKE_THIS_DAY });
    await user.click(menu());
    await user.click(menu());
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    await user.click(within(headline()).getByRole("button", { name: "Kyoto" }));
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));
    await waitFor(() => expect(window.location.pathname).toBe("/day/bologna"), DAY_TIMEOUT);
    await waitForTheDay();

    act(() => window.history.back());

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`));
    await waitFor(() => expect(headline()).toHaveTextContent("slow morning"));
    await user.click(menu());
    await user.click(menu());
    const sentOf = (kind: ProductEvent["kind"]) =>
      vi
        .mocked(sendProductEvent)
        .mock.calls.map(([event]) => event)
        .filter((event) => event.kind === kind);
    // Kyoto's menu was told opened once, on Kyoto; Bologna's was never opened.
    expect(sentOf("menu-opened")).toEqual([
      expect.objectContaining({ kind: "menu-opened", city: "kyoto" }),
    ]);
    expect(sentOf("day-opened")).toHaveLength(2);
  });

  it("compares the version not taken beside the day again, and folds it", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(within(dayList()).queryByText(/Honen-in/)).toBeNull();

    const compare = screen.getAllByRole("button", { name: "Compare" })[0];
    if (!compare) throw new Error("A fork taken offers to compare");
    await user.click(compare);

    // The day before's morning beside the day, its own sentence's pair, and nothing asked.
    await waitFor(() => expect(within(dayList()).getByText(/Honen-in/)).toBeInTheDocument());
    expect(headline()).toHaveTextContent("slow morning or early start");
    expect(compare).toHaveAttribute("aria-pressed", "true");
    expect(replanPosts).toHaveLength(1);

    await user.click(compare);
    await waitFor(() => expect(within(dayList()).queryByText(/Honen-in/)).toBeNull(), DAY_TIMEOUT);
    expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`);
  });

  it("keeps a proposal not taken among the visitor's days, and settles the fork with the next word", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    expect(keptDays()).toEqual([
      [REPLAN_ID, "written"],
      [KYOTO_DAY_ID, "written"],
    ]);

    replanId = NEXT_DAY_ID;
    await changeWord(user, "early dinner", "eating late");

    // The next word asks from the day on screen, the visitor's own, the round after its own.
    await waitFor(() => expect(replanPosts).toHaveLength(2), DAY_TIMEOUT);
    expect(replanPosts[1]?.body).toEqual(
      expect.objectContaining({ basis: { kind: "kept", id: KYOTO_DAY_ID }, round: 1 }),
    );
    expect(keptDays()).toContainEqual([REPLAN_ID, "written"]);
    expect(day.current?.replan().change?.word).toBe("dinner");
  });

  it("carries a part's proposal not yet answered through an energy re-pick, setting nothing aside", async () => {
    // On the plan, where the proposal stands as a slip; the chart is laid out unseen under it.
    document.documentElement.setAttribute("data-day-view", "read");
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    expect(within(dayList()).getByText(/^Shoren-in$/)).toBeInTheDocument();

    await changeWord(user, "calm", "lively");

    // The proposal stands beside the re-picked day, on the chart and in the plan's slip.
    expect(day.current?.replan().status).toBe("proposed");
    expect(within(dayList()).getByText(/^Shoren-in$/)).toBeInTheDocument();
    expect(
      within(planList()).getByRole("radio", { name: "slow morning Take, proposed" }),
    ).toBeInTheDocument();
    expect(headline()).toHaveTextContent(/^A lively Saturday in Kyoto, on foot, /);
    expect(factsLineText()).not.toMatch(/set aside|not kept/);
    await waitForTheDay();

    // Taken after the re-pick, the proposal is the day, at the energy the headline says.
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    expect(headline()).toHaveTextContent(/^A lively /);
  });

  it("holds the energy while a proposal is written, on the plan's bar and in the headline, saying one change at a time", async () => {
    replanReplies.push({ held: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));
    const bar = screen.getByRole("group", { name: "How lively the day is" });
    const lively = within(bar).getByRole("button", { name: "lively" });
    expect(lively).toHaveAttribute("aria-disabled", "true");

    await user.click(lively);

    // The half-written proposal is still on its way, the day's energy as it was, and the facts
    // line says why nothing changed.
    expect(day.current?.replan().status).toBe("writing");
    expect(replanPosts[0]?.signal.aborted).toBe(false);
    expect(within(bar).getByRole("button", { name: "calm" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(headline()).toHaveTextContent(/^A calm /);
    expect(factsLineText()).toContain(ONE_CHANGE_AT_A_TIME);
    // Said to a screen reader too, where the facts line has scrolled away above the bar.
    const status = document.querySelector('header p[role="status"]');
    expect(status).toHaveTextContent(ONE_CHANGE_AT_A_TIME);

    const energyWord = within(headline()).getByRole("button", { name: "calm" });
    expect(energyWord).toHaveAttribute("aria-disabled", "true");
    await user.click(energyWord);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(day.current?.replan().status).toBe("writing");
    expect(replanPosts[0]?.signal.aborted).toBe(false);
  });

  it("offers a changed word of three answers only its fork's two while its proposal is written", async () => {
    replanReplies.push({ held: KYOTO_LATE_EVENING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "home by eight", "out late");
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));

    await user.click(within(headline()).getByRole("button", { name: "home by eight" }));

    // "home by eleven", the word's third answer, would be a second request: it is not offered.
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("home by eight"),
      expect.stringContaining("out late"),
    ]);
    await user.click(screen.getByRole("option", { name: "out late" }));
    expect(day.current?.replan().status).toBe("writing");
    expect(replanPosts).toHaveLength(1);
    expect(replanPosts[0]?.signal.aborted).toBe(false);
  });

  it("never holds a pull of the curve or a swap while a proposal is written, nor drops it for one", async () => {
    replanReplies.push({ held: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));
    await waitForTheDay();

    // The day's last stop, past the morning the proposal rewrites: its curve pulled, then a
    // version of it chosen.
    const slider = screen.getAllByRole("slider").at(-1);
    if (slider === undefined) throw new Error("Kyoto's day has stops on its curve");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    const version = [...document.querySelectorAll<SVGElement>(`[${CANDIDATE_ATTRIBUTE}]`)]
      .filter((bead) => /:a\d$/.test(bead.getAttribute(CANDIDATE_ATTRIBUTE) ?? ""))
      .at(-1);
    if (version === undefined) throw new Error("Kyoto's last stops have versions");
    await user.click(version);

    expect(day.current?.replan().status).toBe("writing");
    expect(replanPosts[0]?.signal.aborted).toBe(false);
    expect(factsLineText()).not.toContain(ONE_CHANGE_AT_A_TIME);
  });

  it.each([
    ["whole", KYOTO_SLOW_MORNING, "proposed", "proposed"],
    ["failed", { cut: KYOTO_SLOW_MORNING, at: 0.62 }, "failed", "idle"],
  ] as const)(
    "frees the energy once the proposal is %s, a press on the bar re-picking the day",
    async (_, reply, status, after) => {
      replanReplies.push(reply);
      dayIds.push(KYOTO_DAY_ID);
      const day = createRef<DayHandle>();
      const user = await askForKyoto(day);
      await changeWord(user, "early start", "slow morning");
      await waitFor(() => expect(day.current?.replan().status).toBe(status), DAY_TIMEOUT);
      const bar = screen.getByRole("group", { name: "How lively the day is" });
      const lively = within(bar).getByRole("button", { name: "lively" });
      expect(lively).not.toHaveAttribute("aria-disabled");
      expect(within(headline()).getByRole("button", { name: "calm" })).not.toHaveAttribute(
        "aria-disabled",
      );

      await user.click(lively);

      // A whole proposal stands through the re-pick; a failed one's fork settles.
      expect(day.current?.replan().status).toBe(after);
      expect(headline()).toHaveTextContent(/^A lively /);
      await waitForTheDay();
    },
  );

  it("frees the energy once the proposal is taken", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitForTheDay();

    const bar = screen.getByRole("group", { name: "How lively the day is" });
    expect(within(bar).getByRole("button", { name: "lively" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(within(headline()).getByRole("button", { name: "calm" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });

  it("re-plans from the day before after taking it back, as the round after its own", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    act(() => {
      day.current?.replan().choose("from");
    });
    await waitForTheDay();

    await changeWord(user, "early dinner", "eating late");

    await waitFor(() => expect(replanPosts).toHaveLength(2), DAY_TIMEOUT);
    expect(replanPosts[1]?.body).toEqual({
      basis: { kind: "kept", id: KYOTO_DAY_ID },
      request: expect.objectContaining({ start: null, dinner: "late" }),
      changed: "dinner",
      round: 1,
      picks: {},
    });
  });

  it("takes back a second change to the first's day: its rows, address and round", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const entries = window.history.length;
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    // The second change, on the taken day, is the log's next re-plan, under an id of its own.
    replanId = NEXT_DAY_ID;
    replanReplies.push(KYOTO_LATE_EVENING);
    await changeWord(user, "home by eight", "out late");
    await takeProposal(user, "out late");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(replanPosts[1]?.body).toEqual(
      expect.objectContaining({ basis: { kind: "kept", id: REPLAN_ID }, round: 2 }),
    );
    expect(within(dayList()).getByText(/^Izakaya along Kiyamachi$/)).toBeInTheDocument();

    await changeWord(user, "out late", "home by eight");

    // The first change's day, not the one before both: its morning, its evening, its address.
    await waitFor(
      () => expect(within(dayList()).queryByText(/^Izakaya along Kiyamachi$/)).toBeNull(),
      DAY_TIMEOUT,
    );
    expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Shoren-in/);
    expect(headline()).toHaveTextContent("slow morning");
    expect(headline()).toHaveTextContent("home by eight");
    expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`);
    expect(day.current?.replan().status).toBe("left");
    expect(window.history.length).toBe(entries);
    await waitForTheDay();

    await changeWord(user, "early dinner", "eating late");

    // Re-planned from the first change's day, as the round after its own.
    await waitFor(() => expect(replanPosts).toHaveLength(3), DAY_TIMEOUT);
    expect(replanPosts[2]?.body).toEqual({
      basis: { kind: "kept", id: REPLAN_ID },
      request: expect.objectContaining({ start: "slow", end: null, dinner: "late" }),
      changed: "dinner",
      round: 2,
      picks: {},
    });
  });

  it("holds the day before, rows and words, while a whole day is written", async () => {
    const day = createRef<DayHandle>();
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
    const user = await askForKyoto(day);
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    const sentence = seenTextOf(headline());
    dayReplies.push("held");

    await changeWord(user, "with anyone", "with family");

    // The new day's header and its first stops have streamed; the day before stays the day.
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"), DAY_TIMEOUT);
    expect(day.current?.replan().reach).toBe("whole");
    await waitFor(() =>
      expect(keptDays()).toEqual([
        [NEXT_DAY_ID, "writing"],
        [KYOTO_DAY_ID, "written"],
      ]),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    // Only the pair was written in at the press: the rest of the headline stands.
    expect(seenTextOf(headline())).toBe(
      sentence.replace("with anyone", "with anyone or with family"),
    );
    // The day held keeps its own address while the new one is on its way.
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
  });

  it("lands a change of a day not written to its end with no fork, as there is no day before", async () => {
    const day = createRef<DayHandle>();
    dayReplies.push("cut");
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
    const user = await askForKyoto(day);

    await changeWord(user, "with anyone", "with family");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(headline()).toHaveTextContent(/with family$/);
    // No fork, so nothing offers a day before that is not there.
    expect(day.current?.replan()).toMatchObject({ status: "idle", change: null, reach: null });
    expect(day.current?.replan().choose("from")).toBe(false);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(dayPosts).toHaveLength(1);
  });

  it("proposes a whole day written again, the headline changing by its pair, then by its word once taken", async () => {
    const user = await landOnMadrid();
    // The headline's words as seen, without the list a word opens under it.
    const sentenceOf = () => {
      const list = headline().querySelector('[role="listbox"]')?.textContent ?? "";
      return seenTextOf(headline()).replace(list, "");
    };
    const before = sentenceOf();
    const sentences = [before];
    const observer = new MutationObserver(() => {
      const now = sentenceOf();
      if (now !== sentences.at(-1)) sentences.push(now);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    // The written day's own stream, under the request with the word changed.
    dayReplies.push(MADRID_START_REQUEST);

    await changeWord(user, "with friends", "with family");
    await takeProposal(user, "with family");

    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    observer.disconnect();
    // The pen wrote the pair in at the press, and the word taken stands alone at the end.
    const lead = before.slice(0, before.lastIndexOf("with friends"));
    expect(sentences).toContain(`${lead}with friends or with family`);
    expect(sentences.at(-1)).toBe(`${lead}with family`);
    for (const sentence of sentences) expect(sentence.startsWith(lead), sentence).toBe(true);
  });

  it("takes a whole day written again, drawn whole at its address, and takes the day before back", async () => {
    const day = createRef<DayHandle>();
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
    const user = await askForKyoto(day);
    await changeWord(user, "with anyone", "with family");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    // Whole, it waits to be taken: the day before still the day, at its own address.
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    expect(headline()).toHaveTextContent(/with anyone or with family$/);

    await takeProposal(user, "with family");

    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/));
    expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`);
    expect(day.current?.replan().status).toBe("taken");
    await waitForTheDay();

    act(() => {
      day.current?.replan().choose("from");
    });

    await waitFor(() => expect(headline()).toHaveTextContent(/with anyone$/));
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    expect(day.current?.replan().status).toBe("left");
    expect(dayPosts).toHaveLength(1);
    await waitForTheDay();

    act(() => {
      day.current?.replan().choose("to");
    });

    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/));
    expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`);
    expect(day.current?.replan().status).toBe("taken");
    expect(dayPosts).toHaveLength(1);
    // Both versions are the visitor's days, each a row of its own.
    expect(keptDays()).toEqual([
      [NEXT_DAY_ID, "written"],
      [KYOTO_DAY_ID, "written"],
    ]);
  });
});
