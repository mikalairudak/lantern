"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/react";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { pageViewToSend, routeOf } from "@/lib/analytics/page-views";
import { isUncountedBrowser } from "@/lib/analytics/uncounted-browser";

/**
 * Reads the owner's mark at each page view, so a browser marked or counted again changes from
 * its next one. One function for the page's life: Vercel's component hands it over again
 * whenever it changes.
 */
const beforeSend: BeforeSend = (event) => pageViewToSend(event, isUncountedBrowser());

/**
 * One page view for each address the visitor reaches. The route is Lantern's own
 * (`routeOf`), since the script sends it as handed; the address goes through `beforeSend`.
 */
function CountedPageViews() {
  const pathname = usePathname();
  return (
    <Analytics
      beforeSend={beforeSend}
      framework="next"
      route={routeOf(pathname)}
      path={pathname}
      basePath={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH}
      configString={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG}
    />
  );
}

/**
 * Vercel Web Analytics' page views, each kept day's id left out, and none from the owner's
 * browsers (`pageViewToSend`). A client component, since the root layout cannot hand a
 * function to one. The layout renders it only where page views are counted
 * (`isCountingPageViews`). It reads the address, which a page not built ahead knows only at
 * the request, so it waits inside its own boundary and holds up nothing else.
 */
export function PageViews() {
  return (
    <Suspense fallback={null}>
      <CountedPageViews />
    </Suspense>
  );
}
