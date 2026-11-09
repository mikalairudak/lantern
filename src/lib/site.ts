import type { Metadata } from "next";

/**
 * Lantern's one public address. The apex answers 308 to it, so canonical links, link previews,
 * the sitemap and robots.txt all name it, and a copy served at another host (a deployment's
 * own `vercel.app` address) points search engines back here.
 */
export const SITE_URL = "https://www.lanternday.com";

/** The product's name: the start screen's title, the end of every other page's. */
export const SITE_NAME = "Lantern";

/**
 * What Lantern is, in one line: the start screen's first words, and the line a search result
 * and a link preview give it.
 */
export const SITE_DESCRIPTION =
  "One day in a city, planned hour by hour, as quiet or as lively as you want it.";

/**
 * Who made Lantern, in every page's author tag, unseen on the page: a link preview's crawler
 * reads it, as LinkedIn's does, and the privacy page names the same person as who runs it.
 */
export const SITE_AUTHOR = "Mikalai Rudak";

/** What a link preview says of the site on every page, beside what the page says of itself. */
export const SITE_OPEN_GRAPH = { siteName: SITE_NAME, type: "website" } as const;

/**
 * The one image every link to Lantern shows, drawn at build time by `src/app/opengraph-image.tsx`
 * at this address. Next adds it by itself only where no page below the root sets a preview of
 * its own, so `openGraphOf` names it on every page that does.
 */
export const SITE_CARD = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `Lantern's mark, a lit bead on a sagging wire, over the name ${SITE_NAME} and the line "${SITE_DESCRIPTION}"`,
} as const;

/** What a page says of itself in a search result and a link preview. */
export interface PageSummary {
  title: string;
  /** Left out while a page has no line of its own yet, as a day still being written. */
  description?: string;
}

/**
 * The card a link to a page unfurls into in LinkedIn, Slack, iMessage and the like: the site's
 * image, the page's own title and line under the site's name, and its address when it has
 * one to be found at.
 */
export function openGraphOf(
  { title, description }: PageSummary,
  address?: string,
): NonNullable<Metadata["openGraph"]> {
  return {
    ...SITE_OPEN_GRAPH,
    images: [SITE_CARD],
    title,
    ...(description !== undefined && { description }),
    ...(address !== undefined && { url: address }),
  };
}

/**
 * A page meant to be found and shared: its address is canonical, so the same page reached
 * with a query string or at another host counts as this one, and its preview says what it is.
 * The address is relative; the root layout's `metadataBase` makes it whole.
 */
export function listedPageMetadata(address: string, summary: PageSummary): Metadata {
  return { alternates: { canonical: address }, openGraph: openGraphOf(summary, address) };
}

/** An address on Lantern as a whole URL, as a sitemap and robots.txt must give it. */
export function siteUrlOf(address: string): string {
  return new URL(address, SITE_URL).href;
}
