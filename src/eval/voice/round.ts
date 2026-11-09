import { z } from "zod";
import { MODEL_IDS, worstCaseUsd, type ModelId } from "@/lib/live/models";
import { normalizeDay } from "@/lib/normalizer/normalize";
import {
  DayRequestSchema,
  GeneratedDaySchema,
  type DayRequest,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import {
  inputTokensCeilingFor,
  judgeVoice,
  maxOutputTokensFor,
  promptCharactersOf,
  SCHEMA_TOKENS,
  VOICE_JUDGE_VERSION,
  type VoiceJudge,
  type VoiceJudgement,
} from "./judge";
import {
  passesAll,
  voiceLineOfGolden,
  voiceLinesOf,
  VOICE_ROLES,
  VOICE_TESTS,
  type GoldenLine,
  type VoiceLine,
  type VoiceRole,
  type VoiceVerdict,
} from "./lines";
import { table, usd } from "../round";

/**
 * A voice round (`EVAL_ROUND=voice`): each day's lines judged a few times by the same model,
 * each line's verdict the majority of its runs, and a line the runs split on set aside for the
 * owner (`docs/voice.md`, "Second judge and close"). Against the labelled lines it measures
 * the judge; on a day round's days it scores each writer.
 */

/** Runs of each day: three, so one verdict is the majority of three, as `docs/voice.md` asks. */
export const VOICE_RUNS = 3;

/**
 * Characters a token on the judge's calls as the plan expects them: prose and ids, longer than
 * the day's JSON. Only the expected sum reads it; a round is confirmed against its ceilings.
 */
const EXPECTED_CHARACTERS_PER_TOKEN = 3.5;
/** About what one verdict writes. */
const EXPECTED_OUTPUT_TOKENS_PER_LINE = 45;

/**
 * A call's time on Sonnet as round A's 72 days took it (2026-11-05): 17 s the median of 215, so
 * 216 calls one after another take about an hour, the hour that ended that round on its last.
 */
const EXPECTED_SECONDS_PER_CALL = 17;

/**
 * How long one judgement may take, its retries within it, before it is given up as no
 * judgement. Round A's slowest of 215 took 32 s; the biggest day, 81 lines, may write
 * `maxOutputTokensFor` 6,880 tokens, under a minute at Sonnet's pace. A hung call is what this
 * bounds: with it a round lasts at most its calls times this, and the round's test has no clock.
 */
export const VOICE_CALL_TIMEOUT_MS = 120_000;

/** A batch the judge reads at once: one day's lines. */
export interface VoiceBatch {
  group: string;
  lines: VoiceLine[];
}

export interface VoicePlan {
  judge: ModelId;
  batches: number;
  lines: number;
  runs: number;
  calls: number;
  expectedUsd: number;
  worstUsd: number;
  /** One call at a time, at round A's pace on Sonnet. */
  expectedMinutes: number;
}

export function planVoiceRound(
  batches: readonly VoiceBatch[],
  judge: ModelId,
  runs = VOICE_RUNS,
): VoicePlan {
  const perRun = batches.reduce(
    (sum, { lines }) => {
      const expectedInput =
        Math.ceil(promptCharactersOf(lines) / EXPECTED_CHARACTERS_PER_TOKEN) + SCHEMA_TOKENS;
      const expectedOutput = lines.length * EXPECTED_OUTPUT_TOKENS_PER_LINE;
      return {
        expected: sum.expected + worstCaseUsd(judge, expectedInput, expectedOutput),
        worst:
          sum.worst + worstCaseUsd(judge, inputTokensCeilingFor(lines), maxOutputTokensFor(lines)),
      };
    },
    { expected: 0, worst: 0 },
  );
  return {
    judge,
    batches: batches.length,
    lines: batches.reduce((sum, { lines }) => sum + lines.length, 0),
    runs,
    calls: batches.length * runs,
    expectedUsd: perRun.expected * runs,
    worstUsd: perRun.worst * runs,
    expectedMinutes: Math.ceil((batches.length * runs * EXPECTED_SECONDS_PER_CALL) / 60),
  };
}

export function voicePlanReport(plan: VoicePlan): string[] {
  return [
    "The voice round, nothing sent yet:",
    `  ${plan.batches} days, ${plan.lines} lines, judged ${plan.runs} times each by ${plan.judge} (${VOICE_JUDGE_VERSION}) = ${plan.calls} calls; each line's verdict is the majority of its runs.`,
    `  Expected about ${usd(plan.expectedUsd)}; at most ${usd(plan.worstUsd)}. About ${plan.expectedMinutes} minutes at Sonnet's pace, one call at a time.`,
  ];
}

/** The labelled lines as batches, one day of one judged pass at a time, as they were judged. */
export function labelledBatches(golden: readonly GoldenLine[]): VoiceBatch[] {
  const batches = new Map<string, VoiceLine[]>();
  for (const line of golden.map(voiceLineOfGolden)) {
    batches.set(line.group, [...(batches.get(line.group) ?? []), line]);
  }
  return [...batches].map(([group, lines]) => ({ group, lines }));
}

/** Who wrote a judged day, which the judge is never told. */
export interface JudgedDayWriter {
  group: string;
  /** The round it was read from, as named on the command line. */
  round: string;
  index: number;
  role: "day" | "shadow";
  model: string;
}

const JudgedDayWritersSchema = z.array(
  z.strictObject({
    group: z.string(),
    round: z.string(),
    index: z.number(),
    role: z.enum(["day", "shadow"]),
    model: z.string(),
  }),
);

/** A voice round's `writers.json`: who wrote each day it judged. */
export function judgedDayWritersOf(text: string): JudgedDayWriter[] {
  return JudgedDayWritersSchema.parse(JSON.parse(text));
}

const SavedRecordSchema = z.object({
  role: z.enum(["day", "shadow"]),
  model: z.string(),
  outcome: z.string(),
  outputText: z.string(),
});

const SavedRunSchema = z.object({
  index: z.number(),
  body: DayRequestSchema,
  day: SavedRecordSchema.nullable(),
  shadow: SavedRecordSchema.nullable(),
});

/** The itinerary a saved day shows a visitor, or why there is none to judge. */
function itineraryOfSaved(
  body: DayRequest,
  record: z.infer<typeof SavedRecordSchema>,
): Itinerary | string {
  if (record.outcome !== "complete") return `ended ${record.outcome}`;
  let json: unknown;
  try {
    json = JSON.parse(record.outputText);
  } catch {
    return "its text is not JSON";
  }
  const day = GeneratedDaySchema.safeParse(json);
  if (!day.success) return "its text is not a day";
  const normalized = normalizeDay(body, withLettersUnescaped(day.data));
  return normalized.ok ? normalized.itinerary : `the normalizer refused it: ${normalized.reason}`;
}

/**
 * Every complete day and shadow of saved day rounds (`day-runs.jsonl`), each a batch under a
 * number that says nothing of who wrote it, with who wrote each kept apart for the report.
 */
export function roundBatches(rounds: readonly { name: string; text: string }[]): {
  batches: VoiceBatch[];
  writers: JudgedDayWriter[];
  skipped: string[];
} {
  const batches: VoiceBatch[] = [];
  const writers: JudgedDayWriter[] = [];
  const skipped: string[] = [];
  for (const { name, text } of rounds) {
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    for (const line of lines) {
      const run = SavedRunSchema.parse(JSON.parse(line));
      for (const record of [run.day, run.shadow]) {
        if (record === null) continue;
        const itinerary = itineraryOfSaved(run.body, record);
        if (typeof itinerary === "string") {
          skipped.push(`${name} #${run.index} ${record.role}: ${itinerary}`);
          continue;
        }
        const group = `day-${String(batches.length + 1).padStart(3, "0")}`;
        batches.push({ group, lines: voiceLinesOf(group, itinerary) });
        writers.push({
          group,
          round: name,
          index: run.index,
          role: record.role,
          model: record.model,
        });
      }
    }
  }
  return { batches, writers, skipped };
}

/** One run's judgement of one day, as the round saves it. */
export interface VoiceRun {
  run: number;
  group: string;
  judge: ModelId;
  version: string;
  verdicts: Record<string, VoiceVerdict & { why: string }>;
  unjudged: string[];
  costUsd: number | null;
  msToFinish: number;
  finishReason: string | null;
  error: string | null;
}

const VerdictSchema = z.strictObject({
  why: z.string(),
  concrete: z.boolean(),
  plain: z.boolean(),
  earned: z.boolean(),
});

const VoiceRunSchema = z.strictObject({
  run: z.number(),
  group: z.string(),
  judge: z.enum([MODEL_IDS.day, MODEL_IDS.shadow]),
  version: z.string(),
  verdicts: z.record(z.string(), VerdictSchema),
  unjudged: z.array(z.string()),
  costUsd: z.number().nullable(),
  msToFinish: z.number(),
  finishReason: z.string().nullable(),
  error: z.string().nullable(),
});

/** A voice round's `voice-runs.jsonl`, one judgement of one day a line. */
export function voiceRunsOf(text: string): VoiceRun[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => VoiceRunSchema.parse(JSON.parse(line)));
}

export interface VoiceRoundOptions {
  runs?: number;
  /** The round's own cap: no call starts once what it has spent and the next call's worst would pass it. */
  capUsd: number;
  /** Each call's deadline, `VOICE_CALL_TIMEOUT_MS` unless a test shortens it. */
  callTimeoutMs?: number;
  onRun?: (run: VoiceRun) => void;
}

/** Every day judged `runs` times, a day's runs one after another, under the round's cap. */
export async function runVoiceRound(
  judge: VoiceJudge,
  batches: readonly VoiceBatch[],
  { runs = VOICE_RUNS, capUsd, callTimeoutMs = VOICE_CALL_TIMEOUT_MS, onRun }: VoiceRoundOptions,
): Promise<{ runs: VoiceRun[]; spentUsd: number; stoppedAtCap: boolean }> {
  const done: VoiceRun[] = [];
  let spentUsd = 0;
  for (const batch of batches) {
    const worst = worstCaseUsd(
      judge.modelId,
      inputTokensCeilingFor(batch.lines),
      maxOutputTokensFor(batch.lines),
    );
    for (let run = 1; run <= runs; run++) {
      if (spentUsd + worst > capUsd) return { runs: done, spentUsd, stoppedAtCap: true };
      const judgement: VoiceJudgement = await judgeVoice(
        judge,
        batch.lines,
        AbortSignal.timeout(callTimeoutMs),
      );
      // A call that reports no usage is held at its worst, so the cap still bounds the round.
      spentUsd += judgement.costUsd ?? worst;
      const saved: VoiceRun = {
        run,
        group: batch.group,
        judge: judge.modelId,
        version: VOICE_JUDGE_VERSION,
        verdicts: Object.fromEntries(judgement.verdicts),
        unjudged: judgement.unjudged,
        costUsd: judgement.costUsd,
        msToFinish: judgement.msToFinish,
        finishReason: judgement.finishReason,
        error: judgement.error,
      };
      done.push(saved);
      onRun?.(saved);
    }
  }
  return { runs: done, spentUsd, stoppedAtCap: false };
}

/** A line's verdict over its runs: each test's majority, and whether the runs agreed on all three. */
export interface MajorityVerdict extends VoiceVerdict {
  /** How many runs judged it. */
  judged: number;
  /** The runs did not all agree on some test: the owner's to settle. */
  isSplit: boolean;
}

/**
 * Each line's verdict, the majority of the runs that judged it; a test the runs tie on fails,
 * as a line the judge could not pass. A line no run judged has no verdict.
 */
export function majorityVerdicts(runs: readonly VoiceRun[]): Map<string, MajorityVerdict> {
  const byLine = new Map<string, VoiceVerdict[]>();
  for (const run of runs) {
    for (const [id, verdict] of Object.entries(run.verdicts)) {
      byLine.set(id, [...(byLine.get(id) ?? []), verdict]);
    }
  }
  const majorities = new Map<string, MajorityVerdict>();
  for (const [id, verdicts] of byLine) {
    const passes = (test: (typeof VOICE_TESTS)[number]): boolean =>
      verdicts.filter((verdict) => verdict[test]).length * 2 > verdicts.length;
    const majority: VoiceVerdict = {
      concrete: passes("concrete"),
      plain: passes("plain"),
      earned: passes("earned"),
    };
    const isSplit = VOICE_TESTS.some((test) => new Set(verdicts.map((v) => v[test])).size > 1);
    majorities.set(id, { ...majority, judged: verdicts.length, isSplit });
  }
  return majorities;
}

/** A judge's verdicts against labelled lines, line by line on "passes all three". */
export interface Calibration {
  lines: number;
  agreed: number;
  /** Labelled fails the judge failed too. */
  caught: number;
  /** Labelled fails the judge passed. */
  missed: number;
  /** Labelled passes the judge failed. */
  falseFails: number;
  /** Cohen's kappa on pass and fail: agreement beyond what chance gives at these rates. */
  kappa: number;
  /** Per test, labelled fails caught of all labelled fails on it, and false fails on it. */
  byTest: Record<
    (typeof VOICE_TESTS)[number],
    { caught: number; fails: number; falseFails: number }
  >;
  /** Lines the runs split on. */
  splits: number;
  /** Lines no run judged. */
  unjudged: number;
}

export function calibrationOf(
  labelled: readonly { id: string; verdict: VoiceVerdict }[],
  majorities: ReadonlyMap<string, MajorityVerdict>,
): Calibration {
  const counts = { agreed: 0, caught: 0, missed: 0, falseFails: 0, splits: 0, unjudged: 0 };
  let judgedFails = 0;
  let labelledFails = 0;
  let judged = 0;
  const byTest = Object.fromEntries(
    VOICE_TESTS.map((test) => [test, { caught: 0, fails: 0, falseFails: 0 }]),
  ) as Calibration["byTest"];
  for (const { id, verdict } of labelled) {
    const majority = majorities.get(id);
    if (majority === undefined) {
      counts.unjudged++;
      continue;
    }
    judged++;
    if (majority.isSplit) counts.splits++;
    const isLabelledPass = passesAll(verdict);
    const isJudgedPass = passesAll(majority);
    if (!isLabelledPass) labelledFails++;
    if (!isJudgedPass) judgedFails++;
    if (isLabelledPass === isJudgedPass) counts.agreed++;
    if (!isLabelledPass && !isJudgedPass) counts.caught++;
    if (!isLabelledPass && isJudgedPass) counts.missed++;
    if (isLabelledPass && !isJudgedPass) counts.falseFails++;
    for (const test of VOICE_TESTS) {
      if (!verdict[test]) {
        byTest[test].fails++;
        if (!majority[test]) byTest[test].caught++;
      } else if (!majority[test]) {
        byTest[test].falseFails++;
      }
    }
  }
  const observed = judged === 0 ? 0 : counts.agreed / judged;
  const chance =
    judged === 0
      ? 0
      : (labelledFails / judged) * (judgedFails / judged) +
        (1 - labelledFails / judged) * (1 - judgedFails / judged);
  const kappa = chance === 1 ? 1 : (observed - chance) / (1 - chance);
  return { lines: judged, ...counts, kappa, byTest };
}

function share(part: number, whole: number): string {
  return whole === 0 ? "–" : `${part} of ${whole} (${Math.round((part / whole) * 100)}%)`;
}

export function calibrationReport(label: string, calibration: Calibration): string[] {
  const { lines, agreed, caught, missed, falseFails, kappa, byTest, splits, unjudged } =
    calibration;
  return [
    `${label}: ${lines} lines judged${unjudged > 0 ? `, ${unjudged} never judged` : ""}.`,
    `  Agreed with the labels on ${share(agreed, lines)}, kappa ${kappa.toFixed(2)}.`,
    `  Labelled fails caught ${share(caught, caught + missed)}; labelled passes failed ${falseFails}.`,
    `  The runs split on ${share(splits, lines)}.`,
    ...table([
      ["test", "fails caught", "false fails"],
      ...VOICE_TESTS.map((test) => [
        test,
        `${byTest[test].caught} of ${byTest[test].fails}`,
        String(byTest[test].falseFails),
      ]),
    ]),
  ];
}

/** Lines that pass all three, by role, for one writer's days. */
export function passRatesByRole(
  lines: readonly VoiceLine[],
  majorities: ReadonlyMap<string, MajorityVerdict>,
): Record<VoiceRole | "all", { passed: number; judged: number }> {
  const rates = Object.fromEntries(
    [...VOICE_ROLES, "all"].map((role) => [role, { passed: 0, judged: 0 }]),
  ) as Record<VoiceRole | "all", { passed: number; judged: number }>;
  for (const line of lines) {
    const majority = majorities.get(line.id);
    if (majority === undefined) continue;
    for (const key of [line.role, "all"] as const) {
      rates[key].judged++;
      if (passesAll(majority)) rates[key].passed++;
    }
  }
  return rates;
}

/** A labelled line the judge decided otherwise, for a reader to look at. */
function disagreementLine(golden: GoldenLine, majority: MajorityVerdict): string {
  const labelled = passesAll(golden.verdict) ? "pass" : `fail (${golden.why})`;
  const failed = VOICE_TESTS.filter((test) => !majority[test]);
  const judged = failed.length === 0 ? "pass" : `fail on ${failed.join(", ")}`;
  const where = golden.place === "" ? golden.day : `${golden.day} ${golden.time} ${golden.place}`;
  return `    ${golden.id} · ${where} · ${golden.role}: labelled ${labelled}, judged ${judged}${majority.isSplit ? " (split)" : ""}: "${golden.text}"`;
}

/**
 * The judge against the labelled lines: the labels the owner accepted (the curated days as
 * judged, and their rewrites), the first pass apart, since it was judged under rulings 1 to 6
 * alone, and every line the judge decided otherwise.
 */
export function voiceCalibrationReport(
  golden: readonly GoldenLine[],
  majorities: ReadonlyMap<string, MajorityVerdict>,
): string[] {
  const accepted = golden.filter((line) => line.set !== "first-pass");
  const firstPass = golden.filter((line) => line.set === "first-pass");
  const disagreements = golden.filter((line) => {
    const majority = majorities.get(line.id);
    return majority !== undefined && passesAll(majority) !== passesAll(line.verdict);
  });
  return [
    ...calibrationReport(
      "Labels the owner accepted (curated days as judged, and their rewrites)",
      calibrationOf(accepted, majorities),
    ),
    "",
    ...calibrationReport(
      "The first pass, under rulings 1 to 6",
      calibrationOf(firstPass, majorities),
    ),
    "",
    `Decided otherwise (${disagreements.length}):`,
    ...disagreements.map((line) => disagreementLine(line, majorities.get(line.id)!)),
  ];
}

/** Each writer's lines that pass all three, by role, with the lines the runs split on. */
export function voiceWritersReport(
  { batches, writers }: { batches: readonly VoiceBatch[]; writers: readonly JudgedDayWriter[] },
  majorities: ReadonlyMap<string, MajorityVerdict>,
): string[] {
  const models = [...new Set(writers.map((writer) => `${writer.model} (${writer.role})`))];
  const linesOf = (model: string) =>
    batches
      .filter((batch) => {
        const writer = writers.find((each) => each.group === batch.group);
        return writer !== undefined && `${writer.model} (${writer.role})` === model;
      })
      .flatMap((batch) => batch.lines);
  const cell = ({ passed, judged }: { passed: number; judged: number }) =>
    judged === 0 ? "–" : `${passed}/${judged} (${Math.round((passed / judged) * 100)}%)`;
  const rows = models.map((model) => {
    const lines = linesOf(model);
    const rates = passRatesByRole(lines, majorities);
    const splits = lines.filter((line) => majorities.get(line.id)?.isSplit).length;
    const days = writers.filter((writer) => `${writer.model} (${writer.role})` === model).length;
    return [
      `${model}, ${days} days`,
      ...[...VOICE_ROLES, "all" as const].map((role) => cell(rates[role])),
      String(splits),
    ];
  });
  return [
    "Lines that pass all three tests, by role (each line's verdict the majority of its runs):",
    ...table([["writer", ...VOICE_ROLES, "all", "split"], ...rows]),
  ];
}

/**
 * What the round spent and how its calls went, against the calls it planned: a day judged
 * fewer times than planned, by a cap or a round cut short, is named, since a test its runs tie
 * on fails and two runs tie where three would not.
 */
export function voiceRunsReport(
  runs: readonly VoiceRun[],
  spentUsd: number,
  planned: { batches: readonly VoiceBatch[]; runs: number },
): string[] {
  const failed = runs.filter((run) => run.error !== null);
  const unjudged = runs.reduce((sum, run) => sum + run.unjudged.length, 0);
  const unpriced = runs.filter((run) => run.costUsd === null).length;
  const judgedTimes = new Map(planned.batches.map(({ group }) => [group, 0]));
  for (const run of runs) judgedTimes.set(run.group, (judgedTimes.get(run.group) ?? 0) + 1);
  const short = [...judgedTimes].filter(([, times]) => times < planned.runs);
  return [
    `Spent ${usd(spentUsd)} on ${runs.length} of ${planned.batches.length * planned.runs} planned calls${failed.length > 0 ? `, ${failed.length} with no judgement (${failed.map((run) => `${run.group} #${run.run}`).join(", ")})` : ""}${unpriced > 0 ? `, ${unpriced} reporting no cost` : ""}; ${unjudged} lines left without a verdict in some run.`,
    ...(short.length === 0
      ? []
      : [
          `Judged fewer times than the ${planned.runs} planned, a test its runs tie on failing: ${short.map(([group, times]) => `${group} (${times})`).join(", ")}.`,
        ]),
  ];
}

/**
 * Where a saved round's verdicts and the lines rebuilt for them part: each run must have judged,
 * or left unjudged, exactly the lines its day has now. A normalizer or a line reader changed
 * since the round would otherwise pair verdicts with lines the judge never read.
 */
export function lineMismatchesOf(
  batches: readonly VoiceBatch[],
  runs: readonly VoiceRun[],
): string[] {
  const idsOf = new Map(batches.map(({ group, lines }) => [group, lines.map(({ id }) => id)]));
  const mismatches: string[] = [];
  for (const run of runs) {
    const ids = idsOf.get(run.group);
    if (ids === undefined) {
      mismatches.push(`${run.group} #${run.run}: no such day rebuilt`);
      continue;
    }
    const saved = new Set([...Object.keys(run.verdicts), ...run.unjudged]);
    const missing = ids.filter((id) => !saved.has(id));
    const extra = [...saved].filter((id) => !ids.includes(id));
    if (missing.length > 0 || extra.length > 0) {
      mismatches.push(
        `${run.group} #${run.run}: ${missing.length} lines rebuilt it never saw, ${extra.length} it judged not rebuilt (first ${[...missing, ...extra][0]})`,
      );
    }
  }
  return mismatches;
}

/**
 * The days a saved round on saved days judged, rebuilt from the day rounds its `writers.json`
 * names, in its order, so each takes the number it was judged under; the rebuilt writers must
 * be the saved ones.
 */
export function rebuiltDays(
  writers: readonly JudgedDayWriter[],
  dayRunsOf: (round: string) => string,
): { batches: VoiceBatch[]; writers: JudgedDayWriter[] } {
  const rounds = [...new Set(writers.map(({ round }) => round))];
  const rebuilt = roundBatches(rounds.map((name) => ({ name, text: dayRunsOf(name) })));
  const differing = writers.find(
    (writer, at) => JSON.stringify(rebuilt.writers[at]) !== JSON.stringify(writer),
  );
  if (differing !== undefined || rebuilt.writers.length !== writers.length) {
    throw new Error(
      `The days rebuilt from ${rounds.join(", ")} are not the ones the round judged${differing === undefined ? "" : `, from ${differing.group} on`}.`,
    );
  }
  return rebuilt;
}

/** What a voice round reports, from its runs as they came or as they were saved. */
export interface VoiceRoundResult {
  runs: readonly VoiceRun[];
  spentUsd: number;
  batches: readonly VoiceBatch[];
  /** Runs planned for each day. */
  runsPerDay: number;
  /** The days' writers, for a round on saved days; null for the labelled lines. */
  written: { batches: readonly VoiceBatch[]; writers: readonly JudgedDayWriter[] } | null;
  golden: readonly GoldenLine[];
}

/** The round's report: its calls, then the judge against the labels or each writer's lines. */
export function voiceRoundReport(result: VoiceRoundResult): string[] {
  const majorities = majorityVerdicts(result.runs);
  return [
    ...voiceRunsReport(result.runs, result.spentUsd, {
      batches: result.batches,
      runs: result.runsPerDay,
    }),
    "",
    ...(result.written === null
      ? voiceCalibrationReport(result.golden, majorities)
      : voiceWritersReport(result.written, majorities)),
  ];
}

/**
 * A voice round reported again from what it saved, calling nothing: its runs, and for a round
 * on saved days its writers and the day rounds they name. It refuses when a run's lines are
 * not the lines rebuilt for it. What it spent is what the runs recorded.
 */
export function savedVoiceReport(saved: {
  runsText: string;
  /** The round's `writers.json`, or null for a round on the labelled lines. */
  writersText: string | null;
  dayRunsOf: (round: string) => string;
  golden: readonly GoldenLine[];
  runsPerDay: number;
}): string[] {
  const runs = voiceRunsOf(saved.runsText);
  const written =
    saved.writersText === null
      ? null
      : rebuiltDays(judgedDayWritersOf(saved.writersText), saved.dayRunsOf);
  const batches = written?.batches ?? labelledBatches(saved.golden);
  const mismatches = lineMismatchesOf(batches, runs);
  if (mismatches.length > 0) {
    throw new Error(`The saved runs do not fit the lines rebuilt: ${mismatches.join("; ")}.`);
  }
  return voiceRoundReport({
    runs,
    spentUsd: runs.reduce((sum, run) => sum + (run.costUsd ?? 0), 0),
    batches,
    runsPerDay: saved.runsPerDay,
    written,
    golden: saved.golden,
  });
}
