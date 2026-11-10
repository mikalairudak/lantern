/**
 * The written days this device has watched to their end, each by its address and version, so one
 * seen before opens whole, without the seconds of its playing (`docs/decisions.md`, "A day can be
 * read as a list, written as the chart is"). Kept in this browser's storage, as the view and the
 * theme are; when a seen day is asked of the route again, its key alone goes with it, the version
 * it saw, for the route to play it whole (`SEEN_DAY_HEADER`), as the privacy page says. A day left
 * mid-way is not kept, so it plays again; a written day rewritten in a later build has a new
 * version, so it plays as new; and without storage every day plays.
 *
 * A written day's page is drawn whole in its first HTML, for a reader without its script.
 * For a visitor who has not seen it, a script in the page notes so on `<html>` before the
 * day's markup is parsed, and the styles show the playing's first frame in its place until
 * the page's script plays the day from that same frame (`unseen` in `globals.css`).
 *
 * A day kept on the server opens whole at its address once its page reads that this device
 * has seen it (`docs/decisions.md`, "A written day's page is built whole, and plays only for a
 * visitor who has not seen it"): watched to its end here, as it was written, as a re-plan merged
 * into it or as someone's link opened it, which marks it by its id. The visitor's list of days is
 * no witness: it says how a day ended as the log tells it, whether or not anyone watched. Its
 * page's first HTML is the pen's first frame either way, which holds the whole day's room, so a day
 * seen comes whole with nothing moving.
 *
 * A search engine's renderer takes every day as seen (`isRenderingCrawler`), so it indexes the
 * day its first HTML holds, not the playing (`docs/discoverability.md`).
 */

import { BROWSER_STORAGE } from "@/lib/browser-storage";

/** Where the seen days are kept, in `localStorage`: a list of their keys, latest last. */
export const SEEN_DAYS_STORAGE_KEY = BROWSER_STORAGE.seen.key;

/** The attribute on `<html>` that says whether this page's day has been seen. */
export const SEEN_ATTRIBUTE = "data-day-seen";

/** The most days of each kind kept, written and kept, the oldest let go first. */
export const SEEN_DAYS_LIMIT = 50;

/**
 * The search engines that run a page's script and index what it then shows, by a word their
 * user agents carry, lowercased: Google's crawler, the live test of Search Console's URL
 * inspection, and Bing's. For them a written day is never played: the playing asks the route
 * for the day again, and Google's renderer gave that request up ("Other error") and indexed
 * the page's dropped-connection ending in place of the day its HTML held (2026-11-08).
 *
 * Kept to the engines Lantern is found through and knows to render. A crawler that reads only
 * the HTML, as every link preview's does, has the day whole already; one left off this list
 * plays the day as a visitor would. A visitor's agent that carries one of these words by
 * chance opens every day whole, as a device that has seen it does, with nothing played.
 */
const RENDERING_CRAWLERS: readonly string[] = ["googlebot", "google-inspectiontool", "bingbot"];

/** Whether `userAgent` is a search engine's renderer, which takes every day as seen. */
export function isRenderingCrawler(userAgent: string): boolean {
  const agent = userAgent.toLowerCase();
  return RENDERING_CRAWLERS.some((word) => agent.includes(word));
}

/**
 * Whether this page runs in a search engine's renderer, which sends no product event either
 * (`use-day-events.ts`). Never on the server.
 */
export function isInRenderingCrawler(): boolean {
  return typeof navigator !== "undefined" && isRenderingCrawler(navigator.userAgent);
}

/** How a kept day's key begins, its id after it. */
const KEPT_PREFIX = "kept:";

/**
 * The latest `SEEN_DAYS_LIMIT` of each kind, in their order: someone's links, opened by the
 * dozen, never push out the versions of Lantern's own days.
 */
function latestOfEachKind(keys: readonly string[]): string[] {
  const latest = new Set([
    ...keys.filter(isKeptSeenKey).slice(-SEEN_DAYS_LIMIT),
    ...keys.filter((key) => !isKeptSeenKey(key)).slice(-SEEN_DAYS_LIMIT),
  ]);
  return keys.filter((key) => latest.has(key));
}

/** Told when a day is marked seen on this page; another tab tells by `storage`. */
const SEEN_EVENT = "lantern-day-seen";

/** A written day's key: its address and the version the build wrote it in. */
export function seenKeyOf(slug: string, version: string): string {
  return `${slug}:${version}`;
}

/**
 * A kept day's key, by its id in the log: never a written day's address, so no written day's
 * key is ever taken for it, and the route, which only a written day's key goes to, never
 * hears of it.
 */
export function keptSeenKeyOf(id: string): string {
  return `${KEPT_PREFIX}${id}`;
}

function seenKeys(): readonly string[] {
  try {
    const kept = JSON.parse(localStorage.getItem(SEEN_DAYS_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(kept) ? kept.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}

/** The key of the version of the day at `slug` this device saw last, or null for none. */
export function seenKeyAt(slug: string): string | null {
  return seenKeys().findLast((key) => key.startsWith(`${slug}:`)) ?? null;
}

/**
 * Whether this device has watched the day to its end. Never, without storage; always, in a
 * search engine's renderer.
 */
export function isSeen(key: string): boolean {
  return isInRenderingCrawler() || seenKeys().includes(key);
}

/** Whether this device has watched the day kept under `id` to its end. Never, without storage. */
export function isKeptSeen(id: string): boolean {
  return isSeen(keptSeenKeyOf(id));
}

/** Notes that the day has played to its end here, for the next visit and this page's. */
export function markSeen(key: string): void {
  const keys = [...seenKeys().filter((kept) => kept !== key), key];
  try {
    localStorage.setItem(SEEN_DAYS_STORAGE_KEY, JSON.stringify(latestOfEachKind(keys)));
  } catch {
    // Without storage the day plays again next time.
    return;
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/** Whether a seen mark is a kept day's, by its id, rather than a written day's. */
export function isKeptSeenKey(key: string): boolean {
  return key.startsWith(KEPT_PREFIX);
}

/**
 * Forgets every kept day this device watched to its end: the visitor's own, the earlier
 * versions of one a re-plan merged into, which the list of their days no longer names, and
 * those opened by someone's link. A kept day's mark holds its id, which is its link. Lantern's
 * own written days stay seen. Without storage there is nothing to forget.
 */
export function forgetKeptSeen(): void {
  const written = seenKeys().filter((key) => !isKeptSeenKey(key));
  try {
    if (written.length === 0) localStorage.removeItem(SEEN_DAYS_STORAGE_KEY);
    else localStorage.setItem(SEEN_DAYS_STORAGE_KEY, JSON.stringify(written));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/** Calls back when a day is marked seen, on this page or in another tab. */
export function subscribeSeen(onChange: () => void): () => void {
  const fromStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SEEN_DAYS_STORAGE_KEY) onChange();
  };
  window.addEventListener(SEEN_EVENT, onChange);
  window.addEventListener("storage", fromStorage);
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange);
    window.removeEventListener("storage", fromStorage);
  };
}

/** The page's note is done with once its day is drawn as the visitor will see it. */
export function clearSeenNote(): void {
  document.documentElement.removeAttribute(SEEN_ATTRIBUTE);
}

/**
 * Run in the page before the day's markup: whether its day was seen, on `<html>`, as `isSeen`
 * tells it. Without storage, or with a key it does not hold, the day was not; in a search
 * engine's renderer, it was.
 */
export function seenScriptOf(key: string): string {
  const storageKey = JSON.stringify(SEEN_DAYS_STORAGE_KEY);
  const attribute = JSON.stringify(SEEN_ATTRIBUTE);
  const crawlers = JSON.stringify(RENDERING_CRAWLERS);
  return `(function(){var s="no";try{var a=navigator.userAgent.toLowerCase();if(${crawlers}.some(function(w){return a.indexOf(w)>=0}))s="yes";else{var k=JSON.parse(localStorage.getItem(${storageKey})||"[]");if(Array.isArray(k)&&k.indexOf(${JSON.stringify(key)})>=0)s="yes"}}catch(e){}document.documentElement.setAttribute(${attribute},s)})()`;
}
