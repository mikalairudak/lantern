import { expect, test, type Page, waitMs } from "./fixtures";
import { INDEX_LABEL } from "../src/features/day/start-index";
import { OPEN_IT_AGAIN, PAGE_FAILED } from "../src/features/day/page-failed";

/**
 * The page for a failure, which takes the page's place when the page throws as it is drawn in
 * the browser: a stream the page cannot read stands in for that bug here, as no visitor's
 * press can make one. The press that met the failure goes with the page it was on, so the
 * failure's headline takes the focus; "Open it again" goes with the page for a failure, so the
 * page that comes back takes it where it lands a chosen day's.
 */

/** A written day lands in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const DAY_ROUTE = "**/api/day";

/** A day's stream whose one text is no day: its stops are a word, which the page throws on. */
const UNREADABLE_STREAM = [
  { type: "start" },
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta: JSON.stringify({ title: "x", dek: "y", stops: "oops" }) },
  { type: "text-end", id: "t" },
  { type: "finish" },
]
  .map((event) => `data: ${JSON.stringify(event)}\n\n`)
  .concat("data: [DONE]\n\n")
  .join("");

test.use({ reducedMotion: "reduce" });

/** Every day the page asks for from now on is answered with a stream it cannot read. */
async function failEveryDay(page: Page): Promise<void> {
  await page.route(DAY_ROUTE, (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: UNREADABLE_STREAM,
    }),
  );
}

function headline(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

test("a city pressed on the start screen that fails hands the focus to the failure's headline, and Open it again to the start screen's", async ({
  page,
}) => {
  await failEveryDay(page);
  await page.goto("/");
  await page
    .getByRole("list", { name: INDEX_LABEL })
    .getByRole("button", { name: /^Paris / })
    .focus();
  await page.keyboard.press("Enter");

  await expect(headline(page)).toHaveText(PAGE_FAILED, { timeout: DAY_TIMEOUT_MS });
  await expect(headline(page)).toBeFocused();

  await page.unroute(DAY_ROUTE);
  await page.getByRole("button", { name: OPEN_IT_AGAIN }).focus();
  await page.keyboard.press("Enter");

  await expect(headline(page)).toHaveText(/^One day in a city/, { timeout: DAY_TIMEOUT_MS });
  await expect(headline(page)).toBeFocused();
});

// Whether a page that failed as it opened takes the focus turns on whether anything was pressed
// on it, which a page driven from here always reads as so: the component test holds that case.
test("a day's own page that fails as it opens hands the focus to the day's city word on Open it again", async ({
  page,
}) => {
  await failEveryDay(page);
  await page.goto("/day/kanazawa");

  await expect(headline(page)).toHaveText(PAGE_FAILED, { timeout: DAY_TIMEOUT_MS });

  await page.unroute(DAY_ROUTE);
  await page.getByRole("button", { name: OPEN_IT_AGAIN }).focus();
  await page.keyboard.press("Enter");

  await expect(headline(page)).toContainText("Kanazawa", { timeout: DAY_TIMEOUT_MS });
  await expect(headline(page).getByRole("button", { name: "Kanazawa", exact: true })).toBeFocused({
    timeout: DAY_TIMEOUT_MS,
  });
});
