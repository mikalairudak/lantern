// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALICANTE_ESCAPED_DAY } from "@/lib/fixtures/live/escaped-days";
import { searchRecordedPlaces } from "@/lib/fixtures/places/coverage-responses";
import {
  AREA_LUNCH_DAY,
  AREA_LUNCH_STOP_INDEX,
  CAMPO_DE_OURIQUE_CORNER,
  MOURARIA_LUNCH,
  RAMIRO_DOOR,
  geocodeHandWrittenMeals,
  searchHandWrittenPlaces,
} from "@/lib/fixtures/places/meal-areas";
import type { GenerationRecord } from "@/lib/live/generation-log";
import type { GeoapifyClient, Lookup, LookupParams } from "@/lib/places/geoapify";
import type { DayRoundRun } from "./day-round";
import {
  daysToCheck,
  isVerified,
  placeReport,
  placesIn,
  placeTable,
  runPlaceChecks,
  type DayToCheck,
} from "./place-round";

const LISBON_REQUEST = AREA_LUNCH_DAY.request;
const LUNCH_OPTIONS =
  AREA_LUNCH_DAY.day.alternatives.find(({ stopIndex }) => stopIndex === AREA_LUNCH_STOP_INDEX)
    ?.options ?? [];
/** The mutation day-v3 forbids: a lunch named by one restaurant's door. */
const RAMIRO_LUNCH = {
  ...MOURARIA_LUNCH,
  name: "Cervejaria Ramiro",
  neighborhood: "Intendente",
  coordinates: RAMIRO_DOOR,
};
/** A coffee on a corner with one café, too few for the area check, whose count still shows. */
const ONE_CAFE = {
  ...MOURARIA_LUNCH,
  name: "Pastéis on Ferreira Borges",
  kind: "coffee",
  fare: "pastries and orange juice",
  neighborhood: "Campo de Ourique",
  coordinates: CAMPO_DE_OURIQUE_CORNER,
};
/** The written Lisbon day's first two sights: the recorded run confirms the second by name. */
const [FEIRA, MOSTEIRO] = AREA_LUNCH_DAY.day.stops.map(({ place }) => place);

/** A day as the model writes it, read as loosely as the checks read it: meals, a venue, sights. */
const DAY_TEXT = JSON.stringify({
  stops: [MOURARIA_LUNCH, RAMIRO_LUNCH, ONE_CAFE, FEIRA, MOSTEIRO].map((place) => ({ place })),
  alternatives: [{ stopIndex: 0, options: LUNCH_OPTIONS }],
});
const CUT_TEXT = DAY_TEXT.slice(0, 200);

function day(role: DayToCheck["role"], outputText: string): DayToCheck {
  return { index: 1, role, request: LISBON_REQUEST, outputText };
}

/** A meal's name from the hand-written answers, a sight's from the recorded run. */
const geocode: Lookup = async (params) => {
  const meal = await geocodeHandWrittenMeals(params);
  return meal.ok ? meal : searchRecordedPlaces(params);
};

/** The answers above, each lookup counted. */
function recordings(): { client: GeoapifyClient; asked: LookupParams[] } {
  const asked: LookupParams[] = [];
  return {
    asked,
    client: {
      geocode: (params) => {
        asked.push(params);
        return geocode(params);
      },
      places: (params) => {
        asked.push(params);
        return searchHandWrittenPlaces(params);
      },
    },
  };
}

describe("placesIn", () => {
  it("reads every place of a day, the stops' and then the options', where each stands", () => {
    const places = placesIn(JSON.stringify(AREA_LUNCH_DAY.day)) ?? [];
    const { stops, alternatives } = AREA_LUNCH_DAY.day;
    const lunchSet = alternatives.findIndex(({ stopIndex }) => stopIndex === AREA_LUNCH_STOP_INDEX);

    expect(places).toHaveLength(
      stops.length + alternatives.reduce((sum, { options }) => sum + options.length, 0),
    );
    expect(places[0]).toEqual({
      path: "stops[0].place",
      place: expect.objectContaining({ name: "Feira da Ladra", kind: "market" }),
    });
    expect(places).toContainEqual({
      path: `alternatives[${lunchSet}].options[0]`,
      place: expect.objectContaining({ name: "Prato do dia in Intendente", kind: "food" }),
    });
  });

  it("reads a name whose letters came escaped twice as the visitor is shown it", () => {
    const names = (placesIn(ALICANTE_ESCAPED_DAY.outputText) ?? []).map(({ place }) => place.name);

    expect(names).toContain("Castillo de Santa Bárbara");
    expect(names.filter((name) => name.includes("\\"))).toEqual([]);
  });

  it("reads no whole day from a stream cut short, and no place from one whose stops closed empty", () => {
    expect(placesIn(CUT_TEXT)).toBeNull();
    expect(placesIn(JSON.stringify({ stops: [], alternatives: [] }))).toEqual([]);
  });

  it("leaves out a place it cannot read", () => {
    const text = JSON.stringify({
      stops: [{ place: { name: "Rua da Atalaia", kind: "bar" } }, { place: MOURARIA_LUNCH }],
      alternatives: [],
    });

    expect(placesIn(text)?.map(({ path }) => path)).toEqual(["stops[1].place"]);
  });
});

describe("runPlaceChecks", () => {
  it("checks a meal by its area and its name, any other place by its name, and keeps every answer", async () => {
    const { client, asked } = recordings();
    const seen: string[] = [];

    const round = await runPlaceChecks(client, [day("day", DAY_TEXT)], {
      maxLookups: 100,
      onCheck: ({ place }) => seen.push(place.name),
    });

    expect(
      round.checks.map((check) => [
        check.place.name,
        check.isMeal,
        check.placesAround,
        check.matchedName,
        check.venue,
        isVerified(check),
      ]),
    ).toEqual([
      ["Grilled fish in Mouraria", true, 6, null, null, true],
      ["Cervejaria Ramiro", true, 4, null, { field: "name", venue: "Cervejaria Ramiro" }, true],
      ["Pastéis on Ferreira Borges", true, 1, null, null, false],
      ["Feira da Ladra", false, null, null, null, false],
      ["Mosteiro de São Vicente de Fora", false, null, "Museu de São Vicente de Fora", null, true],
      ["Prato do dia in Intendente", true, 4, null, null, true],
      ["Seafood off Rossio", true, 8, null, null, true],
    ]);
    expect(seen).toEqual(round.checks.map(({ place }) => place.name));
    expect(asked).toHaveLength(12);
    const [mouraria, , cafe, feira] = round.checks;
    expect(mouraria?.area).toMatchObject({ kind: "verified", by: "area", placesAround: 6 });
    expect(mouraria?.byName).toEqual({ kind: "unverified", reason: "no-match" });
    expect(mouraria?.lookups.map(({ endpoint }) => endpoint).sort()).toEqual(["geocode", "places"]);
    expect(mouraria?.lookups.find(({ endpoint }) => endpoint === "places")?.answer).toMatchObject({
      ok: true,
      body: { type: "FeatureCollection" },
    });
    expect(cafe?.area).toEqual({ kind: "unverified", reason: "too-few-places" });
    expect(feira).toMatchObject({ area: null, byName: { kind: "unverified", reason: "no-match" } });
    expect(feira?.lookups.map(({ endpoint }) => endpoint)).toEqual(["geocode"]);
  });

  // day-v4: a meal's lines keep to its street, so one of the places around it named in them is
  // the venue its name left out.
  it("reads a meal's lines for a venue among the places around it", async () => {
    const tascaInSummary = {
      ...MOURARIA_LUNCH,
      summary: "Grilled fish at Tasca do Largo by one, then the stew of the day.",
    };
    const text = JSON.stringify({ stops: [{ place: tascaInSummary }], alternatives: [] });

    const round = await runPlaceChecks(recordings().client, [day("day", text)], {
      maxLookups: 100,
    });

    expect(round.checks.map(({ venue }) => venue)).toEqual([
      { field: "summary", venue: "Tasca do Largo" },
    ]);
  });

  it("says which days had no whole day to read, and stops at the cap", async () => {
    const { client, asked } = recordings();

    const round = await runPlaceChecks(client, [day("day", DAY_TEXT), day("shadow", CUT_TEXT)], {
      maxLookups: 5,
    });

    expect(round.checks.map(({ place }) => place.name)).toEqual([
      "Grilled fish in Mouraria",
      "Cervejaria Ramiro",
      "Feira da Ladra",
    ]);
    expect(round.unchecked).toBe(4);
    expect(round.unread).toEqual([{ index: 1, role: "shadow" }]);
    expect(asked).toHaveLength(5);
  });
});

describe("the places' report", () => {
  it("says how many the route would verify, the counts around the meals, and the venues named", async () => {
    const round = await runPlaceChecks(
      recordings().client,
      [day("day", DAY_TEXT), day("shadow", CUT_TEXT)],
      { maxLookups: 100 },
    );

    const report = placeReport(round);

    expect(report[1]).toBe(
      "  7 in the days (5 meals), 0 in the shadows (0 meals); 12 lookups, 3 failed; no whole day to read in shadow 1.",
    );
    expect(report.slice(3, 6)).toEqual([
      "             all           stops         options        by name       meals by area",
      "    days     5 of 7 (71%)  3 of 5 (60%)  2 of 2 (100%)  1 of 2 (50%)  4 of 5 (80%)",
      "    shadows  0 of 0        0 of 0        0 of 0         0 of 0        0 of 0",
    ]);
    expect(report[6]).toBe("  Left unverified by name: days no-match 1; shadows none.");
    expect(report[7]).toContain("within 240 m");
    expect(report.slice(8, 11)).toEqual([
      "    places   0  1–2  3–5  6–10  11–19  20  failed",
      "    days     0  1    2    2     0      0   0",
      "    shadows  0  0    0    0     0      0   0",
    ]);
    expect(report[11]).toContain("1 of 5 in the days, 0 of 0 in the shadows");
    expect(report[12]).toBe(
      '    day 1 · Lisbon · stops[1].place · food "Cervejaria Ramiro" → "Cervejaria Ramiro" in name',
    );
    expect(report[13]).toMatch(/^  Names written without an accent Geoapify gives them/);
    expect(report.at(-1)).toBe("  Left plain: none.");
    expect(report).toHaveLength(20);
  });

  // The `day-v5` round: Sonnet wrote "Sao" where Geoapify writes "São".
  it("counts the names and quarters written without an accent Geoapify gives them", async () => {
    const plain = {
      ...MOSTEIRO,
      name: "Mosteiro de Sao Vicente de Fora",
      neighborhood: "Sao Vicente",
    };
    const text = JSON.stringify({
      stops: [{ place: MOSTEIRO }, { place: plain }],
      alternatives: [],
    });
    const round = await runPlaceChecks(recordings().client, [day("day", text)], {
      maxLookups: 100,
    });

    const report = placeReport(round);
    expect(report.slice(-5)).toEqual([
      "  Names written without an accent Geoapify gives them, of those with a word it writes accented (a macron alone is English's to drop):",
      "                    all           days with one  Lisbon",
      "    days, names     1 of 2 (50%)  1 of 1         1 of 2 (50%)",
      "    days, quarters  1 of 2 (50%)  1 of 1         1 of 2 (50%)",
      "  Left plain: Sao → São.",
    ]);
    // A round checks its days alone, so its report lists no shadow it never checked.
    expect(report.join("\n")).not.toContain("shadow");
  });

  it("says when the cap left places unchecked", async () => {
    const round = await runPlaceChecks(recordings().client, [day("day", DAY_TEXT)], {
      maxLookups: 2,
    });

    expect(placeReport(round)[1]).toContain("6 places left unchecked past the cap of 2 lookups");
  });

  it("lists every place for a reader to mark, with what each rule said", async () => {
    const round = await runPlaceChecks(recordings().client, [day("day", DAY_TEXT)], {
      maxLookups: 100,
    });

    const rows = placeTable(round);

    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatch(/^#\s+role\s+city\s+where\s+kind\s+name\s+neighbourhood\s+places/);
    expect(rows[1]).toMatch(/Grilled fish in Mouraria.*6\s+verified\s+no venue$/);
    expect(rows[2]).toMatch(/Cervejaria Ramiro.*4\s+verified\s+venue "Cervejaria Ramiro" in name$/);
    expect(rows[3]).toMatch(/Pastéis on Ferreira Borges.*1\s+too-few-places\s+no venue$/);
    expect(rows[4]).toMatch(/Feira da Ladra\s+São Vicente\s+no-match$/);
    expect(rows[5]).toMatch(
      /Mosteiro de São Vicente de Fora.*verified "Museu de São Vicente de Fora"$/,
    );
  });
});

describe("daysToCheck", () => {
  const record = (role: GenerationRecord["role"]) =>
    ({ role, outputText: `${role} text` }) as GenerationRecord;
  const runs = [
    { index: 1, body: LISBON_REQUEST, day: record("day"), shadow: record("shadow") },
    { index: 2, body: LISBON_REQUEST, day: null, shadow: null },
    { index: 3, body: LISBON_REQUEST, day: record("day"), shadow: null },
  ] as DayRoundRun[];

  // Every lookup comes out of the day's credits production shares, and a shadow's took two fifths.
  it("takes each day a round wrote, never its shadow, and nothing from a request not sent", () => {
    expect(daysToCheck(runs)).toEqual([
      { index: 1, role: "day", request: LISBON_REQUEST, outputText: "day text" },
      { index: 3, role: "day", request: LISBON_REQUEST, outputText: "day text" },
    ]);
  });

  it("takes each shadow after its day when a round compares the models", () => {
    expect(daysToCheck(runs, "both")).toEqual([
      { index: 1, role: "day", request: LISBON_REQUEST, outputText: "day text" },
      { index: 1, role: "shadow", request: LISBON_REQUEST, outputText: "shadow text" },
      { index: 3, role: "day", request: LISBON_REQUEST, outputText: "day text" },
    ]);
  });

  it("takes nothing when another round has measured the places", () => {
    expect(daysToCheck(runs, "none")).toEqual([]);
  });

  it("takes the shadows alone for a round that tries the shadow in another setting", () => {
    expect(daysToCheck(runs, "shadows")).toEqual([
      { index: 1, role: "shadow", request: LISBON_REQUEST, outputText: "shadow text" },
    ]);
  });
});
