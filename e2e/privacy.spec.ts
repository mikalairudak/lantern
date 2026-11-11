import { expect, test, type Page, waitMs } from "./fixtures";

/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** The page's own heading, the name the foot line gives it. */
const PRIVACY_HEADING = "Privacy and terms";
/** Where a visitor writes to have their text deleted. */
const CONTACT = "mailto:support@lanternday.com";
/** The widths the page is judged at: the narrowest phone, a common one, a laptop. */
const WIDTHS = [320, 390, 1440];
/** Every part of the page, in the order it reads. */
const SECTIONS = [
  "In short",
  "What Lantern keeps",
  "Why",
  "Who handles it",
  "How long",
  "Your rights",
  "Terms",
  "Contact",
];
/**
 * The address stands in the short version, beside who handles the data (for their names),
 * under the visitor's rights and in the contact line, whether Lantern writes new days or not.
 */
const CONTACT_LINKS = 4;
/** Where a day can be ended each way, faster than it streams. */
const BENCH = "/lab/concepts/day";
/** Every way the bench ends a day without one. */
const ENDINGS_WITHOUT_A_DAY = [
  "error-mid-plan",
  "dropped-mid-plan",
  "offline",
  "refused-mid-plan",
  "invalid",
  "rejected",
  "limited",
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/**
 * The page's last line, its contentinfo, leads to what Lantern keeps, and gives the address
 * to write to.
 */
async function followsTheFootLine(page: Page): Promise<void> {
  const foot = page.getByRole("contentinfo");
  const privacy = foot.getByRole("link", { name: "Privacy and terms" });
  await expect(privacy).toHaveAttribute("href", "/privacy", { timeout: DAY_TIMEOUT_MS });
  await expect(foot.getByRole("link", { name: "support@lanternday.com" })).toHaveAttribute(
    "href",
    CONTACT,
  );
  await privacy.click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PRIVACY_HEADING);
}

test("the start screen ends with what Lantern keeps and where to write, and no source", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "© OpenStreetMap contributors" })).toHaveCount(0);
  await followsTheFootLine(page);
});

test("a day ends with what Lantern keeps and where to write, beside its sources", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");

  const foot = page.getByRole("contentinfo");
  await expect(foot.getByRole("link", { name: "© OpenStreetMap contributors" })).toBeVisible({
    timeout: DAY_TIMEOUT_MS,
  });
  await followsTheFootLine(page);
});

test("the page for no day ends with the same line", async ({ page }) => {
  await page.goto("/day/paris");

  await followsTheFootLine(page);
});

// A day that ends without one takes its chart, and its sources with it, but the page still
// ends with what Lantern keeps: after "our limit" above all, which a visitor reads about there.
for (const ending of ENDINGS_WITHOUT_A_DAY) {
  test(`a day ended without one (${ending}) still ends with what Lantern keeps`, async ({
    page,
  }) => {
    await page.goto(BENCH);
    const controls = page.getByRole("complementary", { name: "Lab controls" });
    await controls.getByRole("button", { name: "Ending" }).click();
    await controls.getByRole("combobox", { name: "Pace" }).selectOption("Ten times faster");
    await controls.getByRole("combobox", { name: "Ending" }).selectOption(ending);
    await controls.getByRole("button", { name: "Ending" }).click();

    const credit = page.getByRole("link", { name: "© OpenStreetMap contributors" });
    const foot = page.getByRole("contentinfo").filter({ hasNot: credit });
    await expect(foot.getByRole("link", { name: "Privacy and terms" })).toBeVisible({
      timeout: DAY_TIMEOUT_MS,
    });
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveCount(0);
    await expect(credit).toHaveCount(0);
    await expect(foot.getByRole("link", { name: "support@lanternday.com" })).toBeVisible();
  });
}

test("says the short version first, then each part, the terms and where to write", async ({
  page,
}) => {
  await page.goto("/privacy");

  await expect(page).toHaveTitle("Privacy and terms · Lantern");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(SECTIONS);
  await expect(page.locator("#terms").getByRole("heading")).toHaveText("Terms");
  const contacts = page.getByRole("link", { name: "support@lanternday.com" });
  await expect(contacts).toHaveCount(CONTACT_LINKS);
  for (const contact of await contacts.all())
    await expect(contact).toHaveAttribute("href", CONTACT);
  await expect(page.getByRole("link", { name: "Lantern", exact: true })).toHaveAttribute(
    "href",
    "/",
  );
});

// The e2e server runs without LIVE_GENERATION, as a deployment with live generation off does.
test("with live generation off, says what is typed stays in the browser, and what the rest describes", async ({
  page,
}) => {
  await page.goto("/privacy");

  await expect(
    page.getByText(
      "Lantern isn't writing new days right now, so what you type is read in your browser and never sent.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("The sections below describe Lantern when it writes days."),
  ).toBeVisible();
  await expect(page.getByText(/coded form of your IP address/)).toHaveCount(0);
});

for (const width of WIDTHS) {
  test(`the privacy page never scrolls sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Terms", exact: true })).toBeAttached();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
