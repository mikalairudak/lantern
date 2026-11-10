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
}

/**
 * The line every page opens with: the wordmark, and at the other end the page's one action,
 * underlined as Lantern's actions are, and the theme as an icon, so the two never read as
 * the same kind of button. The start screen, a day and the page for no day share it, so the
 * wordmark sits at the same place on all three, and away from the start it leads there.
 */
export function Masthead({ action, isHome = false }: MastheadProps) {
  const wordmark = (
    <>
      <LanternMark />
      Lantern
    </>
  );
  return (
    // Each end stays whole: where both do not fit on one line, as on a 320 px phone with the
    // browser's text at 125 %, the page's action and the theme's icon go to the next line
    // together, rather than the wordmark breaking.
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      {isHome ? (
        <span className="type-voice text-heading whitespace-nowrap italic">{wordmark}</span>
      ) : (
        // A whole page load, not a client one: a day opened from the start screen is still
        // the start's page under its own address, and nothing hands a day back to the start
        // screen (day.tsx), so a client navigation to "/" would keep the day on screen.
        // eslint-disable-next-line @next/next/no-html-link-for-pages -- see above
        <a
          href="/"
          className={cn("type-voice text-heading whitespace-nowrap italic", HOME_CLASSES)}
        >
          {wordmark}
        </a>
      )}
      {/* The action and the icon's line stand on the wordmark's baseline, so the icon sits at
          the same place on every page, with an action before it or none. */}
      <span className="flex items-baseline gap-3 whitespace-nowrap">
        {action}
        <span className={THEME_LINE_CLASSES}>
          <ThemeChoice />
        </span>
      </span>
    </div>
  );
}
