"use client";

import { useMemo } from "react";
import { useRootGrowth } from "@/components/ui/use-root-font-px";
import { CHART, type ChartSizes } from "./geometry";
import { DEFAULT_DRAWING, ROW, type Drawing, type RowSizes } from "./rows";

/** Every value of a drawing's pixels, multiplied by `factor`. */
function scaledBy<Sizes extends Readonly<Record<string, number>>>(
  sizes: Sizes,
  factor: number,
): { readonly [Key in keyof Sizes]: number } {
  return Object.fromEntries(Object.entries(sizes).map(([key, value]) => [key, value * factor])) as {
    readonly [Key in keyof Sizes]: number;
  };
}

/**
 * The chart and its rows drawn at `factor` times their pixels at the default root, the one
 * place a root that grows reaches them: every place, size and gap of `CHART` and `ROW`, the
 * sheet's least width among them. The hairlines are not in either and stay a pixel. At a
 * factor of 1 it is the drawing as written, the same objects.
 */
export function drawingAt(factor: number): Drawing {
  if (factor === 1) return DEFAULT_DRAWING;
  const chart: ChartSizes = scaledBy(CHART, factor);
  const row: RowSizes = scaledBy(ROW, factor);
  return { chart, row };
}

/**
 * The drawing for how far the root has grown on a large screen: its size over the browser's own,
 * read as the page renders, before the browser paints, so a chart's first frame is drawn at it, and
 * again when the window is resized. Exactly 1 up to the viewport the growth starts at, whatever
 * text size the visitor has set: a phone in large text keeps the drawing as written, where its
 * little width is the words'. On the server, which has no root to read, the drawing as written.
 */
export function useDrawing(): Drawing {
  const factor = useRootGrowth();
  return useMemo(() => drawingAt(factor), [factor]);
}
