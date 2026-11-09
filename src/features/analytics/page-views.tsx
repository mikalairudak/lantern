"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { pageViewToSend } from "@/lib/analytics/page-views";
import { isUncountedBrowser } from "@/lib/analytics/uncounted-browser";

/**
 * Reads the owner's mark at each page view, so a browser marked or counted again changes from
 * its next one. One function for the page's life: Vercel's component hands it over again
 * whenever it changes.
 */
const beforeSend: BeforeSend = (event) => pageViewToSend(event, isUncountedBrowser());

/**
 * Vercel Web Analytics' page views, each kept day's id left out, and none from the owner's
 * browsers (`pageViewToSend`). A client component, since the root layout cannot hand a
 * function to one. The layout renders it only where page views are counted
 * (`isCountingPageViews`).
 */
export function PageViews() {
  return <Analytics beforeSend={beforeSend} />;
}
