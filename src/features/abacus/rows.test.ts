import { describe, expect, it } from "vitest";
import {
  hasEntered,
  isRoomOpen,
  isSunMinuteInOrder,
  keptApart,
  leavingRowsAt,
  placeLabel,
  rowScale,
  rowScaleLeaving,
  rowsKeptClear,
  ROW,
  wordsRightOf,
  anchorsOf,
  type RowExtent,
} from "./rows";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { minutesOf } from "@/lib/time/clock";
import { CHART } from "./geometry";

const WIDTH = 358;
const BASIS = 576;
const SEVEN = 7 * 60;
const ELEVEN_PM = 23 * 60;

describe("isRoomOpen", () => {
  /** Alicante's bar on a 390 px phone: two lines by its hollow bead, one where it rests. */
  const TWO_LINES = 43 + ROW.wireGap;
  const ONE_LINE = 24 + ROW.wireGap;

  it("opens a waiting row's room only where its words need it, within a pixel", () => {
    expect(isRoomOpen(TWO_LINES - 3, TWO_LINES)).toBe(false);
    expect(isRoomOpen(TWO_LINES - 0.5, TWO_LINES)).toBe(true);
    // Still settling down from a spare line, it waits: its words move into room already open.
    expect(isRoomOpen(TWO_LINES, ONE_LINE)).toBe(false);
    expect(isRoomOpen(undefined, ONE_LINE)).toBe(false);
  });

  it("keeps a filled row's room open while it settles down to words that rest shorter", () => {
    // Opened for the two waiting lines, the bead fills and the words rest on one: were the
    // room then read as closed, the row would wait again in two lines, open again, and flip
    // in one commit until React gave up, as Alicante's bar did.
    expect(isRoomOpen(TWO_LINES, TWO_LINES)).toBe(true);
    expect(isRoomOpen(TWO_LINES, ONE_LINE, true)).toBe(true);
  });

  it("does not open a filled row's room that is still short of its words", () => {
    expect(isRoomOpen(ONE_LINE, TWO_LINES, true)).toBe(false);
    expect(isRoomOpen(TWO_LINES - 0.5, TWO_LINES, true)).toBe(true);
  });
});

describe("isSunMinuteInOrder", () => {
  const clock = (hours: number, minutes = 0) => hours * 60 + minutes;
  /** Nafplio's walk to Palamidi and its dinner on a 390 px phone, their times' middles. */
  const WALK = { minutes: clock(15, 30), y: 520 };
  const DINNER = { minutes: clock(18), y: 610 };
  const CLEAR = ROW.sunLabelClearance;

  it("says a sun's minute under the stops that start before it and over the ones after", () => {
    const sunset = { minutes: clock(17, 25), y: 580 };
    expect(isSunMinuteInOrder(sunset, [WALK, DINNER], CLEAR)).toBe(true);
  });

  it("never says it under a stop that starts after it, however far from it", () => {
    // The sunset at 17:25 drawn 29 px under the dinner's "18:00": far enough apart, out of order.
    const sunset = { minutes: clock(17, 25), y: DINNER.y + 29 };
    expect(isSunMinuteInOrder(sunset, [WALK, DINNER], CLEAR)).toBe(false);
  });

  it("never says it over a stop that starts before it", () => {
    const sunrise = { minutes: clock(16), y: WALK.y - 40 };
    expect(isSunMinuteInOrder(sunrise, [WALK, DINNER], CLEAR)).toBe(false);
  });

  it("keeps it clear of a time on its own side", () => {
    const near = { minutes: clock(17, 25), y: DINNER.y - CLEAR + 1 };
    expect(isSunMinuteInOrder(near, [WALK, DINNER], CLEAR)).toBe(false);
    const clear = { minutes: clock(17, 25), y: DINNER.y - CLEAR };
    expect(isSunMinuteInOrder(clear, [WALK, DINNER], CLEAR)).toBe(true);
  });

  it("reads a stop that starts at the sun's minute as before it", () => {
    const atSunset = { minutes: clock(17, 25), y: 560 };
    expect(isSunMinuteInOrder({ minutes: clock(17, 25), y: 600 }, [atSunset], CLEAR)).toBe(true);
    expect(isSunMinuteInOrder({ minutes: clock(17, 25), y: 520 }, [atSunset], CLEAR)).toBe(false);
  });

  it("reads a stop past midnight as after an evening sun, by its running minute", () => {
    // 00:30 runs on as 24:30, so the sunset at 17:25 stands over it, however early it reads.
    const pastMidnight = { minutes: clock(24, 30), y: 700 };
    const sunset = { minutes: clock(17, 25), y: 600 };
    expect(isSunMinuteInOrder(sunset, [WALK, pastMidnight], CLEAR)).toBe(true);
    expect(isSunMinuteInOrder({ ...sunset, y: 720 }, [WALK, pastMidnight], CLEAR)).toBe(false);
  });

  it("says it on a day with no stops yet", () => {
    expect(isSunMinuteInOrder({ minutes: clock(17, 25), y: 0 }, [], CLEAR)).toBe(true);
  });
});

describe("wordsRightOf", () => {
  const { scale } = rowScale(WIDTH, BASIS, SEVEN, ELEVEN_PM, []);
  const wordsLeft = scale.axisX + ROW.beadClear;
  /** An open sheet runs from just right of the time axis to the chart's edge. */
  const sheet = { from: scale.axisX + ROW.sheetFromAxis, to: scale.width };

  it("ends a row's words as far inside a sheet at the chart's edge as they start inside it", () => {
    expect(sheet.to - wordsRightOf(scale.width)).toBe(wordsLeft - sheet.from);
    expect(wordsRightOf(scale.width)).toBeLessThan(scale.width);
  });

  it("gives words right of a bead the room up to there, so none runs past the chart", () => {
    const beadX = scale.xOf(1);
    const { side, maxWidth } = placeLabel(beadX, 1, wordsLeft, wordsRightOf(scale.width));

    expect(side).toBe("right");
    expect(beadX + ROW.beadClear + maxWidth).toBeLessThanOrEqual(
      scale.width - (ROW.beadClear - ROW.sheetFromAxis),
    );
  });
});

describe("keptApart", () => {
  /** Elche's Basílica and the new 16:30 under it on a phone, a re-plan on screen. */
  const BASILICA = { mid: 15 * 60, above: 94 + ROW.wireGap };
  const HUERTO = { mid: 16.5 * 60, above: 114 };
  const BELOW = { mid: 21 * 60, above: 99 + ROW.wireGap };

  it("moves a wire down to its words' room under the wire held above it, and the rows below", () => {
    // The Basílica held where it stood, 823; the new row where the day as written put it.
    const kept = keptApart([823, 932, 1069.6], [BASILICA, HUERTO, BELOW]);

    expect(kept[1]).toBe(823 + ROW.gap + HUERTO.above);
    expect(kept[2]).toBe(kept[1]! + ROW.gap + BELOW.above);
  });

  it("leaves wires with their room where they stand", () => {
    const apart = [200, 200 + ROW.gap + HUERTO.above + 40];

    expect(keptApart(apart, [BASILICA, HUERTO])).toEqual(apart);
  });
});

describe("rowsKeptClear", () => {
  const PLOT_TOP = 72;
  /** Two rows at rest: the first's words start at the plot's top, the second's a gap below. */
  const resting = {
    anchors: [PLOT_TOP + 40, PLOT_TOP + 40 + ROW.gap + 30],
    tops: [PLOT_TOP, PLOT_TOP + 40 + ROW.gap],
  };
  /** How far the first row's wire has come down ahead of the row under it. */
  const HELD_DOWN = 12;

  it("draws the rows where their springs have them", () => {
    expect(rowsKeptClear(resting, resting, PLOT_TOP)).toEqual(resting);
  });

  it("carries a row down whole when the wire above comes down onto its words", () => {
    const held = { ...resting, anchors: [resting.anchors[0]! + HELD_DOWN, resting.anchors[1]!] };

    const drawn = rowsKeptClear(held, resting, PLOT_TOP);

    expect(drawn.anchors).toEqual([
      resting.anchors[0]! + HELD_DOWN,
      resting.anchors[1]! + HELD_DOWN,
    ]);
    expect(drawn.tops).toEqual([resting.tops[0]!, resting.tops[1]! + HELD_DOWN]);
  });

  it("leaves a row where it is when there is room enough above its words", () => {
    const apart = {
      anchors: [resting.anchors[0]!, resting.anchors[1]! + 20],
      tops: [resting.tops[0]!, resting.tops[1]! + 20],
    };
    const held = { ...apart, anchors: [apart.anchors[0]! + HELD_DOWN, apart.anchors[1]!] };

    expect(rowsKeptClear(held, apart, PLOT_TOP)).toEqual(held);
  });

  it("draws rows the springs carry close on their way as they are", () => {
    // A stop gliding past another to its new time: at rest too its row stands this close.
    const gliding = { anchors: [PLOT_TOP + 40, PLOT_TOP + 50], tops: [PLOT_TOP, PLOT_TOP + 20] };

    expect(rowsKeptClear(gliding, gliding, PLOT_TOP)).toEqual(gliding);
  });

  describe("a row entering between two others", () => {
    /** Three rows at rest, the middle one a re-plan's new stop. */
    const three = {
      anchors: [PLOT_TOP + 40, PLOT_TOP + 100, PLOT_TOP + 160],
      tops: [PLOT_TOP, PLOT_TOP + 60, PLOT_TOP + 120],
    };
    const entering = [false, true, false];
    /** The row above has not risen yet: it stands where the entering row will rest. */
    const RISING = 40;
    const risingAbove = {
      anchors: [three.anchors[0]! + RISING, three.anchors[1]!, three.anchors[2]!],
      tops: [three.tops[0]! + RISING, three.tops[1]!, three.tops[2]!],
    };

    it("grows into the room that has opened, and never pushes the row below", () => {
      const drawn = rowsKeptClear(risingAbove, three, PLOT_TOP, ROW.gap, entering);

      // The row below stands where it rests.
      expect(drawn.tops[2]).toBe(three.tops[2]);
      expect(drawn.anchors[2]).toBe(three.anchors[2]);
      // The entering row starts under the wire above and ends above the row below.
      expect(drawn.tops[1]).toBeGreaterThanOrEqual(drawn.anchors[0]! + ROW.gap);
      expect(drawn.anchors[1]).toBeLessThanOrEqual(three.tops[2]! - ROW.gap);
      expect(hasEntered(drawn, three, 1)).toBe(false);
    });

    it("lets a first row come back squeezed above the chart, never pushing the row below", () => {
      // A re-plan gone back: the walk stands at the chart's top, in the old first stop's
      // place, and glides down as that stop comes back above it.
      const back = [true, false, false];
      const walkAtTop = {
        anchors: [three.anchors[0]!, three.anchors[0]!, three.anchors[2]!],
        tops: [three.tops[0]!, three.tops[0]!, three.tops[2]!],
      };
      const drawn = rowsKeptClear(walkAtTop, three, PLOT_TOP, ROW.gap, back);

      expect(drawn.tops[1]).toBe(walkAtTop.tops[1]);
      expect(drawn.anchors[0]).toBeLessThanOrEqual(walkAtTop.tops[1]! - ROW.gap);
      expect(hasEntered(drawn, three, 0)).toBe(false);
    });

    it("has entered once the row above has risen and its room is whole", () => {
      const drawn = rowsKeptClear(three, three, PLOT_TOP, ROW.gap, entering);

      expect(drawn).toEqual(three);
      expect(hasEntered(drawn, three, 1)).toBe(true);
    });

    it("leaves the time scale alone while it is unseen", () => {
      const rows = three.anchors.map((_, index) => ({ mid: 600 + 60 * index, above: 40 }));
      const squeezed = [three.anchors[0]!, three.anchors[0]! + 0.5, three.anchors[2]!];
      const seen = rowScale(390, 600, 480, 840, rows, squeezed);
      const unseen = rowScale(390, 600, 480, 840, rows, squeezed, undefined, [1, 0, 1]);

      // Between the rows on either side, the unseen row bends nothing: half past ten is a
      // quarter of the way from the first row's wire, at ten, to the last's, at noon.
      expect(unseen.scale.yOf(630)).toBeCloseTo(
        three.anchors[0]! + (three.anchors[2]! - three.anchors[0]!) / 4,
        0,
      );
      expect(seen.scale.yOf(630)).not.toBeCloseTo(unseen.scale.yOf(630), 0);
    });

    it("bends the time scale at a row past the frame's end, so the end passing it moves nothing", () => {
      // A re-plan's new last stop at 11:40, the frame's end drawing out to it.
      const rows = [
        { mid: 600, above: 40 },
        { mid: 700, above: 40 },
      ];
      const wires = [200, 300];
      const short = rowScale(390, 600, 480, 699, rows, wires).scale;
      const past = rowScale(390, 600, 480, 701, rows, wires).scale;

      expect(short.yOf(650)).toBeCloseTo(past.yOf(650), 1);
      expect(short.yOf(700)).toBeCloseTo(300, 5);
    });

    it("bends the time scale as far as it is seen, so it never bends in a frame", () => {
      const rows = three.anchors.map((_, index) => ({ mid: 600 + 60 * index, above: 40 }));
      const squeezed = [three.anchors[0]!, three.anchors[0]! + 0.5, three.anchors[2]!];
      const scaleSeen = (amount: number) =>
        rowScale(390, 600, 480, 840, rows, squeezed, undefined, [1, amount, 1]).scale.yOf(630);

      // Just seen, it bends the scale only just; half seen, half way; seen, all the way.
      expect(scaleSeen(0.001)).toBeCloseTo(scaleSeen(0), 1);
      expect(scaleSeen(0.5)).toBeCloseTo((scaleSeen(0) + scaleSeen(1)) / 2, 0);
      expect(scaleSeen(1)).toBeCloseTo(
        rowScale(390, 600, 480, 840, rows, squeezed).scale.yOf(630),
        5,
      );
    });
  });
});

const ORIGIN = { minutes: 7 * 60, y: 100 };
/** Half a pixel a minute: two hours are 60px. */
const PER_MINUTE = 0.5;
const ONE_LINE = 28;

const row = (mid: number, above = ONE_LINE): RowExtent => ({ mid, above });

describe("anchorsOf", () => {
  it("keeps rows on the time scale when their words fit", () => {
    const anchors = anchorsOf([row(8 * 60), row(10 * 60), row(12 * 60)], ORIGIN, PER_MINUTE);

    expect(anchors).toEqual([130, 190, 250]);
  });

  it("never sets a row closer to the one before than their words need", () => {
    const anchors = anchorsOf([row(8 * 60), row(8 * 60 + 10)], ORIGIN, PER_MINUTE);

    expect((anchors[1] ?? 0) - (anchors[0] ?? 0)).toBe(ROW.gap + ONE_LINE);
  });

  it("never moves an earlier row when a later one arrives or grows", () => {
    const rows = [row(8 * 60), row(9 * 60), row(9 * 60 + 5)];
    const before = anchorsOf(rows.slice(0, 2), ORIGIN, PER_MINUTE);
    const after = anchorsOf([...rows.slice(0, 2), row(9 * 60 + 5, 90)], ORIGIN, PER_MINUTE);

    expect(after.slice(0, 2)).toEqual(before);
  });

  it("keeps the first row's words below the top of the chart", () => {
    const [first] = anchorsOf([row(7 * 60 + 5, 40)], ORIGIN, PER_MINUTE);

    expect(first).toBe(ORIGIN.y + 40);
  });
});

describe("rowScale", () => {
  const DAY = { start: 7 * 60, end: 23 * 60 };

  it("maps each stop's minute to its row, and back", () => {
    const rows = [row(8 * 60), row(8 * 60 + 15), row(14 * 60)];
    const { scale, anchors } = rowScale(400, 600, DAY.start, DAY.end, rows);

    rows.forEach((each, index) => {
      expect(scale.yOf(each.mid)).toBeCloseTo(anchors[index] ?? 0);
      expect(scale.minutesAt(anchors[index] ?? 0)).toBeCloseTo(each.mid);
    });
  });

  it("draws the wires where they are this frame, on their way to where the rows need them", () => {
    const rows = [row(8 * 60), row(14 * 60)];
    const needed = rowScale(400, 600, DAY.start, DAY.end, rows).anchors;
    const halfway = needed.map((anchor) => anchor - 20);
    const { scale, anchors } = rowScale(400, 600, DAY.start, DAY.end, rows, halfway);

    expect(anchors).toEqual(halfway);
    expect(scale.yOf(14 * 60)).toBeCloseTo(halfway[1] ?? 0);
  });

  it("runs time downward everywhere, even where a row was stretched", () => {
    const rows = [row(8 * 60), row(8 * 60 + 5, 60), row(8 * 60 + 10, 60)];
    const { scale } = rowScale(400, 600, DAY.start, DAY.end, rows);
    const ys = Array.from({ length: 33 }, (_, step) => scale.yOf(DAY.start + step * 30));

    expect(ys.every((y, index) => index === 0 || y > (ys[index - 1] ?? 0))).toBe(true);
  });

  it("grows taller than its basis when the rows need it", () => {
    const crowded = Array.from({ length: 30 }, (_, index) => row(8 * 60 + index * 10, 40));
    const { scale } = rowScale(400, 600, DAY.start, DAY.end, crowded);

    expect(scale.height).toBeGreaterThan(600);
    expect(scale.plotBottom).toBeLessThan(scale.height);
  });

  it("keeps the energy axis of the plain chart", () => {
    const { scale } = rowScale(400, 600, DAY.start, DAY.end, [row(9 * 60)]);

    expect(scale.xOf(0)).toBe(CHART.axisWidth + CHART.laneInsetStart);
    expect(scale.xOf(4)).toBe(400 - CHART.laneInsetEnd);
  });

  it.each(CURATED_DAYS.map((curated) => [curated.request.city, curated] as const))(
    "lays out %s's stops in order with room for a line of words each",
    (_, curated) => {
      const rows = curated.day.stops.map((stop) =>
        row(minutesOf(stop.startTime) + stop.durationMinutes / 2),
      );
      const { anchors } = rowScale(358, 576, DAY.start, DAY.end, rows);

      anchors.slice(1).forEach((y, index) => {
        expect(y - (anchors[index] ?? 0)).toBeGreaterThanOrEqual(ROW.gap + ONE_LINE);
      });
    },
  );
});

describe("rowScaleLeaving", () => {
  const DAY = { start: 7 * 60, end: 23 * 60 };
  /** Elche's lunch as its old version folds away: the old lunch, the new one, the Basílica. */
  const rows = [row(9 * 60, 60), row(13 * 60 + 45, 90), row(13 * 60 + 50, 60), row(15 * 60, 60)];
  const leaving = [false, true, false, false];

  it("lays the rows that stay out as if the leaving ones were gone", () => {
    const staying = rowScale(400, 600, DAY.start, DAY.end, [rows[0]!, rows[2]!, rows[3]!]);
    const { anchors, scale } = rowScaleLeaving(400, 600, DAY.start, DAY.end, rows, leaving);

    expect([anchors[0], anchors[2], anchors[3]]).toEqual(staying.anchors);
    expect(scale.plotBottom).toBe(staying.scale.plotBottom);
  });

  it("rests a leaving row's wire a hair under the wire above it", () => {
    const { anchors } = rowScaleLeaving(400, 600, DAY.start, DAY.end, rows, leaving);

    expect(anchors[1]! - anchors[0]!).toBeGreaterThan(0);
    expect(anchors[1]! - anchors[0]!).toBeLessThan(1);
  });

  it("is rowScale where no row leaves", () => {
    const all = rowScale(400, 600, DAY.start, DAY.end, rows);
    const { anchors, scale } = rowScaleLeaving(400, 600, DAY.start, DAY.end, rows, []);

    expect(anchors).toEqual(all.anchors);
    expect(scale.plotBottom).toBe(all.scale.plotBottom);
  });
});

describe("leavingRowsAt", () => {
  /** Words 40 px over each wire; the second and third rows leave, the fourth stays. */
  const WORDS = 40;
  const wordsAbove = [WORDS, WORDS, WORDS, WORDS];
  const resting = { anchors: [100, 100.5, 101, 200], tops: [60, 60.5, 61, 160] };

  it("rides a run of leaving rows on the row that stays under it, a gap over its words", () => {
    const { anchors, tops } = leavingRowsAt(resting, [false, true, true, false], wordsAbove);

    expect(anchors[2]).toBe(160 - ROW.gap);
    expect(tops[2]).toBe(160 - ROW.gap - WORDS);
    expect(anchors[1]).toBe(tops[2]! - ROW.gap);
    expect(anchors[3]).toBe(200);
  });

  it("keeps a run at the day's end on the wire above it", () => {
    const { anchors, tops } = leavingRowsAt(resting, [false, false, true, true], wordsAbove);

    expect(anchors).toEqual(resting.anchors);
    expect(tops).toEqual(resting.tops);
  });
});

describe("placeLabel", () => {
  const LEFT = 60;
  const RIGHT = 400;

  it("writes the words to the right of their bead when they fit there", () => {
    expect(placeLabel(100, 200, LEFT, RIGHT)).toEqual({
      side: "right",
      maxWidth: RIGHT - 100 - ROW.beadClear,
    });
  });

  it("moves them to the left only when they fit there and not on the right", () => {
    expect(placeLabel(380, 200, LEFT, RIGHT)).toEqual({
      side: "left",
      maxWidth: 380 - ROW.beadClear - LEFT,
    });
  });

  it("lets words that fit neither side wrap on the left only when it is clearly wider", () => {
    expect(placeLabel(220, 500, LEFT, RIGHT).side).toBe("right");
    expect(placeLabel(260, 500, LEFT, RIGHT).side).toBe("left");
  });

  it("keeps words that wrap either way right of a bead where the rooms nearly match", () => {
    // 131 px on the left against 127 on the right, a bead in the middle of a phone's scale.
    const middle = LEFT + ROW.beadClear + 131;
    const right = middle + ROW.beadClear + 127;
    // A bead 8 px further right leaves 20 px more on the left, more than a bead's clearance.
    const rightOfMiddle = middle + ROW.beadClear / 2 + 1;

    expect(placeLabel(middle, 400, LEFT, right).side).toBe("right");
    expect(placeLabel(middle, 400, LEFT, right, false).side).toBe("right");
    expect(placeLabel(rightOfMiddle, 400, LEFT, right).side).toBe("left");
    expect(placeLabel(rightOfMiddle, 400, LEFT, right, false).side).toBe("left");
  });

  it("keeps words a column beside a bead with little room either side", () => {
    // 300 px wide, the bead in the middle: under 150 px either side, as on a phone.
    const middle = placeLabel(200, 420, LEFT, 360);

    expect(middle).toEqual({ side: "right", maxWidth: 360 - 200 - ROW.beadClear });
  });

  it("judges words still being written by the rooms alone from their first letter", () => {
    // One letter would fit on the right of a bead near the edge, and the name then cross.
    expect(placeLabel(380, 8, LEFT, RIGHT, false).side).toBe("left");
    expect(placeLabel(100, 8, LEFT, RIGHT, false).side).toBe("right");
  });
});
