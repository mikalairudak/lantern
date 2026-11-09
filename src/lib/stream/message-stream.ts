import {
  parseJsonEventStream,
  parsePartialJson,
  uiMessageChunkSchema,
  type FinishReason,
  type UIMessageChunk,
} from "ai";
import { withLettersUnescaped } from "./escaped-letters";
import { PLACE_CHECK_PART, PlaceCheckSchema, type PlaceCheck } from "./place-checks";

/**
 * The AI SDK's UI message stream (`toUIMessageStreamResponse`) read chunk by chunk, before any
 * reader makes an outcome of it: the day's (`read-day-stream.ts`) and the re-plan's
 * (`read-replan-stream.ts`) read the same bytes and differ only in what they make of the text.
 * Loadable in a browser: both readers run on the client and on the server.
 */

const HTTP_TOO_MANY_REQUESTS = 429;

/** What the stream had said by the time it ended. */
export interface StreamState {
  text: string;
  hasFinish: boolean;
  finishReason: FinishReason | undefined;
  /** An error or an abort from the server. */
  isBroken: boolean;
  /** Each place's latest check, by its id. */
  placeChecks: Map<string, PlaceCheck>;
}

/**
 * How the stream ended: read to its close, lost on the way with the text it had sent, or
 * answered with a status and no stream at all.
 */
export type StreamEnd =
  | { kind: "read"; state: StreamState }
  | { kind: "lost"; text: string }
  | { kind: "limited" }
  | { kind: "unavailable" };

export interface ReadMessageStreamOptions {
  /**
   * `fetch()` to the route, or the simulator. Passed as a promise, so a connection that
   * fails before any response is read as lost too.
   */
  response: Promise<Response>;
  /** Called with the whole text so far after each piece of it arrives. */
  onText: (text: string) => Promise<void>;
  /** Called with each place's check as the live stream carries it. */
  onPlaceCheck: (check: PlaceCheck) => void;
  /**
   * The signal the caller also gave `fetch`. Aborting rejects with its reason; without the same
   * signal on both, an abort mid-body reads as lost.
   */
  signal?: AbortSignal;
}

/**
 * Reads the stream to its end. It resolves for every way a stream can end and rejects only
 * when the caller's `signal` aborts.
 */
export async function readMessageStream({
  response,
  onText,
  onPlaceCheck,
  signal,
}: ReadMessageStreamOptions): Promise<StreamEnd> {
  const state: StreamState = {
    text: "",
    hasFinish: false,
    finishReason: undefined,
    isBroken: false,
    placeChecks: new Map(),
  };
  // Only the network is caught: a bug here, in a normalizer or in `onText` must surface, not
  // pass as a lost connection.
  const loseConnection = async (
    reader?: ReadableStreamDefaultReader<unknown>,
  ): Promise<StreamEnd> => {
    if (signal?.aborted) {
      await reader?.cancel().catch(() => undefined);
      signal.throwIfAborted();
    }
    return { kind: "lost", text: state.text };
  };

  const answer = await response.catch(() => null);
  if (answer === null) return loseConnection();
  if (answer.status === HTTP_TOO_MANY_REQUESTS) return { kind: "limited" };
  if (!answer.ok || answer.body === null) return { kind: "unavailable" };

  const reader = parseJsonEventStream({
    stream: answer.body,
    schema: uiMessageChunkSchema,
  }).getReader();
  // Read chunk by chunk: Safari cannot iterate a ReadableStream with `for await`.
  for (;;) {
    if (signal?.aborted) return loseConnection(reader);
    const next = await reader.read().catch(() => null);
    if (next === null) return loseConnection(reader);
    if (next.done) break;
    if (next.value.success) await take(next.value.value, state, onText, onPlaceCheck);
  }
  signal?.throwIfAborted();
  return { kind: "read", state };
}

async function take(
  chunk: UIMessageChunk,
  state: StreamState,
  onText: (text: string) => Promise<void>,
  onPlaceCheck: (check: PlaceCheck) => void,
): Promise<void> {
  if (chunk.type === "text-delta") {
    state.text += chunk.delta;
    await onText(state.text);
  } else if (chunk.type === "finish") {
    state.hasFinish = true;
    state.finishReason = chunk.finishReason;
  } else if (chunk.type === "error" || chunk.type === "abort") {
    state.isBroken = true;
  } else if (chunk.type === PLACE_CHECK_PART) {
    // A part this reader cannot read is skipped, never thrown: the day matters more than a mark.
    const check = PlaceCheckSchema.safeParse(chunk.data);
    if (!check.success) return;
    state.placeChecks.set(check.data.placeId, check.data);
    onPlaceCheck(check.data);
  }
}

/**
 * How a stream read to its close ended, before its text is judged: refused, with nothing
 * written, cut before the model's own stop, or finished by it.
 */
export function endingOfState(state: StreamState): "refused" | "unavailable" | "cut" | "finished" {
  // A refusal may come after the start of a day; Claude's docs advise discarding it.
  if (state.finishReason === "content-filter") return "refused";
  if (state.text === "") return "unavailable";
  const isCut =
    !state.hasFinish ||
    state.isBroken ||
    state.finishReason === "length" ||
    state.finishReason === "error";
  // Any other finish, including `other` or none given, counts as the model's own stop.
  return isCut ? "cut" : "finished";
}

/**
 * The text as the partial parser reads it, with the letters a model escaped twice unescaped
 * (`escaped-letters.ts`), for every partial and the finished answer.
 */
export async function parsedForVisitor(text: string): ReturnType<typeof parsePartialJson> {
  const parsed = await parsePartialJson(text);
  return { ...parsed, value: withLettersUnescaped(parsed.value) };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
