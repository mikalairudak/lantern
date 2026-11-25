import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import { readYourDays } from "./your-days";
import { forgetDays } from "./use-your-days";
import { keptViewOf } from "./kept-day";
import { CANDIDATE_ATTRIBUTE } from "@/features/abacus/chart-stop";
import { KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import { Day, type DayHandle } from "./day";
import { isKeptSeen } from "./seen-days";
import { NO_MORE_REPLANS, replanningOf, UNFINISHED } from "./not-yet";
import {
  DAY_TIMEOUT,
  LISBON,
  SIGNED_LISBON,
  dayReplies,
  dayPosts,
  replanPosts,
  replanReplies,
  dayIds,
  REPLAN_ID,
  SHARED_DAY_ID,
  KYOTO_KEPT,
  KYOTO_DAY_ID,
  NEXT_DAY_ID,
  watchStruck,
  seenTextOf,
  headline,
  dayList,
  renderLive,
  ask,
  answered,
  waitForTheDay,
  landOnKanazawa,
  landOnMadrid,
  factsLineText,
  askForKyoto,
  changeWord,
  takeProposal,
  rowTexts,
  endedSaid,
  keptDays,
  stubLiveRoutes,
  forgetLiveAsks,
  unstubLiveRoutes,
} from "./day-live-harness";

/**
 * A changed word of a live day: a time word re-planned beside the day, the whole day asked again,
 * and a word's list once a re-plan has met our limit.
 */

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

describe("a changed time word with live generation on", () => {
  it("proposes the morning beside the day, and takes it, the rest of the day where it was", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    const before = rowTexts();
    const kept = before.slice(2);

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    // The visitor's day is named by its id; the route reads it from the log.
    expect(replanPosts[0]?.body).toEqual({
      basis: { kind: "kept", id: KYOTO_DAY_ID },
      request: expect.objectContaining({ city: "Kyoto", start: "slow" }),
      changed: "start",
      round: 1,
      picks: {},
    });
    // No day was asked for again: the morning alone was proposed.
    expect(dayPosts).toEqual([]);
    // Whole, the proposal stands beside the day: every row of the day still there, the new
    // morning's beside them, the sentence saying both answers, the address the day's own.
    await waitFor(
      () =>
        expect(
          screen.getAllByRole("radio", { name: "slow morning Take, proposed" })[0],
        ).toBeDefined(),
      DAY_TIMEOUT,
    );
    expect(before.every((text) => rowTexts().includes(text))).toBe(true);
    expect(within(dayList()).getByText(/^Shoren-in$/)).toBeInTheDocument();
    expect(headline()).toHaveTextContent("on foot, early start or slow morning, early dinner");
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);

    await takeProposal(user, "slow morning");

    await waitFor(
      () =>
        expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(
          /^09:00\s*Shoren-in/,
        ),
      DAY_TIMEOUT,
    );
    const rows = within(dayList()).getAllByRole("listitem");
    expect(rows[1]).toHaveTextContent(/^09:40\s*Awata Shrine/);
    expect(rows.slice(2).map((row) => row.textContent)).toEqual(kept);
    expect(screen.getAllByText(/^Shoren-in at nine and the shrine above it/)[0]).toBeVisible();
    expect(headline()).toHaveTextContent("on foot, slow morning, early dinner");
    // The taken day is the re-plan's in the log: its address, and a day of the visitor's own.
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`));
    expect(readYourDays(window.localStorage)[0]).toMatchObject({
      id: REPLAN_ID,
      request: { start: "slow" },
      ending: "written",
    });
    // Seen taken here, it opens whole at its address next time.
    await waitFor(() => expect(isKeptSeen(REPLAN_ID)).toBe(true), DAY_TIMEOUT);
  });

  it("shows the merged day's rows after an energy re-picked on the day before", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    await changeWord(user, "calm", "lively");
    await waitForTheDay();

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    // The re-plan's morning, not the stops the energy was re-picked among before it.
    const rows = within(dayList()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(/^09:00\s*Shoren-in/);
    expect(rows[1]).toHaveTextContent(/^09:40\s*Awata Shrine/);
    expect(dayList()).not.toHaveTextContent(/Honen-in/);
  });

  it("says in the facts line what the fork writes and where, then what is drawn beside the day, and gives the facts back once it is taken", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    const statusText = () => document.querySelector('header p[role="status"]')?.textContent;
    const before = factsLineText();
    const lines = [before];
    const statuses = new Set<string>();
    const observer = new MutationObserver(() => {
      const now = factsLineText();
      if (now !== lines.at(-1)) lines.push(now);
      statuses.add(statusText() ?? "");
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    observer.disconnect();
    // Where the visitor looks once they have pressed: what is written and where, a press away,
    // then what stands beside the day; the facts come back once a version is taken.
    expect(lines).toEqual([
      before,
      "Writing “slow morning” for the morning ·\u00A0see it",
      "“slow morning” drawn beside the morning ·\u00A0see it",
      before,
    ]);
    expect(statuses).toContain("re-planning the morning");
  });

  it("leaves the day untouched when its proposal drops, says why on its fork row, and asks again", async () => {
    replanReplies.push({ cut: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    const before = rowTexts();
    let wasPaired = false;
    const observer = new MutationObserver(() => {
      wasPaired ||= seenTextOf(headline()).includes("early start or slow morning");
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1));
    const row = () => document.querySelector('[data-fork-row="0"]');
    await waitFor(
      () => expect(row()).toHaveTextContent(/Lantern stopped part-way|The connection dropped/),
      DAY_TIMEOUT,
    );
    observer.disconnect();
    expect(wasPaired).toBe(true);
    // The day was never touched: its word, and every row as it was, the proposal's gone; and
    // where the visitor looks, why the word came back.
    expect(headline()).toHaveTextContent("on foot, early start, early dinner");
    expect(factsLineText()).toMatch(
      /^(Lantern stopped part-way|The connection dropped), so “early start” stays ·\u00A0Ask again$/,
    );
    await waitFor(() => expect(rowTexts()).toEqual(before), DAY_TIMEOUT);

    replanReplies.push(KYOTO_SLOW_MORNING);
    await user.click(within(row() as HTMLElement).getByRole("button", { name: "Ask again" }));

    await waitFor(() => expect(replanPosts).toHaveLength(2), DAY_TIMEOUT);
    await takeProposal(user, "slow morning");
    await waitFor(() =>
      expect(headline()).toHaveTextContent("on foot, slow morning, early dinner"),
    );
  });

  it("leaves no row for a re-plan that ended without a day, and keeps one cut off by the connection", async () => {
    // Every new stop written in the afternoon, outside the morning asked for: the merge drops them.
    replanReplies.push({
      ...KYOTO_SLOW_MORNING,
      stops: KYOTO_SLOW_MORNING.stops.map((stop) => ({ ...stop, startTime: "15:00" })),
    });
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1));
    await waitFor(() => expect(keptDays()).toEqual([[KYOTO_DAY_ID, "written"]]), DAY_TIMEOUT);
    await waitForTheDay();

    // Cut off by the connection, the server writes it on to its end: it waits among the days.
    replanReplies.push({ cut: KYOTO_SLOW_MORNING, at: 0.62 });
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(replanPosts).toHaveLength(2));
    await waitFor(
      () => expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Honen-in/),
      DAY_TIMEOUT,
    );
    expect(keptDays()).toEqual([
      [REPLAN_ID, "writing"],
      [KYOTO_DAY_ID, "written"],
    ]);
  });

  it("never leaves the merged day at the day before's address when its answer names no id", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    replanId = null;
    // The day before is in the log, at its own address.
    dayIds.push(NEXT_DAY_ID);
    const user = await askForKyoto();
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`));

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    // A link copied now would open the day as it was: the address leaves the old id, as a
    // day asked again without an id does.
    await waitFor(() => expect(headline()).toHaveTextContent(/slow morning/), DAY_TIMEOUT);
    await waitFor(() => expect(window.location.pathname).not.toBe(`/day/${NEXT_DAY_ID}`));
  });

  it("keeps a re-plan of a day opened from someone's link as the visitor's own", async () => {
    window.localStorage.clear();
    replanReplies.push(KYOTO_SLOW_MORNING);
    // Someone's Kyoto day, at its own address, which this browser never asked for.
    const view = keptViewOf(
      SHARED_DAY_ID,
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
    if (view.kind !== "day") throw new Error("Someone's day lands as a day");
    const user = userEvent.setup();
    render(<Day kept={view.landing} isLive isAddressed />);
    await waitForTheDay();
    expect(readYourDays(window.localStorage)).toEqual([]);

    await changeWord(user, "early start", "slow morning");

    // Re-planning it was one of the visitor's days: the merged day is theirs, at the top.
    await waitFor(
      () => expect(readYourDays(window.localStorage)[0]).toMatchObject({ id: REPLAN_ID }),
      DAY_TIMEOUT,
    );
  });

  it("keeps no row of a proposal asked before the visitor's days were forgotten, though it lands after", async () => {
    window.localStorage.clear();
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();

    await changeWord(user, "early start", "slow morning");
    // Asked, and not yet written: its answer names it and ends after the forgetting.
    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    act(() => forgetDays());
    expect(readYourDays(window.localStorage)).toEqual([]);

    await waitFor(
      () =>
        expect(
          screen.getAllByRole("radio", { name: "slow morning Take, proposed" })[0],
        ).toBeDefined(),
      DAY_TIMEOUT,
    );
    expect(readYourDays(window.localStorage)).toEqual([]);
  });

  it("sends the place a stop shows in place of its plan, by id, so the re-plan is written around it", async () => {
    const user = await landOnKanazawa();
    // A version of the day's last stop, which a slow morning keeps.
    const versions = [...document.querySelectorAll<SVGElement>(`[${CANDIDATE_ATTRIBUTE}]`)];
    const picked = versions
      .filter((bead) => /:a\d$/.test(bead.getAttribute(CANDIDATE_ATTRIBUTE) ?? ""))
      .at(-1);
    const placeId = picked?.getAttribute(CANDIDATE_ATTRIBUTE) ?? "";
    if (picked === undefined) throw new Error("Kanazawa's last stops have versions");
    await user.click(picked);

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts[0]?.body).toMatchObject({
      picks: { [placeId.split(":")[0] ?? ""]: placeId },
    });
  });

  it("names a written day by its address, which the route reads from its own file", async () => {
    // No re-plan to answer: the route sends the word back to re-plan the whole day.
    const user = await landOnKanazawa();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts[0]?.body).toEqual({
      basis: { kind: "written", slug: "kanazawa" },
      request: expect.objectContaining({ city: "Kanazawa", start: "slow" }),
      changed: "start",
      round: 1,
      picks: {},
    });
    // A written day's city in its own zone: the whole day asked again needs no signature.
    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(dayPosts[0]?.signature).toBeNull();
  });

  it("keeps the next day in the visitor's list after a proposal taken", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);

    // A word whose re-plan is the whole day: the route answers 409 and the day is asked again.
    dayIds.push(NEXT_DAY_ID);
    await changeWord(user, "with anyone", "with family");
    await takeProposal(user, "with family");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    await waitFor(() =>
      expect(readYourDays(window.localStorage).map((day) => day.id)).toContain(NEXT_DAY_ID),
    );
  });
});

/** The options of a word's list as they read: each answer, then the line under it. */
async function optionsOf(user: ReturnType<typeof userEvent.setup>, word: string) {
  await user.click(within(headline()).getByRole("button", { name: word }));
  const options = screen.getAllByRole("option").map((option) => option.textContent ?? "");
  await user.keyboard("{Escape}");
  return options;
}

describe("a word's list once a re-plan has met our limit, with live generation on", () => {
  beforeEach(() => window.localStorage.clear());

  it("says the limit once a whole day asked again has met it", async () => {
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    // No re-plan for company here: the route sends it to the whole day, which meets the limit.
    dayReplies.push("limited");

    await changeWord(user, "with anyone", "with family");

    await waitFor(() => expect(day.current?.replan().status).toBe("failed"), DAY_TIMEOUT);
    expect(await optionsOf(user, "early dinner")).toContainEqual(`eating late${NO_MORE_REPLANS}`);
  });

  it("says the limit under every answer that would ask for a re-plan, until one is written", async () => {
    replanReplies.push("limited");
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    expect(await optionsOf(user, "early dinner")).toContainEqual(
      expect.stringMatching(/^eating latea proposal for .+ · about\u00A0half\u00A0a\u00A0minute$/),
    );

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(day.current?.replan().status).toBe("failed"), DAY_TIMEOUT);
    expect(factsLineText()).toBe("No more re-plans for now, so “early start” stays");
    const dinner = await optionsOf(user, "early dinner");
    expect(dinner).toContainEqual(`eating late${NO_MORE_REPLANS}`);
    expect(dinner.join("")).not.toMatch(/a proposal for/);
    // The energy re-picks with no call, and travel changes the word alone: neither is limited.
    const energy = await optionsOf(user, "calm");
    expect(energy.join("")).not.toContain(NO_MORE_REPLANS);
    expect(energy.some((option) => option.includes("at\u00A0once"))).toBe(true);

    // It can still be chosen, and asks: the route answers as before.
    replanReplies.push("limited");
    await changeWord(user, "early dinner", "eating late");
    await waitFor(() => expect(replanPosts).toHaveLength(2), DAY_TIMEOUT);
    await waitFor(() => expect(day.current?.replan().status).toBe("failed"), DAY_TIMEOUT);
    expect(await optionsOf(user, "early start")).toContainEqual(`slow morning${NO_MORE_REPLANS}`);

    // A re-plan written whole: the lines forecast again.
    replanReplies.push(KYOTO_SLOW_MORNING);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    const after = await optionsOf(user, "early dinner");
    expect(after.join("")).not.toContain(NO_MORE_REPLANS);
    expect(after).toContainEqual(
      expect.stringMatching(/^eating latea proposal for .+ · about\u00A0half\u00A0a\u00A0minute$/),
    );
  });
});

describe("a changed word with live generation on", () => {
  it("asks for the day again with the word changed, and writes it", async () => {
    const user = await landOnMadrid();

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    await takeProposal(user, "with family");
    // A written day's city in its own zone needs no signature.
    expect(dayPosts[0]).toEqual({
      request: { ...MADRID_START_REQUEST, company: "family" },
      signature: null,
    });
    // The day on screen holds its place until the new one's header has streamed.
    await waitFor(() => expect(headline()).toHaveTextContent(/, with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(screen.queryByText(/isn't re-planning/)).not.toBeInTheDocument();
  });

  it("re-plans whole a live day the log has not named, which the route could not read", async () => {
    const user = renderLive(
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );
    await ask(user, "Lisbon, a calm day");
    await waitForTheDay();
    dayPosts.length = 0;

    await changeWord(user, "early dinner", "eating late");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts).toEqual([]);
    expect(dayPosts[0]).toEqual({
      request: { ...LISBON, dinner: "late" },
      signature: "lisbon-signed",
    });
  });

  it("carries the city's signature, and the phrases said back, to the day asked again", async () => {
    const user = renderLive(
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: ["with my dog"],
        signed: [SIGNED_LISBON],
      }),
    );
    // The day is kept in the log, so a re-plan can name it.
    dayIds.push(NEXT_DAY_ID);
    await ask(user, "Lisbon, a calm day, with my dog");
    await waitForTheDay();
    dayPosts.length = 0;
    const struck = watchStruck(dayList());

    await changeWord(user, "early dinner", "eating late");

    // Dinner rewrites its own stretch first, of the day the route reads from its log by id,
    // with no signature; the route answers that it holds most of the day (a 409), and the
    // page asks for the whole day under the city's signature.
    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts).toHaveLength(1);
    expect(replanPosts[0]).toMatchObject({
      body: {
        basis: { kind: "kept", id: NEXT_DAY_ID },
        request: { ...LISBON, dinner: "late" },
        changed: "dinner",
        round: 1,
      },
      signature: null,
    });
    expect(dayPosts[0]).toEqual({
      request: { ...LISBON, dinner: "late" },
      signature: "lisbon-signed",
    });
    // Sent on to the whole day, the dinner's stretch was never struck and taken back.
    struck.stop();
    expect(struck.wasStruck()).toBe(false);
    await waitFor(
      () => expect(headline()).toHaveTextContent(/in Lisbon, .*eating late/),
      DAY_TIMEOUT,
    );
    await waitForTheDay();
    expect(screen.getAllByText("Lantern can't plan around “with my dog”.")[0]).toBeVisible();
  });

  it("holds the day on screen while the day asked for is on its way, and says so", async () => {
    const user = await landOnMadrid();
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    dayReplies.push("pending");

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    // Heard from the header's status, while the facts line's end stands faded.
    expect(await screen.findByText(replanningOf("with family"))).toBeInTheDocument();
    // The day is the one that was there, not drawn again, its word changed in place.
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    await waitFor(() => expect(seenTextOf(headline())).toMatch(/with family$/));
    // The day stays the visitor's while the proposal is written, to drag and swap; no
    // second word changes meanwhile.
    expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await user.click(within(headline()).getByRole("button", { name: "eating late" }));
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(dayPosts).toHaveLength(1);
  });

  it.each([
    ["our limit", "limited"],
    ["a refusal", "refused"],
    ["the route unavailable", "unavailable"],
    ["the connection failed", "offline"],
  ] as const)(
    "keeps the day as it was when the day asked for ends in %s, and says why",
    async (_, reply) => {
      const user = await landOnMadrid();
      const firstStop = within(dayList()).getAllByRole("listitem")[0];
      dayReplies.push(reply);

      await changeWord(user, "with friends", "with family");

      const kind = reply === "offline" ? "disconnected" : reply;
      expect((await screen.findAllByText(endedSaid(kind), {}, DAY_TIMEOUT))[0]).toBeInTheDocument();
      expect(screen.queryByText(replanningOf("with family"))).not.toBeInTheDocument();
      expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
      expect(headline()).toHaveTextContent(/^A lively Sunday in Madrid.*with friends$/);
      expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
      );
    },
  );

  it("asks again from a day it kept, and writes the new one", async () => {
    const user = await landOnMadrid();
    dayReplies.push("unavailable");
    await changeWord(user, "with friends", "with family");
    await screen.findAllByText(endedSaid("unavailable"), {}, DAY_TIMEOUT);

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(2), DAY_TIMEOUT);
    await takeProposal(user, "with family");
    await waitFor(() => expect(headline()).toHaveTextContent(/, with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(screen.queryAllByText(endedSaid("unavailable"))).toEqual([]);
  });

  // `docs/decisions.md`, "A day has at least one stop".
  it("asks once more for a day that came back empty, holding the day on screen meanwhile", async () => {
    const user = await landOnMadrid();
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    dayReplies.push("empty", "pending");

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(2), DAY_TIMEOUT);
    expect(dayPosts[1]).toEqual(dayPosts[0]);
    // The empty day never took the page: the day asked from is still the one drawn.
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    await waitFor(() =>
      expect(seenTextOf(headline())).toMatch(/^A lively Sunday in Madrid.*with family$/),
    );
    expect(screen.getByText(replanningOf("with family"))).toBeInTheDocument();
    expect(screen.queryByText(UNFINISHED, { exact: false })).not.toBeInTheDocument();
  });

  it("writes the day asked for again once it streams, after an empty one", async () => {
    const user = await landOnMadrid();
    dayReplies.push("empty");

    await changeWord(user, "with friends", "with family");
    await takeProposal(user, "with family");

    await waitFor(() => expect(headline()).toHaveTextContent(/, with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(dayPosts).toHaveLength(2);
    expect(screen.queryByText(UNFINISHED, { exact: false })).not.toBeInTheDocument();
  });

  it("keeps the day as it was when the day asked for comes back empty twice, and says why", async () => {
    const user = await landOnMadrid();
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    dayReplies.push("empty", "empty");

    await changeWord(user, "with friends", "with family");

    expect(
      (await screen.findAllByText(endedSaid("invalid"), {}, DAY_TIMEOUT))[0],
    ).toBeInTheDocument();
    expect(dayPosts).toHaveLength(2);
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    expect(headline()).toHaveTextContent(/^A lively Sunday in Madrid.*with friends$/);
  });

  it("re-picks the energy among the versions written, asking for no day", async () => {
    const user = await landOnKanazawa();

    await changeWord(user, "calm", "lively");

    expect(headline()).toHaveTextContent(/^A lively Saturday in Kanazawa/);
    expect(dayPosts).toEqual([]);
  });
});
