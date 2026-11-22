import { expect, test, type Page, waitMs } from "./fixtures";
import { axeResultsOf, type Exemption, violationsOf, WCAG_AA_TAGS } from "./axe";
import { openLive, seeWrittenDay } from "./live-page";
import { writtenDayAt } from "../src/lib/days/written/days";
import { YOUR_DAYS_KEY, type YourDay } from "../src/features/day/your-days";
import { DAY_ID_HEADER } from "../src/lib/days/stored-day";
import { KANAZAWA_LATE_DINNER } from "../src/lib/fixtures/replan/kanazawa-dinner";
import type { GeneratedReplan } from "../src/lib/schema/replan.schema";

/**
 * axe's rules for WCAG 2.0, 2.1 and 2.2 at levels A and AA, over the pages and states a visitor
 * reaches, in both themes, at a laptop's width and a phone's (the two projects). A state fails on
 * any violation. What axe cannot decide, contrast over the plate paper and under SVG above all,
 * it reports as incomplete, which fails nothing here: the specs that measure pixels hold it
 * (`e2e/forced-colours.spec.ts`). Target size is off in axe by default and is turned on, since
 * WCAG 2.2 asks for it at AA (`docs/decisions.md`, "axe checks the pages a visitor reaches
 * against WCAG's A and AA rules, in the e2e").
 */

/** A written day lands in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const KANAZAWA = writtenDayAt("kanazawa")!;
const KANAZAWA_ADDRESS = "/day/kanazawa";
const INDEX_HEADING = "No city in mind? Start from one of these";
/** The re-plan's row in the log, as its answer names it. */
const REPLAN_ID = "6c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
/** Long enough into an unseen day's play that its first rows are written and more are coming. */
const MID_PLAY_MS = 4_000;
/** The recorded re-plan's first new stop, in place of Kanazawa's evening. */
const PROPOSAL_FIRST_STOP = "Nagamachi Samurai District";
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

test.use({ reducedMotion: "reduce" });

/** A theme kept from an earlier visit, in place before the page's first script runs. */
async function keepTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((kept) => localStorage.setItem("lantern-theme", kept), theme);
}

/** Opens the day in the view given, as a visitor who chose it before. */
async function chooseView(page: Page, view: "chart" | "read"): Promise<void> {
  await page.addInitScript((chosen) => localStorage.setItem("lantern-day-view", chosen), view);
}

/** The day on screen is written whole: its chart, shown or not, is still. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

function headlineWord(page: Page, word: string) {
  return page.getByRole("heading", { level: 1 }).getByRole("button", { name: word, exact: true });
}

/** The re-plan's stream as the route sends it, whole, its text in deltas. */
function replanStreamOf(replan: GeneratedReplan): string {
  const whole = JSON.stringify(replan);
  const events: object[] = [{ type: "start" }, { type: "text-start", id: "t" }];
  for (let start = 0; start < whole.length; start += 200) {
    events.push({ type: "text-delta", id: "t", delta: whole.slice(start, start + 200) });
  }
  events.push({ type: "text-end", id: "t" }, { type: "finish" });
  return [...events.map((event) => `data: ${JSON.stringify(event)}\n\n`), "data: [DONE]\n\n"].join(
    "",
  );
}

/** Kanazawa's whole day, with a changed dinner's proposal drawn beside it. */
async function openTheFork(page: Page): Promise<void> {
  await seeWrittenDay(page, "kanazawa", KANAZAWA.itinerary);
  await openLive(page, KANAZAWA_ADDRESS);
  await waitForTheDay(page);
  await page.route("**/api/replan", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", [DAY_ID_HEADER]: REPLAN_ID },
      body: replanStreamOf(KANAZAWA_LATE_DINNER),
    }),
  );
  await headlineWord(page, "early dinner").click();
  // An answer says what it will do only once the page knows Lantern writes.
  const answer = page.getByRole("option", { name: "eating late" });
  await expect(answer).toHaveAccessibleDescription(/\S/, { timeout: DAY_TIMEOUT_MS });
  await answer.click();
  // Whole, the proposal's first new stop stands beside the day.
  await expect(
    page.locator('ol[aria-label="The day"] > li').filter({ hasText: PROPOSAL_FIRST_STOP }),
  ).toHaveCount(1, { timeout: DAY_TIMEOUT_MS });
  await expect(page.getByRole("radiogroup").first()).toBeVisible();
}

/** A whole written day, seen on this device, in the view given. */
async function openSeenDay(page: Page, view: "chart" | "read"): Promise<void> {
  await chooseView(page, view);
  await seeWrittenDay(page, "kanazawa", KANAZAWA.itinerary);
  await page.goto(KANAZAWA_ADDRESS);
  await waitForTheDay(page);
}

interface State {
  name: string;
  /** Opens the state on a fresh page whose theme is already kept. */
  open: (page: Page) => Promise<void>;
  /**
   * What axe reports here that fails no criterion, each still reported, so an exemption that
   * stops applying is taken out rather than left to cover something new.
   */
  exemptions?: readonly Exemption[];
}

/**
 * An energy word's option is named by its answer, the word it shows first, and described by
 * the line under it, what the answer would do. WCAG 2.5.3 asks that the name contain the
 * visible label, which it does and starts with; axe reads every word inside an option as its
 * label.
 */
const ENERGY_OPTION_NAMED_BY_ITS_ANSWER: Exemption = {
  rule: "label-content-name-mismatch",
  selector: '[role="listbox"][aria-label="The day\'s energy"] [role="option"]',
  why: "An option's name is its answer; the line under it is its description.",
};

const STATES: readonly State[] = [
  {
    name: "the start screen",
    open: async (page) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: INDEX_HEADING })).toBeVisible();
    },
  },
  {
    name: "the start screen with a day of the visitor's being written",
    open: async (page) => {
      const id = "a-day-being-written";
      const day: YourDay = {
        id,
        request: { ...KANAZAWA.request, city: "Elche", timezone: "Europe/Madrid" },
        startedAt: new Date().toISOString(),
        energies: [],
        ending: "writing",
        seconds: null,
      };
      await page.addInitScript(([key, kept]) => localStorage.setItem(key, kept), [
        YOUR_DAYS_KEY,
        JSON.stringify([day]),
      ] as const);
      await page.route(`**/api/day/${id}`, (route) =>
        route.fulfill({ json: { status: "unknown" } }),
      );
      await page.goto("/");
      await expect(page.getByRole("list", { name: "Your days" })).toBeVisible();
    },
  },
  {
    name: "the start screen's answer to a text it cannot plan",
    open: async (page) => {
      await page.goto("/");
      const field = page.getByRole("textbox", { name: "Where, and anything else" });
      await field.fill("a quiet day somewhere");
      await field.press("Enter");
      await expect(
        page.locator("main form").getByText("Start from one of the days below.", { exact: false }),
      ).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    },
  },
  {
    name: "a day's plan",
    open: (page) => openSeenDay(page, "read"),
  },
  {
    name: "a day's chart",
    open: (page) => openSeenDay(page, "chart"),
  },
  {
    name: "a stop's details open on the chart",
    open: async (page) => {
      await openSeenDay(page, "chart");
      await page.getByRole("list", { name: "The day" }).getByRole("button").first().click();
      await expect(page.getByRole("region", { name: /^About / })).toBeFocused();
    },
  },
  {
    name: "the energy word's list open",
    open: async (page) => {
      await openSeenDay(page, "read");
      await headlineWord(page, "calm").click();
      await expect(page.getByRole("listbox", { name: "The day's energy" })).toBeVisible();
    },
    exemptions: [ENERGY_OPTION_NAMED_BY_ITS_ANSWER],
  },
  {
    name: "the day's menu open",
    open: async (page) => {
      await openSeenDay(page, "read");
      await page.getByRole("button", { name: "Take this day" }).click();
      await expect(page.getByRole("menuitem").first()).toBeVisible();
    },
  },
  {
    name: "a day being written, on its plan",
    open: async (page) => {
      await chooseView(page, "read");
      await page.goto(KANAZAWA_ADDRESS);
      // Mid-play by design: the rows written so far, and the rest still coming.
      await page.waitForTimeout(MID_PLAY_MS);
    },
  },
  {
    name: "a changed word's proposal beside the day",
    open: openTheFork,
  },
  {
    name: "the privacy page",
    open: async (page) => {
      await page.goto("/privacy");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
  },
  {
    name: "the page for an address that names no day",
    open: async (page) => {
      await page.goto("/day/vienna");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
  },
];

for (const theme of THEMES) {
  for (const state of STATES) {
    test(`in the ${theme} theme, ${state.name} breaks no WCAG A or AA rule axe checks`, async ({
      page,
    }) => {
      await keepTheme(page, theme);
      await state.open(page);
      const results = await axeResultsOf(page, {
        runOnly: { type: "tag", values: [...WCAG_AA_TAGS] },
        rules: { "target-size": { enabled: true } },
      });
      // A run that checked nothing proves nothing.
      expect(results.passes.length, "axe passed no rule at all").toBeGreaterThan(0);
      const { failures, exempted } = await violationsOf(page, results.violations, state.exemptions);
      expect(failures).toEqual([]);
      for (const exemption of state.exemptions ?? []) {
        expect(
          exempted.some((line) => line.startsWith(`${exemption.rule} `)),
          `${exemption.rule} is exempted here but no longer reported: take the exemption out`,
        ).toBe(true);
      }
    });
  }
}
