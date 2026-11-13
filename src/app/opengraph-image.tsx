import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";
import { BEAD, LIGHT_FAR_RADIUS, LIGHT_NEAR_RADIUS } from "@/components/ui/lantern-mark";
import { cardLinesOf } from "@/lib/brand/card-lines";
import { SITE_CARD, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { themeColor, themeColorsOf, type Theme } from "@/lib/tokens/theme-colors";

/*
 * The card every link to Lantern unfurls into, one for every page: the mark, a lit bead on a
 * sagging wire across the card, over the name and the site's line (`docs/discoverability.md`, "What
 * the code does"). Drawn at build time; nothing here runs for a visitor.
 *
 * The image is drawn by Satori, which reads no stylesheet and no class, so its colours are
 * the tokens' values read from globals.css and its type is Literata from static files of its
 * own (`assets/fonts/`, cut to Latin): the name in the 72 pt italic, the cut drawn for its size,
 * and the line in the 36 pt roman. Its styles are plain objects.
 */

export const size = { width: SITE_CARD.width, height: SITE_CARD.height };
export const contentType = SITE_CARD.type;
export const alt = SITE_CARD.alt;

/**
 * An image cannot follow the theme of whoever sees it, so the card takes one: the night, where
 * the bead's two steps of light still read; on the day's wall its haze all but vanishes.
 */
const CARD_THEME: Theme = "dark";
const COLORS = themeColorsOf(await readFile(join(process.cwd(), "src/app/globals.css"), "utf8"));

function color(name: string): string {
  return themeColor(COLORS, name, CARD_THEME);
}

const FONT_FAMILY = "Literata";
const fontFile = (file: string): Promise<Buffer> =>
  readFile(join(process.cwd(), "assets/fonts", file));
const REGULAR = await fontFile("Literata36pt-Regular.latin.ttf");
const ITALIC = await fontFile("Literata72pt-Italic.latin.ttf");

/** The mark drawn 7.4 times its 24-unit grid, so the bead is about 50 px across. */
const MARK_SCALE = 7.4;
/**
 * How far the whole drawing stands above where it was first set, for a line of one row: the
 * site's line in two rows would leave it heavy at the foot, so the block from the bead's light
 * to the line's last row stands at the card's optical centre, about 125 px from its top and
 * 130 from its foot. The block's own spacing is as set.
 */
const LIFT_PX = 65;
/** The bead stands at the card's centre across, above its middle. */
const BEAD_CENTER = { x: size.width / 2, y: 250 - LIFT_PX };
const BEAD_RADII = { x: BEAD.rx * MARK_SCALE, y: BEAD.ry * MARK_SCALE };
/**
 * The card's wire is thinner than the mark's stroke scaled up (11 px), so it reads as a wire
 * across the card rather than the icon's line.
 */
const WIRE_STROKE_PX = 3;
/** Each half of the wire stops this far short of the bead, as the mark's does. */
const WIRE_GAP_PX = 10;
/**
 * The wire's left half, from past the card's edge, sagging to the bead; the right half is its
 * mirror. It runs through the card's edges on purpose: it is a wire strung across, not an icon.
 */
const WIRE = {
  startX: -20,
  startY: 196 - LIFT_PX,
  controlX: 330,
  controlY: 236 - LIFT_PX,
  endY: 248 - LIFT_PX,
};
const WIRE_END_X = BEAD_CENTER.x - BEAD_RADII.x - WIRE_GAP_PX;

function mirrored(x: number): number {
  return size.width - x;
}

const WIRE_LEFT = `M${WIRE.startX} ${WIRE.startY} Q${WIRE.controlX} ${WIRE.controlY} ${WIRE_END_X} ${WIRE.endY}`;
const WIRE_RIGHT = `M${mirrored(WIRE_END_X)} ${WIRE.endY} Q${mirrored(WIRE.controlX)} ${WIRE.controlY} ${mirrored(WIRE.startX)} ${WIRE.startY}`;

/** The name, in the voice's italic, and the site's line under it, each centred. */
const NAME = { top: 360 - LIFT_PX, fontSize: 88, lineHeight: 1 };
/**
 * The line sits in the body text's line height, `--text-body--line-height` in globals.css, in
 * one line or two (`cardLinesOf`).
 */
const LINE = { top: 476 - LIFT_PX, fontSize: 30, lineHeight: 1.55 };

const CARD_STYLE: CSSProperties = {
  display: "flex",
  position: "relative",
  width: "100%",
  height: "100%",
  backgroundColor: color("ground"),
  fontFamily: FONT_FAMILY,
};
const DRAWING_STYLE: CSSProperties = { position: "absolute", top: 0, left: 0 };
const CENTRED_LINE_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  width: size.width,
  display: "flex",
  justifyContent: "center",
};
const NAME_STYLE: CSSProperties = {
  ...CENTRED_LINE_STYLE,
  ...NAME,
  fontStyle: "italic",
  color: color("ink"),
};
const LINE_STYLE: CSSProperties = {
  ...CENTRED_LINE_STYLE,
  flexDirection: "column",
  alignItems: "center",
  ...LINE,
  fontStyle: "normal",
  color: color("ink-soft"),
};

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div style={CARD_STYLE}>
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={DRAWING_STYLE}
      >
        {/* As the mark draws it: the light under the wire and the bead (docs/brand/README.md). */}
        <circle
          cx={BEAD_CENTER.x}
          cy={BEAD_CENTER.y}
          r={LIGHT_FAR_RADIUS * MARK_SCALE}
          fill={color("lamp-haze")}
        />
        <circle
          cx={BEAD_CENTER.x}
          cy={BEAD_CENTER.y}
          r={LIGHT_NEAR_RADIUS * MARK_SCALE}
          fill={color("lamp-glow")}
        />
        <path
          d={WIRE_LEFT}
          fill="none"
          stroke={color("ink")}
          strokeWidth={WIRE_STROKE_PX}
          strokeLinecap="round"
        />
        <path
          d={WIRE_RIGHT}
          fill="none"
          stroke={color("ink")}
          strokeWidth={WIRE_STROKE_PX}
          strokeLinecap="round"
        />
        <ellipse
          cx={BEAD_CENTER.x}
          cy={BEAD_CENTER.y}
          rx={BEAD_RADII.x}
          ry={BEAD_RADII.y}
          fill={color("lamp")}
        />
      </svg>
      <div style={NAME_STYLE}>{SITE_NAME}</div>
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
}
