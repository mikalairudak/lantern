"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { subscribeThemeChoice } from "@/features/theme/theme";
import { SPRINGS } from "@/lib/tokens/motion";
import {
  densityFor,
  indexPictureOf,
  pictureSrcOf,
  viewBoxOf,
  type IndexPicture,
  type PictureLayer,
} from "./index-pictures";

/** How far under the screen a cell starts loading its picture, so it has arrived when scrolled to. */
const NEAR_MARGIN = "50% 0px";

type LayerName = keyof IndexPicture;

/**
 * Each layer's colour: the scene in the light theme's ink and nothing in the dark, the subject the
 * other way round (`--color-engraving`, `--color-engraving-night`).
 */
const LAYER_CLASSES: Readonly<Record<LayerName, string>> = {
  scene: "fill-engraving",
  subject: "fill-engraving-night",
};

const LAYERS: readonly LayerName[] = ["scene", "subject"];

/** Whether an element's fill shows in the theme it is drawn in: a transparent one does not. */
function isFilled(element: Element): boolean {
  const fill = getComputedStyle(element).fill;
  return fill !== "transparent" && !/rgba\(.*,\s*0\)$/.test(fill);
}

/**
 * One layer: a mask of the picture's own tones, white where the ink is, filling a box in its
 * theme's colour. It shows once its file has arrived, softly, and never before. Its state, unasked,
 * loading or drawn once it has come in whole, is on the element for what waits on a picture.
 */
function Layer({
  name,
  layer,
  src,
  layerRef,
}: {
  name: LayerName;
  layer: PictureLayer;
  src: string | null;
  layerRef: (element: SVGRectElement | null) => void;
}) {
  const id = useId();
  const [loaded, setLoaded] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [left, top, width, height] = layer.box;
  const isLoaded = src !== null && loaded === src;
  const state = src === null ? "unasked" : isLoaded && drawn === src ? "drawn" : "loading";
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x={left} y={top} width={width} height={height}>
        {src !== null && (
          <image
            href={src}
            x={left}
            y={top}
            width={width}
            height={height}
            preserveAspectRatio="none"
            onLoad={() => setLoaded(src)}
          />
        )}
      </mask>
      <motion.rect
        ref={layerRef}
        data-layer={name}
        data-state={state}
        x={left}
        y={top}
        width={width}
        height={height}
        mask={`url(#${id})`}
        className={LAYER_CLASSES[name]}
        initial={false}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={SPRINGS.gentle}
        onAnimationComplete={() => {
          if (isLoaded) setDrawn(src);
        }}
      />
    </>
  );
}

/**
 * A city's engraving in the index's cell, or nothing where its city has none. It asks for its
 * files only when the cell comes near the screen, only for the layer its theme draws, and at the
 * pixels the cell needs, so a phone's first screen fetches what it shows. A theme changed later
 * fetches the other layer then. The picture says nothing a reader needs: the city's name beside it
 * is the link's text.
 */
export function IndexPictureView({ slug }: { slug: string }) {
  const picture = indexPictureOf(slug);
  const svg = useRef<SVGSVGElement>(null);
  const layers = useRef<Partial<Record<LayerName, SVGRectElement>>>({});
  const [srcs, setSrcs] = useState<Readonly<Record<LayerName, string | null>>>({
    scene: null,
    subject: null,
  });

  useEffect(() => {
    const element = svg.current;
    if (picture === null || element === null) return;
    let isNear = false;
    const ask = () => {
      if (!isNear) return;
      const density = densityFor(element.getBoundingClientRect().width, window.devicePixelRatio);
      setSrcs((asked) => {
        const next = { ...asked };
        for (const name of LAYERS) {
          const rect = layers.current[name];
          if (next[name] === null && rect !== undefined && isFilled(rect)) {
            next[name] = pictureSrcOf(picture[name], density);
          }
        }
        return next.scene === asked.scene && next.subject === asked.subject ? asked : next;
      });
    };
    // The theme is read from the drawn colours, so a page or a frame of one theme reads its own.
    const later = () => requestAnimationFrame(ask);
    const unsubscribe = subscribeThemeChoice(later);
    const scheme =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    scheme?.addEventListener("change", later);
    // Where nothing can tell when a cell comes near the screen, its picture is asked for at once.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (!entries.some((entry) => entry.isIntersecting)) return;
              isNear = true;
              observer?.disconnect();
              ask();
            },
            { rootMargin: NEAR_MARGIN },
          );
    if (observer === null) {
      isNear = true;
      ask();
    } else {
      observer.observe(element);
    }
    return () => {
      observer?.disconnect();
      scheme?.removeEventListener("change", later);
      unsubscribe();
    };
  }, [picture]);

  if (picture === null) return null;
  return (
    <svg
      ref={svg}
      aria-hidden
      focusable="false"
      viewBox={viewBoxOf(picture)}
      data-picture={slug}
      className="block w-full"
    >
      {LAYERS.map((name) => (
        <Layer
          key={name}
          name={name}
          layer={picture[name]}
          src={srcs[name]}
          layerRef={(rect) => {
            if (rect === null) delete layers.current[name];
            else layers.current[name] = rect;
          }}
        />
      ))}
    </svg>
  );
}
