import type { CallWarning, LanguageModelUsage } from "ai";
import type { CheckResult } from "@/lib/quality/checks";
import type { ReplanBasisRef } from "@/lib/replan/request";
import type { WindowSpan } from "@/lib/replan/windows";
import type { AssumableFactKey, DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import type { CallRole, ModelId } from "./models";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import type { ProviderErrorDescription } from "./provider-error";

/**
 * One record per model call, the eval's second source beside the golden set: requests
 * visitors made, scored offline by the same checks, and read in pairs without knowing which
 * model wrote which (`docs/harness.md`, "The pair log"). It never holds the visitor's
 * address, nor its hash.
 */

/** Tokens as the provider reported them; null where it reported nothing. */
export interface TokenCounts {
  /**
   * For a day an error cut, or one the route stopped, still the count Claude sent at the start
   * of its stream, though its output, counted only at the end, stays null.
   */
  input: number | null;
  /** Everything written, thinking included, since thinking is billed as output. */
  output: number | null;
  /** The part of `output` spent thinking, when the provider says. */
  thinking: number | null;
}

export function tokensOf(usage: LanguageModelUsage | undefined): TokenCounts {
  return {
    input: usage?.inputTokens ?? null,
    output: usage?.outputTokens ?? null,
    thinking: usage?.outputTokenDetails.reasoningTokens ?? null,
  };
}

/** A warning as one line of the log, such as the provider replacing a setting it rejects. */
export function warningLine(warning: CallWarning): string {
  return JSON.stringify(warning);
}

export interface GenerationRecord {
  id: string;
  /** Shared by the visitor's day and the shadow written beside it; null for a call alone. */
  pairId: string | null;
  role: CallRole;
  model: ModelId;
  promptVersion: string;
  startedAt: string;
  tokens: TokenCounts;
  /** From the price table; null when the provider reported no usage, as after an error. */
  costUsd: number | null;
  /** Until the first words of the output; null when none came. */
  msToFirstToken: number | null;
  msToFinish: number;
  /** The model's finish reason (`stop`, `length`, `content-filter`, `error`, `other`), when it gave one. */
  finishReason: string | null;
  /**
   * How it ended. A day's is the `DayOutcome` kind the reader makes of the stream it was sent,
   * or `aborted` when the route failed before `after()` and stopped it (a visitor who leaves no
   * longer does: the day is written to its end); an intake's is its `IntakeResult` kind.
   */
  outcome: string;
  /**
   * For a day, whether its stream was cut and the salvage rule still kept a day, the one the
   * visitor is shown (a shadow's is shown to nobody), whose `repairs` and `checks` these then
   * are: what tells a salvaged `cut` from one that showed nothing. null for an intake.
   */
  salvaged: boolean | null;
  /** Repairs the normalizer made on the finished or salvaged day; null when there is none. */
  repairs: number | null;
  /** `runQualityChecks` on the finished or salvaged day; null for an intake or when there is none. */
  checks: CheckResult[] | null;
  /** What the visitor typed: only an intake reads it. */
  visitorText: string | null;
  /** The request a day was written for, or the one an intake read. */
  request: DayRequest | null;
  /** The output exactly as the model wrote it: the day's or the intake's JSON, or its start. */
  outputText: string;
  /** Warnings the SDK raised for the call, such as a setting the provider replaced. */
  warnings: string[];
  /**
   * The provider's `request-id` for the call, when it reached the provider; for a day, read as
   * the response's headers arrive, so a day an error cut keeps it too.
   */
  requestId: string | null;
  /**
   * Claude's error, or for an intake Claude answered that still went `unavailable`, ours in
   * the same shape with no status and a type of our own: `intake-output-unparsable` when the
   * output was not an intake, `city-lookup-failed` when Geoapify could not look its cities up.
   */
  error: ProviderErrorDescription | null;
  /**
   * A live day's places, each by its id with its last check as the visitor's stream carried
   * it, the provider's point with those confirmed by name, so the day can be shown again as
   * it was (`0007`); null for a call that checked none: an intake, a shadow, a day without
   * the verifier.
   */
  placeChecks: Record<string, PlaceCheck> | null;
  /**
   * What a targeted re-plan read beyond its request, so it can be scored and run again offline
   * (`0006`): absent from every other call's record, whose row holds null there. A re-plan is
   * recorded in the day's role, so this is what tells its record from a day's, in SQL
   * `context IS NOT NULL` (`IS_REPLAN`, `src/lib/live/log-report.ts`).
   */
  context?: ReplanContext;
}

/**
 * A targeted re-plan's reading (`docs/targeted-replan.md`, section 5): the changed word, the
 * page's count of re-plans, the windows the server read from the day, and the day it merged
 * into, from which the kept stops, the prompt and the merged day can all be made again.
 */
export interface ReplanContext {
  changed: AssumableFactKey;
  round: number;
  windows: WindowSpan[];
  /**
   * The day as the server read it from `basis`, never as a client sent it, with each stop the
   * visitor picked a version of planned on that version (`withPicks`), checked against the day.
   */
  itinerary: Itinerary;
  /**
   * Where the server read the day. Missing only on a record written before it did, whose day
   * was a client's (`docs/security.md`, S1): such a record is never shown again.
   */
  basis?: ReplanBasisRef;
}

export interface GenerationLog {
  record(entry: GenerationRecord): Promise<void>;
}

/** What the log is called when a read of it misses a request's deadline. */
export const GENERATION_LOG_STORE = "The generation log";

/** What `GET /api/day/<id>` reads of a day's record to show the day again. */
export type KeptRecord = Pick<
  GenerationRecord,
  | "id"
  | "promptVersion"
  | "startedAt"
  | "msToFinish"
  | "outcome"
  | "salvaged"
  | "request"
  | "outputText"
  | "placeChecks"
  | "context"
>;

/**
 * Reads a day back from the log by its id (`src/lib/days/stored-day.ts`): the visitor's own
 * day or re-plan alone, never a shadow, which nobody was shown, nor an intake, which holds what
 * the visitor typed. Only the records of the environment it runs in.
 */
export interface DayArchive {
  dayRecordOf(id: string): Promise<KeptRecord | null>;
}

/** A process that runs for days keeps only the latest, about a day of full traffic. */
const MAX_IN_MEMORY_RECORDS = 500;

/** Records in one process, for tests and for a laptop without a database. */
export class InMemoryGenerationLog implements GenerationLog, DayArchive {
  readonly records: GenerationRecord[] = [];

  record(entry: GenerationRecord): Promise<void> {
    this.records.push(entry);
    if (this.records.length > MAX_IN_MEMORY_RECORDS) this.records.shift();
    return Promise.resolve();
  }

  dayRecordOf(id: string): Promise<KeptRecord | null> {
    const kept = this.records.find((entry) => entry.id === id && entry.role === "day");
    return Promise.resolve(kept ?? null);
  }
}
