import { expect, test, type Page, waitMs, chooseTheChart } from "./fixtures";
import { writtenDayAt } from "../src/lib/days/written/days";
import { YOUR_DAYS_KEY, type YourDay } from "../src/features/day/your-days";
import { ledgerDateOf } from "../src/features/day/your-days-ledger-words";
import { BROWSER_STORAGE } from "../src/lib/browser-storage";
import { writtenVersionOf } from "../src/lib/days/written/version";
import type { StoredDay } from "../src/lib/days/stored-day";
import { KYOTO_REQUEST } from "../src/lib/fixtures/curated/requests";
import { KYOTO_ITINERARY } from "../src/lib/fixtures/replan/kyoto-morning";
import { KEPT_POLL_MS, KEPT_WAIT_MS } from "../src/features/day/kept-day";
import { NO_DAY_HERE } from "../src/features/day/no-day-here";
import { NOTICE_HEARD_MS } from "../src/features/day/notice-status";
import { expectSaidOnceAsChange, logStatuses } from "./status-log";

declare global {
  interface Window {
    showPage: (isSeen: boolean) => void;
  }
}

/**
 * The page's visibility, held by the test: seen until `showPage(false)` hides it, as a tab
 * behind another is, each change told to the page as a browser tells it. Run as an init script,
 * so it has no outside names.
 */
function stubPageVisibility(): void {
  let isSeen = true;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (isSeen ? "visible" : "hidden"),
  });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => !isSeen });
  window.showPage = (isShown) => {
    isSeen = isShown;
    document.dispatchEvent(new Event("visibilitychange"));
  };
}

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

// The e2e server runs with no database, so its log keeps no day and answers every id as one
// not found yet: the page's own reads of the log are answered here instead.

const ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
/** A visitor's Kyoto day, kept in the log: no day the site has written. */
const KYOTO = { request: KYOTO_REQUEST, itinerary: KYOTO_ITINERARY };
/** A day the site has written, which forgetting the visitor's days leaves as it was. */
const KANAZAWA = writtenDayAt("kanazawa")!;
const WRITTEN: StoredDay = {
  status: "written",
  ...KYOTO,
  checks: {},
  writtenAt: "2026-10-31T20:00:00.000Z",
  seconds: 46,
  round: 0,
};
/** The page asks every three seconds; a cold server adds a few to the first. */
const LANDED_TIMEOUT_MS = waitMs(20_000);
/** A town of 58 letters with no break in it: the longest city a row has to hold. */
const LONGEST_TOWN = "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch";

test.use({ reducedMotion: "reduce" });

/** Answers the page's reads of the log with these, in turn, the last one standing after. */
async function answerTheLog(page: Page, ...answers: StoredDay[]): Promise<() => number> {
  let asked = 0;
  await page.route(`**/api/day/${ID}`, (route) => {
    const answer = answers[Math.min(asked, answers.length - 1)]!;
    asked += 1;
    return route.fulfill({ json: answer });
  });
  return () => asked;
}

test("a day's link waits while the day is written, then opens it whole, never for a search engine", async ({
  page,
}) => {
  const asked = await answerTheLog(page, { status: "unknown" }, WRITTEN);
  await page.goto(`/day/${ID}`);

  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toHaveText("Lantern is still writing this day.");
  await expect(page.getByText("It opens here once it's done.")).toBeVisible();
  await expect(page).toHaveTitle("A day being written · Lantern");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

  await expect(headline).toContainText("A calm Saturday in Kyoto", { timeout: LANDED_TIMEOUT_MS });
  await expect(page.getByRole("list", { name: "The day" }).getByRole("listitem")).toHaveCount(
    KYOTO.itinerary.stops.length,
  );
  await expect(page).toHaveTitle("A calm Saturday in Kyoto · Lantern");
  expect(new URL(page.url()).pathname).toBe(`/day/${ID}`);
  expect(asked()).toBe(2);
});

test("a link past its days says so, with the day to write again", async ({ page }) => {
  await answerTheLog(page, { status: "unknown" }, { status: "expired", request: KYOTO.request });
  await page.goto(`/day/${ID}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A calm Saturday in Kyoto", {
    timeout: LANDED_TIMEOUT_MS,
  });
  // The line on screen: until its pen has written it whole, a screen reader's status holds
  // the whole line too, so the words are on the page twice for a moment.
  await expect(page.locator("main header p.text-quote")).toContainText(
    "This day's link has expired",
  );
  await expect(page.getByRole("button", { name: "Write it again" })).toBeVisible();
});

test("a link whose day turns out past its days says so from a status that stood while it waited", async ({
  page,
}) => {
  await page.addInitScript(logStatuses);
  await answerTheLog(page, { status: "unknown" }, { status: "expired", request: KYOTO.request });
  await page.goto(`/day/${ID}`);

  await expect(page.locator("main header p.text-quote")).toContainText(
    "This day's link has expired",
    { timeout: LANDED_TIMEOUT_MS },
  );
  await expectSaidOnceAsChange(page, "This day's link has expired", NOTICE_HEARD_MS);
});

test("a link no day lands at says so from a status that stood while it waited, the focus kept", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(logStatuses);
  await answerTheLog(page, { status: "unknown" });
  await page.goto(`/day/${ID}`);
  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toHaveText("Lantern is still writing this day.");
  const wordmark = page.getByRole("link").first();
  await wordmark.focus();

  await page.clock.runFor(KEPT_WAIT_MS + KEPT_POLL_MS);
  await expect(headline).toHaveText(NO_DAY_HERE);
  await expect(wordmark).toBeFocused();
  await expectSaidOnceAsChange(page, NO_DAY_HERE, NOTICE_HEARD_MS);
});

test("a link no day lands at behind another tab says so once the page is seen, held from then", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(logStatuses);
  await page.addInitScript(stubPageVisibility);
  await answerTheLog(page, { status: "unknown" });
  await page.goto(`/day/${ID}`);
  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toHaveText("Lantern is still writing this day.");

  await page.evaluate(() => window.showPage(false));
  await page.clock.runFor(KEPT_WAIT_MS + KEPT_POLL_MS);
  await expect(headline).toHaveText(NO_DAY_HERE);
  // Longer behind the tab than a hold, so a hold run meanwhile would be over.
  await page.clock.runFor(NOTICE_HEARD_MS * 2);
  const heardWhileHidden = await page.evaluate(
    (line) => window.statusLog.filter((entry) => entry.text.includes(line)),
    NO_DAY_HERE,
  );
  expect(heardWhileHidden).toEqual([]);

  await page.evaluate(() => window.showPage(true));
  await expectSaidOnceAsChange(page, NO_DAY_HERE, NOTICE_HEARD_MS);
});

test("the start screen says how a day left while it was written ended", async ({ page }) => {
  const day: YourDay = {
    id: ID,
    request: KYOTO.request,
    startedAt: new Date().toISOString(),
    energies: ["reflective"],
    ending: "writing",
    seconds: null,
  };
  await page.addInitScript(([key, kept]) => localStorage.setItem(key, kept), [
    YOUR_DAYS_KEY,
    JSON.stringify([day]),
  ] as const);
  await answerTheLog(page, WRITTEN);
  await page.goto("/");

  // Written, the row says the day's own date where it said "writing".
  const date = ledgerDateOf({ ...day, ending: "written" }, new Date());
  const yours = page.getByRole("list", { name: "Your days" });
  await expect(yours.getByRole("link")).toHaveAccessibleName(new RegExp(`^Kyoto\\b.*\\b${date}$`));
});

test("forgetting the visitor's days forgets what the browser kept of every kept day, and no written one", async ({
  page,
}) => {
  const day: YourDay = {
    id: ID,
    request: KYOTO.request,
    startedAt: new Date().toISOString(),
    energies: ["reflective"],
    ending: "written",
    seconds: 46,
  };
  const written = `kanazawa:${writtenVersionOf(KANAZAWA.itinerary)}`;
  const stop = KANAZAWA.itinerary.stops.find((each) => each.alternatives.length > 0)!;
  const chosen = { [stop.id]: stop.alternatives[0]!.id };
  await page.addInitScript(
    (kept) => {
      for (const [key, value] of kept) localStorage.setItem(key, value);
    },
    [
      [YOUR_DAYS_KEY, JSON.stringify([day])],
      [
        BROWSER_STORAGE.seen.key,
        JSON.stringify([written, `kept:${ID}`, "kept:a-day-from-someone's-link"]),
      ],
      [
        BROWSER_STORAGE.picks.key,
        JSON.stringify([
          { day: `kept:${ID}`, places: chosen },
          { day: written, places: chosen },
        ]),
      ],
    ] as const,
  );
  await answerTheLog(page, WRITTEN);
  await page.goto("/");

  await page.getByRole("button", { name: "Forget these days" }).click();
  // Asked once: the focus waits on "Keep", and nothing is forgotten until "Forget".
  await expect(page.getByRole("button", { name: "Keep", exact: true })).toBeFocused();
  await expect(page.getByRole("list", { name: "Your days" })).toBeVisible();
  // "Forget" takes a press a moment after the question stands, so it is pressed until it does.
  const forget = page.getByRole("button", { name: "Forget", exact: true });
  await expect(async () => {
    if (await forget.isVisible()) await forget.click({ timeout: 1_000 });
    await expect(page.getByRole("list", { name: "Your days" })).toHaveCount(0, { timeout: 500 });
  }).toPass();

  const kept = await page.evaluate(
    (keys) => keys.map((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown),
    [YOUR_DAYS_KEY, BROWSER_STORAGE.seen.key, BROWSER_STORAGE.picks.key],
  );
  expect(kept).toEqual([null, [written], [{ day: written, places: chosen }]]);
});

test("on a 320 px phone the visitor's days stay inside the column, the longest city and every word among them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const today = new Date().toISOString().slice(0, 10);
  const dayOf = (id: string, city: string, ending: YourDay["ending"]): YourDay => ({
    id,
    request: {
      ...KANAZAWA.request,
      city,
      date: today,
      timezone: "Europe/London",
      energy: "balanced",
      travel: "transit",
      start: "slow",
      dinner: "early",
      end: "early",
      company: "partner",
    },
    startedAt: new Date().toISOString(),
    energies: [],
    ending,
    seconds: null,
  });
  const days = [
    dayOf(ID, "Elche", "writing"),
    dayOf("a-day-of-the-longest-town", LONGEST_TOWN, "written"),
    dayOf("a-day-cut-short", "Alicante", "cut"),
  ];
  await page.addInitScript(([key, kept]) => localStorage.setItem(key, kept), [
    YOUR_DAYS_KEY,
    JSON.stringify(days),
  ] as const);
  // Still being written, so its row says so while the page is measured.
  await answerTheLog(page, { status: "unknown" });
  await page.goto("/");

  const yours = page.getByRole("list", { name: "Your days" });
  await expect(yours.getByRole("link")).toHaveCount(days.length);
  await expect(yours.getByRole("link").first()).toHaveAccessibleName(/\. writing$/);
  const isInsideTheScreen = async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const boxes = await yours
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().toJSON()));
    return {
      overflow,
      isEachRowInside: boxes.every(({ left, right }) => left >= 0 && right <= 320),
    };
  };
  expect(await isInsideTheScreen()).toEqual({ overflow: 0, isEachRowInside: true });

  // The question to forget wraps under its line, and still nothing leaves the screen.
  await page.getByRole("button", { name: "Forget these days" }).click();
  await expect(
    page.getByRole("group", { name: "Forget these days in this browser?" }),
  ).toBeVisible();
  expect(await isInsideTheScreen()).toEqual({ overflow: 0, isEachRowInside: true });
});

test.describe("with motion, a day opened by a device that has seen it", { tag: "@frame" }, () => {
  test.use({ reducedMotion: "no-preference" });

  /** Notes how many of the day's rows the first frame that drew any had: all, opened whole. */
  async function noteFirstRows(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const state = window as unknown as { firstRows: number | null };
      state.firstRows = null;
      const tick = () => {
        const rows = document.querySelectorAll('ol[aria-label="The day"] > li').length;
        if (rows > 0 && state.firstRows === null) state.firstRows = rows;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  const firstRows = (page: Page) =>
    page.evaluate(() => (window as unknown as { firstRows: number | null }).firstRows);

  async function waitForTheDay(page: Page): Promise<void> {
    await expect(page.getByRole("list", { name: "The day" }).getByRole("listitem")).toHaveCount(
      KYOTO.itinerary.stops.length,
      { timeout: LANDED_TIMEOUT_MS },
    );
  }

  test("a day the list holds as written, that no one watched to its end here, is written in", async ({
    page,
  }) => {
    // The start screen and the day's page tell the list how a day ended, from the log: a day
    // left while it was written says "written" there once the log has it, unseen.
    const day: YourDay = {
      id: ID,
      request: KYOTO.request,
      startedAt: new Date().toISOString(),
      energies: ["reflective"],
      ending: "written",
      seconds: 46,
    };
    await page.addInitScript(([key, kept]) => localStorage.setItem(key, kept), [
      YOUR_DAYS_KEY,
      JSON.stringify([day]),
    ] as const);
    await answerTheLog(page, WRITTEN);
    await noteFirstRows(page);
    await page.goto(`/day/${ID}`);

    await waitForTheDay(page);
    expect(await firstRows(page)).toBeLessThan(KYOTO.itinerary.stops.length);
  });

  test("a day from someone's link is written in, then opens whole once watched to its end", async ({
    page,
  }) => {
    // Whole, "as the visitor has in fact already seen them" (`docs/decisions.md`, "A written day's
    // page is built whole, and plays only for a visitor who has not seen it").
    await answerTheLog(page, WRITTEN);
    await noteFirstRows(page);
    await page.goto(`/day/${ID}`);
    await waitForTheDay(page);
    expect(await firstRows(page)).toBeLessThan(KYOTO.itinerary.stops.length);
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: LANDED_TIMEOUT_MS },
    );

    await page.reload();

    await waitForTheDay(page);
    expect(await firstRows(page)).toBe(KYOTO.itinerary.stops.length);
  });
});
