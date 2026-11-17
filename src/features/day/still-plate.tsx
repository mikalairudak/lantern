import type { CSSProperties, JSX } from "react";
import { FIELD_CENTRE, pictureBoxOf, type IndexPicture } from "./index-pictures";
import {
  BoundsGrain,
  Falloff,
  FRONT_GRAIN_SLOPE,
  LightGrain,
  POOL_GRAIN_SLOPE,
  SolidFalloff,
} from "./plate-filters";
import {
  lampPointsOf,
  lightBoxOf,
  lightCirclesOf,
  POOL_STEPS,
  poolRadiiOf,
  poolsBoxOf,
  rectOf,
  type FieldBox,
  type PoolStep,
} from "./plate-light";

/**
 * A city's plate held still, by day, for an image renderer that reads no stylesheet and runs no
 * script, as a link's card draws it: the page's own plate (`IndexPlate`), with its masks,
 * filters and light, at rest or settled lit, its colours given rather than read from classes.
 * By day the plate has no tone and the sheet alone bounds its light, so the footprint is not
 * drawn. Every element is a plain SVG one, since the renderer draws no component inside an SVG.
 */

/** The colour tokens a plate is drawn in by day. */
export type StillPlateToken = "engraving" | "plate-lit" | "plate-half";

/** Each step of a pool's fill, as the page's pools paint it: half-light at the edge, the light within. */
export const POOL_TOKENS: Readonly<Record<PoolStep, StillPlateToken>> = {
  edge: "plate-half",
  pool: "plate-lit",
  heart: "plate-lit",
};

/** At rest each lamp burns low in its pool; lit, the plate is lit whole from every source. */
export type StillLight = "rest" | "lit";

/** Where a plate stands on the image, in px: its size a field unit, its field's centre across, and its box's foot. */
export interface StillPlacement {
  scale: number;
  centre: number;
  foot: number;
}

/** A box on the image, in px. */
export interface ImageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The two grey files a still plate is drawn from, each as the address the renderer reads. */
export interface StillPlateMasks {
  /** The scene's lines, its `wide` file. */
  scene: string;
  /** The day's bounds of its light. */
  sheet: string;
}

/** A box on the field, placed on the image. */
function placedBoxOf(
  [left, top, width, height]: FieldBox,
  { scale, centre, foot }: StillPlacement,
  fieldFoot: number,
): ImageBox {
  return {
    left: centre + (left - FIELD_CENTRE) * scale,
    top: foot - (fieldFoot - top) * scale,
    width: width * scale,
    height: height * scale,
  };
}

/** The foot of a picture's box on the field, where every plate's box ends. */
function fieldFootOf(picture: IndexPicture): number {
  const [, top, , height] = pictureBoxOf(picture);
  return top + height;
}

/** A plate's box on the image, as the index's cell holds it: the field's width, from over its scene to its foot. */
export function stillPlateBoxOf(picture: IndexPicture, placement: StillPlacement): ImageBox {
  return placedBoxOf(pictureBoxOf(picture), placement, fieldFootOf(picture));
}

/** A plate's light's box on the image, where its lit sheet may stand. */
export function stillLightBoxOf(picture: IndexPicture, placement: StillPlacement): ImageBox {
  return placedBoxOf(lightBoxOf(picture), placement, fieldFootOf(picture));
}

/** What a still plate's drawing covers on the field: its box and its light's, which may pass it at the sides. */
export function drawnBoxOf(picture: IndexPicture): FieldBox {
  const [viewLeft, viewTop, viewWidth, viewHeight] = pictureBoxOf(picture);
  const [lightLeft, lightTop, lightWidth, lightHeight] = lightBoxOf(picture);
  const left = Math.min(viewLeft, lightLeft);
  const top = Math.min(viewTop, lightTop);
  const right = Math.max(viewLeft + viewWidth, lightLeft + lightWidth);
  const bottom = Math.max(viewTop + viewHeight, lightTop + lightHeight);
  return [left, top, right - left, bottom - top];
}

const url = (id: string): string => `url(#${id})`;

/** Each plate stands where its placement puts it, over the image's ground. */
const PLACED_STYLE: CSSProperties = { position: "absolute" };

/**
 * One plate held still on the image, placed by its scale, its field's centre and its foot, as an
 * SVG element. It is a function and not a component: the renderer gathers the images an SVG
 * holds before it calls any component, so a plate's masks must be in the tree it is given. Its
 * ids are its own, since the renderer draws each SVG as an image of its own.
 */
export function stillPlateOf({
  picture,
  masks,
  colors,
  placement,
  light,
}: {
  picture: IndexPicture;
  masks: StillPlateMasks;
  colors: Readonly<Record<StillPlateToken, string>>;
  placement: StillPlacement;
  light: StillLight;
}): JSX.Element {
  const drawn = drawnBoxOf(picture);
  const onImage = placedBoxOf(drawn, placement, fieldFootOf(picture));
  const scene = picture.scene.box;
  const box = lightBoxOf(picture);
  const lamps = lampPointsOf(picture);
  const radii = poolRadiiOf(picture);
  const poolsBox = poolsBoxOf(picture);
  const circles = lightCirclesOf(picture);
  return (
    <svg
      width={onImage.width}
      height={onImage.height}
      viewBox={drawn.join(" ")}
      style={{ ...PLACED_STYLE, left: onImage.left, top: onImage.top }}
    >
      <defs>
        <mask id="ink" maskUnits="userSpaceOnUse" {...rectOf(scene)}>
          <image href={masks.scene} {...rectOf(scene)} preserveAspectRatio="none" />
        </mask>
        <mask id="sheet" maskUnits="userSpaceOnUse" {...rectOf(box)}>
          <image href={masks.sheet} {...rectOf(box)} preserveAspectRatio="none" />
        </mask>
        {BoundsGrain({ id: "bounds-grain", box })}
        {/* An alpha mask: only the fill's alpha is read, so any opaque token serves. */}
        <mask id="light" maskUnits="userSpaceOnUse" {...rectOf(box)} mask-type="alpha">
          <g filter={url("bounds-grain")}>
            <rect {...rectOf(box)} fill={colors["plate-lit"]} mask={url("sheet")} />
          </g>
        </mask>
        {poolsBox !== null && Falloff({ id: "falloff" })}
        {poolsBox !== null &&
          LightGrain({ id: "pool-grain", box: poolsBox, slope: POOL_GRAIN_SLOPE })}
        {poolsBox !== null &&
          POOL_STEPS.map((step) => (
            <mask
              key={step}
              id={`pool-${step}`}
              maskUnits="userSpaceOnUse"
              {...rectOf(poolsBox)}
              mask-type="alpha"
            >
              <g filter={url("pool-grain")}>
                {lamps.map((lamp, index) => (
                  <circle
                    key={index}
                    cx={lamp.x}
                    cy={lamp.y}
                    r={radii[step]}
                    fill={url("falloff")}
                  />
                ))}
              </g>
            </mask>
          ))}
        {light === "lit" && SolidFalloff({ id: "solid" })}
        {light === "lit" && LightGrain({ id: "front-grain", box, slope: FRONT_GRAIN_SLOPE })}
        {light === "lit" && (
          <mask id="whole" maskUnits="userSpaceOnUse" {...rectOf(box)} mask-type="alpha">
            <g filter={url("front-grain")}>
              {circles.map(({ x, y, reaches }, index) => (
                <circle key={index} cx={x} cy={y} r={reaches.lit} fill={url("solid")} />
              ))}
            </g>
          </mask>
        )}
      </defs>
      <g mask={url("light")}>
        {poolsBox !== null &&
          POOL_STEPS.map((step) => (
            <rect
              key={step}
              {...rectOf(poolsBox)}
              fill={colors[POOL_TOKENS[step]]}
              mask={url(`pool-${step}`)}
            />
          ))}
        {light === "lit" && (
          <rect {...rectOf(box)} fill={colors["plate-lit"]} mask={url("whole")} />
        )}
      </g>
      <rect {...rectOf(scene)} fill={colors.engraving} mask={url("ink")} />
    </svg>
  );
}
