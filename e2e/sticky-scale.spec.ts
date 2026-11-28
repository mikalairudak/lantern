import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";
import { seeWrittenDay } from "./live-page";
import { writtenDayAt } from "../src/lib/days/written/days";
import { BACK_FOCUS_WAIT_MS } from "../src/features/abacus/back-to-plan";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const PHONE = { width: 390, height: 844 };

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** What marks the band, "held" once it stands at the screen's top (`SCALE_BAND_ATTRIBUTE`). */
const BAND = "data-scale-band";

/** The sticky scale's band, where it stands on the screen, whether it is held there, and seen. */
function bandOf(page: Page) {
  return page.evaluate((attribute) => {
    const band = document.querySelector<HTMLElement>(`[${attribute}]`);
    if (!band) return null;
    const { top, bottom } = band.getBoundingClientRect();
    return {
      top,
      bottom,
      isHeld: band.getAttribute(attribute) === "held",
      opacity: Number(getComputedStyle(band).opacity),
      text: band.textContent ?? "",
    };
  }, BAND);
}

test("on a phone the energy scale is held at the screen's top while the chart is in view, and takes a change back", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("/day/kanazawa");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  const rows = page.getByRole("list", { name: "The day" });
  const written = await rows.getByRole("listitem").allTextContents();

  // Where the chart begins, the scale stands where its words always stood, not held.
  const chartBox = await chart.boundingBox();
  if (!chartBox) throw new Error("The chart has no box");
  await page.evaluate((y) => scrollTo(0, y + scrollY - 120), chartBox.y);
  await expect.poll(async () => (await bandOf(page))?.isHeld).toBe(false);
  expect((await bandOf(page))?.text).toContain("drag the curve");

  // Scrolled into the chart, it is held at the top, on the ground.
  await page.evaluate(() => scrollBy(0, 360));
  await expect.poll(async () => (await bandOf(page))?.isHeld).toBe(true);
  expect(Math.round((await bandOf(page))?.top ?? 99)).toBeLessThanOrEqual(0);

  // A drag there changes the day: the scale says how, and offers the plan back.
  const slider = page.getByRole("slider", { name: /^Energy at/ }).nth(3);
  const knob = await slider.locator("circle").boundingBox();
  if (!knob) throw new Error("The knob has no box");
  const from = { x: knob.x + knob.width / 2, y: knob.y + knob.height / 2 };
  const reach = (chartBox.width / 5) * 1.5 * (from.x < chartBox.x + chartBox.width / 2 ? 1 : -1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(from.x + (reach * step) / 10, from.y);
  }
  // While the hand is on the curve, the held band steps aside for the bead and its name.
  await expect.poll(async () => (await bandOf(page))?.opacity).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await bandOf(page))?.opacity).toBe(1);
  const back = page.getByRole("button", { name: "Back to the plan" });
  await expect(back).toBeVisible();
  expect(await rows.getByRole("listitem").allTextContents()).not.toEqual(written);

  // Taken back, the day is as planned, and the scale says what it said.
  await back.focus();
  await page.keyboard.press("Enter");
  await expect(back).toHaveCount(0);
  // The keys go on from a stop it changed back, not from the top of the page.
  await expect(page.locator(":focus")).toHaveAttribute("role", "slider");
  await expect.poll(() => rows.getByRole("listitem").allTextContents()).toEqual(written);
  expect((await bandOf(page))?.text).toContain("drag the curve");
});

test("on a laptop the scale stays the chart's own, and nothing is held", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/day/kanazawa");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  await expect(page.locator(`[${BAND}]`)).toBeHidden();
  await expect(
    page.getByText("drag the curve", { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
});

/** The narrowest phone Lantern promises, where a drag's name has the least room. */
const NARROW_PHONE = { width: 360, height: 780 };
/**
 * Knobs grabbed this far under the screen's top: well down the screen first, then under the held
 * band and just below it, so each name is one a drag before it named at another scroll.
 */
const GRABBED_AT_PX = [250, 17, 40, 60];
/** How far a name may move between two frames that say the same on the same line. */
const NAME_STILL_PX = 2;

/**
 * Records, frame by frame from now, the first two frames a drag's name shows in: where its top
 * stands on the screen, its line and what it says. Read before the frame paints, as it paints.
 */
function watchFirstNames(page: Page) {
  return page.evaluate(() => {
    const seen: { top: number; line: string | null; text: string }[] = [];
    (window as unknown as { firstNames: typeof seen }).firstNames = seen;
    const look = () => {
      const tag = document.querySelector("[data-tag][data-dragged]");
      const name = tag?.firstElementChild;
      if (tag && name) {
        seen.push({
          top: name.getBoundingClientRect().top,
          line: tag.getAttribute("data-tag"),
          text: tag.textContent ?? "",
        });
      }
      if (seen.length < 2) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}

function firstNamesOf(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { firstNames: { top: number; line: string | null; text: string }[] })
        .firstNames,
  );
}

for (const city of ["bologna", "kanazawa", "nafplio"]) {
  test(
    `on ${city}'s day a drag grabbed at the screen's top names its version on the screen`,
    { tag: "@frame" },
    async ({ page }) => {
      await page.setViewportSize(NARROW_PHONE);
      await page.goto(`/day/${city}`);
      const chart = page.getByRole("group", { name: /The day's energy/ });
      await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
      const chartBox = await chart.boundingBox();
      if (!chartBox) throw new Error("The chart has no box");
      const lane = chartBox.width / 5;
      const past: string[] = [];
      const sliders = page.getByRole("slider", { name: /^Energy at/ });
      for (const at of GRABBED_AT_PX) {
        for (const index of [0, 1]) {
          const knob = sliders.nth(index).locator("circle");
          const box = await knob.boundingBox();
          if (!box) throw new Error("The knob has no box");
          // The knob this far under the screen's top, the band held over the chart.
          await page.evaluate((by) => scrollBy(0, by), box.y + box.height / 2 - at);
          const from = await knob.boundingBox();
          if (!from) throw new Error("The knob has no box");
          const x = from.x + from.width / 2;
          const y = from.y + from.height / 2;
          const toward = x < chartBox.x + chartBox.width / 2 ? 1 : -1;
          const band = await bandOf(page);
          await watchFirstNames(page);
          await page.mouse.move(x, y);
          await page.mouse.down();
          // Held over the knob, the band steps aside at the press, before the hand has moved;
          // over a knob under it, as the drag sets off.
          const isUnderBand = band?.isHeld && y <= band.bottom;
          if (isUnderBand) await expect.poll(async () => (await bandOf(page))?.opacity).toBe(0);
          for (let step = 1; step <= 12; step += 1) {
            await page.mouse.move(x + (toward * lane * 1.5 * step) / 12, y);
          }
          if (band?.isHeld) await expect.poll(async () => (await bandOf(page))?.opacity).toBe(0);
          const name = page.locator("[data-tag][data-dragged] > *").first();
          if (await name.count()) {
            const top = (await name.boundingBox())?.y ?? 0;
            if (top < 0) past.push(`stop ${index} at ${at} px: ${Math.round(top)} px`);
          }
          // Its first frame stands where the screen is now, not where it was at the drag before.
          const [first, second] = await firstNamesOf(page);
          if (first && first.top < 0) {
            past.push(`stop ${index} at ${at} px, first frame: ${Math.round(first.top)} px`);
          }
          const isSameName = first && second && first.line === second.line;
          if (isSameName && first.text === second.text) {
            const moved = Math.abs(second.top - first.top);
            if (moved > NAME_STILL_PX) {
              past.push(`stop ${index} at ${at} px, first frame ${Math.round(moved)} px off`);
            }
          }
          await page.mouse.up();
          const back = page.getByRole("button", { name: "Back to the plan" });
          if (await back.count()) await back.click();
        }
      }
      expect(past).toEqual([]);
    },
  );
}

/** A Pixel 7's window, where a slider "Back to the plan" moves back can rest past its foot. */
const PIXEL_7 = { width: 412, height: 839 };
/** How many frames in a row the focused slider stands still before the rows count as at rest. */
const STILL_FRAMES = 20;
/** How far a wheel turned while the rows glide scrolls the page up, away from the slider. */
const WHEEL_PX = 120;
/** The most Shift+Tab presses from a slider to "Back to the plan", at the chart's top. */
const MOST_PRESSES_TO_BACK = 12;

/** Waits until an element's box has stood still on screen for `STILL_FRAMES` frames. */
async function untilStill(element: Locator): Promise<void> {
  await element.evaluate(
    (target, stillFrames) =>
      new Promise<void>((resolve) => {
        let last = "";
        let still = 0;
        const read = () => {
          const { top, bottom } = target.getBoundingClientRect();
          const now = `${top.toFixed(1)} ${bottom.toFixed(1)}`;
          still = now === last ? still + 1 : 0;
          last = now;
          if (still >= stillFrames) resolve();
          else requestAnimationFrame(read);
        };
        requestAnimationFrame(read);
      }),
    STILL_FRAMES,
  );
}

/**
 * Waits out the longest the page waits for the rows "Back to the plan" moved to rest
 * (`BACK_FOCUS_WAIT_MS`), then until `slider` stands still: whatever the page brings in, it has
 * brought in by then.
 */
async function untilWaitedOut(page: Page, slider: Locator): Promise<void> {
  await page.waitForTimeout(BACK_FOCUS_WAIT_MS);
  await untilStill(slider);
}

/** Kanazawa's day, seen before so it opens whole, on a Pixel 7's chart. */
async function openSeenKanazawaChart(page: Page): Promise<void> {
  await page.setViewportSize(PIXEL_7);
  await seeWrittenDay(page, "kanazawa", writtenDayAt("kanazawa")!.itinerary);
  await page.goto("/day/kanazawa");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
}

/**
 * Changes one stop from the keys, its slider taken to its liveliest version by End, then
 * reaches "Back to the plan" by Shift+Tab, as a visitor at the keyboard does.
 */
async function changeFromTheKeys(page: Page, time: string): Promise<Locator> {
  const slider = page.getByRole("slider", { name: `Energy at ${time}` });
  await slider.focus();
  await page.keyboard.press("End");
  const back = page.getByRole("button", { name: "Back to the plan" });
  await expect(back).toBeVisible();
  await untilStill(slider);
  for (let press = 0; press < MOST_PRESSES_TO_BACK; press += 1) {
    if (await back.evaluate((button) => button === document.activeElement)) break;
    await page.keyboard.press("Shift+Tab");
  }
  await expect(back).toBeFocused();
  return back;
}

/**
 * The focused slider's box with its ring, which its scroll margins hold, the band's foot where
 * the band is held, and the window's foot.
 */
function focusedSliderOf(page: Page) {
  return page.evaluate((attribute) => {
    const focused = document.activeElement;
    const band = document.querySelector(`[${attribute}="held"]`);
    const { top, bottom } = focused?.getBoundingClientRect() ?? { top: NaN, bottom: NaN };
    const style = focused ? getComputedStyle(focused) : null;
    return {
      role: focused?.getAttribute("role") ?? null,
      top: top - Number.parseFloat(style?.scrollMarginTop ?? "0"),
      bottom: bottom + Number.parseFloat(style?.scrollMarginBottom ?? "0"),
      clearFrom: Math.max(0, band?.getBoundingClientRect().bottom ?? 0),
      foot: innerHeight,
    };
  }, BAND);
}

// 12:00's slider is on screen at the press and glides past the window's foot as the rows go
// back; 17:30's stands past it from the press on.
for (const time of ["12:00", "17:30"]) {
  for (const motion of ["reduce", "no-preference"] as const) {
    test(`"Back to the plan" pressed from the keys leaves the focus on a slider in view, ${time}'s changed, with motion ${motion}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await openSeenKanazawaChart(page);
      await changeFromTheKeys(page, time);

      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "Back to the plan" })).toHaveCount(0);
      const focused = page.locator(":focus");
      await expect(focused).toHaveAttribute("role", "slider");
      await untilWaitedOut(page, focused);

      const slider = await focusedSliderOf(page);
      expect(slider.role).toBe("slider");
      expect(
        slider.top,
        "the slider's ring, under anything held at the top",
      ).toBeGreaterThanOrEqual(slider.clearFrom);
      expect(slider.bottom, "the slider's ring, over the window's foot").toBeLessThanOrEqual(
        slider.foot,
      );
    });
  }
}

/** Presses a button with the mouse where it stands, as a hand does, scrolling nothing first. */
async function pressWithPointer(page: Page, button: Locator): Promise<void> {
  const box = await button.boundingBox();
  if (!box) throw new Error("The button has no box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test(`"Back to the plan" pressed with a pointer alone scrolls nothing, its slider at rest in view or past the window's foot`, async ({
  page,
}) => {
  await openSeenKanazawaChart(page);
  const chart = page.getByRole("group", { name: /The day's energy/ });
  const back = page.getByRole("button", { name: "Back to the plan" });
  for (const time of ["12:00", "17:30"]) {
    await page.reload();
    await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
    await changeFromTheKeys(page, time);
    // The keys put down, the button is pressed with the pointer alone: its focus shows no ring.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const chartTop = (await chart.boundingBox())!.y;
    await pressWithPointer(page, back);
    await expect(back).toHaveCount(0);
    const slider = page.getByRole("slider", { name: `Energy at ${time}` });
    await expect(slider).toBeFocused();
    expect(await slider.evaluate((element) => element.matches(":focus-visible"))).toBe(false);
    await untilWaitedOut(page, slider);

    if (time === "12:00") {
      // Pressed with the band held, the header above the screen: the chart stays where it stood.
      expect((await chart.boundingBox())!.y, "the chart where it stood").toBeCloseTo(chartTop, 0);
    } else {
      // Pressed with the chart's top on screen, its slider rests past the window's foot.
      const rest = await focusedSliderOf(page);
      expect(rest.top, "17:30's slider, left past the window's foot").toBeGreaterThan(rest.foot);
    }
  }
});

test(`"Back to the plan" reached by the keys and pressed with a pointer keeps the ring, and brings its slider in`, async ({
  page,
}) => {
  await openSeenKanazawaChart(page);
  const back = await changeFromTheKeys(page, "17:30");
  await pressWithPointer(page, back);
  await expect(back).toHaveCount(0);
  const slider = page.getByRole("slider", { name: "Energy at 17:30" });
  await expect(slider).toBeFocused();
  expect(await slider.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await untilWaitedOut(page, slider);

  const rest = await focusedSliderOf(page);
  expect(rest.top).toBeGreaterThanOrEqual(rest.clearFrom);
  expect(rest.bottom).toBeLessThanOrEqual(rest.foot);
});

test(`a wheel turned before the rows "Back to the plan" moved rest leaves the page where the wheel took it`, async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSeenKanazawaChart(page);
  await changeFromTheKeys(page, "17:30");
  await page.keyboard.press("Enter");
  await page.mouse.move(PIXEL_7.width / 2, PIXEL_7.height / 2);
  await page.mouse.wheel(0, -WHEEL_PX);
  const slider = page.getByRole("slider", { name: "Energy at 17:30" });
  await expect(slider).toBeFocused();
  await untilWaitedOut(page, slider);

  const rest = await focusedSliderOf(page);
  expect(rest.top, "17:30's slider, left where the wheel's page put it").toBeGreaterThan(rest.foot);
});

for (const motion of ["reduce", "no-preference"] as const) {
  test(`a key pressed before the rows "Back to the plan" moved rest leaves the page where the key took it, with motion ${motion}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: motion });
    await openSeenKanazawaChart(page);
    await changeFromTheKeys(page, "17:30");
    await page.keyboard.press("Enter");
    const slider = page.getByRole("slider", { name: "Energy at 17:30" });
    await expect(slider).toBeFocused();
    // Page Up scrolls the page up a screen, the slider further past the window's foot.
    await page.keyboard.press("PageUp");
    await untilWaitedOut(page, slider);

    const rest = await focusedSliderOf(page);
    expect(rest.top, "17:30's slider, left where the key's page put it").toBeGreaterThan(rest.foot);
  });
}

test(`an arrow pressed on the slider before the rows "Back to the plan" moved rest changes its stop where it stands, and the page stays`, async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSeenKanazawaChart(page);
  await changeFromTheKeys(page, "17:30");
  await page.keyboard.press("Enter");
  const slider = page.getByRole("slider", { name: "Energy at 17:30" });
  await expect(slider).toBeFocused();
  const planned = await slider.getAttribute("aria-valuetext");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).not.toHaveAttribute("aria-valuetext", planned ?? "");
  await untilWaitedOut(page, slider);

  const rest = await focusedSliderOf(page);
  expect(rest.top, "17:30's slider, left past the window's foot").toBeGreaterThan(rest.foot);
});

test(`Page Up pressed while the page brings the slider "Back to the plan" focused in leaves the page where the key took it`, async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSeenKanazawaChart(page);
  await changeFromTheKeys(page, "17:30");
  await page.keyboard.press("Enter");
  const slider = page.getByRole("slider", { name: "Energy at 17:30" });
  // The reveal on its way holds the browser's scroll anchoring off (`revealInView`), read
  // every frame, so a reveal under a second long is never stepped over.
  await page.waitForFunction(() => document.documentElement.style.overflowAnchor === "none", null, {
    polling: "raf",
  });
  await page.keyboard.press("PageUp");
  await expect(slider).toBeFocused();
  await untilWaitedOut(page, slider);

  const rest = await focusedSliderOf(page);
  expect(rest.top, "17:30's slider, left where the key's page put it").toBeGreaterThan(rest.foot);
});

/** How far a slider placed under the held band stands up into it, its knob all but covered. */
const UNDER_BAND_PX = 28;

/**
 * Scrolls the page until `time`'s slider stands `UNDER_BAND_PX` up into the held band, in a few
 * steps, since the band is held only once the chart's top has gone past the screen's.
 */
async function placeUnderBand(page: Page, time: string): Promise<void> {
  for (let step = 0; step < 3; step += 1) {
    await page.evaluate(
      ({ attribute, time, under }) => {
        const slider = document.querySelector(`[role="slider"][aria-label="Energy at ${time}"]`)!;
        const band = document.querySelector(`[${attribute}]`)!;
        const bandFoot = band.getBoundingClientRect().bottom;
        window.scrollBy(0, slider.getBoundingClientRect().top - (bandFoot - under));
      },
      { attribute: BAND, time, under: UNDER_BAND_PX },
    );
    await untilStill(page.getByRole("slider", { name: `Energy at ${time}` }));
  }
}

test(`"Back to the plan" moves the focus once under reduced motion, to a slider under the held band, and brings it in`, async ({
  page,
}) => {
  await openSeenKanazawaChart(page);
  // 10:30 changed too, to its quietest, its slider under the band at the press, and 12:00's
  // in view below it.
  const morning = page.getByRole("slider", { name: "Energy at 10:30" });
  await morning.focus();
  const planned = await morning.getAttribute("aria-valuetext");
  await page.keyboard.press("Home");
  await expect(morning).not.toHaveAttribute("aria-valuetext", planned ?? "");
  await untilStill(morning);
  await changeFromTheKeys(page, "12:00");
  await placeUnderBand(page, "10:30");
  expect((await bandOf(page))?.isHeld).toBe(true);
  await page.evaluate(() => {
    const moves: string[] = [];
    (window as unknown as { focusMoves: string[] }).focusMoves = moves;
    document.addEventListener("focusin", (event) => {
      moves.push((event.target as Element).getAttribute("aria-label") ?? "");
    });
  });

  await page.keyboard.press("Enter");
  await expect(morning).toBeFocused();
  await untilWaitedOut(page, morning);

  const moves = await page.evaluate(
    () => (window as unknown as { focusMoves: string[] }).focusMoves,
  );
  expect(moves, "the focus's moves from the button").toEqual(["Energy at 10:30"]);
  const rest = await focusedSliderOf(page);
  expect(rest.top, "the slider's ring, under the held band").toBeGreaterThanOrEqual(rest.clearFrom);
  expect(rest.bottom, "the slider's ring, over the window's foot").toBeLessThanOrEqual(rest.foot);
});
