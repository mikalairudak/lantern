import { after } from "next/server";
import { liveDay } from "@/lib/live/services";
import { answerDayRequest, WRITTEN_DAY_PACE } from "@/lib/stream/answer-day-request";

/**
 * Seconds a live day may run. The first live days measured Sonnet at about 145 tokens a second, so
 * a day of about 6,500 tokens takes 45 to 50 s, and one that runs to its 12,000-token cap about 85
 * s. The SDK's retries can add 6 s before it starts, and 150 s still covers the cap at 100 tokens a
 * second. The shadow runs beside it, on the faster Haiku, so `after()` waits for no more than the
 * day. Well under the 300 s Vercel allows on every plan.
 */
export const maxDuration = 150;

/**
 * Streams a day for a `DayRequest`: a written one from its file, and with `LIVE_GENERATION=1`
 * any other one from Claude.
 */
export function POST(request: Request): Promise<Response> {
  return answerDayRequest(request, WRITTEN_DAY_PACE, liveDay(process.env, after));
}
