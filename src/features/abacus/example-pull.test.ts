import { describe, expect, it } from "vitest";
import type { Stop } from "@/lib/schema/itinerary.schema";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import {
  SWITCH_MARGIN,
  bendCurve,
  candidatesOf,
  energyOf,
  midOf,
  midsOf,
  modelPicks,
  pickAll,
  restingCurve,
} from "./curve";
import type { StopDraft } from "./day-draft";
import { examplePullAt, invitedStop } from "./example-pull";

const STOPS: readonly Stop[] = ABACUS_DAY.stops;
const LUNCH = 4;

/** What each stop shows after the curve is pulled as a drag would pull it. */
function shownAfterPull(stops: readonly Stop[], minutes: number, levels: number): string[] {
  const picks = modelPicks(stops);
  const bent = bendCurve(restingCurve(stops, picks), midsOf(stops), minutes, levels);
  return pickAll(stops, bent, picks, SWITCH_MARGIN).map(
    (pick, index) => candidatesOf(stops[index]!)[pick]?.name ?? "",
  );
}

function withoutVersions(stops: readonly Stop[], version: "quieter" | "livelier") {
  return stops.map((stop) => ({
    ...stop,
    alternatives: stop.alternatives.filter((place) =>
      version === "quieter"
        ? energyOf(place) >= energyOf(stop.primary)
        : energyOf(place) <= energyOf(stop.primary),
    ),
  }));
}

describe("invitedStop", () => {
  it("invites the first drag at lunch, the stop nearest midday with room either way", () => {
    expect(invitedStop(STOPS)).toBe(LUNCH);
  });

  it("keeps to the stops in view, nearest the middle of the day among them", () => {
    // On a phone only the morning is on the first screen: the beach has nothing quieter,
    // and of the two after it the castle is nearer midday.
    expect(invitedStop(STOPS, (index) => index < 3)).toBe(2);
    expect(
      examplePullAt(
        STOPS,
        invitedStop(STOPS, (index) => index < 3),
      )?.stopIndex,
    ).toBe(2);
  });

  it("takes a stop in view with a version one way when none has room both ways", () => {
    // The beach has nothing quieter, so the example pulls it livelier.
    expect(invitedStop(STOPS, (index) => index === 0)).toBe(0);
    expect(
      examplePullAt(
        STOPS,
        invitedStop(STOPS, (index) => index === 0),
      )?.levels,
    ).toBeGreaterThan(0);
  });

  it("invites where it would anyway when no stop is in view", () => {
    expect(invitedStop(STOPS, () => false)).toBe(LUNCH);
  });

  it("has no stop to invite to before any stop sits on the curve", () => {
    const unwritten: StopDraft[] = STOPS.map((stop) => ({
      ...stop,
      primary: { id: stop.primary.id },
      alternatives: [],
    }));

    expect(invitedStop([])).toBeNull();
    expect(invitedStop(unwritten)).toBeNull();
  });
});

describe("examplePullAt", () => {
  it("pulls lunch livelier at the middle of its time", () => {
    const plan = examplePullAt(STOPS, invitedStop(STOPS));

    expect(plan?.stopIndex).toBe(LUNCH);
    expect(plan?.minutes).toBe(midOf(STOPS, STOPS[LUNCH]!));
    expect(plan?.levels).toBeGreaterThan(0);
  });

  it("pulls just far enough to swap lunch to Tapas on San Fernando and nothing else", () => {
    const plan = examplePullAt(STOPS, invitedStop(STOPS));
    if (!plan) throw new Error("The day has no example pull");
    const planned = shownAfterPull(STOPS, plan.minutes, 0);

    const shown = shownAfterPull(STOPS, plan.minutes, plan.levels);

    expect(shown[LUNCH]).toBe("Tapas on San Fernando");
    expect(shown.filter((name, index) => name !== planned[index])).toEqual([
      "Tapas on San Fernando",
    ]);
  });

  it("pulls quieter when the stop has no livelier version", () => {
    const stops = withoutVersions(STOPS, "livelier");
    const plan = examplePullAt(stops, invitedStop(stops));
    if (!plan) throw new Error("The day has no example pull");

    expect(plan.levels).toBeLessThan(0);
    expect(shownAfterPull(stops, plan.minutes, plan.levels)[plan.stopIndex]).toBe(
      candidatesOf(stops[plan.stopIndex]!).find(
        (place) => energyOf(place) < energyOf(stops[plan.stopIndex]!.primary),
      )?.name,
    );
  });

  it("has no example when the stop has no other version, or there is no stop", () => {
    const stops = STOPS.map((stop) => ({ ...stop, alternatives: [] }));

    expect(examplePullAt(stops, invitedStop(stops))).toBeNull();
    expect(examplePullAt(STOPS, null)).toBeNull();
    expect(examplePullAt(STOPS, STOPS.length)).toBeNull();
  });
});
