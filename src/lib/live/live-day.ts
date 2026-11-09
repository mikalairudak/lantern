import { normalizeDay } from "@/lib/normalizer/normalize";
import type { PlaceVerifier } from "@/lib/places/verify-place";
import { runQualityChecks } from "@/lib/quality/checks";
import { GeneratedDaySchema, type DayRequest } from "@/lib/schema/itinerary.schema";
import { DAY_ID_HEADER, isDayId } from "@/lib/days/stored-day";
import { KEPT_DAY_HEADER, signedKeyOf } from "@/lib/intake/signed-city";
import type { ServerTiming } from "@/lib/server-timing";
import type { LiveDay } from "@/lib/stream/answer-day-request";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import { readDayStream } from "@/lib/stream/read-day-stream";
import { isSignedRequest, keptCityOf } from "./city-signature";
import { DAY_INSTRUCTIONS, DAY_PROMPT_VERSION, dayPromptFor } from "./day-prompt";
import type { LiveConfigResult } from "./flag";
import {
  GENERATION_LOG_STORE,
  type DayArchive,
  type GenerationLog,
  type GenerationRecord,
} from "./generation-log";
import {
  giveBackHeld,
  LIMITS_STORE,
  PRE_CALL_DEADLINE_MS,
  settleAll,
  type AppSpend,
  type Held,
  type Reservation,
  type Settlement,
  type Take,
  type VisitorLimits,
} from "./limits";
import {
  DAY_INPUT_TOKENS_CEILING,
  DAY_MAX_OUTPUT_TOKENS,
  MODEL_IDS,
  SHADOW_MAX_OUTPUT_TOKENS,
  worstCaseUsd,
} from "./models";
import { describeProviderError, messageOf, type ServerLog } from "./provider-error";
import { placeCheckingFor } from "./place-checks-in-stream";
import {
  parsedOrNull,
  placeResultsOf,
  spentOf,
  startStreamedCall,
  traceFieldsOf,
  type CallSpec,
  type CallTrace,
  type StreamedCall,
  type StreamedCallOptions,
  type StreamingModel,
} from "./streamed-call";
import { visitorOf } from "./visitor";
import { beforeDeadline } from "@/lib/time/deadline";

/**
 * The day route written live: the city's gate, the visitor's count and the app's cap before
 * any call, then the visitor's day on Claude Sonnet 5.5 and, unseen beside it, the same request
 * on Claude Haiku 5.5, both made as `streamed-call.ts` makes any streamed call, and both
 * settled and sent to the log as a pair once they end. It also holds what a request gives back
 * when it fails before `after()`, which the re-plan's route shares. Server only.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/live/live-day.ts calls Claude with the server's key and runs only on the server",
  );
}

const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;

export interface LiveDayDeps {
  config: LiveConfigResult;
  models: { day: StreamingModel; shadow: StreamingModel };
  visitorLimits: VisitorLimits;
  appSpend: AppSpend;
  generationLog: GenerationLog;
  /**
   * The same log, read back: the city of a kept day a request names by its id, and the day a
   * re-plan rewrites.
   */
  dayArchive: DayArchive;
  /** Runs work once the response has finished: Next's `after()` in the route. */
  schedule: (task: () => Promise<void>) => void;
  log: ServerLog;
  now: () => Date;
  newId: () => string;
  /** The SDK retries a 429 or 5xx twice by default, after 2 s and 4 s; tests turn it off. */
  maxRetries?: number;
  /** How long the stores may take before the call, all together; tests shorten it. */
  preCallDeadlineMs?: number;
  /**
   * Checks the visitor's places against Geoapify while the day streams (`docs/grounding.md`);
   * without it the day streams with no checks, as the eval's rounds and most tests run.
   */
  placeVerifier?: PlaceVerifier;
  /** How long the close waits for the last checks after the model's last word; tests shorten it. */
  placeCheckDeadlineMs?: number;
}

/** Each day call's output cap, by its role. */
const MAX_OUTPUT_TOKENS: Readonly<Record<"day" | "shadow", number>> = {
  day: DAY_MAX_OUTPUT_TOKENS,
  shadow: SHADOW_MAX_OUTPUT_TOKENS,
};

/** The most a day can cost on each model, held against the app's cap before the call. */
export const DAY_RESERVE_USD = worstCaseUsd(
  MODEL_IDS.day,
  DAY_INPUT_TOKENS_CEILING,
  MAX_OUTPUT_TOKENS.day,
);
export const SHADOW_RESERVE_USD = worstCaseUsd(
  MODEL_IDS.shadow,
  DAY_INPUT_TOKENS_CEILING,
  MAX_OUTPUT_TOKENS.shadow,
);

/** A day's call for its role: the day's prompt, its schema and the role's output cap. */
function dayCallOf(request: DayRequest, role: "day" | "shadow"): CallSpec {
  return {
    instructions: DAY_INSTRUCTIONS,
    prompt: dayPromptFor(request),
    schema: GeneratedDaySchema,
    maxOutputTokens: MAX_OUTPUT_TOKENS[role],
    read: (response) => readDayStream({ request, response, onPartial: () => undefined }),
  };
}

function recordOf(
  trace: CallTrace,
  request: DayRequest,
  id: string,
  pairId: string | null,
): GenerationRecord {
  // A salvaged cut is scored on the day the visitor was shown, which its text cannot parse to.
  const output = trace.salvaged ?? parsedOrNull(trace.outputText);
  const day = GeneratedDaySchema.safeParse(output);
  return {
    ...traceFieldsOf(trace),
    id,
    pairId,
    promptVersion: DAY_PROMPT_VERSION,
    salvaged: trace.salvaged !== null,
    // Counted on the day as the visitor is shown it, as the checks score it.
    repairs: day.success
      ? normalizeDay(request, withLettersUnescaped(day.data)).repairs.length
      : null,
    checks:
      output === null ? null : [...runQualityChecks(request, output), ...placeResultsOf(trace)],
    request,
  };
}
export function limited(): Response {
  return new Response(null, { status: HTTP_TOO_MANY_REQUESTS });
}

/** The live day as `answerDayRequest` takes it. */
export function liveDayOf(deps: LiveDayDeps): LiveDay {
  return (request, dayRequest, timing) => answerLiveDay(request, dayRequest, deps, timing);
}

export function unavailable(): Response {
  return new Response(null, { status: HTTP_SERVICE_UNAVAILABLE });
}

/** A city the intake did not sign: the reader takes any status but 429 as `unavailable`. */
export function forbidden(): Response {
  return new Response(null, { status: HTTP_FORBIDDEN });
}

/**
 * The visitor's take, out of what the request holds: it goes back when the request fails
 * before `after()` or when its day comes back empty, and whichever takes it out first is the
 * only one that gives it back.
 */
function takeOut(held: Held): Take | null {
  const { take } = held;
  held.take = null;
  return take;
}

/**
 * Gives back everything a request held when its calls never reached `after()`, which would
 * have settled them. A store that fails here too is logged; nothing more can be done then.
 */
export async function giveBack(
  held: Held,
  deps: Pick<LiveDayDeps, "visitorLimits" | "appSpend" | "log">,
): Promise<void> {
  const failures = await giveBackHeld(
    { take: takeOut(held), reservations: held.reservations },
    deps,
  );
  for (const failure of failures) {
    deps.log("live-hold-not-returned", { message: messageOf(failure) });
  }
}

/**
 * Gives the visitor's day back when the model closed its stops with none in them, the
 * owner's call (`docs/decisions.md`, "A day has at least one stop"): the visitor did not
 * cause it, and the page asks for the day once more. Any other invalid day stays counted.
 * What Claude charged for it stays in the app's spend, settled in `after()` as any call is.
 * It runs before the visitor's copy closes, so the page's retry finds the day returned, and
 * under the stores' own deadline; a store that fails or is late leaves the day counted and
 * says so in one line. It never rejects.
 */
async function giveBackEmptyDay(trace: CallTrace, held: Held, deps: LiveDayDeps): Promise<void> {
  if (trace.isEmpty) await giveBackBeforeClose(trace, held, deps, "empty-day");
}

/**
 * Gives the visitor's count back before their copy of the stream closes, under the stores' own
 * deadline, and says which in one line, `<event>-given-back` or `<event>-not-given-back`: a store
 * that fails or is late leaves the count taken. It never rejects.
 */
export async function giveBackBeforeClose(
  trace: CallTrace,
  held: Held,
  deps: Pick<LiveDayDeps, "visitorLimits" | "preCallDeadlineMs" | "log">,
  event: string,
): Promise<void> {
  const take = takeOut(held);
  if (take === null) return;
  const fields = { model: trace.model, requestId: trace.requestId };
  try {
    const deadline = AbortSignal.timeout(deps.preCallDeadlineMs ?? PRE_CALL_DEADLINE_MS);
    await beforeDeadline(deps.visitorLimits.giveBack(take), deadline, LIMITS_STORE);
    deps.log(`${event}-given-back`, fields);
  } catch (cause) {
    deps.log(`${event}-not-given-back`, { ...fields, message: messageOf(cause) });
  }
}

/**
 * Whether the route may write the request's city: a written day's or one the intake signed
 * (`isSignedRequest`), or the city and zone of the kept day the request names by its id in
 * `KEPT_DAY_HEADER`, read from the server's own record (`keptCityOf`), as a word changed on a
 * day opened at its address asks. An id that cannot be one is never read. The read is the
 * route's first store call, under the same deadline as the rest; a log that fails it throws.
 */
async function mayWriteCity(
  request: Request,
  dayRequest: DayRequest,
  { salt, archive, deadline }: { salt: string; archive: DayArchive; deadline: AbortSignal },
  timing: ServerTiming,
): Promise<boolean> {
  if (await isSignedRequest(request, dayRequest, salt)) return true;
  const id = request.headers.get(KEPT_DAY_HEADER);
  if (id === null || !isDayId(id)) return false;
  const record = await timing.time("basis", () =>
    beforeDeadline(archive.dayRecordOf(id), deadline, GENERATION_LOG_STORE),
  );
  const kept = keptCityOf(record);
  return kept !== null && signedKeyOf(kept) === signedKeyOf(dayRequest);
}

/**
 * Answers a request no written day matches, with the flag on. A city Lantern has not written is
 * written only under the intake's signature of it and its zone, or as the city of a day the server
 * kept that the request names (`mayWriteCity`); otherwise the answer is a 403 before anything is
 * counted, and a log that cannot be read for the kept day a 503. The limits are checked before any
 * call: the visitor's count is taken first, so a visitor past the limit holds none of the app's
 * cap however many requests they send at once, then the app's cap holds the day's worst case, and
 * over either the answer is a 429 the reader takes as `limited`. The shadow runs only while the
 * cap has room for it too. Both calls write on when the visitor leaves, so the day lies in the log
 * under the id the answer names in `DAY_ID_HEADER`, and the pair stays whole. The shadow's failure
 * is its own record and never the visitor's outcome. If anything fails before `after()` takes the
 * calls over, everything held is given back; a day the model closed with no stops gives the
 * visitor's count back (`giveBackEmptyDay`).
 *
 * The re-plan (`live-replan.ts`) and the intake (`src/lib/intake/answer-intake-request.ts`)
 * count, hold and give back in this same order, each written out where it runs so the order
 * reads top to bottom. Where they differ from it, they do on purpose: a re-plan has no city's
 * gate, since its city is that of a day the server already holds, and no shadow; the intake
 * may start its call beside the count while the database wakes (`src/lib/intake/early-call.ts`).
 */
export async function answerLiveDay(
  request: Request,
  dayRequest: DayRequest,
  deps: LiveDayDeps,
  timing: ServerTiming,
): Promise<Response> {
  if (deps.config.kind === "misconfigured") {
    deps.log("live-generation-misconfigured", { missing: deps.config.missing });
    return unavailable();
  }
  const salt = deps.config.config.visitorHashSalt;
  // One deadline for every store call before the model's, however many there are.
  const deadline = AbortSignal.timeout(deps.preCallDeadlineMs ?? PRE_CALL_DEADLINE_MS);
  // Before any count: a city neither signed nor kept never takes a visitor's day.
  let mayWrite: boolean;
  try {
    const reads = { salt, archive: deps.dayArchive, deadline };
    mayWrite = await mayWriteCity(request, dayRequest, reads, timing);
  } catch (cause) {
    deps.log("kept-day-unread", { message: messageOf(cause) });
    return unavailable();
  }
  if (!mayWrite) {
    deps.log("day-request-not-signed", {
      timezone: dayRequest.timezone,
      isKeptNamed: request.headers.has(KEPT_DAY_HEADER),
    });
    return forbidden();
  }
  const held: Held = { take: null, reservations: [] };
  const stopping = new AbortController();
  try {
    const now = deps.now();
    const visitor = await visitorOf(request, salt);
    held.take = await timing.time("limits", () =>
      beforeDeadline(deps.visitorLimits.take(visitor, "day", now), deadline, LIMITS_STORE),
    );
    if (held.take === null) return limited();
    const dayReservation = await timing.time("limits", () =>
      beforeDeadline(deps.appSpend.reserve(DAY_RESERVE_USD, now), deadline, LIMITS_STORE),
    );
    if (dayReservation === null) {
      await timing.time("limits", () => giveBack(held, deps));
      return limited();
    }
    // A call stopped before `after()` is stopped at once, so it settles at nothing.
    held.reservations.push({ reservation: dayReservation, spentUsd: 0 });
    const shadowReservation = await timing.time("limits", () =>
      beforeDeadline(deps.appSpend.reserve(SHADOW_RESERVE_USD, now), deadline, LIMITS_STORE),
    );
    if (shadowReservation !== null) {
      held.reservations.push({ reservation: shadowReservation, spentUsd: 0 });
    }

    const common = {
      signal: stopping.signal,
      startedAt: now,
      maxRetries: deps.maxRetries,
      log: deps.log,
    };
    const day = startStreamedCall({
      ...common,
      role: "day",
      model: deps.models.day,
      call: dayCallOf(dayRequest, "day"),
      beforeClose: (trace) => giveBackEmptyDay(trace, held, deps),
      placeChecking: placeCheckingFor(deps, dayRequest.city, common.signal),
    });
    const shadow =
      shadowReservation === null
        ? null
        : startShadow({ ...common, call: dayCallOf(dayRequest, "shadow") }, deps);
    // The day's row in the log, named before it is written so the page can keep it.
    const dayId = deps.newId();
    scheduleRecords(deps, dayRequest, { day, dayId, dayReservation, shadow, shadowReservation });
    // The day's call always has a copy for the visitor.
    const response = day.response as Response;
    response.headers.set(DAY_ID_HEADER, dayId);
    return response;
  } catch (cause) {
    // Calls started before the failure stop here, so nothing runs that the cap does not hold.
    stopping.abort();
    deps.log("live-day-failed", { message: describeProviderError(cause).message });
    await timing.time("limits", () => giveBack(held, deps));
    return unavailable();
  }
}

interface Calls {
  day: StreamedCall;
  /** The id the day's record takes, which the visitor's answer already names. */
  dayId: string;
  dayReservation: Reservation;
  shadow: StreamedCall | null;
  shadowReservation: Reservation | null;
}

/**
 * Leaves the spend's settling and the pair's records to `after()`, once the calls end. Every
 * hold is settled first, each on its own, and only then is each call recorded, each on its
 * own, so a record the log refuses can never keep a hold counted, nor cost the other record.
 */
function scheduleRecords(
  deps: LiveDayDeps,
  dayRequest: DayRequest,
  { day, dayId, dayReservation, shadow, shadowReservation }: Calls,
): void {
  deps.schedule(async () => {
    // Neither trace rejects.
    const [dayTrace, shadowTrace] = await Promise.all([day.trace, shadow?.trace ?? null]);
    const settlements: Settlement[] = [
      { reservation: dayReservation, spentUsd: spentOf(dayTrace, dayReservation) },
    ];
    if (shadowReservation !== null) {
      const spentUsd = shadowTrace === null ? 0 : spentOf(shadowTrace, shadowReservation);
      settlements.push({ reservation: shadowReservation, spentUsd });
    }
    for (const failure of await settleAll(deps.appSpend, settlements)) {
      deps.log("spend-not-settled", { message: messageOf(failure) });
    }

    const pairId = shadowTrace === null ? null : deps.newId();
    for (const trace of shadowTrace === null ? [dayTrace] : [dayTrace, shadowTrace]) {
      try {
        const id = trace.role === "day" ? dayId : deps.newId();
        await deps.generationLog.record(recordOf(trace, dayRequest, id, pairId));
      } catch (cause) {
        deps.log("generation-log-failed", {
          role: trace.role,
          message: messageOf(cause),
        });
      }
    }
  });
}

/** The shadow, or nothing if it cannot even start; the visitor's day goes on either way. */
function startShadow(
  common: Omit<StreamedCallOptions, "role" | "model">,
  deps: LiveDayDeps,
): StreamedCall | null {
  try {
    return startStreamedCall({ ...common, role: "shadow", model: deps.models.shadow });
  } catch (cause) {
    deps.log("shadow-failed-to-start", { message: describeProviderError(cause).message });
    return null;
  }
}
