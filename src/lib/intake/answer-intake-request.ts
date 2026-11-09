import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type CallWarning,
  type LanguageModel,
  type LanguageModelUsage,
} from "ai";
import { z } from "zod";
import type { LiveConfigResult } from "@/lib/live/flag";
import { tokensOf, warningLine, type GenerationLog } from "@/lib/live/generation-log";
import {
  INTAKE_INSTRUCTIONS,
  INTAKE_PROMPT_VERSION,
  MAX_INTAKE_TEXT_CHARS,
  intakePromptFor,
} from "@/lib/live/intake-prompt";
import {
  giveBackHeld,
  LIMITS_STORE,
  PRE_CALL_DEADLINE_MS,
  type AppSpend,
  type Held,
  type Reservation,
  type VisitorLimits,
} from "@/lib/live/limits";
import {
  costOf,
  INTAKE_INPUT_TOKENS_CEILING,
  INTAKE_MAX_OUTPUT_TOKENS,
  MODEL_IDS,
  providerOptionsFor,
  worstCaseUsd,
} from "@/lib/live/models";
import {
  describeProviderError,
  messageOf,
  type ProviderErrorDescription,
  type ServerLog,
} from "@/lib/live/provider-error";
import { badRequest, issuesOf } from "@/lib/http/bad-request";
import { signedAnswerOf } from "@/lib/live/city-signature";
import { visitorOf } from "@/lib/live/visitor";
import { fromAnotherSite, isFromAnotherSite } from "@/lib/same-site";
import { startServerTiming, withServerTiming, type ServerTiming } from "@/lib/server-timing";
import { GeneratedIntakeSchema, type IntakeResult } from "@/lib/schema/intake.schema";
import { beforeDeadline } from "@/lib/time/deadline";
import { utcDayOf, utcMonthOf } from "@/lib/time/utc-day";
import { readIntake, type IntakeFailure } from "./answer-intake";
import type { EarlyCallGate } from "./early-call";
import type { IntakeRouteAnswer } from "./signed-city";
import { writtenIntakeOf } from "./written-intake";

/**
 * Answers `POST /api/intake`: the visitor's text read into a request or a question about its
 * city (`docs/harness.md`, "A. Intake"). With the flag off it is the written intake the start
 * screen reads today; with it on, Claude Haiku 5.5 reads the text, the resolver looks its
 * cities up, and the intake's normalizer answers. Intake is not streamed, so its status is
 * real: 200 for an answer (a request, a question or a refusal), 429 for `limited` and 503 for
 * `unavailable`, and an empty 403 for a request another site's page sent, before its body is
 * read (`src/lib/same-site.ts`), which the start screen reads as `unavailable`. Otherwise the
 * body is always the `IntakeResult`, or the issues of a 400; with the flag
 * on, an answer with cities also carries each one signed (`IntakeRouteAnswer`), which the day route
 * asks of a city Lantern has not written.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/intake/answer-intake-request.ts calls Claude with the server's key and runs only on the server",
  );
}

const HTTP_OK = 200;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;

/** Looks a city's name up, as the resolver takes it (`src/lib/intake/resolve-city.ts`). */
export type CitySearch = Parameters<typeof readIntake>[1];

export interface LiveIntakeDeps {
  config: LiveConfigResult;
  model: LanguageModel;
  search: CitySearch;
  visitorLimits: VisitorLimits;
  appSpend: AppSpend;
  generationLog: GenerationLog;
  /** Runs work once the response has finished: Next's `after()` in the route. */
  schedule: (task: () => Promise<void>) => void;
  log: ServerLog;
  now: () => Date;
  newId: () => string;
  /** The SDK retries a 429 or 5xx twice by default; tests turn it off. */
  maxRetries?: number;
  /** How long the stores may take before the call, both together; tests shorten it. */
  preCallDeadlineMs?: number;
  /**
   * Lets a request call Claude beside its limits while the database may be waking
   * (`./early-call.ts`). Without it every call waits for the limits.
   */
  earlyCalls?: EarlyCallGate;
}

/** What the start screen posts: the visitor's text, and their own today for the dates it names. */
const IntakeBodySchema = z.strictObject({
  text: z
    .string()
    .refine((text) => text.trim() !== "", "The text is blank")
    .refine(
      (text) => text.length <= MAX_INTAKE_TEXT_CHARS,
      `The text is at most ${MAX_INTAKE_TEXT_CHARS} characters`,
    ),
  // The date where the visitor is; without it, today in UTC.
  today: z.iso.date().optional(),
});

type IntakeBody = z.infer<typeof IntakeBodySchema>;

const INTAKE_RESERVE_USD = worstCaseUsd(
  MODEL_IDS.intake,
  INTAKE_INPUT_TOKENS_CEILING,
  INTAKE_MAX_OUTPUT_TOKENS,
);

function statusOf(result: IntakeResult): number {
  if (result.kind === "limited") return HTTP_TOO_MANY_REQUESTS;
  if (result.kind === "unavailable") return HTTP_SERVICE_UNAVAILABLE;
  return HTTP_OK;
}

function answered(result: IntakeResult): Response {
  return Response.json(result, { status: statusOf(result) });
}

/** Answers the intake, with a `Server-Timing` header of what it waited on (`src/lib/server-timing.ts`). */
export async function answerIntakeRequest(
  request: Request,
  live: LiveIntakeDeps | null = null,
): Promise<Response> {
  const timing = startServerTiming();
  return withServerTiming(await answerOfRequest(request, live, timing), timing);
}

async function answerOfRequest(
  request: Request,
  live: LiveIntakeDeps | null,
  timing: ServerTiming,
): Promise<Response> {
  if (isFromAnotherSite(request)) return fromAnotherSite();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest([{ path: "request", message: "The body is not JSON" }]);
  }
  const body = IntakeBodySchema.safeParse(json);
  if (!body.success) return badRequest(issuesOf(body.error));
  if (live === null) return answered(writtenIntakeOf(body.data.text));
  return answered(await readLiveIntake(request, body.data, live, timing));
}

/** What the intake call did, for the answer and the log. */
interface IntakeTrace {
  /** The parsed output, or null when the call failed or its text was not an intake. */
  output: unknown;
  /** Why a call Claude answered left no intake: its text was not JSON, or not the schema's. */
  unparsable: string | null;
  outputText: string;
  finishReason: string | null;
  usage: LanguageModelUsage | undefined;
  warnings: CallWarning[];
  requestId: string | null;
  error: ProviderErrorDescription | null;
  msToFinish: number;
}

/** `result.output` throws when the call wrote no text to parse, as when it stopped first. */
function outputOf(read: () => unknown): Pick<IntakeTrace, "output" | "unparsable"> {
  try {
    return { output: read(), unparsable: null };
  } catch (cause) {
    return { output: null, unparsable: describeProviderError(cause).message };
  }
}

/**
 * A call Claude answered with text that is not an intake. `generateText` rejects then, but
 * the call was made: its error carries the text, the usage and the headers, so the record
 * keeps what it cost and its request id, and its line says it was the output, not Claude.
 */
function unparsableTrace(cause: NoObjectGeneratedError, msToFinish: number): IntakeTrace {
  return {
    output: null,
    unparsable: cause.message,
    outputText: cause.text ?? "",
    finishReason: cause.finishReason ?? null,
    usage: cause.usage,
    warnings: [],
    requestId: cause.response?.headers?.["request-id"] ?? null,
    error: null,
    msToFinish,
  };
}

async function callIntakeModel(
  signal: AbortSignal,
  { text, today }: IntakeBody,
  deps: LiveIntakeDeps,
  now: Date,
): Promise<IntakeTrace> {
  const started = performance.now();
  try {
    const result = await generateText({
      model: deps.model,
      instructions: INTAKE_INSTRUCTIONS,
      prompt: intakePromptFor(text, today ?? utcDayOf(now)),
      output: Output.object({ schema: GeneratedIntakeSchema }),
      maxOutputTokens: INTAKE_MAX_OUTPUT_TOKENS,
      maxRetries: deps.maxRetries,
      abortSignal: signal,
      providerOptions: providerOptionsFor("intake"),
    });
    return {
      ...outputOf(() => result.output),
      outputText: result.text,
      finishReason: result.finishReason,
      usage: result.totalUsage,
      warnings: result.warnings ?? [],
      requestId: result.response.headers?.["request-id"] ?? null,
      error: null,
      msToFinish: Math.round(performance.now() - started),
    };
  } catch (cause) {
    const msToFinish = Math.round(performance.now() - started);
    if (NoObjectGeneratedError.isInstance(cause)) return unparsableTrace(cause, msToFinish);
    const error = describeProviderError(cause);
    if (!signal.aborted) {
      deps.log("model-call-failed", { role: "intake", model: MODEL_IDS.intake, ...error });
    }
    return {
      output: null,
      unparsable: null,
      outputText: "",
      finishReason: null,
      usage: undefined,
      warnings: [],
      requestId: error.requestId,
      error,
      msToFinish,
    };
  }
}

/** The start screen's answer, and the failure of ours that left it `unavailable`, if one did. */
interface IntakeAnswer {
  result: IntakeResult;
  failure: IntakeFailure | null;
}

const UNAVAILABLE: IntakeResult = { kind: "unavailable" };

async function answerOf(
  trace: IntakeTrace,
  request: Request,
  deps: LiveIntakeDeps,
  now: Date,
  text: string,
): Promise<IntakeAnswer> {
  // Claude's own error, logged as it came and recorded as it is.
  if (trace.error !== null) return { result: UNAVAILABLE, failure: null };
  // A refusal of a text to decline is the expected answer, not a failure (`docs/harness.md`, "The
  // live intake gate").
  if (trace.finishReason === "content-filter") {
    return { result: { kind: "refused" }, failure: null };
  }
  if (trace.unparsable !== null) {
    const failure: IntakeFailure = { type: "intake-output-unparsable", message: trace.unparsable };
    return { result: UNAVAILABLE, failure };
  }
  try {
    const reading = await readIntake(trace.output, deps.search, now, request.signal, text);
    return reading.kind === "answered"
      ? { result: reading.result, failure: null }
      : { result: UNAVAILABLE, failure: reading.failure };
  } catch {
    // Only the visitor's own abort comes through, and nobody reads the answer then.
    return { result: UNAVAILABLE, failure: null };
  }
}

/**
 * A failure of ours after Claude answered, in the shape the record keeps Claude's errors in:
 * no status, and our own type where Claude's would be, so a row tells the three apart.
 */
function describeFailure(
  { type, message }: IntakeFailure,
  requestId: string | null,
): ProviderErrorDescription {
  return { status: null, type, errorCode: null, requestId, message };
}

/** As the day's: the reported usage, nothing for a call turned down, else the reservation. */
function spentOf(trace: IntakeTrace, reservation: Reservation): number {
  const cost = costOf(MODEL_IDS.intake, trace.usage);
  if (cost !== null) return cost;
  return trace.error?.status != null ? 0 : reservation.usd;
}

async function readLiveIntake(
  request: Request,
  body: IntakeBody,
  deps: LiveIntakeDeps,
  timing: ServerTiming,
): Promise<IntakeRouteAnswer> {
  if (deps.config.kind === "misconfigured") {
    deps.log("live-generation-misconfigured", { missing: deps.config.missing });
    return { kind: "unavailable" };
  }
  const salt = deps.config.config.visitorHashSalt;
  const held: Held = { take: null, reservations: [] };
  // One deadline for both store calls, so a slow database cannot eat the route's 30 s.
  const deadline = AbortSignal.timeout(deps.preCallDeadlineMs ?? PRE_CALL_DEADLINE_MS);
  const now = deps.now();
  let unheld: UnheldCall | null = null;
  try {
    const visitor = await visitorOf(request, salt);
    const stop = new AbortController();
    const signal = AbortSignal.any([request.signal, stop.signal]);
    const callModel = (): Promise<IntakeTrace> =>
      timing.time("model", () => callIntakeModel(signal, body, deps, now));
    // While the database may be waking, Claude reads the text beside the limits.
    if (deps.earlyCalls?.mayCallEarly(now)) unheld = { trace: callModel(), stop };
    // The visitor's count first, so a visitor past the limit holds none of the app's cap.
    held.take = await timing.time("limits", () =>
      beforeDeadline(deps.visitorLimits.take(visitor, "intake", now), deadline, LIMITS_STORE),
    );
    deps.earlyCalls?.heardFromDatabase(deps.now());
    if (held.take === null) {
      discardUnheld(unheld, deps, now);
      return { kind: "limited" };
    }
    const reservation = await timing.time("limits", () =>
      beforeDeadline(deps.appSpend.reserve(INTAKE_RESERVE_USD, now), deadline, LIMITS_STORE),
    );
    if (reservation === null) {
      await timing.time("limits", () => giveBack(held, deps));
      discardUnheld(unheld, deps, now);
      return { kind: "limited" };
    }
    const settlement = { reservation, spentUsd: 0 };
    held.reservations.push(settlement);
    const call = unheld?.trace ?? callModel();
    // The hold covers the call from here, early or not.
    unheld = null;
    const trace = await call;
    // Should anything fail from here, the call was made and is charged what it cost.
    settlement.spentUsd = spentOf(trace, reservation);
    const { result, failure } = await timing.time("cities", () =>
      answerOf(trace, request, deps, now, body.text),
    );
    const { requestId } = trace;
    if (failure !== null) {
      deps.log(failure.type, { role: "intake", model: MODEL_IDS.intake, requestId, ...failure });
    }
    const error = failure === null ? trace.error : describeFailure(failure, requestId);
    // Signed before the record is left to `after()`, which settles the hold on its own.
    const signed = await signedAnswerOf(result, salt);
    scheduleRecord(deps, { body, request, now, trace, result, error, reservation });
    return signed;
  } catch (cause) {
    deps.log("live-intake-failed", { message: describeProviderError(cause).message });
    await timing.time("limits", () => giveBack(held, deps));
    discardUnheld(unheld, deps, now);
    return { kind: "unavailable" };
  }
}

/** A call started before the limits answered, whose cost no hold covers yet. */
interface UnheldCall {
  trace: Promise<IntakeTrace>;
  stop: AbortController;
}

/**
 * Stops an early call the limits refused or did not answer for, leaves its answer unread and
 * keeps no record of it, as for any request refused, and charges it in `after()`: its usage
 * if it had finished, else the intake's hold, as an aborted call is charged. No hold covered
 * it, so the charge may pass the caps, by one intake's hold for each early call at most
 * (`./early-call.ts`).
 */
function discardUnheld(unheld: UnheldCall | null, deps: LiveIntakeDeps, now: Date): void {
  if (unheld === null) return;
  unheld.stop.abort();
  const charge: Reservation = {
    id: deps.newId(),
    usd: INTAKE_RESERVE_USD,
    day: utcDayOf(now),
    month: utcMonthOf(now),
  };
  try {
    deps.schedule(async () => {
      try {
        await deps.appSpend.settle(charge, spentOf(await unheld.trace, charge));
      } catch (cause) {
        deps.log("spend-not-settled", { message: messageOf(cause) });
      }
    });
  } catch (cause) {
    deps.log("spend-not-settled", { message: messageOf(cause) });
  }
}

/** Gives back what the request held when it failed before `after()`; logs what would not go. */
async function giveBack(held: Held, deps: LiveIntakeDeps): Promise<void> {
  for (const failure of await giveBackHeld(held, deps)) {
    deps.log("live-hold-not-returned", { message: messageOf(failure) });
  }
}

interface IntakeCall {
  body: IntakeBody;
  request: Request;
  now: Date;
  trace: IntakeTrace;
  result: IntakeResult;
  /** Claude's error, or ours once Claude had answered. */
  error: ProviderErrorDescription | null;
  reservation: Reservation;
}

/**
 * Leaves the spend's settling and the call's record to `after()`: the settle first, then the
 * record, each on its own, so a store that refuses one still takes the other.
 */
function scheduleRecord(
  deps: LiveIntakeDeps,
  { body, request, now, trace, result, error, reservation }: IntakeCall,
): void {
  deps.schedule(async () => {
    try {
      await deps.appSpend.settle(reservation, spentOf(trace, reservation));
    } catch (cause) {
      deps.log("spend-not-settled", { message: messageOf(cause) });
    }
    try {
      await deps.generationLog.record({
        id: deps.newId(),
        pairId: null,
        role: "intake",
        model: MODEL_IDS.intake,
        promptVersion: INTAKE_PROMPT_VERSION,
        startedAt: now.toISOString(),
        tokens: tokensOf(trace.usage),
        costUsd: costOf(MODEL_IDS.intake, trace.usage),
        // Not streamed: the whole answer comes at once.
        msToFirstToken: null,
        msToFinish: trace.msToFinish,
        finishReason: trace.finishReason,
        outcome: request.signal.aborted ? "aborted" : result.kind,
        salvaged: null,
        placeChecks: null,
        repairs: null,
        checks: null,
        visitorText: body.text,
        request: result.kind === "request" ? result.request : null,
        outputText: trace.outputText,
        warnings: trace.warnings.map(warningLine),
        requestId: trace.requestId,
        error,
      });
    } catch (cause) {
      deps.log("generation-log-failed", { message: messageOf(cause) });
    }
  });
}
