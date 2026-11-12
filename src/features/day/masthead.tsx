"use client";

import type { ReactNode } from "react";
import { LanternMark } from "@/components/ui/lantern-mark";
import { cn } from "@/components/ui/cn";
import { ThemeChoice } from "@/features/theme/theme-choice";

/**
 * The wordmark as a way home: no underline at rest, the ink hairline under a pointer and for the
 * keyboard, which rings it in ink too.
 */
const HOME_CLASSES =
  "rounded-sm decoration-ink decoration-1 underline-offset-4 transition-colors focus-ring pointed:underline";

/** The wordmark at the body's size, as it stands on every page. */
const WORDMARK_CLASSES = "type-voice text-body whitespace-nowrap text-ink italic";

/**
 * The theme's icon set in a line of the page's small type, at its lowercase middle: CSS's
 * `middle` stands the icon's centre at the baseline plus half the type's x-height, so it
 * reads level with the day's menu at every root size, and at the same height on a page
 * with no menu.
 */
const THEME_LINE_CLASSES = "type-note *:align-middle";

interface MastheadProps {
  /** On the start screen itself the wordmark is only the name, not a link to the same page. */
  isHome?: boolean;
  /** On a day, the day's menu, which holds the ways to take it along and "Plan another day". */
  menu?: ReactNode;
}

/**
 * The line every page opens with: the wordmark alone on the left at the body's size, its mark
 * set in ems of the word so its bead stands on the word's lowercase middle; on the right, on a
 * day, the day's menu and the theme as one group, a short rule between them, and on every other
 * page the theme alone. Every item stands on one centre line and is a 24 px target. The start
 * screen, a day and the page for no day share it, so the wordmark sits at the same place on all
 * three, and away from the start it leads there.
 */
export function Masthead({ isHome = false, menu }: MastheadProps) {
  const wordmark = (
    <>
      <LanternMark isSetInEms />
      Lantern
    </>
  );
  return (
    <div className="relative flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      {isHome ? (
        <span className={WORDMARK_CLASSES}>{wordmark}</span>
      ) : (
        // A whole page load, not a client one: a day opened from the start screen is still
        // the start's page under its own address, and nothing hands a day back to the start
        // screen (day.tsx), so a client navigation to "/" would keep the day on screen.
        // eslint-disable-next-line @next/next/no-html-link-for-pages -- see above
        <a href="/" className={cn(WORDMARK_CLASSES, HOME_CLASSES)}>
          {wordmark}
        </a>
      )}
      <span className="flex items-center gap-3 type-note whitespace-nowrap text-ink-soft">
        {menu && (
          // A menu needs the page's script, so without it the menu and its rule stand aside, as
          // the view's switch does; the line under the day keeps its walking route then.
          <span className="flex items-center gap-3 view-unset:hidden">
            {menu}
            <span aria-hidden className="h-4 w-px bg-line" />
          </span>
        )}
        <span className={THEME_LINE_CLASSES}>
          <ThemeChoice />
        </span>
      </span>
    </div>
  );
}
