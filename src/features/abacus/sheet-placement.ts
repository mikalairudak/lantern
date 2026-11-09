import { CHART } from "./geometry";
import { DEFAULT_DRAWING, ROW, type Drawing, type RowSizes } from "./rows";

/** Which way an open stop's sheet unrolls from the stop's words. */
export type SheetSide = "below" | "above";

/** A sheet's top and bottom edges, from the top of the chart. */
export interface SheetBand {
  top: number;
  bottom: number;
}

/** Where an open stop's words stand, from the top of the chart. */
export interface SheetAnchor {
  /** The top of the stop's words. */
  wordsTop: number;
  /** From the top of its words to its wire. */
  above: number;
}

/** What a sheet may lie over without making the page taller, measured as it opens. */
export interface SheetRoom {
  /** The chart's own height. */
  frameHeight: number;
  /**
   * How far above the chart a sheet may rise: over the energy scale and into the empty room
   * under the day's header, to a little under its last line; in a lab cell, to the top of
   * what the cell shows.
   */
  roomAbove: number;
  /**
   * How far the page runs on under the chart to its end: the page's foot and the padding
   * under it. None in a lab cell, which ends with the day.
   */
  tail: number;
}

/** The run of a row an open stop's sheet may take: from just right of the time axis to the chart's edge. */
export interface SheetRun {
  from: number;
  to: number;
}

/**
 * How wide an open stop's sheet is: its row's words and a pad either side, never narrower
 * than its least, and never wider than its run.
 */
export function sheetWidthOf(
  run: SheetRun,
  wordsWidth: number,
  { sheetPad, sheetLeastWidth }: Pick<RowSizes, "sheetPad" | "sheetLeastWidth"> = ROW,
): number {
  return Math.min(run.to - run.from, Math.max(wordsWidth + 2 * sheetPad, sheetLeastWidth));
}

/** How far below the chart's top a sheet may end: inside the day, or over the page's tail. */
function reachBelowOf(room: SheetRoom, row: RowSizes): number {
  return room.frameHeight + Math.max(0, room.tail - row.sheetGap);
}

/**
 * The room a sheet keeps for its stop's words, which stay where they stand on the row. Down,
 * a pad around them, so what the place is starts under the words, over the wire. Up, a pad
 * above them and on down past the wire's beads, so the sheet's lower edge never cuts its own
 * beads: it covers them, as a sheet opening down does.
 */
export function nameRoomOf(
  side: SheetSide,
  above: number,
  { chart, row }: Drawing = DEFAULT_DRAWING,
): number {
  return side === "below"
    ? above - row.wireGap + 2 * row.sheetPad
    : row.sheetPad + above + chart.beadReach;
}

/**
 * Where a sheet lies: down from just above its stop's words, or up from just below the
 * stop's beads. `body` is the sheet's height besides the room it keeps for the words.
 */
export function sheetBandOf(
  side: SheetSide,
  anchor: SheetAnchor,
  body: number,
  drawing: Drawing = DEFAULT_DRAWING,
): SheetBand {
  const height = body + nameRoomOf(side, anchor.above, drawing);
  if (side === "below") {
    const top = anchor.wordsTop - drawing.row.sheetPad;
    return { top, bottom: top + height };
  }
  const bottom = anchor.wordsTop + anchor.above + drawing.chart.beadReach;
  return { top: bottom - height, bottom };
}

/**
 * Which way a sheet opens, so that opening a stop never makes the page taller: down from its
 * words when it ends inside the day or over the page's tail, a sheet's gap above the page's
 * end; else up from them when it starts below the header's last line, over the stops before
 * it and the energy scale. Only a sheet with room on neither side, as in a lab cell of a few
 * stops, hangs down past where the page ends, and the day makes room for it.
 */
export function sheetSideOf(
  anchor: SheetAnchor,
  body: number,
  room: SheetRoom,
  drawing: Drawing = DEFAULT_DRAWING,
): SheetSide {
  if (sheetBandOf("below", anchor, body, drawing).bottom <= reachBelowOf(room, drawing.row)) {
    return "below";
  }
  if (sheetBandOf("above", anchor, body, drawing).top >= -room.roomAbove) return "above";
  return "below";
}

/**
 * How tall the day stands while a sheet that hangs past where the page can show it is open,
 * so it ends a sheet's gap above the page's new end, over the page's tail as far as that
 * goes; undefined while the sheet lies where the page already is. The page grows by no
 * more than the sheet needs.
 */
export function hungDayHeightOf(
  band: SheetBand,
  room: SheetRoom,
  row: RowSizes = ROW,
): number | undefined {
  return band.bottom > reachBelowOf(room, row) ? band.bottom + row.sheetGap - room.tail : undefined;
}

/**
 * Whether a sheet lies over any of a stop's beads, whole or across one of its edges, the
 * beads reaching `reach` either side of their wire.
 */
export function isUnderSheet(
  wireY: number,
  sheet: SheetBand,
  reach: number = CHART.beadReach,
): boolean {
  return wireY + reach > sheet.top && wireY - reach < sheet.bottom;
}

/** A band across the chart, from the top of the chart. */
export interface CoveredBeads {
  from: number;
  height: number;
}

/**
 * The part of a stop's beads a sheet lies over that is drawn again on the sheet: where one
 * of the sheet's edges crosses them, the part on the sheet's side of that edge, so the
 * beads stand whole across it. Null where the sheet misses the beads, or covers them whole,
 * as it covers its own stop's and those of the rows it lies over.
 */
export function coveredBeadsOf(
  wireY: number,
  sheet: SheetBand,
  reach: number = CHART.beadReach,
): CoveredBeads | null {
  const reachTop = wireY - reach;
  const reachBottom = wireY + reach;
  const from = Math.max(reachTop, sheet.top);
  const to = Math.min(reachBottom, sheet.bottom);
  const isMissed = to <= from;
  const isWhole = sheet.top <= reachTop && sheet.bottom >= reachBottom;
  return isMissed || isWhole ? null : { from, height: to - from };
}
