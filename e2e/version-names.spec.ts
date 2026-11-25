import { NAME_HOLD_GRACE_MS } from "../src/features/abacus/use-name-hold";
import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const LAPTOP = { width: 1440, height: 900 };
/** A drag in steps this small crosses a switching point in one of them, never two. */
const DRAG_STEPS = 16;
/** About as far round a fingertip as it covers; the hand comes up from below it. */
const FINGER_PX = 16;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function openTheDay(page: Page, address: string): Promise<Locator> {
  await page.goto(address);
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  return chart;
}

/** The tag naming a version on the chart, if one shows. */
function tagOf(page: Page): Locator {
  return page.locator("[data-tag]");
}

/** The middle of an element, as a pointer would aim at it. */
async function middleOf(element: Locator): Promise<{ x: number; y: number }> {
  const box = await element.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("a pointer resting on a version's bead names it there, and the rows stay as they are", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const rows = page.getByRole("list", { name: "The day" });
  const written = await rows.getByRole("listitem").allTextContents();
  // Each version's bead is named to a screen reader by the version and the way it goes, and
  // is no stop of the Tab order: the stop's slider is.
  const bead = page.getByRole("button", { name: /, (quieter|livelier)$/ }).first();
  await expect(bead).toHaveAttribute("tabindex", "-1");
  const label = (await bead.getAttribute("aria-label")) ?? "";
  const [name, way] = label.split(", ");

  // Aimed at again once the pointer is over the chart: until the first touch a hover there
  // previews a pull on the chart, and the page may still be settling under it.
  await bead.scrollIntoViewIfNeeded();
  for (let aim = 0; aim < 2; aim += 1) {
    const { x, y } = await middleOf(bead);
    await page.mouse.move(x, y);
  }

  await expect(tagOf(page)).toHaveText(`${name} ${way}`);
  expect(await rows.getByRole("listitem").allTextContents()).toEqual(written);

  // Away from the beads, nothing is named.
  await page.mouse.move(0, 0);
  await expect(tagOf(page)).toHaveCount(0);
});

/** Well past the moment a name stays once the pointer is off its bead and off the name. */
const PAST_THE_GRACE_MS = NAME_HOLD_GRACE_MS * 3;
/** A pointer's way from a bead to its name, in moves as a hand makes them. */
const POINTER_STEPS = 8;
/** On Kanazawa's day at a laptop's width, a version whose name is a card over the next row. */
const NAMED_OVER_A_ROW = "Utatsuyama Craft Workshop Hill, quieter";
/** The row whose name the card lies over. */
const ROW_UNDER_THE_NAME = "Higashi Chaya District";

/** Rests the pointer on a version's bead until its name shows. */
async function restOn(page: Page, bead: Locator): Promise<void> {
  await bead.scrollIntoViewIfNeeded();
  // Aimed at again once the pointer is over the chart, as the page may still be settling.
  for (let aim = 0; aim < 2; aim += 1) {
    const { x, y } = await middleOf(bead);
    await page.mouse.move(x, y);
  }
  await expect(tagOf(page)).toHaveCount(1);
}

/** The words of the name shown, where a pointer reads them. */
function wordsOf(page: Page): Locator {
  return tagOf(page).locator(":scope > span");
}

// A name may be read with the pointer on it (WCAG 1.4.13): it stays while the pointer is on its
// bead or on the name, and takes no pointer itself, so a press under it reaches what is there.
test("a pointer's name stays with the pointer moved onto it, and goes once it is away", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  await restOn(page, page.getByRole("button", { name: /, (quieter|livelier)$/ }).first());
  const said = await tagOf(page).textContent();

  const { x, y } = await middleOf(wordsOf(page));
  await page.mouse.move(x, y, { steps: POINTER_STEPS });
  await page.waitForTimeout(PAST_THE_GRACE_MS);

  await expect(tagOf(page)).toHaveText(said ?? "");
  await page.mouse.move(0, 0, { steps: POINTER_STEPS });
  await expect(tagOf(page)).toHaveCount(0);
});

/** How many versions' beads the one-move case is tried on. */
const BEADS_MOVED_FROM_AT_ONCE = 3;
/** On Kanazawa's day at a laptop's width, a version whose name a pointer may flick onto. */
const FLICKED_ONTO = "Coffee near Hirosaka, livelier";

// A hand that crosses from a bead onto its name in one move, or two quick ones, sends no move
// after the bead's leave: the name stays with the pointer all the same.
test("a pointer's name stays with the pointer moved onto it in one move", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const beads = page.getByRole("button", { name: /, (quieter|livelier)$/ });

  for (let index = 0; index < BEADS_MOVED_FROM_AT_ONCE; index += 1) {
    await page.mouse.move(0, 0);
    await expect(tagOf(page)).toHaveCount(0);
    await restOn(page, beads.nth(index));
    const said = await tagOf(page).textContent();

    const { x, y } = await middleOf(wordsOf(page));
    await page.mouse.move(x, y);
    await page.waitForTimeout(PAST_THE_GRACE_MS);

    await expect(tagOf(page)).toHaveText(said ?? "");
  }
});

test("a pointer's name stays with the pointer flicked onto it in two moves", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const bead = page.getByRole("button", { name: FLICKED_ONTO });
  await restOn(page, bead);
  const said = await tagOf(page).textContent();

  const from = await middleOf(bead);
  const to = await middleOf(wordsOf(page));
  // A flick starts on the bead: the first move is short and stays on its target, the second
  // lands on the name.
  const target = await bead.locator("path").boundingBox();
  if (!target) throw new Error("The bead has no target");
  const toward = Math.min(1, target.width / 4 / Math.hypot(to.x - from.x, to.y - from.y));
  await page.mouse.move(from.x + (to.x - from.x) * toward, from.y + (to.y - from.y) * toward);
  await expect(tagOf(page)).toHaveText(said ?? "");
  await page.mouse.move(to.x, to.y);
  await page.waitForTimeout(PAST_THE_GRACE_MS);

  await expect(tagOf(page)).toHaveText(said ?? "");
});

/** On Kanazawa's day at a laptop's width, versions whose names lie off the bead's own pull. */
const HELD_BEFORE_THE_FIRST_TOUCH = [
  /^Gyokusen-inmaru Garden, /,
  /^Soba in Katamachi, /,
  /^Utatsuyama Craft Workshop Hill, /,
];

// Until the first touch the chart previews a pull; a name held off its bead previews none, so
// the one bead filled is the bead whose name shows.
test("a name held before the first touch previews no pull, and only its bead is filled", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const beads = page.getByRole("button", { name: /, (quieter|livelier|same energy)$/ });

  for (const name of HELD_BEFORE_THE_FIRST_TOUCH) {
    await page.mouse.move(0, 0);
    await expect(tagOf(page)).toHaveCount(0);
    const bead = page.getByRole("button", { name });
    await restOn(page, bead);
    const { x, y } = await middleOf(wordsOf(page));
    await page.mouse.move(x, y, { steps: POINTER_STEPS });
    await page.waitForTimeout(PAST_THE_GRACE_MS);
    await expect(tagOf(page)).toHaveCount(1);

    await expect(page.locator("[data-preview]")).toHaveCount(0);
    const filled = await beads.evaluateAll((all) =>
      all
        .filter((each) => each.querySelector("circle")?.classList.contains("fill-swap-drawn"))
        .map((each) => each.getAttribute("aria-label")),
    );
    expect(filled).toEqual([await bead.getAttribute("aria-label")]);
  }
});

test("a press on a row under a pointer's name reaches the row, and the name stays away", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const row = page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: new RegExp(`^${ROW_UNDER_THE_NAME}`) });
  await restOn(page, page.getByRole("button", { name: NAMED_OVER_A_ROW }));
  // A point of the name that lies over the row's name.
  const over = await wordsOf(page).evaluate((words) => {
    const box = words.getBoundingClientRect();
    for (let across = 0.95; across > 0; across -= 0.05) {
      const point = { x: box.left + box.width * across, y: box.top + box.height / 2 };
      const under = document.elementFromPoint(point.x, point.y);
      if (under?.closest('ol[aria-label="The day"] button')) return point;
    }
    return null;
  });
  if (!over) throw new Error(`The name lies over no row's name: ${ROW_UNDER_THE_NAME}'s?`);

  await page.mouse.move(over.x, over.y, { steps: POINTER_STEPS });
  await page.waitForTimeout(PAST_THE_GRACE_MS);
  await expect(tagOf(page)).toHaveCount(1);
  await page.mouse.down();
  await page.mouse.up();

  const sheet = page.getByRole("region", { name: `About ${ROW_UNDER_THE_NAME}` });
  await expect(sheet).toBeVisible();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(tagOf(page)).toHaveCount(0);
  // Folded under a pointer that has not moved, the sheet brings no name back.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.waitForTimeout(PAST_THE_GRACE_MS);
  await expect(tagOf(page)).toHaveCount(0);
});

test("Escape puts away a name the pointer rests on, over a row's words", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  await restOn(page, page.getByRole("button", { name: NAMED_OVER_A_ROW }));
  const box = await wordsOf(page).boundingBox();
  if (!box) throw new Error("The name has no box");
  // Its far end, over the next row's words.
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: POINTER_STEPS });
  await page.waitForTimeout(PAST_THE_GRACE_MS);
  await expect(tagOf(page)).toHaveCount(1);

  await page.keyboard.press("Escape");

  await expect(tagOf(page)).toHaveCount(0);
});

test("a stop's slider focused from the keys names the versions its arrows reach", async ({
  page,
}) => {
  await openTheDay(page, "/day/kanazawa");
  const slider = page.getByRole("slider", { name: /^Energy at/ }).first();
  const stop = slider.locator("..");
  const versions = await stop
    .getByRole("button")
    .evaluateAll((beads) =>
      beads.map((bead) => bead.getAttribute("aria-label")?.split(", ")[0] ?? ""),
    );

  await slider.focus();
  // Named once their words are measured, a frame after the focus.
  await expect(tagOf(page).first()).toBeVisible();
  const named = await tagOf(page).allTextContents();
  // Each tag names one of this stop's versions and no other stop's.
  for (const text of named) {
    expect(versions.some((version) => text.startsWith(version))).toBe(true);
  }

  // A key takes the stop to its liveliest version; the tags then name what the arrows reach
  // from there: only quieter ones, never the version now shown.
  await page.keyboard.press("End");
  const shown = (await slider.getAttribute("aria-valuetext"))?.split(": ")[1] ?? "";
  await expect(tagOf(page)).toHaveCount(1);
  expect(await tagOf(page).textContent()).not.toContain(shown);

  // Gone with the focus.
  await slider.blur();
  await expect(tagOf(page)).toHaveCount(0);
});

/** More than the frame a name takes to be drawn once its words are measured. */
const DRAWING_FRAMES = 10;

/** Lets the page draw a few frames, in which a name the chart would show is drawn. */
async function letFramesPass(page: Page): Promise<void> {
  await page.evaluate(async (frames) => {
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, DRAWING_FRAMES);
}

/** Rests the pointer on the day's first version's bead, aimed at again as the page settles. */
async function restOnABead(page: Page): Promise<Locator> {
  const bead = page.getByRole("button", { name: /, (quieter|livelier)$/ }).first();
  await bead.scrollIntoViewIfNeeded();
  for (let aim = 0; aim < 2; aim += 1) {
    const { x, y } = await middleOf(bead);
    await page.mouse.move(x, y);
  }
  return bead;
}

// A name may lie over a row's words: Escape puts it away, the pointer and the focus left where
// they are (WCAG 1.4.13), and an open sheet, over which nothing is named, still folds on it.
test("Escape puts away a pointer's name, the pointer still on its bead", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const bead = await restOnABead(page);
  await expect(tagOf(page)).toHaveCount(1);

  await page.keyboard.press("Escape");

  await expect(tagOf(page)).toHaveCount(0);
  expect(await bead.evaluate((element) => element.matches(":hover"))).toBe(true);
});

test("a pointer's name Escape put away stays away while the keys' focus comes and goes", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const bead = await restOnABead(page);
  await expect(tagOf(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(tagOf(page)).toHaveCount(0);
  const slider = page.getByRole("slider", { name: /^Energy at/ }).first();
  await slider.focus();
  await expect(tagOf(page).first()).toBeVisible();

  await slider.blur();

  // The focus's names leave, and the pointer's do not come back in their place.
  await expect(tagOf(page)).toHaveCount(0);
  await letFramesPass(page);
  expect(await tagOf(page).count()).toBe(0);
  expect(await bead.evaluate((element) => element.matches(":hover"))).toBe(true);
});

test("a pointer resting on a bead names it once Escape has put the focus's names away", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger never rests on a bead: a tap takes it.");
  await page.setViewportSize(LAPTOP);
  await openTheDay(page, "/day/kanazawa");
  const slider = page.getByRole("slider", { name: /^Energy at/ }).first();
  await slider.focus();
  await expect(tagOf(page).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tagOf(page)).toHaveCount(0);

  await restOnABead(page);

  await expect(tagOf(page)).toHaveCount(1);
  await expect(slider).toBeFocused();
});

test("Escape puts away the names a slider's focus shows, the focus still on it", async ({
  page,
}) => {
  await openTheDay(page, "/day/kanazawa");
  const slider = page.getByRole("slider", { name: /^Energy at/ }).first();
  await slider.focus();
  await expect(tagOf(page).first()).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(tagOf(page)).toHaveCount(0);
  await expect(slider).toBeFocused();
});

/** A stop on Kanazawa's day whose sheet is opened. */
const OPENED_STOP = "Seafood Bowls at Omicho Market";

test("Escape on a slider folds an open sheet as before, the focus still on the slider", async ({
  page,
}) => {
  await openTheDay(page, "/day/kanazawa");
  const name = page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: new RegExp(`^${OPENED_STOP}`) });
  const sheet = page.getByRole("region", { name: `About ${OPENED_STOP}` });
  await name.click();
  await expect(sheet).toBeVisible();
  const slider = page.getByRole("slider", { name: /^Energy at/ }).nth(1);
  await slider.focus();
  // Nothing is named over an open sheet.
  await expect(tagOf(page)).toHaveCount(0);

  await page.keyboard.press("Escape");

  await expect(sheet).toHaveCount(0);
  await expect(name).toHaveAttribute("aria-expanded", "false");
  await expect(slider).toBeFocused();
});

/** A phone, where most of the keys' names are cards. */
const PHONE = { width: 390, height: 844 };
/** How far a ring round a bead reaches from its middle: the knob's radius and its stroke. */
const RING_REACH_PX = 11;

test("a stop's names from the keys lie over no other stop's bead on a phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openTheDay(page, "/day/madrid");
  const sliders = page.getByRole("slider", { name: /^Energy at/ });
  const over: string[] = [];
  for (let index = 0; index < (await sliders.count()); index += 1) {
    // A stop with one version has nothing for its arrows to name.
    if ((await sliders.nth(index).locator("..").getByRole("button").count()) === 0) continue;
    await sliders.nth(index).focus();
    await expect(tagOf(page).first()).toBeVisible();
    // Every other stop's beads, each as far as a ring round it reaches, against each name.
    over.push(
      ...(await sliders.nth(index).evaluate((slider, reach) => {
        const own = slider.parentElement;
        const beads = [
          ...document.querySelectorAll(
            'svg[role="group"] g[data-candidate] circle, svg[role="group"] [data-shown-bead]',
          ),
        ].filter((bead) => !own?.contains(bead));
        return [...document.querySelectorAll("[data-tag]")].flatMap((tag) => {
          const name = tag.getBoundingClientRect();
          return beads.flatMap((bead) => {
            const box = bead.getBoundingClientRect();
            const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
            const across = Math.min(name.right, x + reach) - Math.max(name.left, x - reach);
            const down = Math.min(name.bottom, y + reach) - Math.max(name.top, y - reach);
            return across > 1 && down > 1 ? [`${tag.textContent} over a bead at ${x},${y}`] : [];
          });
        });
      }, RING_REACH_PX)),
    );
    await sliders.nth(index).blur();
    await expect(tagOf(page)).toHaveCount(0);
  }
  expect(over).toEqual([]);
});

test("a drag names the version it has switched the stop to, changing only at a switch", async ({
  page,
}) => {
  const chart = await openTheDay(page, "/day/kanazawa");
  const rows = page.getByRole("list", { name: "The day" });
  const written = await rows.getByRole("listitem").allTextContents();
  const slider = page.getByRole("slider", { name: /^Energy at/ }).nth(1);
  const knob = slider.locator("circle");
  await knob.scrollIntoViewIfNeeded();
  const from = await middleOf(knob);
  const chartBox = await chart.boundingBox();
  if (!chartBox) throw new Error("The chart has no box");
  // Toward the side of the scale with more of it, a lane and a half.
  const lanes = chartBox.width / 5;
  const toward = from.x < chartBox.x + chartBox.width / 2 ? 1 : -1;
  const reach = toward * lanes * 1.5;

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const said: (string | null)[] = [];
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    await page.mouse.move(from.x + (reach * step) / DRAG_STEPS, from.y);
    said.push((await tagOf(page).count()) ? await tagOf(page).textContent() : null);
  }
  const held = said.at(-1);

  // While held, the rows still say the day as it was, and the tag says where the stop goes,
  // clear of the finger and the hand under it.
  expect(held).toMatch(/^→ .+/);
  const tagBox = await tagOf(page).locator(":scope > *").boundingBox();
  if (!tagBox) throw new Error("The drag's tag has no box");
  const hand = { x: from.x + reach, y: from.y };
  const isOverHand =
    tagBox.x < hand.x + FINGER_PX &&
    hand.x - FINGER_PX < tagBox.x + tagBox.width &&
    tagBox.y + tagBox.height > hand.y - FINGER_PX;
  expect(isOverHand).toBe(false);
  expect(await rows.getByRole("listitem").allTextContents()).toEqual(written);
  // It said nothing before the switch and the version after it, never flickering between.
  const changes = said.filter((text, at) => text !== (at === 0 ? null : said[at - 1]));
  expect(changes).toEqual([held]);

  await page.mouse.up();
  await expect(tagOf(page)).toHaveCount(0);
  await expect(rows).toContainText((held ?? "").replace("→ ", ""));
});
