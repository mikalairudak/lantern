import { expect, test, type Locator, type Page } from "./fixtures";

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = 30_000;
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
