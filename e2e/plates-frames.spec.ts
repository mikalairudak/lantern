import { writeFileSync } from "node:fs";
import { INDEX_PICTURES } from "../src/features/day/index-picture-files";
import { lightCirclesOf } from "../src/features/day/plate-light";
import { expect, test } from "./fixtures";
import {
  awaitPlates,
  filmOf,
  hideWords,
  lightSharesOf,
  logPlate,
  plateBoxesOf,
  plateLogOf,
  showWholePage,
  type LightShare,
  type PlateLog,
} from "./plate-pixels";

/**
 * A plate's light coming on and leaving, filmed (`docs/decisions.md`, "A plate is lit whole, from
 * sources drawn in it"): every plate in both themes, at 390 px and one device pixel, by a real
 * pointer. The pixels are Chromium's own screencast, measured on the pixels the light changes; the
 * radii are read after each frame is painted.
 */

const WIDTH = 390;
const THEMES = ["light", "dark"] as const;
/** Lit whole within this long of the pointer coming. */
const ON_MS = 300;
/** A drop, more than the jump itself may lose, painted within this long of the leave. */
const DROP_MS = 100;
const DROP_SHARE = 0.005;
/** 95% of the changed pixels back at rest within this long of the leave. */
const GONE_MS = 280;
const GONE_SHARE = 0.95;
/** At this long after the leave, almost nothing is left, and nothing strong. */
const TAIL_MS = 400;
const TAIL_SHARE = 0.001;
const TAIL_MOST_LEVELS = 24;
/** Long enough for each turn to settle. */
const SETTLE_MS = 900;
/** How long the pointer is away before it comes back mid-way. */
const AWAY_MS = 120;
/** Where the pointer rests, over no cell. */
const AWAY = { x: 1, y: 1 } as const;

test.use({ deviceScaleFactor: 1, reducedMotion: "no-preference" });
test.skip(({ isMobile }) => isMobile, "Filmed at one width on desktop; touch is filmed on its own");

/** The first frame at or after `from` that meets `isMet`, as ms after `from`. */
function msUntil(shares: LightShare[], from: number, isMet: (share: LightShare) => boolean) {
  const share = shares.find((each) => each.at >= from && isMet(each));
  return share === undefined ? Infinity : share.at - from;
}

/** The samples painted after `from`, up to `until`. */
function samplesBetween(log: PlateLog, from: number, until = Infinity) {
  return log.samples.filter((sample) => sample.at > from && sample.at < until);
}

for (const theme of THEMES) {
  for (const slug of Object.keys(INDEX_PICTURES)) {
    test(
      `${slug} ${theme === "light" ? "by day" : "by night"}: comes on whole, starts to leave in the leave's own frame, is gone in time, and grows again from where it stands`,
      { tag: "@frame" },
      async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "no-preference" });
        await page.goto("/");
        await showWholePage(page, WIDTH);
        await awaitPlates(page);
        await hideWords(page);
        const box = (await plateBoxesOf(page)).find((plate) => plate.slug === slug)!.picture;
        const over = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const pointAt = () => page.mouse.move(over.x, over.y);
        const covering = lightCirclesOf(INDEX_PICTURES[slug]!).map(
          ({ reaches }) => reaches.covering,
        );
        const decoder = await page.context().newPage();

        await page.mouse.move(AWAY.x, AWAY.y);
        await page.waitForTimeout(SETTLE_MS);
        const rest = (await page.screenshot()).toString("base64");
        await pointAt();
        await page.waitForTimeout(SETTLE_MS);
        const whole = (await page.screenshot()).toString("base64");
        await page.mouse.move(AWAY.x, AWAY.y);
        await page.waitForTimeout(SETTLE_MS);

        await logPlate(page, slug);
        const coming = await filmOf(page, async () => {
          await pointAt();
          await page.waitForTimeout(SETTLE_MS);
        });
        const leaving = await filmOf(page, async () => {
          await page.mouse.move(AWAY.x, AWAY.y);
          await page.waitForTimeout(SETTLE_MS);
        });
        await pointAt();
        await page.waitForTimeout(SETTLE_MS);
        await page.mouse.move(AWAY.x, AWAY.y);
        await page.waitForTimeout(AWAY_MS);
        await pointAt();
        await page.waitForTimeout(SETTLE_MS);
        await page.mouse.move(AWAY.x, AWAY.y);
        await page.waitForTimeout(SETTLE_MS);
        const log = await plateLogOf(page);
        const ended = (await page.screenshot()).toString("base64");

        const on = await lightSharesOf(decoder, rest, whole, coming, box);
        const off = await lightSharesOf(decoder, rest, whole, leaving, box);
        const [afterTurn] = (
          await lightSharesOf(decoder, rest, whole, [{ at: 0, png: ended }], box)
        ).shares;
        const [entered = 0, , returned = 0] = log.entered.map(({ at }) => at);
        const [left = 0, , leftAgain = 0] = log.left.map(({ at }) => at);
        const changed = on.changed;
        const tail = off.shares.filter((share) => share.at <= left + TAIL_MS).at(-1);
        const firstAfterLeave = samplesBetween(log, left)[0];
        // The radii standing as the pointer left, and as it came back.
        const beforeLeave = log.left[0];
        const firstAfterReturn = samplesBetween(log, returned)[0];
        const beforeReturn = log.entered[2];
        const measures = {
          slug,
          theme,
          changed,
          litMs: msUntil(
            on.shares,
            entered,
            (share) => share.offWhole <= changed * (1 - GONE_SHARE),
          ),
          dropMs: msUntil(off.shares, left, (share) => share.offWhole > changed * DROP_SHARE),
          goneMs: msUntil(off.shares, left, (share) => share.atRest >= changed * GONE_SHARE),
          tailLeft: tail === undefined ? changed : changed - tail.atRest,
          tailMost: tail?.mostFromRest ?? 255,
          covering,
          beforeLeave: beforeLeave?.radii,
          firstAfterLeave: firstAfterLeave?.radii,
          beforeReturn: beforeReturn?.radii,
          firstAfterReturn: firstAfterReturn?.radii,
          aroundReturn: log.samples
            .filter((sample) => Math.abs(sample.at - returned) < 80)
            .map((sample) => [Math.round(sample.at - returned), sample.radii]),
          aroundLeave: log.samples
            .filter((sample) => sample.at - left > -40 && sample.at - left < 80)
            .map((sample) => [Math.round(sample.at - left), sample.radii]),
        };
        writeFileSync(testInfo.outputPath("measures.json"), JSON.stringify(measures, null, 1));

        // Once its turn has ended, the plate is the plate at rest.
        expect(afterTurn!.atRest, "back at rest once the turn has ended").toBe(changed);

        // F3: lit whole soon after the pointer comes.
        expect(measures.litMs, "95% lit").toBeLessThanOrEqual(ON_MS);
        // F1, on the circles: the first frame painted after the leave is already under the
        // covering reach and under the frame before, and no frame is painted at the jump.
        firstAfterLeave!.radii.forEach((radius, index) => {
          if (radius === 0) return;
          expect(radius).toBeLessThan(covering[index]!);
          expect(radius).toBeLessThan(beforeLeave!.radii[index]!);
        });
        // F1, on the pixels: a drop painted soon after the leave.
        expect(measures.dropMs, "the first drop").toBeLessThanOrEqual(DROP_MS);
        // F2: gone in time, and almost nothing left at its tail.
        expect(measures.goneMs, "95% gone").toBeLessThanOrEqual(GONE_MS);
        expect(measures.tailLeft, "left at 400 ms").toBeLessThanOrEqual(changed * TAIL_SHARE);
        expect(measures.tailMost, "the strongest left at 400 ms").toBeLessThanOrEqual(
          TAIL_MOST_LEVELS,
        );
        // F4: pointed at again, it grows in the first frame painted; no radius under nothing,
        // none that grows after a leave nor shrinks after the plate is pointed at again.
        firstAfterReturn!.radii.forEach((radius, index) =>
          expect(radius).toBeGreaterThan(beforeReturn!.radii[index]!),
        );
        const turns = [
          ...log.entered.map(({ at }) => ({ at, isLit: true })),
          ...log.left.map(({ at }) => ({ at, isLit: false })),
        ].sort((a, b) => a.at - b.at);
        turns.forEach((turn, index) => {
          const samples = samplesBetween(
            log,
            turn.at,
            turns[index + 1]?.at ?? leftAgain + SETTLE_MS,
          );
          samples.forEach((sample, at) => {
            for (const radius of sample.radii) expect(radius).toBeGreaterThanOrEqual(0);
            const before = samples[at - 1];
            if (before === undefined) return;
            sample.radii.forEach((radius, circle) => {
              if (turn.isLit) expect(radius).toBeGreaterThanOrEqual(before.radii[circle]!);
              else expect(radius).toBeLessThanOrEqual(before.radii[circle]!);
            });
          });
        });
        await decoder.close();
      },
    );
  }
}

test(
  "under reduced motion, the first frame after a plate is pointed at or left shows it as it ends",
  { tag: "@frame" },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await showWholePage(page, WIDTH);
    await awaitPlates(page);
    const rome = page.locator('svg[data-picture="rome"]');
    const [lit] = lightCirclesOf(INDEX_PICTURES.rome!).map(({ reaches }) => reaches.lit);
    await page.mouse.move(AWAY.x, AWAY.y);
    await logPlate(page, "rome");
    await rome.hover();
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.move(AWAY.x, AWAY.y);
    await page.waitForTimeout(SETTLE_MS);
    const log = await plateLogOf(page);
    expect(samplesBetween(log, log.entered[0]!.at)[0]!.radii).toEqual([lit]);
    expect(samplesBetween(log, log.left[0]!.at)[0]!.radii).toEqual([0]);
  },
);

test(
  "a touch lights the plate under it and keeps it lit after a scroll lifts off, moves to the next cell touched, goes out on the ground, never lights by a touch's hover, and a tap opens the day",
  { tag: "@frame" },
  async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: 844 },
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/");
    const session = await context.newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
      session.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    const lit = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('svg[data-light="lit"]')].map((svg) =>
          svg.getAttribute("data-picture"),
        ),
      );
    const scrollFrom = async (slug: string) => {
      const cell = page
        .getByRole("button")
        .filter({ has: page.locator(`svg[data-picture="${slug}"]`) });
      await cell.scrollIntoViewIfNeeded();
      const box = (await cell.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 3;
      await touch("touchStart", x, y);
      for (let step = 1; step <= 5; step += 1) await touch("touchMove", x, y - step * 20);
      await touch("touchEnd");
    };
    await scrollFrom("rome");
    await expect.poll(lit).toEqual(["rome"]);
    await scrollFrom("tokyo");
    await expect.poll(lit).toEqual(["tokyo"]);
    const heading = page.getByText("No city in mind?");
    await heading.scrollIntoViewIfNeeded();
    const top = (await heading.boundingBox())!;
    await touch("touchStart", WIDTH - 10, top.y - 30);
    await touch("touchEnd");
    await expect.poll(lit).toEqual([]);
    await page.locator('svg[data-picture="rome"]').tap();
    await expect(page).toHaveURL(/\/day\//);
    await context.close();
  },
);
