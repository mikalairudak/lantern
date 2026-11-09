"use client";

import { PageFailed } from "@/features/day/page-failed";

interface ErrorPageProps {
  /** What failed. Never shown: what a visitor sees of a failure is Lantern's own words. */
  error: unknown;
  /** Draws the page again, asking its server again. */
  retry: () => void;
}

/**
 * Any page that fails as it is drawn, on the server or in the browser, under the root layout:
 * Lantern's page for a failure, in place of the page. With Cache Components the page's shell has
 * gone out by the time a part that waits on the request fails on the server, so the answer stays
 * 200: its first HTML carries Next's `noindex`, which is what a crawler reads, and the page for a
 * failure is drawn once the page runs in the browser. A dev server answers such a failure 500.
 */
export default function ErrorPage({ retry }: ErrorPageProps) {
  return <PageFailed onRetry={retry} />;
}
