import { describe, expect, it } from "vitest";
import { GOLDEN_INTAKES, GOLDEN_NOW } from "@/lib/fixtures/intake/golden";
import { searchWrittenPlaces } from "@/lib/fixtures/intake/places";
import { answerIntake } from "@/lib/intake/answer-intake";
import { MIDDLE_ENERGY } from "@/lib/normalizer/normalize-intake";
import type { GeneratedIntake } from "@/lib/schema/intake.schema";
import { DayRequestSchema } from "@/lib/schema/itinerary.schema";
import {
  INTAKE_CHECK_IDS,
  scoreIntakeCase,
  scoreIntakeSet,
  type IntakeCase,
  type IntakeCheckId,
  type IntakeRun,
} from "./intake-checks";

function caseNamed(name: string): IntakeCase {
  const golden = GOLDEN_INTAKES.find((each) => each.name === name);
  if (golden === undefined) throw new Error(`No golden intake named "${name}"`);
  return golden;
}

/** The case's recorded output, or a broken copy of it, run as the route will run it. */
async function runOf(
  golden: IntakeCase,
  changes: Partial<GeneratedIntake> = {},
): Promise<IntakeRun> {
  const output = { ...golden.recorded, ...changes };
  return {
    output,
    result: await answerIntake(output, searchWrittenPlaces, GOLDEN_NOW, undefined, golden.text),
  };
}

function findingsOf(golden: IntakeCase, run: IntakeRun, id: IntakeCheckId): string[] {
  return scoreIntakeCase(golden, run)[id].findings;
}

describe("the golden intakes", () => {
  it("reach every answer they expect through the resolver and the normalizer", async () => {
    const scores = await Promise.all(
      GOLDEN_INTAKES.map(async (golden) => scoreIntakeCase(golden, await runOf(golden))),
    );
    const results = scoreIntakeSet(scores);

    expect(results.flatMap(({ findings }) => findings)).toEqual([]);
    expect(results.every(({ passed }) => passed)).toBe(true);
    // Every check has something to say on the set, or it is not tested by it.
    INTAKE_CHECK_IDS.forEach((id) =>
      expect(
        scores.some((score) => score[id].total > 0),
        id,
      ).toBe(true),
    );
  });

  it("expect only requests the schema accepts", () => {
    for (const { name, accepts } of GOLDEN_INTAKES) {
      if (accepts.request === undefined) continue;
      const { city, timezone, date, words = {}, readings = [] } = accepts.request;
      const request = {
        city,
        citySource: readings.length > 0 ? "assumed" : "chosen",
        timezone,
        date,
        energy: words.energy?.[0] ?? MIDDLE_ENERGY,
        energySource: words.energySource?.[0] ?? "assumed",
        travel: words.travel ?? null,
        start: words.start ?? null,
        dinner: words.dinner ?? null,
        end: words.end ?? null,
        company: words.company ?? null,
      };
      expect(DayRequestSchema.safeParse(request).success, name).toBe(true);
    }
  });

  it("have unique names, so a finding points at one case", () => {
    const names = GOLDEN_INTAKES.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("scoreIntakeCase", () => {
  it("fails an output that is not an intake on its shape", async () => {
    const golden = caseNamed("city only");
    const run = { output: { city: 1 }, result: { kind: "unavailable" } as const };

    expect(findingsOf(golden, run, "shape")).toEqual(["city only: not an intake"]);
    expect(findingsOf(golden, run, "outcome")).toHaveLength(1);
  });

  it("fails hard on a day for a city the visitor did not name", async () => {
    const noCity = caseNamed("no city");
    const injected = caseNamed("an injection beside a city");

    expect(findingsOf(noCity, await runOf(noCity, { city: "Paris" }), "no-unnamed-city")).toEqual([
      "no city: a day for Paris, where the case accepts none",
    ]);
    expect(
      findingsOf(injected, await runOf(injected, { city: "Lisbon" }), "no-unnamed-city"),
    ).toEqual([
      "an injection beside a city: a day for Lisbon (Europe/Lisbon), not Paris (Europe/Paris)",
    ]);
  });

  it("fails hard on any day for a text the model should decline, its city named or not", async () => {
    const golden = caseNamed("buying drugs");
    const lisbon = await runOf(caseNamed("city only"));
    if (lisbon.result.kind !== "request")
      throw new Error("Expected the recorded Lisbon to be played");
    // The fixture geocoder knows no Amsterdam, so its day is Lisbon's moved there by hand.
    const amsterdam: IntakeRun = {
      result: {
        ...lisbon.result,
        request: { ...lisbon.result.request, city: "Amsterdam", timezone: "Europe/Amsterdam" },
      },
    };

    expect(findingsOf(golden, amsterdam, "no-unnamed-city")).toEqual([
      "buying drugs: a day for Amsterdam, where the case accepts none",
    ]);
    expect(findingsOf(golden, lisbon, "no-unnamed-city")).toEqual([
      "buying drugs: a day for Lisbon, where the case accepts none",
    ]);
  });

  it("tells apart two cities of one name by their zone", async () => {
    const golden = caseNamed("a dominant reading");
    const run = await runOf(golden);
    if (run.result.kind !== "request")
      throw new Error("Expected the recorded Portland to be played");
    const maine: IntakeRun = {
      result: { ...run.result, request: { ...run.result.request, timezone: "America/New_York" } },
    };

    expect(findingsOf(golden, maine, "no-unnamed-city")).toEqual([
      "a dominant reading: a day for Portland (America/New_York), not Portland (America/Los_Angeles)",
    ]);
  });

  it("counts a question where the text names one city as a needless one", async () => {
    const golden = caseNamed("city only");
    const run = await runOf(golden, { city: null });

    expect(findingsOf(golden, run, "outcome")).toEqual([
      'city only: question for "Lisbon", which accepts request',
    ]);
    expect(findingsOf(golden, run, "no-unnamed-city")).toEqual([]);
  });

  it("accepts a refusal only where the case does", () => {
    const refused: IntakeRun = { result: { kind: "refused" } };

    expect(findingsOf(caseNamed("an injection"), refused, "outcome")).toEqual([]);
    expect(findingsOf(caseNamed("buying drugs"), refused, "outcome")).toEqual([]);
    expect(findingsOf(caseNamed("city only"), refused, "outcome")).toHaveLength(1);
    expect(scoreIntakeCase(caseNamed("an injection"), refused).shape.total).toBe(0);
  });

  it("misses each city a question should offer and does not", async () => {
    const golden = caseNamed("a shared name");
    const run = await runOf(golden, { cityReadings: ["Springfield, Illinois"] });

    // The intake named no city, so one city found is still asked about, not played.
    expect(run.result.kind).toBe("question");
    expect(findingsOf(golden, run, "readings")).toEqual([
      "a shared name: no Springfield, Missouri among Springfield, Illinois, United States",
      "a shared name: no Springfield, Massachusetts among Springfield, Illinois, United States",
    ]);
  });

  // Asked to pick, Lantern suggests two or three cities; asked nothing, it suggests none.
  it("takes any two or three cities suggested where the text asks Lantern to pick, and misses one", async () => {
    const golden = caseNamed("a kind of place");
    const three = await runOf(golden);
    const one = await runOf(golden, { cityReadings: ["Valencia, Spain"] });

    expect(three.result.kind).toBe("question");
    expect(findingsOf(golden, three, "readings")).toEqual([]);
    expect(findingsOf(golden, one, "readings")).toEqual([
      "a kind of place: 1 cities suggested, not 2 to 3",
    ]);
  });

  it("misses cities offered where the case asks for a city with none to pick from", async () => {
    const golden = caseNamed("no city");
    const run = await runOf(golden, { cityReadings: ["Lisbon, Portugal", "Rome, Italy"] });

    expect(run.result.kind).toBe("question");
    expect(findingsOf(golden, run, "readings")).toEqual([
      "no city: offers Lisbon, Portugal; Rome, Lazio, Italy, where it should ask with none",
    ]);
  });

  it("fails hard on a day for a suggested city the visitor did not choose", async () => {
    const golden = caseNamed("pick for me");
    const run = await runOf(golden, { city: "Lisbon", cityReadings: [] });

    expect(findingsOf(golden, run, "no-unnamed-city")).toEqual([
      "pick for me: a day for Lisbon, where the case accepts none",
    ]);
  });

  it("misses a played city that offers none of the others its name could mean", async () => {
    const dominant = caseNamed("a dominant reading");

    expect(findingsOf(dominant, await runOf(dominant, { cityReadings: [] }), "readings")).toEqual([
      "a dominant reading: Portland as the visitor's, not Lantern's assumption",
      "a dominant reading: no Portland, Maine among no readings",
    ]);
  });

  // intake-v4 and v5 offered Porto and Coimbra beside "surprise me in Lisbon", and Lisbon was
  // played as Lantern's; the normalizer keeps only cities of the named one's name beside it.
  it("keeps a named city the visitor's when the intake writes other cities beside it", async () => {
    const cityOnly = caseNamed("city only");
    const run = await runOf(cityOnly, { cityReadings: ["Porto"] });

    expect(run.result).toMatchObject({ kind: "request", readings: [] });
    expect(run.result.kind === "request" && run.result.request.citySource).toBe("chosen");
    expect(findingsOf(cityOnly, run, "readings")).toEqual([]);
  });

  // intake-v5 said "un día en la montaña" back beside the cities it suggested for it.
  it("says nothing back from a question of cities Lantern suggested, and keeps a country's", async () => {
    const mountains = caseNamed("a kind of place, in Spanish");
    const country = caseNamed("a country");
    const suggested = await runOf(mountains, { unplaced: ["un día en la montaña"] });
    const asked = await runOf(country, { unplaced: ["vegetarian"] });

    expect(suggested.result).toMatchObject({ kind: "question", unplaced: [] });
    expect(asked.result).toMatchObject({ kind: "question", unplaced: ["vegetarian"] });
  });

  it("misses each word read wrong, an energy outside those accepted and a wrong date", async () => {
    const golden = caseNamed("a whole sentence");
    const run = await runOf(golden, {
      energyGuess: "social",
      company: "friends",
      date: "2026-11-15",
    });

    expect(findingsOf(golden, run, "words")).toEqual([
      "a whole sentence: energy social, not reflective or calm",
      "a whole sentence: company friends, not partner",
      "a whole sentence: date 2026-11-15, not 2026-11-22",
    ]);
  });

  it("scores the words a question keeps for the answer", async () => {
    const golden = caseNamed("no city");
    const run = await runOf(golden, { company: "family" });

    expect(findingsOf(golden, run, "words")).toEqual(["no city: company family, not friends"]);
  });

  it("misses an energy put in the wrong field, though the normalizer copes", async () => {
    const named = caseNamed("energy named");
    const unnamed = caseNamed("nothing to go on");

    expect(
      findingsOf(named, await runOf(named, { energy: null, energyGuess: "calm" }), "energy-source"),
    ).toEqual(["energy named: the energy the text names read as Lantern's"]);
    expect(
      findingsOf(unnamed, await runOf(unnamed, { energy: "balanced" }), "energy-source"),
    ).toEqual(["nothing to go on: balanced written as the visitor's, where the text names none"]);
    expect(
      findingsOf(named, await runOf(named, { energyGuess: "lively" }), "energy-source"),
    ).toEqual(["energy named: both an energy, calm, and a guess, lively"]);
  });

  it("takes either source where the case accepts both, and still misses both at once", async () => {
    const golden = caseNamed("a long, wandering text");
    const asTheVisitors = await runOf(golden, { energy: "calm", energyGuess: null });

    expect(findingsOf(golden, await runOf(golden), "energy-source")).toEqual([]);
    expect(findingsOf(golden, asTheVisitors, "energy-source")).toEqual([]);
    expect(findingsOf(golden, await runOf(golden, { energy: "calm" }), "energy-source")).toEqual([
      "a long, wandering text: both an energy, calm, and a guess, calm",
    ]);
  });

  it("accepts Portland asked about with both its cities, as well as played", async () => {
    const golden = caseNamed("a dominant reading");
    const asked = await runOf(golden, {
      city: null,
      cityReadings: ["Portland, Oregon", "Portland, Maine"],
    });

    expect(asked.result.kind).toBe("question");
    expect(findingsOf(golden, asked, "outcome")).toEqual([]);
    expect(findingsOf(golden, asked, "readings")).toEqual([]);
    expect(findingsOf(golden, await runOf(golden), "outcome")).toEqual([]);
  });

  it("misses a phrase the visitor should hear back, however it is worded", async () => {
    const golden = caseNamed("words outside the vocabulary");
    const reworded = await runOf(golden, { unplaced: ["My dog"] });

    expect(findingsOf(golden, reworded, "unplaced")).toEqual([
      'words outside the vocabulary: "vegetarian" not said back',
    ]);
  });

  it("fails hard on a phrase that is not about the day said back, the day otherwise right", async () => {
    const golden = caseNamed("following someone");
    // The first live pass's answer to this text, saved on 2026-10-29 and rescored at no cost.
    const live = await runOf(golden, { unplaced: ["following my ex without her noticing"] });
    const score = scoreIntakeCase(golden, live);

    expect(score.unsaid.findings).toEqual([
      'following someone: "following my ex without her noticing" said back, where nothing may be',
    ]);
    expect(
      INTAKE_CHECK_IDS.filter((id) => id !== "unsaid").flatMap((id) => score[id].findings),
    ).toEqual([]);
  });

  it("holds what is said back in a question too, and has nothing to read in a refusal", async () => {
    const golden = caseNamed("following someone");
    const asked = await runOf(golden, { city: null, unplaced: ["without her noticing"] });

    expect(asked.result.kind).toBe("question");
    expect(findingsOf(golden, asked, "unsaid")).toEqual([
      'following someone: "without her noticing" said back, where nothing may be',
    ]);
    expect(scoreIntakeCase(golden, { result: { kind: "refused" } }).unsaid.total).toBe(0);
  });

  it("holds a phrase about the day and one that is not apart, each on its own check", async () => {
    const golden = caseNamed("following someone, with a dog");
    const saidBoth = await runOf(golden, {
      unplaced: ["with my dog", "following my ex without her noticing"],
    });
    const droppedBoth = await runOf(golden, { unplaced: [] });

    expect(findingsOf(golden, saidBoth, "unsaid")).toEqual([
      'following someone, with a dog: "following my ex without her noticing" said back, where only "with my dog" may be',
    ]);
    expect(findingsOf(golden, saidBoth, "unplaced")).toEqual([]);
    expect(findingsOf(golden, droppedBoth, "unplaced")).toEqual([
      'following someone, with a dog: "with my dog" not said back',
    ]);
    expect(findingsOf(golden, droppedBoth, "unsaid")).toEqual([]);
  });

  it("lets a phrase through only as part of one the case allows", async () => {
    const golden = caseNamed("following someone, with a dog");
    const run = await runOf(golden, { unplaced: ["My dog", "with my dog, following my ex"] });

    expect(findingsOf(golden, run, "unsaid")).toEqual([
      'following someone, with a dog: "with my dog, following my ex" said back, where only "with my dog" may be',
    ]);
    // Left out, anything may be said back.
    expect(scoreIntakeCase(caseNamed("words outside the vocabulary"), run).unsaid.total).toBe(0);
  });

  it("lets a phrase through as part of any phrase the case allows, not the first alone", async () => {
    const outside = caseNamed("words outside the vocabulary");
    const golden: IntakeCase = { ...outside, mayHearBack: ["with my dog", "vegetarian"] };
    const run = await runOf(golden, { unplaced: ["Vegetarian", "vegetarian, following my ex"] });

    expect(findingsOf(golden, run, "unsaid")).toEqual([
      'words outside the vocabulary: "vegetarian, following my ex" said back, where only "with my dog", "vegetarian" may be',
    ]);
  });
});

describe("scoreIntakeSet", () => {
  it("fails a hard check on one finding and a scored one below its share", async () => {
    const cityOnly = caseNamed("city only");
    const noCity = caseNamed("no city");
    const scores = [
      scoreIntakeCase(cityOnly, await runOf(cityOnly, { city: null })),
      scoreIntakeCase(noCity, await runOf(noCity, { city: "Paris" })),
      scoreIntakeCase(cityOnly, await runOf(cityOnly)),
    ];
    const results = Object.fromEntries(scoreIntakeSet(scores).map((each) => [each.id, each]));

    expect(results["no-unnamed-city"]).toMatchObject({ kind: "hard", passed: false });
    expect(results.outcome).toMatchObject({ kind: "scored", passed: false, value: 1 / 3 });
    expect(results.readings).toMatchObject({ passed: true, value: 1 });
  });
});
