import type { BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Page views on Vercel Web Analytics (`docs/security.md`, S13): what they leave out, and where
 * and from whom they are counted. `/privacy` says what they hold.
 */

/** A kept day's address as page views name it. */
export const KEPT_DAY_PATH = "/day/[id]";

/** A kept day's id in an address: anyone holding it opens that day, so it never leaves. */
const KEPT_DAY_ID =
  /\/day\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=$|[/?#])/gi;

/** The page view with every kept day's id written as `/day/[id]`; a written day's stays. */
export function withoutDayIds(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: event.url.replace(KEPT_DAY_ID, KEPT_DAY_PATH) };
}

/**
 * The page view as it leaves the browser: none from one marked as the owner's
 * (`isUncountedBrowser`), which is how Vercel drops an event, and every other without the
 * kept days' ids.
 */
export function pageViewToSend(
  event: BeforeSendEvent,
  isUncounted: boolean,
): BeforeSendEvent | null {
  return isUncounted ? null : withoutDayIds(event);
}

/**
 * Whether this deployment counts page views: Vercel's production alone. A laptop, the e2e
 * server and a preview count nothing, and load no script of Vercel's, whose development mode
 * would fetch one from another origin.
 */
export function isCountingPageViews(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.VERCEL_ENV === "production";
}
