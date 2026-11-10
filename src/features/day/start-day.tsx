"use client";

import { Day, type WrittenGist } from "./day";
import { readIntakeRoute } from "./intake-route";
import { useHomeViewed, type HomeViewMemory } from "./use-day-events";
import { readWrittenOnly } from "./written-reader";

interface StartDayProps {
  /** The days Lantern has written, read on the server into what the start screen needs. */
  pool: readonly WrittenGist[];
  /** Live generation is on, read on the server when the page was asked for. */
  isLive: boolean;
  /** The product's events are sent: only the product's own page counts. */
  isCounted?: boolean;
  /**
   * What the page remembers of having told the start screen opened; left out, the page load's
   * (`PAGE_HOME_VIEW_MEMORY`), so it is told once however often the page is drawn.
   */
  homeViewMemory?: HomeViewMemory;
}

/**
 * The start screen as the product lands on it: one question, and the cities Lantern has written as
 * words, with no day until the visitor asks for one. With live generation off the visitor's text is
 * read by the intake's stand-in, which plays only the days already written and says nothing else
 * back; with live generation on it goes to the intake route, and Lantern says it writes new days.
 * The address names the day once one takes the page, so a copied link opens it.
 */
export function StartDay({ pool, isLive, isCounted = false, homeViewMemory }: StartDayProps) {
  useHomeViewed(isCounted, homeViewMemory);
  if (pool.length === 0) throw new Error("The start screen has no written day to offer");
  const read = isLive ? readIntakeRoute : readWrittenOnly(pool);
  return <Day start={{ pool, read }} isLive={isLive} isAddressed isCounted={isCounted} />;
}
