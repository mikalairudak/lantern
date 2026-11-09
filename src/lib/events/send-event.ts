import { isUncountedBrowser } from "@/lib/analytics/uncounted-browser";
import { ProductEventSchema, type ProductEvent } from "./event.schema";

/** Lantern's own route for the product's events (`src/app/api/events/route.ts`). */
export const EVENTS_ROUTE = "/api/events";

export interface SendOptions {
  /**
   * The page is going away: the event goes by `navigator.sendBeacon`, which the browser
   * delivers after the page has gone, where a request the page started may be cancelled.
   */
  isLeaving?: boolean;
}

/**
 * Sends one product event (`docs/decisions.md`, "Product events are kept under a visitor key that
 * lives one day") and returns at once: it never waits for the answer, reads it, retries or throws,
 * so counting can neither slow the page nor break it. The page cannot read a beacon's status, so
 * the event is checked against the schema the route holds it to first, and one the route would
 * refuse, such as a city whose name has no letters an address can write, is not sent. The answer is
 * never read: the route answers 204 even to an event it does not keep, so no visitor's console
 * shows a failed resource for it. A browser marked as the owner's sends nothing
 * (`isUncountedBrowser`).
 */
export function sendProductEvent(
  event: ProductEvent,
  { isLeaving = false }: SendOptions = {},
): void {
  if (isUncountedBrowser()) return;
  const parsed = ProductEventSchema.safeParse(event);
  if (!parsed.success) return;
  const body = JSON.stringify(parsed.data);
  try {
    if (isLeaving && typeof navigator.sendBeacon === "function") {
      // A string, which the browser posts as text/plain, so no preflight holds it back.
      navigator.sendBeacon(EVENTS_ROUTE, body);
      return;
    }
    fetch(EVENTS_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // A browser that cannot send, as one that refuses a beacon, loses the event; the page goes on.
  }
}
