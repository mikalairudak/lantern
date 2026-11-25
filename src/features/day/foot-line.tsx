import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";

/** Where some of what a page shows comes from, credited by name with a link to its terms. */
export interface Source {
  name: string;
  href: string;
}

/**
 * The sources a day draws on. Its places' coordinates come from OpenStreetMap, whose
 * licence (ODbL) asks for this credit wherever the data is used, and a live day's places are
 * checked through Geoapify's search, whose free plan asks for its own (2026-10-28).
 */
export const SOURCES: readonly Source[] = [
  { name: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
  { name: "Powered by Geoapify", href: "https://www.geoapify.com/" },
];

/** Where a visitor writes to Lantern: to have their text deleted, or with any question. */
export const CONTACT_EMAIL = "support@lanternday.com";

/** The page saying what Lantern keeps and why, with its short terms. */
export const PRIVACY_PATH = "/privacy";

/** Each link whole on its line, its press reaching past its words. */
const SMALL_LINK_CLASSES = cn(LINK_CLASSES, TARGET_CLASSES, "whitespace-nowrap");

/**
 * The smallest type, muted: a credit or a way out, never whose product the day is. Muted on
 * the ground is 6.7:1 by day and 6.0:1 by night, so it reads at that size.
 */
const QUIET_TYPE_CLASSES = "type-voice text-caption";
const QUIET_LINE_CLASSES = cn(QUIET_TYPE_CLASSES, "text-muted");

/**
 * The foot apart from the page above it, by a hairline across the page's column. It is a
 * container, so its line is laid out by its own width, as in a phone cell of the lab.
 */
const FOOT_CLASSES = cn(QUIET_LINE_CLASSES, "@container border-t border-line pt-4");

/**
 * On a phone Lantern's links, then the sources under them as the page's last line; once the
 * foot is a text column wide (`measure`, 544 px, where both fit with room) one line, the
 * sources on the left and Lantern's links on the right. Lantern's links come first in the
 * page's order, so a phone reads and tabs them top to bottom, and stand on the right as the
 * row is laid from its end.
 */
const FOOT_LINE_CLASSES =
  "flex flex-col gap-2 @measure:flex-row-reverse @measure:justify-between @measure:gap-6";

interface FootLineProps {
  /**
   * The sources the page's places come from, credited on the foot's left; none where the page
   * shows no place, as the start screen, a page with no day and a day that ended without one.
   */
  sources?: readonly Source[];
  /** Where the foot sits on its page: the room above it and under it. */
  className?: string;
}

/**
 * The page's foot, its contentinfo: Lantern's own links, what it keeps and the address to
 * write to, and on a day the sources its places come from, seen without a press, as
 * OpenStreetMap's licence and Geoapify's free plan ask, as quiet as a line can be and still
 * be read. The page holds it at the foot of the screen when what it shows is shorter, so a
 * short page never ends with an empty sheet under it (`docs/decisions.md`, "Places are checked
 * through Geoapify, not Google Places").
 */
export function FootLine({ sources = [], className }: FootLineProps) {
  return (
    <footer className={cn(FOOT_CLASSES, className)}>
      <div className={FOOT_LINE_CLASSES}>
        <p>
          <Joined
            links={[
              <Link key="privacy" href={PRIVACY_PATH} className={SMALL_LINK_CLASSES}>
                Privacy and terms
              </Link>,
              <a key="contact" href={`mailto:${CONTACT_EMAIL}`} className={SMALL_LINK_CLASSES}>
                {CONTACT_EMAIL}
              </a>,
            ]}
          />
        </p>
        {sources.length > 0 && (
          <p>
            <Joined
              links={sources.map((source) => (
                <a key={source.href} href={source.href} className={SMALL_LINK_CLASSES}>
                  {source.name}
                </a>
              ))}
            />
          </p>
        )}
      </div>
    </footer>
  );
}

/** The press that ends a written day's play, showing the day whole in its place. */
export const SHOW_WHOLE_DAY = "Show the whole day";

/**
 * The words and the press, one under the other on a phone, where the longest words and the
 * press (268 and 106 px) are wider than the column (358 px) together: the press then stands on
 * a line of its own from the first stop to the end, so the count never moves it and the line
 * never grows a line as the versions begin. Once the line is a text column wide (`measure`,
 * 544 px) they share one line, the press at its end, where a longer count never reaches it.
 */
const PLAY_LINE_CLASSES = "flex flex-col gap-1 @measure:flex-row @measure:gap-6";
const PRESS_CLASSES = cn(LINK_CLASSES, TARGET_CLASSES, "whitespace-nowrap");

interface ProgressLineProps {
  /**
   * How far the day is written (`progressWordsOf`): "Writing the day · 6 stops so far", then
   * the versions stop by stop. None before the first stop, where only the press stands.
   */
  children?: ReactNode;
  /**
   * Shows the day whole at once in place of its play: given only while a written day the page
   * holds whole plays (`docs/decisions.md`, "A written day's play offers the day whole on a
   * press"). Left out, the line is its words alone.
   */
  onShowWhole?: () => void;
  className?: string;
}

/**
 * How far the day is written, under its chart, where the eye is as it ends: a line of its
 * own, in the stronger of the two quiet inks. While a written day plays it ends with a press
 * that shows the day whole. Once the day is whole the day's end takes its place (`DayEnd`).
 */
export function ProgressLine({ children, onShowWhole, className }: ProgressLineProps) {
  const lineClasses = cn(QUIET_TYPE_CLASSES, "text-ink-soft", className);
  if (onShowWhole === undefined) return <p className={lineClasses}>{children}</p>;
  return (
    <div className={cn(lineClasses, "@container")}>
      <div className={PLAY_LINE_CLASSES}>
        {children ? (
          <p>{children}</p>
        ) : (
          // Before the first stop the words' line is held on a phone, unseen and unheard, so the
          // press stands from its first frame where it stays, and the count, as it comes, takes
          // a line already there rather than pushing the press down.
          <p aria-hidden className="invisible @measure:hidden">
            {SHOW_WHOLE_DAY}
          </p>
        )}
        {/* Room under the press for its underline, which falls 4 px under the words, past the
            line's box: a box that clips at its edge, as a lab cell does, keeps it whole. */}
        <p className="pb-1 @measure:ml-auto">
          <button type="button" onClick={onShowWhole} className={PRESS_CLASSES}>
            {SHOW_WHOLE_DAY}
          </button>
        </p>
      </div>
    </div>
  );
}

/**
 * Links joined by a middle dot that screen readers do not hear, standing wide enough apart
 * that each link's press, which reaches past its words, stays its own. A line too long for its
 * column breaks after a dot, so the next link starts the next line whole: at 320 px the sources
 * in Literata are wider than the foot's column.
 */
function Joined({ links }: { links: readonly ReactNode[] }) {
  return links.map((link, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <>
          <span aria-hidden className="mx-2">
            ·
          </span>
          <wbr />
        </>
      )}
      {link}
    </Fragment>
  ));
}
