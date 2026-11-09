// @vitest-environment node
import { getEventListeners } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GEOCODE_ENDPOINT,
  PLACES_ENDPOINT,
  MAX_QUEUE_WAIT_MS,
  REFUSAL_PAUSE_MS,
  REQUEST_TIMEOUT_MS,
  createGeoapifyClient,
} from "./geoapify";

const KEY = "test-key";
const PARAMS = { text: "Cervejaria Ramiro, Lisbon", format: "json" };
const BODY = { results: [] };
const START_INTERVAL_MS = 200;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A fetch that answers every request the same way, as a mock: no test reaches the network. */
function fetchAnswering(answer: () => Promise<Response>) {
  return vi.fn<typeof fetch>(() => answer());
}

function fetchWithStatus(status: number) {
  return fetchAnswering(() => Promise.resolve(jsonResponse({ statusCode: status }, status)));
}

/** A fetch that never answers until it is aborted, as a stalled connection. */
function stalledFetch() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) reject(signal.reason);
        signal?.addEventListener("abort", () => reject(signal.reason));
      }),
  );
}

/** A fetch that records when each request was sent, relative to the test's start. */
function timedFetch() {
  const t0 = Date.now();
  const sentAt: number[] = [];
  const fetch = fetchAnswering(() => {
    sentAt.push(Date.now() - t0);
    return Promise.resolve(jsonResponse(BODY));
  });
  return { fetch, sentAt };
}

/** The geocoder's lookup, which most of these tests read; both endpoints share its queue. */
function clientWith(fetch: typeof globalThis.fetch, key: string | null = KEY) {
  return createGeoapifyClient({ readApiKey: () => key, fetch }).geocode;
}

function bothWith(fetch: typeof globalThis.fetch) {
  return createGeoapifyClient({ readApiKey: () => KEY, fetch });
}

describe("createGeoapifyClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the query's parameters and the key to the geocoder", async () => {
    const fetch = fetchAnswering(() => Promise.resolve(jsonResponse(BODY)));
    await expect(clientWith(fetch)(PARAMS)).resolves.toEqual({ ok: true, body: BODY });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(`${url.origin}${url.pathname}`).toBe(GEOCODE_ENDPOINT);
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...PARAMS, apiKey: KEY });
  });

  it("sends a places lookup to the Places API, with the key", async () => {
    const fetch = fetchAnswering(() => Promise.resolve(jsonResponse(BODY)));
    const params = { categories: "catering.restaurant", filter: "circle:-9.13,38.71,240" };
    await expect(bothWith(fetch).places(params)).resolves.toEqual({ ok: true, body: BODY });

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(`${url.origin}${url.pathname}`).toBe(PLACES_ENDPOINT);
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...params, apiKey: KEY });
  });

  it("starts the two endpoints' lookups in one queue, five a second in all", async () => {
    const { fetch, sentAt } = timedFetch();
    const client = bothWith(fetch);

    const lookups = [client.geocode(PARAMS), client.places(PARAMS), client.geocode(PARAMS)];
    await vi.runAllTimersAsync();
    await Promise.all(lookups);

    expect(sentAt).toEqual([0, START_INTERVAL_MS, 2 * START_INTERVAL_MS]);
  });

  it("pauses both endpoints after either is refused", async () => {
    const fetch = fetchWithStatus(429);
    const client = bothWith(fetch);

    await expect(client.places(PARAMS)).resolves.toEqual({ ok: false, failure: "quota" });
    await expect(client.geocode(PARAMS)).resolves.toEqual({ ok: false, failure: "quota" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("answers no-key without a request when there is no key", async () => {
    const fetch = fetchAnswering(() => Promise.resolve(jsonResponse(BODY)));
    await expect(clientWith(fetch, null)(PARAMS)).resolves.toEqual({
      ok: false,
      failure: "no-key",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, "no-key"],
    [403, "failed"],
    [429, "quota"],
    [400, "failed"],
    [500, "failed"],
    [503, "failed"],
  ] as const)("answers HTTP %i as %s, once", async (status, failure) => {
    const fetch = fetchWithStatus(status);
    await expect(clientWith(fetch)(PARAMS)).resolves.toEqual({ ok: false, failure });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("answers a body that is not JSON and a dropped connection as failed", async () => {
    const html = fetchAnswering(() => Promise.resolve(new Response("<html>")));
    await expect(clientWith(html)(PARAMS)).resolves.toEqual({ ok: false, failure: "failed" });

    const dropped = fetchAnswering(() => Promise.reject(new TypeError("fetch failed")));
    await expect(clientWith(dropped)(PARAMS)).resolves.toEqual({ ok: false, failure: "failed" });
  });

  it.each([
    [429, "quota"],
    [401, "no-key"],
    [403, "failed"],
  ] as const)(
    "pauses after HTTP %i, answering %s without a request until the pause is over",
    async (status, failure) => {
      const fetch = fetchWithStatus(status);
      const search = clientWith(fetch);

      await expect(search(PARAMS)).resolves.toEqual({ ok: false, failure });
      await expect(search(PARAMS)).resolves.toEqual({ ok: false, failure });
      expect(fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(REFUSAL_PAUSE_MS);
      const later = search(PARAMS);
      await vi.runAllTimersAsync();
      await later;
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("sends none of the lookups queued behind a refused key", async () => {
    const fetch = fetchWithStatus(401);
    const search = clientWith(fetch);

    const lookups = Array.from({ length: 22 }, () => search(PARAMS));
    await vi.runAllTimersAsync();
    const answers = await Promise.all(lookups);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new Set(answers.map((answer) => !answer.ok && answer.failure))).toEqual(
      new Set(["no-key"]),
    );
  });

  // Four of the `day-v1` round's lookups ran past the old 3 s and failed their intakes.
  it("waits out a slow answer of four seconds", async () => {
    const slow = fetchAnswering(
      () => new Promise((resolve) => setTimeout(() => resolve(jsonResponse(BODY)), 4_000)),
    );
    const lookup = clientWith(slow)(PARAMS);
    await vi.advanceTimersByTimeAsync(4_000);

    await expect(lookup).resolves.toEqual({ ok: true, body: BODY });
  });

  it("times a request out", async () => {
    const lookup = clientWith(stalledFetch())(PARAMS);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    await expect(lookup).resolves.toEqual({ ok: false, failure: "timeout" });
  });

  it("answers aborted, not failed or timeout, when the caller walks away mid-request", async () => {
    const controller = new AbortController();
    const fetch = stalledFetch();
    const lookup = clientWith(fetch)(PARAMS, controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    controller.abort();

    await expect(lookup).resolves.toEqual({ ok: false, failure: "aborted" });
  });

  it("starts at most five requests a second", async () => {
    const { fetch, sentAt } = timedFetch();
    const search = clientWith(fetch);

    const lookups = Array.from({ length: 7 }, () => search(PARAMS));
    await vi.runAllTimersAsync();
    await Promise.all(lookups);

    expect(sentAt).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
  });

  it("answers timeout without sending a lookup whose turn is too far off", async () => {
    const fetch = fetchAnswering(() => Promise.resolve(jsonResponse(BODY)));
    const search = clientWith(fetch);
    const queued = Math.floor(MAX_QUEUE_WAIT_MS / START_INTERVAL_MS) + 1;

    const lookups = Array.from({ length: queued + 1 }, () => search(PARAMS));
    await vi.runAllTimersAsync();
    const answers = await Promise.all(lookups);

    expect(answers.at(-1)).toEqual({ ok: false, failure: "timeout" });
    expect(fetch).toHaveBeenCalledTimes(queued);
  });

  it("gives a queued lookup its full time once its turn comes", async () => {
    const fetch = stalledFetch();
    const search = clientWith(fetch);
    const first = search(PARAMS);
    const second = search(PARAMS);

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await expect(first).resolves.toEqual({ ok: false, failure: "timeout" });
    expect(fetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(START_INTERVAL_MS);
    await expect(second).resolves.toEqual({ ok: false, failure: "timeout" });
  });

  it("answers a caller who already left at once, and keeps no turn for them", async () => {
    const { fetch, sentAt } = timedFetch();
    const search = clientWith(fetch);
    const busy = search(PARAMS);
    const left = AbortSignal.abort();

    await expect(search(PARAMS, left)).resolves.toEqual({ ok: false, failure: "aborted" });
    const next = search(PARAMS);
    await vi.runAllTimersAsync();
    await Promise.all([busy, next]);

    expect(sentAt).toEqual([0, START_INTERVAL_MS]);
  });

  it("gives the turn of a caller who left while queued to the next in line", async () => {
    const { fetch, sentAt } = timedFetch();
    const search = clientWith(fetch);
    const controller = new AbortController();

    const first = search(PARAMS);
    const second = search(PARAMS, controller.signal);
    const third = search(PARAMS);
    controller.abort();
    await vi.runAllTimersAsync();

    await expect(first).resolves.toEqual({ ok: true, body: BODY });
    await expect(second).resolves.toEqual({ ok: false, failure: "aborted" });
    await expect(third).resolves.toEqual({ ok: true, body: BODY });
    expect(sentAt).toEqual([0, START_INTERVAL_MS]);
  });

  it("leaves no listener on a signal shared by a day's lookups", async () => {
    const fetch = fetchAnswering(() => Promise.resolve(jsonResponse(BODY)));
    const search = clientWith(fetch);
    const { signal } = new AbortController();

    const lookups = Array.from({ length: 22 }, () => search(PARAMS, signal));
    await vi.runAllTimersAsync();
    await Promise.all(lookups);

    expect(getEventListeners(signal, "abort")).toHaveLength(0);
  });
});
