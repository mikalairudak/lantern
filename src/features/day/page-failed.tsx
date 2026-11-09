"use client";

import { useEffect } from "react";
import { cn } from "@/components/ui/cn";
import { AddressPage } from "./address-page";
import { pageTitleOf } from "./day-title";
import { START_ADDRESS } from "@/lib/days/address";
import { LINK_CLASSES } from "./link-classes";

/** The headline of a page that failed as Lantern drew it. */
export const PAGE_FAILED = "Lantern couldn't open this page.";

/** The title of a page that failed, before the site's own. */
export const PAGE_FAILED_TITLE = "A page Lantern couldn't open";

/** Asks for the page again, as a day's notice asks for its day again ("Write it again"). */
export const OPEN_IT_AGAIN = "Open it again";

/** The way back to the start screen, as the page for no day words it. */
export const PLAN_YOUR_OWN = "Plan your own day";

interface PageFailedProps {
  /** Draws the page again in place, asking its server again for what it needs. */
  onRetry: () => void;
}

/**
 * A page that failed as Lantern drew it, on its server or in the browser: said plainly, with
 * nothing of what failed, and the ways on, the page again or the start screen. Set as the page
 * for no day is, so the wordmark, the headline and the last line stand where they stand there.
 */
export function PageFailed({ onRetry }: PageFailedProps) {
  // The tab says so too. When the page comes back in place, nothing else names the tab, so it
  // says what it said before. When the visitor goes on by a link, the next page has named it by
  // the time this one is gone, so its name is left alone.
  useEffect(() => {
    const before = document.title;
    const own = pageTitleOf(PAGE_FAILED_TITLE);
    document.title = own;
    return () => {
      if (document.title === own) document.title = before;
    };
  }, []);
  return (
    <AddressPage headline={PAGE_FAILED}>
      <p className="flex flex-wrap gap-x-5 gap-y-1 type-voice text-body text-ink-soft">
        {/* An action named by a verb is set in ink, as in a day's notice. */}
        <button type="button" onClick={onRetry} className={cn(LINK_CLASSES, "text-ink")}>
          {OPEN_IT_AGAIN}
        </button>
        {/* A whole page load, as the wordmark's: a client one would keep whatever failed, and
            from the start screen's own address it would not leave the failure at all. */}
        <a href={START_ADDRESS} className={LINK_CLASSES}>
          {PLAN_YOUR_OWN}
        </a>
      </p>
    </AddressPage>
  );
}
