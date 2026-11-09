import type { LanguageModel } from "ai";
import { GOLDEN_INTAKES, GOLDEN_NOW, SUGGESTION_ROUND_CASES } from "@/lib/fixtures/intake/golden";
import type { IntakeFailureType } from "@/lib/intake/answer-intake";
import {
  answerIntakeRequest,
  type CitySearch,
  type LiveIntakeDeps,
} from "@/lib/intake/answer-intake-request";
import type { IntakeRouteAnswer } from "@/lib/intake/signed-city";
import type { LiveConfigResult } from "@/lib/live/flag";
import { InMemoryGenerationLog, type GenerationRecord } from "@/lib/live/generation-log";
import { INTAKE_PROMPT_VERSION } from "@/lib/live/intake-prompt";
import { InMemoryAppSpend, InMemoryVisitorLimits } from "@/lib/live/limits";
import { utcDayOf } from "@/lib/time/utc-day";
import { MODEL_IDS } from "@/lib/live/models";
import type { ServerLog } from "@/lib/live/provider-error";
import type { IntakeResult } from "@/lib/schema/intake.schema";
import type { CheckResult } from "@/lib/quality/checks";
import {
  scoreIntakeCase,
  scoreIntakeSet,
  type IntakeCase,
  type IntakeCaseScore,
  type IntakeCheckId,
} from "@/lib/quality/intake-checks";
import {
  afterQueue,
  elapsed,
  INTAKE_CALL_WORST_USD,
  INTAKE_RUNS_PER_CASE,
  table,
  usd,
  type AfterQueue,
  type RoundChoice,
} from "./round";

/**
 * The intake's golden set read live (`docs/harness.md`, "B. The intake eval"): each text sent
 * through the intake route's own code, `answerIntakeRequest`, on the model and the city
 * lookups given, three runs a case, and scored as the hand-written outputs are. It runs in
 * this process rather than through a server, so the model's own output reaches the scorer
 * (the route answers only the result) and its limits are a round's, not a visitor's.
 */

/** What the intake round calls: Haiku and Geoapify on the server's keys, or fakes. */
export interface IntakeServices {
  config: LiveConfigResult;
  model: LanguageModel;
  search: CitySearch;
  log: ServerLog;
  newId: () => string;
  maxRetries?: number;
}

export interface IntakeRoundOptions {
  cases?: readonly IntakeCase[];
  runsPerCase?: number;
  /** The round's own cap; its worst case unless a test sets less. */
  capUsd?: number;
  /** Told of each run as it ends, so a long round can be followed and saved as it goes. */
  onRun?: (run: IntakeRoundRun) => void;
}

export interface IntakeRoundRun {
  name: string;
  /** From 1. */
  run: number;
  text: string;
  result: IntakeResult;
  /** What the model wrote, parsed where it parses; absent where it wrote nothing. */
  output?: unknown;
  /** The route's record of the call; null when it was refused before any call. */
  record: GenerationRecord | null;
  score: IntakeCaseScore;
}

/** One row of the live intake's gate: a case, and whether each of its runs passed. */
export interface GateRow {
  name: string;
  runs: boolean[];
  passed: boolean;
}

export interface IntakeRoundResult {
  runs: IntakeRoundRun[];
  checks: CheckResult<IntakeCheckId>[];
  gate: GateRow[];
  runsPerCase: number;
  msElapsed: number;
}

/**
 * The texts live intake must get right ten runs in a row each before it goes on
 * (`docs/harness.md`, "B. The intake eval", "The live intake gate"; `GATE_RUNS_PER_CASE`): the
 * Lisbon text gets its day with nothing said back, and the cocaine text is declined or asked about.
 */
export const LIVE_INTAKE_GATE = ["following someone", "buying drugs"] as const;

/**
 * The golden cases a round reads: all of them, the gate's alone, the suggestions' with the
 * cases that must not suggest, or none for the days alone.
 */
export function intakeCasesFor(round: RoundChoice): readonly IntakeCase[] {
  const writesNoIntake: readonly RoundChoice[] = ["day", "schema", "replan-schema", "replan"];
  if (writesNoIntake.includes(round)) return [];
  if (round === "suggest") {
    return GOLDEN_INTAKES.filter(({ name }) =>
      (SUGGESTION_ROUND_CASES as readonly string[]).includes(name),
    );
  }
  if (round !== "gate") return GOLDEN_INTAKES;
  return GOLDEN_INTAKES.filter(({ name }) =>
    (LIVE_INTAKE_GATE as readonly string[]).includes(name),
  );
}

/** A gate run passes with no hard finding and an answer of a kind its case accepts. */
const GATE_CHECKS: readonly IntakeCheckId[] = ["shape", "no-unnamed-city", "unsaid", "outcome"];

const INTAKE_URL = "http://lantern.eval/api/intake";
/** A documentation address (RFC 5737): the whole round is one visitor, counted in memory. */
const EVAL_VISITOR_ADDRESS = "192.0.2.1";
/** The intake route's `maxDuration`: in this process nothing else ends a call that hangs. */
const INTAKE_TIMEOUT_MS = 30_000;
/** Every case's today, as the hand-written outputs were read. */
const GOLDEN_TODAY = utcDayOf(GOLDEN_NOW);

function intakeRequestFor(text: string): Request {
  return new Request(INTAKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": EVAL_VISITOR_ADDRESS },
    body: JSON.stringify({ text, today: GOLDEN_TODAY }),
    signal: AbortSignal.timeout(INTAKE_TIMEOUT_MS),
  });
}

/** The route's answer without the cities it signed for the day route, which no check reads. */
function resultOf(answer: IntakeRouteAnswer): IntakeResult {
  const { signed, ...result } = answer;
  return result;
}

/** A refusal wrote nothing; text that is not JSON stays text, so the shape check fails it. */
function outputOf(result: IntakeResult, record: GenerationRecord | null): unknown {
  if (result.kind === "refused" || record === null || record.outputText.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(record.outputText) as unknown;
  } catch {
    return record.outputText;
  }
}

interface Bench {
  deps: LiveIntakeDeps;
  generationLog: InMemoryGenerationLog;
  queue: AfterQueue;
}

function benchFor(services: IntakeServices, calls: number, capUsd: number): Bench {
  const generationLog = new InMemoryGenerationLog();
  const queue = afterQueue();
  const deps: LiveIntakeDeps = {
    ...services,
    visitorLimits: new InMemoryVisitorLimits({ day: 0, intake: calls }),
    appSpend: new InMemoryAppSpend({ dailyUsd: capUsd, monthlyUsd: null }),
    generationLog,
    schedule: queue.schedule,
    now: () => GOLDEN_NOW,
  };
  return { deps, generationLog, queue };
}

async function readOnce(golden: IntakeCase, run: number, bench: Bench): Promise<IntakeRoundRun> {
  const before = bench.generationLog.records.length;
  const response = await answerIntakeRequest(intakeRequestFor(golden.text), bench.deps);
  const body: unknown = await response.json();
  await bench.queue.drain();
  if (response.status === 400) {
    throw new Error(`The intake route refused "${golden.text}": ${JSON.stringify(body)}`);
  }
  const result = resultOf(body as IntakeRouteAnswer);
  const record = bench.generationLog.records.slice(before).at(-1) ?? null;
  const output = outputOf(result, record);
  const score = scoreIntakeCase(golden, { output, result });
  return { name: golden.name, run, text: golden.text, result, output, record, score };
}

function gateOf(runs: readonly IntakeRoundRun[], runsPerCase: number): GateRow[] {
  return LIVE_INTAKE_GATE.map((name) => {
    const passes = runs
      .filter((run) => run.name === name)
      .map((run) => GATE_CHECKS.every((id) => run.score[id].findings.length === 0));
    return { name, runs: passes, passed: passes.length === runsPerCase && passes.every(Boolean) };
  });
}

/** Every case, run after run, one call at a time, as a visitor would send them. */
export async function runIntakeRound(
  services: IntakeServices,
  options: IntakeRoundOptions = {},
): Promise<IntakeRoundResult> {
  const { cases = GOLDEN_INTAKES, runsPerCase = INTAKE_RUNS_PER_CASE, onRun } = options;
  const calls = cases.length * runsPerCase;
  const capUsd = options.capUsd ?? calls * INTAKE_CALL_WORST_USD;
  const bench = benchFor(services, calls, capUsd);
  const started = performance.now();
  const runs: IntakeRoundRun[] = [];
  for (let run = 1; run <= runsPerCase; run++) {
    for (const golden of cases) {
      const done = await readOnce(golden, run, bench);
      runs.push(done);
      onRun?.(done);
    }
  }
  return {
    runs,
    checks: scoreIntakeSet(runs.map(({ score }) => score)),
    gate: gateOf(runs, runsPerCase),
    runsPerCase,
    msElapsed: performance.now() - started,
  };
}

/** One line a run, for following a round while it runs. */
export function intakeRunLine({ name, run, result, record, score }: IntakeRoundRun): string {
  const findings = Object.values(score).reduce((sum, tally) => sum + tally.findings.length, 0);
  const cost = record?.costUsd == null ? "" : ` ${usd(record.costUsd)}`;
  const time = record === null ? "" : ` ${record.msToFinish} ms`;
  return `intake run ${run} · ${name}: ${result.kind}${cost}${time}, ${findings} findings`;
}

/** How the route records a city Geoapify could not look up (`answer-intake.ts`). */
const LOOKUP_FAILED: IntakeFailureType = "city-lookup-failed";

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/**
 * The outcome check again without the runs whose city lookup failed: the model's answer
 * never reached the visitor there, so they measure Geoapify, not the prompt.
 */
function outcomeWithoutLookupLines(runs: readonly IntakeRoundRun[]): string[] {
  const isLookupFailure = (run: IntakeRoundRun) => run.record?.error?.type === LOOKUP_FAILED;
  const failed = runs.filter(isLookupFailure).length;
  if (failed === 0) return [];
  const rest = runs.filter((run) => !isLookupFailure(run));
  const accepted = rest.filter(({ score }) => score.outcome.findings.length === 0).length;
  const share = rest.length === 0 ? 0 : accepted / rest.length;
  const runsWord = failed === 1 ? "run" : "runs";
  return [
    `  outcome, leaving out ${failed} ${runsWord} whose city lookup failed: ${accepted} of ${rest.length}, ${percent(share)}`,
  ];
}

function measuredOf({ kind, value, findings }: CheckResult<IntakeCheckId>): string {
  if (kind === "hard") return `${findings.length} missed`;
  return percent(value ?? 0);
}

function checkRows(checks: readonly CheckResult<IntakeCheckId>[]): string[][] {
  return [
    ["check", "kind", "measured", "threshold", "verdict"],
    ...checks.map((check) => [
      check.id,
      check.kind,
      measuredOf(check),
      check.threshold === null ? "" : `${Math.round(check.threshold * 100)}%`,
      check.passed ? "pass" : "FAIL",
    ]),
  ];
}

function gateLines(gate: readonly GateRow[], runsPerCase: number): string[] {
  // A round of other cases, as the suggestions', says nothing of the gate.
  const unrun = gate.filter(({ runs }) => runs.length === 0).map(({ name }) => name);
  if (unrun.length > 0) {
    return [
      `The live intake gate (docs/harness.md, "B. The intake eval", "The live intake gate") is not read: no ${unrun.join(" or ")} in this round.`,
    ];
  }
  const isOn = gate.every((row) => row.passed);
  return [
    `The live intake gate (docs/harness.md, "B. The intake eval", "The live intake gate"), ${runsPerCase} runs in a row each:`,
    ...table(
      gate.map(({ name, runs, passed }) => [
        name,
        ...runs.map((isPass) => (isPass ? "pass" : "FAIL")),
        passed ? "→ passes" : "→ fails",
      ]),
    ),
    isOn
      ? "  The gate passes; turning live intake on is still the owner's call."
      : "  The gate fails: live intake stays off.",
  ];
}

function caseRows(runs: readonly IntakeRoundRun[]): string[][] {
  const names = [...new Set(runs.map(({ name }) => name))];
  return names.map((name) => {
    const mine = runs.filter((run) => run.name === name);
    const findings = mine.reduce(
      (sum, { score }) =>
        sum + Object.values(score).reduce((count, tally) => count + tally.findings.length, 0),
      0,
    );
    return [
      name,
      ...mine.map(({ result }) => result.kind),
      findings === 0 ? "" : `${findings} findings`,
    ];
  });
}

function findingLines(runs: readonly IntakeRoundRun[]): string[] {
  return runs.flatMap(({ run, score }) =>
    Object.entries(score).flatMap(([id, { findings }]) =>
      findings.map((finding) => `  run ${run}, ${id}: ${finding}`),
    ),
  );
}

function failureLines(runs: readonly IntakeRoundRun[]): string[] {
  return runs.flatMap(({ name, run, result, record }) => {
    if (record === null) return [`  ${name}, run ${run}: ${result.kind}, before any call`];
    const { error } = record;
    if (error === null) return [];
    return [
      `  ${name}, run ${run}: ${error.type ?? "error"} ${error.status ?? ""} ${error.message}`,
    ];
  });
}

/** The round as a reader takes it in: the checks, the gate, each case, then what missed. */
export function intakeReport(round: IntakeRoundResult): string[] {
  const records = round.runs.flatMap(({ record }) => (record === null ? [] : [record]));
  const spent = records.reduce((sum, { costUsd }) => sum + (costUsd ?? 0), 0);
  const unpriced = records.filter(({ costUsd }) => costUsd === null).length;
  const cases = new Set(round.runs.map(({ name }) => name)).size;
  const findings = findingLines(round.runs);
  const failures = failureLines(round.runs);
  return [
    `Intake round: ${INTAKE_PROMPT_VERSION} on ${MODEL_IDS.intake}, ${cases} cases × ${round.runsPerCase} runs.`,
    `Spent ${usd(spent)} over ${records.length} calls (${unpriced} without usage) in ${elapsed(round.msElapsed)}.`,
    "",
    ...table(checkRows(round.checks)),
    ...outcomeWithoutLookupLines(round.runs),
    "",
    ...gateLines(round.gate, round.runsPerCase),
    "",
    "Each case, by run:",
    ...table(caseRows(round.runs)),
    "",
    findings.length === 0 ? "No findings." : "Findings:",
    ...findings,
    ...(failures.length === 0
      ? []
      : ["", "Calls that ended without the model's answer:", ...failures]),
  ];
}
