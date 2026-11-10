import { expect, test, type Page } from "./fixtures";
import { shownWrittenDayAt, writtenDayAt } from "../src/lib/days/written/days";

// A written day's page holds the whole day in its first HTML, and a day this device has
// watched to its end opens whole, without its playing (`docs/decisions.md`, "A day can be
// read as a list, written as the chart is").

const DAY_TIMEOUT_MS = 30_000;
const KANAZAWA = writtenDayAt("kanazawa")!.itinerary;
const KANAZAWA_STOPS = KANAZAWA.stops.length;
/** Days the city word offers from any other, so the visitor can come back to them there. */
const BOLOGNA = writtenDayAt("bologna")!.itinerary;
const PORTO = writtenDayAt("porto")!.itinerary;
/** A date as the facts line says it: "Sat 14 Nov". */
const SHOWN_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** What a frame of the list shows: its rows, the first one's name, and the pen at work. */
interface ListFrame {
  rows: number;
  first: string;
  isPenned: boolean;
}

/** Every frame from now on, from a page's start when run before it loads. */
function sampleTheList(): void {
  const frames: { rows: number; first: string; isPenned: boolean }[] = [];
  (window as unknown as { listFrames: typeof frames }).listFrames = frames;
  const sample = () => {
    const rows = document.querySelectorAll('ol[aria-label="The day, to read"] > li');
    frames.push({
      rows: rows.length,
      first: rows[0]?.querySelector("h2")?.textContent ?? "",
      // The pen holds a row's words not yet written in unseen room.
      isPenned: [...rows].some((row) => row.querySelector(".invisible") !== null),
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

async function listFramesOf(page: Page): Promise<ListFrame[]> {
  return page.evaluate(() => (window as unknown as { listFrames: ListFrame[] }).listFrames);
}

/** The day on screen is written whole: its chart, seen or not, is still. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/**
 * From the frame the day's list leads, by its first stop in any of its versions: every
 * stop, and none written by the pen.
 */
function expectWhole(frames: readonly ListFrame[], day: typeof BOLOGNA): void {
  const firsts = [day.stops[0]!.primary, ...day.stops[0]!.alternatives].map(({ name }) => name);
  const from = frames.findIndex(({ first }) => firsts.includes(first));
  expect(from, "the day's list was drawn").toBeGreaterThanOrEqual(0);
  const shown = frames.slice(from).filter(({ rows }) => rows > 0);
  expect(shown.filter(({ rows }) => rows !== day.stops.length)).toEqual([]);
  expect(shown.filter(({ isPenned }) => isPenned)).toEqual([]);
}

test("a written day's page holds the whole day for a reader without its script", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/day/kanazawa");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A calm Saturday in Kanazawa, on foot, early start",
  );
  // The line about the day, over the unseen copies that hold its room.
  await expect(page.getByText(/^A calm Saturday in Kanazawa that starts/).first()).toBeVisible();
  const list = page.getByRole("list", { name: "The day, to read" });
  await expect(list.getByRole("listitem")).toHaveCount(KANAZAWA_STOPS);
  await expect(list.getByRole("listitem").first()).toContainText("07:30");
  // The date it is shown on, as the server's clock and this one agree on it, with that day's
  // own sun, never a placeholder, and the places' credit under them.
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const shownOn = shownWrittenDayAt("kanazawa", new Date())!.itinerary.date;
  expect(text).toContain(SHOWN_DATE.format(new Date(`${shownOn}T00:00:00Z`)));
  expect(text).toMatch(/sunrise \d\d:\d\d/);
  expect(text).not.toMatch(/(sunrise|sunset) 00:00/);
  await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  // Nothing could change the view: the switch is left out.
  await expect(page.getByRole("group", { name: "View" })).toBeHidden();
  await context.close();
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test(
    "a day watched to its end on the chart opens whole as a list from another city, and after a reload",
    { tag: "@frame" },
    async ({ page }) => {
      test.setTimeout(4 * DAY_TIMEOUT_MS);
      // The owner's words: a day opened on the chart and played to its end, another day, the
      // list chosen there, and back to the first day: no playing.
      await page.goto("/day/bologna");
      await waitForTheDay(page);

      const headline = page.getByRole("heading", { level: 1 });
      await headline.getByRole("button", { name: "Bologna", exact: true }).click();
      await page.getByRole("button", { name: /^Porto/ }).click();
      await expect(headline).toContainText("Porto");
      await waitForTheDay(page);
      await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Read" }).click();

      // Back to Bologna: its list whole, not one frame of the pen.
      await page.evaluate(sampleTheList);
      await headline.getByRole("button", { name: "Porto", exact: true }).click();
      await page.getByRole("button", { name: /^Bologna/ }).click();
      await expect(headline).toContainText("Bologna");
      await expect(page.getByRole("list", { name: "The day, to read" })).toHaveAttribute(
        "aria-busy",
        "false",
      );
      expectWhole(await listFramesOf(page), BOLOGNA);

      // Porto too, watched to its end here, comes whole from the route.
      await page.evaluate(sampleTheList);
      await headline.getByRole("button", { name: "Bologna", exact: true }).click();
      await page.getByRole("button", { name: /^Porto/ }).click();
      await expect(headline).toContainText("Porto");
      await expect(page.getByRole("list", { name: "The day, to read" })).toHaveAttribute(
        "aria-busy",
        "false",
      );
      expectWhole(await listFramesOf(page), PORTO);

      // And Bologna after a reload, from the page's first frame.
      await page.goto("/day/bologna");
      await page.addInitScript(sampleTheList);
      await page.reload();
      await waitForTheDay(page);
      expectWhole(await listFramesOf(page), BOLOGNA);
    },
  );

  test("a day left before its end plays again on the next visit", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
    await page.goto("/day/kanazawa");
    // Left while its stops are still written.
    await expect(
      page.getByRole("list", { name: "The day, to read" }).getByRole("listitem").first(),
    ).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await page.goto("/privacy");

    await page.goto("/day/kanazawa");
    await page.evaluate(sampleTheList);
    await waitForTheDay(page);
    const shown = (await listFramesOf(page)).filter(({ rows }) => rows > 0);
    // Written again, a stop at a time.
    expect(shown.some(({ rows }) => rows < KANAZAWA_STOPS)).toBe(true);
  });
});

/** Googlebot as a phone, as Google publishes its user agent. */
const GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.116 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

test.describe("in a search engine's renderer", () => {
  test.use({ userAgent: GOOGLEBOT, reducedMotion: "no-preference" });

  test(
    "a written day stays whole as its HTML holds it, and its stream is never asked",
    { tag: "@frame" },
    async ({ page }) => {
      // Every ask for the day fails, as Google's renderer gave it up on 2026-11-08: a page that
      // asked would end as a dropped connection, the ending Google indexed in the day's place.
      const asked: string[] = [];
      await page.route("**/api/day", (route) => {
        asked.push(route.request().url());
        return route.abort("failed");
      });
      await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
      await page.addInitScript(sampleTheList);
      await page.goto("/day/kanazawa");

      // The page's note on <html> is done with once its script has drawn the day as it stays.
      await page.waitForFunction(
        () => !document.documentElement.hasAttribute("data-day-seen"),
        null,
        {
          timeout: DAY_TIMEOUT_MS,
        },
      );
      await waitForTheDay(page);
      await page.waitForLoadState("networkidle");

      expect(asked).toEqual([]);
      expectWhole(await listFramesOf(page), KANAZAWA);
      await expect(page.getByText(/connection dropped/i)).toHaveCount(0);
    },
  );
});

/** What a play that ends without the day would say in its place, any of the endings. */
const ENDINGS_SAID =
  /connection dropped|couldn.t finish|couldn.t write|can.t plan this day|has written all the days/i;
/** Of the day's text as the route sends it, about where its stops are still being written. */
const AMONG_THE_STOPS = 0.4;

// A visitor's browser asks for the day's play, and a play that ends without the day, its
// connection dropped or cut short, gives way to the day the page already holds, as a device
// that has seen it draws it, with no ending said (`docs/decisions.md`, "A written day's page is
// built whole, and plays only for a visitor who has not seen it").
test.describe("a written day whose play ends without the day", () => {
  test.use({ reducedMotion: "reduce" });

  test("is drawn whole when the play's connection fails before its first word", async ({
    page,
  }) => {
    await page.route("**/api/day", (route) => route.abort("failed"));
    await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
    await page.goto("/day/kanazawa");

    await waitForTheDay(page);
    const list = page.getByRole("list", { name: "The day, to read" });
    await expect(list.getByRole("listitem")).toHaveCount(KANAZAWA_STOPS);
    await expect(list.getByRole("listitem").first()).toContainText(KANAZAWA.stops[0]!.startTime);
    await expect(page.getByText(ENDINGS_SAID)).toHaveCount(0);
  });

  test("is drawn whole when the play stops among its stops", async ({ page }) => {
    // The route's own stream, cut where the stops are still being written, as a connection
    // that drops mid-stream ends it.
    await page.route("**/api/day", async (route) => {
      const answer = await route.fetch();
      const text = await answer.text();
      await route.fulfill({
        status: answer.status(),
        headers: answer.headers(),
        body: text.slice(0, Math.floor(text.length * AMONG_THE_STOPS)),
      });
    });
    await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
    await page.goto("/day/kanazawa");

    await waitForTheDay(page);
    const list = page.getByRole("list", { name: "The day, to read" });
    await expect(list.getByRole("listitem")).toHaveCount(KANAZAWA_STOPS);
    await expect(page.getByText(ENDINGS_SAID)).toHaveCount(0);
  });
});

/** Every frame from the page's start: whether a date or the view switch stands on screen. */
function sampleUnderTheHeadline(): void {
  const frames: { date: boolean; views: boolean }[] = [];
  (window as unknown as { underFrames: typeof frames }).underFrames = frames;
  const isShown = (element: Element | null) =>
    element !== null &&
    element.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
    element.getBoundingClientRect().height > 0 &&
    (element.textContent ?? "").trim() !== "";
  const sample = () => {
    frames.push({
      date: [...document.querySelectorAll("header p.type-note")].some(isShown),
      views: isShown(document.querySelector('[role="group"][aria-label="View"]')),
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

test(
  "a link draws its date and its view switch once, never shown and then taken away",
  { tag: "@frame" },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(sampleUnderTheHeadline);
    await page.goto("/day/kanazawa");
    await waitForTheDay(page);

    const frames = await page.evaluate(
      () => (window as unknown as { underFrames: { date: boolean; views: boolean }[] }).underFrames,
    );
    for (const part of ["date", "views"] as const) {
      const shown = frames.map((frame) => frame[part]);
      // Its first HTML holds the playing's first frame, which draws neither until the header's
      // room is known: shown there, the date went as the page ran, and came back 2.5 s on.
      const from = shown.indexOf(true);
      expect(from, `the ${part} was drawn`).toBeGreaterThan(0);
      expect(shown.slice(from).includes(false), `the ${part} went once drawn`).toBe(false);
    }
  },
);
