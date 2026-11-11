import { writtenSeasonFor } from "@/lib/days/written/days";
import {
  DAY_VERSION_HEADER,
  SEEN_DAY_HEADER,
  WHOLE_DAY_HEADER,
  seenVersionOf,
  writtenVersionFor,
} from "@/lib/days/written/version";
import { daySlugOf } from "@/lib/days/address";
import { badRequest, issuesOf } from "@/lib/http/bad-request";
import { startPlaceChecking } from "@/lib/live/place-checks-in-stream";
import { fromAnotherSite, isFromAnotherSite } from "@/lib/same-site";
import { DayRequestSchema, type DayRequest } from "@/lib/schema/itinerary.schema";
import { startServerTiming, withServerTiming, type ServerTiming } from "@/lib/server-timing";
import { simulateDayStream, type StreamPace } from "./simulate-day-stream";
import type { UnevenPace } from "./uneven-pace";
import { recordedVerifierOf } from "./written-place-checks";

const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * How fast a curated day arrives: a live model's uneven pace with the gaps between bursts
 * eight times shorter. The wait for the first words and the two pauses keep their length,
 * so the waiting line still shows, and a whole day lands in about eleven seconds.
 */
export const WRITTEN_DAY_PACE: UnevenPace = { kind: "uneven", speed: 8 };

/**
 * A written day for a browser that has watched it to its end: the whole text in one delta,
 * its place checks with it, so the page draws it as it is, with nothing played.
 */
const WHOLE_PACE: StreamPace = {
  deltaChars: Number.MAX_SAFE_INTEGER,
  startDelayMs: 0,
  deltaDelayMs: 0,
};

/**
 * The longest city a live day is written for. The city is the one free text the day's model
 * reads, sent by the client, so it is held to a name's length: the longest city names run
 * to about 60 letters, and a longer string would only spend input tokens or carry words that
 * are not a city (`docs/harness.md`, "Prompt injection").
 */
export const MAX_LIVE_CITY_CHARS = 100;

/**
 * Writes a day no written day matches: `answerLiveDay` in `src/lib/live/live-day.ts`, given
 * by the route. It is passed in rather than imported because the lab's client pages read
 * `WRITTEN_DAY_PACE` from this module, and the live day is server code.
 */
export type LiveDay = (
  request: Request,
  dayRequest: DayRequest,
  timing: ServerTiming,
) => Promise<Response>;

/**
 * Answers `POST /api/day`, taking the first branch that fits:
 *
 * 1. A request another site's page sent is a 403, before its body is read (`src/lib/same-site.ts`).
 * 2. A body that is not a `DayRequest` is a 400 that lists its issues.
 * 3. A written day's request streams that day through the simulator, with live generation on or
 *    off and against no limit ("Curated days stream from the app's own route"). Its answer says
 *    its version (`DAY_VERSION_HEADER`) and comes whole at once to a browser that says it watched
 *    that version to its end (`SEEN_DAY_HEADER`), which the header reads on nothing else
 *    ("A written day's page is built whole, and plays only for a visitor who has not seen it").
 *    Its place checks, recorded with the day, follow each place as a live day's do
 *    (`src/lib/stream/written-place-checks.ts`). The stream stops when the visitor leaves.
 * 4. With no `live`, any other request is a 503, which the reader takes as `unavailable`.
 * 5. A city over `MAX_LIVE_CITY_CHARS` is a 400.
 * 6. Otherwise Claude writes the day through `live`: it carries the intake's signature for a city
 *    Lantern has not written ("A day for a city Lantern has not written carries the intake's
 *    signature") or names the kept day it changes, and is written to its end and kept ("A day is
 *    written to its end").
 *
 * Every answer carries a `Server-Timing` header of what it waited on before the stream began
 * (`src/lib/server-timing.ts`).
 */
export async function answerDayRequest(
  request: Request,
  pace: Partial<StreamPace> | UnevenPace = WRITTEN_DAY_PACE,
  live: LiveDay | null = null,
): Promise<Response> {
  const timing = startServerTiming();
  return withServerTiming(await answerOfRequest(request, pace, live, timing), timing);
}

async function answerOfRequest(
  request: Request,
  pace: Partial<StreamPace> | UnevenPace,
  live: LiveDay | null,
  timing: ServerTiming,
): Promise<Response> {
  if (isFromAnotherSite(request)) return fromAnotherSite();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest([{ path: "request", message: "The body is not JSON" }]);
  }

  const parsed = DayRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(issuesOf(parsed.error));

  const season = writtenSeasonFor(parsed.data, new Date());
  if (season) {
    // A start's day plays the checks its run had, its season's.
    const { written, checks } = season;
    const { city } = written.request;
    // The version this build holds, and whether the browser says it watched that one to its
    // end: only the pace of a written day reads it.
    const version = writtenVersionFor(written);
    const isSeen =
      seenVersionOf(request.headers.get(SEEN_DAY_HEADER), daySlugOf(written.request)) === version;
    const answer = await simulateDayStream({
      day: written.day,
      ending: { kind: "finished" },
      pace: isSeen ? WHOLE_PACE : pace,
      signal: request.signal,
      placeChecking: startPlaceChecking({
        verifier: recordedVerifierOf(written.day, checks, city, isSeen ? 0 : undefined),
        city,
        signal: request.signal,
      }),
    });
    answer.headers.set(DAY_VERSION_HEADER, version);
    if (isSeen) answer.headers.set(WHOLE_DAY_HEADER, "1");
    return answer;
  }
  if (live === null) return new Response(null, { status: HTTP_SERVICE_UNAVAILABLE });
  if (parsed.data.city.length > MAX_LIVE_CITY_CHARS) {
    return badRequest([
      { path: "city", message: `A city name is at most ${MAX_LIVE_CITY_CHARS} characters` },
    ]);
  }
  return live(request, parsed.data, timing);
}
