import { APICallError, RetryError, StreamProviderError } from "ai";

/**
 * What the server's log says about a failed call: the four things each failure leaves on one line
 * (`docs/harness.md`, "Live errors and the outcome each becomes"). The visitor is only ever sent
 * the SDK's default message, which the reader never reads.
 */
export interface ProviderErrorDescription {
  /** The HTTP status, or the one a stream's error event stands for (529 for overloaded). */
  status: number | null;
  /** Claude's error type, such as `overloaded_error` or `invalid_request_error`. */
  type: string | null;
  /** `error.details.error_code`, such as `enforced_spend_limit_reached`, when Claude sends one. */
  errorCode: string | null;
  /** The `request-id` header, which finds the call in the Claude Console. */
  requestId: string | null;
  /** Only the message tells a workspace's spend limit from our own bad request. */
  message: string;
}

/** `toUIMessageStreamResponse`'s default, kept so the client's bytes match the simulator's. */
export const DEFAULT_ERROR_MESSAGE = "An error occurred.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** The `error` object of Claude's error body: `{ type: "error", error: { type, message, details } }`. */
function claudeErrorIn(body: unknown): Record<string, unknown> | null {
  if (typeof body === "string") {
    try {
      return claudeErrorIn(JSON.parse(body));
    } catch {
      return null;
    }
  }
  return isRecord(body) && isRecord(body.error) ? body.error : null;
}

function errorCodeOf(error: Record<string, unknown> | null): string | null {
  return error !== null && isRecord(error.details) ? stringOrNull(error.details.error_code) : null;
}

/**
 * Describes whatever a model call threw or streamed. Retries spent wrap the last error,
 * which is the one described; a rejected call is an `APICallError` with Claude's body and
 * headers; an error after the stream began is a `StreamProviderError` with Claude's payload.
 */
export function describeProviderError(error: unknown): ProviderErrorDescription {
  if (RetryError.isInstance(error)) return describeProviderError(error.lastError);
  if (APICallError.isInstance(error)) {
    const claudeError = claudeErrorIn(error.responseBody);
    return {
      status: error.statusCode ?? null,
      type: stringOrNull(claudeError?.type),
      errorCode: errorCodeOf(claudeError),
      requestId: error.responseHeaders?.["request-id"] ?? null,
      message: error.message,
    };
  }
  if (StreamProviderError.isInstance(error)) {
    const claudeError = claudeErrorIn({ error: error.data });
    return {
      status: error.statusCode ?? null,
      type: error.type ?? null,
      errorCode: errorCodeOf(claudeError) ?? (error.code === undefined ? null : String(error.code)),
      requestId: null,
      message: error.message,
    };
  }
  return {
    status: null,
    type: null,
    errorCode: null,
    requestId: null,
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * What a failure of our own says for the log, a store's, the log's or `after()`'s: its
 * message alone. A model call's failure is described whole, by `describeProviderError`.
 */
export function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Where the server writes what went wrong: one line per event, never the visitor's address. */
export type ServerLog = (event: string, fields: Record<string, unknown>) => void;

/** Vercel keeps a function's stderr in its logs; `console.error` is the one call lint allows. */
export const logToConsole: ServerLog = (event, fields) => {
  console.error(JSON.stringify({ event, ...fields }));
};
