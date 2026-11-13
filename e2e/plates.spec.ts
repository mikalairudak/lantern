import { writeFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import {
  awaitPlates,
  differenceOf,
  hideWords,
  lineBoxesOf,
  plateBoxesOf,
  shotOf,
  showWholePage,
  type Box,
} from "./plate-pixels";

/**
 * The index's plates on the screen (`docs/decisions.md`, "A plate is lit whole, from sources drawn
 * in it"): nothing of a plate stands in a line of text, past its picture's top or foot, past its
 * cell at a side or at the screen's edge, and a plate lit whole is lit to its bounds' edge. Each
 * width and theme is shot whole, with the index's words made transparent, against the same page
 * with its plates hidden.
 */

const WIDTHS = [390, 600, 847, 1280] as const;
const THEMES = ["light", "dark"] as const;
const SCALE = 2;
/** Seen is over 1 ΔE2000: no text line may hold that much of a plate. */
const SEEN_DELTA_E = 1;
/** Wider than any reach, so every circle covers its whole light's box. */
const OPEN_RADIUS = 5000;
/** The strip at each side of the page that must be the bare page's, in CSS px. */
const EDGE_PX = 2;
/** A frame or two for a radius set by hand to be painted. */
const PAINT_MS = 100;

test.use({ reducedMotion: "reduce", deviceScaleFactor: SCALE });
// One browser's layout per width is enough: the widths are set here, not by the project.
test.skip(({ isMobile }) => isMobile, "Shot at four widths on desktop");

/** The page with its plates hidden, as the bare page every shot is held against. */
async function setPlatesHidden(page: import("@playwright/test").Page, isHidden: boolean) {
  await page.evaluate((hidden) => {
    for (const svg of document.querySelectorAll<SVGElement>("svg[data-picture]")) {
      svg.style.visibility = hidden ? "hidden" : "";
    }
  }, isHidden);
}

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test(`at ${width} px ${theme === "light" ? "by day" : "by night"}, nothing of a plate stands in a line of text, past its picture or its cell, or at the screen's edge, and a plate lit is lit whole`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
      await showWholePage(page, width);
      await awaitPlates(page);
      await hideWords(page);
      await page.mouse.move(1, 1);
      const decoder = await page.context().newPage();
      const lines = await lineBoxesOf(page);
      const plates = await plateBoxesOf(page);
      const height = page.viewportSize()!.height;
      const edges: Box[] = [
        { x: 0, y: 0, width: EDGE_PX, height },
        { x: width - EDGE_PX, y: 0, width: EDGE_PX, height },
      ];
      const rest = await shotOf(page);
      await setPlatesHidden(page, true);
      const bare = await shotOf(page);
      await setPlatesHidden(page, false);

      const rows: Record<string, unknown>[] = [];
      const atRest = await differenceOf(decoder, rest, bare, SCALE, {
        lines,
        allowed: plates.map(({ picture }) => picture),
        edges,
      });
      rows.push({ state: "at rest", ...atRest });

      for (const { slug } of plates) {
        const svg = page.locator(`svg[data-picture="${slug}"]`);
        await svg.hover();
        await expect(svg).toHaveAttribute("data-light", "lit");
        await page.waitForTimeout(PAINT_MS);
        const lit = await shotOf(page);
        const plate = (await plateBoxesOf(page)).find((each) => each.slug === slug)!;
        const onText = await differenceOf(decoder, lit, bare, SCALE, {
          lines: await lineBoxesOf(page),
          edges,
        });
        const pastBox = await differenceOf(decoder, lit, rest, SCALE, {
          allowed: [plate.picture],
        });
        await svg.evaluate((element, radius) => {
          for (const circle of element.querySelectorAll('mask[id$="-whole"] circle')) {
            circle.setAttribute("r", String(radius));
          }
        }, OPEN_RADIUS);
        await page.waitForTimeout(PAINT_MS);
        const opened = await shotOf(page);
        const unlit = await differenceOf(decoder, lit, opened, SCALE, {});
        rows.push({
          state: `${plate.slug} lit`,
          linesDeltaE: onText.linesDeltaE,
          atEdges: onText.atEdges,
          outside: pastBox.outside,
          outsideBox: pastBox.outsideBox,
          unlitSpecks: unlit.differing,
          unlitMost: unlit.most,
        });
        await page.mouse.move(1, 1);
        await expect(svg).toHaveAttribute("data-light", "rest");
      }
      // The measures stay beside the run's results, whichever reporter ran it.
      writeFileSync(
        testInfo.outputPath("measures.json"),
        JSON.stringify({ width, theme, rows }, null, 1),
      );

      for (const row of rows) {
        // S1: no text line holds any of a plate's light or tone.
        expect(row["linesDeltaE"], `${row["state"]}: in a line of text`).toBeLessThanOrEqual(
          SEEN_DELTA_E,
        );
        // S2: nothing past the picture's top or foot, or past its cell at a side.
        expect(row["outside"], `${row["state"]}: past its picture or cell`).toBe(0);
        // S3: the screen's edge is the bare page's.
        expect(row["atEdges"], `${row["state"]}: at the screen's edge`).toBe(0);
        // S4: lit whole is whole: opening every circle changes nothing.
        if ("unlitSpecks" in row) expect(row["unlitSpecks"], `${row["state"]}: unlit`).toBe(0);
      }
      const scroll = await page.evaluate(() => ({
        scrollWidth: document.scrollingElement!.scrollWidth,
        clientWidth: document.scrollingElement!.clientWidth,
      }));
      expect(scroll.scrollWidth).toBe(scroll.clientWidth);
      await decoder.close();
    });
  }
}

/** The plate's light, by day and by night, and its tone by night, as `globals.css` sets them. */
const LIGHT_FILLS = [
  [255, 253, 248],
  [255, 226, 179],
  [252, 244, 231],
  [182, 141, 83],
] as const;
const NIGHT_TONE = [76, 120, 135] as const;

for (const theme of THEMES) {
  test(`under forced colours ${theme === "light" ? "by day" : "by night"}, a plate draws its lines and its tone and none of its light, and a plate pointed at is told by its name's rule`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: theme,
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await page.goto("/");
    await showWholePage(page, WIDTHS[0]);
    await awaitPlates(page);
    const rome = page.locator('svg[data-picture="rome"]');
    await rome.hover();
    await expect(rome).toHaveAttribute("data-light", "lit");
    const name = page
      .getByRole("button", { name: /^Rome / })
      .locator("span > span")
      .first();
    expect(await name.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe(
      "underline",
    );
    const png = (await rome.screenshot()).toString("base64");
    const decoder = await page.context().newPage();
    const found = await decoder.evaluate(
      async ({ png, fills, tone }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, image.width, image.height).data;
        const near = (i: number, [r, g, b]: readonly number[]) =>
          Math.max(
            Math.abs(data[i]! - r!),
            Math.abs(data[i + 1]! - g!),
            Math.abs(data[i + 2]! - b!),
          ) <= 3;
        let light = 0;
        let toned = 0;
        let dark = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (fills.some((fill) => near(i, fill))) light += 1;
          if (near(i, tone)) toned += 1;
          if (data[i]! + data[i + 1]! + data[i + 2]! < 120) dark += 1;
        }
        return { light, toned, dark };
      },
      { png, fills: LIGHT_FILLS, tone: NIGHT_TONE },
    );
    expect(found.light, "pixels of the plate's light").toBe(0);
    expect(found.dark, "the lines").toBeGreaterThan(0);
    if (theme === "dark") expect(found.toned, "the night's tone").toBeGreaterThan(0);
    await decoder.close();
  });
}
