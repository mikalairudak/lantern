import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { PORTLAND_MAINE, PORTLAND_OREGON } from "@/lib/fixtures/city-readings";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import type { IntakeRouteAnswer } from "@/lib/intake/signed-city";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import { KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import { Day, type DayHandle } from "./day";
import { isKeptSeen } from "./seen-days";
import { readIntakeRoute } from "./intake-route";
import { replanningOf, UNFINISHED } from "./not-yet";
import { NOT_LIVE_NOTE } from "./start-header";
import { INDEX_LABEL } from "./start-index";
import { YOUR_DAYS_HEADING } from "./your-days-ledger-words";
import { TAKE_THIS_DAY } from "./day-menu";
import { ONE_CHANGE_AT_A_TIME } from "./day-stage-header";
import { sendProductEvent } from "@/lib/events/send-event";
import {
  DAY_TIMEOUT,
  POOL,
  LISBON,
  SIGNED_LISBON,
  SIGNED_KYOTO,
  NO_WORDS,
  intakeReplies,
  dayReplies,
  intakeTexts,
  dayPosts,
  replanReplies,
  dayIds,
  REPLAN_ID,
  KYOTO_DAY_ID,
  NEXT_DAY_ID,
  answerRoutes,
  headline,
  dayList,
  saysBack,
  renderLive,
  ask,
  answered,
  waitForTheDay,
  landOnKanazawa,
  factsLineText,
  askForKyoto,
  changeWord,
  takeProposal,
  stubLiveRoutes,
  forgetLiveAsks,
  unstubLiveRoutes,
} from "./day-live-harness";

/**
 * The start screen with live generation on: the intake's reading, a first day that comes back
 * empty, the city word, and one of the visitor's days pressed while another is on its way.
 */

// The product's events, caught where a page that counts them sends them.
vi.mock("@/lib/events/send-event", () => ({ sendProductEvent: vi.fn() }));

beforeAll(() => stubLiveRoutes());
beforeEach(forgetLiveAsks);
afterAll(unstubLiveRoutes);

describe("the start screen with live generation on", () => {
  it("says nothing under the question about whether Lantern writes", () => {
    renderLive();

    expect(screen.queryByText(NOT_LIVE_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByText(/one place at a time/)).not.toBeInTheDocument();
  });

  it("sends the text to the intake, and writes the day it read under the city's signature", async () => {
    const user = renderLive(
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: ["with my dog"],
        signed: [SIGNED_LISBON],
      }),
    );

    await ask(user, "Lisbon, a calm day, with my dog");

    expect(intakeTexts).toEqual(["Lisbon, a calm day, with my dog"]);
    await waitFor(
      () => expect(headline()).toHaveTextContent(/^A calm Saturday in Lisbon/),
      DAY_TIMEOUT,
    );
    expect(screen.getAllByText("Lantern can't plan around “with my dog”.")[0]).toBeVisible();
    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(dayPosts).toEqual([{ request: LISBON, signature: "lisbon-signed" }]);
    // A day Lantern has not written word for word keeps the start screen's address.
    expect(window.location.pathname).toBe("/");
  });

  it("asks which city a shared name is, and writes the one chosen under its own signature", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [PORTLAND_OREGON, PORTLAND_MAINE],
        words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
        unplaced: [],
        signed: [
          { city: "Portland", timezone: PORTLAND_OREGON.timezone, signature: "oregon-signed" },
          { city: "Portland", timezone: PORTLAND_MAINE.timezone, signature: "maine-signed" },
        ],
      }),
    );

    await ask(user, "Portland, a lively day");
    await user.click(await screen.findByRole("button", { name: /^Portland, Maine/ }));

    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({ city: "Portland", timezone: PORTLAND_MAINE.timezone }),
        signature: "maine-signed",
      },
    ]);
  });

  it("reads a city typed for the question through the intake, keeping the words it read", async () => {
    // The Saturday the intake's answer is dated on: a day already over would be planned for today.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "calm", energySource: "chosen", company: "family" },
        unplaced: [],
      }),
      answered({
        kind: "request",
        request: { ...LISBON, energy: "balanced", energySource: "assumed" },
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );

    await ask(user, "a calm day with my kids");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Lisbon{Enter}");

    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(intakeTexts).toEqual(["a calm day with my kids", "Lisbon"]);
    expect(headline()).toHaveTextContent(/^A calm Saturday in Lisbon, .*with family$/);
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({ city: "Lisbon", energy: "calm", company: "family" }),
        signature: "lisbon-signed",
      },
    ]);
  });

  it("keeps the city asked for, its answer in the field, after Forward to the day behind stops the answer's reading", async () => {
    intakeReplies.push(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, company: "family" },
        unplaced: [],
      }),
      "pending",
    );
    const user = userEvent.setup();
    render(<Day start={{ pool: POOL, read: readIntakeRoute }} isLive isAddressed />);
    const index = screen.getByRole("list", { name: INDEX_LABEL });
    await user.click(within(index).getByRole("button", { name: /^Paris / }));
    await waitFor(() => expect(window.location.pathname).toBe("/day/paris"), DAY_TIMEOUT);
    await waitForTheDay();
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    await ask(user, "a day with my kids");
    const city = await screen.findByRole("textbox", { name: "Which city?" });
    await user.type(city, "Lyon{Enter}");
    await waitFor(() => expect(city).toHaveAttribute("readonly"));

    act(() => window.history.forward());
    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

    // The reading stopped, the question stands as it did before the answer, which the field
    // keeps, so the next press answers it again rather than read "Lyon" as a text of its own.
    const field = screen.getByRole("textbox", { name: "Which city?" });
    expect(field).toHaveValue("Lyon");
    expect(field).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Plan this day" })).toBeInTheDocument();
    expect(intakeTexts).toEqual(["a day with my kids", "Lyon"]);
  });

  it("plans a day the question's text named, already over in the city typed, for today there", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        // "Today", read against a visitor's own date that the city is already past.
        words: { ...NO_WORDS, date: "2020-01-01" },
        unplaced: [],
      }),
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );

    await ask(user, "a day today");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Lisbon{Enter}");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(dayPosts[0]?.request).toMatchObject({ city: "Lisbon", date: "2026-11-14" });
  });

  it("names the weekday the day is planned for in the question's sentence once its city is answered", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // A Saturday.
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    // The day stays on its way, so the sentence stands with its answer.
    dayReplies.push("pending");
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        // A Friday, already over in the city.
        words: { ...NO_WORDS, date: "2026-11-13" },
        unplaced: [],
      }),
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );

    await ask(user, "a day today");
    const field = await screen.findByRole("textbox", { name: "Which city?" });
    // Until the city is known, the sentence says the day the text named.
    expect(screen.getAllByText("Friday").length).toBeGreaterThan(0);
    await user.type(field, "Lisbon{Enter}");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(dayPosts[0]?.request).toMatchObject({ date: "2026-11-14" });
    expect(screen.queryByText("Friday")).not.toBeInTheDocument();
    expect(screen.getAllByText("Saturday").length).toBeGreaterThan(0);
  });

  it("reads the answer to the question in the city's own field, under the question", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "calm", energySource: "chosen", company: "family" },
        unplaced: [],
      }),
      "pending",
    );

    await ask(user, "a calm day with my kids");
    const field = await screen.findByRole("textbox", { name: "Which city?" });
    await user.type(field, "Lisbon{Enter}");

    // Named from the press; the field takes no keys once the line says the answer is read.
    await screen.findByRole("button", { name: "Reading" });
    expect(screen.getByRole("textbox", { name: "Which city?" })).toBe(field);
    expect(field).toHaveValue("Lisbon");
    await waitFor(() => expect(field).toHaveAttribute("readonly"));
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "A calm day in Lisbon, with family",
      ),
    ).toBeInTheDocument();
  });

  it("gives the field back the focus when the answer to the question plays no day", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "calm", energySource: "chosen" },
        unplaced: [],
      }),
      answered({ kind: "refused" }),
    );

    await ask(user, "a calm day");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Atlantis{Enter}");

    await saysBack("Lantern can't plan that day. Start from one of the days below.");
    expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toHaveFocus();
  });

  it("keeps an answer to the question that names no city in the field, and says it was not found", async () => {
    const noCity = answered({
      kind: "question",
      key: "city",
      readings: [],
      words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
      unplaced: [],
    });
    const user = renderLive(noCity, noCity);

    await ask(user, "a lively day");
    const field = await screen.findByRole("textbox", { name: "Which city?" });
    await user.type(field, "Springfeld{Enter}");

    await saysBack("Lantern couldn't find “Springfeld”. Name a city, or pick a day below.");
    expect(screen.getByRole("textbox", { name: "Which city?" })).toBe(field);
    expect(field).toHaveValue("Springfeld");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(intakeTexts).toEqual(["a lively day", "Springfeld"]);
  });

  it("asks for any city again, quoting no answer, after Forward to the day behind stops the reading of an answer to the question asked again", async () => {
    const noCity = answered({
      kind: "question",
      key: "city",
      readings: [],
      words: { ...NO_WORDS, company: "family" },
      unplaced: [],
    });
    intakeReplies.push(noCity, noCity, "pending");
    const user = userEvent.setup();
    render(<Day start={{ pool: POOL, read: readIntakeRoute }} isLive isAddressed />);
    const index = screen.getByRole("list", { name: INDEX_LABEL });
    await user.click(within(index).getByRole("button", { name: /^Paris / }));
    await waitFor(() => expect(window.location.pathname).toBe("/day/paris"), DAY_TIMEOUT);
    await waitForTheDay();
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    await ask(user, "a day with my kids");
    const city = await screen.findByRole("textbox", { name: "Which city?" });
    await user.type(city, "Lyonn{Enter}");
    await saysBack("Lantern couldn't find “Lyonn”. Name a city, or pick a day below.");
    await user.type(city, "{Backspace}{Enter}");
    await waitFor(() => expect(city).toHaveAttribute("readonly"));

    act(() => window.history.forward());
    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

    // The answer under way was never looked for, so no answer is quoted as not found.
    expect(screen.getByRole("textbox", { name: "Which city?" })).toHaveValue("Lyon");
    expect(screen.queryByText(/^Lantern couldn't find/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Lantern needs a city to plan the day. Name one, or pick a day below."),
    ).toBeInTheDocument();
    expect(intakeTexts).toEqual(["a day with my kids", "Lyonn", "Lyon"]);
  });

  it("empties the field for the cities a name could be, when the answer to the question finds several", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
        unplaced: [],
      }),
      answered({
        kind: "question",
        key: "city",
        readings: [PORTLAND_OREGON, PORTLAND_MAINE],
        words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
        unplaced: [],
      }),
    );

    await ask(user, "a lively day");
    const field = await screen.findByRole("textbox", { name: "Which city?" });
    await user.type(field, "Portland{Enter}");

    await screen.findByRole("button", { name: "Portland, Oregon, United States" });
    expect(field).toHaveValue("");
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/^Lantern couldn't find/)).not.toBeInTheDocument();
  });

  it("reads nothing at a press with the field empty, and says what is missing", async () => {
    const user = renderLive();

    await user.click(screen.getByRole("button", { name: "Plan this day" }));

    const field = screen.getByRole("textbox", { name: "Where, and anything else" });
    expect(field).toHaveFocus();
    expect(screen.getByText("Name a city, or pick a day below.", { selector: "p" })).toBeVisible();
    expect(intakeTexts).toEqual([]);
  });

  it("plays a written city typed for the question without a second read", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
        unplaced: [],
      }),
    );

    await ask(user, "a lively day");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Kanazawa{Enter}");

    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(intakeTexts).toEqual(["a lively day"]);
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({ city: "Kanazawa", energy: "lively" }),
        signature: null,
      },
    ]);
  });

  it.each([
    ["refused", answered({ kind: "refused" }), "Lantern can't plan that day."],
    [
      "limited, our own limit's 429",
      answered({ kind: "limited" }, 429),
      "Lantern has written all the days it can for now.",
    ],
    [
      "unavailable, a 503",
      answered({ kind: "unavailable" }, 503),
      "Lantern couldn't read that just now.",
    ],
    // A deploy without its key or salt answers as an intake that could not run.
    [
      "misconfigured, the same 503",
      answered({ kind: "unavailable" }, 503),
      "Lantern couldn't read that just now.",
    ],
    ["a lost connection", "offline" as const, "Lantern couldn't read that just now."],
  ])(
    "says an intake answered %s in its own words, and writes no day",
    async (_name, reply, said) => {
      const user = renderLive(reply);

      await ask(user, "Amsterdam");

      expect(await saysBack(`${said} Start from one of the days below.`)).toBeVisible();
      expect(screen.getByRole("textbox")).toHaveValue("Amsterdam");
      expect(dayPosts).toEqual([]);
    },
  );

  it("answers a body that is not an intake answer as a reading that could not run", async () => {
    const user = renderLive(answered({ kind: "nonsense" } as unknown as IntakeRouteAnswer));

    await ask(user, "Amsterdam");

    expect(
      await saysBack("Lantern couldn't read that just now. Start from one of the days below."),
    ).toBeVisible();
  });
});

// `docs/decisions.md`, "A day has at least one stop".
describe("a first day that comes back empty, with live generation on", () => {
  const ASKED_FOR_LISBON = answered({
    kind: "request",
    request: LISBON,
    readings: [],
    unplaced: [],
    signed: [SIGNED_LISBON],
  });

  it("is asked for once more under the same signature, and written", async () => {
    const user = renderLive(ASKED_FOR_LISBON);
    dayReplies.push("empty");

    await ask(user, "Lisbon, a calm day");

    await waitForTheDay();
    expect(dayPosts).toEqual([
      { request: LISBON, signature: "lisbon-signed" },
      { request: LISBON, signature: "lisbon-signed" },
    ]);
    expect(screen.queryByText(UNFINISHED, { exact: false })).not.toBeInTheDocument();
  });

  it("holds what the empty day wrote, and its city word the focus, while it is asked again", async () => {
    const user = renderLive(ASKED_FOR_LISBON);
    dayReplies.push("empty", "pending");

    await ask(user, "Lisbon, a calm day");

    // The empty day takes the page as any first day does, its city word the focus.
    // The line about the day is set unseen too, to measure its room: any copy is the line.
    expect(await screen.findAllByText(KYOTO_DAY.day.dek, {}, DAY_TIMEOUT)).not.toHaveLength(0);
    await waitFor(() => expect(document.activeElement?.closest("h1")).not.toBeNull());
    const city = document.activeElement;
    await waitFor(() => expect(dayPosts).toHaveLength(2), DAY_TIMEOUT);

    // Asked again, the day is never drawn from its empty frame: its line about the day stays,
    // and the city word that took the focus keeps it, rather than another taking it again.
    expect(screen.queryAllByText(KYOTO_DAY.day.dek)).not.toHaveLength(0);
    expect(city?.isConnected).toBe(true);
    expect(document.activeElement).toBe(city);
  });

  it("says Lantern couldn't finish it when it comes back empty again, asking no third time", async () => {
    const user = renderLive(ASKED_FOR_LISBON);
    dayReplies.push("empty", "empty");

    await ask(user, "Lisbon, a calm day");

    expect(await screen.findByText(UNFINISHED, { exact: false }, DAY_TIMEOUT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write it again" })).toBeVisible();
    expect(dayPosts).toHaveLength(2);
  });
});

describe("the city word with live generation on", () => {
  async function typeCity(user: ReturnType<typeof userEvent.setup>, city: string): Promise<void> {
    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /New day/ }));
    await user.keyboard(`${city}{Enter}`);
  }

  it("reads a city typed there through the intake, and writes its day under its signature", async () => {
    const user = await landOnKanazawa(
      answered({
        kind: "request",
        request: { ...LISBON, energy: "balanced" },
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );

    await typeCity(user, "Lisbon");

    await waitFor(() => expect(headline()).toHaveTextContent(/in Lisbon/), DAY_TIMEOUT);
    expect(intakeTexts).toEqual(["Lisbon"]);
    // The day's own words stay, in the zone the intake found.
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({
          city: "Lisbon",
          timezone: "Europe/Lisbon",
          energy: KANAZAWA_START_REQUEST.energy,
        }),
        signature: "lisbon-signed",
      },
    ]);
  });

  it("gives a live day asked from another day one entry, at the start screen's address until its answer names its id", async () => {
    intakeReplies.push(
      answered({
        kind: "request",
        request: { ...LISBON, energy: "balanced" },
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} isLive isAddressed />);
    await waitForTheDay();
    await waitFor(() => expect(window.location.pathname).toBe("/day/kanazawa"));
    const withKanazawa = window.history.length;
    // Lisbon's answer, which names its row in the log, comes only once released.
    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (path, init) => {
      if (path === DAY_ROUTE) await released;
      return answerRoutes(String(path), init ?? {});
    });
    onTestFinished(() => {
      vi.mocked(fetch).mockImplementation(async (path, init) =>
        answerRoutes(String(path), init ?? {}),
      );
    });
    dayIds.push(NEXT_DAY_ID);

    await typeCity(user, "Lisbon");

    // Asked, and no answer yet: the start screen's address, in an entry of its own.
    await waitFor(() => expect(window.location.pathname).toBe("/"), DAY_TIMEOUT);
    expect(intakeTexts).toEqual(["Lisbon"]);
    expect(window.history.length).toBe(withKanazawa + 1);
    release();
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    // Named and stored, the same entry: Back goes to the day it was asked from.
    expect(window.history.length).toBe(withKanazawa + 1);

    act(() => window.history.back());

    await waitFor(() => expect(headline()).toHaveTextContent(/in Kanazawa/), DAY_TIMEOUT);
    expect(window.location.pathname).toBe("/day/kanazawa");
    expect(dayPosts).toHaveLength(2);
  });

  it("plays a name that could mean several cities as the likeliest, Lantern's assumption", async () => {
    const user = await landOnKanazawa(
      answered({
        kind: "question",
        key: "city",
        readings: [PORTLAND_OREGON, PORTLAND_MAINE],
        words: NO_WORDS,
        unplaced: [],
        signed: [
          { city: "Portland", timezone: PORTLAND_OREGON.timezone, signature: "oregon-signed" },
        ],
      }),
    );

    await typeCity(user, "Portland");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(dayPosts[0]).toEqual({
      request: expect.objectContaining({
        city: "Portland",
        citySource: "assumed",
        timezone: PORTLAND_OREGON.timezone,
      }),
      signature: "oregon-signed",
    });
  });

  it("says in the word's list that a typed city is read, and stops reading it when the list closes", async () => {
    const user = await landOnKanazawa("pending");

    await typeCity(user, "Lisbon");

    const list = await screen.findByRole("group", { name: "Where" });
    expect(within(list).getByRole("status")).toHaveTextContent("Reading");
    expect(within(list).getByRole("textbox", { name: "Somewhere else" })).toHaveValue("Lisbon");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("group", { name: "Where" })).toBeNull());
    expect(intakeTexts).toEqual(["Lisbon"]);
    expect(dayPosts).toEqual([]);
    expect(headline()).toHaveTextContent(/in Kanazawa/);
  });

  it.each([
    [
      "no city",
      answered({ kind: "question", key: "city", readings: [], words: NO_WORDS, unplaced: [] }),
      "Lantern needs a city to plan the day.",
    ],
    ["refused", answered({ kind: "refused" }), "Lantern can't plan that day."],
    [
      "limited",
      answered({ kind: "limited" }, 429),
      "Lantern has written all the days it can for now.",
    ],
    ["offline", "offline" as const, "Lantern couldn't read that just now."],
  ])(
    "says in the word's list why a city the intake answered %s plays no day, and keeps the day",
    async (_name, reply, why) => {
      const user = await landOnKanazawa(reply);

      await typeCity(user, "Atlantis");

      const list = await screen.findByRole("group", { name: "Where" });
      await waitFor(() => expect(within(list).getByRole("status")).toHaveTextContent(why));
      const field = within(list).getByRole("textbox", { name: "Somewhere else" });
      expect(field).toHaveValue("Atlantis");
      expect(field).not.toHaveAttribute("readonly");
      expect(dayPosts).toEqual([]);
      expect(headline()).toHaveTextContent(/in Kanazawa/);
    },
  );
});

describe("a day the log keeps, with live generation on", () => {
  it("is seen by its id once watched to its end here, so its address opens it whole", async () => {
    dayIds.push(NEXT_DAY_ID);
    await askForKyoto();
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`));

    expect(isKeptSeen(NEXT_DAY_ID)).toBe(true);
  });
});

describe("one of the visitor's days pressed while a day asked on the start screen is on its way, with live generation on", () => {
  /** A written city pressed on the start screen, held on its way until the page lets it go. */
  async function pressRomeHeld(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    vi.mocked(fetch).mockImplementationOnce(
      (_, init) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The day was stopped", "AbortError")),
          ),
        ),
    );
    const index = screen.getByRole("list", { name: INDEX_LABEL });
    await user.click(within(index).getByRole("button", { name: /^Rome / }));
    // On its way: the start screen says it back, and its field waits for it.
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toHaveAttribute(
        "readonly",
      ),
    );
    expect(headline()).toHaveTextContent(/^One day in a city/);
  }

  /** The row in "Your days" whose words match, the only one. */
  async function yourDay(name: RegExp): Promise<HTMLElement> {
    const yours = await screen.findByRole("list", { name: YOUR_DAYS_HEADING });
    const [row, ...others] = within(yours)
      .getAllByRole("link")
      .filter((link) => name.test(link.textContent ?? ""));
    expect(others).toEqual([]);
    return row!;
  }

  it("brings back a day held while its whole day was written again, free to change once more", async () => {
    const day = createRef<DayHandle>();
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
    const user = await askForKyoto(day);
    dayReplies.push("held");
    await changeWord(user, "with anyone", "with family");
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"), DAY_TIMEOUT);
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    await pressRomeHeld(user);

    await user.click(await yourDay(/^(?!.*with family).*Kyoto/));

    await waitFor(() => expect(headline()).toHaveTextContent(/Kyoto/));
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    // The whole day asked again was let go with the day it was asked from: nothing says it is
    // written, and a word changes again.
    expect(screen.queryByText(replanningOf("with family"))).not.toBeInTheDocument();
    expect(factsLineText() ?? "").not.toContain(ONE_CHANGE_AT_A_TIME);
    await user.click(within(headline()).getByRole("button", { name: "early start" }));
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  }, 20_000);

  it("tells nothing of a whole day still written again as its day's row is pressed, nothing else on its way", async () => {
    const day = createRef<DayHandle>();
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
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
    render(
      <Day start={{ pool: POOL, read: readIntakeRoute }} isLive isAddressed isCounted ref={day} />,
    );
    await ask(user, "Kyoto");
    await waitForTheDay();
    dayReplies.push("held");
    await changeWord(user, "with anyone", "with family");
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"), DAY_TIMEOUT);
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    vi.mocked(sendProductEvent).mockClear();

    await user.click(await yourDay(/^(?!.*with family).*Kyoto/));

    await waitFor(() => expect(headline()).toHaveTextContent(/Kyoto/));
    // The day written again is still on its way beside the day: it is not left.
    expect(day.current?.replan().status).toBe("writing");
    const kinds = vi.mocked(sendProductEvent).mock.calls.map(([event]) => event.kind);
    expect(kinds).not.toContain("day-left");
  }, 20_000);

  it("brings back a day with a part's proposal taken as it ended, not as being written", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto(createRef<DayHandle>());
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    await pressRomeHeld(user);

    await user.click(await yourDay(/slow morning/));

    await waitFor(() => expect(headline()).toHaveTextContent(/slow morning/));
    expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(screen.queryAllByText(/^Writing the day/)).toEqual([]);
    expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/^09:00\s*Shoren-in/);
    expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  }, 20_000);
});
