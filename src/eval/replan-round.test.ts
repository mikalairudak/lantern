// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fakeClaude, type ClaudeAnswer } from "@/lib/fixtures/live/mock-claude";
import { goldenReplansOf, type GoldenReplan } from "@/lib/fixtures/replan/golden-replans";
import { REPLAN_RESERVE_USD } from "@/lib/live/live-replan";
import { generatedDayOf } from "@/lib/normalizer/generated-day";
import { withPicks } from "@/lib/replan/request";
import { replanPlanOf } from "@/lib/replan/windows";
import { formatClock, runningSpans } from "@/lib/time/clock";
import { GeneratedDaySchema, type FactKey } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { intakeCasesFor } from "./intake-round";
import { keptPlaceNamesOf } from "@/lib/replan/merge";
import {
  callsOf,
  replanReport,
  replanRunLine,
  runReplanRound,
  structureFaultsOf,
  type ReplanServices,
} from "./replan-round";
import { confirmationOf, missingFor, planReport, planRound, worstUsdOf } from "./round";

const GOLDEN = goldenReplansOf(
  readFileSync(new URL("../lib/fixtures/replan/golden-replans.jsonl", import.meta.url), "utf8"),
);
const WINDOWS = goldenReplansOf(
  readFileSync(new URL("../lib/fixtures/replan/golden-windows.jsonl", import.meta.url), "utf8"),
);
const USAGE = { input: 8_700, output: 2_000 };
/** Fushimi Inari as replan-v1 and v2 placed it, 4.4 km south of Teramachi. */
const FUSHIMI = { coordinates: { lat: 34.9671, lng: 135.7727 } };
const NOW = new Date("2026-11-19T10:00:00Z");

/**
 * A re-plan any careful model could write: the windows' own stops again, at their own hours,
 * in the windows the route writes into, the case's own where they are marked by hand.
 */
function replanOfWindow(golden: GoldenReplan): GeneratedReplan {
  const plan =
    golden.windowsFrom === "hand"
      ? { kind: "targeted" as const, windows: golden.windows }
      : replanPlanOf(golden.itinerary, golden.request, golden.changed);
  if (plan.kind !== "targeted") throw new Error(`${golden.name} re-plans the whole day`);
  const stops = generatedDayOf(golden.itinerary).stops.filter((_, index) =>
    plan.windows.some(({ from, to }) => index >= from && index <= to),
  );
  return { stops, alternatives: [], dek: `${golden.name}, written again.` };
}

/** The fake answers each case in turn, as the round sends them one at a time. */
function servicesAnswering(answers: readonly ClaudeAnswer[]) {
  let next = 0;
  const claude = fakeClaude(() => {
    const answer = answers[next++];
    if (answer === undefined) throw new Error("More calls than answers");
    return answer;
  });
  let lastId = 0;
  const services: ReplanServices = {
    config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
    model: claude.provider("claude-sonnet-5-5"),
    log: () => undefined,
    newId: () => `id-${++lastId}`,
    now: () => NOW,
    maxRetries: 0,
  };
  return { services, claude };
}

describe("runReplanRound", () => {
  it("writes each golden case through the route and reads it as the page does", async () => {
    const answers = GOLDEN.map((golden): ClaudeAnswer => ({
      kind: "message",
      text: JSON.stringify(replanOfWindow(golden)),
      usage: USAGE,
    }));
    const { services, claude } = servicesAnswering(answers);

    const round = await runReplanRound(services, GOLDEN);

    expect(claude.requests).toHaveLength(GOLDEN.length);
    for (const [index, run] of round.runs.entries()) {
      const golden = GOLDEN[index];
      if (golden === undefined) throw new Error("No case");
      expect(run).toMatchObject({
        name: golden.name,
        status: 200,
        outcome: "complete",
        keptIdentical: true,
        frameError: null,
        routeWindows: golden.windows,
        newStops: replanOfWindow(golden).stops.length,
      });
      expect(run.frames).toBeGreaterThan(0);
      expect(run.msToFirstNewStop).not.toBeNull();
      expect(run.record?.costUsd).toBeGreaterThan(0);
      expect(run.record?.checks?.find(({ id }) => id === "replan-windows")?.passed).toBe(true);
      expect(run.checks?.map(({ id }) => id)).toContain("time-words");
      expect(run.notShownReason).toBeNull();
      expect(run.dropsByCause).toEqual({
        "outside-windows": 0,
        "dropped-at-kept": 0,
        "dropped-repeat": 0,
        "dropped-stop": 0,
      });
      expect(run.replanChecks?.drops).toMatchObject({ id: "replan-drops", passed: true });
      expect(run.replanChecks?.timeWords.id).toBe("replan-time-words");
      expect(run.replanChecks?.gap.id).toBe("replan-gap");
      // The route read the day from the log, never from the page, and it is the golden day, its
      // picked stops planned on the visitor's places.
      expect(run.record?.context?.itinerary).toEqual(withPicks(golden.itinerary, golden.picks));
      expect(run.record?.context?.basis).toMatchObject({ kind: "kept" });
    }
    const report = replanReport(round);
    expect(report[0]).toMatch(
      /^Re-plan round: 6 golden cases in 6 calls, spent \$0\.\d{4} in \dm\d{2}s\.$/,
    );
    GOLDEN.forEach(({ name }) => expect(report.join("\n")).toContain(name));
    // The provider's first token beside the first new stop tells a slow provider from a slow stream.
    expect(report[2]).toMatch(/first token +first new/);
    expect(report[2]).toMatch(/time-words +gap +drops \(outside \/ at kept \/ repeat \/ stop\)/);
    expect(report.join("\n")).toMatch(
      /replan-time-words (?:pass|fail[^;]*); replan-gap pass; replan-drops pass; shown;/,
    );
  });

  it("scores a re-plan whose merge drops a new stop as not shown, with its reason and its cause", async () => {
    const golden = GOLDEN[0];
    if (golden === undefined) throw new Error("No case");
    const written = replanOfWindow(golden);
    const plan = replanPlanOf(golden.itinerary, golden.request, golden.changed);
    if (plan.kind !== "targeted") throw new Error("No windows");
    const last = written.stops.at(-1);
    const keptName = keptPlaceNamesOf(golden.itinerary, plan.windows)[0];
    const end = runningSpans(golden.itinerary.stops)[plan.windows[0]?.to ?? 0]?.to;
    if (last === undefined || keptName === undefined || end === undefined)
      throw new Error("No stop");
    // A stop once more after the window's last, at a place a kept stop holds.
    const repeat = {
      ...last,
      startTime: formatClock(end),
      durationMinutes: 15,
      place: { ...last.place, name: keptName },
    };
    const replan: GeneratedReplan = { ...written, stops: [...written.stops, repeat] };
    const { services } = servicesAnswering([
      { kind: "message", text: JSON.stringify(replan), usage: USAGE },
    ]);

    const round = await runReplanRound(services, [golden]);

    const [run] = round.runs;
    if (run === undefined) throw new Error("No run");
    expect(run.notShownReason).toMatch(/^the re-plan dropped stops\[\d+\]: /);
    expect(run.dropsByCause["dropped-repeat"]).toBe(1);
    expect(run.checks).toBeNull();
    expect(run.replanChecks?.drops).toMatchObject({ passed: false, value: 1 });
    expect(replanRunLine(run)).toContain("NOT SHOWN: the re-plan dropped");
    const report = replanReport(round).join("\n");
    expect(report).toContain("replan-drops fail");
    expect(report).toContain("NOT SHOWN: the re-plan dropped");
    expect(report).toMatch(/ 0 \/ 0 \/ 1 \/ 0 /);
  });

  it("counts a stop the normalizer drops under its own cause", async () => {
    const golden = GOLDEN[0];
    if (golden === undefined) throw new Error("No case");
    const written = replanOfWindow(golden);
    const first = written.stops[0];
    if (first === undefined) throw new Error("No stop");
    // The same stop twice: the second starts no later than the one before it.
    const replan: GeneratedReplan = { ...written, stops: [first, first] };
    const { services } = servicesAnswering([
      { kind: "message", text: JSON.stringify(replan), usage: USAGE },
    ]);

    const [run] = (await runReplanRound(services, [golden])).runs;

    expect(run?.dropsByCause).toEqual({
      "outside-windows": 0,
      "dropped-at-kept": 0,
      "dropped-repeat": 0,
      "dropped-stop": 1,
    });
    expect(run?.notShownReason).toMatch(/no later than the stop before it/);
  });

  it("holds the merged day against the day before, a kept stop's fault the new stops moved still the day's", async () => {
    const golden = GOLDEN[0];
    if (golden === undefined) throw new Error("No case");
    const day = generatedDayOf(golden.itinerary);
    const [coffee] = day.stops;
    const option = day.alternatives[0]?.options[0];
    if (coffee === undefined || option === undefined) throw new Error("Kyoto opens with coffee");
    // An early morning across the city, as both live rounds wrote it, then the coffee again.
    const shrine = {
      ...coffee,
      startTime: "07:30",
      durationMinutes: 60,
      place: { ...coffee.place, name: "Fushimi Inari Taisha", kind: "sacred" as const, ...FUSHIMI },
    };
    const replan: GeneratedReplan = {
      stops: [shrine, { ...coffee, startTime: "09:15" }],
      alternatives: [{ stopIndex: 1, options: [{ ...option, name: "Breakfast on Nishiki Koji" }] }],
      dek: "Fushimi Inari at half past seven, then coffee on Teramachi.",
    };
    const { services } = servicesAnswering([
      { kind: "message", text: JSON.stringify(replan), usage: USAGE },
    ]);

    const round = await runReplanRound(services, [golden]);

    const [run] = round.runs;
    if (run === undefined) throw new Error("No run");
    const mealNamesBefore = run.checksBefore.find(({ id }) => id === "meal-name");
    const mealNames = run.checks?.find(({ id }) => id === "meal-name");
    // The kept stops' meal names had faults before and have them now, one stop further down the
    // day; only the new stop's is the re-plan's. A measure since 2026-11-05, it fails no day.
    expect(mealNamesBefore?.findings.length).toBeGreaterThan(0);
    expect(mealNames?.findings.length).toBeGreaterThan(1);
    expect(mealNames?.passed).toBe(true);
    expect(run.findingsOnNewStops["meal-name"]).toBe(1);
    expect(run.findingsOnNewStops["day-flow"]).toBeUndefined();
    const details = replanReport(round).join("\n");
    expect(details).toMatch(/against the day before, added [^;]*day-flow \d+ m/);
    expect(details).not.toMatch(/still failing [^;]*meal-name/);
    expect(details).toMatch(/findings on new stops: [^;]*meal-name 1/);
  });

  it("sends a word that re-plans the whole day to the full re-plan, with no call and no cost", async () => {
    const golden = GOLDEN[0];
    if (golden === undefined) throw new Error("No case");
    // The day with no stop naming travel, as the log keeps it and as the page holds it.
    const day = GeneratedDaySchema.parse(JSON.parse(golden.outputText));
    const untagged = (words: readonly FactKey[]): FactKey[] =>
      words.filter((word) => word !== "travel");
    const travel: GoldenReplan = {
      ...golden,
      itinerary: {
        ...golden.itinerary,
        stops: golden.itinerary.stops.map((stop) => ({
          ...stop,
          dependsOn: untagged(stop.dependsOn),
        })),
      },
      outputText: JSON.stringify({
        ...day,
        stops: day.stops.map((stop) => ({ ...stop, dependsOn: untagged(stop.dependsOn) })),
      }),
      changed: "travel",
      request: { ...golden.request, travel: "taxi" },
    };
    const { services, claude } = servicesAnswering([]);

    const { runs } = await runReplanRound(services, [travel]);

    expect(runs[0]).toMatchObject({ status: 409, outcome: null, record: null, routeWindows: null });
    expect(claude.requests).toEqual([]);
  });
});

describe("the windows set's round", () => {
  it("sends each case as many times as its runs, a case marked by hand into its own windows", async () => {
    const answers = WINDOWS.flatMap((golden) =>
      Array.from({ length: golden.runs }, (): ClaudeAnswer => ({
        kind: "message",
        text: JSON.stringify(replanOfWindow(golden)),
        usage: USAGE,
      })),
    );
    const { services, claude } = servicesAnswering(answers);

    const round = await runReplanRound(services, WINDOWS);

    expect(callsOf(WINDOWS)).toBe(8);
    expect(claude.requests).toHaveLength(8);
    expect(round.runs.map(({ index }) => index)).toEqual(
      Array.from({ length: 8 }, (_, at) => at + 1),
    );
    for (const run of round.runs) {
      const golden = WINDOWS.find(({ name }) => name === run.name);
      expect(run.writtenWindows, run.name).toEqual(golden?.windows);
      expect(run.routeWindows, run.name).toEqual(
        golden?.windowsFrom === "hand" ? null : golden?.windows,
      );
      expect(structureFaultsOf(run), run.name).toEqual([]);
      expect(replanRunLine(run)).toMatch(
        new RegExp(`^#${run.index} .*: structure ok; 200 complete`),
      );
    }
    const byHand = round.runs.filter(({ name }) => name.startsWith("Kanazawa's company"));
    expect(byHand).toHaveLength(2);
    for (const run of byHand) {
      expect(replanRunLine(run)).toContain("windows [6..7] by hand (the route's: whole day)");
      const windows = run.record?.checks?.find(({ id }) => id === "replan-windows");
      expect(windows?.passed).toBe(true);
    }
  });

  it("names each fault of a run's structure, and none of a run that holds it", async () => {
    const golden = WINDOWS[0];
    if (golden === undefined) throw new Error("No case");
    const written = replanOfWindow(golden);
    const first = written.stops[0];
    if (first === undefined) throw new Error("No stop");
    const twice = { ...written, stops: [first, first] };
    const { services } = servicesAnswering([
      { kind: "message", text: JSON.stringify(twice), usage: USAGE },
    ]);

    const [run] = (await runReplanRound(services, [{ ...golden, runs: 1 }])).runs;
    if (run === undefined) throw new Error("No run");

    const faults = structureFaultsOf(run);
    expect(faults).toContain("1 dropped-stop");
    expect(faults.some((fault) => fault.startsWith("not shown ("))).toBe(true);
    expect(replanRunLine(run)).toMatch(/^#1 .*: STRUCTURE FAIL: .*1 dropped-stop/);
    const refused = {
      ...run,
      status: 409,
      outcome: null,
      notShownReason: null,
      dropsByCause: {
        "outside-windows": 0,
        "dropped-at-kept": 0,
        "dropped-repeat": 0,
        "dropped-stop": 0,
      },
    };
    expect(structureFaultsOf(refused)).toEqual(["answered 409"]);
  });
});

describe("the re-plan round's plan", () => {
  const plan = planRound(intakeCasesFor("replan"), [], { replanCases: GOLDEN.length });

  it("writes the golden set alone, each case held to the route's worst case", () => {
    expect(plan).toMatchObject({ intakeCalls: 0, liveDays: 0, replanCases: 6 });
    expect(worstUsdOf(plan)).toBeCloseTo(6 * REPLAN_RESERVE_USD, 10);
    expect(planReport(plan).join("\n")).toContain("Re-plans: 6 calls");
  });

  it("refuses a confirmation under its worst case and takes one at it", () => {
    expect(confirmationOf("0.50", plan).kind).toBe("refused");
    expect(confirmationOf("0.51", plan)).toEqual({ kind: "confirmed" });
  });

  it("needs the live config's keys, and no Geoapify key, since it checks no place", () => {
    expect(missingFor("replan", { ANTHROPIC_API_KEY: "k" })).not.toContain("GEOAPIFY_API_KEY");
    expect(missingFor("day", { ANTHROPIC_API_KEY: "k" })).toContain("GEOAPIFY_API_KEY");
  });
});
