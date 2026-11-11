// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { GOLDEN_INTAKES, SUGGESTION_ROUND_CASES } from "@/lib/fixtures/intake/golden";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import {
  afterQueue,
  confirmationFor,
  confirmationOf,
  DAY_WORST_USD,
  dayKindOf,
  needsSignature,
  elapsed,
  GATE_RUNS_PER_CASE,
  INTAKE_CALL_WORST_USD,
  liveEvalSettingsOf,
  lookupsFor,
  missingFor,
  planReport,
  planRound,
  table,
  usd,
  worstUsdOf,
} from "./round";
import { intakeCasesFor, LIVE_INTAKE_GATE } from "./intake-round";

const LIVELY_KANAZAWA: DayRequest = { ...KANAZAWA_START_REQUEST, energy: "lively" };
const MARSEILLE: DayRequest = {
  ...KANAZAWA_START_REQUEST,
  city: "Marseille",
  timezone: "Europe/Paris",
};
const TEN_DAYS = Array.from({ length: 10 }, (_, index) => ({
  ...LIVELY_KANAZAWA,
  date: `2026-11-${String(index + 10)}`,
}));

describe("planRound", () => {
  it("counts the whole round's calls, and its worst case from the routes' own holds", () => {
    const plan = planRound(GOLDEN_INTAKES, TEN_DAYS);

    expect(plan).toMatchObject({ intakeCalls: 135, liveDays: 10, writtenDays: 0, signedDays: 0 });
    expect(INTAKE_CALL_WORST_USD).toBeCloseTo(0.0009, 10);
    expect(DAY_WORST_USD).toBeCloseTo(0.147, 10);
    expect(worstUsdOf(plan)).toBeCloseTo(135 * 0.0009 + 10 * 0.147, 10);
    expect(plan.expectedUsd).toBeGreaterThan(0.8);
    expect(plan.expectedUsd).toBeLessThan(worstUsdOf(plan));
    // A city each for 29 cases, Portland's two, Kyoto and Osaka, Japan's and Springfield's
    // three; none for the four that name nothing; and the suggestions' two or three each.
    expect(plan.cityLookups).toBe(3 * 56);
  });

  it("leaves out what a written day answers, and signs a city Lantern has not written", () => {
    expect(dayKindOf(KANAZAWA_START_REQUEST)).toBe("written");
    expect(dayKindOf(LIVELY_KANAZAWA)).toBe("live");
    expect(dayKindOf(MARSEILLE)).toBe("live");
    expect(needsSignature(LIVELY_KANAZAWA)).toBe(false);
    expect(needsSignature(MARSEILLE)).toBe(true);
    // A day written by hand is no day of the site's: its request goes to the model, signed.
    expect(dayKindOf(KYOTO_REQUEST)).toBe("live");
    expect(needsSignature(KYOTO_REQUEST)).toBe(true);

    const plan = planRound([], [KANAZAWA_START_REQUEST, LIVELY_KANAZAWA, MARSEILLE]);
    expect(plan).toMatchObject({ intakeCalls: 0, liveDays: 2, writtenDays: 1, signedDays: 1 });
    expect(planReport(plan).join("\n")).not.toContain("Intake:");
    expect(planReport(plan)[1]).toContain(
      "1 answered by a written day and skipped; 1 for a city Lantern has not written, signed by the round",
    );
  });

  it("says what it would send and spend before anything is sent", () => {
    const plan = planRound(GOLDEN_INTAKES, TEN_DAYS);
    const report = planReport(plan);

    expect(report[0]).toBe("The live eval round, nothing sent yet:");
    expect(report[1]).toContain("45 cases × 3 runs = 135 calls to claude-haiku-5-5 (intake-v6)");
    expect(report[2]).toContain("10 requests = 20 calls");
    expect(report[3]).toContain(
      "about 350 Geoapify lookups, at most 600; the shadows' places are not checked.",
    );
    // Production's intake and place checks draw on the same account's day.
    expect(report[4]).toBe(
      `  Geoapify: about ${plan.cityLookups + 350} of the 3,000 credits a day that production shares, its intake of a city included. One round with days a day, and none on a day Lantern is shown.`,
    );
    expect(report[5]).toMatch(
      /^ {2}Expected about \$0\.\d{4}; at most \$1\.60 \(intake \$0\.1215, days \$1\.47\)\.$/,
    );
  });

  it("checks each live day's places within a cap, and plans none without a live day", () => {
    expect(planRound([], TEN_DAYS)).toMatchObject({ placeLookups: 350, placeLookupsCap: 600 });
    expect(planRound(GOLDEN_INTAKES, [KANAZAWA_START_REQUEST])).toMatchObject({
      placeLookups: 0,
      placeLookupsCap: 0,
    });
    expect(planReport(planRound(GOLDEN_INTAKES, [])).join("\n")).not.toContain("Places:");
  });

  it("checks the shadows' places too for a round that compares the models, or none", () => {
    const both = planRound([], TEN_DAYS, { places: "both" });
    expect(both).toMatchObject({ placeLookups: 700, placeLookupsCap: 1200 });
    expect(planReport(both).join("\n")).toContain(
      "each place in the days and their shadows checked by its name",
    );
    const none = planRound([], TEN_DAYS, { places: "none" });
    expect(none).toMatchObject({ placeLookups: 0, placeLookupsCap: 0 });
    const report = planReport(none).join("\n");
    expect(report).toContain("Places: none checked (EVAL_PLACES=none).");
    expect(report).not.toContain("Geoapify:");
    const shadows = planRound([], TEN_DAYS, { places: "shadows" });
    expect(shadows).toMatchObject({ placeLookups: 350, placeLookupsCap: 600 });
    expect(planReport(shadows).join("\n")).toContain(
      "each place in the shadows checked by its name, and each coffee, food or bar place by its area too, about 350 Geoapify lookups, at most 600; the days' places are not checked.",
    );
  });

  it("looks a place up by its name, and a meal by its area too", () => {
    expect(lookupsFor("sacred")).toBe(1);
    expect(lookupsFor("food")).toBe(2);
    expect(lookupsFor("bar")).toBe(2);
  });
});

describe("confirmationOf", () => {
  const plan = planRound(GOLDEN_INTAKES, TEN_DAYS);

  it("refuses without a confirmation, and names the least it would take", () => {
    expect(confirmationOf(undefined, plan)).toEqual({
      kind: "refused",
      reason:
        "No call made. The round may cost at most $1.60; to run it, set EVAL_CONFIRM_USD=1.60 or more.",
    });
    expect(confirmationOf("  ", plan).kind).toBe("refused");
  });

  it("refuses a confirmation under the worst case, or not a number", () => {
    expect(confirmationOf("1.00", plan)).toMatchObject({
      kind: "refused",
      reason: expect.stringContaining("EVAL_CONFIRM_USD=1.00 is under the worst case."),
    });
    expect(confirmationOf("yes", plan)).toMatchObject({
      kind: "refused",
      reason: expect.stringContaining("EVAL_CONFIRM_USD is not a number."),
    });
  });

  it("confirms a sum at or over the worst case", () => {
    expect(confirmationOf("1.60", plan)).toEqual({ kind: "confirmed" });
    expect(confirmationOf("5", plan)).toEqual({ kind: "confirmed" });
  });

  it("confirms the very sum it asks for, though the worst case adds up past it in floating point", () => {
    const worst = 10 * 0.084;
    expect(worst).toBeGreaterThan(0.84);
    expect(confirmationFor(undefined, worst)).toMatchObject({
      reason: expect.stringContaining("set EVAL_CONFIRM_USD=0.84 or more"),
    });
    expect(confirmationFor("0.84", worst)).toEqual({ kind: "confirmed" });
    expect(confirmationFor("0.83", worst).kind).toBe("refused");
  });

  it("never takes a sum under the worst case, by however little", () => {
    const worst = 0.84 + 3e-7;
    expect(confirmationFor("0.84", worst).kind).toBe("refused");
    expect(confirmationFor("0.840001", worst)).toEqual({ kind: "confirmed" });
    expect(confirmationFor(undefined, worst)).toMatchObject({
      reason: expect.stringContaining("set EVAL_CONFIRM_USD=0.85 or more"),
    });
  });
});

describe("liveEvalSettingsOf", () => {
  it("runs both rounds by default, and the day round only with its requests", () => {
    expect(liveEvalSettingsOf({ EVAL_DAY_BODIES: "bodies.jsonl", EVAL_CONFIRM_USD: "2" })).toEqual({
      round: "both",
      runsPerCase: 3,
      dayBodiesPath: "bodies.jsonl",
      baselinePath: null,
      places: "days",
      judge: "sonnet",
      voiceDays: [],
      voiceReport: null,
      shadow: { effort: null, rule: null },
      outDir: null,
      confirmation: "2",
    });
    expect(liveEvalSettingsOf({})).toEqual({
      problem: "The day round reads its requests from EVAL_DAY_BODIES, which is not set.",
    });
  });

  it("judges voice with the model EVAL_JUDGE names, on the rounds EVAL_VOICE_DAYS lists", () => {
    expect(liveEvalSettingsOf({ EVAL_ROUND: "voice" })).toMatchObject({
      round: "voice",
      runsPerCase: 3,
      dayBodiesPath: null,
      judge: "sonnet",
      voiceDays: [],
    });
    expect(
      liveEvalSettingsOf({
        EVAL_ROUND: "voice",
        EVAL_JUDGE: "haiku",
        EVAL_VOICE_DAYS: "eval-runs/round-a-1, eval-runs/round-a-2,",
      }),
    ).toMatchObject({ judge: "haiku", voiceDays: ["eval-runs/round-a-1", "eval-runs/round-a-2"] });
    expect(liveEvalSettingsOf({ EVAL_ROUND: "voice", EVAL_JUDGE: "opus" })).toEqual({
      problem: 'EVAL_JUDGE is "opus"; it is one of sonnet, haiku.',
    });
  });

  it("reports a saved voice round again from EVAL_VOICE_REPORT, its days its own", () => {
    expect(
      liveEvalSettingsOf({ EVAL_ROUND: "voice", EVAL_VOICE_REPORT: " eval-runs/voice-round-a " }),
    ).toMatchObject({ round: "voice", voiceReport: "eval-runs/voice-round-a", voiceDays: [] });
    expect(liveEvalSettingsOf({ EVAL_ROUND: "voice" })).toMatchObject({ voiceReport: null });
    expect(
      liveEvalSettingsOf({
        EVAL_ROUND: "day",
        EVAL_DAY_BODIES: "b",
        EVAL_VOICE_REPORT: "eval-runs/voice-round-a",
      }),
    ).toEqual({ problem: "EVAL_VOICE_REPORT reports a voice round again; set EVAL_ROUND=voice." });
    expect(
      liveEvalSettingsOf({
        EVAL_ROUND: "voice",
        EVAL_VOICE_REPORT: "eval-runs/voice-round-a",
        EVAL_VOICE_DAYS: "eval-runs/round-a-1",
      }),
    ).toEqual({
      problem:
        "EVAL_VOICE_REPORT reads the days its round judged from its writers.json; leave EVAL_VOICE_DAYS unset.",
    });
  });

  it("checks whose places EVAL_PLACES names, and refuses a scope it does not know", () => {
    const day = { EVAL_ROUND: "day", EVAL_DAY_BODIES: "b" };
    expect(liveEvalSettingsOf({ ...day, EVAL_PLACES: "both" })).toMatchObject({ places: "both" });
    expect(liveEvalSettingsOf({ ...day, EVAL_PLACES: "none" })).toMatchObject({ places: "none" });
    expect(liveEvalSettingsOf({ ...day, EVAL_PLACES: "shadows" })).toMatchObject({
      places: "shadows",
    });
    expect(liveEvalSettingsOf({ ...day, EVAL_PLACES: "shadow" })).toEqual({
      problem: 'EVAL_PLACES is "shadow"; it is one of days, both, shadows, none.',
    });
  });

  it("changes the shadow's call alone as EVAL_SHADOW_EFFORT and EVAL_SHADOW_RULE say", () => {
    const day = { EVAL_ROUND: "day", EVAL_DAY_BODIES: "b" };
    expect(
      liveEvalSettingsOf({ ...day, EVAL_SHADOW_EFFORT: "high", EVAL_SHADOW_RULE: "versions" }),
    ).toMatchObject({ shadow: { effort: "high", rule: "versions" } });
    expect(liveEvalSettingsOf({ ...day, EVAL_SHADOW_EFFORT: "max" })).toEqual({
      problem: 'EVAL_SHADOW_EFFORT is "max"; it is one of low, medium, high.',
    });
    expect(liveEvalSettingsOf({ ...day, EVAL_SHADOW_RULE: "venues" })).toEqual({
      problem: 'EVAL_SHADOW_RULE is "venues"; it is one of versions.',
    });
  });

  it("runs the intake alone without day requests, and refuses a round it does not know", () => {
    expect(
      liveEvalSettingsOf({ EVAL_ROUND: "intake", EVAL_DAY_BODIES: "b", EVAL_OUT: "o" }),
    ).toMatchObject({
      round: "intake",
      dayBodiesPath: null,
      outDir: "o",
    });
    expect(liveEvalSettingsOf({ EVAL_ROUND: "days" })).toEqual({
      problem:
        'EVAL_ROUND is "days"; it is one of intake, day, both, gate, suggest, schema, replan-schema, replan, voice.',
    });
  });

  it("runs the gate alone ten times a text, or as many as EVAL_RUNS says, with no day requests", () => {
    expect(liveEvalSettingsOf({ EVAL_ROUND: "gate", EVAL_DAY_BODIES: "b" })).toMatchObject({
      round: "gate",
      runsPerCase: 10,
      dayBodiesPath: null,
    });
    expect(liveEvalSettingsOf({ EVAL_ROUND: "gate", EVAL_RUNS: "20" })).toMatchObject({
      runsPerCase: 20,
    });
    expect(liveEvalSettingsOf({ EVAL_ROUND: "intake", EVAL_RUNS: "5" })).toMatchObject({
      runsPerCase: 5,
    });
  });

  it("runs the schema probe alone, with no requests or cases", () => {
    expect(liveEvalSettingsOf({ EVAL_ROUND: "schema", EVAL_DAY_BODIES: "b" })).toMatchObject({
      round: "schema",
      dayBodiesPath: null,
    });
    expect(intakeCasesFor("schema")).toEqual([]);
  });

  it.each(["0", "2.5", "ten", "-3"])("refuses EVAL_RUNS of %j", (runs) => {
    expect(liveEvalSettingsOf({ EVAL_ROUND: "gate", EVAL_RUNS: runs })).toEqual({
      problem: `EVAL_RUNS is "${runs}"; it is a whole number of runs, 1 or more.`,
    });
  });
});

describe("a round of the gate alone", () => {
  it("reads the two gate texts ten times each, about a cent at most", () => {
    const cases = intakeCasesFor("gate");
    const plan = planRound(cases, [], { runsPerCase: GATE_RUNS_PER_CASE });

    expect(cases.map(({ name }) => name)).toEqual([...LIVE_INTAKE_GATE]);
    expect(plan).toMatchObject({ intakeCases: 2, runsPerCase: 10, intakeCalls: 20, liveDays: 0 });
    expect(planReport(plan).join("\n")).toContain(
      "Intake: 2 cases × 10 runs = 20 calls to claude-haiku-5-5 (intake-v6)",
    );
    expect(worstUsdOf(plan)).toBeCloseTo(20 * INTAKE_CALL_WORST_USD);
    expect(worstUsdOf(plan)).toBeLessThan(0.02);
  });

  it("reads the suggestion cases with those that must not suggest, at the intake's three runs", () => {
    const cases = intakeCasesFor("suggest");
    const plan = planRound(cases, []);

    expect(cases.map(({ name }) => name)).toEqual(
      GOLDEN_INTAKES.map(({ name }) => name).filter((name) =>
        (SUGGESTION_ROUND_CASES as readonly string[]).includes(name),
      ),
    );
    expect(cases).toHaveLength(SUGGESTION_ROUND_CASES.length);
    expect(plan).toMatchObject({ intakeCalls: 3 * SUGGESTION_ROUND_CASES.length, liveDays: 0 });
    expect(liveEvalSettingsOf({ EVAL_ROUND: "suggest" })).toMatchObject({ round: "suggest" });
  });

  it("reads every golden case in the intake's rounds, and none in the days' alone", () => {
    expect(intakeCasesFor("intake")).toBe(GOLDEN_INTAKES);
    expect(intakeCasesFor("both")).toBe(GOLDEN_INTAKES);
    expect(intakeCasesFor("day")).toEqual([]);
  });
});

describe("missingFor", () => {
  const ready = { ANTHROPIC_API_KEY: "k", VISITOR_HASH_SALT: "s", GEOAPIFY_API_KEY: "g" };

  it("names what a round lacks, Geoapify's key too, since the day round checks its places", () => {
    expect(missingFor("both", ready)).toEqual([]);
    expect(missingFor("day", {})).toEqual([
      "ANTHROPIC_API_KEY",
      "VISITOR_HASH_SALT",
      "GEOAPIFY_API_KEY",
    ]);
    expect(missingFor("intake", { ...ready, GEOAPIFY_API_KEY: " " })).toEqual(["GEOAPIFY_API_KEY"]);
  });

  it("asks the schema probe and the voice round for Claude's key alone", () => {
    expect(missingFor("schema", { ANTHROPIC_API_KEY: "k" })).toEqual([]);
    expect(missingFor("schema", { VISITOR_HASH_SALT: "s" })).toEqual(["ANTHROPIC_API_KEY"]);
    expect(missingFor("voice", { ANTHROPIC_API_KEY: "k" })).toEqual([]);
    expect(missingFor("voice", {})).toEqual(["ANTHROPIC_API_KEY"]);
  });
});

describe("confirmationFor", () => {
  it("confirms a round planned elsewhere by its worst case alone", () => {
    expect(confirmationFor("0.06", 0.056)).toEqual({ kind: "confirmed" });
    expect(confirmationFor("0.05", 0.056)).toMatchObject({
      kind: "refused",
      reason: expect.stringContaining("set EVAL_CONFIRM_USD=0.06 or more"),
    });
    expect(confirmationFor(undefined, 0.056).kind).toBe("refused");
  });
});

describe("the round's helpers", () => {
  it("drain the work scheduled after a response, and what that work schedules", async () => {
    const queue = afterQueue();
    const ran: string[] = [];
    queue.schedule(() => {
      ran.push("record");
      queue.schedule(() => Promise.resolve(void ran.push("settle")));
      return Promise.resolve();
    });

    await queue.drain();

    expect(ran).toEqual(["record", "settle"]);
  });

  it("format money, time and columns", () => {
    expect(usd(0.00028)).toBe("$0.0003");
    expect(usd(1.4283)).toBe("$1.43");
    expect(elapsed(134_400)).toBe("2m14s");
    expect(
      table(
        [
          ["a", "bb"],
          ["ccc", "d"],
        ],
        "",
      ),
    ).toEqual(["a    bb", "ccc  d"]);
  });
});
