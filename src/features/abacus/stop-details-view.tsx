"use client";

import { X } from "lucide-react";
import { motion, useIsPresent, useReducedMotion, type MotionStyle } from "motion/react";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { SPRINGS } from "@/lib/tokens/motion";
import { cn } from "@/components/ui/cn";
import { revealInView } from "@/components/ui/reveal-in-view";
import { LINK_CLASSES, TARGET_CLASSES } from "@/features/day/link-classes";
import { BestLightIcon } from "./best-light-icon";
import { mapActionOf } from "./map-action";
import { usePlaceCheck } from "./place-check";
import type { BestLight } from "./light";
import type { SheetSide } from "./sheet-placement";
import type { StopDetails } from "./stop-details";

/** A label in the sheet's margin: a column as wide as its longest word, "light". */
const LABEL_CLASSES = "w-10 shrink-0 type-note text-muted";
/** What the place is, in the model's voice: the sheet's one italic line, a size up. */
const LEAD_CLASSES = "type-prose text-body text-ink";
const FOCUS_CLASSES = "focus-ring";
/** The sheet's own ring sits inside its edge, where its unrolling clip cannot cut it. */
const SHEET_FOCUS_CLASSES = "focus-ring-inset";

/**
 * The sheet unrolls out from under the stop's name: down from its top edge, or up from its
 * bottom edge when it opens above the name. Every inset is in percent, so either side rolls
 * to and from the one unrolled value.
 */
const ROLLED_INTO: Record<SheetSide, string> = {
  below: "inset(0% 0% 100% 0%)",
  above: "inset(100% 0% 0% 0%)",
};
const UNROLLED = "inset(0% 0% 0% 0%)";

export interface DetailsPanelProps {
  id: string;
  name: string;
  details: StopDetails;
  /** The version's own sun, when the visit holds its sunrise or sunset. */
  light: BestLight | null;
  onClose: () => void;
  /** Which side of the stop's name the sheet lies on, and so which edge it unrolls from. */
  side?: SheetSide;
  className?: string;
  style?: MotionStyle;
  /**
   * Takes the focus and comes into view as it opens. A still in the lab's matrix does
   * neither, or every open cell would pull the page to itself.
   */
  isFocusTaken?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/**
 * An open stop's sheet: what the version on show is, how it sounds and how its light
 * falls, in the model's words. It unrolls from the edge the stop's name is at and never
 * moves the day. The focus lands on it, Escape closes it, and the focus goes back to the
 * stop's name.
 */
export function DetailsPanel({
  id,
  name,
  details,
  light,
  onClose,
  side = "below",
  className,
  style,
  isFocusTaken = true,
  ref,
}: DetailsPanelProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  const panel = useRef<HTMLDivElement | null>(null);
  // Reopened while it rolls up, the sheet comes back rather than mounting afresh.
  const isPresent = useIsPresent();

  // The sheet takes the focus and comes into view, so a keyboard or a phone lands on it, and
  // again when it comes back. It scrolls two frames on, once the day has made room for a
  // sheet it has room for neither below nor above its stop, and to where it stands each
  // frame, so anything growing above it on the way moves where it comes to (`revealInView`).
  useEffect(() => {
    const element = panel.current;
    if (!element || !isFocusTaken || !isPresent) return undefined;
    element.focus({ preventScroll: true });
    let stopReveal: (() => void) | null = null;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        stopReveal = revealInView(element, isReducedMotion);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      stopReveal?.();
    };
  }, [isPresent, isReducedMotion, isFocusTaken]);

  const close = () => {
    onClose();
    document.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus();
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  return (
    <motion.div
      ref={(element) => {
        panel.current = element;
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
      }}
      id={id}
      role="region"
      aria-label={`About ${name}`}
      tabIndex={-1}
      onKeyDown={closeOnEscape}
      initial={isReducedMotion ? false : { clipPath: ROLLED_INTO[side] }}
      animate={{ clipPath: UNROLLED }}
      exit={isReducedMotion ? { opacity: 0 } : { clipPath: ROLLED_INTO[side] }}
      transition={SPRINGS.snappy}
      // Brought into view with room around it, not flush with the screen's edge.
      className={cn("pointer-events-auto scroll-my-8 bg-surface", SHEET_FOCUS_CLASSES, className)}
      style={style}
    >
      <DetailsBody details={details} light={light} name={name} onClose={close} />
    </motion.div>
  );
}

interface DetailsCopyProps {
  details: StopDetails;
  light: BestLight | null;
  name: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * What a sheet would say, set unseen and out of every hand's reach, so its height is known
 * before a sheet opens with it, for each version a stop could show while open.
 */
export function DetailsCopy({ details, light, name, className, style, ref }: DetailsCopyProps) {
  return (
    <div ref={ref} aria-hidden inert className={className} style={style}>
      <DetailsBody details={details} light={light} name={name} onClose={CLOSE_NOTHING} />
    </div>
  );
}

/** A copy's × closes nothing: it can never be pressed. */
const CLOSE_NOTHING = (): void => undefined;

interface DetailsBodyProps {
  details: StopDetails;
  light: BestLight | null;
  name: string;
  onClose: () => void;
}

/**
 * When and where, then what the place is in the model's own voice, the sheet's one italic
 * line, then the rest under labels in a margin the eye runs down (`docs/decisions.md`, "The day is
 * drawn as an abacus"): why this version, for one swapped in; how it feels; how its light falls;
 * what it looks like; how to get there, on a map. Ink and muted only: the row above it says which
 * way a swap went, in its colours.
 */
function DetailsBody({ details, light, name, onClose }: DetailsBodyProps) {
  const { hours, swapReason, summary, sound, crowd, texture, sky, bestAt, lightNote, tags } =
    details;
  const lightWords = [bestAt, sky].filter(Boolean).join(" · ");
  // How full and how loud, as the row says it; the model's line on it under them, or alone
  // where the row already says the words.
  const feelWords = [crowd, sound].filter(Boolean).join(" · ");
  // Last, how to get there: the place on a map, and how far the map vouches for it.
  const map = mapActionOf(
    { name, kind: details.kind, city: details.city, point: details.point },
    usePlaceCheck(details.placeId),
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="type-time text-muted">
          {hours}
          {details.neighborhood && ` · ${details.neighborhood}`}
        </p>
        <button
          type="button"
          aria-label={`Close ${name}`}
          onClick={onClose}
          className={cn(
            "-m-1 shrink-0 rounded-sm p-1 text-muted transition-colors pointed:text-ink",
            FOCUS_CLASSES,
          )}
        >
          <X aria-hidden size={ICON_SIZES.sm} strokeWidth={ICON_STROKE_WIDTH} />
        </button>
      </div>
      {summary && <p className={LEAD_CLASSES}>{summary}</p>}
      <dl className="flex flex-col gap-2">
        {swapReason && <Fact label="why">{swapReason}</Fact>}
        {(feelWords || texture) && (
          <Fact label="feel" note={feelWords ? texture : null}>
            {feelWords || texture}
          </Fact>
        )}
        {(lightWords || lightNote) && (
          <Fact
            label="light"
            mark={
              light && (
                <BestLightIcon light={light} className="mr-1 inline-block align-middle text-lamp" />
              )
            }
            note={lightWords ? lightNote : null}
          >
            {lightWords || lightNote}
          </Fact>
        )}
        {tags.length > 0 && <Fact label="look">{tags.join(" · ")}</Fact>}
        <Fact label="map" note={map.trust}>
          <a
            href={map.href}
            target="_blank"
            rel="noreferrer"
            className={cn(LINK_CLASSES, TARGET_CLASSES)}
          >
            {map.label}
          </a>
        </Fact>
      </dl>
    </div>
  );
}

interface FactProps {
  label: string;
  mark?: ReactNode;
  /** A line about it, the model's or the map's, under the words, in the quieter ink. */
  note?: string | null;
  children: ReactNode;
}

/** One reading with its label in the margin: "feel  busy · chatter", its line under it. */
function Fact({ label, mark, note, children }: FactProps) {
  return (
    <div className="flex gap-3">
      <dt className={LABEL_CLASSES}>{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5 type-note text-ink">
        <span>
          {mark}
          {children}
        </span>
        {note && <span className="text-muted">{note}</span>}
      </dd>
    </div>
  );
}
