import { replanFrameOf, dayAfterReplan } from "@/features/abacus/replan-frame";
import type { GoldenReplan } from "@/lib/fixtures/replan/golden-replans";
import type { LiveConfigResult } from "@/lib/live/flag";
import {
  InMemoryGenerationLog,
  type DayArchive,
  type GenerationRecord,
  type KeptRecord,
} from "@/lib/live/generation-log";
import { InMemoryAppSpend, InMemoryVisitorLimits } from "@/lib/live/limits";
import type { StreamingModel } from "@/lib/live/streamed-call";
import {
  answerReplanRequest,
  REPLAN_RESERVE_USD,
  type LiveReplanDeps,
} from "@/lib/live/live-replan";
import type { ServerLog } from "@/lib/live/provider-error";
import { generatedDayOf } from "@/lib/normalizer/generated-day";
import {
  droppedStopsOf,
  mergeShownReplan,
  yieldedTo,
  type MergeResult,
  type ReplanBasis,
} from "@/lib/replan/merge";
import { replanIdPrefix, withPicks, type ReplanRequest } from "@/lib/replan/request";
import { replanPlanOf, type WindowSpan } from "@/lib/replan/windows";
import type { Itinerary, Stop } from "@/lib/schema/itinerary.schema";
import { GeneratedReplanSchema } from "@/lib/schema/replan.schema";
import { escapedLettersIn, withLettersUnescaped } from "@/lib/stream/escaped-letters";
import type { DayOutcome } from "@/lib/stream/outcome";
import { readReplanStream } from "@/lib/stream/read-replan-stream";
import { runQualityChecks, type CheckId, type CheckResult } from "@/lib/quality/checks";
import {
  checkReplanDrops,
  checkReplanGap,
  checkReplanTimeWords,
} from "@/lib/quality/replan-checks";
import { afterQueue, elapsed, table, usd, type AfterQueue } from "./round";
import { measureOf } from "./tally";

/**
 * The targeted re-plan's golden set written live (`docs/targeted-replan.md`, section 6), each
 * case through the re-plan route's own code (`answerReplanRequest`), one at a time, and read as
 * the page reads it: the stream through `readReplanStream`, each partial made a frame by
 * `replanFrameOf`. The round measures what the contract promises: the stops outside the windows
 * come back byte for byte, the new ones pass the day's checks on the merged day, and the
 * changed word is kept; and how long the first new stop takes, and what each case costs.
 */

export interface ReplanServices {
  config: LiveConfigResult;
  /** The day's model: a re-plan is written by Sonnet alone. */
  model: StreamingModel;
  log: ServerLog;
  newId: () => string;
  now: () => Date;
  maxRetries?: number;
  /** Milliseconds, for the times the page would see; tests give their own. */
  clock?: () => number;
}

export interface ReplanRoundOptions {
  /** The round's own cap; its worst case unless a test sets less. */
  capUsd?: number;
  onRun?: (run: ReplanRoundRun) => void;
}

export interface ReplanRoundRun {
  /** From 1, in the golden set's order. */
  index: number;
  name: string;
  source: string;
  changed: GoldenReplan["changed"];
  /** The changed word's new value. */
  value: string | null;
  /** The windows written by hand in the golden set. */
  handWindows: WindowSpan[];
  /** The windows the route reads from the day itself; null where it re-plans the whole day. */
  routeWindows: WindowSpan[] | null;
  /**
   * The windows the run was written into: the route's own, or for a case marked by hand its
   * hand windows, which the route was given in place of its plan; null for the whole day.
   */
  writtenWindows: WindowSpan[] | null;
  status: number;
  outcome: DayOutcome["kind"] | null;
  record: GenerationRecord | null;
  /** From the request to the first frame with a new stop, and to the first whole one. */
  msToFirstNewStop: number | null;
  msToFirstWholeStop: number | null;
  msToEnd: number;
  frames: number;
  /** The first error a frame or the day after the re-plan threw; null when none did. */
  frameError: string | null;
  /**
   * Whether every stop outside the windows came back byte for byte, merged as the server merges,
   * but for the versions off screen a new stop's place took (`yieldedTo`).
   */
  keptIdentical: boolean | null;
  /** How many versions off screen the kept stops gave up to new stops at their places. */
  versionsYielded: number;
  newStops: number;
  /** New stops that name the changed word among the words that shaped them. */
  newStopsNamingWord: number;
  /** The day's checks on the merged day, written back as the model writes a day. */
  checks: CheckResult[] | null;
  /**
   * The same checks on the day as it was, under the request with the changed word, so a fault
   * the kept stops carried in is not taken for the re-plan's.
   */
  checksBefore: CheckResult[];
  /** The merged day's failed findings that name a new stop, by check: what the re-plan wrote. */
  findingsOnNewStops: Partial<Record<CheckId, number>>;
  /** Letters the re-plan escaped twice, as written; the reader unescapes them. */
  escapedLetters: number;
  /**
   * Why the visitor is not shown the merged day (`mergeShownReplan`): a dropped new stop, an
   * empty window, a day the schema refuses. Null when it is shown, or when no re-plan was read.
   */
  notShownReason: string | null;
  /** `replan-time-words`, `replan-gap` and `replan-drops` on the day the re-plan merged into; null with no re-plan read. */
  replanChecks: ReplanChecks | null;
  /** The new stops the merge left out, by cause: the merge's three and the normalizer's. */
  dropsByCause: Record<DropCause, number>;
}

export const DROP_CAUSES = [
  "outside-windows",
  "dropped-at-kept",
  "dropped-repeat",
  "dropped-stop",
] as const;

export type DropCause = (typeof DROP_CAUSES)[number];

export interface ReplanChecks {
  timeWords: CheckResult;
  gap: CheckResult;
  drops: CheckResult;
}

export interface ReplanRoundResult {
  runs: ReplanRoundRun[];
  msElapsed: number;
}

const REPLAN_URL = "http://lantern.eval/api/replan";
const EVAL_VISITOR_ADDRESS = "192.0.2.1";
/** The re-plan route's `maxDuration`: in this process nothing else ends one that hangs. */
const REPLAN_TIMEOUT_MS = 90_000;
const HTTP_OK = 200;
const ROUND = 1;

/** How long before the round each case's day was kept: written, and well inside its link's days. */
const KEPT_BEFORE_MS = 60_000;

interface Bench {
  deps: LiveReplanDeps;
  generationLog: InMemoryGenerationLog;
  queue: AfterQueue;
  /** The id each case's day is kept under, as the page names it to the route. */
  idOf: ReadonlyMap<GoldenReplan, string>;
  /** The windows marked by hand for the run on its way, which the route then writes into. */
  handWindows: { current: WindowSpan[] | null };
}

/** How many calls a round's cases make in all, each as many times as its runs. */
export function callsOf(cases: readonly GoldenReplan[]): number {
  return cases.reduce((sum, { runs }) => sum + runs, 0);
}

/**
 * Each case's day as the log keeps a live day, from the golden line's own fields, so the route
 * reads it as it reads any day it re-plans (`docs/security.md`, S1): no place checks, so at the
 * model's points, as the golden itinerary is.
 */
function keptRecordOf(golden: GoldenReplan, id: string, now: Date): KeptRecord {
  return {
    id,
    promptVersion: "golden",
    startedAt: new Date(now.getTime() - KEPT_BEFORE_MS).toISOString(),
    msToFinish: 0,
    outcome: "complete",
    salvaged: null,
    request: golden.dayRequest,
    outputText: golden.outputText,
    placeChecks: {},
  };
}

function benchFor(services: ReplanServices, cases: readonly GoldenReplan[], capUsd: number): Bench {
  const generationLog = new InMemoryGenerationLog();
  const queue = afterQueue();
  const idOf = new Map(cases.map((golden) => [golden, crypto.randomUUID()]));
  const kept = new Map(
    cases.map((golden) => {
      const id = idOf.get(golden) ?? "";
      return [id, keptRecordOf(golden, id, services.now())];
    }),
  );
  const dayArchive: DayArchive = { dayRecordOf: (id) => Promise.resolve(kept.get(id) ?? null) };
  const handWindows: Bench["handWindows"] = { current: null };
  const deps: LiveReplanDeps = {
    config: services.config,
    model: services.model,
    log: services.log,
    newId: services.newId,
    now: services.now,
    maxRetries: services.maxRetries,
    visitorLimits: new InMemoryVisitorLimits({ day: callsOf(cases), intake: 0 }),
    appSpend: new InMemoryAppSpend({ dailyUsd: capUsd, monthlyUsd: null }),
    generationLog,
    dayArchive,
    schedule: queue.schedule,
    // A case marked by hand is written into its own windows; any other into the route's.
    planOf: (itinerary, request, changed) =>
      handWindows.current === null
        ? replanPlanOf(itinerary, request, changed)
        : { kind: "targeted", windows: handWindows.current },
  };
  return { deps, generationLog, queue, idOf, handWindows };
}

function isInWindows(index: number, windows: readonly WindowSpan[]): boolean {
  return windows.some(({ from, to }) => index >= from && index <= to);
}

/** The case's re-plan as the visitor is shown it: from the record's text and the day as it was sent. */
function mergedOnServer(
  record: GenerationRecord | null,
  basis: ReplanBasis,
): { basis: ReplanBasis; replan: unknown; shown: MergeResult } | null {
  if (record === null || record.outputText === "") return null;
  let replan: unknown;
  try {
    replan = JSON.parse(record.outputText);
  } catch {
    return null;
  }
  const parsed = GeneratedReplanSchema.safeParse(replan);
  if (!parsed.success) return null;
  // The route reads the day from the log's text, not the objects the page holds.
  const sent: ReplanBasis = {
    ...basis,
    itinerary: JSON.parse(JSON.stringify(basis.itinerary)) as Itinerary,
  };
  const shown = mergeShownReplan({ ...sent, replan: withLettersUnescaped(parsed.data) });
  return { basis: sent, replan, shown };
}

function dropsByCauseOf(shown: MergeResult | null): Record<DropCause, number> {
  const counts = Object.fromEntries(DROP_CAUSES.map((cause) => [cause, 0])) as Record<
    DropCause,
    number
  >;
  if (shown === null) return counts;
  for (const { kind } of droppedStopsOf(shown)) counts[kind as DropCause] += 1;
  return counts;
}

/**
 * The stops a re-plan wrote, in the merged day: every stop but those outside its windows, by
 * id. A new stop at a window stop's place and start keeps that stop's id (`stayingStopOf`), so
 * an id's prefix alone does not say which stops the re-plan wrote.
 */
function isWrittenBy(keptIds: ReadonlySet<string>) {
  return ({ id }: Stop): boolean => !keptIds.has(id);
}

/** The stop a finding is about, by its index in the day: `stops[3]…` or `alternatives[3]…`. */
const FINDING_STOP = /^(?:stops|alternatives)\[(\d+)\]/;

/**
 * The merged day's findings that name a new stop, counted by check: those of a failed check,
 * and those of a measure, a scored check whose threshold of 0 never fails a day (`meal-name`,
 * `meal-name-lines`), whose findings are all it says. A finding names its stop by index, which
 * the new stops shift for every kept stop after them, so it is read against the merged day's
 * own stops, whose ids say which the re-plan kept; a finding about the whole day, such as the flow's,
 * names no stop and is left to the check's result.
 */
function findingsOnNewStopsOf(
  checks: readonly CheckResult[],
  stops: readonly Stop[],
  keptIds: ReadonlySet<string>,
): Partial<Record<CheckId, number>> {
  const counts: Partial<Record<CheckId, number>> = {};
  for (const { id, kind, passed, threshold, findings } of checks) {
    const isMeasure = kind === "scored" && threshold === 0;
    if (passed && !isMeasure) continue;
    const onNew = findings.filter((finding) => {
      const index = FINDING_STOP.exec(finding)?.[1];
      const stop = index === undefined ? undefined : stops[Number(index)];
      return stop !== undefined && isWrittenBy(keptIds)(stop);
    }).length;
    if (onNew > 0) counts[id] = onNew;
  }
  return counts;
}

interface Frames {
  count: number;
  firstNew: number | null;
  firstWhole: number | null;
  error: string | null;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

async function replanOnce(golden: GoldenReplan, bench: Bench, clock: () => number) {
  const isByHand = golden.windowsFrom === "hand";
  bench.handWindows.current = isByHand ? golden.windows : null;
  const plan = replanPlanOf(golden.itinerary, golden.request, golden.changed);
  const routeWindows = plan.kind === "targeted" ? plan.windows : null;
  const writtenWindows = isByHand ? golden.windows : routeWindows;
  // The day as the page holds it, its picked stops planned on the visitor's places, as the
  // route reads it too (`withPicks`).
  const basis: ReplanBasis = {
    itinerary: withPicks(golden.itinerary, golden.picks),
    request: golden.request,
    changed: golden.changed,
    windows: writtenWindows ?? [],
    idPrefix: replanIdPrefix(ROUND),
  };
  const body: ReplanRequest = {
    basis: { kind: "kept", id: bench.idOf.get(golden) ?? "" },
    request: golden.request,
    changed: golden.changed,
    round: ROUND,
    picks: golden.picks,
  };
  const before = bench.generationLog.records.length;
  const started = clock();
  const response = await answerReplanRequest(
    new Request(REPLAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": EVAL_VISITOR_ADDRESS },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REPLAN_TIMEOUT_MS),
    }),
    bench.deps,
  );
  const frames: Frames = { count: 0, firstNew: null, firstWhole: null, error: null };
  let outcome: DayOutcome | null = null;
  if (response.status === HTTP_OK) {
    outcome = await readReplanStream({
      basis,
      response: Promise.resolve(response),
      onPartial: (partial) => {
        frames.count += 1;
        try {
          const { rows } = replanFrameOf(basis, partial);
          const at = clock() - started;
          if (frames.firstNew === null && rows.some(({ source }) => source === "proposed")) {
            frames.firstNew = at;
          }
          const isWhole = rows.some((row) => row.source === "proposed" && row.isWhole);
          if (frames.firstWhole === null && isWhole) frames.firstWhole = at;
        } catch (cause) {
          frames.error ??= messageOf(cause);
        }
      },
    });
    try {
      dayAfterReplan(basis, outcome);
    } catch (cause) {
      frames.error ??= messageOf(cause);
    }
  } else {
    await response.text();
  }
  const msToEnd = clock() - started;
  await bench.queue.drain();
  const record = bench.generationLog.records.slice(before).at(-1) ?? null;
  return { routeWindows, writtenWindows, basis, response, outcome, frames, msToEnd, record };
}

async function runOnce(
  golden: GoldenReplan,
  index: number,
  bench: Bench,
  clock: () => number,
): Promise<ReplanRoundRun> {
  const { routeWindows, writtenWindows, basis, response, outcome, frames, msToEnd, record } =
    await replanOnce(golden, bench, clock);
  const read = mergedOnServer(record, basis);
  const merged = read?.shown.ok ? { itinerary: read.shown.itinerary } : null;
  const keptBefore = basis.itinerary.stops.filter((_, at) => !isInWindows(at, basis.windows));
  const keptIds = new Set(keptBefore.map(({ id }) => id));
  const newStops = merged?.itinerary.stops.filter(isWrittenBy(keptIds)) ?? [];
  const newNames = newStops.map(({ primary }) => primary.name);
  const checks =
    merged === null ? null : runQualityChecks(golden.request, generatedDayOf(merged.itinerary));
  return {
    index,
    name: golden.name,
    source: golden.source,
    changed: golden.changed,
    value: golden.request[golden.changed],
    handWindows: golden.windows,
    routeWindows,
    writtenWindows,
    status: response.status,
    outcome: outcome?.kind ?? null,
    record,
    msToFirstNewStop: frames.firstNew,
    msToFirstWholeStop: frames.firstWhole,
    msToEnd,
    frames: frames.count,
    frameError: frames.error,
    keptIdentical:
      merged === null
        ? null
        : JSON.stringify(merged.itinerary.stops.filter(({ id }) => keptIds.has(id))) ===
          JSON.stringify(keptBefore.map((stop) => yieldedTo(stop, newNames))),
    versionsYielded:
      read?.shown.mergeRepairs.filter(({ kind }) => kind === "yielded-version").length ?? 0,
    newStops: newStops.length,
    newStopsNamingWord: newStops.filter(({ dependsOn }) => dependsOn.includes(golden.changed))
      .length,
    checks,
    checksBefore: runQualityChecks(golden.request, generatedDayOf(golden.itinerary)),
    findingsOnNewStops:
      merged === null || checks === null
        ? {}
        : findingsOnNewStopsOf(checks, merged.itinerary.stops, keptIds),
    escapedLetters: record === null ? 0 : escapedLettersIn(record.outputText).length,
    notShownReason: read === null || read.shown.ok ? null : read.shown.reason,
    replanChecks:
      read === null
        ? null
        : {
            timeWords: checkReplanTimeWords(read.basis, read.replan),
            gap: checkReplanGap(read.basis, read.replan),
            drops: checkReplanDrops(read.basis, read.replan),
          },
    dropsByCause: dropsByCauseOf(read?.shown ?? null),
  };
}

/** Each case, one at a time, under one cap at the round's worst case. */
export async function runReplanRound(
  services: ReplanServices,
  cases: readonly GoldenReplan[],
  options: ReplanRoundOptions = {},
): Promise<ReplanRoundResult> {
  const capUsd = options.capUsd ?? callsOf(cases) * REPLAN_RESERVE_USD;
  const bench = benchFor(services, cases, capUsd);
  const clock = services.clock ?? (() => performance.now());
  const started = clock();
  const runs: ReplanRoundRun[] = [];
  for (const golden of cases) {
    for (let again = 0; again < golden.runs; again += 1) {
      const run = await runOnce(golden, runs.length + 1, bench, clock);
      runs.push(run);
      options.onRun?.(run);
    }
  }
  return { runs, msElapsed: clock() - started };
}

function spans(windows: readonly WindowSpan[] | null): string {
  if (windows === null) return "whole day";
  return windows.map(({ from, to }) => `[${from}..${to}]`).join(" ");
}

/** The windows a run was written into, those marked by hand said so beside the route's own. */
function writtenSpans(run: ReplanRoundRun): string {
  const written = spans(run.writtenWindows);
  return JSON.stringify(run.writtenWindows) === JSON.stringify(run.routeWindows)
    ? written
    : `${written} by hand (the route's: ${spans(run.routeWindows)})`;
}

function seconds(ms: number | null): string {
  return ms === null ? "-" : `${(ms / 1000).toFixed(1)} s`;
}

function measured({ id, value }: CheckResult): string {
  return value === null ? id : `${id} ${measureOf(id, value)}`;
}

function listed(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.join(", ");
}

function failedChecks(checks: readonly CheckResult[] | null): string {
  if (checks === null) return "no merged day";
  return listed(checks.filter(({ passed }) => !passed).map(measured));
}

/**
 * The merged day's checks against the day before, by check: what the re-plan made fail, what
 * it mended and what still fails, then how many failed findings name a new stop. A check that
 * failed before can still gain a fault from the re-plan, which only the last count shows.
 */
function againstDayBefore(run: ReplanRoundRun): string {
  if (run.checks === null) return "no merged day to hold against the day before";
  const failedBefore = new Set(
    run.checksBefore.filter(({ passed }) => !passed).map(({ id }) => id),
  );
  const failed = run.checks.filter(({ passed }) => !passed);
  const added = failed.filter(({ id }) => !failedBefore.has(id)).map(measured);
  const still = failed.filter(({ id }) => failedBefore.has(id)).map(measured);
  const mended = run.checks.filter(({ id, passed }) => passed && failedBefore.has(id));
  const onNew = Object.entries(run.findingsOnNewStops).map(([id, count]) => `${id} ${count}`);
  return `against the day before, added ${listed(added)}; mended ${listed(mended.map(({ id }) => id))}; still failing ${listed(still)}; findings on new stops: ${listed(onNew)}`;
}

/** Whether the merged day keeps the changed word, by `time-words`' findings; "-" for another word. */
function wordKept(run: ReplanRoundRun): string {
  const timeWords = run.checks?.find(({ id }) => id === "time-words");
  if (timeWords === undefined) return "-";
  const missed = timeWords.findings.find((finding) => finding.startsWith(`${run.changed}:`));
  return missed === undefined ? "kept" : `missed: ${missed}`;
}

function verdictOf(check: CheckResult | undefined): string {
  if (check === undefined) return "-";
  return check.passed ? "pass" : "fail";
}

/** The drops by cause, in the order the table's header names them; "-" with no re-plan read. */
function dropsOf(run: ReplanRoundRun): string {
  if (run.replanChecks === null) return "-";
  return DROP_CAUSES.map((cause) => run.dropsByCause[cause]).join(" / ");
}

/** What each of the new checks found, for the detail line under the table. */
function replanFindings(run: ReplanRoundRun): string {
  if (run.replanChecks === null) return "no re-plan read";
  const { timeWords, gap, drops } = run.replanChecks;
  const said = ({ id, passed, findings }: CheckResult) =>
    passed ? `${id} pass` : `${id} fail: ${findings.join("; ")}`;
  return [timeWords, gap, drops].map(said).join("; ");
}

function windowsCheck(record: GenerationRecord | null): string {
  const check = record?.checks?.find(({ id }) => id === "replan-windows");
  if (check === undefined) return "-";
  return check.passed ? "pass" : `fail: ${check.findings.join("; ")}`;
}

/** One line a case, for following a round while it runs. */
export function replanRunLine(run: ReplanRoundRun): string {
  const cost = run.record?.costUsd == null ? "" : ` ${usd(run.record.costUsd)}`;
  const faults = structureFaultsOf(run);
  const structure = faults.length === 0 ? "structure ok" : `STRUCTURE FAIL: ${faults.join(", ")}`;
  return `#${run.index} ${run.name}: ${structure}; ${run.status} ${run.outcome ?? "no stream"}${cost}, windows ${writtenSpans(run)}, first new stop ${seconds(run.msToFirstNewStop)}, end ${seconds(run.msToEnd)}, kept ${run.keptIdentical === null ? "-" : run.keptIdentical ? "same" : "CHANGED"}${run.versionsYielded > 0 ? ` (${run.versionsYielded} version yielded)` : ""}, checks failed: ${failedChecks(run.checks)}${run.notShownReason === null ? "" : `, NOT SHOWN: ${run.notShownReason}`}`;
}

/**
 * Whether a run's re-plan holds the targeted contract, each fault named: it was answered and
 * streamed whole, the visitor is shown it (no window left empty, nothing dropped, the schema
 * reads it), the kept stops came back byte for byte, and no new stop fell outside the windows,
 * on a kept place, on a place written twice or out of the day.
 */
export function structureFaultsOf(run: ReplanRoundRun): string[] {
  const drops = DROP_CAUSES.filter((cause) => run.dropsByCause[cause] > 0).map(
    (cause) => `${run.dropsByCause[cause]} ${cause}`,
  );
  return [
    ...(run.status === HTTP_OK ? [] : [`answered ${run.status}`]),
    ...(run.status !== HTTP_OK || run.outcome === "complete"
      ? []
      : [`ended ${run.outcome ?? "with no stream"}`]),
    ...(run.notShownReason === null ? [] : [`not shown (${run.notShownReason})`]),
    ...(run.keptIdentical === false ? ["kept stops changed"] : []),
    ...drops,
  ];
}

/**
 * The round's report: a row for each case, then what it spent. The provider's first token
 * stands beside the first new stop, so a slow start reads as the provider's or the stream's
 * at a glance: on one round two cases waited 8 to 9 s for it.
 */
export function replanReport({ runs, msElapsed }: ReplanRoundResult): string[] {
  const spent = runs.reduce((sum, { record }) => sum + (record?.costUsd ?? 0), 0);
  const rows = [
    [
      "#",
      "case",
      "word",
      "windows: hand / route",
      "outcome",
      "replan-windows",
      "time-words",
      "gap",
      "drops (outside / at kept / repeat / stop)",
      "kept",
      "new (name word)",
      "first token",
      "first new",
      "first whole",
      "end",
      "tokens in/out",
      "cost",
    ],
    ...runs.map((run) => [
      String(run.index),
      run.name,
      `${run.changed} ${run.value ?? "null"}`,
      `${spans(run.handWindows)} / ${spans(run.routeWindows)}`,
      `${run.status} ${run.outcome ?? "-"}`,
      windowsCheck(run.record).startsWith("fail") ? "fail" : windowsCheck(run.record),
      verdictOf(run.replanChecks?.timeWords),
      verdictOf(run.replanChecks?.gap),
      dropsOf(run),
      run.keptIdentical === null ? "-" : run.keptIdentical ? "same" : "CHANGED",
      `${run.newStops} (${run.newStopsNamingWord})`,
      seconds(run.record?.msToFirstToken ?? null),
      seconds(run.msToFirstNewStop),
      seconds(run.msToFirstWholeStop),
      seconds(run.msToEnd),
      run.record === null
        ? "-"
        : `${run.record.tokens.input ?? "?"}/${run.record.tokens.output ?? "?"}`,
      run.record?.costUsd == null ? "-" : usd(run.record.costUsd),
    ]),
  ];
  const details = runs.flatMap((run) => [
    `  #${run.index} ${run.name}: the word ${wordKept(run)}; ${againstDayBefore(run)}; replan-windows ${windowsCheck(run.record)}; ${replanFindings(run)}; ${run.notShownReason === null ? "shown" : `NOT SHOWN: ${run.notShownReason}`}; letters escaped twice ${run.escapedLetters}; ${run.frames} frames${run.frameError === null ? "" : `, a frame threw: ${run.frameError}`}.`,
  ]);
  return [
    `Re-plan round: ${new Set(runs.map(({ name }) => name)).size} golden cases in ${runs.length} calls, spent ${usd(spent)} in ${elapsed(msElapsed)}.`,
    "",
    ...table(rows),
    "",
    ...details,
  ];
}
