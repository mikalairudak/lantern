import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";
import { indexPictureOf } from "@/features/day/index-pictures";
import { lockupLayoutOf, stillLockupOf } from "@/features/day/still-lockup";
import { stillPlateOf, type StillPlateMasks } from "@/features/day/still-plate";
import { cardMaskOf } from "@/lib/brand/card-masks";
import { cardLinesOf } from "@/lib/brand/card-lines";
import { fontMeasuresOf } from "@/lib/brand/font-advances";
import { indexedPngOf, rgbImageOf } from "@/lib/brand/png-palette";
import { SITE_CARD_LINE, SITE_CARD_LOCKUP, SITE_CARD_PLATES } from "@/lib/brand/site-card";
import { SITE_CARD, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { themeColor, themeColorsOf, type Theme } from "@/lib/tokens/theme-colors";

/*
 * The card every link to Lantern unfurls into, one for every page: three of the index's plates,
 * the middle one lit, over the lockup and the site's line (`src/lib/brand/site-card.ts`). Drawn at
 * build time; nothing here runs for a visitor.
 *
 * The image is drawn by Satori, which reads no stylesheet and no class, so its colours are the
 * tokens' values read from globals.css, its type is Literata from static files of its own
 * (`assets/fonts/`, cut to Latin), the name in the 72 pt italic and the line in the 36 pt roman,
 * and each plate is drawn from PNG copies of its masks (`assets/pictures/`), since it reads no
 * AVIF. Its styles are plain objects.
 */

export const size = { width: SITE_CARD.width, height: SITE_CARD.height };
export const contentType = SITE_CARD.type;
export const alt = SITE_CARD.alt;

/**
 * An image cannot follow the theme of whoever sees it, so the card takes one: the day, which a
 * visitor lands on. By day the light a card shows is lit paper, a sheet across a plate a little
 * paler than the ground, not the mark's haze, which all but vanishes on it (`docs/decisions.md`,
 * "The link card is drawn by day, a lit plate between two at rest").
 */
const CARD_THEME: Theme = "light";
const COLORS = themeColorsOf(await readFile(join(process.cwd(), "src/app/globals.css"), "utf8"));

function color(name: string): string {
  return themeColor(COLORS, name, CARD_THEME);
}

const PLATE_COLORS = {
  engraving: color("engraving"),
  "plate-lit": color("plate-lit"),
  "plate-half": color("plate-half"),
};
const LOCKUP_COLORS = {
  ink: color("ink"),
  lamp: color("lamp"),
  "lamp-glow": color("lamp-glow"),
  "lamp-haze": color("lamp-haze"),
};

const FONT_FAMILY = "Literata";
const fontFile = (file: string): Promise<Buffer> =>
  readFile(join(process.cwd(), "assets/fonts", file));
const REGULAR = await fontFile("Literata36pt-Regular.latin.ttf");
const ITALIC = await fontFile("Literata72pt-Italic.latin.ttf");
const ITALIC_MEASURES = fontMeasuresOf(ITALIC);
const REGULAR_MEASURES = fontMeasuresOf(REGULAR);

/**
 * A plate's file as the renderer reads it: its PNG mask, inline. The folder is `CARD_MASKS_FOLDER`
 * spelled out, since the build traces the files a route reads only under a folder it can see.
 */
async function maskOf(file: string): Promise<string> {
  const png = await readFile(join(process.cwd(), "assets/pictures", cardMaskOf(file)));
  return `data:image/png;base64,${png.toString("base64")}`;
}

const PLATES = await Promise.all(
  SITE_CARD_PLATES.plates.map(async ({ slug, centre, light }) => {
    const picture = indexPictureOf(slug);
    if (picture === null) throw new Error(`The card draws "${slug}", which has no picture`);
    const masks: StillPlateMasks = {
      scene: await maskOf(picture.scene.files.wide),
      sheet: await maskOf(picture.sheet),
    };
    return { picture, masks, light, centre };
  }),
);

const LOCKUP = lockupLayoutOf(
  SITE_CARD_LOCKUP,
  ITALIC_MEASURES.widthOf(SITE_NAME, SITE_CARD_LOCKUP.size),
  ITALIC_MEASURES.baselineShareAt(1),
);

/** The line's box, its rows centred, placed by its first baseline. */
const LINE_TOP =
  SITE_CARD_LINE.firstBaseline -
  REGULAR_MEASURES.baselineShareAt(SITE_CARD_LINE.lineHeight) * SITE_CARD_LINE.size;

const CARD_STYLE: CSSProperties = {
  display: "flex",
  position: "relative",
  width: "100%",
  height: "100%",
  backgroundColor: color("ground"),
  fontFamily: FONT_FAMILY,
};
const LINE_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  width: size.width,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  top: LINE_TOP,
  fontSize: SITE_CARD_LINE.size,
  lineHeight: SITE_CARD_LINE.lineHeight,
  fontStyle: "normal",
  color: color("ink-soft"),
};

/** The colours the card is flat in, which its palette keeps exactly. */
const FLAT_COLORS = [
  color("ground"),
  color("ink-soft"),
  ...Object.values(PLATE_COLORS),
  ...Object.values(LOCKUP_COLORS),
];

/**
 * The card as the renderer draws it, then in a palette of 256 colours, at about half the weight
 * (`src/lib/brand/png-palette.ts`).
 */
export default async function OpenGraphImage(): Promise<Response> {
  const drawn = new ImageResponse(
    <div style={CARD_STYLE}>
      {PLATES.map(({ picture, masks, light, centre }) =>
        stillPlateOf({
          picture,
          masks,
          colors: PLATE_COLORS,
          placement: { scale: SITE_CARD_PLATES.scale, centre, foot: SITE_CARD_PLATES.foot },
          light,
        }),
      )}
      {stillLockupOf({ layout: LOCKUP, colors: LOCKUP_COLORS })}
      <div style={LINE_STYLE}>
        {cardLinesOf(SITE_DESCRIPTION).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: FONT_FAMILY, data: REGULAR, style: "normal", weight: 400 },
        { name: FONT_FAMILY, data: ITALIC, style: "italic", weight: 400 },
      ],
    },
  );
  const image = rgbImageOf(new Uint8Array(await drawn.arrayBuffer()));
  return new Response(indexedPngOf(image, FLAT_COLORS), { headers: drawn.headers });
}
