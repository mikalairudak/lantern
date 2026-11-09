"use client";

import { pageTitleOf } from "@/features/day/day-title";
import { PAGE_FAILED_TITLE, PageFailed } from "@/features/day/page-failed";
import { ThemeScript } from "@/features/theme/theme-script";
import { BODY_CLASSES, firaSans } from "./root-document";
import "./globals.css";

interface GlobalErrorProps {
  /** What failed. Never shown: what a visitor sees of a failure is Lantern's own words. */
  error: unknown;
  /** Draws the page again, its root layout too. */
  retry: () => void;
}

/**
 * A failure in the root layout itself, which `error.tsx` sits inside: Lantern's page for a
 * failure, in a document of its own that carries what the layout's does, its stylesheet, its
 * sans and the visitor's theme. It has no metadata, so it names itself in the tab.
 */
export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    // The script below may set data-theme before React hydrates, so <html> may differ.
    <html lang="en" className={firaSans.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <title>{pageTitleOf(PAGE_FAILED_TITLE)}</title>
      </head>
      <body className={BODY_CLASSES}>
        <PageFailed onRetry={retry} />
      </body>
    </html>
  );
}
