import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page, type Route } from "./fixtures";
import { openLive, seeWrittenDay } from "./live-page";
import { writtenDayAt } from "../src/lib/days/written/days";
import { YOUR_DAYS_KEY } from "../src/features/day/your-days";
import { DAY_ID_HEADER, type StoredDay } from "../src/lib/days/stored-day";
import { KYOTO_REQUEST } from "../src/lib/fixtures/curated/requests";
import { KANAZAWA_LATE_DINNER } from "../src/lib/fixtures/replan/kanazawa-dinner";
import { KYOTO_LATE_EVENING } from "../src/lib/fixtures/replan/kyoto-evening";
import { KYOTO_ITINERARY, KYOTO_SLOW_MORNING } from "../src/lib/fixtures/replan/kyoto-morning";
import type { GeneratedReplan } from "../src/lib/schema/replan.schema";

/**
 * A changed word's fork on a written day's own page: its proposal drawn beside the day, taken,
 * and either version taken back from memory (`docs/decisions.md`, "A changed word proposes its
 * part beside the day, and the visitor takes it"), and the round a re-plan's own address asks
 * with. Each page is opened as one with
 * live generation on (`e2e/live-page.ts`), and every route that would call a model is answered
 * here, the re-plan's with a recorded re-plan of Kanazawa's dinner.
 */

const KANAZAWA = writtenDayAt("kanazawa")!;
const KANAZAWA_ADDRESS = "/day/kanazawa";
/** Madrid, whose company names six of its seven stops: a change of it writes the day again. */
const MADRID = writtenDayAt("madrid")!;
const MADRID_ADDRESS = "/day/madrid";
/** The re-plan's row in the log, as its answer names it. */
const REPLAN_ID = "6c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
/** A re-plan the visitor opened at its address: its record has taken one re-plan. */
const KEPT_ID = "2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d";
/** Two changes in turn on a day opened at its address: the log's rows for each. */
const FIRST_ID = "3c4d5e6f-7081-4b9c-8d1e-2f3a4b5c6d7e";
const SECOND_ID = "4d5e6f70-8192-4cad-9e2f-3a4b5c6d7e8f";
const REPLAN_ROUTE = "**/api/replan";
const DAY_ROUTE = "**/api/day";
/** A day lands at the route's pace, about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = 30_000;
/** The window's old stops, the day's last two, and the re-plan's first new one. */
const OLD_EVENING = "Kazue-machi Chaya District";
const NEW_FIRST = "Nagamachi Samurai District";
const NEW_SECOND = "Asanogawa riverbank at dusk";
/** Kyoto's slow morning's first stop, and its evening's late dinner. */
const SLOW_MORNING_TEMPLE = "Shoren-in";
const LATE_EVENING_DINNER = "Izakaya along Kiyamachi";

test.use({ reducedMotion: "reduce" });

/** The re-plan's stream as the route sends it, its text in deltas, to `upTo` of it or whole. */
function replanEventsOf(replan: GeneratedReplan, upTo?: number): string[] {
  const whole = JSON.stringify(replan);
  const text = upTo === undefined ? whole : whole.slice(0, upTo);
  const events: object[] = [{ type: "start" }, { type: "text-start", id: "t" }];
  for (let start = 0; start < text.length; start += 200) {
    events.push({ type: "text-delta", id: "t", delta: text.slice(start, start + 200) });
  }
  if (upTo === undefined) events.push({ type: "text-end", id: "t" }, { type: "finish" });
  const lines = events.map((event) => `data: ${JSON.stringify(event)}\n\n`);
  return upTo === undefined ? [...lines, "data: [DONE]\n\n"] : lines;
}

/** Answers the re-plan route with a whole recorded re-plan, named by `id` in the log. */
function answerReplan(
  route: Route,
  id: string,
  replan: GeneratedReplan = KANAZAWA_LATE_DINNER,
): Promise<void> {
  return route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream", [DAY_ID_HEADER]: id },
    body: replanEventsOf(replan).join(""),
  });
}

/**
 * A proposal as a live model streams it, from a server of the test's own: its first new stop
 * whole, then nothing more.
 */
async function serveHeldReplan(): Promise<{ server: Server; url: string }> {
  const upTo = JSON.stringify(KANAZAWA_LATE_DINNER).indexOf(NEW_SECOND);
  const server = createServer((_, response) => {
    response.writeHead(200, { "content-type": "text/event-stream", [DAY_ID_HEADER]: REPLAN_ID });
    response.write(replanEventsOf(KANAZAWA_LATE_DINNER, upTo).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://localhost:${port}/` };
}

/** The written Kanazawa day, marked seen on this device, so its page draws it whole at once. */
function seeKanazawa(page: Page): Promise<void> {
  return seeWrittenDay(page, "kanazawa", KANAZAWA.itinerary);
}

async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

async function changeWord(page: Page, word: string, option: string): Promise<void> {
  await page
    .getByRole("heading", { level: 1 })
    .getByRole("button", { name: word, exact: true })
    .click();
  // An answer says what it will do only once the page knows Lantern writes: the flag comes in
  // a part of the page of its own, after the day, and an answer chosen before it is refused.
  const answer = page.getByRole("option", { name: option });
  await expect(answer).toHaveAccessibleDescription(/\S/, { timeout: DAY_TIMEOUT_MS });
  await answer.click();
}

/** Takes the proposal from the fork's first row once it is whole, as a hollow bead is taken. */
async function takeProposal(page: Page, answer: string): Promise<void> {
  const radio = page.getByRole("radio", { name: `${answer}, proposed`, exact: true }).first();
  await expect(radio).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await radio.click();
}

function rowNamed(page: Page, name: string) {
  return page.locator('ol[aria-label="The day"] > li').filter({ hasText: name });
}

/** The visitor's days as the browser keeps them: each one's id and how it stands. */
function yourDays(page: Page): Promise<string[][]> {
  return page.evaluate((key) => {
    const days = JSON.parse(localStorage.getItem(key) ?? "[]") as { id: string; ending: string }[];
    return days.map(({ id, ending }) => [id, ending]);
  }, YOUR_DAYS_KEY);
}

test("a proposal taken and taken back puts each day and its address back, each the visitor's, and Back leaves as before", async ({
  page,
}) => {
  await seeKanazawa(page);
  await page.goto("/privacy");
  await openLive(page, KANAZAWA_ADDRESS);
  await waitForTheDay(page);
  const entries = await page.evaluate(() => window.history.length);
  let replans = 0;
  await page.route(REPLAN_ROUTE, (route) => {
    replans += 1;
    return answerReplan(route, REPLAN_ID);
  });

  await changeWord(page, "early dinner", "eating late");

  // Whole, the proposal stands beside the day: the old evening and the new, the day's address.
  await expect(rowNamed(page, NEW_FIRST)).toHaveCount(1, { timeout: DAY_TIMEOUT_MS });
  await expect(rowNamed(page, OLD_EVENING)).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`${KANAZAWA_ADDRESS}$`));
  await takeProposal(page, "eating late");

  await expect(page).toHaveURL(new RegExp(`/day/${REPLAN_ID}$`), { timeout: DAY_TIMEOUT_MS });
  await expect(rowNamed(page, NEW_FIRST)).toHaveCount(1);
  await expect(rowNamed(page, OLD_EVENING)).toHaveCount(0);
  await waitForTheDay(page);
  expect(await yourDays(page)).toEqual([[REPLAN_ID, "written"]]);

  // The answer the change came from: the day before, from memory, with no call.
  await changeWord(page, "eating late", "early dinner");

  await expect(page).toHaveURL(new RegExp(`${KANAZAWA_ADDRESS}$`));
  await expect(rowNamed(page, OLD_EVENING)).toHaveCount(1, { timeout: DAY_TIMEOUT_MS });
  await expect(rowNamed(page, NEW_FIRST)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("early dinner");
  await waitForTheDay(page);
  // A written day is no day of the visitor's: the proposal stays theirs, once.
  expect(await yourDays(page)).toEqual([[REPLAN_ID, "written"]]);

  // The answer it went to: the proposal again, its address with it.
  await changeWord(page, "early dinner", "eating late");

  await expect(page).toHaveURL(new RegExp(`/day/${REPLAN_ID}$`));
  await expect(rowNamed(page, NEW_FIRST)).toHaveCount(1, { timeout: DAY_TIMEOUT_MS });
  await expect(rowNamed(page, OLD_EVENING)).toHaveCount(0);
  await waitForTheDay(page);
  expect(replans).toBe(1);
  expect(await yourDays(page)).toEqual([[REPLAN_ID, "written"]]);
  // Each address took the last one's place: Back leaves the day for the page before it.
  expect(await page.evaluate(() => window.history.length)).toBe(entries);

  await page.goBack();

  await expect(page).toHaveURL(/\/privacy$/);
});

test("a re-plan merged after an energy re-picked shows its own rows, not the re-picked day's", async ({
  page,
}) => {
  await seeKanazawa(page);
  await openLive(page, KANAZAWA_ADDRESS);
  await waitForTheDay(page);
  await page.route(REPLAN_ROUTE, (route) => answerReplan(route, REPLAN_ID));
  await changeWord(page, "calm", "lively");
  await waitForTheDay(page);

  await changeWord(page, "early dinner", "eating late");
  await takeProposal(page, "eating late");

  await expect(page).toHaveURL(new RegExp(`/day/${REPLAN_ID}$`), { timeout: DAY_TIMEOUT_MS });
  await waitForTheDay(page);
  await expect(rowNamed(page, NEW_FIRST)).toHaveCount(1);
  await expect(rowNamed(page, NEW_SECOND)).toHaveCount(1);
  await expect(rowNamed(page, OLD_EVENING)).toHaveCount(0);
});

test("a proposal being written leaves the day the visitor's: its rows, its word and its address", async ({
  page,
}) => {
  const { server, url } = await serveHeldReplan();
  await page.goto("/lab/concepts/day");
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Ending" }).click();
  await controls.getByRole("combobox", { name: "Day" }).selectOption("Kanazawa");
  await controls.getByRole("combobox", { name: "Pace" }).selectOption("Ten times faster");
  await controls.getByRole("combobox", { name: "Re-plans" }).selectOption("live");
  await controls.getByRole("button", { name: "Ending" }).click();
  await waitForTheDay(page);
  await page.route(REPLAN_ROUTE, (route) => route.continue({ url }));

  await changeWord(page, "early dinner", "eating late");

  // The first new stop has landed beside the old evening, which stands as it was.
  await expect(rowNamed(page, NEW_FIRST)).toHaveCount(1, { timeout: DAY_TIMEOUT_MS });
  await expect(rowNamed(page, OLD_EVENING)).toHaveCount(1);
  await expect(page.locator('ol[aria-label="The day"] del')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "early dinner or eating late",
  );
  // The proposal cannot be taken until it is whole; the day can be dragged meanwhile.
  await expect(
    page.getByRole("radio", { name: "eating late, being written", exact: true }).first(),
  ).toHaveAttribute("aria-disabled", "true");
  await waitForTheDay(page);
  // Named as its answer came: one of the visitor's days, before it is written.
  expect(await yourDays(page)).toEqual([[REPLAN_ID, "writing"]]);
  server.close();
});

test("a re-plan opened at its address asks the route for the round after its record's", async ({
  page,
}) => {
  const stored: StoredDay = {
    status: "written",
    request: KANAZAWA.request,
    itinerary: KANAZAWA.itinerary,
    checks: {},
    writtenAt: "2026-11-05T20:00:00.000Z",
    seconds: 34,
    round: 1,
  };
  // The e2e server keeps no log: the page's reads of it are answered here.
  await page.route(`**/api/day/${KEPT_ID}`, (route) => route.fulfill({ json: stored }));
  const asked: unknown[] = [];
  await page.route(REPLAN_ROUTE, (route) => {
    asked.push(route.request().postDataJSON());
    return answerReplan(route, REPLAN_ID);
  });
  let days = 0;
  await page.route(DAY_ROUTE, (route) => {
    days += 1;
    return route.abort();
  });
  await openLive(page, `/day/${KEPT_ID}`);
  await waitForTheDay(page);

  await changeWord(page, "early dinner", "eating late");
  await takeProposal(page, "eating late");

  await expect(page).toHaveURL(new RegExp(`/day/${REPLAN_ID}$`), { timeout: DAY_TIMEOUT_MS });
  expect(asked).toEqual([
    {
      basis: { kind: "kept", id: KEPT_ID },
      request: expect.objectContaining({ dinner: "late" }),
      changed: "dinner",
      round: 2,
      picks: {},
    },
  ]);
  // Re-planned in its part: the whole day was never asked for.
  await expect(rowNamed(page, NEW_FIRST)).toHaveCount(1);
  expect(days).toBe(0);
});

test("a second change taken back puts back the first one's day and its address, and a third asks the round after the first's", async ({
  page,
}) => {
  // Someone's Kyoto day, opened from its link: it has taken no re-plan.
  const stored: StoredDay = {
    status: "written",
    request: KYOTO_REQUEST,
    itinerary: KYOTO_ITINERARY,
    checks: {},
    writtenAt: "2026-11-05T20:00:00.000Z",
    seconds: 41,
    round: 0,
  };
  await page.route(`**/api/day/${KEPT_ID}`, (route) => route.fulfill({ json: stored }));
  const answers: [string, GeneratedReplan][] = [
    [FIRST_ID, KYOTO_SLOW_MORNING],
    [SECOND_ID, KYOTO_LATE_EVENING],
  ];
  const asked: unknown[] = [];
  await page.route(REPLAN_ROUTE, (route) => {
    asked.push(route.request().postDataJSON());
    const answer = answers[asked.length - 1];
    return answer === undefined ? route.abort() : answerReplan(route, ...answer);
  });
  await page.route(DAY_ROUTE, (route) => route.abort());
  await openLive(page, `/day/${KEPT_ID}`);
  await waitForTheDay(page);
  const entries = await page.evaluate(() => window.history.length);
  await changeWord(page, "early start", "slow morning");
  await takeProposal(page, "slow morning");
  await expect(page).toHaveURL(new RegExp(`/day/${FIRST_ID}$`), { timeout: DAY_TIMEOUT_MS });
  await waitForTheDay(page);
  await changeWord(page, "home by eight", "out late");
  await takeProposal(page, "out late");
  await expect(page).toHaveURL(new RegExp(`/day/${SECOND_ID}$`), { timeout: DAY_TIMEOUT_MS });
  await expect(rowNamed(page, LATE_EVENING_DINNER)).toHaveCount(1);
  await waitForTheDay(page);
  // Each proposal is a day of the visitor's own.
  expect((await yourDays(page)).sort()).toEqual(
    [
      [FIRST_ID, "written"],
      [SECOND_ID, "written"],
    ].sort(),
  );

  await changeWord(page, "out late", "home by eight");

  // The first change's day, its new morning and its old evening, at its own address.
  await expect(page).toHaveURL(new RegExp(`/day/${FIRST_ID}$`));
  await expect(rowNamed(page, LATE_EVENING_DINNER)).toHaveCount(0);
  await expect(rowNamed(page, SLOW_MORNING_TEMPLE)).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("slow morning");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("home by eight");
  await waitForTheDay(page);
  // Both versions stay the visitor's days.
  expect((await yourDays(page)).length).toBe(2);
  expect(await page.evaluate(() => window.history.length)).toBe(entries);

  await changeWord(page, "early dinner", "eating late");

  await expect.poll(() => asked.length).toBe(3);
  expect(asked[2]).toEqual({
    basis: { kind: "kept", id: FIRST_ID },
    request: expect.objectContaining({ start: "slow", end: null, dinner: "late" }),
    changed: "dinner",
    round: 2,
    picks: {},
  });
});

test(
  "a word that writes the whole day again keeps the day before on screen until its proposal is taken, its headline changed by the pair",
  { tag: "@frame" },
  async ({ page }) => {
    await seeWrittenDay(page, "madrid", MADRID.itinerary);
    await openLive(page, MADRID_ADDRESS);
    await waitForTheDay(page);
    // Each frame from now on: the headline's words, without a word's open list, and whether
    // the rows are still the day before's.
    await page.evaluate(() => {
      const list = document.querySelector('ol[aria-label="The day"]');
      list?.setAttribute("data-before", "yes");
      const state = window as unknown as { frames: { sentence: string; rows: string }[] };
      state.frames = [];
      const sample = () => {
        const headline = document.querySelector("main h1");
        const open = headline?.querySelector('[role="listbox"]')?.textContent ?? "";
        const day = document.querySelector('ol[aria-label="The day"]');
        const rows = day === null ? "none" : day.getAttribute("data-before") ? "before" : "new";
        const sentence = (headline?.textContent ?? "").replace(open, "");
        state.frames.push({ sentence, rows: `${rows}:${day?.children.length ?? 0}` });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    // Written for family: the day the route writes for Madrid, at its own pace.
    await page.route(DAY_ROUTE, (route) =>
      route.continue({ postData: JSON.stringify(MADRID.request) }),
    );

    await changeWord(page, "with friends", "with family");
    await takeProposal(page, "with family");

    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("with friends", {
      timeout: DAY_TIMEOUT_MS,
    });
    await waitForTheDay(page);
    const frames = await page.evaluate(
      () => (window as unknown as { frames: { sentence: string; rows: string }[] }).frames,
    );
    const stops = MADRID.itinerary.stops.length;
    // The rows the day before had, every one, until the new day's, every one, in one pass.
    const rows = frames.map((frame) => frame.rows).filter((each, at, all) => each !== all[at - 1]);
    expect(rows).toEqual([`before:${stops}`, `new:${stops}`]);
    // The pen wrote the pair in after the visitor's word, and the word taken stood alone.
    const sentences = frames
      .map((frame) => frame.sentence)
      .filter((each, at, all) => each !== all[at - 1]);
    const before = sentences[0] ?? "";
    const lead = before.slice(0, before.lastIndexOf("with friends"));
    expect(sentences).toContain(`${lead}with friends or with family`);
    expect(sentences.at(-1)).toBe(`${lead}with family`);
    for (const sentence of sentences) expect(sentence.startsWith(lead), sentence).toBe(true);
  },
);

test("a word that changes no stop is the visitor's at once: no route is asked, every row stays, and the facts line says why", async ({
  page,
}) => {
  await seeKanazawa(page);
  await openLive(page, KANAZAWA_ADDRESS);
  await waitForTheDay(page);
  const asked: string[] = [];
  for (const path of [REPLAN_ROUTE, DAY_ROUTE]) {
    await page.route(path, (route) => {
      asked.push(route.request().url());
      return route.abort();
    });
  }
  const rows = page.locator('ol[aria-label="The day"] > li');
  const before = await rows.allTextContents();
  const headline = page.getByRole("heading", { level: 1 });
  const facts = page.locator("header p.type-note").first();

  // Company, which no stop of Kanazawa's names.
  await changeWord(page, "with …?", "with family");
  await expect(headline).toContainText(/with family$/);
  await expect(facts).toContainText("every stop stays, fit for any company");
  // Travel, which changes no stop on any day.
  await changeWord(page, "on foot", "by public transport");
  await expect(headline).toContainText("by public transport");
  await expect(facts).toContainText("every stop stays, a short way from the next");

  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(await rows.allTextContents()).toEqual(before);
  expect(asked).toEqual([]);
  await expect(page).toHaveURL(new RegExp(`${KANAZAWA_ADDRESS}$`));
});
