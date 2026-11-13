"use client";

import { motion, useReducedMotionConfig } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { SPRINGS } from "@/lib/tokens/motion";
import {
  densityFor,
  indexPictureOf,
  pictureSrcOf,
  viewBoxOf,
  type IndexPicture,
} from "./index-pictures";
import {
  BOUNDS,
  BoundsGrain,
  Falloff,
  LightGrain,
  PlateBounds,
  POOL_GRAIN_SLOPE,
  type BoundsName,
} from "./plate-filters";
import {
  lampPointsOf,
  lightBoxOf,
  POOL_STEPS,
  poolRadiiOf,
  poolsBoxOf,
  rectOf,
  type PoolStep,
} from "./plate-light";

/** How far under the screen a cell starts loading its picture, so it has arrived when scrolled to. */
const NEAR_MARGIN = "50% 0px";

/** Each step of a pool's fill: half-light at its edge, the light itself in the pool and its heart. */
const POOL_CLASSES: Readonly<Record<PoolStep, string>> = {
  edge: "fill-plate-half",
  pool: "fill-plate-lit",
  heart: "fill-plate-lit",
};

/** What a plate waits for before it is drawn: the scene's lines, and its two bounds. */
type PlatePart = "lines" | BoundsName;
const PLATE_PARTS: readonly PlatePart[] = ["lines", ...BOUNDS.map(({ name }) => name)];

/** Where a plate stands: its files unasked, coming in, drawn once faded in whole, or failed. */
type PlateState = "unasked" | "loading" | "drawn" | "failed";

/**
 * A city's engraving as a plate (`docs/decisions.md`, "The index's pictures are engravings of a
 * city's everyday thing"), drawn in the theme it stands in with no script: every difference
 * between the themes is a colour. Its lines are drawn over all of it, the page's ink by day and
 * the ground's colour by night. Under them lies the plate's light, bounded by theme: by night the
 * scene's footprint holds the plate's tone, by day the wider sheet holds its light, each cut to a
 * grained edge (`light`). At rest each lamp burns low in a pool of three steps. Under forced
 * colours no light is drawn; the tone and the lines are.
 *
 * It asks for its file only when its cell comes near the screen, at the pixels the cell needs, and
 * is drawn once every part has come in, fading in softly, or at once under reduced motion. Before
 * that the cell holds its box: never a tone without its lines, nor a lamp without its plate. If a
 * file fails, nothing of it is drawn. Its state is on its lines for what waits on a picture. The
 * picture says nothing a reader needs: the city's name beside it is the link's text.
 */
export function IndexPlate({
  picture,
  slug,
  shouldAskFiles = true,
}: {
  picture: IndexPicture;
  /** The city's slug, named on the drawing for what finds a city's plate. */
  slug?: string;
  /** Whether it asks for its files once near the screen; a lab cell holds them back. */
  shouldAskFiles?: boolean;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const isReduced = useReducedMotionConfig() === true;
  const [src, setSrc] = useState<string | null>(null);
  const [arrived, setArrived] = useState<readonly PlatePart[]>([]);
  const [hasFailed, setHasFailed] = useState(false);
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    const element = svg.current;
    if (!shouldAskFiles || element === null) return;
    const ask = () =>
      setSrc(
        pictureSrcOf(
          picture.scene,
          densityFor(element.getBoundingClientRect().width, window.devicePixelRatio),
        ),
      );
    // Where nothing can tell when a cell comes near the screen, its picture is asked for at once.
    if (typeof IntersectionObserver === "undefined") {
      ask();
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        ask();
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [picture, shouldAskFiles]);

  const arrive = (part: PlatePart) =>
    setArrived((parts) => (parts.includes(part) ? parts : [...parts, part]));
  const fail = () => setHasFailed(true);
  const isIn = !hasFailed && src !== null && PLATE_PARTS.every((part) => arrived.includes(part));
  const state: PlateState = hasFailed
    ? "failed"
    : src === null
      ? "unasked"
      : isIn && isDrawn
        ? "drawn"
        : "loading";

  const scene = picture.scene.box;
  const box = lightBoxOf(picture);
  const lamps = lampPointsOf(picture);
  const radii = poolRadiiOf(picture);
  const poolsBox = poolsBoxOf(picture);
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      ref={svg}
      aria-hidden
      focusable="false"
      viewBox={viewBoxOf(picture)}
      data-picture={slug}
      className="block w-full overflow-visible"
    >
      <defs>
        <mask id={`${id}-ink`} maskUnits="userSpaceOnUse" {...rectOf(scene)}>
          {src !== null && (
            <image
              href={src}
              {...rectOf(scene)}
              preserveAspectRatio="none"
              onLoad={() => arrive("lines")}
              onError={fail}
            />
          )}
        </mask>
        <PlateBounds id={id} src={src} scene={scene} box={box} onLoad={arrive} onError={fail} />
        <BoundsGrain id={`${id}-bounds-grain`} box={box} />
        {/*
         * The bounds of the theme the plate stands in: each fill is nothing in the other. Drawn
         * anew once every part is in, since Chromium does not repaint a filtered group when an
         * image in a mask under it arrives.
         */}
        <mask
          key={isIn ? "in" : "waiting"}
          id={`${id}-light`}
          maskUnits="userSpaceOnUse"
          {...rectOf(box)}
          mask-type="alpha"
        >
          <g filter={ref("bounds-grain")}>
            <rect {...rectOf(box)} className="fill-plate-tone" mask={ref("footprint")} />
            <rect {...rectOf(box)} className="fill-plate-lit-wide" mask={ref("sheet")} />
          </g>
        </mask>
        {poolsBox !== null && (
          <>
            <Falloff id={`${id}-falloff`} />
            <LightGrain id={`${id}-pool-grain`} box={poolsBox} slope={POOL_GRAIN_SLOPE} />
            {POOL_STEPS.map((step) => (
              <mask
                key={step}
                id={`${id}-pool-${step}`}
                maskUnits="userSpaceOnUse"
                {...rectOf(poolsBox)}
                mask-type="alpha"
              >
                <g filter={ref("pool-grain")}>
                  {lamps.map((lamp, index) => (
                    <circle
                      key={index}
                      cx={lamp.x}
                      cy={lamp.y}
                      r={radii[step]}
                      fill={ref("falloff")}
                    />
                  ))}
                </g>
              </mask>
            ))}
          </>
        )}
      </defs>
      <motion.g
        initial={false}
        animate={{ opacity: isIn ? 1 : 0 }}
        transition={isReduced ? { duration: 0 } : SPRINGS.gentle}
        onAnimationComplete={() => setIsDrawn(isIn)}
      >
        <g mask={ref("light")}>
          <rect {...rectOf(box)} className="fill-plate-tone" />
          {poolsBox !== null && (
            <g data-pools className="forced-colors:hidden">
              {POOL_STEPS.map((step) => (
                <rect
                  key={step}
                  {...rectOf(poolsBox)}
                  className={POOL_CLASSES[step]}
                  mask={ref(`pool-${step}`)}
                />
              ))}
            </g>
          )}
        </g>
        <rect
          data-layer="scene"
          data-state={state}
          {...rectOf(scene)}
          className="fill-engraving"
          mask={ref("ink")}
        />
      </motion.g>
    </svg>
  );
}

/** A city's plate in the index's cell, by its day's slug, or nothing where its city has none. */
export function IndexPictureView({
  slug,
  shouldAskFiles,
}: {
  slug: string;
  shouldAskFiles?: boolean;
}) {
  const picture = indexPictureOf(slug);
  if (picture === null) return null;
  return <IndexPlate picture={picture} slug={slug} shouldAskFiles={shouldAskFiles} />;
}
