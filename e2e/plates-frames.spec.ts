import { writeFileSync } from "node:fs";
import { INDEX_PICTURES } from "../src/features/day/index-picture-files";
import { lightCirclesOf, type LightReaches } from "../src/features/day/plate-light";
import { CPU_RATE, expect, test } from "./fixtures";
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
  type PlateCrossing,
  type PlateLog,
} from "./plate-pixels";

/**
 * A plate's light coming on and leaving, on every plate in both themes, at 390 px and one device
 * pixel, by a real pointer (`docs/decisions.md`, "A plate is lit whole, from sources drawn in it").
 * When the page gets there is read on its own clock, from each turn's commit, the `pointerover`
 * that closes a crossing of the cell's edge: the radius of each lit circle as each frame is
 * painted. What a share of a reach shows is held by stills (`e2e/plates.spec.ts`). Chromium's
 * screencast stays as a backstop for what only pixels show, its stamps trailing the paint by up
 * to three frames.
 */

const WIDTH = 390;
const THEMES = ["light", "dark"] as const;
/**
 * A 60 Hz frame, in ms. Each bar on the page's clock below is the spring's own time to its share,
 * the 4 ms a spring dated from its first frame starts after the commit, a frame's sampling and one
 * frame more.
 */
const FRAME_MS = 17;
/** How far a screencast's stamp may trail the frame it shows: three frames. */
const FILM_TRAILS_MS = 49;

/**
 * Lit whole: every circle at 0.72 of its lit reach, which the stills hold at no more than 5% of the
 * changed pixels off the plate whole. `gentle` is there at 291 ms; with the spring's start, a
 * frame's sampling and one frame, 330.
 */
const LIT_SHARE = 0.72;
const LIT_MS = 330;
/**
 * Gone: every circle at 0.09 of its covering reach, which the stills hold at 95% or more of the
 * changed pixels back at rest. `brisk` is there at 230 ms; so 270.
 */
const GONE_SHARE = 0.09;
const GONE_MS = 270;
/**
 * A drop: every circle at 0.784 of its covering reach, `brisk`'s third step, which the stills hold
 * at more than 0.5% of the changed pixels off the plate whole. `brisk` is there at 50 ms; so 100.
 */
const DROP_SHARE = 0.784;
const DROP_MS = 100;
/**
 * The CPU rate up to which a leave's first painted frame stands strictly under its covering reach:
 * the busy gate's, `pnpm e2e:busy`.
 */
const STRICT_FIRST_FRAME_CPU_RATE = 2;
/** The page commits a turn within three frames of the crossing's start, slower on a slower CPU. */
const COMMIT_MS = 50 * CPU_RATE;
/** The film's own measures, as backstops: each radii bar and the film's trail past the paint. */
const FILM_LIT_MS = LIT_MS + FILM_TRAILS_MS + 1;
const FILM_GONE_MS = GONE_MS + FILM_TRAILS_MS + 1;
const FILM_DROP_MS = DROP_MS + FILM_TRAILS_MS + 1;
/** The changed pixels each film measure counts: 95% lit or back at rest, and a drop past 0.5%. */
const MOST_SHARE = 0.95;
const DROP_PIXELS_SHARE = 0.005;
/** At this long after the leave's commit, almost nothing is left, and nothing strong. */
const TAIL_MS = 400;
const TAIL_SHARE = 0.001;
const TAIL_MOST_LEVELS = 24;
/**
 * At its commit a turn stops the old spring where it stands, one frame on from the last painted:
 * within two frames of the old spring's travel, 0.11 of the lit reach where the light was coming
 * on, 0.22 of the covering reach where it was leaving.
 */
const HELD_FROM_COMING = 0.11;
const HELD_FROM_LEAVING = 0.22;
/** Long enough for each turn to settle. */
const SETTLE_MS = 900;
/** How long the pointer is away before it comes back mid-way. */
const AWAY_MS = 120;
/** Where the pointer rests, over no cell. */
const AWAY = { x: 1, y: 1 } as const;
/** How near its end a spring stands once a turn has settled, as a share of the lit reach. */
const END_SLACK_SHARE = 0.01;
/** A radius is written to the hundredth, and a spring's last step may land a hair past its end. */
const RADIUS_SLACK = 0.01;

test.use({ deviceScaleFactor: 1, reducedMotion: "no-preference" });
test.skip(({ isMobile }) => isMobile, "Filmed at one width on desktop; touch is filmed on its own");

/** The first frame at or after `from` that meets `isMet`, as ms after `from`. */
function msUntil<T extends { at: number }>(
  frames: T[],
  from: number,
  isMet: (frame: T) => boolean,
) {
  const frame = frames.find((each) => each.at >= from && isMet(each));
  return frame === undefined ? Infinity : frame.at - from;
}

/** The samples painted after `from`, up to `until`. */
function samplesBetween(log: PlateLog, from: number, until = Infinity) {
  return log.samples.filter((sample) => sample.at > from && sample.at < until);
}

/**
 * Holds one turn of a plate to its bar, from its commit until the next crossing starts: no radius
 * under nothing; after a leave every painted radius at or under the radius the page held at the
 * commit and at or under the one before it, after a return at or over both; and the radius held
 * at the commit near the last one painted before the crossing started.
 */
function expectTurnHolds(
  log: PlateLog,
  crossing: PlateCrossing,
  until: number,
  reaches: readonly LightReaches[],
) {
  const before = log.samples.filter((sample) => sample.at <= crossing.start.at).at(-1);
  if (before !== undefined) {
    crossing.commit.radii.forEach((held, circle) => {
      const { lit, covering } = reaches[circle]!;
      // A return turns a light that was leaving; a leave turns one that was coming on or lit.
      const most = crossing.isOnto ? HELD_FROM_LEAVING * covering : HELD_FROM_COMING * lit;
      expect(Math.abs(held - before.radii[circle]!), "held at the commit").toBeLessThanOrEqual(
        most,
      );
    });
  }
  let last = crossing.commit.radii;
  for (const sample of samplesBetween(log, crossing.commit.at, until)) {
    sample.radii.forEach((radius, circle) => {
      expect(radius).toBeGreaterThanOrEqual(0);
      const [held, previous] = [crossing.commit.radii[circle]!, last[circle]!];
      if (crossing.isOnto) {
        expect(radius, "never under where it was turned").toBeGreaterThanOrEqual(
          Math.min(held, previous) - RADIUS_SLACK,
        );
      } else {
        expect(radius, "never over where it was turned").toBeLessThanOrEqual(
          Math.max(held, previous) + RADIUS_SLACK,
        );
      }
    });
    last = sample.radii;
  }
}

for (const theme of THEMES) {
  for (const slug of Object.keys(INDEX_PICTURES)) {
    test(
      `${slug} ${theme === "light" ? "by day" : "by night"}: turns as the pointer crosses, lit whole, dropping and gone in time on the page's clock, and never turned back past where it stood`,
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
        const reaches = lightCirclesOf(INDEX_PICTURES[slug]!).map(({ reaches: each }) => each);
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
        const { crossings } = log;
        const [cameOn, wentOff] = crossings;
        const changed = on.changed;
        const allAt =
          (isMet: (radius: number, circle: number) => boolean) => (sample: { radii: number[] }) =>
            sample.radii.every(isMet);
        const tail = off.shares.filter((share) => share.at <= wentOff!.commit.at + TAIL_MS).at(-1);
        const firstAfterLeave = samplesBetween(log, wentOff!.commit.at)[0];
        const measures = {
          slug,
          theme,
          cpuRate: CPU_RATE,
          changed,
          commitMs: crossings.map(({ start, commit }) => commit.at - start.at),
          litRadiiMs: msUntil(
            log.samples,
            cameOn!.commit.at,
            allAt((radius, circle) => radius >= LIT_SHARE * reaches[circle]!.lit),
          ),
          dropRadiiMs: msUntil(
            log.samples,
            wentOff!.commit.at,
            allAt((radius, circle) => radius <= DROP_SHARE * reaches[circle]!.covering),
          ),
          goneRadiiMs: msUntil(
            log.samples,
            wentOff!.commit.at,
            allAt((radius, circle) => radius <= GONE_SHARE * reaches[circle]!.covering),
          ),
          litFilmMs: msUntil<LightShare>(
            on.shares,
            cameOn!.commit.at,
            (share) => share.offWhole <= changed * (1 - MOST_SHARE),
          ),
          dropFilmMs: msUntil<LightShare>(
            off.shares,
            wentOff!.commit.at,
            (share) => share.offWhole > changed * DROP_PIXELS_SHARE,
          ),
          goneFilmMs: msUntil<LightShare>(
            off.shares,
            wentOff!.commit.at,
            (share) => share.atRest >= changed * MOST_SHARE,
          ),
          tailLeft: tail === undefined ? changed : changed - tail.atRest,
          tailMost: tail?.mostFromRest ?? 255,
          firstAfterLeave: firstAfterLeave?.radii,
          heldAtLeave: wentOff!.commit.radii,
          covering: reaches.map(({ covering }) => covering),
        };
        writeFileSync(testInfo.outputPath("measures.json"), JSON.stringify(measures, null, 1));

        // The page commits each turn soon after the crossing starts.
        for (const ms of measures.commitMs) expect(ms, "the commit").toBeLessThanOrEqual(COMMIT_MS);
        // F3, F1 and F2 on the page's clock, from the commit.
        expect(measures.litRadiiMs, "lit whole").toBeLessThanOrEqual(LIT_MS);
        expect(measures.dropRadiiMs, "the drop").toBeLessThanOrEqual(DROP_MS);
        expect(measures.goneRadiiMs, "gone").toBeLessThanOrEqual(GONE_MS);
        // F1 on the circles: the first frame painted after the leave's commit is already under
        // each covering reach and under the radius the page held at the commit, so the turn is
        // drawn in the leave's own frame. That holds strictly up to the busy gate's rate. On a
        // slower CPU a commit can come more than a frame late, and the spring's first value, the
        // covering reach itself, is then painted once: a plate held there is the plate lit within
        // 0.23% of its light (`e2e/plates.spec.ts`, the jump's still), so it may stand at that
        // reach, never past it and never past the radius held at the commit.
        firstAfterLeave!.radii.forEach((radius, circle) => {
          if (radius === 0) return;
          const [covering, held] = [reaches[circle]!.covering, wentOff!.commit.radii[circle]!];
          if (CPU_RATE <= STRICT_FIRST_FRAME_CPU_RATE) {
            expect(radius).toBeLessThan(covering);
            expect(radius).toBeLessThan(held);
          } else {
            expect(radius).toBeLessThanOrEqual(covering);
            expect(radius).toBeLessThanOrEqual(held);
          }
        });
        // The film, as a backstop for the pixels, and the tail and the end of a turn.
        expect(measures.litFilmMs, "95% lit, filmed").toBeLessThanOrEqual(FILM_LIT_MS);
        expect(measures.dropFilmMs, "a drop, filmed").toBeLessThanOrEqual(FILM_DROP_MS);
        expect(measures.goneFilmMs, "95% gone, filmed").toBeLessThanOrEqual(FILM_GONE_MS);
        expect(measures.tailLeft, "left at 400 ms").toBeLessThanOrEqual(changed * TAIL_SHARE);
        expect(measures.tailMost, "the strongest left at 400 ms").toBeLessThanOrEqual(
          TAIL_MOST_LEVELS,
        );
        expect(afterTurn!.atRest, "back at rest once the turn has ended").toBe(changed);
        // F4: every turn, the return 120 ms into a leave among them, holds its bar.
        crossings.forEach((crossing, index) =>
          expectTurnHolds(log, crossing, crossings[index + 1]?.start.at ?? Infinity, reaches),
        );
        await decoder.close();
      },
    );
  }
}

test(
  "a plate turned mid-way, left while it comes on and pointed at again while it leaves, goes the new way from where it was turned and ends at rest or lit",
  { tag: "@frame" },
  async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await showWholePage(page, WIDTH);
    await awaitPlates(page);
    const slug = "rome";
    const box = (await plateBoxesOf(page)).find((plate) => plate.slug === slug)!.picture;
    const pointAt = () => page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const away = () => page.mouse.move(AWAY.x, AWAY.y);
    const reaches = lightCirclesOf(INDEX_PICTURES[slug]!).map(({ reaches: each }) => each);
    await away();
    await page.waitForTimeout(SETTLE_MS);
    await logPlate(page, slug);
    // Left 80 and 250 ms into coming on: inside and near the covering reach.
    for (const into of [80, 250]) {
      await pointAt();
      await page.waitForTimeout(into);
      await away();
      await page.waitForTimeout(SETTLE_MS);
    }
    // Pointed at again 60 and 200 ms into leaving.
    for (const into of [60, 200]) {
      await pointAt();
      await page.waitForTimeout(SETTLE_MS);
      await away();
      await page.waitForTimeout(into);
      await pointAt();
      await page.waitForTimeout(SETTLE_MS);
    }
    await away();
    await page.waitForTimeout(SETTLE_MS);
    const log = await plateLogOf(page);
    const { crossings } = log;
    const turns = crossings.map((crossing, index) => {
      const until = crossings[index + 1]?.start.at ?? Infinity;
      const before = log.samples.filter((sample) => sample.at <= crossing.start.at).at(-1);
      const painted = samplesBetween(log, crossing.commit.at, until);
      return {
        isOnto: crossing.isOnto,
        intoMs: index === 0 ? null : crossing.commit.at - crossings[index - 1]!.commit.at,
        commitMs: crossing.commit.at - crossing.start.at,
        lastPainted: before?.radii,
        held: crossing.commit.radii,
        nextPainted: painted.slice(0, 3).map(({ radii }) => radii),
        endsAt: painted.at(-1)?.radii,
      };
    });
    writeFileSync(testInfo.outputPath("midway.json"), JSON.stringify(turns, null, 1));
    crossings.forEach((crossing, index) =>
      expectTurnHolds(log, crossing, crossings[index + 1]?.start.at ?? Infinity, reaches),
    );
    // Each turn left to settle ends at nothing or at its lit reach, the last hair of a spring's
    // way aside.
    turns.forEach((turn, index) => {
      const next = crossings[index + 1];
      const isSettled =
        next === undefined ||
        next.start.at - crossings[index]!.commit.at > SETTLE_MS - 2 * FRAME_MS;
      if (!isSettled) return;
      turn.endsAt!.forEach((radius, circle) => {
        const end = turn.isOnto ? reaches[circle]!.lit : 0;
        expect(Math.abs(radius - end)).toBeLessThanOrEqual(reaches[circle]!.lit * END_SLACK_SHARE);
      });
    });
  },
);

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
    const [on, off] = log.crossings;
    expect(samplesBetween(log, on!.commit.at)[0]!.radii).toEqual([lit]);
    expect(samplesBetween(log, off!.commit.at)[0]!.radii).toEqual([0]);
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
