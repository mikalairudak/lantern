import { createAnthropic, type AnthropicProvider } from "@ai-sdk/anthropic";

/**
 * A fake Claude API behind the real `@ai-sdk/anthropic` provider: its `fetch` answers each
 * call in the shapes Claude's docs give, so a test runs the provider's own request building,
 * stream parsing and error mapping without a network or a key. The answers are hand-written,
 * not recordings; the first live key checks them (`docs/harness.md`, "The first live key").
 */

export const FIXTURE_REQUEST_ID = "req_fixture_0001";

/** A Claude error answer, as in `docs/harness.md`, "Live errors and the outcome each becomes". */
export interface ClaudeFailure {
  /** The row of the harness's table it stands for. */
  name: string;
  status: number;
  type: string;
  message: string;
  errorCode?: string;
}

/** Every failure that comes before any text, each of which the visitor reads as `unavailable`. */
export const REJECTIONS: readonly ClaudeFailure[] = [
  {
    name: "our workspace's monthly spend limit",
    status: 400,
    type: "invalid_request_error",
    message:
      "You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC.",
  },
  {
    // The docs give the message, not its status or type; a 400 is the likeliest.
    name: "the organization's credits run out",
    status: 400,
    type: "invalid_request_error",
    message:
      "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
  },
  {
    name: "the tier's monthly cap",
    status: 429,
    type: "rate_limit_error",
    message: "You have reached your organization's monthly usage limit.",
    errorCode: "enforced_spend_limit_reached",
  },
  {
    name: "a rate limit",
    status: 429,
    type: "rate_limit_error",
    message: "Number of request tokens has exceeded your per-minute rate limit.",
  },
  { name: "overloaded", status: 529, type: "overloaded_error", message: "Overloaded" },
  { name: "a server error", status: 500, type: "api_error", message: "Internal server error" },
  { name: "a server timeout", status: 504, type: "timeout_error", message: "Request timed out" },
  {
    name: "a schema structured outputs reject",
    status: 400,
    type: "invalid_request_error",
    message: "output_config.format.schema: Unsupported keyword 'minItems'",
  },
  { name: "a wrong model id", status: 404, type: "not_found_error", message: "model: claude-x" },
  { name: "a request too large", status: 413, type: "request_too_large", message: "Too large" },
  {
    name: "a wrong key",
    status: 401,
    type: "authentication_error",
    message: "invalid credentials",
  },
  { name: "a key without permission", status: 403, type: "permission_error", message: "Denied" },
  { name: "a billing problem", status: 402, type: "billing_error", message: "Billing issue" },
];

export function rejectionNamed(name: string): ClaudeFailure {
  const failure = REJECTIONS.find((rejection) => rejection.name === name);
  if (failure === undefined) throw new Error(`No rejection is written as "${name}"`);
  return failure;
}

/** Claude's stop reasons (the provider maps refusal to `content-filter`, max_tokens to `length`). */
export type StopReason = "end_turn" | "max_tokens" | "refusal" | "compaction";

export type ClaudeAnswer =
  | {
      kind: "message";
      /** What the model writes, streamed in deltas of `deltaChars` when the call streams. */
      text: string;
      stopReason?: StopReason;
      usage?: { input: number; output: number };
      deltaChars?: number;
      /** Waits this long before each event after the first, so a caller can leave midway. */
      eventDelayMs?: number;
      /** Streams `text`, then an `overloaded_error` event instead of the message's end. */
      isCutByError?: boolean;
    }
  | { kind: "failure"; failure: ClaudeFailure };

export interface FakeClaude {
  provider: AnthropicProvider;
  /** The body of every call the provider sent, in order. */
  requests: Record<string, unknown>[];
}

const DEFAULT_USAGE = { input: 3_000, output: 4_300 };
const DEFAULT_DELTA_CHARS = 64;
const HEADERS = { "request-id": FIXTURE_REQUEST_ID };

function sseOf(data: Record<string, unknown>): string {
  return `event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * The events one at a time, the first at once and each after it `delayMs` later, as a body
 * that errors with the caller's reason once the caller aborts.
 */
function paced(
  events: readonly Record<string, unknown>[],
  delayMs: number,
  signal: AbortSignal | null | undefined,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let next = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (next > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const event = events[next++];
      if (signal?.aborted) controller.error(signal.reason);
      else if (event === undefined) controller.close();
      else controller.enqueue(encoder.encode(sseOf(event)));
    },
  });
}

function deltasOf(text: string, size: number): string[] {
  const deltas: string[] = [];
  for (let start = 0; start < text.length; start += size)
    deltas.push(text.slice(start, start + size));
  return deltas;
}

function messageOf(model: string, inputTokens: number, outputTokens: number) {
  return {
    id: "msg_fixture",
    type: "message",
    role: "assistant",
    model,
    stop_sequence: null,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

function answerOf(
  answer: ClaudeAnswer,
  body: Record<string, unknown>,
  signal: AbortSignal | null | undefined,
): Response {
  if (answer.kind === "failure") {
    const { status, type, message, errorCode } = answer.failure;
    const error = { type, message, ...(errorCode && { details: { error_code: errorCode } }) };
    return Response.json({ type: "error", error }, { status, headers: HEADERS });
  }
  const { text, stopReason = "end_turn", usage = DEFAULT_USAGE } = answer;
  const model = String(body.model);
  if (body.stream !== true) {
    return Response.json(
      {
        ...messageOf(model, usage.input, usage.output),
        content: [{ type: "text", text }],
        stop_reason: stopReason,
      },
      { headers: HEADERS },
    );
  }
  const deltas = deltasOf(text, answer.deltaChars ?? DEFAULT_DELTA_CHARS).map((delta) => ({
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text: delta },
  }));
  const end = answer.isCutByError
    ? [{ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]
    : [
        { type: "content_block_stop", index: 0 },
        {
          type: "message_delta",
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: { output_tokens: usage.output },
        },
        { type: "message_stop" },
      ];
  const events = [
    { type: "message_start", message: { ...messageOf(model, usage.input, 1), content: [] } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ...deltas,
    ...end,
  ];
  const stream =
    answer.eventDelayMs === undefined
      ? events.map(sseOf).join("")
      : paced(events, answer.eventDelayMs, signal);
  return new Response(stream, {
    headers: { ...HEADERS, "content-type": "text/event-stream" },
  });
}

/** Answers a call by what it sent, as when each golden text gets its own recorded output. */
export type ClaudeAnswering = (body: Record<string, unknown>) => ClaudeAnswer;

/** A provider whose every call gets `answer`, or what `answer` makes of the call's body. */
export function fakeClaude(answer: ClaudeAnswer | ClaudeAnswering): FakeClaude {
  const requests: Record<string, unknown>[] = [];
  const provider = createAnthropic({
    // A bearer token, so the fake carries nothing shaped like a key (no-secrets.test.ts).
    authToken: "fixture-token",
    fetch: (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      const answered = typeof answer === "function" ? answer(body) : answer;
      return Promise.resolve(answerOf(answered, body, init?.signal));
    },
  });
  return { provider, requests };
}
