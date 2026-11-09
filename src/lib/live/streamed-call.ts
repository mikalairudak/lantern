import {
  Output,
  createUIMessageStreamResponse,
  streamText,
  wrapLanguageModel,
  type CallWarning,
  type LanguageModel,
  type LanguageModelMiddleware,
  type LanguageModelUsage,
} from "ai";
import { z } from "zod";
import { placeCheckResults } from "@/lib/quality/place-results";
import type { GeneratedDay, GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplanSchema } from "@/lib/schema/replan.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import { salvagedDay } from "@/lib/stream/read-day-stream";
import { tokensOf, warningLine, type GenerationRecord } from "./generation-log";
import { costOf, MODEL_IDS, providerOptionsFor, type ModelId } from "./models";
import {
  DEFAULT_ERROR_MESSAGE,
  describeProviderError,
  type ProviderErrorDescription,
  type ServerLog,
} from "./provider-error";
import type { PlaceChecking, PlaceCheckRecord } from "./place-checks-in-stream";
import type { Reservation } from "./limits";

/**
 * One streamed model call, as a day, its shadow and a targeted re-plan each make it: Claude
 * through `streamText` with `Output.object`, out through `toUIMessageStreamResponse()`, the
 * same stream the simulator sends, so the client reads it with the same reader and gets the
 * same outcomes. The server reads its own copy of the stream to the end, so the trace keeps
 * the outcome the visitor got, what the call read and wrote, and its place checks. What each
 * route counts, holds, settles and records around the call stays with the route:
 * `live-day.ts` for a day and its shadow, `live-replan.ts` for a re-plan. Server only.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/live/streamed-call.ts calls Claude with the server's key and runs only on the server",
  );
}

/**
 * A model object, never a gateway's model id: each call wraps it to read the response's
 * headers the moment they arrive.
 */
export type StreamingModel = Exclude<LanguageModel, string>;

/** What a streamed call did, gathered while it streamed and read once it ended. */
export interface CallTrace {
  role: "day" | "shadow";
  model: ModelId;
  startedAt: Date;
  msToFirstToken: number | null;
  msToFinish: number;
  /** As the provider reported it once the call ended; an abort or a cut leaves it without counts. */
  usage: LanguageModelUsage | undefined;
  /** What Claude counted the call reading, from its stream's first event. */
  inputTokens: number | null;
  finishReason: string | null;
  outcome: string;
  /** The day the salvage rule kept of a cut stream, as the model wrote it; null for any other. */
  salvaged: GeneratedDay | null;
  /** The visitor was sent a day whose stops the model closed with none in them. */
  isEmpty: boolean;
  outputText: string;
  warnings: CallWarning[];
  requestId: string | null;
  error: ProviderErrorDescription | null;
  /** The visitor's places as their checks ended; empty when none were checked. */
  places: PlaceCheckRecord[];
  /** Each place's last check as the visitor's stream carried it; null when none were run. */
  placeChecks: Record<string, PlaceCheck> | null;
  /** How long the close waited for the checks, and the most it would; null when none were run. */
  placesWait: { ms: number; deadlineMs: number } | null;
}

/** How a streamed call ended, as the log keeps it. */
interface Ending {
  outcome: string;
  salvaged: GeneratedDay | null;
  isEmpty: boolean;
}

/**
 * The outcome the visitor's reader made of the stream, or `aborted` when the route stopped the
 * call, failing before `after()`; a visitor who leaves does not stop it. A
 * cut or a lost connection the salvage rule kept a day of keeps that day, to be scored as a
 * whole one is, since it is the day the visitor saw.
 */
async function endingOf(outcome: DayOutcome, signal: AbortSignal, text: string): Promise<Ending> {
  // A day that reached its end is complete, even if the route stopped as it did.
  if (signal.aborted && outcome.kind !== "complete") {
    return { outcome: "aborted", salvaged: null, isEmpty: false };
  }
  const isSalvaged =
    (outcome.kind === "cut" || outcome.kind === "disconnected") && outcome.itinerary !== null;
  return {
    outcome: outcome.kind,
    salvaged: isSalvaged ? await salvagedDay(text) : null,
    isEmpty: outcome.kind === "invalid" && outcome.isEmpty,
  };
}

export interface StreamedCall {
  /** What the visitor is sent; null for the shadow, which is read on the server only. */
  response: Response | null;
  /** Resolves once the call has ended and its stream has been read. Never rejects. */
  trace: Promise<CallTrace>;
}

/**
 * What one call is asked and how its stream is read: a day's (`dayCallOf`, `live-day.ts`) or
 * a targeted re-plan's (`live-replan.ts`), which share everything else about a call.
 */
export interface CallSpec {
  instructions: string;
  prompt: string;
  schema: typeof GeneratedDaySchema | typeof GeneratedReplanSchema;
  maxOutputTokens: number;
  /** The visitor's own reader of the stream, so the log keeps the outcome the page made. */
  read: (response: Promise<Response>) => Promise<DayOutcome>;
}

export interface StreamedCallOptions {
  role: "day" | "shadow";
  model: StreamingModel;
  call: CallSpec;
  /**
   * Stops the call only when the request fails before `after()` takes it over: never when the
   * visitor leaves, since the day goes on to the log to be opened again (`docs/decisions.md`,
   * "A day is written to its end").
   */
  signal: AbortSignal;
  startedAt: Date;
  maxRetries: number | undefined;
  log: ServerLog;
  /**
   * Runs once the call has ended and its stream has been read, before the visitor's copy
   * closes: the visitor's reader has its outcome only at the close, so whatever this does
   * about the outcome is done before the page acts on it. It never rejects.
   */
  beforeClose?: (trace: CallTrace) => Promise<void>;
  /** The visitor's place checks, which the day's call alone runs. */
  placeChecking?: { checking: PlaceChecking; deadlineMs: number } | null;
}

/**
 * Claude counts a call's input in its stream's first event, `message_start`, and its output
 * only in the last, `message_delta`, which a call an error cut or the route stopped never
 * gets; the SDK's `onAbort` carries only finished steps, and a day is one. The provider
 * passes the first event's usage on as a part of its own, so such a call still records what
 * it read, though not what it wrote.
 */
const MessageStartSchema = z.object({
  type: z.literal("custom"),
  kind: z.literal("anthropic.message_start"),
  providerMetadata: z.object({
    anthropic: z.object({ usage: z.object({ input_tokens: z.number() }) }),
  }),
});

function inputTokensIn(chunk: unknown): number | null {
  const start = MessageStartSchema.safeParse(chunk);
  return start.success ? start.data.providerMetadata.anthropic.usage.input_tokens : null;
}

/**
 * Hands over the provider's `request-id` the moment the response's headers arrive, before
 * its first words, so a call that never reaches `onEnd` can still be found in the Console.
 */
function requestIdOnHeaders(onRequestId: (id: string) => void): LanguageModelMiddleware {
  return {
    wrapStream: async ({ doStream }) => {
      const result = await doStream();
      const id = result.response?.headers?.["request-id"];
      if (id !== undefined) onRequestId(id);
      return result;
    },
  };
}

/**
 * Starts one streamed call. Its stream is read on the server from the start, the visitor's
 * copy through a tee, so the shadow is written beside the visitor's day rather than after it,
 * and each call's outcome is what the client's own reader makes of the same bytes.
 */
export function startStreamedCall({
  role,
  model,
  call,
  signal,
  startedAt,
  maxRetries,
  log,
  beforeClose = () => Promise.resolve(),
  placeChecking = null,
}: StreamedCallOptions): StreamedCall {
  const modelId = MODEL_IDS[role];
  const started = performance.now();
  let firstTokenAt: number | null = null;
  let outputText = "";
  let usage: LanguageModelUsage | undefined;
  let inputTokens: number | null = null;
  let finishReason: string | null = null;
  let warnings: CallWarning[] = [];
  let requestId: string | null = null;
  let error: ProviderErrorDescription | null = null;

  const result = streamText({
    model: wrapLanguageModel({
      model,
      middleware: requestIdOnHeaders((id) => {
        requestId = id;
      }),
    }),
    instructions: call.instructions,
    prompt: call.prompt,
    output: Output.object({ schema: call.schema }),
    maxOutputTokens: call.maxOutputTokens,
    maxRetries,
    abortSignal: signal,
    providerOptions: providerOptionsFor(role),
    onChunk: ({ chunk }) => {
      if (chunk.type === "custom") inputTokens ??= inputTokensIn(chunk);
      if (chunk.type !== "text-delta") return;
      firstTokenAt ??= performance.now();
      outputText += chunk.text;
      placeChecking?.checking.read(outputText);
    },
    onEnd: (event) => {
      usage = event.totalUsage;
      finishReason = event.finishReason;
      warnings = event.warnings ?? [];
    },
    // Logged once, by the UI stream's own `onError` below.
    onError: () => undefined,
  });
  const onError = (cause: unknown): string => {
    error = describeProviderError(cause);
    log("model-call-failed", { role, model: modelId, ...error });
    return DEFAULT_ERROR_MESSAGE;
  };
  // With the places checked, their checks go out beside the model's parts, in the same stream.
  const response =
    placeChecking === null
      ? result.toUIMessageStreamResponse({ onError })
      : createUIMessageStreamResponse({
          stream: placeChecking.checking.streamWith(result.toUIMessageStream({ onError })),
        });

  // `toUIMessageStreamResponse` always streams a body.
  const body = response.body as ReadableStream<Uint8Array>;
  const [forVisitor, forServer] = role === "day" ? body.tee() : [null, body];
  const trace = call
    .read(Promise.resolve(new Response(forServer, { headers: response.headers })))
    .then((outcome) => endingOf(outcome, signal, outputText))
    // A bug in the reader or the normalizer must not cost the log its record of the day.
    .catch((cause: unknown): Ending => {
      log("day-read-failed", { role, message: describeProviderError(cause).message });
      return { outcome: "unread", salvaged: null, isEmpty: false };
    })
    .then(({ outcome, salvaged, isEmpty }): CallTrace => ({
      role,
      model: modelId,
      startedAt,
      msToFirstToken: firstTokenAt === null ? null : Math.round(firstTokenAt - started),
      msToFinish: Math.round(performance.now() - started),
      usage,
      inputTokens,
      finishReason,
      outcome,
      salvaged,
      isEmpty,
      outputText,
      warnings,
      requestId: requestId ?? error?.requestId ?? null,
      error,
      places: placeChecking?.checking.records() ?? [],
      placeChecks: placeChecking?.checking.checks() ?? null,
      placesWait: placesWaitOf(placeChecking),
    }));

  const toVisitor =
    forVisitor === null
      ? null
      : new Response(untilCancelled(forVisitor, trace.then(beforeClose)), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
  return { response: toVisitor, trace };
}

/**
 * The visitor's copy of the stream. Cancelling it, as a visitor who leaves does, cancels this
 * copy alone: the server's copy of the tee reads on, so the call writes its day to the end.
 * Its last bytes wait for `beforeClose`, so the close, where the visitor's reader makes its
 * outcome, comes after whatever the server does about that outcome.
 */
function untilCancelled(
  stream: ReadableStream<Uint8Array>,
  beforeClose: Promise<void>,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  let isCancelled = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await reader.read();
      if (!next.done) return controller.enqueue(next.value);
      await beforeClose;
      if (!isCancelled) controller.close();
    },
    cancel(reason) {
      isCancelled = true;
      return reader.cancel(reason);
    },
  });
}

/**
 * What a call cost, as the app's cap counts it: the provider's usage at the price table's
 * rates; nothing for a call the provider rejected before writing, which it does not bill;
 * and otherwise, with no usage to go on, the whole reservation. A day an error cut, or one
 * the route stopped, reports no usage: only its input, counted at the start (`inputTokensIn`),
 * while what it wrote is counted only in the event it never got. So nothing tells what it
 * spent, and the cap keeps counting the most it could have (decided 2026-10-28).
 */
export function spentOf(trace: CallTrace, reservation: Reservation): number {
  const cost = costOf(trace.model, trace.usage);
  if (cost !== null) return cost;
  const isRejected = trace.error?.status != null && trace.msToFirstToken === null;
  return isRejected ? 0 : reservation.usd;
}

export function parsedOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function placesWaitOf(
  placeChecking: StreamedCallOptions["placeChecking"],
): CallTrace["placesWait"] {
  const ms = placeChecking?.checking.msWaited() ?? null;
  return placeChecking === null || placeChecking === undefined || ms === null
    ? null
    : { ms, deadlineMs: placeChecking.deadlineMs };
}

/** What a call's record takes from its trace alone, the same for a day, its shadow and a re-plan. */
type TraceFields = Pick<
  GenerationRecord,
  | "role"
  | "model"
  | "startedAt"
  | "tokens"
  | "costUsd"
  | "msToFirstToken"
  | "msToFinish"
  | "finishReason"
  | "outcome"
  | "visitorText"
  | "outputText"
  | "warnings"
  | "requestId"
  | "error"
  | "placeChecks"
>;

/**
 * The fields of a call's record that its trace decides. Each route adds the rest: the record's
 * id and pair, its prompt version, the request, and how its output is scored.
 */
export function traceFieldsOf(trace: CallTrace): TraceFields {
  const tokens = tokensOf(trace.usage);
  return {
    role: trace.role,
    model: trace.model,
    startedAt: trace.startedAt.toISOString(),
    tokens: { ...tokens, input: tokens.input ?? trace.inputTokens },
    costUsd: costOf(trace.model, trace.usage),
    msToFirstToken: trace.msToFirstToken,
    msToFinish: trace.msToFinish,
    finishReason: trace.finishReason,
    outcome: trace.outcome,
    // Only an intake reads what the visitor typed, and it is not streamed.
    visitorText: null,
    outputText: trace.outputText,
    warnings: trace.warnings.map(warningLine),
    requestId: trace.requestId,
    error: trace.error,
    placeChecks: trace.placeChecks,
  };
}

/** The place checks' results for the record, when the call checked any. */
export function placeResultsOf(trace: CallTrace): ReturnType<typeof placeCheckResults> {
  if (trace.placesWait === null) return [];
  return placeCheckResults(trace.places, trace.placesWait.ms, trace.placesWait.deadlineMs);
}
