import type { IntakeRouteAnswer } from "@/lib/intake/signed-city";
import { todayIn } from "@/lib/normalizer/normalize-intake";
import type { StartReader } from "./written-reader";

/** Lantern's own route for reading the visitor's text, with live generation Claude Haiku's. */
export const INTAKE_ROUTE = "/api/intake";

const HTTP_TOO_MANY_REQUESTS = 429;

/** The kinds the route answers with 200: anything else in its body is not an answer. */
const ANSWERED_KINDS: readonly string[] = ["request", "question", "refused"];

/** The visitor's own today, which a date in the text ("Saturday") is read against. */
function visitorToday(now: Date): string {
  return todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone, now);
}

function isAnswer(body: unknown): body is IntakeRouteAnswer {
  return (
    typeof body === "object" &&
    body !== null &&
    "kind" in body &&
    typeof body.kind === "string" &&
    ANSWERED_KINDS.includes(body.kind)
  );
}

/**
 * The start screen's reader once live generation is on: the visitor's text posted to the
 * intake route, which answers with its status (`answerIntakeRequest`). A 429 is our own
 * limit, `limited`; any other failure, a misconfigured deploy's 503 among them, a lost
 * connection or a body that is not an answer, is a reading that could not run,
 * `unavailable`. Only the caller's own abort rejects.
 */
export const readIntakeRoute: StartReader = async (text, signal) => {
  let response: Response;
  try {
    response = await fetch(INTAKE_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, today: visitorToday(new Date()) }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "unavailable" };
  }
  if (response.status === HTTP_TOO_MANY_REQUESTS) return { kind: "limited" };
  if (!response.ok) return { kind: "unavailable" };
  const body: unknown = await response.json().catch(() => null);
  signal?.throwIfAborted();
  return isAnswer(body) ? body : { kind: "unavailable" };
};
