// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PLACE = {
  name: "Convento do Carmo",
  kind: "architecture",
  neighborhood: "Chiado",
  coordinates: { lat: 38.712, lng: -9.1406 },
} as const;
/** A place to eat around, checked on the Places API rather than by its name. */
const AREA = {
  name: "Grilled fish in Mouraria",
  kind: "food",
  neighborhood: "Mouraria",
  coordinates: { lat: 38.7149, lng: -9.1349 },
} as const;
const LISBON = { city: "Lisbon" };

/** The process's client, and with it its queue, lives on `globalThis` under this name. */
const QUEUE_GLOBAL = "__lanternGeoapifyClient";

/** The module afresh, as another route's bundle would load it. */
async function loadServer() {
  vi.resetModules();
  return import("./server");
}

describe("the server's lookups", () => {
  const fetch = vi.fn<typeof globalThis.fetch>();

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, QUEUE_GLOBAL);
    fetch.mockReset();
    fetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ results: [] }))));
    vi.stubGlobal("fetch", fetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps one queue for the process, however many bundles load the module", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key");
    const t0 = Date.now();
    const sentAt: number[] = [];
    fetch.mockImplementation(() => {
      sentAt.push(Date.now() - t0);
      return Promise.resolve(new Response(JSON.stringify({ results: [] })));
    });
    const dayRoute = await loadServer();
    const intakeRoute = await loadServer();

    const lookups = [
      dayRoute.placeVerifier.verify(PLACE, LISBON),
      intakeRoute.searchCities("Lisbon"),
      dayRoute.placeVerifier.verify(AREA, LISBON),
    ];
    await vi.runAllTimersAsync();
    await Promise.all(lookups);

    expect(sentAt).toEqual([0, 200, 400]);
  });

  it("asks the Places API about a place to eat around, by its kind's categories, not its name", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key");
    const noPlaces = { type: "FeatureCollection", features: [] };
    fetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(noPlaces))));
    const { placeVerifier } = await loadServer();

    await expect(placeVerifier.verify(AREA, LISBON)).resolves.toEqual({
      kind: "unverified",
      reason: "too-few-places",
    });
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v2/places");
    expect(url.searchParams.get("categories")).toContain("catering.restaurant");
    expect(url.searchParams.has("text")).toBe(false);
  });

  it("leaves every place unverified, and asks nothing, without a key", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    const { placeVerifier } = await loadServer();

    await expect(placeVerifier.verify(PLACE, LISBON)).resolves.toEqual({
      kind: "unverified",
      reason: "no-key",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads the key from the server's environment", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", " test-key ");
    const { placeVerifier } = await loadServer();
    await placeVerifier.verify(PLACE, LISBON);

    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get("apiKey")).toBe("test-key");
    expect(url.searchParams.get("text")).toBe("Convento do Carmo, Lisbon");
  });

  it("looks cities up for the resolver, on the same key", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key");
    const { searchCities } = await loadServer();

    await expect(searchCities("Lisbon")).resolves.toEqual({ results: [] });
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get("type")).toBe("city");
  });

  it("rejects a city lookup that fails, as the resolver expects", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    const { searchCities } = await loadServer();

    await expect(searchCities("Lisbon")).rejects.toThrow("no-key");
  });

  it("rejects with the caller's reason once the caller has walked away", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key");
    const { searchCities } = await loadServer();
    const controller = new AbortController();
    const left = new DOMException("The visitor left", "AbortError");
    controller.abort(left);

    await expect(searchCities("Lisbon", controller.signal)).rejects.toBe(left);
  });
});
