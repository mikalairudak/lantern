import { expect, test, waitMs } from "./fixtures";

/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };
/**
 * The short pages, each on a screen taller than it. Since the six quick starts the start
 * screen is taller than a phone's, so it is short on a laptop alone.
 */
const SHORT_PAGES = [
  { address: "/", screen: LAPTOP },
  { address: "/nope", screen: PHONE },
  { address: "/nope", screen: LAPTOP },
];
/** How far a line may stand from where it is measured to be, in px. */
const TOLERANCE_PX = 1;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

// A short page ends with its last line at the foot of the screen, never halfway up it over an empty
// sheet.
for (const { address, screen } of SHORT_PAGES) {
  test(`${address} at ${screen.width} px holds its last line at the foot of the screen`, async ({
    page,
  }) => {
    await page.setViewportSize(screen);
    await page.goto(address);
    const foot = page.getByRole("contentinfo");
    await expect(foot.getByRole("link", { name: "Privacy and terms" })).toBeVisible();

    const [box, scrolled] = await Promise.all([
      foot.boundingBox(),
      page.evaluate(() => ({ height: document.documentElement.scrollHeight })),
    ]);
    if (!box) throw new Error("The page has no last line");
    expect(scrolled.height).toBe(screen.height);
    expect(Math.abs(box.y + box.height - screen.height)).toBeLessThanOrEqual(TOLERANCE_PX);
  });
}

/** The room between the day's end and the rule over the page's foot, at the least. */
const FOOT_APART_PX = 40;

// A day credits its sources in the page's foot, apart from the day by a rule and its room: on the
// left of Lantern's own links on a laptop, under them on a phone.
for (const screen of [PHONE, LAPTOP]) {
  test(`at ${screen.width} px a day's sources stand in the page's foot, apart from the day`, async ({
    page,
  }) => {
    await page.setViewportSize(screen);
    await page.goto("/day/kanazawa");
    const foot = page.getByRole("contentinfo");
    const credit = foot.getByRole("link", { name: "© OpenStreetMap contributors" });
    await expect(credit).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await expect(page.getByRole("main").getByRole("link", { name: /OpenStreetMap/ })).toHaveCount(
      0,
    );

    const privacy = foot.getByRole("link", { name: "Privacy and terms" });
    // The day's end's last way, after the masthead's own.
    const end = page.getByRole("button", { name: "Plan another day" }).last();
    const [creditBox, privacyBox, footBox, endBox] = await Promise.all([
      credit.boundingBox(),
      privacy.boundingBox(),
      foot.boundingBox(),
      end.boundingBox(),
    ]);
    if (!creditBox || !privacyBox || !footBox || !endBox) throw new Error("The day did not render");
    expect(footBox.y - (endBox.y + endBox.height)).toBeGreaterThanOrEqual(FOOT_APART_PX);
    const rule = await foot.evaluate((element) => getComputedStyle(element).borderTopWidth);
    expect(rule).toBe("1px");
    if (screen === LAPTOP) {
      // One line: the sources from the page's left edge, Lantern's links to its right edge.
      expect(Math.abs(creditBox.y - privacyBox.y)).toBeLessThanOrEqual(TOLERANCE_PX);
      expect(Math.abs(creditBox.x - footBox.x)).toBeLessThanOrEqual(TOLERANCE_PX);
      const contact = foot.getByRole("link", { name: "support@lanternday.com" });
      const contactBox = await contact.boundingBox();
      if (!contactBox) throw new Error("The foot has no address");
      expect(
        Math.abs(contactBox.x + contactBox.width - (footBox.x + footBox.width)),
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    } else {
      // Lantern's links, then the sources under them as the page's last line.
      expect(creditBox.y).toBeGreaterThan(privacyBox.y + privacyBox.height);
      expect(Math.abs(creditBox.x - privacyBox.x)).toBeLessThanOrEqual(TOLERANCE_PX);
    }
  });
}
