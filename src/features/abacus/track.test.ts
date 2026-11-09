import { describe, expect, it } from "vitest";
import { curveAt, sampleCurve } from "./curve";
import { presentTrack, samplesWithin, sampleTrack, trackAt, type TrackPoint } from "./track";

const MIDS = [480, 560, 660, 780];
const LEVELS = [0, 3, 1, 4];

function trackOf(levels: readonly number[], last?: Partial<TrackPoint>): TrackPoint[] {
  return levels.map((energy, index) => ({
    mid: MIDS[index]!,
    energy,
    grown: 1,
    eased: 1,
    ...(index === levels.length - 1 ? last : {}),
  }));
}

describe("the curve as stops join", () => {
  it("is the settled curve once every stop has joined", () => {
    const track = trackOf(LEVELS);

    for (let minutes = 480; minutes <= 780; minutes += 10) {
      expect(trackAt(track, minutes)).toBeCloseTo(curveAt(LEVELS, MIDS, minutes));
    }
    expect(sampleTrack(track)).toEqual(sampleCurve(LEVELS, MIDS));
  });

  it("keeps the drawn curve's shape at the moment a stop joins", () => {
    const before = trackOf(LEVELS.slice(0, 3));
    const joining = trackOf(LEVELS.slice(0, 4), { grown: 0, eased: 0 });

    for (let minutes = MIDS[0]!; minutes <= MIDS[2]!; minutes += 5) {
      expect(trackAt(joining, minutes)).toBeCloseTo(trackAt(before, minutes));
    }
    expect(sampleTrack(joining)).toEqual(sampleTrack(before));
  });

  it("eases the bend at the stop before as the new one joins", () => {
    const start = trackAt(trackOf(LEVELS, { eased: 0 }), 610);
    const halfway = trackAt(trackOf(LEVELS, { eased: 0.5 }), 610);
    const end = trackAt(trackOf(LEVELS, { eased: 1 }), 610);

    expect(halfway).toBeGreaterThan(Math.min(start, end));
    expect(halfway).toBeLessThan(Math.max(start, end));
  });

  it("grows the new stretch from the stop before along time", () => {
    const samples = sampleTrack(trackOf(LEVELS, { grown: 0.5 }));

    expect(samples.at(-1)?.minutes).toBeCloseTo((MIDS[2]! + MIDS[3]!) / 2);
    expect(
      samples.every((sample, index) => index === 0 || sample.minutes > samples[index - 1]!.minutes),
    ).toBe(true);
  });

  it("draws nothing past a stretch that is still growing, so it has no gaps", () => {
    const track = trackOf(LEVELS).map((point, index) =>
      index === 2 ? { ...point, grown: 0.4 } : point,
    );

    expect(sampleTrack(track).at(-1)?.minutes).toBeCloseTo(MIDS[1]! + (MIDS[2]! - MIDS[1]!) * 0.4);
  });

  it("draws nothing without a stop, and a single point for one", () => {
    expect(sampleTrack([])).toEqual([]);
    expect(sampleTrack(trackOf([2]))).toEqual([{ minutes: MIDS[0], energy: 2 }]);
  });
});

describe("the curve as a re-plan's stops join and leave among the others", () => {
  const withPresence = (present: readonly number[]): TrackPoint[] =>
    trackOf(LEVELS).map((point, index) => ({ ...point, present: present[index] ?? 1 }));

  it("draws the curve as it is while every stop is wholly on it", () => {
    const { track, from, to } = presentTrack(trackOf(LEVELS));

    expect(track).toEqual(trackOf(LEVELS));
    expect([from, to]).toEqual([null, null]);
  });

  it("lays a stop between two onto the curve through them, and raises it as it comes", () => {
    const through = trackAt(
      trackOf(LEVELS).filter((_, index) => index !== 2),
      MIDS[2]!,
    );
    const arriving = presentTrack(withPresence([1, 1, 0.001 + 1e-6, 1])).track;
    const half = presentTrack(withPresence([1, 1, 0.5, 1])).track;

    expect(arriving[2]?.energy).toBeCloseTo(through, 2);
    expect(half[2]?.energy).toBeCloseTo(through + (LEVELS[2]! - through) / 2, 5);
  });

  it("draws the curve out from the first stop that stays to one joining at the start", () => {
    const { from } = presentTrack(withPresence([0.25, 1, 1, 1]));

    expect(from).toBeCloseTo(MIDS[1]! - (MIDS[1]! - MIDS[0]!) / 4, 5);
  });

  it("takes the curve back from a stop leaving at the end", () => {
    const { to } = presentTrack(withPresence([1, 1, 1, 0.5]));

    expect(to).toBeCloseTo(MIDS[2]! + (MIDS[3]! - MIDS[2]!) / 2, 5);
  });

  it("drops a stop gone, with the curve's shape where it was a moment before", () => {
    const leaving = presentTrack(withPresence([0.002, 1, 1, 1]));
    const gone = presentTrack(withPresence([0, 1, 1, 1]));
    const drawnFrom = (cut: { track: TrackPoint[]; from: number | null; to: number | null }) =>
      samplesWithin(cut.track, sampleTrack(cut.track), cut.from, cut.to);

    expect(gone.track).toHaveLength(3);
    // From the first stop that stays on, the curve is the same to within a hair.
    for (const minutes of [600, 700, 760]) {
      expect(trackAt(leaving.track, minutes)).toBeCloseTo(trackAt(gone.track, minutes), 1);
    }
    expect(drawnFrom(leaving)[0]?.minutes).toBeCloseTo(drawnFrom(gone)[0]?.minutes ?? 0, 0);
  });

  it("lets a second stop onto the curve as drawn while the first still rises, its shape kept", () => {
    // Shoren-in still rising at 09:20; Awata let in at 10:20 beside it.
    const points = [480, 560, 620, 660, 780].map((mid, index): TrackPoint => ({
      mid,
      energy: [0, 3, 2, 1, 4][index]!,
      grown: 1,
      eased: 1,
      present: [1, 0.6, 0.001 + 1e-6, 1, 1][index],
    }));
    const before = presentTrack(points.filter((_, index) => index !== 2)).track;
    const after = presentTrack(points).track;

    for (let minutes = 490; minutes <= 770; minutes += 10) {
      expect(trackAt(after, minutes)).toBeCloseTo(trackAt(before, minutes), 2);
    }
    // On the curve where it comes, not at its own energy.
    expect(after[2]?.energy).toBeCloseTo(trackAt(before, 620), 2);
  });

  it("keeps a stop beside one joining at the start on the curve, rising from it", () => {
    const { track } = presentTrack(withPresence([0.5, 0.25, 1, 1]));
    const through = trackAt(presentTrack(withPresence([0.5, 0, 1, 1])).track, MIDS[1]!);

    expect(track[1]?.energy).toBeCloseTo(through + (LEVELS[1]! - through) / 4, 5);
  });

  it("keeps the curve past a stop growing among others, rather than cutting it there", () => {
    const growing = trackOf(LEVELS).map((point, index) =>
      index === 1 ? { ...point, grown: 0.3, eased: 0.3 } : point,
    );
    const { track } = presentTrack(growing);

    expect(sampleTrack(track).at(-1)?.minutes).toBe(MIDS[3]);
  });

  describe("with two old stops leaving at an end", () => {
    // 07:30 and 08:25 leave at the start, 18:00 and 19:30 at the end; 10:00 to 16:00 stay.
    const MIDS_OF_DAY = [450, 505, 600, 700, 820, 960, 1080, 1170];
    const LEVELS_OF_DAY = [0, 1, 2, 1, 3, 2, 4, 3];
    const dayOf = (leaving: number, joining?: { present: number }): TrackPoint[] => {
      const points = MIDS_OF_DAY.map((mid, index): TrackPoint => ({
        mid,
        energy: LEVELS_OF_DAY[index]!,
        grown: 1,
        eased: 1,
        present: index < 2 || index > 5 ? leaving : 1,
      }));
      // A new stop at 09:00, as a slow morning's.
      return joining
        ? [
            ...points.slice(0, 2),
            { mid: 540, energy: 2, grown: 1, eased: 1, isNew: true, ...joining },
            ...points.slice(2),
          ]
        : points;
    };

    it("draws the curve back to the first and last stops that stay, never to one leaving", () => {
      const { from, to } = presentTrack(dayOf(0.5));
      // Each leaving stop draws the curve half way out from where the one inside it reached.
      const reachedBy0825 = 600 - (600 - 505) / 2;
      const reachedBy1800 = 960 + (1080 - 960) / 2;

      expect(from).toBeCloseTo(reachedBy0825 - (reachedBy0825 - 450) / 2, 5);
      expect(to).toBeCloseTo(reachedBy1800 + (1170 - reachedBy1800) / 2, 5);
    });

    it("ends at those stops as the leaving ones go, with nothing left to move in a frame", () => {
      const leaving = presentTrack(dayOf(0.0011));
      const gone = presentTrack(dayOf(0.0009));

      expect(leaving.from).toBeCloseTo(600, 0);
      expect(leaving.to).toBeCloseTo(960, 0);
      expect(gone.from).toBeNull();
      expect(gone.to).toBeNull();
      expect(gone.track[0]?.mid).toBe(600);
      expect(gone.track.at(-1)?.mid).toBe(960);
    });

    it("keeps the start where it is as a new stop there comes whole", () => {
      const almost = presentTrack(dayOf(0.3, { present: 0.999 }));
      const whole = presentTrack(dayOf(0.3, { present: 1 }));

      expect(almost.from).toBeCloseTo(whole.from ?? 0, 0);
      // Come whole, the new stop draws the curve right to itself, and the old ones out from it.
      const reachedBy0825 = 540 - (540 - 505) * 0.3;
      expect(whole.from).toBeCloseTo(reachedBy0825 - (reachedBy0825 - 450) * 0.3, 5);
    });

    it("keeps the start where it is as an old stop coming back comes whole", () => {
      // A re-plan gone back: the walk at 08:25 back almost whole, the temple at 07:30 coming.
      const coming = (walk: number): TrackPoint[] =>
        dayOf(1).map((point) =>
          point.mid === 505
            ? { ...point, present: walk }
            : point.mid === 450
              ? { ...point, present: 0.44 }
              : point,
        );

      expect(presentTrack(coming(0.999)).from).toBeCloseTo(presentTrack(coming(1)).from ?? 0, 0);
    });
  });
});
