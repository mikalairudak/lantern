/**
 * Writes the masks the site's link card draws its plates from, as grey PNGs in `assets/pictures/`,
 * from the AVIF files the page serves (`src/lib/brand/card-masks.ts`): each plate's scene, its
 * `wide` file, and its sheet, which bounds its light by day. The card is drawn at build time by
 * a renderer that reads no AVIF, and a build has no decoder for one, so the PNGs are committed;
 * run `node scripts/card-masks.mts` again when a plate the card draws changes. Masks of plates the
 * card no longer draws are removed.
 *
 * It decodes with ffmpeg, which must be on the PATH: `brew install ffmpeg` on a Mac. Each file is
 * one grey channel at its source's full range and size, so the card's plate is the page's.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { INDEX_PICTURES } from "../src/features/day/index-picture-files.ts";
import { CARD_MASKS_FOLDER, cardMaskOf } from "../src/lib/brand/card-masks.ts";
import { SITE_CARD_PLATES } from "../src/lib/brand/site-card.ts";

const ROOT = new URL("../", import.meta.url);
const SOURCES = new URL("public/pictures/", ROOT);
const OUT = new URL(`${CARD_MASKS_FOLDER}/`, ROOT);

function ensureFfmpeg(): void {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    process.stderr.write(
      "ffmpeg is not on the PATH. Install it (on a Mac, `brew install ffmpeg`) and run this again.\n",
    );
    process.exit(1);
  }
}

/** Every file the card's plates are drawn from. */
function sourcesOfCard(): string[] {
  return SITE_CARD_PLATES.plates.flatMap(({ slug }) => {
    const picture = INDEX_PICTURES[slug];
    if (picture === undefined) throw new Error(`The card draws "${slug}", which has no picture`);
    return [picture.scene.files.wide, picture.sheet];
  });
}

ensureFfmpeg();
mkdirSync(OUT, { recursive: true });
const sources = sourcesOfCard();
const masks = new Set(sources.map(cardMaskOf));
for (const file of readdirSync(OUT)) {
  if (!masks.has(file)) rmSync(new URL(file, OUT));
}
for (const source of sources) {
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    fileURLToPath(new URL(source, SOURCES)),
    "-frames:v",
    "1",
    "-pix_fmt",
    "gray",
    fileURLToPath(new URL(cardMaskOf(source), OUT)),
  ]);
}
process.stdout.write(`Wrote ${sources.length} masks to ${CARD_MASKS_FOLDER}/.\n`);
