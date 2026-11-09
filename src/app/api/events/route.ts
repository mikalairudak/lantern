import { answerEventRequest } from "@/lib/events/answer-event-request";
import { eventDepsOf } from "@/lib/events/services";

/** The store's own deadline is 5 s (`EVENT_DEADLINE_MS`); this is the backstop. */
export const maxDuration = 10;

/**
 * Keeps one product event (`src/lib/events/event.schema.ts`), sent by `fetch` or
 * `navigator.sendBeacon`. It needs `DATABASE_URL` alone, and counts with `LIVE_GENERATION` off.
 */
export function POST(request: Request): Promise<Response> {
  return answerEventRequest(request, eventDepsOf(process.env));
}
