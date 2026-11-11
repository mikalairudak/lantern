import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page, type Route, waitMs } from "./fixtures";
import { NAFPLIO_START_REQUEST } from "../src/lib/days/written/quick-starts";

/**
 * A changed word on a live day: the day on screen holds its place while the day asked for
 * is on its way, and a re-plan that ends without a day leaves it exactly as it was, saying
 * why in its facts line; one that streams takes the page, its header gliding from the room
 * the day before had, the chart with it. Played on the day bench with its next days live,
 * the route answered by the test, as no test calls a live model, on Madrid, whose company
 * names six of its seven stops, so the word re-plans the whole day.
 */

const BENCH = "/lab/concepts/day";
const DAY_ROUTE = "**/api/day";
/**
 * The bench's first day has its stops by about 4 s at ten times the pace and rests about
 * 8 s in; a cold server adds a few.
 */
const DAY_TIMEOUT_MS = waitMs(30_000);
const WORD = "with family";
const REPLANNING = `re-planning the day for “${WORD}”`;
/** What the fork row says of a whole day that ended without one, by why (`replanEndedOf`). */
const LIMITED = "No more re-plans for now";
const NOT_JUST_NOW = "Couldn't re-plan just now";
const CONNECTION_DROPPED = "The connection dropped";
const NOT_FINISHED = "Couldn't finish the new day";
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };
/**
 * Bologna's written day, which the route streams whole with live generation off: a re-plan of
 * Madrid that comes back empty is answered with it once asked again.
 */
const BOLOGNA_REQUEST = {
  city: "Bologna",
  date: "2026-11-07",
  timezone: "Europe/Rome",
  citySource: "chosen",
  energy: "lively",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: "friends",
};
/**
 * A day as the route streams it when the model closed its stops with none in them: its line
 * about the day, then no stops, finished (`docs/decisions.md`, "A day has at least one stop").
 */
const EMPTY_DAY_STREAM = [
  { type: "text-delta", id: "day", delta: '{"dek":"A quiet day.","stops":[],"alternatives":[]}' },
  { type: "finish", finishReason: "stop" },
]
  .map((event) => `data: ${JSON.stringify(event)}\n\n`)
  .concat("data: [DONE]\n\n")
  .join("");
/**
 * Nafplio's written day answers a re-plan of Madrid that streams: its line about the day is
 * 62 characters longer, so on a phone the day that takes the page has a taller header, as a
 * live re-plan's mostly has another height. Its first place is written once that day has its
 * header's room.
 */
const NAFPLIO_FIRST_PLACE = "Coffee on Staikopoulou";
/** The chart has come to its place once its top has not moved in this many frames. */
const REST_FRAMES = 10;
/** The header's room glides for about half a second as a day lands: twice as many frames. */
const LANDING_GLIDE_FRAMES = 60;
/** A glide never takes more than this share of its way in one frame; a step takes all of it. */
const GLIDE_SHARE = 1 / 2;
/** Less than this between two frames is a rounding, not a move. */
const STILL_PX = 1;
/** On a phone the header that takes the page is this much taller, or more: a way to glide. */
const PHONE_WAY_PX = 20;
/** A move of 4 px or more that is over in two frames or fewer is a step, not a glide. */
const STEP_PX = 4;
const STEP_FRAMES = 2;
const START = "/lab/concepts/start";
/** The line an empty day writes about itself, a word at a time, before its stops close. */
const EMPTY_DEK = "A quiet day by the river, with long lunches.";
const EMPTY_WORD_MS = 120;
/** How long the empty day's stops stay open, as a live model can wait between two tokens. */
const EMPTY_STOPS_OPEN_MS = 1500;

declare global {
  interface Window {
    chartTops: (number | null)[];
    /** What took the focus, in order: its words. */
    focused: string[];
  }
}

/**
 * A day that comes back empty as a live model streams one: its line about the day a word at
 * a time, its stops opened, then, after a wait, closed with none in them. Served from a
 * server of the test's own, so the page reads it as it arrives, which a fulfilled route,
 * whole at once, never lets it do.
 */
async function serveSlowEmptyDay(): Promise<{ server: Server; url: string }> {
  const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;
  const delta = (part: string) => frame({ type: "text-delta", id: "day", delta: part });
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const server = createServer((_request, response) => {
    void (async () => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(delta('{"dek":"'));
      for (const word of EMPTY_DEK.split(" ")) {
        await pause(EMPTY_WORD_MS);
        response.write(delta(`${word} `));
      }
      response.write(delta('","stops":['));
      await pause(EMPTY_STOPS_OPEN_MS);
      response.write(delta('],"alternatives":[]}'));
      response.write(frame({ type: "finish", finishReason: "stop" }));
      response.end("data: [DONE]\n\n");
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://localhost:${port}/` };
}

/** The moves of a height that are over in two frames or fewer and go 4 px or more. */
function stepsOf(tops: readonly number[]): { at: number; px: number }[] {
  const moves = tops.slice(1).map((top, index) => Math.abs(top - (tops[index] ?? top)));
  const steps: { at: number; px: number }[] = [];
  let run: { at: number; frames: number; px: number } | null = null;
  for (const [index, move] of [...moves, 0].entries()) {
    if (move >= STILL_PX) {
      run ??= { at: index, frames: 0, px: 0 };
      run.frames += 1;
      run.px = Math.max(run.px, move);
      continue;
    }
    if (run && run.frames <= STEP_FRAMES && run.px >= STEP_PX) steps.push(run);
    run = null;
  }
  return steps;
}

/** Madrid on the bench, its next days asked of the live route, still. */
async function openLiveBench(page: Page): Promise<void> {
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Ending" }).click();
  await controls.getByRole("combobox", { name: "Day" }).selectOption("Madrid");
  await controls.getByRole("combobox", { name: "Pace" }).selectOption("Ten times faster");
  await controls.getByRole("combobox", { name: "Re-plans" }).selectOption("live");
  await controls.getByRole("button", { name: "Ending" }).click();
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/**
 * A line the facts line says, as written in its status: the header's unseen copies that
 * hold the line's room are not it.
 */
function said(page: Page, line: string) {
  return page.getByRole("status").getByText(line, { exact: true });
}

/** A line the fork's first row says: under its answers, or in the margin beside them on a laptop. */
function workSaid(page: Page, line: string) {
  return page
    .locator('[data-fork-row="0"] p:not([role="status"]), [data-fork-line="0"] p')
    .getByText(line, { exact: true })
    .first();
}

/** Takes the proposal from the fork's first row once it is whole, as a hollow bead is taken. */
async function takeProposal(page: Page, answer: string): Promise<void> {
  const radio = page.getByRole("radio", { name: `${answer}, proposed`, exact: true }).first();
  await expect(radio).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await radio.click();
}

/** Marks the day on screen, so a day drawn again in its place is told from it. */
async function markTheDay(page: Page): Promise<void> {
  await page
    .getByRole("group", { name: /The day's energy/ })
    .evaluate((chart) => chart.setAttribute("data-held", "yes"));
}

async function changeWord(page: Page, word: string, option: RegExp): Promise<void> {
  const headline = page.getByRole("heading", { level: 1 });
  await headline.getByRole("button", { name: word, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

/**
 * The day asked from is the one on screen, whole: its word the new one, in place, while the
 * re-plan is on its way, and as it was once the re-plan has ended without a day.
 */
async function expectTheDayKept(page: Page, isStill: boolean): Promise<void> {
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("data-held", "yes");
  // The day stays the visitor's, to drag and swap, while its proposal is on its way.
  await expect(chart).toHaveAttribute("aria-busy", "false");
  // While it is written, the sentence says both answers; once it has failed, the visitor's.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    isStill ? /with friends$/ : new RegExp(`with friends or ${WORD}$`),
    { useInnerText: true },
  );
  await expect(page.getByRole("list", { name: "The day" }).getByRole("listitem")).not.toHaveCount(
    0,
  );
}

test.describe("under reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the day holds its place while the day asked for is on its way, and says so", async ({
    page,
  }) => {
    await openLiveBench(page);
    await markTheDay(page);
    // The route never answers: the day stays on its way.
    await page.route(DAY_ROUTE, () => undefined);

    await changeWord(page, "with friends", /with family/);

    await expect(said(page, REPLANNING)).toBeVisible();
    await expectTheDayKept(page, false);
    // A second word would spend another day on one about to give way: none can be opened.
    await expect(
      page
        .getByRole("heading", { level: 1 })
        .getByRole("button", { name: "eating late", exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  for (const [ending, line, answer] of [
    [
      "our limit",
      LIMITED,
      (route: Route) => route.fulfill({ status: HTTP_TOO_MANY_REQUESTS, body: "" }),
    ],
    [
      "the route unavailable",
      NOT_JUST_NOW,
      (route: Route) => route.fulfill({ status: HTTP_SERVICE_UNAVAILABLE, body: "" }),
    ],
    ["a failed connection", CONNECTION_DROPPED, (route: Route) => route.abort("failed")],
  ] as const) {
    test(`a re-plan that ends in ${ending} keeps the day as it was, and says why`, async ({
      page,
    }) => {
      await openLiveBench(page);
      await markTheDay(page);
      await page.route(DAY_ROUTE, answer);

      await changeWord(page, "with friends", /with family/);

      await expect(workSaid(page, line)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
      await expect(said(page, REPLANNING)).toHaveCount(0);
      await expectTheDayKept(page, true);
    });
  }

  test("a re-plan that comes back empty is asked for once more, then takes the page", async ({
    page,
  }) => {
    await openLiveBench(page);
    await markTheDay(page);
    const asked: string[] = [];
    await page.route(DAY_ROUTE, (route) => {
      asked.push(route.request().postData() ?? "");
      return asked.length === 1
        ? route.fulfill({ contentType: "text/event-stream", body: EMPTY_DAY_STREAM })
        : route.continue({ postData: JSON.stringify(BOLOGNA_REQUEST) });
    });

    await changeWord(page, "with friends", /with family/);
    await takeProposal(page, "with family");

    const headline = page.getByRole("heading", { level: 1 });
    await expect(headline).not.toContainText("with friends", { timeout: DAY_TIMEOUT_MS });
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    expect(asked).toHaveLength(2);
    expect(asked[1]).toBe(asked[0]);
    await expect(workSaid(page, NOT_FINISHED)).toHaveCount(0);
  });

  test("a re-plan that comes back empty twice keeps the day as it was, and says so", async ({
    page,
  }) => {
    await openLiveBench(page);
    await markTheDay(page);
    let asked = 0;
    await page.route(DAY_ROUTE, (route) => {
      asked += 1;
      return route.fulfill({ contentType: "text/event-stream", body: EMPTY_DAY_STREAM });
    });

    await changeWord(page, "with friends", /with family/);

    await expect(workSaid(page, NOT_FINISHED)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await expectTheDayKept(page, true);
    expect(asked).toBe(2);
  });
});

test.describe("with motion", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await page.setViewportSize(isMobile ? PHONE : LAPTOP);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // The chart's top on the page, each frame from the first: null while there is none.
    await page.addInitScript(() => {
      window.chartTops = [];
      const sample = () => {
        const chart = document.querySelector('[role="group"][aria-label^="The day\'s energy"]');
        window.chartTops.push(chart ? chart.getBoundingClientRect().top + window.scrollY : null);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });

  test(
    "a re-plan that streams takes the page, its chart gliding to its place",
    { tag: "@frame" },
    async ({ page, isMobile }) => {
      await openLiveBench(page);
      // Answered with another day, whose header is of another height on a phone.
      await page.route(DAY_ROUTE, (route) =>
        route.continue({ postData: JSON.stringify(NAFPLIO_START_REQUEST) }),
      );
      const from = await page.evaluate(() => window.chartTops.length);

      await changeWord(page, "with friends", /with family/);
      await takeProposal(page, "with family");

      // The day before stands, rows and words, until the new day is whole and taken, and the new
      // day lands whole in one pass: its stops with it, and the chart's way is the header's room,
      // which glides from the day before's room to its own as it lands, over about 0.5 s.
      await expect(page.getByText(NAFPLIO_FIRST_PLACE, { exact: true }).first()).toBeVisible({
        timeout: DAY_TIMEOUT_MS,
      });
      const landed = await page.evaluate(() => window.chartTops.length);
      // Measured once it rests after the landing's glide: as the stops land, the chart still
      // stands where the day before had it, so a rest read then is no rest.
      await expect
        .poll(
          () =>
            page.evaluate(
              ({ frames, still, since, glide }) => {
                const last = window.chartTops.slice(-frames);
                const first = last[0];
                return (
                  window.chartTops.length - since >= glide &&
                  last.length === frames &&
                  first != null &&
                  last.every((top) => top !== null && Math.abs(top - first) < still)
                );
              },
              { frames: REST_FRAMES, still: STILL_PX, since: landed, glide: LANDING_GLIDE_FRAMES },
            ),
          { timeout: DAY_TIMEOUT_MS },
        )
        .toBe(true);
      const tops = (await page.evaluate(() => window.chartTops))
        .slice(from)
        .filter((top): top is number => top !== null);
      const moves = tops.slice(1).map((top, index) => top - (tops[index] ?? top));
      const way = Math.abs((tops.at(-1) ?? 0) - (tops[0] ?? 0));
      const largest = Math.max(0, ...moves.map(Math.abs));
      // On a laptop the two headers are one height; on a phone the new one is taller.
      if (isMobile) expect(way).toBeGreaterThan(PHONE_WAY_PX);
      // The whole way in one frame is a step; a glide spreads it over its frames.
      if (way > STILL_PX)
        expect(largest, `the chart's way: ${way} px`).toBeLessThanOrEqual(way * GLIDE_SHARE);
      else expect(largest).toBeLessThanOrEqual(STILL_PX);
    },
  );

  // It reads the chart's frames too, but it is about a slow server's empty day asked for again,
  // so it runs on every pull request, outside `@frame` (docs/harness.md, "End-to-end").
  test("a first day that comes back empty holds its place while it is asked for again", async ({
    page,
  }) => {
    const { server, url } = await serveSlowEmptyDay();
    await page.addInitScript(() => {
      window.focused = [];
      document.addEventListener("focusin", (event) => {
        window.focused.push((event.target as HTMLElement).textContent ?? "");
      });
    });
    await page.goto(START);
    await page.getByRole("button", { name: "Live", exact: true }).click();
    let asked = 0;
    await page.route(DAY_ROUTE, (route) => {
      asked += 1;
      return asked === 1 ? route.continue({ url }) : route.continue();
    });
    await page
      .getByRole("textbox", { name: "Where, and anything else" })
      .fill("Bologna, with friends");
    const from = await page.evaluate(() => window.chartTops.length);

    await page.getByRole("button", { name: "Plan this day" }).click();

    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    server.close();
    expect(asked).toBe(2);
    // The same day asked again is never drawn from its empty frame: its header keeps the room
    // the empty day's words took, and glides on from there once the day has begun.
    const tops = (await page.evaluate(() => window.chartTops))
      .slice(from)
      .filter((top): top is number => top !== null);
    expect(stepsOf(tops)).toEqual([]);
    // Its city word took the focus once, and kept it: no city word drawn again took it.
    const focused = await page.evaluate(() => window.focused);
    expect(focused.filter((words) => words.startsWith("Bologna"))).toHaveLength(1);
  });
});
