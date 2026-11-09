import {
  APICallError,
  createUIMessageStreamResponse,
  Output,
  simulateReadableStream,
  streamText,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { PlaceChecking } from "@/lib/live/place-checks-in-stream";
import { inSchemaOrder } from "@/lib/schema/in-schema-order";
import { GeneratedDaySchema, type GeneratedDay } from "@/lib/schema/itinerary.schema";
import { unevenBursts, type DayTextOffsets, type UnevenPace } from "./uneven-pace";

/**
 * How a simulated stream ends. `at` is a character offset into `dayText(day)`, the text the
 * model streams: everything before it arrives, nothing after.
 *
 * - `finished`: the model stops on its own. A good day is `complete`, a broken one `invalid`.
 * - `rejected`: the provider turns the call down before any text, as when retries run out.
 * - `limited`: our own spend cap or rate limit answers 429.
 * - `offline`: the request never reaches the server.
 * - `refused`: the model declines after `at` characters.
 * - `cut`: the server stops after `at` characters, on max tokens, an error or a timeout.
 * - `dropped`: the connection breaks after `at` characters.
 */
export type StreamEnding =
  | { kind: "finished" }
  | { kind: "rejected" }
  | { kind: "limited" }
  | { kind: "offline" }
  | { kind: "refused"; at: number }
  | { kind: "cut"; at: number; by: "length" | "error" | "timeout" }
  | { kind: "dropped"; at: number };

export interface StreamPace {
  /**
   * Characters per text delta. A day's JSON runs about 2.4 characters a token
   * (`DAY_MAX_OUTPUT_TOKENS`).
   */
  deltaChars: number;
  /** Before the first delta. A slow start, as when the SDK retries a 429 or a 5xx. */
  startDelayMs: number;
  /** Between deltas. */
  deltaDelayMs: number;
}

/** Token-sized deltas with no waiting: every partial a live stream could show, at once. */
export const DEFAULT_PACE: StreamPace = { deltaChars: 4, startDelayMs: 0, deltaDelayMs: 0 };

export interface SimulateDayStreamOptions {
  day: GeneratedDay;
  ending: StreamEnding;
  /** Even deltas (`StreamPace`), or bursts and pauses as a live model sends them. */
  pace?: Partial<StreamPace> | UnevenPace;
  /** Stops the simulated model when the visitor leaves, as a written day's stream stops. */
  signal?: AbortSignal;
  /**
   * Checks the places as they are written and sends each check beside the text, as the live
   * day's route does: a written start day plays the checks its run had.
   */
  placeChecking?: Pick<PlaceChecking, "read" | "streamWith">;
}

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_OVERLOADED = 529;
const TEXT_ID = "day";

// The mock's stream part type, taken from its constructor so no transitive package is named.
type MockStream = NonNullable<
  NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>["doStream"]
>;
type MockStreamPart =
  Awaited<
    ReturnType<Extract<MockStream, (...args: never[]) => unknown>>
  >["stream"] extends ReadableStream<infer Part>
    ? Part
    : never;

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

/**
 * The text the model streams for a day: its JSON in schema order, as structured outputs write
 * it, whatever order a fixture's keys were typed in.
 */
export function dayText(day: GeneratedDay): string {
  return JSON.stringify(inSchemaOrder(GeneratedDaySchema, day));
}

/**
 * Where the plan's middle stop and the options start in `dayText(day)`. The options are the
 * last field and the stops the one before them, so both are counted back from the end, on the
 * day in the order the text writes it.
 */
export function dayTextOffsets(written: GeneratedDay): DayTextOffsets {
  const day = inSchemaOrder(GeneratedDaySchema, written);
  const text = JSON.stringify(day);
  const alternativesStart =
    text.length - `"alternatives":${JSON.stringify(day.alternatives)}}`.length;
  const stopsStart = alternativesStart - `${JSON.stringify(day.stops)},`.length + "[".length;
  const middle = Math.floor(day.stops.length / 2);
  const beforeMiddle = day.stops
    .slice(0, middle)
    .reduce((length, stop) => length + `${JSON.stringify(stop)},`.length, 0);
  return {
    midPlan: day.stops.length > 0 ? stopsStart + beforeMiddle : null,
    options: day.alternatives.length > 0 ? alternativesStart : null,
  };
}

/**
 * Replays a day as the live route will send it: the AI SDK's `streamText` with
 * `Output.object`, on its mock model, out through `toUIMessageStreamResponse()`. The
 * failures the model makes go through the SDK's own mapping; the ones the network makes
 * cut the response body, as a timeout or a dropped connection would.
 */
export function simulateDayStream({
  day,
  ending,
  pace,
  signal,
  placeChecking,
}: SimulateDayStreamOptions): Promise<Response> {
  if (ending.kind === "offline") return Promise.reject(new TypeError("Failed to fetch"));
  if (ending.kind === "limited") {
    return Promise.resolve(new Response(null, { status: HTTP_TOO_MANY_REQUESTS }));
  }

  let text = "";
  const result = streamText({
    model: simulatedModel({ day, ending, pace }),
    output: Output.object({ schema: GeneratedDaySchema }),
    prompt: "Replay a fixture.",
    maxRetries: 0,
    abortSignal: signal,
    onChunk: ({ chunk }) => {
      if (chunk.type !== "text-delta" || placeChecking === undefined) return;
      text += chunk.text;
      placeChecking.read(text);
    },
    // The error reaches the client as an event, which is what is being simulated.
    onError: () => undefined,
  });
  const response =
    placeChecking === undefined
      ? result.toUIMessageStreamResponse()
      : createUIMessageStreamResponse({
          stream: placeChecking.streamWith(result.toUIMessageStream()),
        });

  if (ending.kind === "dropped") return Promise.resolve(endBodyAfterText(response, "break"));
  if (ending.kind === "cut" && ending.by === "timeout") {
    return Promise.resolve(endBodyAfterText(response, "close"));
  }
  return Promise.resolve(response);
}

/** The endings a model makes; the others are made by the route or the network. */
export type ModelEnding = Exclude<StreamEnding, { kind: "limited" | "offline" }>;

/**
 * The mock model behind the simulator: it writes `dayText(day)` at `pace` and ends as
 * `ending` says. The live route takes it in place of Claude, so a test can play one day
 * through both and compare what the reader makes of each. A timeout or a drop is cut out of
 * the response body, not made by the model, so for those the model itself finishes.
 */
export function simulatedModel({
  day,
  ending,
  pace,
}: Pick<SimulateDayStreamOptions, "day" | "pace"> & {
  ending: ModelEnding;
}): MockLanguageModelV4 {
  const text = dayText(day);
  const sent = "at" in ending ? text.slice(0, ending.at) : text;
  const head: MockStreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: TEXT_ID },
  ];
  const tail = endingParts(ending);
  // Out here, so a pace that cannot be played throws to the caller instead of passing as
  // a failed call.
  const bursts =
    pace !== undefined && "kind" in pace ? unevenBursts(sent, dayTextOffsets(day), pace) : null;
  const streamParts = (): ReadableStream<MockStreamPart> => {
    if (bursts !== null) {
      return pacedStream([
        ...head.map(atOnce),
        ...bursts.map(({ delayMs, delta }) => ({ delayMs, part: textDelta(delta) })),
        ...tail.map(atOnce),
      ]);
    }
    const { deltaChars, startDelayMs, deltaDelayMs } = { ...DEFAULT_PACE, ...pace };
    return simulateReadableStream({
      chunks: [...head, ...toDeltas(sent, deltaChars).map(textDelta), ...tail],
      initialDelayInMs: orNoWait(startDelayMs),
      chunkDelayInMs: orNoWait(deltaDelayMs),
    });
  };

  return new MockLanguageModelV4({
    doStream: async () => {
      if (ending.kind === "rejected") {
        throw new APICallError({
          message: "Overloaded",
          url: "simulated",
          requestBodyValues: {},
          statusCode: HTTP_OVERLOADED,
          isRetryable: true,
        });
      }
      return { stream: streamParts() };
    },
  });
}

function endingParts(ending: ModelEnding): MockStreamPart[] {
  const finish = (reason: "stop" | "length" | "content-filter"): MockStreamPart[] => [
    { type: "text-end", id: TEXT_ID },
    { type: "finish", finishReason: { unified: reason, raw: reason }, usage: USAGE },
  ];
  if (ending.kind === "refused") return finish("content-filter");
  if (ending.kind === "cut" && ending.by === "length") return finish("length");
  if (ending.kind === "cut" && ending.by === "error") {
    return [{ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }];
  }
  // A timeout or a drop is cut out of the response body after the text, so the model
  // itself finishes normally.
  return finish("stop");
}

function textDelta(delta: string): MockStreamPart {
  return { type: "text-delta", id: TEXT_ID, delta };
}

function toDeltas(text: string, size: number): string[] {
  const deltas: string[] = [];
  for (let start = 0; start < text.length; start += size) {
    deltas.push(text.slice(start, start + size));
  }
  return deltas;
}

/** `simulateReadableStream` waits on a timer even for 0 ms; `null` skips the wait. */
function orNoWait(delayMs: number): number | null {
  return delayMs > 0 ? delayMs : null;
}

interface PacedPart {
  /** The wait before this part; 0 sends it at once. */
  delayMs: number;
  part: MockStreamPart;
}

function atOnce(part: MockStreamPart): PacedPart {
  return { delayMs: 0, part };
}

/**
 * `simulateReadableStream` with a wait of its own before each part. A part is timed once
 * the one before it is read. Cancelling, as an abort does, clears the wait under way.
 */
function pacedStream(parts: readonly PacedPart[]): ReadableStream<MockStreamPart> {
  let next = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new ReadableStream<MockStreamPart>({
    pull(controller) {
      const paced = parts[next++];
      if (paced === undefined) {
        controller.close();
        return;
      }
      if (paced.delayMs <= 0) {
        controller.enqueue(paced.part);
        return;
      }
      return new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          timer = undefined;
          controller.enqueue(paced.part);
          resolve();
        }, paced.delayMs);
      });
    },
    cancel() {
      clearTimeout(timer);
    },
  });
}

/**
 * Ends the response body where the server goes silent: after the last text event, before
 * anything that would say how the stream ended. "close" ends it cleanly, as a function
 * timeout can; "break" fails the read, as a dropped connection does.
 */
function endBodyAfterText(response: Response, how: "close" | "break"): Response {
  if (response.body === null) return response;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";
  let hasEnded = false;
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (hasEnded) return;
        pending += decoder.decode(chunk, { stream: true });
        for (let boundary = pending.indexOf("\n\n"); boundary !== -1;) {
          const event = pending.slice(0, boundary + 2);
          pending = pending.slice(boundary + 2);
          if (isTextEnd(event)) {
            hasEnded = true;
            if (how === "break") controller.error(new TypeError("network error"));
            else controller.terminate();
            return;
          }
          controller.enqueue(encoder.encode(event));
          boundary = pending.indexOf("\n\n");
        }
      },
    }),
  );
  return new Response(body, { status: response.status, headers: response.headers });
}

function isTextEnd(event: string): boolean {
  const data = event.trim().replace(/^data: /, "");
  try {
    const parsed: unknown = JSON.parse(data);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      parsed.type === "text-end"
    );
  } catch {
    return false;
  }
}
