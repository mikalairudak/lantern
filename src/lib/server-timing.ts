/**
 * The `Server-Timing` header the intake, day and re-plan routes answer with: how long the handler
 * waited on each service before its answer's headers, so a browser's network panel or
 * `curl -D -` shows where a slow answer's seconds went (`docs/harness.md`, "Where a
 * request's seconds go"). Durations only, nothing of the visitor's. Vercel's CDN passes the
 * header through since 2026-08-10. Loadable in a browser, since the day route's module is.
 *
 * In production it says each step's name and duration alone: the public site names none of the
 * services behind it (`docs/security.md`, S15), and the descriptions did, in any visitor's network
 * panel; nor how long its process had run. A laptop and a preview keep both, for measuring.
 */

/** What a handler waits on, each with the line a network panel shows beside it. */
const STEP_DESCRIPTIONS = {
  limits: "Neon: the visitor's count and the app's spend",
  basis: "Neon: the kept day a re-plan rewrites, or whose city a day asks again",
  model: "Claude, the whole call",
  cities: "Geoapify: the cities the text names",
} as const;

export type TimedStep = keyof typeof STEP_DESCRIPTIONS;

const TOTAL_DESCRIPTION = "The handler, until its answer's headers";

export interface ServerTimingOptions {
  /** Milliseconds; in Node, `performance.now()` counts from the process's start. */
  clock?: () => number;
  /** The first request this route's bundle has served on its instance. */
  isCold?: boolean;
  /** Names and durations alone: no description, and no cold mark, as production says them. */
  isBare?: boolean;
}

function formatMs(ms: number): string {
  return String(Math.round(ms * 10) / 10);
}

/** One request's timings, from its handler's start to its answer's headers. */
export class ServerTiming {
  private readonly clock: () => number;
  private readonly started: number;
  private readonly isCold: boolean;
  private readonly isBare: boolean;
  private readonly spent = new Map<TimedStep, number>();

  constructor({
    clock = () => performance.now(),
    isCold = false,
    isBare = false,
  }: ServerTimingOptions = {}) {
    this.clock = clock;
    this.started = clock();
    this.isCold = isCold;
    this.isBare = isBare;
  }

  /** A metric's description as the header writes it, or nothing in a bare header. */
  private described(text: string): string {
    return this.isBare ? "" : `;desc="${text}"`;
  }

  /** Runs `work` and adds how long it took to `step`, whether it resolved or threw. */
  async time<T>(step: TimedStep, work: () => Promise<T>): Promise<T> {
    const start = this.clock();
    try {
      return await work();
    } finally {
      this.spent.set(step, (this.spent.get(step) ?? 0) + this.clock() - start);
    }
  }

  /**
   * The header's value: each step in the order it was first timed, then the total so far,
   * and on a cold request how long after its process began the handler started, which on a
   * new process is the boot and the route's loading. A bare header leaves out every
   * description and the cold mark.
   */
  header(): string {
    const steps = [...this.spent].map(
      ([step, ms]) => `${step};dur=${formatMs(ms)}${this.described(STEP_DESCRIPTIONS[step])}`,
    );
    const total = `total;dur=${formatMs(this.clock() - this.started)}${this.described(TOTAL_DESCRIPTION)}`;
    const cold =
      this.isCold && !this.isBare
        ? [
            `cold;desc="The first request this route served here, ${formatMs(this.started)} ms after its process began"`,
          ]
        : [];
    return [...steps, total, ...cold].join(", ");
  }
}

// Per route, since Next bundles each route on its own.
let hasServed = false;

/**
 * A timing for one request, marked cold when it is the first this route has served here, and
 * bare in production (`VERCEL_ENV`), where the header says names and durations alone.
 */
export function startServerTiming(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServerTiming {
  const isCold = !hasServed;
  hasServed = true;
  return new ServerTiming({ isCold, isBare: env.VERCEL_ENV === "production" });
}

/** One metric of a `Server-Timing` header, as `parseServerTiming` reads it. */
export interface ServerTimingEntry {
  name: string;
  /** Milliseconds, or null for a metric with no duration, as `cold`. */
  dur: number | null;
  desc: string | null;
}

/** A metric and the comma after it, read from where the last one ended; a desc may hold commas. */
const METRIC = /\s*([\w-]+)(?:;dur=([\d.]+))?(?:;desc="([^"]*)")?\s*(?:,|$)/y;

/** Reads a `Server-Timing` header as this module writes it, for tests and a measurement's script. */
export function parseServerTiming(header: string): ServerTimingEntry[] {
  const metric = new RegExp(METRIC);
  const entries: ServerTimingEntry[] = [];
  while (metric.lastIndex < header.length) {
    const rest = header.slice(metric.lastIndex);
    const match = metric.exec(header);
    if (match === null) throw new Error(`Not a Server-Timing metric: ${rest}`);
    const [, name = "", dur, desc] = match;
    entries.push({ name, dur: dur === undefined ? null : Number(dur), desc: desc ?? null });
  }
  return entries;
}

/** The response with its `Server-Timing` header, set as the handler answers. */
export function withServerTiming(response: Response, timing: ServerTiming): Response {
  response.headers.set("Server-Timing", timing.header());
  return response;
}
