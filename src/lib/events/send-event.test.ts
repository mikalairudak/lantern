import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markUncountedBrowser } from "@/lib/analytics/uncounted-browser";
import { ONE_EVENT_OF_EACH_KIND } from "@/lib/fixtures/events";
import type { ProductEvent } from "./event.schema";
import { EVENTS_ROUTE, sendProductEvent } from "./send-event";

const DAY_OPENED: ProductEvent = { kind: "day-opened", city: "kyoto", via: "link", written: true };

const fetchEvent = vi.fn<typeof fetch>();
const sendBeacon = vi.fn<Navigator["sendBeacon"]>();

beforeEach(() => {
  fetchEvent.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  sendBeacon.mockReset().mockReturnValue(true);
  vi.stubGlobal("fetch", fetchEvent);
  Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "sendBeacon");
  localStorage.clear();
});

/** What the route was sent, as it reads it: the body's text, parsed. */
function fetchedBodies(): unknown[] {
  return fetchEvent.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
}

describe("sending a product event", () => {
  it.each(ONE_EVENT_OF_EACH_KIND.map((event) => [event.kind, event] as const))(
    "posts %s to the route as JSON, kept alive past the page",
    (_kind, event) => {
      sendProductEvent(event);

      expect(fetchEvent).toHaveBeenCalledTimes(1);
      const [url, init] = fetchEvent.mock.calls[0] ?? [];
      expect(url).toBe(EVENTS_ROUTE);
      expect(init).toMatchObject({ method: "POST", keepalive: true });
      expect(fetchedBodies()).toEqual([event]);
      expect(sendBeacon).not.toHaveBeenCalled();
    },
  );

  it("sends a beacon with the event as a string when the page is going away", () => {
    sendProductEvent(DAY_OPENED, { isLeaving: true });

    expect(sendBeacon).toHaveBeenCalledWith(EVENTS_ROUTE, JSON.stringify(DAY_OPENED));
    expect(fetchEvent).not.toHaveBeenCalled();
  });

  it("falls back to a fetch kept alive where the browser has no beacon", () => {
    Reflect.deleteProperty(navigator, "sendBeacon");

    sendProductEvent(DAY_OPENED, { isLeaving: true });

    expect(fetchedBodies()).toEqual([DAY_OPENED]);
  });

  it("sends nothing the route would refuse", () => {
    sendProductEvent({ ...DAY_OPENED, city: "" });
    sendProductEvent({ ...DAY_OPENED, city: "東京" });
    sendProductEvent({ ...DAY_OPENED, via: "shared" } as unknown as ProductEvent);
    sendProductEvent({
      kind: "word-changed",
      city: "kyoto",
      word: "energy",
      control: "slider",
    } as unknown as ProductEvent);

    expect(fetchEvent).not.toHaveBeenCalled();
  });

  it("sends nothing from a browser marked as the owner's, and sends again once counted", () => {
    markUncountedBrowser(true);

    sendProductEvent(DAY_OPENED);
    sendProductEvent(DAY_OPENED, { isLeaving: true });
    expect(fetchEvent).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();

    markUncountedBrowser(false);
    sendProductEvent(DAY_OPENED);
    expect(fetchedBodies()).toEqual([DAY_OPENED]);
  });

  it("ignores every answer and a lost connection, and never retries", async () => {
    fetchEvent
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    expect(() => sendProductEvent(DAY_OPENED)).not.toThrow();
    expect(() => sendProductEvent(DAY_OPENED)).not.toThrow();
    await Promise.resolve();

    expect(fetchEvent).toHaveBeenCalledTimes(2);
  });

  it("never throws when the browser cannot send at all", () => {
    fetchEvent.mockImplementation(() => {
      throw new TypeError("Blocked");
    });
    sendBeacon.mockImplementation(() => {
      throw new TypeError("Blocked");
    });

    expect(() => sendProductEvent(DAY_OPENED)).not.toThrow();
    expect(() => sendProductEvent(DAY_OPENED, { isLeaving: true })).not.toThrow();
  });
});
