import { afterEach, describe, expect, it, vi } from "vitest";
import { KYOTO_ITINERARY, KYOTO_SLOW_START } from "@/lib/fixtures/replan/kyoto-morning";
import { REPLAN_ROUTE, replanRouteSourceFor, type ReplanAsk } from "./replan-route";

const ASK: ReplanAsk = {
  itinerary: KYOTO_ITINERARY,
  basis: { kind: "written", slug: "kyoto" },
  request: KYOTO_SLOW_START,
  changed: "start",
  windows: [{ from: 0, to: 1 }],
  round: 1,
  picks: {},
};

describe("replanRouteSourceFor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the day and sends the request, never the day itself", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetch);

    await replanRouteSourceFor(ASK)?.open(new AbortController().signal);

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(REPLAN_ROUTE);
    expect(JSON.parse(String(init?.body))).toEqual({
      basis: { kind: "written", slug: "kyoto" },
      request: KYOTO_SLOW_START,
      changed: "start",
      round: 1,
      picks: {},
    });
  });

  it("sends the visitor's picks by id, and merges into the day with them planned, as the route does", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetch);
    const garden = KYOTO_ITINERARY.stops[2];
    const option = garden?.alternatives[0];
    if (garden === undefined || option === undefined) throw new Error("Kyoto's garden has options");
    const picks = { [garden.id]: option.id };

    const source = replanRouteSourceFor({ ...ASK, picks });
    await source?.open(new AbortController().signal);

    const [, init] = fetch.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ picks });
    expect(source?.basis.itinerary.stops[2]?.selectedPlaceId).toBe(option.id);
    // The day itself, and every stop not picked, as the page holds them.
    expect(source?.basis.itinerary.stops[3]).toBe(KYOTO_ITINERARY.stops[3]);
    expect(KYOTO_ITINERARY.stops[2]?.selectedPlaceId).toBe(garden.primary.id);
  });

  it("writes nothing for a day the route cannot read, so the page re-plans it whole", () => {
    expect(replanRouteSourceFor({ ...ASK, basis: null })).toBeNull();
  });
});
