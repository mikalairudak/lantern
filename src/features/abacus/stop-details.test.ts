import { describe, expect, it } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { detailsOf, lengthOf, skyOf, visitHoursOf } from "./stop-details";

const lunch = ABACUS_DAY.stops[4];
if (!lunch) throw new Error("The Alicante day has no lunch");
const CITY = "Alicante";

describe("lengthOf", () => {
  it("says a visit's length in hours and minutes, leaving out a zero", () => {
    expect([45, 60, 105, 480].map(lengthOf)).toEqual(["45 min", "1 h", "1 h 45 min", "8 h"]);
  });
});

describe("visitHoursOf", () => {
  it("runs the clock on past midnight as the next day's", () => {
    expect(visitHoursOf({ startTime: "23:30", durationMinutes: 90 })).toBe(
      "23:30–01:00 · 1 h 30 min",
    );
  });
});

describe("skyOf", () => {
  it("says which way a place faces only when the model knows", () => {
    const facing = { id: "a", light: { exposure: "open", orientation: "se" } } as const;
    const unknown = { id: "b", light: { exposure: "interior", orientation: null } } as const;

    expect(skyOf(facing)).toBe("open sky, faces south-east");
    expect(skyOf(unknown)).toBe("indoors");
  });

  it("says nothing before the exposure is written", () => {
    expect(skyOf({ id: "c" })).toBeNull();
  });
});

describe("detailsOf", () => {
  it("describes the planned place without a swap's reason", () => {
    const details = detailsOf(lunch, lunch.primary, CITY);

    expect(details).toMatchObject({
      hours: "14:00–15:45 · 1 h 45 min",
      neighborhood: "Puerto",
      swapReason: null,
      sound: "murmur",
      crowd: "steady",
      bestAt: "best at midday",
      sky: "roofed, open sides, faces south",
      // What a map is asked for it: a place to eat around, in the day's city.
      kind: "food",
      city: CITY,
    });
    expect(details.tags.length).toBeGreaterThan(0);
  });

  it("leads a swapped-in version with what it trades", () => {
    const livelier = lunch.alternatives.find((place) => place.name === "Tapas on San Fernando");
    if (!livelier) throw new Error("Lunch has no livelier version");

    expect(detailsOf(lunch, livelier, CITY).swapReason).toBe(livelier.reason);
  });

  it("says the quarter even when the name says it, which the row then leaves out", () => {
    const named = { ...lunch.primary, name: "Seafood paella in the Puerto" };

    expect(detailsOf(lunch, named, CITY).neighborhood).toBe("Puerto");
  });

  it("leaves the light's window out when light does not matter there", () => {
    const place = { ...lunch.primary, light: { ...lunch.primary.light, bestWindow: null } };

    expect(detailsOf(lunch, place, CITY).bestAt).toBeNull();
  });
});
