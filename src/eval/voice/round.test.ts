// @vitest-environment node
import { readFileSync } from "node:fs";
import { createAnthropic } from "@ai-sdk/anthropic";
import { describe, expect, it } from "vitest";
import { fakeClaude, type ClaudeAnswering } from "@/lib/fixtures/live/mock-claude";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { goldenLinesOf, type VoiceLine, type VoiceVerdict } from "./lines";
import {
  calibrationOf,
  labelledBatches,
  lineMismatchesOf,
  majorityVerdicts,
  passRatesByRole,
  planVoiceRound,
  rebuiltDays,
  roundBatches,
  runVoiceRound,
  savedVoiceReport,
  voiceCalibrationReport,
  voicePlanReport,
  voiceRunsOf,
  voiceRunsReport,
  voiceWritersReport,
  judgedDayWritersOf,
  type VoiceBatch,
  type VoiceRun,
} from "./round";

const GOLDEN = goldenLinesOf(
  readFileSync(new URL("../../lib/fixtures/voice/golden-lines.jsonl", import.meta.url), "utf8"),
);

const PASS: VoiceVerdict = { concrete: true, plain: true, earned: true };
const UNEARNED: VoiceVerdict = { concrete: true, plain: true, earned: false };

function run(index: number, verdicts: Record<string, VoiceVerdict>): VoiceRun {
  return {
    run: index,
    group: "day-001",
    judge: "claude-haiku-5-5",
    version: "voice-judge-v1",
    verdicts: Object.fromEntries(
      Object.entries(verdicts).map(([id, verdict]) => [id, { ...verdict, why: "" }]),
    ),
    unjudged: [],
    costUsd: 0.001,
    msToFinish: 1,
    finishReason: "stop",
    error: null,
  };
}

/** A saved day round of one request: Kanazawa's start as the day, and as its shadow. */
function savedRound(shadowOutcome = "complete"): string {
  const record = (role: string, outcome: string) => ({
    role,
    model: role === "day" ? "claude-sonnet-5-5" : "claude-haiku-5-5",
    outcome,
    outputText: JSON.stringify(KANAZAWA_START_DAY.day),
  });
  return JSON.stringify({
    index: 1,
    body: KANAZAWA_START_DAY.request,
    day: record("day", "complete"),
    shadow: record("shadow", shadowOutcome),
  });
}

describe("labelledBatches", () => {
  it("sends the labelled lines a judged day at a time, every line once", () => {
    const batches = labelledBatches(GOLDEN);

    expect(batches.map((batch) => batch.group)).toEqual([
      "curated:Kyoto",
      "curated:Alicante",
      "curated:Lisbon",
      "rewritten:Kyoto",
      "rewritten:Alicante",
      "rewritten:Lisbon",
      "first-pass:Alicante (first)",
    ]);
    expect(batches.reduce((sum, batch) => sum + batch.lines.length, 0)).toBe(GOLDEN.length);
  });
});

describe("roundBatches", () => {
  it("judges each complete day and shadow under a number, keeping who wrote it apart", () => {
    const { batches, writers, skipped } = roundBatches([{ name: "round-a-1", text: savedRound() }]);

    expect(batches.map((batch) => batch.group)).toEqual(["day-001", "day-002"]);
    expect(writers).toEqual([
      { group: "day-001", round: "round-a-1", index: 1, role: "day", model: "claude-sonnet-5-5" },
      { group: "day-002", round: "round-a-1", index: 1, role: "shadow", model: "claude-haiku-5-5" },
    ]);
    expect(skipped).toEqual([]);
    expect(batches[0]!.lines.every((line) => !/sonnet|haiku/i.test(line.id))).toBe(true);
  });

  it("skips a day that did not complete, and says so", () => {
    const { batches, skipped } = roundBatches([{ name: "r", text: savedRound("cut") }]);

    expect(batches).toHaveLength(1);
    expect(skipped).toEqual(["r #1 shadow: ended cut"]);
  });
});

describe("planVoiceRound", () => {
  it("plans each day judged three times, the worst case above what it expects", () => {
    const plan = planVoiceRound(labelledBatches(GOLDEN), "claude-sonnet-5-5");

    expect(plan).toMatchObject({ batches: 7, lines: 334, runs: 3, calls: 21 });
    expect(plan.worstUsd).toBeGreaterThan(plan.expectedUsd);
    expect(voicePlanReport(plan).join("\n")).toContain("= 21 calls");
  });

  it("says how long the round takes, one call at a time at round A's pace", () => {
    const plan = planVoiceRound(labelledBatches(GOLDEN), "claude-sonnet-5-5");

    // 21 calls of 17 s.
    expect(plan.expectedMinutes).toBe(6);
    expect(voicePlanReport(plan).join("\n")).toContain("About 6 minutes at Sonnet's pace");
  });

  it("costs Haiku a twentieth of Sonnet", () => {
    const batches = labelledBatches(GOLDEN);
    const sonnet = planVoiceRound(batches, "claude-sonnet-5-5");
    const haiku = planVoiceRound(batches, "claude-haiku-5-5");

    expect(haiku.worstUsd).toBeCloseTo(sonnet.worstUsd / 20);
  });
});

describe("runVoiceRound", () => {
  const batches: VoiceBatch[] = labelledBatches(GOLDEN).slice(0, 2);
  // A verdict for every labelled line: the judge keeps those of the lines it sent.
  const passEverything: ClaudeAnswering = () => {
    const verdicts = GOLDEN.map(({ id }) => ({ id, why: "", ...PASS }));
    return {
      kind: "message",
      text: JSON.stringify({ verdicts }),
      usage: { input: 5_000, output: 2_000 },
    };
  };

  it("judges every day as many times as asked, saving each run as it comes", async () => {
    const claude = fakeClaude(passEverything);
    const saved: VoiceRun[] = [];

    const round = await runVoiceRound(
      {
        model: claude.provider("claude-haiku-5-5"),
        modelId: "claude-haiku-5-5",
        role: "shadow",
        maxRetries: 0,
      },
      batches,
      { runs: 2, capUsd: 1, onRun: (each) => saved.push(each) },
    );

    expect(round.runs.map((each) => [each.group, each.run])).toEqual([
      ["curated:Kyoto", 1],
      ["curated:Kyoto", 2],
      ["curated:Alicante", 1],
      ["curated:Alicante", 2],
    ]);
    expect(saved).toEqual(round.runs);
    expect(round.runs.every((each) => each.unjudged.length === 0)).toBe(true);
    expect(round.stoppedAtCap).toBe(false);
  });

  it("starts no call its cap could not cover at the call's worst", async () => {
    const claude = fakeClaude(passEverything);

    const round = await runVoiceRound(
      {
        model: claude.provider("claude-haiku-5-5"),
        modelId: "claude-haiku-5-5",
        role: "shadow",
        maxRetries: 0,
      },
      batches,
      { runs: 3, capUsd: 0.0001 },
    );

    expect(round).toMatchObject({ runs: [], spentUsd: 0, stoppedAtCap: true });
    expect(claude.requests).toHaveLength(0);
  });

  it("gives up a call past its deadline as no judgement, held at its worst", async () => {
    // A provider that answers nothing until the call is aborted, as a hung connection would.
    const hanging = createAnthropic({
      authToken: "fixture-token",
      fetch: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    });

    const round = await runVoiceRound(
      {
        model: hanging("claude-haiku-5-5"),
        modelId: "claude-haiku-5-5",
        role: "shadow",
        maxRetries: 0,
      },
      batches.slice(0, 1),
      { runs: 1, capUsd: 1, callTimeoutMs: 20 },
    );

    expect(round.runs).toHaveLength(1);
    expect(round.runs[0]!.error).not.toBeNull();
    expect(round.runs[0]!.unjudged).toHaveLength(batches[0]!.lines.length);
    expect(round.spentUsd).toBeGreaterThan(0);
  });
});

describe("voiceRunsReport", () => {
  const batches: VoiceBatch[] = [
    { group: "day-001", lines: [] },
    { group: "day-002", lines: [] },
  ];

  it("counts the calls against those planned and names a day judged fewer times", () => {
    const runs = [1, 2, 3, 1, 2].map((index, at) => ({
      ...run(index, {}),
      group: at < 3 ? "day-001" : "day-002",
    }));

    expect(voiceRunsReport(runs, 0.05, { batches, runs: 3 })).toEqual([
      "Spent $0.0500 on 5 of 6 planned calls; 0 lines left without a verdict in some run.",
      "Judged fewer times than the 3 planned, a test its runs tie on failing: day-002 (2).",
    ]);
  });

  it("names a day never judged, and a call that reported no cost", () => {
    const runs = [{ ...run(1, {}), costUsd: null }];

    expect(voiceRunsReport(runs, 0.2, { batches, runs: 1 })).toEqual([
      "Spent $0.2000 on 1 of 2 planned calls, 1 reporting no cost; 0 lines left without a verdict in some run.",
      "Judged fewer times than the 1 planned, a test its runs tie on failing: day-002 (0).",
    ]);
  });
});

describe("a saved voice round", () => {
  const ROUND = "eval-runs/round-x";
  const days = roundBatches([{ name: ROUND, text: savedRound() }]);
  const dayRunsOf = (round: string) => {
    if (round !== ROUND) throw new Error(`no round ${round}`);
    return savedRound();
  };
  const judged = (batch: VoiceBatch, index: number, verdict = PASS): VoiceRun => ({
    ...run(index, Object.fromEntries(batch.lines.map((line) => [line.id, verdict]))),
    group: batch.group,
    judge: "claude-sonnet-5-5",
  });
  const textOf = (runs: readonly VoiceRun[]) => runs.map((each) => JSON.stringify(each)).join("\n");
  const [sonnetDay, haikuDay] = days.batches as [VoiceBatch, VoiceBatch];

  it("reads its runs and its writers as they were saved", () => {
    const runs = [judged(sonnetDay, 1), judged(haikuDay, 1, UNEARNED)];

    expect(voiceRunsOf(`${textOf(runs)}\n\n`)).toEqual(runs);
    expect(judgedDayWritersOf(JSON.stringify(days.writers))).toEqual(days.writers);
    expect(() => voiceRunsOf(JSON.stringify({ run: 1, group: "day-001" }))).toThrow();
  });

  it("is reported again by writer from what it saved, a day judged twice named", () => {
    const runs = [1, 2, 3].map((index) => judged(sonnetDay, index));
    runs.push(judged(haikuDay, 1), judged(haikuDay, 2, UNEARNED));

    const report = savedVoiceReport({
      runsText: textOf(runs),
      writersText: JSON.stringify(days.writers),
      dayRunsOf,
      golden: GOLDEN,
      runsPerDay: 3,
    }).join("\n");

    expect(report).toContain("on 5 of 6 planned calls");
    expect(report).toContain("the 3 planned, a test its runs tie on failing: day-002 (2).");
    expect(report).toMatch(/claude-sonnet-5-5 \(day\), 1 days\s+1\/1 \(100%\)/);
    // Two runs that split on earned tie, and a tie fails.
    expect(report).toMatch(/claude-haiku-5-5 \(shadow\), 1 days\s+0\/1 \(0%\)/);
  });

  it("is reported again against the labels when it judged the labelled lines", () => {
    const runs = labelledBatches(GOLDEN).map((batch) => judged(batch, 1));

    const report = savedVoiceReport({
      runsText: textOf(runs),
      writersText: null,
      dayRunsOf,
      golden: GOLDEN,
      runsPerDay: 1,
    }).join("\n");

    expect(report).toContain("on 7 of 7 planned calls");
    expect(report).toContain("Labels the owner accepted");
  });

  it("refuses verdicts on lines the day no longer has", () => {
    const drifted = judged(sonnetDay, 1);
    drifted.verdicts[`${sonnetDay.group}/stop-9:p/summary`] = { ...PASS, why: "" };

    expect(lineMismatchesOf(days.batches, [judged(sonnetDay, 1)])).toEqual([]);
    expect(lineMismatchesOf(days.batches, [{ ...drifted, group: "day-009" }])).toEqual([
      "day-009 #1: no such day rebuilt",
    ]);
    expect(() =>
      savedVoiceReport({
        runsText: textOf([drifted]),
        writersText: JSON.stringify(days.writers),
        dayRunsOf,
        golden: GOLDEN,
        runsPerDay: 3,
      }),
    ).toThrow(
      "day-001 #1: 0 lines rebuilt it never saw, 1 it judged not rebuilt (first day-001/stop-9:p/summary)",
    );
  });

  it("refuses writers the rounds no longer rebuild", () => {
    const [first, ...rest] = days.writers;
    const renamed = [{ ...first!, model: "claude-opus-5-5" }, ...rest];

    expect(rebuiltDays(days.writers, dayRunsOf).batches).toEqual(days.batches);
    expect(() => rebuiltDays(renamed, dayRunsOf)).toThrow(
      `The days rebuilt from ${ROUND} are not the ones the round judged, from day-001 on.`,
    );
    expect(() =>
      rebuiltDays([...days.writers, { ...first!, group: "day-003" }], dayRunsOf),
    ).toThrow("are not the ones the round judged, from day-003 on.");
    expect(() => rebuiltDays(days.writers.slice(0, 1), dayRunsOf)).toThrow(
      `The days rebuilt from ${ROUND} are not the ones the round judged.`,
    );
  });
});

describe("majorityVerdicts", () => {
  it("takes each test's majority, and marks a line the runs did not agree on", () => {
    const majorities = majorityVerdicts([
      run(1, { a: PASS, b: UNEARNED }),
      run(2, { a: PASS, b: PASS }),
      run(3, { a: PASS, b: UNEARNED }),
    ]);

    expect(majorities.get("a")).toEqual({ ...PASS, judged: 3, isSplit: false });
    expect(majorities.get("b")).toEqual({ ...UNEARNED, judged: 3, isSplit: true });
  });

  it("fails a test the runs tie on, as one the judge could not pass", () => {
    const majorities = majorityVerdicts([run(1, { a: PASS }), run(2, { a: UNEARNED })]);

    expect(majorities.get("a")).toMatchObject({ earned: false, judged: 2, isSplit: true });
  });
});

describe("calibrationOf", () => {
  const labelled = [
    { id: "pass-1", verdict: PASS },
    { id: "pass-2", verdict: PASS },
    { id: "pass-3", verdict: PASS },
    { id: "fail-1", verdict: UNEARNED },
    { id: "fail-2", verdict: UNEARNED },
    { id: "never", verdict: PASS },
  ];

  it("counts fails caught and missed, passes failed, splits and lines never judged", () => {
    const majorities = majorityVerdicts([
      run(1, {
        "pass-1": PASS,
        "pass-2": PASS,
        "pass-3": UNEARNED,
        "fail-1": UNEARNED,
        "fail-2": PASS,
      }),
    ]);

    const calibration = calibrationOf(labelled, majorities);

    expect(calibration).toMatchObject({
      lines: 5,
      agreed: 3,
      caught: 1,
      missed: 1,
      falseFails: 1,
      splits: 0,
      unjudged: 1,
    });
    expect(calibration.byTest.earned).toEqual({ caught: 1, fails: 2, falseFails: 1 });
    // Both fail two lines of five: chance agrees 0.4 × 0.4 + 0.6 × 0.6 = 0.52 of the time, and
    // they agree on 0.6, so kappa is (0.6 - 0.52) / (1 - 0.52).
    expect(calibration.kappa).toBeCloseTo(0.08 / 0.48);
  });

  it("gives a judge that agrees on every line a kappa of one", () => {
    const majorities = majorityVerdicts([
      run(1, {
        "pass-1": PASS,
        "pass-2": PASS,
        "pass-3": PASS,
        "fail-1": UNEARNED,
        "fail-2": UNEARNED,
      }),
    ]);

    expect(calibrationOf(labelled, majorities).kappa).toBeCloseTo(1);
  });

  it("reports the labels the owner accepted apart from the first pass, with each disagreement", () => {
    const first = GOLDEN.find((line) => line.set === "first-pass" && line.why !== "")!;
    const majorities = majorityVerdicts([
      run(1, Object.fromEntries(GOLDEN.map((line) => [line.id, PASS]))),
    ]);

    const report = voiceCalibrationReport(GOLDEN, majorities).join("\n");

    expect(report).toContain(
      "Labels the owner accepted (curated days as judged, and their rewrites): 257 lines judged.",
    );
    expect(report).toContain("The first pass, under rulings 1 to 6: 77 lines judged.");
    expect(report).toContain("Decided otherwise (26):");
    expect(report).toContain(`${first.id} · Alicante (first) ${first.time} ${first.place}`);
  });
});

describe("passRatesByRole", () => {
  it("counts, by role and in all, the lines whose majority passes all three", () => {
    const lines = [
      { id: "a", role: "summary" },
      { id: "b", role: "summary" },
      { id: "c", role: "texture" },
      { id: "d", role: "light" },
    ] as VoiceLine[];
    const majorities = majorityVerdicts([run(1, { a: PASS, b: UNEARNED, c: PASS })]);

    const rates = passRatesByRole(lines, majorities);

    expect(rates.summary).toEqual({ passed: 1, judged: 2 });
    expect(rates.texture).toEqual({ passed: 1, judged: 1 });
    expect(rates.light).toEqual({ passed: 0, judged: 0 });
    expect(rates.all).toEqual({ passed: 2, judged: 3 });
  });

  it("is reported by writer, each named by its model and role", () => {
    const written = roundBatches([{ name: "r", text: savedRound() }]);
    const majorities = majorityVerdicts([
      run(1, Object.fromEntries(written.batches.flatMap((b) => b.lines).map((l) => [l.id, PASS]))),
    ]);

    const report = voiceWritersReport(written, majorities).join("\n");

    expect(report).toMatch(/claude-sonnet-5-5 \(day\), 1 days\s+1\/1 \(100%\)/);
    expect(report).toContain("claude-haiku-5-5 (shadow), 1 days");
  });
});
