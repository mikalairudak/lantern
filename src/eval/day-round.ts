import { isSameRequest } from "@/lib/days/request";
import { CITY_SIGNATURE_HEADER } from "@/lib/intake/signed-city";
import { citySignatureKey, signCity } from "@/lib/live/city-signature";
import type { LiveConfigResult } from "@/lib/live/flag";
import { InMemoryGenerationLog, type GenerationRecord } from "@/lib/live/generation-log";
import { DAY_PROMPT_VERSION } from "@/lib/live/day-prompt";
import { InMemoryAppSpend, InMemoryVisitorLimits } from "@/lib/live/limits";
import { liveDayOf, type LiveDayDeps } from "@/lib/live/live-day";
import type { StreamingModel } from "@/lib/live/streamed-call";
import { MODEL_IDS } from "@/lib/live/models";
import type { ServerLog } from "@/lib/live/provider-error";
import { DayRequestSchema, type DayRequest } from "@/lib/schema/itinerary.schema";
import { answerDayRequest, WRITTEN_DAY_PACE } from "@/lib/stream/answer-day-request";
import type { CheckResult } from "@/lib/quality/checks";
import {
  afterQueue,
  DAY_WORST_USD,
  dayKindOf,
  elapsed,
  table,
  usd,
  type AfterQueue,
  type DayKind,
} from "./round";
import { measureOf, tallyOf } from "./tally";
import {
  addReach,
  NO_REACH,
  REACH_HEADER,
  reachOfOutput,
  reachRow,
} from "@/lib/quality/version-reach";

/**
 * Day requests written live, each a day and its shadow, through the day route's own code
 * (`answerDayRequest` with `liveDayOf`), one at a time. The route scores the day it kept with
 * the quality checks and records it; the round reads the records, and compares them with a
 * baseline's, such as the first live pass's ten days on day-v0.
 */

/** What the day round calls: Sonnet and Haiku on the server's key, or fakes. */
export interface DayServices {
  config: LiveConfigResult;
  models: { day: StreamingModel; shadow: StreamingModel };
  log: ServerLog;
  newId: () => string;
  now: () => Date;
  maxRetries?: number;
}

export interface DayRoundOptions {
  /** The round's own cap; its worst case unless a test sets less. */
  capUsd?: number;
  onRun?: (run: DayRoundRun) => void;
}

export interface DayRoundRun {
  /** From 1, in the order the requests were given. */
  index: number;
  body: DayRequest;
  kind: DayKind;
  /** The route's status; null for a request the round did not send. */
  status: number | null;
  day: GenerationRecord | null;
  shadow: GenerationRecord | null;
}

export interface DayRoundResult {
  runs: DayRoundRun[];
  msElapsed: number;
}

/**
 * A record from another round to compare with: its role, the checks it scored, and the
 * request it answered where the record carries one, so a round of a few requests compares
 * with the same requests' records and not with a whole earlier round.
 */
export type BaselineRecord = Pick<GenerationRecord, "role" | "checks"> & {
  request?: DayRequest | null;
};

/** Day requests from JSON lines, each checked against the schema, so a bad line stops the round. */
export function dayBodiesOf(text: string): DayRequest[] {
  return text
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== "")
    .map(({ line, number }) => {
      const parsed = DayRequestSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`Line ${number} is not a day request: ${parsed.error.message}`);
      }
      return parsed.data;
    });
}

function baselineRecordOf(row: unknown, number: number): BaselineRecord {
  const { role, checks, request } = (row ?? {}) as Partial<BaselineRecord>;
  if (typeof role !== "string" || !(checks === null || Array.isArray(checks))) {
    throw new Error(`Baseline record ${number} has no role or no checks`);
  }
  const parsed = DayRequestSchema.safeParse(request);
  return parsed.success ? { role, checks, request: parsed.data } : { role, checks };
}

/** An earlier round's `day-runs.jsonl`: each line a request's run, its day and its shadow. */
function recordsOfRuns(text: string): unknown[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      const { day, shadow } = JSON.parse(line) as { day?: unknown; shadow?: unknown };
      return [day, shadow].filter((record) => record != null);
    });
}

/**
 * Records to compare with: a JSON array of the route's own records or of rows exported from
 * `generation_log`, which carry `role` and `checks` under the same names, or an earlier
 * round's `day-runs.jsonl`, whose records carry their requests too.
 */
export function baselineOf(text: string): BaselineRecord[] {
  const isArray = text.trimStart().startsWith("[");
  const rows: unknown = isArray ? JSON.parse(text) : recordsOfRuns(text);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("A baseline is a JSON array of records, or a round's day-runs.jsonl");
  }
  return rows.map((row: unknown, index) => baselineRecordOf(row, index + 1));
}

const DAY_URL = "http://lantern.eval/api/day";
const EVAL_VISITOR_ADDRESS = "192.0.2.1";
/** The day route's `maxDuration`: in this process nothing else ends a day that hangs. */
const DAY_TIMEOUT_MS = 150_000;

/** The request as the page sends it, with the intake's signature of its city when there is one. */
function dayRequestFor(body: DayRequest, signature: string | null): Request {
  return new Request(DAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-real-ip": EVAL_VISITOR_ADDRESS,
      ...(signature === null ? {} : { [CITY_SIGNATURE_HEADER]: signature }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DAY_TIMEOUT_MS),
  });
}

interface Bench {
  deps: LiveDayDeps;
  generationLog: InMemoryGenerationLog;
  queue: AfterQueue;
  /** The intake's signing key, from the same salt; null when the deploy left the salt out. */
  signingKey: CryptoKey | null;
}

async function benchFor(services: DayServices, days: number, capUsd: number): Promise<Bench> {
  const generationLog = new InMemoryGenerationLog();
  const queue = afterQueue();
  const deps: LiveDayDeps = {
    ...services,
    visitorLimits: new InMemoryVisitorLimits({ day: days, intake: 0 }),
    appSpend: new InMemoryAppSpend({ dailyUsd: capUsd, monthlyUsd: null }),
    generationLog,
    dayArchive: generationLog,
    schedule: queue.schedule,
  };
  const signingKey =
    services.config.kind === "ready"
      ? await citySignatureKey(services.config.config.visitorHashSalt)
      : null;
  return { deps, generationLog, queue, signingKey };
}

/** Reads the stream to its end, as the visitor's page would; a stream cut by the timeout ends it. */
async function readToEnd(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // The day's record says how it ended.
  }
}

async function writeOnce(body: DayRequest, index: number, bench: Bench): Promise<DayRoundRun> {
  const before = bench.generationLog.records.length;
  const { city, timezone } = body;
  const signature =
    bench.signingKey === null
      ? null
      : (await signCity(bench.signingKey, { city, timezone })).signature;
  const response = await answerDayRequest(
    dayRequestFor(body, signature),
    WRITTEN_DAY_PACE,
    liveDayOf(bench.deps),
  );
  await readToEnd(response);
  await bench.queue.drain();
  const added = bench.generationLog.records.slice(before);
  return {
    index,
    body,
    kind: "live",
    status: response.status,
    day: added.find(({ role }) => role === "day") ?? null,
    shadow: added.find(({ role }) => role === "shadow") ?? null,
  };
}

/** Every request the model would write, in order; the others are listed and not sent. */
export async function runDayRound(
  services: DayServices,
  bodies: readonly DayRequest[],
  options: DayRoundOptions = {},
): Promise<DayRoundResult> {
  const kinds = bodies.map(dayKindOf);
  const liveDays = kinds.filter((kind) => kind === "live").length;
  const capUsd = options.capUsd ?? liveDays * DAY_WORST_USD;
  const bench = await benchFor(services, liveDays, capUsd);
  const started = performance.now();
  const runs: DayRoundRun[] = [];
  for (const [position, body] of bodies.entries()) {
    const kind = kinds[position] ?? "live";
    const index = position + 1;
    const run =
      kind === "live"
        ? await writeOnce(body, index, bench)
        : { index, body, kind, status: null, day: null, shadow: null };
    runs.push(run);
    options.onRun?.(run);
  }
  return { runs, msElapsed: performance.now() - started };
}

function requestLabel({ city, date, energy }: DayRequest): string {
  return `${city} ${date} ${energy}`;
}

function failedChecks(checks: readonly CheckResult[] | null): string {
  if (checks === null) return "no day to score";
  const failed = checks.filter(({ passed }) => !passed);
  if (failed.length === 0) return "none";
  return failed
    .map(({ id, value }) => (value === null ? id : `${id} ${measureOf(id, value)}`))
    .join(", ");
}

/** One line a request, for following a round while it runs. */
export function dayRunLine({ index, body, kind, status, day, shadow }: DayRoundRun): string {
  const label = `day ${index} · ${requestLabel(body)}`;
  if (kind !== "live") return `${label}: ${kind}, not sent`;
  const ended = day === null ? `status ${status}` : `${day.outcome} ${usd(day.costUsd ?? 0)}`;
  const shadowEnded = shadow === null ? "no shadow" : `shadow ${shadow.outcome}`;
  return `${label}: ${ended}, ${shadowEnded}, failed: ${failedChecks(day?.checks ?? null)}`;
}

function runRows(runs: readonly DayRoundRun[]): string[][] {
  return [
    ["#", "request", "outcome", "out tokens", "cost", "checks failed"],
    ...runs.map(({ index, body, kind, status, day }) => [
      String(index),
      requestLabel(body),
      day?.outcome ?? (kind === "live" ? `status ${status}` : kind),
      day?.tokens.output == null ? "" : day.tokens.output.toLocaleString("en-US"),
      day?.costUsd == null ? "" : usd(day.costUsd),
      day === null ? "" : failedChecks(day.checks),
    ]),
  ];
}

/** How many scored days passed a check, and its mean measure where it has one (`tallyOf`). */
function summaryOf(records: readonly BaselineRecord[], id: string): string {
  const tally = tallyOf(records, id);
  if (tally === null) return "";
  const measure = tally.mean === null ? "" : ` · ${measureOf(id, tally.mean)}`;
  return `${tally.passed}/${tally.scored}${measure}`;
}

/**
 * The baseline's records for the requests this round sent, where they carry their requests;
 * records without one are all kept, as the whole of an earlier round.
 */
function matchingBaseline(
  runs: readonly DayRoundRun[],
  baseline: readonly BaselineRecord[],
): BaselineRecord[] {
  const sent = runs.filter(({ kind }) => kind === "live").map(({ body }) => body);
  return baseline.filter(
    ({ request }) => request == null || sent.some((body) => isSameRequest(body, request)),
  );
}

function comparisonRows(
  runs: readonly DayRoundRun[],
  baseline: readonly BaselineRecord[],
): string[][] {
  const days = runs.flatMap(({ day }) => (day === null ? [] : [day]));
  const shadows = runs.flatMap(({ shadow }) => (shadow === null ? [] : [shadow]));
  const before = (role: string) => baseline.filter((record) => record.role === role);
  const ids = [
    ...new Set(
      [...days, ...shadows, ...baseline].flatMap(({ checks }) => checks ?? []).map(({ id }) => id),
    ),
  ];
  return [
    ["check", "day before", "day now", "shadow before", "shadow now"],
    ...ids.map((id) => [
      id,
      summaryOf(before("day"), id),
      summaryOf(days, id),
      summaryOf(before("shadow"), id),
      summaryOf(shadows, id),
    ]),
  ];
}

/** The round as a reader takes it in: each request, then each check before and now. */
export function dayReport(
  round: DayRoundResult,
  baseline: readonly BaselineRecord[] = [],
): string[] {
  const records = round.runs.flatMap(({ day, shadow }) => [day, shadow]);
  const costOf = (role: string) =>
    records.reduce((sum, record) => sum + (record?.role === role ? (record.costUsd ?? 0) : 0), 0);
  const sent = round.runs.filter(({ kind }) => kind === "live").length;
  const compared = matchingBaseline(round.runs, baseline);
  const given =
    compared.length === baseline.length
      ? `${baseline.length} records given`
      : `${compared.length} of ${baseline.length} records given, for the requests sent`;
  return [
    `Day round: ${DAY_PROMPT_VERSION} on ${MODEL_IDS.day}, its shadow on ${MODEL_IDS.shadow}, ${sent} requests sent of ${round.runs.length}.`,
    `Spent ${usd(costOf("day") + costOf("shadow"))} (days ${usd(costOf("day"))}, shadows ${usd(costOf("shadow"))}) in ${elapsed(round.msElapsed)}.`,
    "",
    ...table(runRows(round.runs)),
    "",
    baseline.length === 0
      ? "Each check, passed of the days scored, and its mean measure:"
      : `Each check, passed of the days scored, and its mean measure, before (${given}) and now:`,
    "A day the normalizer refused counts only on shape and normalizes.",
    ...table(comparisonRows(round.runs, compared)),
    "",
    "What the slider and the swap can reach, on the days as shown:",
    ...table([REACH_HEADER, ...reachRows(round.runs)]),
  ];
}

/** Each role's reach over the days it completed (`version-reach.ts`). */
function reachRows(runs: readonly DayRoundRun[]): string[][] {
  return (["day", "shadow"] as const).map((role) => {
    const reach = runs.reduce((sum, run) => {
      const record = run[role];
      if (record?.outcome !== "complete") return sum;
      const one = reachOfOutput(run.body, record.outputText);
      return one === null ? sum : addReach(sum, one);
    }, NO_REACH);
    return reachRow(role === "day" ? "days" : "shadows", reach);
  });
}
