import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/** The route lands a written day in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** The day, its invitation and five reopenings, on a dev server that compiles. */
const TEST_TIMEOUT_MS = waitMs(60_000);
/** How long a list's height must hold to count as unfolded. */
const UNFOLD_STEP_MS = 150;
/**
 * How long after Escape the visitor presses Enter again. The pickers roll back on the
 * layout spring and the sheet on the snappy one, so the shorter gaps catch each still
 * rolling back and reopen it before it has gone; the longest opens a fresh one.
 */
const REOPEN_GAPS_MS = [50, 100, 200, 300, 450];
/** A reopening this soon after Escape always finds the panel still rolling back. */
const STILL_ROLLING_MS = 100;

/** Each Escape and Enter pressed, with whether the panel was still there at the press. */
interface Press {
  key: string;
  at: number;
  isPanelThere: boolean;
}

test.describe.configure({ timeout: TEST_TIMEOUT_MS });

test.beforeEach(async ({ page }) => {
  // Under reduced motion a picker goes at once, and there is nothing to reopen.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/day/kanazawa");
  // Written and settled: the ring that invites the first drag is drawn only then, and the
  // page changes nothing by itself after it.
  await expect(page.locator("[data-invitation] circle")).toBeVisible({ timeout: DAY_TIMEOUT_MS });
});

function headline(page: Page): Locator {
  return page.getByRole("main").getByRole("heading", { level: 1 });
}

/** Notes each Escape and Enter as the page receives it, before anything handles it. */
async function recordPresses(page: Page, panel: string): Promise<void> {
  await page.evaluate((selector) => {
    const presses: Press[] = [];
    Object.assign(window, { presses });
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" && event.key !== "Enter") return;
        presses.push({
          key: event.key,
          at: performance.now(),
          isPanelThere: document.querySelector(selector) !== null,
        });
      },
      { capture: true },
    );
  }, panel);
}

/** The last Escape and the Enter after it: how far apart, and whether the panel was there. */
async function lastReopening(page: Page): Promise<{ gap: number; isRevived: boolean }> {
  const presses = await page.evaluate(() => (window as unknown as { presses: Press[] }).presses);
  const enter = presses.at(-1);
  const escape = presses.at(-2);
  if (enter?.key !== "Enter" || escape?.key !== "Escape") {
    throw new Error("Expected an Escape and then an Enter");
  }
  return { gap: enter.at - escape.at, isRevived: enter.isPanelThere };
}

/**
 * Escape closes the panel, Enter on what opened it opens it again after `gap`, and the
 * reopening is told: whether it caught the panel still rolling back, and the real gap.
 */
async function reopenAfter(page: Page, gap: number): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(gap);
  await page.keyboard.press("Enter");
  const { gap: pressed, isRevived } = await lastReopening(page);
  test.info().annotations.push({
    type: "reopen",
    description: `${gap} ms asked, ${Math.round(pressed)} ms pressed, ${isRevived ? "revived" : "fresh"}`,
  });
  // A loaded machine presses later than asked, so the message names the gap it pressed at.
  if (gap <= STILL_ROLLING_MS) {
    expect(
      isRevived,
      `still rolling back at ${gap} ms asked, ${Math.round(pressed)} ms pressed`,
    ).toBe(true);
  }
}

test("the city list reopened just after Escape gives the focus to the day's own row", async ({
  page,
}) => {
  const city = headline(page).getByRole("button", { name: "Kanazawa", exact: true });
  const where = page.getByRole("group", { name: "Where" });
  const thisDay = where.getByRole("button", { name: /^Kanazawa\s*this day$/ });
  await recordPresses(page, '[role="group"][aria-label="Where"]');
  await city.focus();
  await page.keyboard.press("Enter");
  await expect(thisDay).toBeFocused();

  for (const gap of REOPEN_GAPS_MS) {
    // Moved off the day's row first, so only a reopening that marks it again passes.
    await page.keyboard.press("ArrowDown");
    await expect(thisDay).not.toBeFocused();
    await reopenAfter(page, gap);
    await expect(thisDay, `reopened ${gap} ms after Escape`).toBeFocused();
  }

  await page.keyboard.press("Escape");
  await expect(city).toHaveAttribute("aria-expanded", "false");
  await expect(city).toBeFocused();
  await expect(where).toHaveCount(0);
});

test("the energy word reopened just after Escape puts the list on the current energy", async ({
  page,
}) => {
  const word = headline(page).getByRole("button", { name: "calm", exact: true });
  const list = page.getByRole("listbox", { name: "The day's energy" });
  const calm = list.getByRole("option", { name: "calm", exact: true });
  const active = () => list.getAttribute("aria-activedescendant");
  await recordPresses(page, '[role="listbox"][aria-label="The day\'s energy"]');
  await word.focus();
  await page.keyboard.press("Enter");
  await expect(list).toBeFocused();
  await expect(calm).toHaveAttribute("aria-selected", "true");
  const calmId = await calm.getAttribute("id");

  for (const gap of REOPEN_GAPS_MS) {
    // Moved off the current energy first, so only a reopening that marks it again passes.
    await page.keyboard.press("ArrowDown");
    expect(await active()).not.toBe(calmId);
    await reopenAfter(page, gap);
    await expect(list, `reopened ${gap} ms after Escape`).toBeFocused();
    await expect(list).toHaveAttribute("aria-activedescendant", calmId ?? "");
  }

  await page.keyboard.press("Escape");
  await expect(word).toHaveAttribute("aria-expanded", "false");
  await expect(word).toBeFocused();
  await expect(list).toHaveCount(0);
});

/** The page's gutter, which every open list keeps inside (panel-shift.ts). */
const LIST_GUTTER = 16;
/** Long enough for a list's snappy spring to have opened it whole. */
const OPENING_MS = 600;

/** What opens each list, and how a test finds it on Kanazawa's day. */
const OPENERS = [
  {
    name: "the energy word",
    find: (page: Page) => headline(page).getByRole("button", { name: "calm", exact: true }),
  },
  {
    name: "the city word",
    find: (page: Page) => headline(page).getByRole("button", { name: "Kanazawa", exact: true }),
  },
];

for (const opener of OPENERS) {
  test(
    `${opener.name} stays where it is while its list opens, the list inside the page`,
    { tag: "@frame" },
    async ({ page }) => {
      const trigger = opener.find(page);
      // Read in the page, frame by frame, from the press to the list at rest.
      const { moves, edges, width } = await trigger.evaluate(async (element, openingMs) => {
        const boxOf = (each: Element) => each.getBoundingClientRect();
        const closed = boxOf(element);
        const seen: { moves: number[]; edges: { left: number; right: number }[] } = {
          moves: [],
          edges: [],
        };
        (element as HTMLElement).click();
        const start = performance.now();
        while (performance.now() - start < openingMs) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const now = boxOf(element);
          seen.moves.push(
            Math.max(
              Math.abs(now.x - closed.x),
              Math.abs(now.y - closed.y),
              Math.abs(now.width - closed.width),
              Math.abs(now.height - closed.height),
            ),
          );
          const list = document.querySelector("[data-word-list]");
          if (list) seen.edges.push({ left: boxOf(list).left, right: boxOf(list).right });
        }
        return { ...seen, width: document.documentElement.clientWidth };
      }, OPENING_MS);

      // The word is never drawn again over itself, so not one frame moves it.
      expect(Math.max(...moves)).toBe(0);
      expect(edges.length).toBeGreaterThan(0);
      const last = edges.at(-1);
      expect(last?.left).toBeGreaterThanOrEqual(LIST_GUTTER);
      expect(last?.right).toBeLessThanOrEqual(width - LIST_GUTTER);
    },
  );
}

test("a stop's sheet reopened just after Escape takes the focus again", async ({ page }) => {
  // The day's first stop, by its name: the button that opens its sheet.
  const name = page
    .locator('ol[aria-label="The day"] > li')
    .first()
    .locator("button[aria-expanded]");
  const sheet = page.getByRole("region", { name: /^About / });
  await recordPresses(page, '[role="region"][aria-label^="About "]');
  await name.focus();
  await page.keyboard.press("Enter");
  await expect(sheet).toBeFocused();

  for (const gap of REOPEN_GAPS_MS) {
    await reopenAfter(page, gap);
    await expect(sheet, `reopened ${gap} ms after Escape`).toBeFocused();
  }

  await page.keyboard.press("Escape");
  await expect(name).toHaveAttribute("aria-expanded", "false");
  await expect(name).toBeFocused();
  await expect(sheet).toHaveCount(0);
});

test("a word's open list stands over the scale's band, which a phone shows over the chart", async ({
  page,
}) => {
  await headline(page).getByRole("button", { name: "Kanazawa" }).click();
  const list = page.locator("[data-word-list]");
  // Unfolded whole: its height has stopped growing.
  await expect
    .poll(async () => {
      const before = (await list.boundingBox())?.height ?? 0;
      await page.waitForTimeout(UNFOLD_STEP_MS);
      return before > 0 && before === (await list.boundingBox())?.height;
    })
    .toBe(true);

  // The band takes no pointer, so it is made to for the look: whatever is drawn on top where
  // the list and the band's words meet answers.
  const onTop = await page.evaluate(() => {
    const band = document.querySelector<HTMLElement>("[data-scale-band]");
    const panel = document.querySelector("[data-word-list]");
    if (!band || !panel) return "no band or list";
    const words = band.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const y = (words.top + words.bottom) / 2;
    if (y < box.top || y > box.bottom) return "apart";
    const layer = band.parentElement;
    if (!(layer instanceof HTMLElement)) return "no layer";
    layer.style.pointerEvents = "auto";
    band.style.pointerEvents = "auto";
    const top = document.elementFromPoint((box.left + box.right) / 2, y);
    layer.style.pointerEvents = "";
    band.style.pointerEvents = "";
    return top?.closest("[data-word-list]") ? "list" : "band";
  });

  // On a laptop the list ends above the band; on a phone the city's long list runs over it.
  expect(onTop).not.toBe("band");
});
