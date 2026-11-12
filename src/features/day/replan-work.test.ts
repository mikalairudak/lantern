import { describe, expect, it } from "vitest";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { replanFrameOf } from "@/features/abacus/replan-frame";
import { replanEndedOf } from "./not-yet";
import type { ReplanControls } from "./replan-controls";
import { forkViewOf, placesKeptOf, writtenOf } from "./replan-work";

const ignore = () => undefined;

/** What Elche's proposal would change, and its day before once the proposal is taken. */
const RECEIPT = { words: "Dinner 21:00, not 18:15 · 3 new stops", end: "ends 23:45, not 20:45" };
const BACK = { words: "Dinner 18:15, not 21:00", end: "ends 20:45, not 23:45" };

/** Elche's dinner changed to a late one, as the page tells it at a step. */
function lateDinner(step: Partial<ReplanControls>): ReplanControls {
  return {
    status: "idle",
    change: { word: "dinner", from: "early dinner", to: "eating late" },
    reach: "part",
    ending: null,
    written: null,
    receipt: null,
    windows: [],
    isCompared: false,
    choose: () => false,
    compare: ignore,
    askAgain: ignore,
    ...step,
  };
}

/** The family's whole day, as the page tells it at a step. */
function withFamily(step: Partial<ReplanControls>): ReplanControls {
  return lateDinner({
    change: { word: "company", from: "with anyone", to: "with family" },
    reach: "whole",
    ...step,
  });
}

function viewOf(replan: ReplanControls, isLookingDue = true) {
  return forkViewOf({ replan, frame: null, isLookingDue });
}

describe("forkViewOf", () => {
  it("draws no fork at rest", () => {
    expect(viewOf(lateDinner({}))).toBeNull();
  });

  it("says what it looks for a beat after the press, the visitor's day chosen, the proposal unready", () => {
    const writing = lateDinner({ status: "writing", isCompared: true });

    expect(viewOf(writing, false)).toMatchObject({
      from: "early dinner",
      to: "eating late",
      chosen: "from",
      isWriting: true,
      isReady: false,
      isChosen: false,
      line: { words: "", isWorking: true },
    });
    expect(viewOf(writing)?.line).toEqual({
      words: "Looking for a dinner after nine",
      count: null,
      isWorking: true,
    });
  });

  it("counts a part's new stops from its frame, as they land beside the day", () => {
    const frame = replanFrameOf(ELCHE_DINNER_BASIS, {
      stops: ELCHE_LATE_DINNER_UNREPEATED.stops.slice(0, 2),
    });
    const view = forkViewOf({
      replan: lateDinner({ status: "writing" }),
      frame,
      isLookingDue: true,
    });

    expect(view?.line).toEqual({
      words: "Writing the new stops",
      count: "1 so far",
      isWorking: true,
    });
  });

  it("tells a whole day's moments from how far its stream is written", () => {
    const written = (stops: number, versioning: number) =>
      viewOf(withFamily({ status: "writing", written: { stops, versioning } }))?.line;

    expect(written(0, 0)?.words).toBe("Writing the day again, for a family");
    expect(written(3, 0)).toMatchObject({ words: "Writing the day", count: "3 so far" });
    expect(written(8, 2)).toMatchObject({ words: "Writing their versions", count: "2 of 8" });
  });

  it("offers the proposal whole, with what it would change, until a version is chosen", () => {
    const ready = viewOf(lateDinner({ status: "proposed", receipt: RECEIPT, isCompared: true }));

    expect(ready).toMatchObject({
      chosen: "from",
      isReady: true,
      isChosen: false,
      isComparable: false,
      line: { words: RECEIPT.words, count: null, isWorking: false },
      end: RECEIPT.end,
    });
  });

  it("folds to its answers once a version is chosen, the other a tap away and comparable", () => {
    const taken = viewOf(lateDinner({ status: "taken", receipt: BACK }));
    const left = viewOf(lateDinner({ status: "left", receipt: RECEIPT }));

    expect(taken).toMatchObject({ chosen: "to", isChosen: true, isComparable: true, line: null });
    expect(left).toMatchObject({ chosen: "from", isChosen: true, isComparable: true, line: null });
    // Compared, the other version's receipt is said again, the day before's once taken.
    expect(viewOf(lateDinner({ status: "taken", receipt: BACK, isCompared: true }))).toMatchObject({
      line: { words: BACK.words },
      end: BACK.end,
      isCompared: true,
    });
  });

  it("offers a whole day's proposal to take, but nothing to compare beside the day", () => {
    const receipt = { words: "With family · 3 new stops, 5 the same", end: null };

    expect(viewOf(withFamily({ status: "proposed", receipt }))?.line?.words).toBe(receipt.words);
    expect(viewOf(withFamily({ status: "taken", receipt }))?.isComparable).toBe(false);
  });

  it("says why it failed in the reason's own words, and asks again only where it might mend", () => {
    const failed = (ending: ReplanControls["ending"]) =>
      viewOf(lateDinner({ status: "failed", ending }));

    expect(failed("invalid")).toMatchObject({
      isFailed: true,
      line: { words: replanEndedOf("invalid", "dinner", "part"), isWorking: false },
      canAskAgain: true,
    });
    expect(failed("unavailable")?.canAskAgain).toBe(true);
    expect(failed("limited")?.canAskAgain).toBe(false);
    expect(failed("refused")?.canAskAgain).toBe(false);
  });
});

describe("writtenOf", () => {
  it("counts the stops placed and the sets begun, the one being written among them", () => {
    const placed = { name: "A", startTime: "09:00", durationMinutes: 60 };
    const stop = { place: placed, startTime: "09:00", durationMinutes: 60 };

    expect(writtenOf(null)).toEqual({ stops: 0, versioning: 0 });
    // A day writes its line first: begun, it says nothing of how far the day has gone.
    expect(writtenOf({ dek: "A slow", stops: [stop, stop] })).toEqual({ stops: 2, versioning: 0 });
    expect(writtenOf({ stops: [stop, stop], alternatives: [{}] })).toEqual({
      stops: 2,
      versioning: 1,
    });
    expect(writtenOf({ stops: [stop, stop], alternatives: [{}, {}, {}] })).toEqual({
      stops: 2,
      versioning: 2,
    });
  });
});

describe("placesKeptOf", () => {
  it("counts a whole day's stops new to the day and those at the same places, by spelling", () => {
    const at = (name: string) => ({ primary: { name } });

    expect(
      placesKeptOf([at("Huerto del Cura"), at("Basilica")], [at("huerto del cura"), at("Museo")]),
    ).toEqual({
      added: 1,
      same: 1,
      later: 0,
      earlier: 0,
    });
  });
});
