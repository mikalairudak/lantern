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

interface ProgressLineProps {
  /**
   * How far the day is written (`progressWordsOf`): "Writing the day · 6 stops so far", then
   * the versions stop by stop.
   */
  children: ReactNode;
  className?: string;
}

/**
 * How far the day is written, under its chart, where the eye is as it ends: a line of its
 * own, in the stronger of the two quiet inks. Once the day is whole the day's end takes its
 * place (`DayEnd`).
 */
export function ProgressLine({ children, className }: ProgressLineProps) {
  return <p className={cn(QUIET_TYPE_CLASSES, "text-ink-soft", className)}>{children}</p>;
}

/**
 * Links joined by a middle dot that screen readers do not hear, standing wide enough apart
 * that each link's press, which reaches past its words, stays its own.
 */
function Joined({ links }: { links: readonly ReactNode[] }) {
  return links.map((link, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <span aria-hidden className="mx-2">
          ·
        </span>
      )}
      {link}
    </Fragment>
  ));
}
