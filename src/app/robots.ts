import type { MetadataRoute } from "next";
import { LAB_PATH, STUDIO_PATH } from "@/lib/http/studio-gate";
import { siteUrlOf } from "@/lib/site";

/**
 * The API routes a crawler is asked to keep off: those that read a visitor's text, re-plan a
 * day, or count the product's events, none of which a page needs to be read. `/api/day` stays
 * open. A search engine's renderer is never played a written day: it takes the day its page's
 * HTML holds whole (`isRenderingCrawler` in `src/features/day/seen-days.ts`), since Google's
 * gave up the stream it once asked here and indexed the page's dropped-connection ending
 * (2026-11-08). A renderer that list misses still plays the day through `POST /api/day`, and
 * barring it would end every such page that way. A written day is served from its file, never
 * by a model, and counts against no limit. A new API route is open until it is listed here.
 */
const KEPT_OFF_API = ["/api/events", "/api/intake", "/api/replan"];

/**
 * The studio and the lab, the owner's alone behind a password (`src/proxy.ts`): a crawler
 * would read only a 401 there, so it is asked not to spend a request on one. Naming the paths
 * here tells nothing the lock relies on: it is the password, not the address.
 */
const KEPT_OFF_STUDIO = [STUDIO_PATH, LAB_PATH];

/**
 * Every crawler, search engines' and AI assistants' alike, may read every page, and is told
 * where the sitemap is. This is a request to well-behaved crawlers, not a guard; the limits
 * guard what spends.
 *
 * A visitor's day, `/day/<id>`, is not disallowed: its page says `noindex`, and a crawler
 * barred from the page would never read that, and could list the bare address instead. The
 * studio's paths are, since no page links to them to list.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...KEPT_OFF_API, ...KEPT_OFF_STUDIO] },
    sitemap: siteUrlOf("/sitemap.xml"),
  };
}
