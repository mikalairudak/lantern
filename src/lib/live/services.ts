import { anthropic } from "@ai-sdk/anthropic";
import type { LiveIntakeDeps } from "@/lib/intake/answer-intake-request";
import { EarlyCallGate } from "@/lib/intake/early-call";
import { placeVerifier, searchCities } from "@/lib/places/server";
import { isLiveGeneration, liveConfigOf, type LiveEnv } from "./flag";
import type { LiveDay } from "@/lib/stream/answer-day-request";
import { liveDayOf, type LiveDayDeps } from "./live-day";
import type { LiveReplanDeps } from "./live-replan";
import { MODEL_IDS } from "./models";
import { logToConsole } from "./provider-error";
import { storesFor } from "./stores";

/**
 * What the live routes run on in a deployment. The routes build their dependencies here,
 * per request, so the flag is read each time; the stores are made once per process
 * (`stores.ts`), so the day route and the intake route count against the same visitor and the
 * same $10.
 */

/** Work for after the response: Next's `after()`, passed in by the route. */
type Schedule = (task: () => Promise<void>) => void;

function common(env: LiveEnv, schedule: Schedule) {
  return {
    config: liveConfigOf(env),
    ...storesFor(env),
    schedule,
    log: logToConsole,
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
  };
}

/**
 * The live day's dependencies, or null with the flag off. The key is read when a call is made.
 * The visitor's places are checked on Geoapify with the server's `GEOAPIFY_API_KEY`; without
 * it every check ends unchecked and the day streams as before (`docs/grounding.md`).
 */
export function liveDayDeps(env: LiveEnv, schedule: Schedule): LiveDayDeps | null {
  if (!isLiveGeneration(env)) return null;
  return {
    ...common(env, schedule),
    models: { day: anthropic(MODEL_IDS.day), shadow: anthropic(MODEL_IDS.shadow) },
    placeVerifier,
  };
}

/**
 * A targeted re-plan's dependencies, or null with the flag off: the day's model alone, the
 * same stores, so a re-plan counts as one of the visitor's ten days against the same $10, and
 * the same place checks.
 */
export function liveReplanDeps(env: LiveEnv, schedule: Schedule): LiveReplanDeps | null {
  if (!isLiveGeneration(env)) return null;
  return { ...common(env, schedule), model: anthropic(MODEL_IDS.day), placeVerifier };
}

/** The live day for `answerDayRequest`, or null with the flag off. */
export function liveDay(env: LiveEnv, schedule: Schedule): LiveDay | null {
  const deps = liveDayDeps(env, schedule);
  return deps === null ? null : liveDayOf(deps);
}

/** What this process knows of the database's sleep, for the intake route alone. */
const INTAKE_EARLY_CALLS = new EarlyCallGate();

/**
 * The live intake's dependencies, or null with the flag off. Cities are looked up on
 * Geoapify with the server's `GEOAPIFY_API_KEY`; without it every lookup fails, and the
 * intake answers `unavailable`. Haiku reads the text beside the limits while the database
 * may be waking (`src/lib/intake/early-call.ts`).
 */
export function liveIntakeDeps(env: LiveEnv, schedule: Schedule): LiveIntakeDeps | null {
  if (!isLiveGeneration(env)) return null;
  return {
    ...common(env, schedule),
    model: anthropic(MODEL_IDS.intake),
    search: searchCities,
    earlyCalls: INTAKE_EARLY_CALLS,
  };
}
