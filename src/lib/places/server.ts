import { citySearchParams, type TextSearch } from "@/lib/intake/resolve-city";
import { createGeoapifyClient, type GeoapifyClient } from "./geoapify";
import { createPlaceVerifier, type PlaceVerifier } from "./verify-place";

/**
 * The live lookups, on the server's key. The key is `GEOAPIFY_API_KEY`, never a
 * `NEXT_PUBLIC_` variable, so no browser bundle holds it; this module refuses to load in a
 * browser at all. The guard is a check on `window`, not the `server-only` package, since that
 * package throws wherever it is not bundled for the server, Vitest's Node runs included, and
 * `server.browser.test.ts` loads the module where `window` exists to prove the refusal.
 */
if (typeof window !== "undefined") {
  throw new Error("src/lib/places/server.ts reads GEOAPIFY_API_KEY and runs only on the server");
}

function readApiKey(): string | null {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  return key === undefined || key === "" ? null : key;
}

/**
 * One client for the process, its one queue shared by places, areas and cities, since they
 * spend one key's rate. It lives on `globalThis` because Next bundles each route on its own,
 * and a module-level client would give every route bundle a queue of its own. It is one per
 * process, not one in all: each serverless instance keeps its own 5 a second, so with several
 * instances warm the key's true rate can exceed it, and Geoapify's 429 then pauses each
 * instance on its own. The slot was named for a queue of the geocoder alone until the Places
 * API joined it; a new name keeps a dev server's old function from standing in for a client.
 */
const CLIENT_GLOBAL = "__lanternGeoapifyClient";
const processGlobal = globalThis as typeof globalThis & { [CLIENT_GLOBAL]?: GeoapifyClient };
const client = (processGlobal[CLIENT_GLOBAL] ??= createGeoapifyClient({
  readApiKey,
  fetch: (input, init) => globalThis.fetch(input, init),
}));

/** The client itself, for the live eval round, which checks its days' places on the same queue. */
export const geoapify: GeoapifyClient = client;

export const placeVerifier: PlaceVerifier = createPlaceVerifier(client);

/**
 * The resolver's search on Geoapify. A failed lookup rejects, as `answerIntake` expects, and
 * with the caller's own reason once the caller has walked away.
 */
export const searchCities: TextSearch = async (query, signal) => {
  const answer = await client.geocode(citySearchParams(query), signal);
  if (answer.ok) return answer.body;
  if (signal?.aborted) throw signal.reason;
  throw new Error(`Geoapify could not look the city up: ${answer.failure}`);
};
