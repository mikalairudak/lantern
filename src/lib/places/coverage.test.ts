import { describe, expect, it } from "vitest";
import { COVERAGE_RUN, KNOWN_WRONG_MATCHES } from "@/lib/fixtures/places/coverage-run";
import { recordedNameVerifier } from "@/lib/fixtures/places/coverage-responses";
import { isAreaKind } from "@/lib/schema/itinerary.schema";

const CITIES = ["Kyoto", "Alicante", "Lisbon"] as const;

async function verdicts() {
  return Promise.all(
    COVERAGE_RUN.map(async (lookup) => {
      const check = await recordedNameVerifier.verify(lookup.place, { city: lookup.city });
      return { ...lookup, isConfirmed: check.kind === "verified" };
    }),
  );
}

function countByCity(entries: readonly { city: string }[]): Record<string, number> {
  return Object.fromEntries(
    CITIES.map((city) => [city, entries.filter((entry) => entry.city === city).length]),
  );
}

// The acceptance measurement: the rule over Geoapify's recorded answers for the written days.
describe("the name rule over the recorded coverage run", () => {
  it("holds the 66 places of the written days", () => {
    expect(COVERAGE_RUN).toHaveLength(66);
    expect(countByCity(COVERAGE_RUN)).toEqual({ Kyoto: 23, Alicante: 21, Lisbon: 22 });
  });

  it("reproduces the run's own count without the category: 46, Kyoto 14, Alicante 12, Lisbon 20", () => {
    const matched = COVERAGE_RUN.filter((lookup) => lookup.matchedByRun);
    expect(countByCity(matched)).toEqual({ Kyoto: 14, Alicante: 12, Lisbon: 20 });
  });

  it("confirms 39 of the 66: Kyoto 11, Alicante 9, Lisbon 19", async () => {
    const confirmed = (await verdicts()).filter((verdict) => verdict.isConfirmed);
    expect(confirmed).toHaveLength(39);
    expect(countByCity(confirmed)).toEqual({ Kyoto: 11, Alicante: 9, Lisbon: 19 });
  });

  it("differs from the run where the category does not fit, or one shared word is not enough", async () => {
    const differing = (await verdicts())
      .filter((verdict) => verdict.isConfirmed !== verdict.matchedByRun)
      .map(({ place, isConfirmed }) => ({ name: place.name, isConfirmed }));

    expect(differing).toEqual([
      // A bicycle rental for a walk: one of the run's two wrong places.
      { name: "Gion Shirakawa", isConfirmed: false },
      // Geoapify files the museum as a bicycle rental.
      { name: "Kyoto City KYOCERA Museum of Art", isConfirmed: false },
      // The right lane as "Ishibei-koji": both names say two things and share only "koji", alley.
      { name: "Ishibe-koji", isConfirmed: false },
      // A walk found as a viewpoint inside the quarter.
      { name: "Barrio de Santa Cruz", isConfirmed: false },
      // A bar and a café that are streets: the day's kind is the street's, not the place's.
      { name: "Calle Castaños", isConfirmed: false },
      { name: "Plaza de Santa María", isConfirmed: false },
      // The cathedral comes back as a residential building.
      { name: "Sé de Lisboa", isConfirmed: false },
    ]);
  });

  // Since day-v3 a café, restaurant or bar is checked by the places around it, and the name
  // rule, run on one, says whether the model named a venue: the live pass's count of them.
  it("finds 12 of the written days' 22 named cafés, restaurants and bars, and none of their 3 squares and streets", async () => {
    const areas = ["Plaza de los Luceros", "Calle Castaños", "Plaza de Santa María"];
    const meals = (await verdicts()).filter(({ place }) => isAreaKind(place.kind));
    const confirmed = meals.filter(({ isConfirmed }) => isConfirmed).map(({ place }) => place.name);

    expect(meals).toHaveLength(25);
    expect(confirmed).toHaveLength(12);
    expect(confirmed.filter((name) => areas.includes(name))).toEqual([]);
    expect(countByCity(meals.filter(({ isConfirmed }) => isConfirmed))).toEqual({
      Kyoto: 5,
      Alicante: 1,
      Lisbon: 6,
    });
  });

  it("owes six of its 39 to letting a site with no category through", async () => {
    const uncategorised = (await verdicts())
      .filter((verdict) => verdict.isConfirmed && verdict.found?.category === null)
      .filter((verdict) => verdict.found?.resultType !== "street")
      .map(({ place }) => place.name);

    expect(uncategorised).toEqual([
      "Honen-in",
      "Philosopher's Path",
      "Ginkaku-ji Approach",
      "Konchi-in",
      "Panteão Nacional",
      "Igreja de São Roque",
    ]);
  });

  it("still confirms one wrong place of the two the run's audit found", async () => {
    const confirmed = (await verdicts())
      .filter((verdict) => verdict.isConfirmed)
      .map(({ place }) => place.name);

    expect(KNOWN_WRONG_MATCHES.filter((name) => confirmed.includes(name))).toEqual([
      "Taberna da Rua das Flores",
    ]);
  });

  it("verifies at the provider's point, not the model's", async () => {
    const [honenIn] = COVERAGE_RUN;
    const check = await recordedNameVerifier.verify(honenIn!.place, { city: "Kyoto" });

    expect(check).toMatchObject({ kind: "verified", lng: honenIn!.place.coordinates.lng });
    expect(check).not.toMatchObject({ lat: honenIn!.place.coordinates.lat });
  });

  it("fails a place the recording does not hold", async () => {
    const place = { ...COVERAGE_RUN[0]!.place, name: "Kinkaku-ji" };
    await expect(recordedNameVerifier.verify(place, { city: "Kyoto" })).resolves.toEqual({
      kind: "unverified",
      reason: "failed",
    });
  });
});
