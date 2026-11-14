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
 * The theme's button set in a line of the page's small type, at its lowercase middle: CSS's
 * `middle` stands the icon's centre at the baseline plus half the type's x-height, so it
 * reads level with the day's menu at every root size, and at the same height on a page
 * with no menu. Under forced colours the theme is not offered, since the device's colours stand
 * whatever is chosen there; it keeps its room, so the masthead does not move as they turn on or
 * off, and its helper goes with it (`docs/decisions.md`, "Under forced colours the system's theme
 * stands").
 */
const THEME_LINE_CLASSES = "-ml-2 type-note *:align-middle forced-colors:invisible";

/**
 * The group on the right: one interval between what is drawn, 24 px, and 32 px from a row of
 * `@measure`. The theme's box holds 8 px of its own beside its icon, so the theme's line takes
 * them back (`-ml-2`). It stands as tall as the row, so the day's menu can hang from a box of
 * the row's height.
 */
const GROUP_CLASSES =
  "flex items-center gap-6 self-stretch type-note whitespace-nowrap text-ink-soft @measure:gap-8";

interface MastheadProps {
  /** On the start screen itself the wordmark is only the name, not a link to the same page. */
  isHome?: boolean;
  /** On a day, the day's menu, which holds the ways to take it along. */
  menu?: ReactNode;
  /** On a day, the new day's button, after the menu. */
  newDay?: ReactNode;
  /** The theme's button drawn in a look of its own, as a lab cell draws it; the page's by default. */
  theme?: ReactNode;
}

/**
 * The line every page opens with: the wordmark alone on the left at the body's size, its mark
 * set in ems of the word so its bead stands on the word's lowercase middle; on the right, on a
 * day, three kinds of thing parted by space alone: this day's menu, a new day, and the theme
 * (`docs/decisions.md`, "The day's ways along live in one menu, in the masthead"). Every other
 * page has the theme alone. Every item stands on one centre line and is a 24 px target. The
 * start screen, a day and the page for no day share it, so the wordmark sits at the same place
 * on all three, and away from the start it leads there.
 */
export function Masthead({ isHome = false, menu, newDay, theme }: MastheadProps) {
  const wordmark = (
    <>
      <LanternMark isSetInEms />
      Lantern
    </>
  );
  return (
    // Positioned, so the day menu hangs from the foot of this row, and a container, so what
    // stands in it reads the row's width: the new day stands in it from `@masthead`.
    <div className="@container relative flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
      <span className={GROUP_CLASSES}>
        {menu && (
          // A menu needs the page's script, so without it the menu stands aside, as the view's
          // switch does; the line under the day keeps its walking route then.
          <span className="flex items-center self-stretch view-unset:hidden">{menu}</span>
        )}
        {newDay}
        <span className={THEME_LINE_CLASSES}>{theme ?? <ThemeChoice />}</span>
      </span>
    </div>
  );
}
