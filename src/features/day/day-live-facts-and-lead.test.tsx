import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import { isLeadSeen, LEAD_DUE_MS, watchLead } from "./lead-on-screen";
import { keptViewOf } from "./kept-day";
import { CANDIDATE_ATTRIBUTE } from "@/features/abacus/chart-stop";
import { KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import { KYOTO_LATE_EVENING } from "@/lib/fixtures/replan/kyoto-evening";
import { Day, type DayHandle } from "./day";
import {
  DAY_TIMEOUT,
  dayReplies,
  replanPosts,
  replanReplies,
  dayIds,
  REPLAN_ID,
  SHARED_DAY_ID,
  KYOTO_KEPT,
  KYOTO_DAY_ID,
  NEXT_DAY_ID,
  headline,
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

/**
 * What the header says of a live day: what a later change sets aside, once, in the facts line,
 * and the line about the day, led as first planned only once a stop has changed.
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

/** What the header's status says to a screen reader. */
const statusText = () => document.querySelector('header p[role="status"]')?.textContent ?? "";

/** Every line the facts line shows, and every status said, from now until it stops. */
function watchFactsLine(): { lines: (string | null)[]; statuses: string[]; stop: () => void } {
  const lines = [factsLineText()];
  const statuses = [statusText()];
  const observer = new MutationObserver(() => {
    const line = factsLineText();
    if (line !== lines.at(-1)) lines.push(line);
    const status = statusText();
    if (status !== statuses.at(-1)) statuses.push(status);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  return { lines, statuses, stop: () => observer.disconnect() };
}

/** Longer than the set-aside note stands before the new word's own note takes its place. */
const SET_ASIDE_SAID_MS = 2800;

const WRITING_OUT_LATE = /^Writing “out late” for .+ · see it$/;

describe("what a later change sets aside, said once in the facts line, with live generation on", () => {
  beforeEach(() => window.localStorage.clear());

  /** Kyoto's morning proposed whole beside the day, kept among the visitor's days if named. */
  async function proposeSlowMorning(): Promise<{
    user: ReturnType<typeof userEvent.setup>;
    day: ReturnType<typeof createRef<DayHandle>>;
  }> {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    return { user, day };
  }

  it("says a proposal not taken is set aside among the visitor's days, then what the next word writes", async () => {
    const { user } = await proposeSlowMorning();
    await waitFor(() => expect(keptDays()).toContainEqual([REPLAN_ID, "written"]));
    replanReplies.push({ held: KYOTO_LATE_EVENING, at: 0.62 });
    replanId = NEXT_DAY_ID;
    const watch = watchFactsLine();

    await changeWord(user, "home by eight", "out late");

    expect(factsLineText()).toBe("“slow morning” set aside · it is in your days");
    await waitFor(() => expect(factsLineText()).toMatch(WRITING_OUT_LATE), {
      timeout: SET_ASIDE_SAID_MS + 1000,
    });
    watch.stop();
    // Said once, then the new word's own note, one at a time in the line's place.
    expect(watch.lines.slice(1)).toEqual([
      "“slow morning” set aside · it is in your days",
      expect.stringMatching(WRITING_OUT_LATE),
    ]);
    // Heard once, with what the new word re-plans, in one line that stays as the note steps on.
    const heard = watch.statuses.filter((status) => status.includes("set aside"));
    expect(heard).toEqual([
      expect.stringMatching(/^“slow morning” set aside, it is in your days; re-planning /),
    ]);
    expect(statusText()).toBe(heard[0]);
    expect(keptDays()).toContainEqual([REPLAN_ID, "written"]);
  });

  it("says a proposal whose answer named no id is not kept", async () => {
    replanId = null;
    const { user } = await proposeSlowMorning();
    replanReplies.push({ held: KYOTO_LATE_EVENING, at: 0.62 });

    await changeWord(user, "home by eight", "out late");

    expect(factsLineText()).toBe("“slow morning” not kept");
    expect(statusText()).toMatch(/^“slow morning” not kept; re-planning /);
  });

  it("says the day before a proposal taken is set aside among the visitor's days, where it keeps its row", async () => {
    const { user, day } = await proposeSlowMorning();
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitForTheDay();
    replanReplies.push({ held: KYOTO_LATE_EVENING, at: 0.62 });
    replanId = NEXT_DAY_ID;

    await changeWord(user, "home by eight", "out late");

    expect(factsLineText()).toBe("“early start” set aside · it is in your days");
    expect(keptDays()).toContainEqual([KYOTO_DAY_ID, "written"]);
    expect(keptDays()).toContainEqual([REPLAN_ID, "written"]);
  });

  it("says a day before with an id the visitor's list does not hold is not among their days", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING, { held: KYOTO_LATE_EVENING, at: 0.62 });
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
    const day = createRef<DayHandle>();
    const user = userEvent.setup();
    render(<Day kept={view.landing} isLive isAddressed ref={day} />);
    await waitForTheDay();
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitForTheDay();
    replanId = NEXT_DAY_ID;

    await changeWord(user, "home by eight", "out late");

    // It still opens at its link, so it is not "not kept"; but nothing on the page leads back.
    expect(factsLineText()).toBe("“early start” set aside · not in your days");
    expect(statusText()).toMatch(/^“early start” set aside, not in your days; re-planning /);
    expect(keptDays().map(([id]) => id)).not.toContain(SHARED_DAY_ID);
  });

  /** Kyoto's morning proposed, then taken, the day before beside it. */
  async function takeSlowMorning(): Promise<ReturnType<typeof userEvent.setup>> {
    const { user, day } = await proposeSlowMorning();
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("taken"), DAY_TIMEOUT);
    await waitForTheDay();
    return user;
  }

  it("says alone what an energy re-pick set aside of a fork answered, until the visitor next acts on the day", async () => {
    const user = await takeSlowMorning();

    await changeWord(user, "calm", "lively");

    expect(factsLineText()).toBe("“early start” set aside · it is in your days");
    expect(statusText()).toBe("“early start” set aside, it is in your days");
    await waitForTheDay();
    // No new word's note follows it: it stands.
    await new Promise((resolve) => setTimeout(resolve, SET_ASIDE_SAID_MS));
    expect(factsLineText()).toBe("“early start” set aside · it is in your days");

    // A pull of the curve is the next act: the line is the facts again, the status quiet.
    const slider = screen.getAllByRole("slider").at(-1);
    if (slider === undefined) throw new Error("Kyoto's day has stops on its curve");
    slider.focus();
    await user.keyboard("{ArrowLeft}");

    await waitFor(() => expect(factsLineText()).toMatch(/sunrise/));
    expect(factsLineText()).not.toContain("set aside");
    expect(statusText()).not.toContain("set aside");
  });

  it("lets the next energy press take the note away, setting nothing more aside", async () => {
    const user = await takeSlowMorning();
    await changeWord(user, "calm", "lively");
    expect(factsLineText()).toContain("set aside");
    await waitForTheDay();

    await changeWord(user, "lively", "calm");

    expect(factsLineText()).not.toContain("set aside");
    expect(statusText()).not.toContain("set aside");
  });

  it("says nothing set aside when a failed proposal is asked again", async () => {
    replanReplies.push({ cut: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("failed"), DAY_TIMEOUT);
    replanReplies.push({ held: KYOTO_SLOW_MORNING, at: 0.62 });
    const watch = watchFactsLine();

    act(() => day.current?.replan().askAgain());

    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));
    watch.stop();
    expect(watch.lines.some((line) => /set aside|not kept/.test(line ?? ""))).toBe(false);
    expect(watch.statuses.some((status) => /set aside|not kept/.test(status))).toBe(false);
  });

  it("says nothing of a written day before a taken whole day, which stays at its own address", async () => {
    const user = await landOnMadrid();
    dayReplies.push(MADRID_START_REQUEST);
    await changeWord(user, "with friends", "with family");
    await takeProposal(user, "with family");
    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    const bar = screen.getByRole("group", { name: "How lively the day is" });
    const other = within(bar)
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-pressed") === "false");
    if (other === undefined) throw new Error("Madrid's bar has another energy");

    await user.click(other);

    expect(factsLineText()).not.toMatch(/set aside|not kept/);
    expect(statusText()).not.toMatch(/set aside|not kept/);
  });
});

/** The bead of the day's last version, on a stop a slow morning keeps. */
function lastVersionBead(): SVGElement {
  const version = [...document.querySelectorAll<SVGElement>(`[${CANDIDATE_ATTRIBUTE}]`)]
    .filter((bead) => /:a\d$/.test(bead.getAttribute(CANDIDATE_ATTRIBUTE) ?? ""))
    .at(-1);
  if (version === undefined) throw new Error("Kyoto's last stops have versions");
  return version;
}

describe("the line about the day, led as first planned only once a stop has changed", () => {
  beforeEach(() => window.localStorage.clear());

  it("takes no lead at a changed word's press nor while its proposal is written", async () => {
    replanReplies.push({ held: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const wasLeadSeen = watchLead();

    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));
    await act(() => new Promise((resolve) => setTimeout(resolve, LEAD_DUE_MS)));

    expect(wasLeadSeen()).toBe(false);
  });

  it("takes no lead while the proposal stands whole beside the day, nor once it is taken", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const wasLeadSeen = watchLead();

    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    await act(() => new Promise((resolve) => setTimeout(resolve, LEAD_DUE_MS)));
    expect(wasLeadSeen()).toBe(false);

    // Taken, the line is the proposal's, written around the day it makes: they agree again.
    const wasLeadSeenTaken = watchLead();
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    await act(() => new Promise((resolve) => setTimeout(resolve, LEAD_DUE_MS)));
    expect(isLeadSeen()).toBe(false);
    expect(wasLeadSeenTaken()).toBe(false);
  });

  it("takes no lead once a proposal is taken over a stop the visitor swapped, which its line names", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const version = lastVersionBead();
    await user.click(version);
    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);

    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    await act(() => new Promise((resolve) => setTimeout(resolve, LEAD_DUE_MS)));

    expect(replanPosts[0]?.body.picks).toEqual({
      [version.getAttribute(CANDIDATE_ATTRIBUTE)!.split(":")[0]!]:
        version.getAttribute(CANDIDATE_ATTRIBUTE),
    });
    expect(isLeadSeen()).toBe(false);
  });

  it("leads the line taken from a proposal once an energy pressed while it stood changes a stop", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    const before = rowTexts();

    // The proposal's line is written for the energy at the word's press.
    await changeWord(user, "calm", "lively");
    expect(rowTexts()).not.toEqual(before);
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();

    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);
  });

  it("takes no lead from a proposal asked after an energy re-pick, which plans the stops it kept as they showed", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "calm", "lively");
    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);
    const kept = rowTexts().slice(2);

    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    await act(() => new Promise((resolve) => setTimeout(resolve, LEAD_DUE_MS)));

    expect(rowTexts().slice(2)).toEqual(kept);
    expect(isLeadSeen()).toBe(false);
  });

  it("leads the line taken from a proposal once a stop it kept is swapped while it stood", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);

    // The proposal plans the kept stop as it showed at the press, and its line names that.
    await user.click(lastVersionBead());
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();

    expect(replanPosts[0]?.body.picks).toEqual({});
    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);
  });

  it("leads the day taken back again where a stop shows a version, as it did before", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await user.click(lastVersionBead());
    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    await waitFor(() => expect(isLeadSeen()).toBe(false), DAY_TIMEOUT);

    await takeBack(user, "early start");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`), DAY_TIMEOUT);

    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);
  });

  it("leads the line once an energy re-pick changes a stop", async () => {
    const user = await askForKyoto();
    const before = rowTexts();

    await changeWord(user, "calm", "lively");

    expect(rowTexts()).not.toEqual(before);
    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);
  });

  it("takes no lead for an energy re-pick that changes no stop", async () => {
    // Madrid's lively day re-picked balanced shows every stop it showed.
    const user = await landOnMadrid();
    const before = rowTexts();
    await user.click(within(headline()).getByRole("button", { name: "lively" }));
    const keeping = screen.getByRole("option", { name: /^balanced/ });
    expect(keeping).toHaveTextContent("keeps every stop");
    const wasLeadSeen = watchLead();

    await user.click(keeping);
    await act(() => new Promise((resolve) => setTimeout(resolve, LEAD_DUE_MS)));

    expect(headline()).toHaveTextContent(/^A balanced /);
    expect(rowTexts()).toEqual(before);
    expect(wasLeadSeen()).toBe(false);
  });

  it("leads the line once a swap shows another place", async () => {
    const user = await askForKyoto();
    const version = [...document.querySelectorAll<SVGElement>(`[${CANDIDATE_ATTRIBUTE}]`)].find(
      (bead) => /:a\d$/.test(bead.getAttribute(CANDIDATE_ATTRIBUTE) ?? ""),
    );
    if (version === undefined) throw new Error("Kyoto's stops have versions");

    await user.click(version);

    await waitFor(() => expect(isLeadSeen()).toBe(true), DAY_TIMEOUT);
  });
});
