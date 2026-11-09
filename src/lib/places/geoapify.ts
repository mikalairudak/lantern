/**
 * The two Geoapify endpoints Lantern reads, behind one in-process queue that keeps to the free
 * plan's 5 requests a second: the geocoder, `GET /v1/geocode/search`, which finds a place or a
 * city by its name, and the Places API, `GET /v2/places`, which lists the places of given
 * categories inside a circle. A lookup is sent once and never retried: whatever stops it comes
 * back as a failure the caller turns into an unverified place or an intake that could not run,
 * never as a throw. Geoapify takes the key in the query string, so no URL is ever put in an
 * error or a log.
 */

/** One credit a call. */
export const GEOCODE_ENDPOINT = "https://api.geoapify.com/v1/geocode/search";
/**
 * One credit a call while its `limit` is 20 or less; each 20 places past that add one
 * (Geoapify's pricing details, read 2026-10-30).
 */
export const PLACES_ENDPOINT = "https://api.geoapify.com/v2/places";

export const REQUESTS_PER_SECOND = 5;

/**
 * The free plan's credits a day, one account's for every key on it: production's, the dev server's
 * and the live eval's alike, as the account's page says. Four day rounds and the dev server once
 * spent about 4,300 of them on the laptop's key, past the day's limit; spent, the provider refuses
 * every lookup, production's intake of a city included.
 */
export const FREE_PLAN_DAILY_CREDITS = 3_000;
const START_INTERVAL_MS = 1000 / REQUESTS_PER_SECOND;

/**
 * How long one request may take, its body included, counted from its turn. From the laptop
 * Geoapify answered in 1.7 to 3.3 s on `day-v0`'s round, and 4 of about 87 lookups ran past 3 s on
 * `day-v1`'s, three of them on six lookups of Paris. 5 s holds that tail and keeps one lookup well
 * inside the intake route's 30 s; the preview pass measures it from Vercel's region before a retry
 * or a cache is weighed.
 */
export const REQUEST_TIMEOUT_MS = 5000;

/**
 * How long a lookup may wait for its turn. A day's 22 places take about 4.4 s at 5 a second;
 * a lookup whose turn is further off than this is answered as timed out and never sent.
 */
export const MAX_QUEUE_WAIT_MS = 10_000;

/**
 * How long lookups are answered without being sent after the provider refused one: a 429, or
 * a key it would not take. Geoapify's docs do not say whether a 429 is the per-second rate or
 * the day's credits; a short pause keeps a spent day or a revoked key from being asked once
 * per place, and lets a passing rate limit clear.
 */
export const REFUSAL_PAUSE_MS = 10_000;

/** "aborted" is the caller's own leaving, which says nothing about the provider. */
export type LookupFailure = "failed" | "quota" | "timeout" | "no-key" | "aborted";

export type LookupAnswer = { ok: true; body: unknown } | { ok: false; failure: LookupFailure };

/** The query's parameters, the key aside. */
export type LookupParams = Readonly<Record<string, string>>;

/** One lookup on one endpoint. Resolves with the body or a failure; never rejects. */
export type Lookup = (params: LookupParams, signal?: AbortSignal) => Promise<LookupAnswer>;

/** Both endpoints, sharing one queue, one pause after a refusal and one key. */
export interface GeoapifyClient {
  geocode: Lookup;
  places: Lookup;
}

export interface GeoapifyClientOptions {
  /** Read on every lookup; null answers "no-key" without a request. */
  readApiKey: () => string | null;
  fetch: typeof fetch;
}

/**
 * The refusals that pause the queue, and what each answers. Geoapify answers a missing, wrong
 * or revoked key with 401 "Invalid apiKey". A 403 is not documented: it may be a spent quota
 * or a restriction on the key as much as the key itself, so it is a failure, not "no-key".
 */
const REFUSALS: Readonly<Record<number, LookupFailure>> = {
  401: "no-key",
  403: "failed",
  429: "quota",
};

function failure(reason: LookupFailure): LookupAnswer {
  return { ok: false, failure: reason };
}

/** Lookups take turns, first come first served, one turn every `START_INTERVAL_MS`. */
function createTurns() {
  const waiting: (() => void)[] = [];
  let lastStartAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function serve(): void {
    clearTimeout(timer);
    timer = undefined;
    if (waiting.length === 0) return;
    const wait = lastStartAt + START_INTERVAL_MS - Date.now();
    if (wait > 0) {
      timer = setTimeout(serve, wait);
      return;
    }
    lastStartAt = Date.now();
    waiting.shift()?.();
    if (waiting.length > 0) timer = setTimeout(serve, START_INTERVAL_MS);
  }

  return {
    /** How long a lookup joining now would wait for its turn. */
    waitFromNow(): number {
      const nextStart = Math.max(0, lastStartAt + START_INTERVAL_MS - Date.now());
      return nextStart + waiting.length * START_INTERVAL_MS;
    },

    /** Resolves on the lookup's turn; a caller who leaves first gives the turn up. */
    take(signal?: AbortSignal): Promise<void> {
      return new Promise((resolve, reject) => {
        const leave = () => {
          const index = waiting.indexOf(start);
          if (index !== -1) waiting.splice(index, 1);
          reject(signal?.reason);
        };
        const start = () => {
          signal?.removeEventListener("abort", leave);
          resolve();
        };
        signal?.addEventListener("abort", leave, { once: true });
        waiting.push(start);
        serve();
      });
    },
  };
}

/**
 * A client whose lookups share one queue, on either endpoint: make one per key, not one per
 * request. A refusal on one endpoint pauses both, since both spend the same key's credits.
 */
export function createGeoapifyClient({ readApiKey, fetch }: GeoapifyClientOptions): GeoapifyClient {
  const turns = createTurns();
  let pause: { until: number; failure: LookupFailure } | null = null;

  const pausedFailure = (): LookupFailure | null =>
    pause !== null && Date.now() < pause.until ? pause.failure : null;

  const lookupOn =
    (endpoint: string): Lookup =>
    async (params, signal) => {
      if (signal?.aborted) return failure("aborted");
      const apiKey = readApiKey();
      if (apiKey === null) return failure("no-key");
      const pausedBefore = pausedFailure();
      if (pausedBefore !== null) return failure(pausedBefore);
      if (turns.waitFromNow() > MAX_QUEUE_WAIT_MS) return failure("timeout");

      try {
        await turns.take(signal);
      } catch {
        return failure("aborted");
      }
      // A refusal while this lookup waited answers it too, so a revoked key is asked once.
      const pausedWhileQueued = pausedFailure();
      if (pausedWhileQueued !== null) return failure(pausedWhileQueued);

      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
      const signals = signal === undefined ? [timeout.signal] : [timeout.signal, signal];
      try {
        const url = new URL(endpoint);
        for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
        url.searchParams.set("apiKey", apiKey);
        const response = await fetch(url, { signal: AbortSignal.any(signals) });
        const refusal = REFUSALS[response.status];
        if (refusal !== undefined) {
          pause = { until: Date.now() + REFUSAL_PAUSE_MS, failure: refusal };
          return failure(refusal);
        }
        if (!response.ok) return failure("failed");
        return { ok: true, body: await response.json() };
      } catch {
        // A body that is not JSON, a dropped connection, the time running out or the caller leaving.
        if (timeout.signal.aborted) return failure("timeout");
        return failure(signal?.aborted ? "aborted" : "failed");
      } finally {
        clearTimeout(timer);
      }
    };

  return { geocode: lookupOn(GEOCODE_ENDPOINT), places: lookupOn(PLACES_ENDPOINT) };
}
