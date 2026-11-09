import { APICallError, RetryError, StreamProviderError } from "ai";
import { describe, expect, it, vi } from "vitest";
import { describeProviderError, logToConsole, messageOf } from "./provider-error";

function rejected(status: number, body: unknown, requestId?: string): APICallError {
  return new APICallError({
    message: "Claude said no",
    url: "https://api.anthropic.com/v1/messages",
    requestBodyValues: {},
    statusCode: status,
    responseHeaders: requestId === undefined ? {} : { "request-id": requestId },
    responseBody: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("describeProviderError", () => {
  it("reads the status, the type, the error code and the request id of a rejected call", () => {
    const error = rejected(
      429,
      {
        type: "error",
        error: {
          type: "rate_limit_error",
          message: "Monthly limit",
          details: { error_code: "enforced_spend_limit_reached" },
        },
      },
      "req_1",
    );

    expect(describeProviderError(error)).toEqual({
      status: 429,
      type: "rate_limit_error",
      errorCode: "enforced_spend_limit_reached",
      requestId: "req_1",
      message: "Claude said no",
    });
  });

  it("describes the last error once the retries are spent", () => {
    const last = rejected(529, { type: "error", error: { type: "overloaded_error", message: "" } });
    const error = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [last, last, last],
    });

    expect(describeProviderError(error)).toMatchObject({ status: 529, type: "overloaded_error" });
  });

  it("keeps what it can of a body that is not Claude's", () => {
    expect(describeProviderError(rejected(502, "<html>Bad gateway</html>"))).toEqual({
      status: 502,
      type: null,
      errorCode: null,
      requestId: null,
      message: "Claude said no",
    });
  });

  it("reads an error that came in the stream after text began", () => {
    const error = new StreamProviderError({
      message: "Overloaded",
      type: "overloaded_error",
      statusCode: 529,
      data: { type: "overloaded_error", message: "Overloaded" },
    });

    expect(describeProviderError(error)).toEqual({
      status: 529,
      type: "overloaded_error",
      errorCode: null,
      requestId: null,
      message: "Overloaded",
    });
  });

  it("reads a stream error's code when its payload carries none", () => {
    const error = new StreamProviderError({ message: "Odd", code: 42, data: null });

    expect(describeProviderError(error)).toMatchObject({ errorCode: "42", status: null });
  });

  it("describes anything else by its message", () => {
    expect(describeProviderError(new Error("Places is down")).message).toBe("Places is down");
    expect(describeProviderError("a string")).toMatchObject({ message: "a string", status: null });
  });
});

describe("messageOf", () => {
  it("says what a store's failure says, as the description of it would", () => {
    const down = new Error("The database did not answer");

    expect(messageOf(down)).toBe(describeProviderError(down).message);
    expect(messageOf("a string thrown")).toBe("a string thrown");
  });
});

describe("logToConsole", () => {
  it("writes one JSON line to stderr", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logToConsole("model-call-failed", { status: 529 });

    expect(write).toHaveBeenCalledWith('{"event":"model-call-failed","status":529}');
    write.mockRestore();
  });
});
