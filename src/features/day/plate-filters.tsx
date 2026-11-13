import { Fragment } from "react";
import {
  BOUNDS_SOFTENING,
  FOOTPRINT_SPREAD,
  rectOf,
  SHEET_SPREAD,
  type FieldBox,
} from "./plate-light";

/**
 * The SVG filters and gradients a plate is drawn with. Light is printed as a tone: a falloff is
 * pushed up and down by a fine noise, as an aquatint's grain breaks a tone, and steepened, so it
 * ends in specks of paper and never in a smooth gradient's rim.
 */

/** The noise's alpha, spread to the whole of 0 to 1 from the narrow band a fractal noise gives. */
const NOISE_TO_ALPHA = "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -1.1";
/** The grain's fineness, in cycles a field unit, and its octaves. */
const GRAIN_FREQUENCY = 0.85;
const GRAIN_OCTAVES = 2;
/** The light's grain and the bounds' are two noises, so their specks never line up. */
const LIGHT_SEED = 7;
const BOUNDS_SEED = 3;
/** How hard the light's grain cuts: low keeps a soft tone, high leaves stipple. */
const LIGHT_BITE = 0.5;

/**
 * The grain cut into what it is given, its region a box on the field. The noise scales the light
 * it is given, so it leaves no speck where there is no light. `slope` steepens it: the pools'
 * soft grain, or a lit fill's front, solid inside and grained only where it gives out.
 */
export function LightGrain({ id, box, slope }: { id: string; box: FieldBox; slope: number }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" {...rectOf(box)}>
      <feTurbulence
        type="fractalNoise"
        baseFrequency={GRAIN_FREQUENCY}
        numOctaves={GRAIN_OCTAVES}
        seed={LIGHT_SEED}
      />
      <feColorMatrix values={NOISE_TO_ALPHA} result="noise" />
      <feComposite
        in="SourceGraphic"
        in2="noise"
        operator="arithmetic"
        k1={LIGHT_BITE * 2}
        k2={1 - LIGHT_BITE}
      />
      <feComponentTransfer>
        <feFuncA type="linear" slope={slope} intercept={(1 - slope) / 4} />
      </feComponentTransfer>
    </filter>
  );
}

/** The pools' grain, and the lit front's, which is solid inside and grained where it ends. */
export const POOL_GRAIN_SLOPE = 1.7;
export const FRONT_GRAIN_SLOPE = 4;

/**
 * The grain cut into a plate's bounds, given as alpha: the soft shape pushed by a noise and
 * steepened to a grained edge, then nothing where the shape is under 5 of 255, so no speck is left
 * where the bounds are empty. Its region is the plate's light's box.
 */
export function BoundsGrain({ id, box }: { id: string; box: FieldBox }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" {...rectOf(box)}>
      <feTurbulence
        type="fractalNoise"
        baseFrequency={GRAIN_FREQUENCY}
        numOctaves={GRAIN_OCTAVES}
        seed={BOUNDS_SEED}
      />
      <feColorMatrix values={NOISE_TO_ALPHA} result="noise" />
      <feComposite in="SourceAlpha" in2="noise" operator="arithmetic" k2="1" k3="0.3" k4="-0.15" />
      <feComponentTransfer result="grained">
        <feFuncA type="linear" slope="2.2" intercept="-0.3" />
      </feComponentTransfer>
      <feComponentTransfer in="SourceAlpha" result="kept">
        <feFuncA type="linear" slope="51" intercept="-1" />
      </feComponentTransfer>
      <feComposite in="grained" in2="kept" operator="in" />
    </filter>
  );
}

/** The plate's two bounds by name, and how far each spreads the scene's ink. */
export const BOUNDS = [
  { name: "footprint", spread: FOOTPRINT_SPREAD },
  { name: "sheet", spread: SHEET_SPREAD },
] as const;

export type BoundsName = (typeof BOUNDS)[number]["name"];

/**
 * A plate's two bounds as alpha masks over its light's box, `<id>-footprint` and `<id>-sheet`:
 * the scene's ink, spread until it closes and softened, read from the scene's own file. Each says
 * when its file has come in, or failed.
 */
export function PlateBounds({
  id,
  src,
  scene,
  box,
  onLoad,
  onError,
}: {
  id: string;
  src: string | null;
  scene: FieldBox;
  box: FieldBox;
  onLoad: (name: BoundsName) => void;
  onError: () => void;
}) {
  return BOUNDS.map(({ name, spread }) => (
    <Fragment key={name}>
      <filter id={`${id}-${name}-shape`} filterUnits="userSpaceOnUse" {...rectOf(box)}>
        <feColorMatrix type="luminanceToAlpha" />
        <feMorphology operator="dilate" radius={spread} />
        <feGaussianBlur stdDeviation={BOUNDS_SOFTENING} />
      </filter>
      <mask id={`${id}-${name}`} maskUnits="userSpaceOnUse" {...rectOf(box)} mask-type="alpha">
        {src !== null && (
          <image
            href={src}
            {...rectOf(scene)}
            preserveAspectRatio="none"
            filter={`url(#${id}-${name}-shape)`}
            onLoad={() => onLoad(name)}
            onError={onError}
          />
        )}
      </mask>
    </Fragment>
  ));
}

/** A lamp's falloff: full at its heart, most of its light gone by two thirds of its reach. */
export function Falloff({ id }: { id: string }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopOpacity="1" />
      <stop offset="0.3" stopOpacity="0.82" />
      <stop offset="0.62" stopOpacity="0.36" />
      <stop offset="1" stopOpacity="0" />
    </radialGradient>
  );
}
