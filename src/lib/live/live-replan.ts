import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { badRequest, issuesOf } from "@/lib/http/bad-request";
import { writtenDayOn } from "@/lib/days/written/days";
import {
  checkReplanDrops,
  checkReplanGap,
  checkReplanTimeWords,
  checkReplanWindows,
  checkReplanWord,
} from "@/lib/quality/replan-checks";
import { mergeReplan, type ReplanBasis } from "@/lib/replan/merge";
import {
  MAX_REPLAN_BODY_BYTES,
  REPLAN_WHOLE_DAY_STATUS,
  ReplanRequestSchema,
  picksIssueOf,
  replanBoundsIssueOf,
  replanIdPrefix,
  requestMismatchOf,
  withPicks,
  type ReplanBasisRef,
  type ReplanRequest,
} from "@/lib/replan/request";
import { replanPlanOf } from "@/lib/replan/windows";
import { fromAnotherSite, isFromAnotherSite } from "@/lib/same-site";
import { GeneratedReplanSchema } from "@/lib/schema/replan.schema";
import { startServerTiming, withServerTiming, type ServerTiming } from "@/lib/server-timing";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import { readReplanStream } from "@/lib/stream/read-replan-stream";
import { GENERATION_LOG_STORE, type GenerationRecord, type ReplanContext } from "./generation-log";
import {
  LIMITS_STORE,
  PRE_CALL_DEADLINE_MS,
  settleAll,
  type Held,
  type Reservation,
} from "./limits";
import { giveBack, giveBackBeforeClose, limited, unavailable, type LiveDayDeps } from "./live-day";
import {
  MODEL_IDS,
  REPLAN_INPUT_TOKENS_CEILING,
  REPLAN_MAX_OUTPUT_TOKENS,
  worstCaseUsd,
} from "./models";
import { placeCheckingFor } from "./place-checks-in-stream";
import { describeProviderError, messageOf } from "./provider-error";
import { REPLAN_INSTRUCTIONS, REPLAN_PROMPT_VERSION, replanPromptOf } from "./replan-prompt";
import { keptBasisOf, type KeptBasis } from "./stored-days";
import {
  parsedOrNull,
  placeResultsOf,
  spentOf,
  startStreamedCall,
  traceFieldsOf,
  type CallSpec,
  type CallTrace,
  type StreamedCall,
  type StreamingModel,
} from "./streamed-call";
import { visitorOf } from "./visitor";
import { beforeDeadline } from "@/lib/time/deadline";

/**
 * A targeted re-plan written live (`docs/targeted-replan.md`): a changed word rewrites only
 * the windows of the day it shaped. The day's model writes the new stops through the streamed
 * call a day makes (`startStreamedCall`), out through the same UI message stream, and the page
 * merges it into the day on its screen with the same reader the server reads its copy with.
 * One of the visitor's ten days, as a full re-plan is, and with no shadow, as the owner
 * answered (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor
 * takes it"). The day it rewrites is the server's own, read from the written days or the log; the
 * page sends only which day, its request, the changed word and the visitor's picks, as ids of that
 * day's own stops and places (`docs/security.md`, S1). Server only.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/live/live-replan.ts calls Claude with the server's key and runs only on the server",
  );
}

const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_SERVICE_UNAVAILABLE = 503;

/** The most a re-plan can cost, held against the app's cap before the call: about $0.08. */
export const REPLAN_RESERVE_USD = worstCaseUsd(
  MODEL_IDS.day,
  REPLAN_INPUT_TOKENS_CEILING,
  REPLAN_MAX_OUTPUT_TOKENS,
);

export interface LiveReplanDeps extends Omit<LiveDayDeps, "models"> {
  /** The day's model: a re-plan is written by Sonnet alone. */
  model: StreamingModel;
  /** How long to wait between reads of a day whose record has not landed; tests shorten it. */
  basisRetryMs?: number;
  /**
   * How the route finds the windows a word rewrites: `replanPlanOf`, from the server's own day,
   * when left out, as every route sets it. A paid round that measures windows marked by hand
   * gives its own (`src/eval/replan-round.ts`); a page never names a window.
   */
  planOf?: typeof replanPlanOf;
}

/**
 * A day's record lands once its stream has been read to its end, in `after()`, a moment after
 * the page has the whole day, so a word changed at once can find it not yet written. The route
 * reads this many times, `BASIS_RETRY_MS` apart, about two seconds in all, before it sends the
 * word on to the whole day. The reads and the waits between them count against the stores' one
 * deadline (`PRE_CALL_DEADLINE_MS`), as the count and the hold after them do.
 */
const BASIS_READS = 4;
const BASIS_RETRY_MS = 750;

/**
 * The endings that give the visitor's day back: the model left a window empty, wrote a stop the
 * merge dropped, or wrote what the merge refused (`invalid`), or the stream stopped before its
 * end (`cut`), and the day stays as it was (`docs/targeted-replan.md`, section 4). A refusal
 * stays counted, as a day's does: the visitor's own words may have caused it.
 */
const FAILED_OUTCOMES: ReadonlySet<string> = new Set(["invalid", "cut"]);

/**
 * Answers `POST /api/replan`. A request another site's page sent is a 403 before its body is
 * read (`src/lib/same-site.ts`). A body past `MAX_REPLAN_BODY_BYTES` is a 413; one that is not a
 * re-plan request is a 400 that lists its issues. With the flag off, a re-plan request is a 503,
 * which the reader takes as `unavailable`. With it on, the day is read from the server's own
 * written days or log: a request for another city, date or zone than that day's is a 400, and so
 * is a pick of a stop the day does not hold or of a place that is not that stop's own; a day
 * not kept, not whole, past the prompt's bounds or taking another round than the page counts,
 * or a word that re-plans most of it, is a 409 with the reason, and the page sends the word to
 * `POST /api/day` instead. Every answer carries a `Server-Timing` header of what it waited on
 * before the stream began.
 */
export async function answerReplanRequest(
  request: Request,
  deps: LiveReplanDeps | null,
): Promise<Response> {
  const timing = startServerTiming();
  return withServerTiming(await answerOfRequest(request, deps, timing), timing);
}

async function answerOfRequest(
  request: Request,
  deps: LiveReplanDeps | null,
  timing: ServerTiming,
): Promise<Response> {
  if (isFromAnotherSite(request)) return fromAnotherSite();
  // Read whole before its size is known; Vercel refuses a body past 4.5 MB before this runs.
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REPLAN_BODY_BYTES) {
    const message = `A re-plan's body is at most ${MAX_REPLAN_BODY_BYTES} bytes`;
    return Response.json(
      { issues: [{ path: "request", message }] },
      { status: HTTP_PAYLOAD_TOO_LARGE },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return badRequest([{ path: "request", message: "The body is not JSON" }]);
  }
  const parsed = ReplanRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(issuesOf(parsed.error));
  if (deps === null) return new Response(null, { status: HTTP_SERVICE_UNAVAILABLE });
  const replan = parsed.data;
  // One deadline for every store call before the model's: the day's reads, the count, the hold.
  const deadline = AbortSignal.timeout(deps.preCallDeadlineMs ?? PRE_CALL_DEADLINE_MS);
  let reading: BasisReading;
  try {
    reading = await timing.time("basis", () =>
      basisOf(replan.basis, replan.request.date, deps, deadline),
    );
  } catch (cause) {
    deps.log("replan-basis-unread", { message: messageOf(cause) });
    return unavailable();
  }
  if (reading.kind === "missing") return wholeDay(reading.reason);
  const { basis: day } = reading;
  const mismatch = requestMismatchOf(replan.request, day.request);
  if (mismatch !== null) return badRequest([{ path: "request", message: mismatch }]);
  const picked = picksIssueOf(day.itinerary, replan.picks);
  if (picked !== null) return badRequest([{ path: "picks", message: picked }]);
  if (replan.round !== day.round + 1) {
    return wholeDay(
      `The day has taken ${day.round} re-plans, so this one is round ${day.round + 1}`,
    );
  }
  const bound = replanBoundsIssueOf(day.itinerary);
  if (bound !== null) return wholeDay(bound);
  // The day as the visitor sees it: the server's own stops and places, each picked stop planned
  // on the place the visitor chose, so the kept stops are read and the new line is written
  // around what is on their screen.
  const shown = withPicks(day.itinerary, replan.picks);
  // The windows come from the day itself, never from the page.
  const plan = (deps.planOf ?? replanPlanOf)(shown, replan.request, replan.changed);
  // A word that changes no stop never reaches here from a page, which keeps it alone; asked
  // anyway, it is no part's re-plan.
  if (plan.kind !== "targeted") return wholeDay(plan.reason);
  const basis: ReplanBasis = {
    itinerary: shown,
    request: replan.request,
    changed: replan.changed,
    windows: plan.windows,
    idPrefix: replanIdPrefix(replan.round),
  };
  return answerLiveReplan(request, replan, basis, deps, { timing, deadline });
}

/** A 409 the page reads as a word that re-plans the whole day, which it then asks for. */
function wholeDay(reason: string): Response {
  return Response.json({ plan: "full", reason }, { status: REPLAN_WHOLE_DAY_STATUS });
}

type BasisReading = { kind: "found"; basis: KeptBasis } | { kind: "missing"; reason: string };

/**
 * The day the page names, as the server holds it: a written day from its file, as the page
 * played it, on the date the page shows it on (`writtenDayOn`), or a kept one from the log,
 * read again while its record has not landed. A read or a wait the deadline passes in
 * rejects, and no read starts after it.
 */
async function basisOf(
  ref: ReplanBasisRef,
  date: string,
  deps: LiveReplanDeps,
  deadline: AbortSignal,
): Promise<BasisReading> {
  if (ref.kind === "written") {
    const written = writtenDayOn(ref.slug, date, deps.now());
    if (written === null) return { kind: "missing", reason: "No written day has that address" };
    return { kind: "found", basis: { ...written, round: 0 } };
  }
  for (let read = 1; ; read++) {
    const kept = await beforeDeadline(
      keptBasisOf(ref.id, deps.dayArchive, deps.now()),
      deadline,
      GENERATION_LOG_STORE,
    );
    if (kept.kind === "kept") return { kind: "found", basis: kept.basis };
    if (kept.status !== "unknown" || read >= BASIS_READS) {
      return { kind: "missing", reason: `The day to re-plan is ${kept.status}` };
    }
    const retryMs = deps.basisRetryMs ?? BASIS_RETRY_MS;
    await beforeDeadline(
      new Promise((resolve) => setTimeout(resolve, retryMs)),
      deadline,
      GENERATION_LOG_STORE,
    );
  }
}

/** A re-plan's call: its prompt over the kept stops and windows, its schema and its cap. */
function replanCallOf(basis: ReplanBasis): CallSpec {
  return {
    instructions: REPLAN_INSTRUCTIONS,
    prompt: replanPromptOf(basis),
    schema: GeneratedReplanSchema,
    maxOutputTokens: REPLAN_MAX_OUTPUT_TOKENS,
    read: (response) => readReplanStream({ basis, response, onPartial: () => undefined }),
  };
}

/**
 * Writes a re-plan with the flag on, as `answerLiveDay` writes a day: the visitor's count, then
 * the app's cap, both before the call; over either, a 429. Its city needs no signature: it is
 * the city of a day the server already wrote or Lantern wrote. If anything fails before `after()` takes the call
 * over, everything held is given back, and a re-plan that fails gives the visitor's day back
 * before the page reads its outcome (`FAILED_OUTCOMES`).
 */
async function answerLiveReplan(
  request: Request,
  replan: ReplanRequest,
  basis: ReplanBasis,
  deps: LiveReplanDeps,
  { timing, deadline }: { timing: ServerTiming; deadline: AbortSignal },
): Promise<Response> {
  if (deps.config.kind === "misconfigured") {
    deps.log("live-generation-misconfigured", { missing: deps.config.missing });
    return unavailable();
  }
  const salt = deps.config.config.visitorHashSalt;
  const held: Held = { take: null, reservations: [] };
  const stopping = new AbortController();
  try {
    const now = deps.now();
    const visitor = await visitorOf(request, salt);
    held.take = await timing.time("limits", () =>
      beforeDeadline(deps.visitorLimits.take(visitor, "day", now), deadline, LIMITS_STORE),
    );
    if (held.take === null) return limited();
    const reservation = await timing.time("limits", () =>
      beforeDeadline(deps.appSpend.reserve(REPLAN_RESERVE_USD, now), deadline, LIMITS_STORE),
    );
    if (reservation === null) {
      await timing.time("limits", () => giveBack(held, deps));
      return limited();
    }
    held.reservations.push({ reservation, spentUsd: 0 });

    // Never the request's: a re-plan the visitor left is written to its end, as a day is.
    const signal = stopping.signal;
    const call = startStreamedCall({
      // The day's model and thinking, and a record the archive opens as a day's.
      role: "day",
      model: deps.model,
      call: replanCallOf(basis),
      signal,
      startedAt: now,
      maxRetries: deps.maxRetries,
      log: deps.log,
      beforeClose: (trace) =>
        FAILED_OUTCOMES.has(trace.outcome)
          ? giveBackBeforeClose(trace, held, deps, "failed-replan")
          : Promise.resolve(),
      placeChecking: placeCheckingFor(deps, replan.request.city, signal),
    });
    const context: ReplanContext = {
      changed: replan.changed,
      round: replan.round,
      windows: [...basis.windows],
      itinerary: basis.itinerary,
      basis: replan.basis,
    };
    // The re-plan's row in the log, named before it is written, as a day's is.
    const id = deps.newId();
    scheduleRecord(deps, { call, id, reservation, basis, context });
    // A day's call always has a copy for the visitor.
    const response = call.response as Response;
    response.headers.set(DAY_ID_HEADER, id);
    return response;
  } catch (cause) {
    stopping.abort();
    deps.log("live-replan-failed", { message: describeProviderError(cause).message });
    await timing.time("limits", () => giveBack(held, deps));
    return unavailable();
  }
}

interface ReplanCall {
  call: StreamedCall;
  /** The id the record takes, which the visitor's answer already names. */
  id: string;
  reservation: Reservation;
  basis: ReplanBasis;
  context: ReplanContext;
}

/** Settles the hold, then records the call, each on its own, once the call has ended. */
function scheduleRecord(
  deps: LiveReplanDeps,
  { call, id, reservation, basis, context }: ReplanCall,
): void {
  deps.schedule(async () => {
    // The trace never rejects.
    const trace = await call.trace;
    const settlement = { reservation, spentUsd: spentOf(trace, reservation) };
    for (const failure of await settleAll(deps.appSpend, [settlement])) {
      deps.log("spend-not-settled", { message: messageOf(failure) });
    }
    try {
      await deps.generationLog.record(recordOf(trace, basis, context, id));
    } catch (cause) {
      deps.log("generation-log-failed", {
        role: trace.role,
        promptVersion: REPLAN_PROMPT_VERSION,
        message: messageOf(cause),
      });
    }
  });
}

/**
 * A re-plan's record. Its repairs are the normalizer's and the merge's on the re-plan as the
 * page merged it. Its checks are the re-plan's own: `replan-windows` on what the model wrote,
 * and on the day it merged into, a dropped stop and all, `replan-word`, `replan-time-words`,
 * `replan-drops` and `replan-gap`; then the place checks when the call ran them. The day's
 * quality checks read a generated day, which a merged day is not, and run offline on the merged
 * day made again from `context` (`docs/targeted-replan.md`, section 6).
 */
function recordOf(
  trace: CallTrace,
  basis: ReplanBasis,
  context: ReplanContext,
  id: string,
): GenerationRecord {
  const output = parsedOrNull(trace.outputText);
  const written = GeneratedReplanSchema.safeParse(output);
  const merged = written.success
    ? mergeReplan({ ...basis, replan: withLettersUnescaped(written.data) })
    : null;
  const places = placeResultsOf(trace);
  const checks =
    output === null
      ? places
      : [
          checkReplanWindows(basis, output),
          checkReplanWord(basis, output),
          checkReplanTimeWords(basis, output),
          checkReplanDrops(basis, output),
          checkReplanGap(basis, output),
          ...places,
        ];
  return {
    // Its place checks are keyed as the re-plan's stream keys them, before the round's prefix
    // the merged day adds.
    ...traceFieldsOf(trace),
    id,
    pairId: null,
    promptVersion: REPLAN_PROMPT_VERSION,
    // A re-plan is all or nothing: no salvage rule keeps part of one.
    salvaged: false,
    repairs: merged === null ? null : merged.repairs.length + merged.mergeRepairs.length,
    checks: checks.length === 0 ? null : checks,
    request: basis.request,
    context,
  };
}
