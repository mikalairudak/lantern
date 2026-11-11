import type { Metadata } from "next";
import { BrowserTextSize } from "@/components/ui/browser-text-size";
import { PageViews } from "@/features/analytics/page-views";
import { FirstImpressionProvider } from "@/features/day/first-impression";
import { DayViewScript } from "@/features/day/view-switch";
import { ThemeScript } from "@/features/theme/theme-script";
import { isCountingPageViews } from "@/lib/analytics/page-views";
import { isFirstImpression } from "@/lib/first-impression";
import { SITE_AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_OPEN_GRAPH, SITE_URL } from "@/lib/site";
import { BODY_CLASSES, firaSans } from "./root-document";
import "./globals.css";

/**
 * What every page says unless it says otherwise. Addresses in a page's metadata are made
 * whole on the production host, so a canonical link or a preview's address never names a
 * deployment's own. A page meant to be found sets its own canonical and preview
 * (`listedPageMetadata`); one that does not still names the site in a preview.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  authors: [{ name: SITE_AUTHOR }],
  openGraph: SITE_OPEN_GRAPH,
  // X shows no card without a type; its large card reads the Open Graph tags and image.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script below may set data-theme before React hydrates, so <html> may differ.
    <html lang="en" className={firaSans.variable} suppressHydrationWarning>
      <head>
        {/* A stored theme is on <html> before the first paint, so no frame shows another. */}
        <ThemeScript />
        <DayViewScript />
      </head>
      <body className={BODY_CLASSES}>
        <BrowserTextSize />
        <FirstImpressionProvider isOn={isFirstImpression(process.env)}>
          {children}
        </FirstImpressionProvider>
        {isCountingPageViews(process.env) && <PageViews />}
      </body>
    </html>
  );
}
