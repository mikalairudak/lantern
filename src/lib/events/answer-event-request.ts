import { messageOf, type ServerLog } from "@/lib/live/provider-error";
import { visitorOf } from "@/lib/live/visitor";
import { formatPath } from "@/lib/quality/path";
import { fromAnotherSite, isFromAnotherSite } from "@/lib/same-site";
import { beforeDeadline } from "@/lib/time/deadline";
import { utcDayOf } from "@/lib/time/utc-day";
import { ProductEventSchema, type ProductEventKind } from "./event.schema";
import type { EventStore } from "./event-store";

/**
 * Answers `POST /api/events`: one product event, validated against its schema and kept
 * under the visitor's hash for the day (`docs/decisions.md`, "Product events are kept under a
 * visitor key that lives one day"). It reads nothing of live generation, so it counts with
 * `LIVE_GENERATION` off.
 *
 * It is built for `navigator.sendBeacon`, which posts a string as `text/plain;charset=UTF-8`,
 * sends no header of its own and never lets the page read the answer. So the body is read as
 * text and parsed as JSON whatever its type. Every request from Lantern's own site is answered
 * 204, whether its event was kept or not: the page can do nothing about a refusal, and the
 * browser writes any other status into the visitor's console as a failed resource. Why an
 * event was not kept goes to the server's log instead, one line with no address. Only a
 * request another site sent is refused openly, with 403 (`src/lib/same-site.ts`): a beacon
 * from a page elsewhere comes from each of that page's visitors' addresses, past every
 * visitor's limit.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/events/answer-event-request.ts reads the client's address and runs only on the server",
  );
}

const HTTP_NO_CONTENT = 204;

/** The longest event is about 200 bytes; anything past a kilobyte is not one. */
export const MAX_EVENT_BYTES = 1024;

/**
 * How long the store may take for one event, its salt included. Neon wakes a sleeping
 * database in about a second, and nobody waits for the answer.
 */
export const EVENT_DEADLINE_MS = 5_000;

/** What the events' store is called when it misses an event's deadline. */
const EVENT_STORE = "The events' store";

/** What the server's log says of an event it did not keep. */
export const NOT_KEPT = "event-not-kept";

export interface EventDeps {
  store: EventStore;
  log: ServerLog;
  now: () => Date;
  newId: () => string;
  /** Tests shorten it. */
  deadlineMs?: number;
}

/**
 * Why an event was not kept, as the log says it. Each field is a word of the route's own or
 * a path of the schema, never what the request wrote, so no line can carry a visitor's text.
 */
export type NotKept =
  | { reason: "unreadable" }
  | { reason: "too-large" }
  | { reason: "not-json" }
  /** Refused by the schema, at these paths: a page from before a deploy can send one. */
  | { reason: "not-an-event"; issues: string[] }
  /** The visitor's or the app's events of the day are spent, or the day is over. */
  | { reason: "spent"; kind: ProductEventKind }
  /** The store failed or did not answer, a database without its migration among them. */
  | { reason: "store-failed"; kind: ProductEventKind; message: string };

/** The body as text, or null once it passes `MAX_EVENT_BYTES`, read no further than that. */
async function boundedTextOf(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_EVENT_BYTES) return null;
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > MAX_EVENT_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

/** Keeps the request's event, or says why it was not kept. */
async function keepEvent(request: Request, deps: EventDeps): Promise<NotKept | null> {
  let text: string | null;
  try {
    text = await boundedTextOf(request);
  } catch {
    return { reason: "unreadable" };
  }
  if (text === null) return { reason: "too-large" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { reason: "not-json" };
  }
  const parsed = ProductEventSchema.safeParse(json);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => formatPath(issue.path) || "request");
    return { reason: "not-an-event", issues: [...new Set(paths)] };
  }

  const { kind } = parsed.data;
  const deadline = AbortSignal.timeout(deps.deadlineMs ?? EVENT_DEADLINE_MS);
  try {
    const day = utcDayOf(deps.now());
    const salt = await beforeDeadline(deps.store.saltOn(day), deadline, EVENT_STORE);
    const visitor = await visitorOf(request, salt);
    const entry = { id: deps.newId(), visitor, day, event: parsed.data };
    const isKept = await beforeDeadline(deps.store.record(entry), deadline, EVENT_STORE);
    return isKept ? null : { reason: "spent", kind };
  } catch (cause) {
    return { reason: "store-failed", kind, message: messageOf(cause) };
  }
}

export async function answerEventRequest(request: Request, deps: EventDeps): Promise<Response> {
  if (isFromAnotherSite(request)) return fromAnotherSite();
  const notKept = await keepEvent(request, deps);
  if (notKept !== null) deps.log(NOT_KEPT, { ...notKept });
  return new Response(null, { status: HTTP_NO_CONTENT });
}
