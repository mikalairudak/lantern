import { after } from "next/server";
import { answerReplanRequest } from "@/lib/live/live-replan";
import { liveReplanDeps } from "@/lib/live/services";

/**
 * Seconds a re-plan may run: its 6,000-token cap at 100 tokens a second is 60 s, the SDK's
 * retries can add 6 s before it starts, and the close waits up to 3 s for the last place
 * checks. Under the day's 150 s, as a re-plan writes a window of the day, not all of it.
 */
export const maxDuration = 90;

/**
 * Re-plans the part of the day on the page that a changed word shaped
 * (`docs/targeted-replan.md`), with `LIVE_GENERATION=1`; a 503 with it off.
 */
export function POST(request: Request): Promise<Response> {
  return answerReplanRequest(request, liveReplanDeps(process.env, after));
}
