import { CPU_RATE, expect, test, type Locator, type Page, waitMs } from "./fixtures";

/**
 * A version taken on the plan slides in, painted frame by frame (`docs/decisions.md`, "A stop
 * on the plan swipes along its versions"): pressed by its arrow, by the arrow key on the stop or
 * by a finger's tap, the taken version is seen on its way from a stride off to home, and no
 * frame of the slide's start is held while the page works.
 */

const DAY_TIMEOUT_MS = waitMs(30_000);
/** How long after the press the frames are read for, and how long the slide's start is. */
const READ_MS = 700;
const START_MS = 300;
/**
 * The longest a frame in the slide's start may take, from the last frame painted before the
 * press: the press's own frame draws the swap, the whole day's plan and chart again, which
 * takes the dev server about 110 ms at its own pace (a production build takes less), and a
 * slower CPU takes longer in proportion.
 */
const LONGEST_FRAME_MS = 200 * CPU_RATE;
/** How many places between a stride off and home the taken version is painted at, at least. */
const LEAST_PLACES = 3;
/** Within this of home the slide has arrived; within this of a stride off it has not set off. */
const HOME_PX = 2;
const OFF_PX = 8;
/** The gap between the stop and a version waiting beside it (`version-carousel.tsx`). */
const GAP_PX = 24;

type Press = "arrow" | "key" | "tap";

interface Frame {
  t: number;
  name: string;
  left: number;
}

/** A written day whose plan is whole and still, its first stop's lean played and at rest. */
async function openThePlan(page: Page, city: string): Promise<Locator> {
  await page.goto(`/day/${city}`);
  // The first HTML holds the day whole until the page's script plays it from its empty frame.
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-day-seen"), null, {
    timeout: DAY_TIMEOUT_MS,
  });
  const plan = page.getByRole("list", { name: "The day, to read" });
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await expect(plan).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  const stop = plan.locator('[role="group"][tabindex="0"]').first();
  await stop.scrollIntoViewIfNeeded();
  // The first stop that can swipe leans once when the day is whole, and comes home.
  await expect
    .poll(() => stop.evaluate((element) => (element as HTMLElement).style.transform), {
      timeout: DAY_TIMEOUT_MS,
      intervals: [500],
    })
    .toMatch(/^(none|translateX\(0px\))?$/);
  await page.waitForTimeout(1500);
  return stop;
}

/**
 * Reads, on every animation frame from now, where the stop's name stands and what it says,
 * and when the press reached the page.
 */
async function sampleFrames(stop: Locator): Promise<void> {
  await stop.evaluate((group) => {
    const w = window as unknown as { frames: Frame[]; pressedAt: number | null };
    w.frames = [];
    w.pressedAt = null;
    const note = (event: Event) => {
      w.pressedAt ??= event.timeStamp;
    };
    window.addEventListener("click", note, { capture: true, once: true });
    window.addEventListener("keydown", note, { capture: true, once: true });
    const sample = () => {
      const name = group.querySelector("h2");
      w.frames.push({
        t: performance.now(),
        name: name?.textContent ?? "",
        left: name?.getBoundingClientRect().left ?? 0,
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function press(page: Page, stop: Locator, how: Press): Promise<string> {
  const row = stop.locator("xpath=../..");
  const arrow = row.locator("button[aria-label]").first();
  const label = (await arrow.getAttribute("aria-label")) ?? "";
  if (how === "arrow") await arrow.click();
  else if (how === "tap") await arrow.tap();
  else {
    await stop.focus();
    const isLeft = (await arrow.textContent())?.startsWith("←") ?? false;
    await page.keyboard.press(isLeft ? "ArrowLeft" : "ArrowRight");
  }
  return label.replace(/^(Quieter|Livelier|Same energy): /, "");
}

for (const city of ["rome", "barcelona"]) {
  for (const how of ["arrow", "key", "tap"] as const) {
    test(
      `on ${city}'s plan a version taken by ${how === "arrow" ? "its arrow" : how === "key" ? "the arrow key" : "a tap"} slides in, painted frame by frame`,
      { tag: "@frame" },
      async ({ page }, testInfo) => {
        test.skip(how === "tap" && !testInfo.project.use.hasTouch, "a tap needs a touch screen");
        const stop = await openThePlan(page, city);
        const home = await stop.evaluate(
          (group) => group.querySelector("h2")?.getBoundingClientRect().left ?? 0,
        );
        const width = await stop.evaluate((group) => group.parentElement?.offsetWidth ?? 0);
        const stride = width + GAP_PX;
        await sampleFrames(stop);
        await page.waitForTimeout(100);
        const taken = await press(page, stop, how);
        await page.waitForFunction(
          (ms) => {
            const w = window as unknown as { frames: Frame[]; pressedAt: number | null };
            return w.pressedAt !== null && (w.frames.at(-1)?.t ?? 0) > w.pressedAt + ms;
          },
          READ_MS,
          { timeout: DAY_TIMEOUT_MS },
        );
        const { frames, pressedAt } = await page.evaluate(() => {
          const w = window as unknown as { frames: Frame[]; pressedAt: number };
          return { frames: w.frames, pressedAt: w.pressedAt };
        });

        // From the last frame painted before the press, through the slide's start.
        const before = frames.filter(({ t }) => t <= pressedAt).at(-1)!;
        const after = frames.filter(({ t }) => t > pressedAt);
        // The frame that ends the slide's start counts too: a page held past it painted none.
        const inStart = after.findIndex(({ t }) => t > pressedAt + START_MS);
        const start = [before, ...after.slice(0, inStart === -1 ? after.length : inStart + 1)];
        const gaps = start.slice(1).map((frame, at) => frame.t - start[at]!.t);
        expect(
          Math.max(...gaps),
          `frame gaps ${gaps.map(Math.round).join(", ")}`,
        ).toBeLessThanOrEqual(LONGEST_FRAME_MS);

        // The taken version on its way: between a stride off and home, nearer home each frame,
        // read on the side it came from, so the spring's small overshoot past home is not.
        const offsets = after.filter(({ name }) => name === taken).map(({ left }) => left - home);
        const side = Math.sign(offsets.find((offset) => Math.abs(offset) > HOME_PX) ?? 0);
        const away = offsets
          .map((offset) => offset * side)
          .filter((distance) => distance > HOME_PX && distance < stride - OFF_PX);
        const places = [...new Set(away.map((distance) => Math.round(distance)))];
        expect(places.length, `painted ${away.map(Math.round).join(", ")}`).toBeGreaterThanOrEqual(
          LEAST_PLACES,
        );
        away.slice(1).forEach((distance, at) => {
          expect(distance, `painted ${away.map(Math.round).join(", ")}`).toBeLessThanOrEqual(
            away[at]! + 0.5,
          );
        });
      },
    );
  }
}
