// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHART } from "./geometry";
import { ROW } from "./rows";
import {
  coveredBeadsOf,
  hungDayHeightOf,
  isUnderSheet,
  nameRoomOf,
  sheetBandOf,
  sheetSideOf,
  sheetWidthOf,
  type SheetAnchor,
} from "./sheet-placement";

/** How far a stop's beads reach either side of its wire, at the default root. */
const BEAD_REACH = CHART.beadReach;
/** A stop whose words start 400 px down the chart, its wire 50 px under them. */
const ANCHOR: SheetAnchor = { wordsTop: 400, above: 50 };
const WIRE_Y = ANCHOR.wordsTop + ANCHOR.above;
/** What the sheet says, its padding and edges, besides the room for the words. */
const BODY = 300;

describe("the room a sheet keeps for its stop's words", () => {
  it("opening down, pads the words on either side", () => {
    expect(nameRoomOf("below", ANCHOR.above)).toBe(ANCHOR.above - ROW.wireGap + 2 * ROW.sheetPad);
  });

  it("opening up, runs on past the stop's own beads", () => {
    expect(nameRoomOf("above", ANCHOR.above)).toBe(ROW.sheetPad + ANCHOR.above + BEAD_REACH);
  });
});

describe("where a sheet lies", () => {
  it("opening down, starts a pad above the words and grows down from there", () => {
    const band = sheetBandOf("below", ANCHOR, BODY);
    expect(band.top).toBe(ANCHOR.wordsTop - ROW.sheetPad);
    expect(band.bottom - band.top).toBe(BODY + nameRoomOf("below", ANCHOR.above));
  });

  it("opening up, ends past the beads of its own wire and grows up from there", () => {
    const band = sheetBandOf("above", ANCHOR, BODY);
    expect(band.bottom).toBe(WIRE_Y + BEAD_REACH);
    expect(band.bottom - band.top).toBe(BODY + nameRoomOf("above", ANCHOR.above));
    // Its own beads are under it whole, so its edge cuts none of them.
    expect(coveredBeadsOf(WIRE_Y, band)).toBeNull();
  });
});

describe("which way a sheet opens", () => {
  const below = sheetBandOf("below", ANCHOR, BODY);
  const above = sheetBandOf("above", ANCHOR, BODY);
  /** A day with no room around it, as a lab cell's. */
  const CELL = { roomAbove: 0, tail: 0 };

  it("down, when it ends inside the day", () => {
    expect(sheetSideOf(ANCHOR, BODY, { ...CELL, frameHeight: below.bottom })).toBe("below");
  });

  it("down over the page's tail, when it ends a sheet's gap above the page's end", () => {
    const frameHeight = below.bottom - 40;
    const tail = 40 + ROW.sheetGap;
    expect(sheetSideOf(ANCHOR, BODY, { frameHeight, roomAbove: 0, tail })).toBe("below");
    expect(sheetSideOf(ANCHOR, BODY, { frameHeight, roomAbove: 0, tail: tail - 1 })).toBe("above");
  });

  it("up, when down would take it past the day's end and the page can show it above", () => {
    const room = { ...CELL, frameHeight: below.bottom - 1 };
    expect(above.top).toBeGreaterThanOrEqual(0);
    expect(sheetSideOf(ANCHOR, BODY, room)).toBe("above");
  });

  it("up past the chart's top, into the room under the header, when the day above is too short", () => {
    const tall = BODY + ANCHOR.wordsTop;
    const top = sheetBandOf("above", ANCHOR, tall).top;
    expect(top).toBeLessThan(0);
    expect(sheetSideOf(ANCHOR, tall, { frameHeight: 600, roomAbove: -top, tail: 0 })).toBe("above");
  });

  it("down past where the page ends only where it has room on neither side", () => {
    const tall = BODY + ANCHOR.wordsTop;
    const top = sheetBandOf("above", ANCHOR, tall).top;
    const room = { frameHeight: 600, roomAbove: -top - 1, tail: 100 };
    expect(sheetSideOf(ANCHOR, tall, room)).toBe("below");
  });
});

describe("how tall the day stands under a sheet", () => {
  const ROOM = { frameHeight: 600, roomAbove: 0, tail: 100 };

  it("as it is while the sheet ends inside the day or over the page's tail", () => {
    expect(hungDayHeightOf({ top: 100, bottom: 500 }, ROOM)).toBeUndefined();
    const lowest = ROOM.frameHeight + ROOM.tail - ROW.sheetGap;
    expect(hungDayHeightOf({ top: 300, bottom: lowest }, ROOM)).toBeUndefined();
  });

  it("taller by no more than a sheet that hangs past the page's end needs", () => {
    const lowest = ROOM.frameHeight + ROOM.tail - ROW.sheetGap;
    const height = hungDayHeightOf({ top: 300, bottom: lowest + 94 }, ROOM);

    // The page grows by the 94 px the sheet is short, its tail still under the sheet's end.
    expect(height).toBe(ROOM.frameHeight + 94);
  });

  it("in a lab cell, which ends with the day, a sheet's gap past the sheet", () => {
    const cell = { ...ROOM, tail: 0 };
    expect(hungDayHeightOf({ top: 300, bottom: 620 }, cell)).toBe(620 + ROW.sheetGap);
    expect(hungDayHeightOf({ top: 300, bottom: 600 }, cell)).toBeUndefined();
  });
});

describe("the beads a sheet covers that are drawn again over it", () => {
  const SHEET = { top: 200, bottom: 500 };

  it("run from the sheet's top edge down to the beads' lowest reach where the edge crosses them", () => {
    expect(coveredBeadsOf(SHEET.top, SHEET)).toEqual({ from: SHEET.top, height: BEAD_REACH });
    expect(coveredBeadsOf(SHEET.top + 4, SHEET)).toEqual({
      from: SHEET.top,
      height: BEAD_REACH + 4,
    });
    expect(coveredBeadsOf(SHEET.top - 6, SHEET)).toEqual({
      from: SHEET.top,
      height: BEAD_REACH - 6,
    });
  });

  it("run from the beads' highest reach down to the sheet's lower edge where that crosses them", () => {
    expect(coveredBeadsOf(SHEET.bottom - 4, SHEET)).toEqual({
      from: SHEET.bottom - 4 - BEAD_REACH,
      height: BEAD_REACH + 4,
    });
  });

  it("are none where the sheet covers the beads whole, or misses them", () => {
    expect(coveredBeadsOf(300, SHEET)).toBeNull();
    expect(coveredBeadsOf(SHEET.top + BEAD_REACH, SHEET)).toBeNull();
    expect(coveredBeadsOf(SHEET.top - BEAD_REACH, SHEET)).toBeNull();
    expect(coveredBeadsOf(SHEET.bottom + BEAD_REACH, SHEET)).toBeNull();
  });

  it("lie under the sheet whole or across an edge, but not where it misses them", () => {
    expect(isUnderSheet(300, SHEET)).toBe(true);
    expect(isUnderSheet(SHEET.top - 4, SHEET)).toBe(true);
    expect(isUnderSheet(SHEET.bottom + 4, SHEET)).toBe(true);
    expect(isUnderSheet(SHEET.top - BEAD_REACH, SHEET)).toBe(false);
    expect(isUnderSheet(SHEET.bottom + BEAD_REACH, SHEET)).toBe(false);
  });
});

describe("how wide a sheet is", () => {
  /** A phone's run, from just right of the time axis to the chart's edge: 358 px less 60. */
  const PHONE_RUN = { from: 60, to: 358 };
  /** A laptop's, in the 768 px column. */
  const LAPTOP_RUN = { from: 60, to: 768 };
  /** The root's size, which rem tokens are set in. */
  const ROOT_PX = 16;

  it("takes a phone's whole run, as it did when its least was narrower", () => {
    expect(sheetWidthOf(PHONE_RUN, 120)).toBe(298);
    expect(sheetWidthOf(PHONE_RUN, 400)).toBe(298);
  });

  it("is never narrower than its least on a laptop, however short its row's words", () => {
    expect(sheetWidthOf(LAPTOP_RUN, 120)).toBe(ROW.sheetLeastWidth);
    expect(ROW.sheetLeastWidth).toBe(448);
  });

  it("is as wide as its row's words and a pad either side past that, up to its run", () => {
    expect(sheetWidthOf(LAPTOP_RUN, 500)).toBe(500 + 2 * ROW.sheetPad);
    expect(sheetWidthOf(LAPTOP_RUN, 900)).toBe(708);
  });

  it("keeps its least as wide as the chart's column beside a list, at the root's size", () => {
    const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    const rem = Number(/--container-chart:\s*([\d.]+)rem;/.exec(stylesheet)?.[1]);

    expect(rem * ROOT_PX).toBe(ROW.sheetLeastWidth);
  });
});
