"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotionConfig,
  useTransform,
} from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { SPRINGS } from "@/lib/tokens/motion";
import {
  densityFor,
  indexPictureOf,
  picturePathOf,
  pictureSrcOf,
  viewBoxOf,
  type IndexPicture,
} from "./index-pictures";
import {
  BOUNDS_NAMES,
  BoundsGrain,
  Falloff,
  FRONT_GRAIN_SLOPE,
  LightGrain,
  PlateBounds,
  POOL_GRAIN_SLOPE,
  SolidFalloff,
  type BoundsName,
} from "./plate-filters";
import {
  lampPointsOf,
  lightBoxOf,
  lightCirclesOf,
  lightTurnOf,
  POOL_STEPS,
  poolRadiiOf,
  poolsBoxOf,
  rectOf,
  stillRadiusOf,
  type FieldPoint,
  type LightReaches,
  type PlateStill,
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
const PLATE_PARTS: readonly PlatePart[] = ["lines", ...BOUNDS_NAMES];

/**
 * Which files a plate asks for once near the screen: all three, its scene alone, as a lab cell
 * shows a plate whose bounds have not come, or none, as before the page's script runs.
 */
export type PlateFiles = "all" | "scene" | "none";

/** The files a plate is drawn from, once asked for. */
interface AskedFiles {
  scene: string;
  bounds: Readonly<Record<BoundsName, string>> | null;
}

/**
 * Where a plate stands: its files unasked, held back by a lab cell, coming in, drawn once faded in
 * whole, or failed.
 */
type PlateState = "unasked" | "held" | "loading" | "drawn" | "failed";

/**
 * One circle of a plate's lit fill. Lit, it grows from where it stands to its lit reach on the
 * gentle spring. Left, it is set to its covering reach before the frame is painted, if it stands
 * wider, so the light starts to go with the pointer, then goes to nothing on the brisk spring
 * (`lightTurnOf`). The set is a jump and carries no speed, and each turn starts at rest. Under
 * reduced motion each state stands at once, and a lab cell holds it part-way (`still`). No radius
 * is drawn under nothing.
 */
function LitCircle({
  point,
  reaches,
  isLit,
  still,
  isReduced,
  fill,
}: {
  point: FieldPoint;
  reaches: LightReaches;
  isLit: boolean;
  still: PlateStill | undefined;
  isReduced: boolean;
  fill: string;
}) {
  const { lit, covering } = reaches;
  const stillReach = still?.reach;
  const stillShare = still?.share;
  const radius = useMotionValue(
    still !== undefined ? stillRadiusOf(still, reaches) : isLit ? lit : 0,
  );
  const drawn = useTransform(radius, (value) => Math.max(0, value));
  useLayoutEffect(() => {
    const ends = { lit, covering };
    if (stillReach !== undefined && stillShare !== undefined) {
      radius.jump(stillRadiusOf({ reach: stillReach, share: stillShare }, ends));
      return undefined;
    }
    const turn = lightTurnOf(isLit, radius.get(), ends);
    if (isReduced) {
      radius.jump(turn.to);
      return undefined;
    }
    if (turn.from !== radius.get()) radius.jump(turn.from);
    const animation = animate(radius, turn.to, SPRINGS[turn.spring]);
    return () => animation.stop();
  }, [radius, isLit, lit, covering, stillReach, stillShare, isReduced]);
  return <motion.circle cx={point.x} cy={point.y} r={drawn} fill={fill} />;
}

/**
 * A city's engraving as a plate (`docs/decisions.md`, "The index's pictures are engravings of a
 * city's everyday thing"), drawn in the theme it stands in with no script: every difference
 * between the themes is a colour. Its lines are drawn over all of it, the page's ink by day and
 * the ground's colour by night. Under them lies the plate's light, bounded by theme: by night the
 * scene's footprint holds the plate's tone, by day the wider sheet holds its light, each cut to a
 * grained edge (`light`). At rest each lamp burns low in a pool of three steps. Lit, as when its
 * cell is pointed at, focused or touched, the light grows from its lamps until the plate is lit
 * whole, and left, it withdraws to them in half the time (`LitCircle`); a plate with no lamps is
 * lit from its middle. The pools stay where they are under the lit fill. Under forced colours no
 * light is drawn; the tone and the lines are.
 *
 * It asks for its three files only when its cell comes near the screen, the scene at the pixels
 * the cell needs and its two bounds at their one density, in either theme, so a theme changed on
 * the page fetches nothing. It is drawn once every part has come in, fading in softly, or at once
 * under reduced motion. Before that the cell holds its box: never a tone without its lines, nor a
 * lamp without its plate. If a file fails, nothing of it is drawn. Its state is on its lines for
 * what waits on a picture. The picture says nothing a reader needs: the city's name beside it is
 * the link's text.
 */
export function IndexPlate({
  picture,
  isLit = false,
  still,
  slug,
  files = "all",
}: {
  picture: IndexPicture;
  /** Whether the plate is lit whole, as its cell is pointed at, focused or touched. */
  isLit?: boolean;
  /** The light held part-way, as a lab cell shows it. */
  still?: PlateStill;
  /** The city's slug, named on the drawing for what finds a city's plate. */
  slug?: string;
  /** Which files it asks for once near the screen; a lab cell holds some back. */
  files?: PlateFiles;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const isReduced = useReducedMotionConfig() === true;
  const [asked, setAsked] = useState<AskedFiles | null>(null);
  const [arrived, setArrived] = useState<readonly PlatePart[]>([]);
  const [hasFailed, setHasFailed] = useState(false);
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    const element = svg.current;
    if (files === "none" || element === null) return;
    // The scene at the pixels the cell needs; the bounds have one density.
    const ask = () =>
      setAsked({
        scene: pictureSrcOf(
          picture.scene,
          densityFor(element.getBoundingClientRect().width, window.devicePixelRatio),
        ),
        bounds:
          files === "all"
            ? {
                footprint: picturePathOf(picture.footprint),
                sheet: picturePathOf(picture.sheet),
              }
            : null,
      });
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
  }, [picture, files]);

  const arrive = (part: PlatePart) =>
    setArrived((parts) => (parts.includes(part) ? parts : [...parts, part]));
  const fail = () => setHasFailed(true);
  const isIn = !hasFailed && asked !== null && PLATE_PARTS.every((part) => arrived.includes(part));
  const state: PlateState = hasFailed
    ? "failed"
    : files === "none"
      ? "held"
      : asked === null
        ? "unasked"
        : isIn && isDrawn
          ? "drawn"
          : "loading";

  const scene = picture.scene.box;
  const box = lightBoxOf(picture);
  const lamps = lampPointsOf(picture);
  const radii = poolRadiiOf(picture);
  const poolsBox = poolsBoxOf(picture);
  const circles = lightCirclesOf(picture);
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      ref={svg}
      aria-hidden
      focusable="false"
      viewBox={viewBoxOf(picture)}
      data-picture={slug}
      data-light={isLit ? "lit" : "rest"}
      className="block w-full overflow-visible"
    >
      <defs>
        <mask id={`${id}-ink`} maskUnits="userSpaceOnUse" {...rectOf(scene)}>
          {asked !== null && (
            <image
              href={asked.scene}
              {...rectOf(scene)}
              preserveAspectRatio="none"
              onLoad={() => arrive("lines")}
              onError={fail}
            />
          )}
        </mask>
        <PlateBounds
          id={id}
          srcs={asked?.bounds ?? null}
          box={box}
          onLoad={arrive}
          onError={fail}
        />
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
        <SolidFalloff id={`${id}-solid`} />
        <LightGrain id={`${id}-front-grain`} box={box} slope={FRONT_GRAIN_SLOPE} />
        <mask id={`${id}-whole`} maskUnits="userSpaceOnUse" {...rectOf(box)} mask-type="alpha">
          <g filter={ref("front-grain")}>
            {circles.map(({ reaches, ...point }, index) => (
              <LitCircle
                key={index}
                point={point}
                reaches={reaches}
                isLit={isLit}
                still={still}
                isReduced={isReduced}
                fill={ref("solid")}
              />
            ))}
          </g>
        </mask>
      </defs>
      <motion.g
        initial={false}
        animate={{ opacity: isIn ? 1 : 0 }}
        transition={isReduced ? { duration: 0 } : SPRINGS.gentle}
        onAnimationComplete={() => setIsDrawn(isIn)}
      >
        <g mask={ref("light")}>
          <rect {...rectOf(box)} className="fill-plate-tone" />
          <g className="forced-colors:hidden">
            {poolsBox !== null && (
              <g data-pools>
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
            <rect data-lit-fill {...rectOf(box)} className="fill-plate-lit" mask={ref("whole")} />
          </g>
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
  isLit,
  files,
}: {
  slug: string;
  isLit?: boolean;
  files?: PlateFiles;
}) {
  const picture = indexPictureOf(slug);
  if (picture === null) return null;
  return <IndexPlate picture={picture} slug={slug} isLit={isLit} files={files} />;
}
