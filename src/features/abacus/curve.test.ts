import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import {
  bendCurve,
  byEnergy,
  candidatesOf,
  curveAt,
  energyOf,
  hintStop,
  isAsWritten,
  keyStepOf,
  midOf,
  midsOf,
  modelPicks,
  pickAll,
  pickCandidate,
  pullGain,
  restingCurve,
  sampleCurve,
  shownPlacesOf,
  SWITCH_MARGIN,
  stepEnergy,
  switchingLevel,
  twinRankOf,
  versionOf,
} from "./curve";

const STOPS = ABACUS_DAY.stops;
const MIDS = midsOf(STOPS);
const PRIMARIES = STOPS.map(() => 0);
/** Drags a hand makes at a stop, quieter and livelier, short and long, in energy levels. */
const DRAGS_IN_LEVELS = [-2, -1.2, -0.7, 0.7, 1.2, 2];

describe("switchingLevel", () => {
  it("pulls a stop just past the midpoint to its next version, by the margin and a little", () => {
    const level = switchingLevel([1, 0, 3], 1, 3);

    expect(level).toBeGreaterThan(2 + SWITCH_MARGIN / 2);
    expect(level).toBeLessThan(3);
    expect(pickCandidate([1, 0, 3], level, 0, SWITCH_MARGIN)).toBe(2);
  });

  it("measures from the version before the target when the pull passes others", () => {
    const level = switchingLevel([0, 1, 3], 0, 3);

    expect(pickCandidate([0, 1, 3], level, 0, SWITCH_MARGIN)).toBe(2);
    expect(switchingLevel([3, 1, 0], 3, 0)).toBeLessThan(0.5);
  });

  it("leaves a stop where it is when it already shows the target", () => {
    expect(switchingLevel([1, 0, 3], 1, 1)).toBe(1);
  });
});

describe("candidates", () => {
  it("lists the primary first, then its alternatives", () => {
    const names = candidatesOf(STOPS[1]!).map((place) => place.name);

    expect(names).toEqual(["Barrio de Santa Cruz", "Basílica de Santa María", "Calle Mayor"]);
  });

  it("reads energy as a level from 0, reflective, to 4, social", () => {
    expect(energyOf(STOPS[0]!.primary)).toBe(0);
    expect(energyOf(STOPS[7]!.primary)).toBe(4);
  });

  it("puts a stop on the curve at the middle of its time", () => {
    expect(MIDS[0]).toBe(7 * 60 + 45 + 22.5);
    expect(midOf(STOPS, STOPS[3]!)).toBe(MIDS[3]);
  });

  it("counts a stop after midnight on from the late evening, not from the morning", () => {
    const night = [
      { id: "dinner", startTime: "21:00", durationMinutes: 120 },
      { id: "bar", startTime: "23:15", durationMinutes: 90 },
      { id: "club", startTime: "01:00", durationMinutes: 180 },
    ];

    expect(midsOf(night)).toEqual([22 * 60, 23 * 60 + 15 + 45, 25 * 60 + 90]);
    expect(midOf(night, night[2]!)).toBe(25 * 60 + 90);
  });

  it("keeps an early start in the morning when the day before it ended early", () => {
    const early = [{ id: "sunrise", startTime: "05:30", durationMinutes: 60 }];

    expect(midsOf(early)).toEqual([6 * 60]);
  });
});

describe("pickCandidate", () => {
  it("picks the candidate nearest to the desired energy", () => {
    expect(pickCandidate([1, 0, 2], 1.8, 0)).toBe(2);
    expect(pickCandidate([1, 0, 2], 0.2, 0)).toBe(1);
  });

  it("keeps what the stop shows on a tie", () => {
    expect(pickCandidate([2, 1, 3], 2.5, 2)).toBe(2);
    expect(pickCandidate([2, 1, 3], 2.5, 0)).toBe(0);
  });

  it("holds what it shows until another candidate is clearly nearer", () => {
    expect(pickCandidate([1, 0, 2], 1.55, 0, 0.2)).toBe(0);
    expect(pickCandidate([1, 0, 2], 1.75, 0, 0.2)).toBe(2);
    expect(pickCandidate([1, 0, 2], 1.45, 2, 0.2)).toBe(2);
  });

  it("prefers the primary to a same-energy version it does not show", () => {
    expect(pickCandidate([2, 2, 3], 2, 0)).toBe(0);
    expect(pickCandidate([2, 3, 2], 2.1, 1)).toBe(0);
  });
});

describe("the curve", () => {
  it("rests on the energy of what each stop shows", () => {
    expect(restingCurve(STOPS, PRIMARIES)).toEqual([0, 1, 2, 3, 1, 0, 2, 4]);
    expect(restingCurve(STOPS, [1, 0, 0, 0, 0, 0, 0, 0])[0]).toBe(1);
  });

  it("moves only the stop it is pulled at, never its neighbours", () => {
    const base = restingCurve(STOPS, PRIMARIES);

    const bent = bendCurve(base, MIDS, MIDS[4]!, -1);

    expect(bent[4]).toBeCloseTo(0);
    bent.forEach((energy, index) => {
      if (index !== 4) expect(energy).toBe(base[index]);
    });
  });

  it("moves the two stops around a pull between them, the nearer one more", () => {
    const base = restingCurve(STOPS, PRIMARIES);
    const aQuarterAlong = MIDS[3]! + (MIDS[4]! - MIDS[3]!) / 4;

    const bent = bendCurve(base, MIDS, aQuarterAlong, -1);

    expect(bent[3]).toBeCloseTo(base[3]! - 0.75);
    expect(bent[4]).toBeCloseTo(base[4]! - 0.25);
    bent.forEach((energy, index) => {
      if (index !== 3 && index !== 4) expect(energy).toBe(base[index]);
    });
  });

  it("moves only the first stop when pulled before it, and the last after it", () => {
    const base = restingCurve(STOPS, PRIMARIES);

    const early = bendCurve(base, MIDS, MIDS[0]! - 30, 1);
    const late = bendCurve(base, MIDS, MIDS[7]! + 30, -1);

    expect(early[0]).toBeCloseTo(base[0]! + 1);
    expect(early.slice(1)).toEqual(base.slice(1));
    expect(late[7]).toBeCloseTo(base[7]! - 1);
    expect(late.slice(0, 7)).toEqual(base.slice(0, 7));
  });

  it("stays between reflective and social", () => {
    const base = restingCurve(STOPS, PRIMARIES);

    expect(Math.min(...bendCurve(base, MIDS, MIDS[0]!, -3))).toBe(0);
    expect(Math.max(...bendCurve(base, MIDS, MIDS[7]!, 3))).toBe(4);
  });

  it("never changes the curve it bends", () => {
    const base = restingCurve(STOPS, PRIMARIES);
    const copy = [...base];

    bendCurve(base, MIDS, MIDS[3]!, 2);

    expect(base).toEqual(copy);
  });

  it("passes through every stop and stays on the scale between them", () => {
    const curve = [0, 4, 0, 4, 0, 4, 0, 4];

    MIDS.forEach((mid, index) => expect(curveAt(curve, MIDS, mid)).toBeCloseTo(curve[index]!));
    sampleCurve(curve, MIDS).forEach(({ energy }) => {
      expect(energy).toBeGreaterThanOrEqual(0);
      expect(energy).toBeLessThanOrEqual(4);
    });
  });

  it("stays level between two stops at the same energy instead of bulging", () => {
    const curve = [0, 1, 2, 3, 3, 1, 2, 4];
    const between = (MIDS[3]! + MIDS[4]!) / 2;

    expect(curveAt(curve, MIDS, between)).toBeCloseTo(3);
  });

  it("never swings past the stops on either side", () => {
    const curve = [0, 1, 2, 3, 1, 0, 2, 4];

    sampleCurve(curve, MIDS).forEach(({ minutes, energy }) => {
      const next = MIDS.findIndex((mid) => mid > minutes);
      if (next <= 0) return;
      const low = Math.min(curve[next - 1]!, curve[next]!);
      const high = Math.max(curve[next - 1]!, curve[next]!);
      expect(energy).toBeGreaterThanOrEqual(low - 1e-9);
      expect(energy).toBeLessThanOrEqual(high + 1e-9);
    });
  });

  it("holds its end values before the first stop and after the last", () => {
    const curve = restingCurve(STOPS, PRIMARIES);

    expect(curveAt(curve, MIDS, 0)).toBe(0);
    expect(curveAt(curve, MIDS, 24 * 60)).toBe(4);
  });
});

describe("reading a stop", () => {
  it("names a version by its energy against the place the model selected", () => {
    const lunch = STOPS[4]!;
    const [monastrell, taberna] = lunch.alternatives;
    const plannedAsTaberna = { ...lunch, selectedPlaceId: taberna!.id };

    expect(versionOf(lunch, lunch.primary)).toBe("the original");
    expect(versionOf(lunch, monastrell!)).toBe("quieter");
    expect(versionOf(lunch, taberna!)).toBe("livelier");
    expect(versionOf(plannedAsTaberna, lunch.primary)).toBe("quieter");
    expect(versionOf(lunch, { ...lunch.primary, id: "twin" })).toBe("same energy");
  });

  it("starts from the place the model selected, not always the primary", () => {
    const lunch = STOPS[4]!;
    const day = STOPS.map((stop) =>
      stop === lunch ? { ...stop, selectedPlaceId: lunch.alternatives[1]!.id } : stop,
    );

    expect(modelPicks(day)).toEqual([0, 0, 0, 0, 2, 0, 0, 0]);
  });

  it("steps to the next or the furthest version in either direction", () => {
    const lunch = STOPS[4]!;

    expect(stepEnergy(lunch, 0, "quieter")).toBe(0);
    expect(stepEnergy(lunch, 0, "livelier")).toBe(3);
    expect(stepEnergy(lunch, 2, "liveliest")).toBeNull();
    expect(stepEnergy(lunch, 2, "quietest")).toBe(0);
    expect(stepEnergy(STOPS[0]!, 0, "quieter")).toBeNull();
  });

  it("invites the first drag at a stop with room both ways, near the middle of the day", () => {
    expect(hintStop(STOPS)).toBe(4);
  });

  it("orders a stop's versions from quietest to liveliest, ties in the model's order", () => {
    const lunch = STOPS[4]!;
    const twin = { ...lunch.primary, id: "twin", name: "Dársena, inside" };
    const withTwin = { ...lunch, alternatives: [...lunch.alternatives, twin] };

    expect(byEnergy(lunch).map(({ place }) => place.name)).toEqual([
      "Arroz a banda by the port",
      "Paella on the marina",
      "Tapas on San Fernando",
    ]);
    expect(byEnergy(withTwin).map(({ index }) => index)).toEqual([1, 0, 3, 2]);
  });
});

describe("pulling the curve", () => {
  it("reaches the curve fully at a stop and less between two", () => {
    const between = (MIDS[3]! + MIDS[4]!) / 2;

    expect(pullGain(MIDS, MIDS[4]!)).toBeCloseTo(1);
    expect(pullGain(MIDS, between)).toBeLessThan(1);
    expect(pullGain(MIDS, between)).toBeGreaterThanOrEqual(0.5);
  });

  it("stays finite when two stops share a minute, as they can mid-stream", () => {
    const mids = [600, 600, 700];

    expect(Number.isFinite(curveAt([1, 3, 2], mids, 650))).toBe(true);
    sampleCurve([1, 3, 2], mids).forEach(({ energy }) =>
      expect(Number.isFinite(energy)).toBe(true),
    );
  });
});

describe("pickAll", () => {
  it("swaps the afternoon for quieter versions when the curve is pulled down there", () => {
    const base = restingCurve(STOPS, PRIMARIES);
    const quieter = bendCurve(base, MIDS, MIDS[4]!, -1);

    const picks = pickAll(STOPS, quieter, PRIMARIES);
    const names = picks.map((pick, index) => candidatesOf(STOPS[index]!)[pick]!.name);

    expect(names[4]).toBe("Arroz a banda by the port");
    expect(names[0]).toBe("Playa del Postiguet");
  });

  it("leaves a stop alone when it has nothing further along the scale", () => {
    const base = restingCurve(STOPS, PRIMARIES);
    const quieter = bendCurve(base, MIDS, MIDS[0]!, -2);

    expect(pickAll(STOPS, quieter, PRIMARIES)[0]).toBe(0);
  });

  it("swaps only the stop dragged on its wire, in a day whose stops are an hour apart", () => {
    const written = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
    if (!written.ok) throw new Error(written.reason);
    const kyoto = written.itinerary.stops;
    const mids = midsOf(kyoto);
    const shown = modelPicks(kyoto);
    const base = restingCurve(kyoto, shown);

    kyoto.forEach((_, dragged) => {
      DRAGS_IN_LEVELS.forEach((levels) => {
        const bent = bendCurve(base, mids, mids[dragged]!, levels);
        const picks = pickAll(kyoto, bent, shown, SWITCH_MARGIN);
        picks.forEach((pick, index) => {
          if (index !== dragged) expect(pick).toBe(shown[index]);
        });
      });
    });
  });
});

describe("twins: two versions at one energy", () => {
  const place = (id: string, energy: "calm" | "social") => ({ id, sensory: { energy } });
  /** A bar and a second bar at the same, liveliest energy, and a calmer one. */
  const BARS = {
    id: "bars",
    startTime: "13:00",
    durationMinutes: 75,
    primary: place("xampanyet", "social"),
    alternatives: [place("cal-pep", "social"), place("quiet", "calm")],
    selectedPlaceId: "xampanyet",
  };

  it("counts the versions before one that share its energy", () => {
    expect([0, 1, 2].map((index) => twinRankOf(BARS, index))).toEqual([0, 1, 0]);
  });

  it("reaches the twin with a key, as the curve cannot", () => {
    // Twins at the lively end run inward, so the twin is the next bead quieter.
    expect(keyStepOf(BARS, 0, "quieter")).toEqual({ kind: "version", index: 1 });
    expect(keyStepOf(BARS, 1, "livelier")).toEqual({ kind: "version", index: 0 });
  });

  it("pulls the curve past the twin to the next energy", () => {
    expect(keyStepOf(BARS, 1, "quieter")).toEqual({ kind: "energy", energy: 1 });
    expect(keyStepOf(BARS, 0, "livelier")).toBeNull();
    expect(keyStepOf(BARS, 0, "quietest")).toEqual({ kind: "energy", energy: 1 });
  });
});

describe("isAsWritten", () => {
  const stops = ABACUS_DAY.stops;
  const planned = stops.map(() => 0);
  const swapped = stops.findIndex((stop) => stop.alternatives.length > 0);
  const withVersion = planned.map((pick, index) => (index === swapped ? 1 : pick));

  it("reads a day as written while every stop shows its primary place", () => {
    expect(isAsWritten(stops, planned)).toBe(true);
    expect(isAsWritten([], [])).toBe(true);
  });

  it("reads it changed once one stop shows a version, by a swap, a drag or the energy word", () => {
    expect(isAsWritten(stops, withVersion)).toBe(false);
    expect(
      isAsWritten(
        stops,
        modelPicks(stops).map(() => 1),
      ),
    ).toBe(false);
  });

  it("reads a line written again around a version kept through a re-plan as that day's", () => {
    // The line came while the stop showed its version: that is the place it names.
    const written = shownPlacesOf(stops, withVersion);
    expect(isAsWritten(stops, withVersion, written)).toBe(true);
    expect(isAsWritten(stops, planned, written)).toBe(false);
  });

  it("names each stop's shown place by its id", () => {
    const shown = shownPlacesOf(stops, withVersion);
    expect(shown[stops[swapped]!.id]).toBe(stops[swapped]!.alternatives[0]!.id);
    expect(shown[stops[0]!.id === stops[swapped]!.id ? stops[1]!.id : stops[0]!.id]).toMatch(/:p$/);
  });
});
