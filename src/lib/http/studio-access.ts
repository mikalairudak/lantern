import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { StudioLock, studioVerdictOf, type StudioVerdict } from "./studio-gate";

/** This instance's view of the studio's login, which logs once if the environment sets none. */
const STUDIO_LOCK = new StudioLock();

async function verdictOfThisRequest(): Promise<StudioVerdict> {
  return studioVerdictOf(
    (await headers()).get("authorization"),
    STUDIO_LOCK.settingsOf(process.env, process.env.NODE_ENV === "development"),
  );
}

/**
 * The studio's lock inside each of its pages and layouts, beside the proxy's
 * (`src/proxy.ts`). Vercel matches the proxy against the path as it is written, then routes a
 * path with a letter written escaped, as `/%6Cab`, to the lab's page and served it from its
 * cache, past the proxy (production, 2026-11-04; `docs/security.md`, S14). Read here, the login
 * is checked whatever path led to the page; and a page that reads its request is rendered for
 * each one, never prerendered into the cache. Without the login the page is not found; the
 * plain path never gets this far, since the proxy answers it with a 401 that asks for the
 * password, and the escaped path the proxy knows of neither, since it answers that with a 404.
 * The lock here holds whatever path a host finds the page by.
 *
 * Every page calls it, not only the layouts: a router request that says it already holds a
 * layout is answered without rendering that layout again, so a check in a layout alone could
 * be stepped round.
 */
export async function requireStudioLogin(): Promise<void> {
  const verdict = await verdictOfThisRequest();
  if (verdict !== "open") notFound();
}

/**
 * A studio page's title, given only to a request with the login. A page's title set as a
 * constant is written into the files the build makes for prefetching, which an escaped path
 * reaches past the proxy: there it was all a page of the studio still said ("Stream scrubber ·
 * Lantern", production, 2026-11-05). Read with the request, it is worked out per request, and a
 * request without the login gets no title of the page's.
 */
export async function studioMetadataOf(title: string): Promise<Metadata> {
  const verdict = await verdictOfThisRequest();
  return verdict === "open" ? { title } : {};
}
