// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDEX_PICTURES } from "@/features/day/index-picture-files";
import { avifSizeOf, CARD_MASKS_FOLDER, cardMaskOf, pngSizeOf } from "./card-masks";
import { SITE_CARD_PLATES } from "./site-card";

const ROOT = join(__dirname, "..", "..", "..");
const RUN_AGAIN = "run `node scripts/card-masks.mts` again";

/** Every file the card's plates are drawn from, as the page serves it. */
const SOURCES = SITE_CARD_PLATES.plates.flatMap(({ slug }) => {
  const picture = INDEX_PICTURES[slug];
  if (picture === undefined) throw new Error(`The card draws "${slug}", which has no picture`);
  return [picture.scene.files.wide, picture.sheet];
});

describe("the card's masks", () => {
  it("names each mask as its plate's file, as a PNG", () => {
    expect(cardMaskOf("tokyo-sheet.f435cbc2.avif")).toBe("tokyo-sheet.f435cbc2.png");
    expect(() => cardMaskOf("tokyo-sheet.f435cbc2.png")).toThrow("is not a plate's AVIF file");
  });

  it.each(SOURCES)("holds %s as a PNG of its size", (source) => {
    const mask = join(ROOT, CARD_MASKS_FOLDER, cardMaskOf(source));
    expect(existsSync(mask), `${cardMaskOf(source)} is missing: ${RUN_AGAIN}`).toBe(true);
    expect(
      pngSizeOf(readFileSync(mask)),
      `${cardMaskOf(source)} is not its source's size: ${RUN_AGAIN}`,
    ).toEqual(avifSizeOf(readFileSync(join(ROOT, "public/pictures", source))));
  });

  it("holds no mask the card does not draw", () => {
    const masks = SOURCES.map(cardMaskOf).sort();
    expect(readdirSync(join(ROOT, CARD_MASKS_FOLDER)).sort(), RUN_AGAIN).toEqual(masks);
  });

  // A mask is matched to its source by name alone, so the name has to change when the bytes do.
  it.each(SOURCES)("finds %s named by the hash of its bytes", (source) => {
    const named = /\.([0-9a-f]{8})\.avif$/.exec(source)?.[1];
    const bytes = readFileSync(join(ROOT, "public/pictures", source));
    expect(createHash("sha256").update(bytes).digest("hex").slice(0, 8)).toBe(named);
  });

  // The route spells the folder out for the build's file tracing, so nothing else ties the two.
  it("is read by the card's route from the folder the script writes", () => {
    const route = readFileSync(join(ROOT, "src/app/opengraph-image.tsx"), "utf8");
    expect(route).toContain(`"${CARD_MASKS_FOLDER}"`);
  });
});

describe("an image's size", () => {
  it("reads a PNG's from its header and refuses a file that is not one", () => {
    const png = readFileSync(join(ROOT, "docs/brand/lantern-apple-icon.png"));
    expect(pngSizeOf(png)).toEqual({ width: 180, height: 180 });
    expect(() => pngSizeOf(new Uint8Array(24))).toThrow("Not a PNG");
  });

  it("reads an AVIF's from its image size box and refuses a file with none", () => {
    expect(
      avifSizeOf(readFileSync(join(ROOT, "public/pictures", "tokyo-sheet.f435cbc2.avif"))),
    ).toEqual({ width: 248, height: 225 });
    expect(() => avifSizeOf(new Uint8Array(24))).toThrow("it has no image size box");
  });
});
