import { GLIDE_REST_PX } from "@/lib/tokens/motion";
import { CHART, chartScale, type ChartScale, type ChartSizes } from "./geometry";

/**
 * The day as rows of one object: each stop's wire carries its name, so the chart's time
 * scale has to make room for words. Time stays to scale where the rows fit, and a row is
 * never closer to the one before than their words need: the scale is elastic.
 */

/** How much room a stop's words take around its wire, in pixels. */
export interface RowExtent {
  /** The minute its wire sits at: the middle of its time. */
  mid: number;
  /** From the top of its words to the wire. */
  above: number;
}

/**
 * How far a name's letters reach above its line box: set tight, its inline box is taller than
 * its line, and a pointer meets it there, 1.25 px over the line at the root's 16 px.
 */
const NAME_REACH_ABOVE = 2;

/**
 * Spacing around the rows' words, in CSS pixels at the root's default 16 px. These place
 * things inside one drawing, with the chart's other coordinates, rather than being theme
 * values, and a root that grows scales them with the chart's (`drawingAt`).
 */
export const ROW = {
  /**
   * From one row's wire to the next row's words: a bead's pointer target under the wire, and
   * the 2 px a name's letters reach above its line, where a pointer meets the name as well.
   */
  gap: CHART.beadHitRadius + NAME_REACH_ABOVE,
  /**
   * A closed row's words end this far above its wire, clear of a bead's pointer target, so
   * every bead keeps its whole 24 px (WCAG 2.5.8): 6 px, the words took the top 6 px of the
   * beads under them on a phone, and a bead's target stood 16.75 px tall.
   */
  wireGap: CHART.beadHitRadius,
  /** From a bead's centre to the words beside it. */
  beadClear: 14,
  /**
   * The least an open stop's sheet is wide where its row's run has the room, as it has from
   * a laptop's width: 28 rem at the root's 16 px, as wide as the chart's column beside a list
   * (`--container-chart`), so a sheet's lines run about 66 characters rather than 44 and it
   * stands shorter. A phone's run is narrower, about 298 px, and the sheet takes all of it.
   * A pixel among the chart's others, so a root that grows scales them by one factor: 560 px
   * at 2560 px, still 28 rem.
   */
  sheetLeastWidth: 448,
  /** Around the words of a stop that opens into a sheet. */
  sheetPad: 12,
  /** An open sheet keeps this far right of the time axis, clear of its suns. */
  sheetFromAxis: 8,
  /** Under a sheet that ends past the day, before the page ends. */
  sheetGap: 24,
  /** Between the header's last line and a sheet that rises past the chart's top to it. */
  sheetUnderHeader: 8,
  /** One line of a stop's name, for a row whose words have not been measured yet. */
  lineEstimate: 22,
  /**
   * A sun's minute is said beside it only where its middle keeps this far from the middle of
   * every stop's time, on the side its minute puts it (`isSunMinuteInOrder`), so the gutter
   * never reads as two times run together. On a phone Kyoto's and Lisbon's sunsets come
   * closer and show the sun alone; the header says its minute.
   */
  sunLabelClearance: 18,
  /**
   * A wire counts as seen this far inside the view: its words above it and the ring on it are
   * then in view too.
   */
  seenRoom: 48,
  /**
   * The curve steps back a little past each end of a line of words, and over the few pixels
   * between one line and the next, so it does not flicker back to full between them.
   */
  lineMaskPad: 3,
  lineMaskPadY: 2,
  lineMaskRadius: 4,
} as const;

/** A time in the gutter: its minute, running past midnight, and the middle of its line. */
export interface GutterTime {
  minutes: number;
  y: number;
}

/**
 * Whether a sun's minute may be said beside it, in the gutter of the stops' times: under every
 * stop that starts by its minute and over every stop that starts after, clear of each by
 * `clearance`, so the gutter reads down the day. A stop's time stands on its name, above its
 * wire, and the time scale meets a stop at its wire, in the middle of its time: on Nafplio's
 * phone the sunset at 17:25 fell between the walk's wire and the dinner's, under the dinner's
 * "18:00", 35 px from it, and a check of the distance alone said it there.
 */
export function isSunMinuteInOrder(
  sun: GutterTime,
  times: readonly GutterTime[],
  clearance: number,
): boolean {
  return times.every((time) =>
    time.minutes <= sun.minutes ? sun.y - time.y >= clearance : time.y - sun.y >= clearance,
  );
}

/** The rows' pixels as one drawing sets them: `ROW` at the default root, or scaled. */
export type RowSizes = { readonly [Key in keyof typeof ROW]: number };

/** The pixels a day's chart and its rows are drawn at, scaled together by one factor. */
export interface Drawing {
  chart: ChartSizes;
  row: RowSizes;
}

/** The drawing at the root's default 16 px: `CHART` and `ROW` as written. */
export const DEFAULT_DRAWING: Drawing = { chart: CHART, row: ROW };

/** An elastic chart: the scale, and where each stop's wire sits on it. */
export interface RowScale {
  scale: ChartScale;
  anchors: number[];
}

interface Point {
  minutes: number;
  y: number;
}

/**
 * Wires placed no closer than their rows' words need: each at least `gap` and its words' room
 * below the wire above, top to bottom. While a re-plan is on screen, the rows that stay hold
 * where they stood or lower, so a new row under one held lower has its room only when placed
 * from it: on a phone Elche's new 16:30, placed by the day as written under the Basílica held
 * where it stood, stood 109 px under its wire where its words need 128, and its room never
 * opened until the merged day took the page, 24.75 s on.
 */
export function keptApart(
  anchors: readonly number[],
  rows: readonly RowExtent[],
  gap: number = ROW.gap,
): number[] {
  return anchors.reduce<number[]>((kept, anchor, index) => {
    const above = kept[index - 1];
    const least = above === undefined ? anchor : above + gap + (rows[index]?.above ?? 0);
    return [...kept, Math.max(anchor, least)];
  }, []);
}

/**
 * Where each stop's wire sits, top to bottom. A row depends only on the rows above it, so a
 * stop that arrives, or grows, never moves an earlier one.
 */
export function anchorsOf(
  rows: readonly RowExtent[],
  origin: Point,
  perMinute: number,
  gap: number = ROW.gap,
): number[] {
  return rows.reduce<number[]>((anchors, row, index) => {
    const previous = rows[index - 1];
    const before = anchors[index - 1];
    if (previous === undefined || before === undefined) {
      const onScale = origin.y + perMinute * (row.mid - origin.minutes);
      return [Math.max(origin.y + row.above, onScale)];
    }
    const needed = gap + row.above;
    const onScale = perMinute * (row.mid - previous.mid);
    return [...anchors, before + Math.max(needed, onScale)];
  }, []);
}

/** Linear between the points, and on the base scale beyond them. */
function piecewise(points: readonly Point[], perMinute: number) {
  const yOf = (minutes: number): number => {
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return 0;
    if (minutes <= first.minutes) return first.y + (minutes - first.minutes) * perMinute;
    if (minutes >= last.minutes) return last.y + (minutes - last.minutes) * perMinute;
    const next = points.findIndex((point) => point.minutes >= minutes);
    const from = points[next - 1] ?? first;
    const to = points[next] ?? last;
    const span = to.minutes - from.minutes;
    return span > 0 ? from.y + ((minutes - from.minutes) / span) * (to.y - from.y) : to.y;
  };
  const minutesAt = (y: number): number => {
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return 0;
    if (y <= first.y) return first.minutes + (y - first.y) / perMinute;
    if (y >= last.y) return last.minutes + (y - last.y) / perMinute;
    const next = points.findIndex((point) => point.y >= y);
    const from = points[next - 1] ?? first;
    const to = points[next] ?? last;
    const span = to.y - from.y;
    return span > 0
      ? from.minutes + ((y - from.y) / span) * (to.minutes - from.minutes)
      : to.minutes;
  };
  return { yOf, minutesAt };
}

/**
 * The chart for rows of words. Energy runs across as in `chartScale`; time runs down at the
 * scale that `basisHeight` gives the day, stretched wherever a row needs more room. The
 * chart is as tall as its rows need, which may be taller than the basis. `anchorsNow`, when
 * given, draws the wires where they are this frame on their way to where the rows need
 * them, so the whole chart follows them. `seen` says, from 0 to 1, how far each row bends
 * the time scale, 1 where it is left out.
 */
export function rowScale(
  width: number,
  basisHeight: number,
  dayStart: number,
  dayEnd: number,
  rows: readonly RowExtent[],
  anchorsNow?: readonly number[],
  { chart, row: sizes }: Drawing = DEFAULT_DRAWING,
  seen: readonly number[] = [],
): RowScale {
  const base = chartScale(width, basisHeight, dayStart, dayEnd, chart);
  const { plotTop } = base;
  const perMinute = (base.plotBottom - plotTop) / (dayEnd - dayStart);
  const sorted = rows.every((row, index) => index === 0 || row.mid >= (rows[index - 1]?.mid ?? 0));
  const anchors =
    anchorsNow?.length === rows.length
      ? [...anchorsNow]
      : anchorsOf(sorted ? rows : [], { minutes: dayStart, y: plotTop }, perMinute, sizes.gap);
  const lastRow = rows.at(-1);
  const lastAnchor = anchors.at(-1);
  const plotBottom =
    lastRow && lastAnchor !== undefined
      ? lastAnchor + Math.max(sizes.gap, perMinute * (dayEnd - lastRow.mid))
      : plotTop + perMinute * (dayEnd - dayStart);
  // A row past the frame's end, as a re-plan's new last stop is while the frame draws out to
  // it, still bends the scale where its wire is, and the scale's end waits a minute past it,
  // so the frame's end passing the row's minute changes nothing in a frame.
  const isInDay = (index: number): boolean => {
    const mid = rows[index]?.mid;
    return mid !== undefined && mid > dayStart && anchors[index] !== undefined;
  };
  const lastMid = rows.reduce(
    (latest, row, index) => (isInDay(index) ? Math.max(latest, row.mid) : latest),
    -Infinity,
  );
  const scaleEnd = lastMid >= dayEnd ? lastMid + 1 : dayEnd;
  const seenOf = (index: number): number => Math.min(1, Math.max(0, seen[index] ?? 1));
  // A row entering unseen, squeezed while its room opens, does not bend the time scale, and
  // one seen bends it as far as it is seen: its wire's minute moves from where the scale put
  // it without the row to where the row's wire is, so the scale never bends in a frame.
  const wholly = piecewise(
    [
      { minutes: dayStart, y: plotTop },
      ...rows.flatMap((row, index) =>
        isInDay(index) && seenOf(index) >= 1 ? [{ minutes: row.mid, y: anchors[index] ?? 0 }] : [],
      ),
      { minutes: scaleEnd, y: plotBottom },
    ],
    perMinute,
  );
  const points: Point[] = [
    { minutes: dayStart, y: plotTop },
    ...rows.flatMap((row, index) => {
      const amount = seenOf(index);
      if (!isInDay(index) || amount <= 0) return [];
      const y = anchors[index] ?? 0;
      const without = wholly.yOf(row.mid);
      return [{ minutes: row.mid, y: without + (y - without) * amount }];
    }),
    { minutes: scaleEnd, y: plotBottom },
  ];
  const { yOf, minutesAt } = piecewise(points, perMinute);
  return {
    scale: {
      ...base,
      height: plotBottom + chart.bottom,
      plotTop,
      plotBottom,
      yOf,
      minutesAt,
    },
    anchors: rows.map((row, index) => anchors[index] ?? yOf(row.mid)),
  };
}

/**
 * How far below the wire above an entering row's wire stands while no room has opened for it:
 * a hair, so the wires stay in time order and the time scale keeps rising between them.
 */
const ENTERING_STEP_PX = 0.5;

/**
 * `rowScale` for the rows at rest while some of them leave the day, as a version a fork folds
 * away does (`leaving`): the rows that stay are laid out as if those were gone, so the rows
 * below rise into their room as they fade rather than once they are gone, and each leaving row's
 * wire rests a hair under the wire above it, its words riding up with it out of the way.
 */
export function rowScaleLeaving(
  width: number,
  basisHeight: number,
  dayStart: number,
  dayEnd: number,
  rows: readonly RowExtent[],
  leaving: readonly boolean[],
  drawing: Drawing = DEFAULT_DRAWING,
): RowScale {
  const staying = rows.filter((_, index) => !leaving[index]);
  const laidOut = rowScale(width, basisHeight, dayStart, dayEnd, staying, undefined, drawing);
  if (staying.length === rows.length) return laidOut;
  const anchors: number[] = [];
  rows.forEach((_, index) => {
    const above = anchors[index - 1] ?? laidOut.scale.plotTop;
    const stayingAt = index - anchors.filter((__, at) => leaving[at]).length;
    anchors.push(leaving[index] ? above + ENTERING_STEP_PX : (laidOut.anchors[stayingAt] ?? above));
  });
  return { scale: laidOut.scale, anchors };
}

/**
 * Where the rows rest while some leave the day (`rowScaleLeaving`), their words included: a run
 * of leaving rows with a row that stays under it rides on that row, each a gap over the words
 * of the one under it, so it rises as far and as fast as the rows it fades over, never into
 * them; a run at the day's end keeps to the wire above it. `wordsAbove` is each row's words'
 * room over its wire.
 */
export function leavingRowsAt(
  rows: RowsAt,
  leaving: readonly boolean[],
  wordsAbove: readonly number[],
  gap: number = ROW.gap,
): { anchors: number[]; tops: number[] } {
  const anchors = [...rows.anchors];
  const tops = [...rows.tops];
  let under: number | undefined;
  for (let index = anchors.length - 1; index >= 0; index -= 1) {
    if (!leaving[index]) {
      under = tops[index];
      continue;
    }
    if (under === undefined) continue;
    anchors[index] = under - gap;
    tops[index] = under - gap - (wordsAbove[index] ?? 0);
    under = tops[index];
  }
  return { anchors, tops };
}

/**
 * Within how far of where it rests an entering row has its room and joins the springs: as near
 * as a glide comes before it rests (`GLIDE_REST_PX`). Within half a pixel, the row joined at
 * its place and the rows under it stepped by what was left.
 */
const ENTERED_WITHIN_PX = GLIDE_REST_PX;

/**
 * Whether an entering row's room has opened to where it rests, its words and wire there, or to
 * `withinPx` of it.
 */
export function hasEntered(
  drawn: RowsAt,
  target: RowsAt,
  index: number,
  withinPx: number = ENTERED_WITHIN_PX,
): boolean {
  const near = (a: number | undefined, b: number | undefined) =>
    a !== undefined && b !== undefined && Math.abs(a - b) <= withinPx;
  return (
    near(drawn.anchors[index], target.anchors[index]) && near(drawn.tops[index], target.tops[index])
  );
}

/** Where each row's wire and the top of its words stand, top to bottom. */
export interface RowsAt {
  anchors: readonly number[];
  tops: readonly number[];
}

/**
 * Where the rows are drawn this frame, from where their springs have their wires and words:
 * as they are, except that a row's words never come closer to the wire above than `gap`, or
 * above the plot's top for the first row, where the rows as they will rest keep them clear. So
 * a row on a gentler spring than the row above it, as a row being written is, is carried down
 * whole by that row's wire when the wire comes down faster than it moves. Rows the springs
 * carry closer on their way somewhere, as a stop gliding past another to its new time, are
 * drawn as they are.
 *
 * A row `entering` the day between two others, as a re-plan's new stop does, or several
 * together, grows into the room that opens for it rather than pushing: its words start no higher than the wire above
 * allows and its wire comes no lower than the row below allows, so the rows below stand
 * still and the room it is drawn with is only what has opened.
 */
export function rowsKeptClear(
  now: RowsAt,
  target: RowsAt,
  plotTop: number,
  gap: number = ROW.gap,
  entering: readonly boolean[] = [],
): { anchors: number[]; tops: number[] } {
  const ceilingOf = (wire: number | undefined) => (wire === undefined ? plotTop : wire + gap);
  return now.tops.reduce<{ anchors: number[]; tops: number[] }>(
    (drawn, top, index) => {
      if (entering[index]) {
        const above = drawn.anchors[index - 1];
        // The next row that is not entering bounds it: rows entering together, as a version
        // compared beside the day brings back, share the room that opens over that row.
        const next = entering.findIndex((isEntering, at) => at > index && !isEntering);
        const floor = (now.tops[next === -1 ? now.tops.length : next] ?? Infinity) - gap;
        // The first row, as an old stop coming back to the day's start, may stand squeezed
        // above the chart's top, unseen, rather than push the row below it down in a frame.
        const lowest = above === undefined ? -Infinity : above + ENTERING_STEP_PX;
        const anchor = Math.max(lowest, Math.min(target.anchors[index] ?? top, floor));
        const ownTop = Math.max(ceilingOf(above), target.tops[index] ?? top);
        return {
          anchors: [...drawn.anchors, anchor],
          tops: [...drawn.tops, Math.min(ownTop, anchor)],
        };
      }
      const crossing = ceilingOf(drawn.anchors[index - 1]) - top;
      const restingCrossing = ceilingOf(target.anchors[index - 1]) - (target.tops[index] ?? top);
      const push = Math.max(0, crossing - Math.max(0, restingCrossing));
      return {
        anchors: [...drawn.anchors, (now.anchors[index] ?? top) + push],
        tops: [...drawn.tops, top + push],
      };
    },
    { anchors: [], tops: [] },
  );
}

/**
 * Where a row's words end on the right: inside the chart's edge by as much as they start
 * inside an open sheet on the left, the bead's clearance less the sheet's from the time
 * axis. A sheet runs to the chart's edge, so its ring, inset there, keeps clear of the words
 * of a row that reaches it, as it does at the axis.
 */
export function wordsRightOf(width: number, row: RowSizes = ROW): number {
  return width - (row.beadClear - row.sheetFromAxis);
}

/**
 * A row's room is open once it stands this close to the room its words need as this frame
 * measures them: a pixel, rather than waiting for its spring's last half pixel.
 */
const ROOM_OPEN_WITHIN = 1;

/**
 * How much wider than its column a row's shown words may set a line, so they break where the
 * unseen copy that measures them breaks: an eighth of a pixel. A name the pen is writing is
 * set in pieces, its written letters and the room of the rest, and each piece is rounded to a
 * sixty-fourth of a pixel on its own, so it can come out a sixty-fourth wider than the same
 * name whole. Madrid's "Raciones on Calle del Pez" with "dinner" and its crosshair's room
 * filled its 262 px column on a phone exactly, and while its name was written "dinner" broke
 * onto a line of its own: the row stood a line taller than its room, its bead was unweighed,
 * and the page looped until React gave it up.
 */
export const SHOWN_WORDS_SLACK = 1 / 8;

/**
 * Whether a row's room, drawn at `now`, has opened to the room its words need. A row still
 * waiting by its hollow bead waits until its room stands where its words need it, within a
 * pixel, so its words always move into room already open. Once its bead has filled
 * (`isFilled`), its words have taken the layout they rest at, and words that rest shorter
 * than they were shown let the room settle to them: a room still settling down is open. Read
 * as the waiting row's, a lively row that waits in two lines by its hollow bead and rests in
 * one on its other side flipped between the two in one commit, ready and not, until React
 * gave up, before its bead's slide could start.
 */
export function isRoomOpen(now: number | undefined, needed: number, isFilled = false): boolean {
  if (now === undefined) return false;
  return isFilled ? now >= needed - ROOM_OPEN_WITHIN : Math.abs(now - needed) <= ROOM_OPEN_WITHIN;
}

export type LabelSide = "right" | "left";

export interface LabelPlacement {
  side: LabelSide;
  /** The room on that side, which the words may wrap within. */
  maxWidth: number;
}

/**
 * Which side of its bead a stop's words sit on. They read rightward from the bead; they go
 * left only when they fit there and not here, or when the room on the left is wider by more
 * than a bead's clearance, so words that must wrap either way stay right of a bead in the
 * middle of the scale, where a few pixels either way would otherwise decide. Hung left there,
 * they read as the labels of the quieter version's bead under them. They always stay a
 * column beside their bead, however narrow, so where a name is written still says how lively
 * its place is: by a bead in the middle of a phone's scale that is about 130 px, and a long
 * name takes a line more there. Words still being written are judged by the rooms alone from
 * their first letter: their width is not known yet, and judged by the letters so far they
 * would start on one side and cross to the other as they grow.
 */
export function placeLabel(
  beadX: number,
  naturalWidth: number,
  left: number,
  right: number,
  isWritten: boolean = true,
  { beadClear }: Pick<RowSizes, "beadClear"> = ROW,
): LabelPlacement {
  const roomRight = right - (beadX + beadClear);
  const roomLeft = beadX - beadClear - left;
  const isLeftWider = roomLeft - roomRight > beadClear;
  const side: LabelSide = !isWritten
    ? isLeftWider
      ? "left"
      : "right"
    : naturalWidth <= roomRight
      ? "right"
      : naturalWidth <= roomLeft || isLeftWider
        ? "left"
        : "right";
  const maxWidth = Math.max(0, Math.floor(side === "right" ? roomRight : roomLeft));
  return { side, maxWidth };
}
