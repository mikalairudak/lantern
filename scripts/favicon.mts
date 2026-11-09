/**
 * Draws `src/app/favicon.ico` from the brand's own drawings, at 16, 32 and 48 px, each from
 * the drawing the brand gives its size (`docs/brand/README.md`): the 16 drawing below 20 px,
 * the master from 20 to 63. Next serves a favicon only as a file in `src/app`, so the ICO is
 * committed; run `node scripts/favicon.mts` again when the mark changes.
 *
 * Browsers that read `icon.svg` follow the visitor's theme. The ICO is for what does not:
 * older Safari, bookmarks, and the crawlers that ask for `/favicon.ico` by name, which set it
 * on a tab bar or a results page of either colour. So it is the mark on its own tile of the
 * night's ground, as the home-screen icon is, which reads on both.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { icoOf, type IcoImage } from "../src/lib/brand/ico.ts";
import { themeColor, themeColorsOf } from "../src/lib/tokens/theme-colors.ts";

const BRAND = new URL("../docs/brand/", import.meta.url);
const OUT = new URL("../src/app/favicon.ico", import.meta.url);

const SIZES = [
  { px: 16, drawing: "lantern-mark-16.svg" },
  { px: 32, drawing: "lantern-mark.svg" },
  { px: 48, drawing: "lantern-mark.svg" },
] as const;

const stylesheet = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const ground = themeColor(themeColorsOf(stylesheet), "ground", "dark");

interface Tile {
  svg: string;
  px: number;
  ground: string;
}

/**
 * One size as a PNG: the drawing on a canvas filled with the ground, its dark scheme chosen by
 * the page. A canvas keeps the alpha channel, so each PNG is the 32-bit RGBA image its entry
 * says it is; a screenshot of an opaque page is RGB, which Next's ICO reader refuses.
 */
function drawTile({ svg, px, ground }: Tile): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("The drawing did not load"));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const context = canvas.getContext("2d");
      if (context === null) return reject(new Error("No 2D canvas"));
      context.fillStyle = ground;
      context.fillRect(0, 0, px, px);
      context.drawImage(image, 0, 0, px, px);
      resolve(canvas.toDataURL("image/png"));
    };
    image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
  });
}

const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ colorScheme: "dark" })).newPage();
  await page.setContent("<!doctype html><title>favicon</title>");
  const images: IcoImage[] = [];
  for (const { px, drawing } of SIZES) {
    const svg = readFileSync(new URL(drawing, BRAND), "utf8");
    const dataUrl = await page.evaluate(drawTile, { svg, px, ground });
    images.push({ px, png: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64") });
  }
  writeFileSync(OUT, icoOf(images));
  process.stdout.write(
    `Wrote ${fileURLToPath(OUT)}: ${SIZES.map(({ px }) => `${px} px`).join(", ")}.\n`,
  );
} finally {
  await browser.close();
}
