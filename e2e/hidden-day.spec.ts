import { expect, test, type Request, waitMs } from "./fixtures";

// A day written while another page of the site shows (`docs/decisions.md`, "A day reads on while
// its page is hidden"): Next keeps the page a client navigation leaves, hidden, and the day's
// stream reads on behind it, so Back finds the day written to its end, asked of the route once.

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const TEST_MS = waitMs(90_000);
/** What the start screen says over its index of the days Lantern has written. */
const INDEX_LABEL = "No city in mind? Start from one of these";
const ENERGY = '[aria-label^="The day\'s energy"]';

test("a day left for the privacy page while it is written is written on, and Back finds it whole, asked once", async ({
  page,
}) => {
  test.setTimeout(TEST_MS);
  const posts: Request[] = [];
  const finished = new Set<Request>();
  const failed = new Set<Request>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/api/day") posts.push(request);
  });
  page.on("requestfinished", (request) => finished.add(request));
  page.on("requestfailed", (request) => failed.add(request));

  await page.goto("/");
  await page
    .getByRole("list", { name: INDEX_LABEL })
    .getByRole("button", { name: /^Paris / })
    .click();
  await expect(page).toHaveURL(/\/day\/paris$/, { timeout: DAY_TIMEOUT_MS });
  const energy = page.locator(ENERGY);
  await expect(energy).toHaveAttribute("aria-busy", "true");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy and terms" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy and terms");

  // The day's page is kept, hidden, with its day still being read.
  expect(posts).toHaveLength(1);
  const post = posts[0] as Request;
  expect(finished.has(post)).toBe(false);
  const dayHeadline = page.locator("h1").filter({ hasText: /in Paris/ });
  await expect(dayHeadline).toHaveCount(1);
  await expect(dayHeadline).toBeHidden();
  await expect(energy).toHaveAttribute("aria-busy", "true");
  // Its stream is read to its end while the privacy page shows.
  await expect.poll(() => finished.has(post), { timeout: DAY_TIMEOUT_MS }).toBe(true);
  expect(failed.has(post)).toBe(false);
  await expect(page).toHaveURL(/\/privacy$/);

  await page.goBack();

  await expect(page).toHaveURL(/\/day\/paris$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("in Paris");
  await expect(energy).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  expect(posts).toHaveLength(1);
});
