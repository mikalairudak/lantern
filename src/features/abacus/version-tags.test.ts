import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { candidatesOf, midsOf, modelPicks } from "./curve";
import { completeDraftOf, type StopDraft } from "./day-draft";
import {
  draggedVersionOf,
  hoveredVersionOf,
  keyedVersionsOf,
  placeTag,
  type Rect,
  type TagRoom,
  type TagToPlace,
} from "./version-tags";

function kyotoStops(): StopDraft[] {
  const normalized = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
  if (!normalized.ok) throw new Error(`Kyoto does not normalize: ${normalized.reason}`);
  return completeDraftOf(normalized.itinerary).stops;
}

const STOPS = kyotoStops();
const PICKS = modelPicks(STOPS);
/** Kyoto's lunch: simmered tofu, calm, with a reflective and a balanced version. */
const LUNCH = STOPS.findIndex((stop) => stop.startTime === "11:15");
const LUNCH_STOP = STOPS[LUNCH] as StopDraft;
const idOf = (name: string): string => {
  const place = candidatesOf(LUNCH_STOP).find((each) => each.name === name);
  if (!place) throw new Error(`No version named ${name}`);
  return place.id;
};
const indexOf = (name: string): number =>
  candidatesOf(LUNCH_STOP).findIndex((place) => place.name === name);

describe("the version a pointer names", () => {
  it("is the one its bead belongs to, with the way it goes from the plan", () => {
    expect(hoveredVersionOf(STOPS, PICKS, idOf("Tofu courses near Keage"))).toMatchObject({
      stopIndex: LUNCH,
      name: "Tofu courses near Keage",
      way: "livelier",
    });
    expect(hoveredVersionOf(STOPS, PICKS, idOf("Tofu on the approach road"))?.way).toBe("quieter");
  });

  it("is none for the bead its stop shows, which its row names", () => {
    expect(hoveredVersionOf(STOPS, PICKS, idOf("Simmered tofu by Nanzen-ji"))).toBeNull();
    expect(hoveredVersionOf(STOPS, PICKS, null)).toBeNull();
  });

  it("calls the plan the original once another version is shown", () => {
    const picks = PICKS.map((pick, index) =>
      index === LUNCH ? indexOf("Tofu courses near Keage") : pick,
    );
    expect(hoveredVersionOf(STOPS, picks, idOf("Simmered tofu by Nanzen-ji"))?.way).toBe(
      "the original",
    );
  });
});

describe("the versions a focused slider's arrows reach", () => {
  it("are the next bead each way along the wire, quieter first", () => {
    expect(keyedVersionsOf(STOPS, PICKS, LUNCH).map((version) => version.name)).toEqual([
      "Tofu on the approach road",
      "Tofu courses near Keage",
    ]);
  });

  it("are one at the end of a wire", () => {
    const picks = PICKS.map((pick, index) =>
      index === LUNCH ? indexOf("Tofu courses near Keage") : pick,
    );
    expect(keyedVersionsOf(STOPS, picks, LUNCH).map((version) => version.name)).toEqual([
      "Simmered tofu by Nanzen-ji",
    ]);
  });

  it("are none while no slider has the keys' focus", () => {
    expect(keyedVersionsOf(STOPS, PICKS, null)).toEqual([]);
  });
});

describe("the version a drag names", () => {
  const mids = midsOf(STOPS);
  const lunchMid = mids[LUNCH] ?? 0;
  const switched = PICKS.map((pick, index) =>
    index === LUNCH ? indexOf("Tofu courses near Keage") : pick,
  );

  it("is what the grabbed stop now shows, once it differs from what its row says", () => {
    expect(draggedVersionOf(STOPS, mids, switched, PICKS, lunchMid + 5)?.name).toBe(
      "Tofu courses near Keage",
    );
  });

  it("is none before the pick crosses its switching point, and once it comes back", () => {
    expect(draggedVersionOf(STOPS, mids, PICKS, PICKS, lunchMid)).toBeNull();
  });

  it("follows the stop nearest the grab, not another the drag has switched", () => {
    const breakfast = mids[LUNCH - 1] ?? 0;
    expect(draggedVersionOf(STOPS, mids, switched, PICKS, breakfast)).toBeNull();
  });

  it("is none with no drag", () => {
    expect(draggedVersionOf(STOPS, mids, switched, PICKS, null)).toBeNull();
  });
});

describe("where a tag stands", () => {
  const room: TagRoom = {
    bounds: { left: 40, right: 400, beadClear: 17 },
    words: [],
    wireGap: 6,
  };
  const ONE_LINE = { width: 120, height: 13 };
  const tag = (patch: Partial<TagToPlace> = {}): TagToPlace => ({
    beadX: 100,
    wireY: 200,
    size: { wire: ONE_LINE, off: { width: 122, height: 21 } },
    others: [],
    lines: ["wire", "over", "under"],
    ...patch,
  });

  it("stands on its wire, on the side its row's words would take, where the wire is clear", () => {
    expect(placeTag(tag(), room)).toMatchObject({ line: "wire", side: "right", edge: 117 });
  });

  it("is centred on the wire, one line of letters tall", () => {
    expect(placeTag(tag(), room).top).toBe(200 - 13 / 2);
  });

  it("takes the other side where a bead stands in the way", () => {
    const placement = placeTag(tag({ beadX: 300, others: [360] }), room);
    expect(placement).toMatchObject({ line: "wire", side: "left", edge: 283 });
  });

  it("never covers a bead on its wire: with beads close either side it leaves the wire", () => {
    const placement = placeTag(tag({ beadX: 200, others: [150, 250] }), room);
    expect(placement.line).not.toBe("wire");
  });

  it("goes over the wire, beside its row's words, where the wire has no room", () => {
    const placement = placeTag(tag({ beadX: 200, others: [150, 250] }), room);
    expect(placement).toMatchObject({ line: "over", side: "right" });
    expect(placement.top).toBe(200 - 6 - 21);
  });

  it("goes under the wire where words stand over it", () => {
    const words: Rect[] = [{ left: 40, top: 160, right: 400, bottom: 192 }];
    const placement = placeTag(tag({ beadX: 200, others: [150, 250] }), { ...room, words });
    expect(placement).toMatchObject({ line: "under", top: 206 });
  });

  it("lies over the fewest words where every place would lie over some", () => {
    const words: Rect[] = [
      { left: 40, top: 160, right: 400, bottom: 192 },
      { left: 210, top: 210, right: 260, bottom: 225 },
    ];
    const placement = placeTag(tag({ beadX: 200, others: [150, 250] }), { ...room, words });
    expect(placement).toMatchObject({ line: "under", side: "left" });
  });

  it("wraps off the wire, on the roomier side, where no place holds it on one line", () => {
    const wide = { width: 400, height: 13 };
    const placement = placeTag(tag({ size: { wire: wide, off: wide } }), room);
    expect(placement).toMatchObject({ line: "over", side: "right", maxWidth: 400 - 117 });
    expect(placement.isCard).toBe(false);
  });

  it("tries the side it is asked to first, as a drag's keeps away from the hand", () => {
    const placement = placeTag(tag({ beadX: 250, prefer: "left" }), room);
    expect(placement).toMatchObject({ line: "wire", side: "left" });
  });

  it("stands on the ground beside its bead where nothing is in its way, never a card", () => {
    expect(placeTag(tag(), room).isCard).toBe(false);
    const words: Rect[] = [{ left: 40, top: 160, right: 400, bottom: 192 }];
    expect(placeTag(tag({ beadX: 200, others: [150, 250] }), { ...room, words }).isCard).toBe(
      false,
    );
  });

  it("is a card only where every place beside its bead would lie over something", () => {
    const words: Rect[] = [
      { left: 40, top: 160, right: 400, bottom: 192 },
      { left: 40, top: 205, right: 400, bottom: 230 },
    ];
    const placement = placeTag(tag({ beadX: 200, others: [150, 250] }), { ...room, words });
    expect(placement.isCard).toBe(true);
  });

  it("keeps off the hand on the curve: on the wire away from it, never under it", () => {
    const hand: Rect = { left: 228, top: 178, right: 272, bottom: 900 };
    // The curve crosses the wire where the hand holds it, 250, and the hand covers round it.
    const placement = placeTag(
      tag({ beadX: 200, others: [250], prefer: "left", lines: ["wire", "over"], avoid: [hand] }),
      room,
    );
    expect(placement).toMatchObject({ line: "wire", side: "left" });
    expect(placement.box.right).toBeLessThanOrEqual(hand.left);
  });

  it("keeps off a name placed before it", () => {
    const first = placeTag(tag(), room);
    const second = placeTag(tag({ beadX: 160, avoid: [first.box] }), room);
    // Apart, or touching by under a pixel: a line's edge, not its letters.
    const across =
      Math.min(first.box.right, second.box.right) - Math.max(first.box.left, second.box.left);
    const down =
      Math.min(first.box.bottom, second.box.bottom) - Math.max(first.box.top, second.box.top);
    expect(across <= 1 || down <= 1).toBe(true);
    expect(second.isCard).toBe(false);
  });

  it("stands clear of a bead's ring where it passes one over the wire, and close elsewhere", () => {
    const rings = { at: [200, 240], reach: 10 };
    // Over the wire to the right of its bead, it passes the bead at 240: clear of its ring.
    const passing = placeTag(tag({ beadX: 200, lines: ["over"], rings }), room);
    expect(passing.box.bottom).toBe(200 - 11);
    // To the left of a bead with none beyond it, as close as a row's words stand.
    const alone = placeTag(
      tag({ beadX: 380, lines: ["over"], prefer: "left", rings: { at: [380], reach: 10 } }),
      room,
    );
    expect(alone.box.bottom).toBe(200 - 6);
  });

  it("wraps onto two lines beside its bead before it gives up its bead's side", () => {
    const wide = { width: 300, height: 21 };
    const placement = placeTag(
      tag({ beadX: 200, size: { wire: wide, off: wide }, lines: ["over", "under"] }),
      room,
    );
    expect(placement.isCard).toBe(false);
    expect(placement.box.bottom - placement.box.top).toBe(21 + (21 - 2));
  });

  it("is a card centred on its bead where nothing beside it holds it even on two lines", () => {
    const widest = { width: 900, height: 21 };
    const placement = placeTag(
      tag({ beadX: 200, size: { wire: widest, off: widest }, lines: ["over", "under"] }),
      room,
    );
    expect(placement).toMatchObject({ isCard: true, edge: 40, maxWidth: 360 });
  });

  it("stands further over the wire where it is asked to, past a fingertip", () => {
    const placement = placeTag(
      tag({ beadX: 200, others: [150, 250], lines: ["wire", "over"], overGap: 22 }),
      room,
    );
    expect(placement.top).toBe(200 - 22 - 21);
  });
});
