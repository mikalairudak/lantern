"use client";

import type { ReactNode } from "react";
import { LanternMark } from "@/components/ui/lantern-mark";
import { cn } from "@/components/ui/cn";
import { ThemeChoice } from "@/features/theme/theme-choice";

/** The wordmark as a way home: no underline, and the ink ring every link takes for the keyboard. */
const HOME_CLASSES = "rounded-sm focus-ring";

/**
 * The theme's icon set in a line of the page's small type, at its lowercase middle: CSS's
 * `middle` stands the icon's centre at the baseline plus half the type's x-height, so it
 * reads level with "Plan another day" at every root size, and at the same height on a page
 * with no action.
 */
const THEME_LINE_CLASSES = "type-note *:align-middle";

interface MastheadProps {
  /** The page's one action in words, set before the theme's icon, such as "Plan another day". */
  action?: ReactNode;
  /** On the start screen itself the wordmark is only the name, not a link to the same page. */
  isHome?: boolean;
  /**
   * The day's menu, which takes the action's place and holds "Plan another day" itself.
   */
  menu?: ReactNode;
}

/**
 * The line every page opens with: the wordmark, and at the other end the page's one action,
 * underlined as Lantern's actions are, and the theme as an icon, so the two never read as
 * the same kind of button. The start screen, a day and the page for no day share it, so the
 * wordmark sits at the same place on all three, and away from the start it leads there.
 */
export function Masthead({ action, isHome = false, menu }: MastheadProps) {
  return <GroupedMasthead action={menu ?? action} isHome={isHome} isMenu={menu !== undefined} />;
}

/**
 * The masthead's two ends: the wordmark alone on the left at the body's size, its mark
 * set in ems of the word so its bead stands on the word's lowercase middle; on the right the
 * page's action, or the day's menu, and the theme as one group, a short rule between them. Every
 * item stands on one centre line and is a 24 px target.
 */
function GroupedMasthead({
  action,
  isHome,
  isMenu,
}: {
  action?: ReactNode;
  isHome: boolean;
  isMenu: boolean;
}) {
  const wordmark = (
    <>
      <LanternMark isSetInEms />
      Lantern
    </>
  );
  const wordmarkClasses = "type-voice text-body whitespace-nowrap text-ink italic";
  return (
    <div className="relative flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      {isHome ? (
        <span className={wordmarkClasses}>{wordmark}</span>
      ) : (
        // A whole page load, as the masthead above explains.
        // eslint-disable-next-line @next/next/no-html-link-for-pages -- see above
        <a href="/" className={cn(wordmarkClasses, HOME_CLASSES)}>
          {wordmark}
        </a>
      )}
      <span className="flex items-center gap-3 type-note whitespace-nowrap text-ink-soft">
        {action && (
          // A menu needs the page's script, so without it the menu and its rule stand aside, as
          // the view's switch does; the line under the day keeps its walking route then.
          <span className={cn("flex items-center gap-3", isMenu && "view-unset:hidden")}>
            {action}
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
