import { after } from "next/server";
import { answerIntakeRequest } from "@/lib/intake/answer-intake-request";
import { liveIntakeDeps } from "@/lib/live/services";

/**
 * Seconds an intake may run: a Haiku read of about a second, up to 6 s of the SDK's
 * retries, and one city lookup per name, at most three, side by side.
 */
export const maxDuration = 30;

/**
 * Reads the visitor's text into a request or a question about its city: the written intake,
 * or with `LIVE_GENERATION=1` Claude Haiku.
 */
export function POST(request: Request): Promise<Response> {
  return answerIntakeRequest(request, liveIntakeDeps(process.env, after));
}
