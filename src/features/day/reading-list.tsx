"use client";

import { AnimatePresence, animate, useReducedMotion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type Ref,
  type RefObject,
} from "react";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";
import { createGlideGroup, GlidingHeight, type GlideGroup } from "@/components/ui/gliding-height";
import { BestLightIcon } from "@/features/abacus/best-light-icon";
import { candidatesOf, versionOf, type CurveStop } from "@/features/abacus/curve";
import type { PlaceDraft, StopDraft } from "@/features/abacus/day-draft";
import { PennedText } from "@/components/ui/penned-text";
import type { ForkRows } from "@/features/abacus/day-rows";
import { useDrawing } from "@/features/abacus/drawing";
import { FORK_CONTROL_ATTRIBUTE, FORK_ROW_ATTRIBUTE, ForkRow } from "@/features/abacus/fork-row";
import { bestLightOf } from "@/features/abacus/light";
import { kindWordOf } from "@/features/abacus/meal";
import { isQuarterNamed } from "@/features/abacus/quarter";
import type { DayContext } from "@/lib/geo/sun";
import { formatClock, runningSpans } from "@/lib/time/clock";
import { ROW_REACH_PX, SPRINGS } from "@/lib/tokens/motion";
import { useFirstImpression } from "./first-impression";
import { VersionCarousel } from "./version-carousel";
import { isGoldenAt, LightRail, sunLinesOf, sunsOf, SunLine } from "./light-rail";
import { TARGET_CLASSES } from "./link-classes";

/**
 * The day to read rather than to drag: a timetable of the stops the chart draws, their time in a
 * gutter, each stop's name, what it is and where, until when, its one line and the versions it
 * could be swapped for (`docs/decisions.md`, "A day can be read as a list, written as the chart
 * is"). Built from the chart's own stops and picks, so a version swapped here is the one the chart
 * shows.
 *
 * It is written as the chart is, and shows nothing the stream may still change: a stop is
 * let in once all its row says is final, and its versions once the stream has written them
 * all, a second pass, as the chart's beads come after its rows. The last row opens its room
 * on the layout spring, with nothing on the list below it to move; a row let in among
 * others, a versions' line or a swap moves the rows below at most `ROW_REACH_PX` in the
 * spring's time, about 2.4 px a frame. Rows a new energy changes together glide as one and
 * settle in about 1.5 s, the rows on screen under 3 px a frame (`gestureGlideOver`). The
 * pen writes each row's words in, as the chart's pen writes a row's, and its versions' line
 * as it comes. Under reduced motion each stands whole at once, and a row waits for its
 * versions (`DayStage`).
 */

interface ReadingListProps {
  /** The stops the chart shows, as far as the stream has written them. */
  stops: readonly StopDraft[];
  /** How many of them are let in: the first stops whose rows say nothing the stream may change. */
  entered: number;
  /** The stops whose versions the stream has written whole, which their rows say. */
  versionsShown: ReadonlySet<string>;
  /** Which of each stop's versions shows, by its place among them, as the chart's list. */
  picks: readonly number[];
  /** The day's sun, to mark a stop visited in its best light. */
  daylight: DayContext;
  /**
   * A proposal's stops beside the day, by id, as on the chart: in the versions' blue, "proposed"
   * under their time, with nothing to swap until the proposal is taken.
   */
  proposed?: ReadonlySet<string>;
  /** A changed word's fork, each part's row over its first stop, as on the chart. */
  fork?: ForkRows | null;
  /**
   * A version the fork folds away, by id, as on the chart: its rows fold out of the list at the
   * tap, the fork row moving to the first stop of the version that stays.
   */
  fading?: ReadonlySet<string>;
  /**
   * One row's pen held at a letter, as the lab's still frame of a row being written; the pen
   * runs on its own otherwise.
   */
  heldPen?: { id: string; written: number };
  /** The list says all the day will: busy until then, as the chart's `aria-busy`. */
  isWritten?: boolean;
  /** Classes for each row, as for a day drawn whole that a visitor has not seen yet. */
  rowClassName?: string;
  /** Swaps a stop to one of its versions; left out, the versions are only said. */
  onChoose?: (stopIndex: number, candidateIndex: number) => void;
  /**
   * Told as its rows set off, a row let in or a versions' line opening, and once every one has
   * come to rest, so what stands under the list can wait for them, as the day's end does.
   */
  onGlide?: (isGliding: boolean) => void;
}

/** The list's name, which a screen reader hears and the page finds it by. */
export const READING_LIST_LABEL = "The day, to read";

const NO_STOPS: ReadonlySet<string> = new Set();
/** Marks each row by its stop's id, so a fork row's new place is found by its stop. */
const STOP_ATTRIBUTE = "data-stop";
/** "proposed" under a proposal's stop's time, a step up from the gutter's quiet ink. */
const MARK_CLASSES = "type-note text-ink-soft";
/** The gutter's width, where a fork row's "1 of 2" stands, and the gap after it: `w-12` and `gap-4`. */
const GUTTER_PX = 48;
const GUTTER_GAP_PX = 16;

const ROW_CLASSES = "flex gap-4 border-t border-line py-4 group-first:border-t-0";
/**
 * The plan's row under the first impression: no rule between rows, the rail between the time
 * and the words doing that work, and the words' own room under them, so the rail runs on.
 */
const RAIL_ROW_CLASSES = "flex gap-3";
/** On the plan the words start after the gutter, the rail and two gaps: `w-12`, `w-2`, `gap-3`. */
const RAIL_WORDS_LEFT_PX = 48 + 8 + 12 * 2;
const GUTTER_CLASSES = "w-12 shrink-0 pt-0.5 type-time tabular-nums";
const NAME_CLASSES = "self-start rounded-sm type-name focus-ring";
/** A version to swap in: the swap's colour, its underline dotted, a target 24 px tall. */
const VERSION_CLASSES = cn(
  TARGET_CLASSES,
  "rounded-sm text-swap underline decoration-dotted decoration-1 underline-offset-4 hover:decoration-solid focus-ring",
);

/** The day as a list to read. */
export function ReadingList({
  stops,
  entered,
  versionsShown,
  picks,
  daylight,
  proposed = NO_STOPS,
  fork = null,
  fading = NO_STOPS,
  heldPen,
  isWritten = true,
  rowClassName,
  onChoose,
  onGlide,
}: ReadingListProps) {
  // Each stop let in with its place among the chart's stops, which its picks are counted by; a
  // version the fork folds away leaves the list at once.
  const shown = stops
    .slice(0, entered)
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => !fading.has(stop.id));
  const spans = runningSpans(shown.map(({ stop }) => stop));
  // Rows on the list when it is first drawn, as a day come back to whole, stand whole; the
  // rows let in after are written in.
  const [firstIds] = useState(() => new Set(shown.map(({ stop }) => stop.id)));
  // A version swapped in takes its button away: the focus goes to its stop's name.
  const names = useRef(new Map<string, HTMLHeadingElement>());
  // Rows a new energy changes together glide as one, in about 1.5 s.
  const [glideGroup] = useState(createGlideGroup);
  const glideOf = useGlidesTold(onGlide);
  const drawing = useDrawing();
  const isRail = useFirstImpression();
  const sunLines = isRail ? sunLinesOf(sunsOf(daylight), spans, isWritten) : [];
  // The first stop on the plan with a version to swipe to leans once, when the day is whole.
  const firstSwappable = shown.findIndex(
    ({ stop }) =>
      versionsShown.has(stop.id) && !proposed.has(stop.id) && stop.alternatives.length > 0,
  );
  const list = useRef<HTMLOListElement>(null);
  const noteFocus = useForkFocusKept(list, fork?.anchors ?? NO_ANCHORS);
  return (
    <ol
      ref={list}
      aria-label={READING_LIST_LABEL}
      aria-busy={!isWritten}
      className="flex flex-col"
      onFocus={noteFocus}
    >
      <AnimatePresence initial={false}>
        {shown.map(({ stop, index }, at) => (
          <li
            key={stop.id}
            {...{ [STOP_ATTRIBUTE]: stop.id }}
            className={cn("group", rowClassName)}
          >
            {/* The last row opens on the layout spring, with nothing on the list below it to
                move; one with rows below, as a proposal's stop coming in or a version
                folding away, no faster than the rows below can glide. The fork row over its
                stop is in its fold, so a row leaving or coming back takes it with it. */}
            <Fold
              reachPx={at === shown.length - 1 ? undefined : ROW_REACH_PX}
              onGlide={glideOf(`${stop.id} fold`)}
            >
              {/* A fork row folds in over the stop it now stands over and out of the one it
                  left, and glides to its own height as its line comes and goes, as the rows do. */}
              <AnimatePresence initial={false}>
                {fork && fork.anchors.includes(stop.id) && (
                  <Fold reachPx={ROW_REACH_PX} onGlide={glideOf(`${stop.id} fork fold`)}>
                    <GlidingHeight
                      reachPx={ROW_REACH_PX}
                      shouldAlwaysReach
                      glideGroup={glideGroup}
                      onGlide={glideOf(`${stop.id} fork`)}
                    >
                      <div className="border-t border-line pt-3 group-first:border-t-0">
                        <ForkRow
                          view={fork.view}
                          index={fork.anchors.indexOf(stop.id)}
                          count={fork.anchors.length}
                          timeWidth={GUTTER_PX}
                          wordsLeft={isRail ? RAIL_WORDS_LEFT_PX : GUTTER_PX + GUTTER_GAP_PX}
                          drawing={drawing}
                          lineAt="under"
                          onChoose={fork.onChoose}
                          onCompare={fork.onCompare}
                          onAskAgain={fork.onAskAgain}
                        />
                      </div>
                    </GlidingHeight>
                  </Fold>
                )}
              </AnimatePresence>
              {isRail &&
                (sunLines[at]?.lead ?? []).map(({ sun, to }) => (
                  <SunLine key={sun.word} daylight={daylight} sun={sun} to={to} />
                ))}
              <ReadingRow
                railTo={isRail ? (sunLines[at]?.railTo ?? 0) : null}
                onPick={onChoose && ((candidate) => onChoose(index, candidate))}
                isNudged={isWritten && at === firstSwappable}
                stop={stop}
                span={spans[at] ?? { from: 0, to: 0 }}
                pick={picks[index] ?? 0}
                daylight={daylight}
                isPenned={!firstIds.has(stop.id)}
                heldWritten={heldPen?.id === stop.id ? heldPen.written : undefined}
                glideGroup={glideGroup}
                isProposed={proposed.has(stop.id)}
                isVersionsShown={versionsShown.has(stop.id)}
                onGlide={glideOf(`${stop.id} row`)}
                nameRef={(name) => {
                  if (name) names.current.set(stop.id, name);
                  else names.current.delete(stop.id);
                }}
                onChoose={
                  onChoose &&
                  ((candidate) => {
                    onChoose(index, candidate);
                    names.current.get(stop.id)?.focus();
                  })
                }
              />
              {isRail &&
                (sunLines[at]?.trail ?? []).map(({ sun, to }) => (
                  <SunLine key={sun.word} daylight={daylight} sun={sun} to={to} />
                ))}
            </Fold>
          </li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/** No fork rows: one array for every list without a fork. */
const NO_ANCHORS: readonly (string | null)[] = [];

/** Which of a fork row's controls had the focus: by its part, and how to find it again. */
interface ForkFocus {
  part: number;
  selector: string;
}

/** The fork row control `target` is, if it is one: an answer by its side, or an action. */
function forkFocusOf(target: EventTarget | null): ForkFocus | null {
  if (!(target instanceof HTMLElement)) return null;
  const row = target.closest(`[${FORK_ROW_ATTRIBUTE}]`);
  const control = target.closest(`[${FORK_CONTROL_ATTRIBUTE}]`);
  if (!row || !control) return null;
  const name = control.getAttribute(FORK_CONTROL_ATTRIBUTE) ?? "";
  return {
    part: Number(row.getAttribute(FORK_ROW_ATTRIBUTE)),
    selector: `[${FORK_CONTROL_ATTRIBUTE}="${name}"]`,
  };
}

/**
 * Keeps the keys' focus on a fork row that moves to another stop, as taking or comparing moves
 * it: the row is drawn anew over its new stop, and the one that had the focus folds away. The
 * focus goes to the same control in the row's new place, or to its chosen answer. Gives the
 * handler that notes which control has the focus.
 */
function useForkFocusKept(
  list: RefObject<HTMLOListElement | null>,
  anchors: readonly (string | null)[],
): (event: FocusEvent<HTMLOListElement>) => void {
  const had = useRef<ForkFocus | null>(null);
  const anchorsKey = anchors.join(" ");
  useLayoutEffect(() => {
    const element = list.current;
    const focus = had.current;
    // Each part's stop by its id, read from the key, so the effect runs only as they change.
    const anchor = focus === null ? null : anchorsKey.split(" ")[focus.part];
    if (!element || focus === null || !anchor) return;
    const row = element.querySelector<HTMLElement>(
      `li[${STOP_ATTRIBUTE}="${CSS.escape(anchor)}"] [${FORK_ROW_ATTRIBUTE}]`,
    );
    const active = document.activeElement;
    // Only the focus still on the row that folds away, or fallen to the page, is moved.
    const isLost = active === null || active === document.body || element.contains(active);
    if (!row || row.contains(active) || !isLost) return;
    const control =
      row.querySelector<HTMLElement>(focus.selector) ??
      row.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    control?.focus({ preventScroll: true });
  }, [anchorsKey, list]);
  return (event) => {
    had.current = forkFocusOf(event.target);
  };
}

/**
 * The glides of the list's rows told as one: each by what moves, as a row's fold or its height,
 * and `onGlide` told only as the first sets off and as the last comes to rest.
 */
function useGlidesTold(
  onGlide: ((isGliding: boolean) => void) | undefined,
): (key: string) => (isGliding: boolean) => void {
  const gliding = useRef(new Set<string>());
  const onGlideNow = useRef(onGlide);
  useLayoutEffect(() => {
    onGlideNow.current = onGlide;
  });
  return (key) => (isGliding) => {
    const glides = gliding.current;
    const wasGliding = glides.size > 0;
    if (isGliding) glides.add(key);
    else glides.delete(key);
    if (glides.size > 0 !== wasGliding) onGlideNow.current?.(!wasGliding);
  };
}

interface ReadingRowProps {
  /** On the plan, where the rail beside this stop runs to: the next stop's start, or its end. */
  railTo: number | null;
  stop: StopDraft;
  span: { from: number; to: number };
  pick: number;
  daylight: DayContext;
  /** Let in after the list was drawn: the pen writes it in. */
  isPenned: boolean;
  /** A proposal's stop beside the day: blue, "proposed" under its time, nothing to swap. */
  isProposed: boolean;
  isVersionsShown: boolean;
  /** The pen held at this letter, for the lab's still frame. */
  heldWritten?: number;
  /** The list's rows, which glide as one when they change together. */
  glideGroup: GlideGroup;
  onGlide: (isGliding: boolean) => void;
  nameRef: Ref<HTMLHeadingElement>;
  onChoose?: (candidateIndex: number) => void;
  /** On the plan, a version taken by the carousel, which keeps the focus where it is. */
  onPick?: (candidateIndex: number) => void;
  /** On the plan, the first stop that can swipe leans once to show it. */
  isNudged?: boolean;
}

/** One stop: its time, its name and sun, what and where until when, its line, its versions. */
function ReadingRow({
  railTo,
  stop,
  span,
  pick,
  daylight,
  isPenned,
  isProposed,
  isVersionsShown,
  heldWritten,
  glideGroup,
  onGlide,
  nameRef,
  onChoose,
  onPick,
  isNudged = false,
}: ReadingRowProps) {
  const candidates = candidatesOf(stop);
  const shown = candidates[pick] ?? stop.primary;
  const name = shown.name ?? "";
  const quarter = shown.neighborhood ?? "";
  const isQuarterSaid = quarter !== "" && !isQuarterNamed(name, quarter);
  const time = formatClock(span.from);
  const what = [
    kindWordOf(shown.kind, span.from),
    isQuarterSaid ? quarter : null,
    `until ${formatClock(span.to)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  // Every stop says its one line, a loud place's too: Read is where the words are read, and the
  // chart's folding by energy is the chart's. A version swapped in says its own line; what it
  // trades against the planned place is said where the choice is made, in its sheet.
  const summary = shown.summary ?? "";
  const light = isProposed ? null : bestLightOf(shown, span, daylight);
  // One pen through the row, in the order it reads.
  const penned = useEntryPen(time.length + name.length + what.length + summary.length, isPenned);
  const written = heldWritten ?? penned;
  const afterTime = written - time.length;
  const afterName = afterTime - name.length;
  const afterWhat = afterName - what.length;
  const others = candidates
    .map((place, candidate) => ({ place, candidate }))
    .filter(({ candidate }) => candidate !== pick);
  // Versions let in after the row was drawn are written in; those it came in with, with it.
  const [isVersionsFirst] = useState(isVersionsShown);
  // On the plan a stop swipes along its versions, once they are written; the line of them goes.
  // Drawn from the moment its versions are written, waiting until the day can be changed, so the
  // stop's form never changes as the day is done.
  const isCarousel = railTo !== null && isVersionsShown && !isProposed && others.length > 0;
  const words = (
    <>
      {/* Focused after a swap, ringed as the product's buttons are, round its name. */}
      <h2 ref={nameRef} tabIndex={-1} className={NAME_CLASSES}>
        <PennedText text={name} written={afterTime} isActive={false} />
        {light && (
          <BestLightIcon
            light={light}
            className={cn(
              "ml-2 inline-block align-middle text-lamp",
              afterTime < name.length && "invisible",
            )}
          />
        )}
      </h2>
      <p className="type-note text-muted">
        <PennedText text={what} written={afterName} isActive={false} />
      </p>
      {summary !== "" && (
        <p className="mt-0.5 type-prose text-ink-soft">
          <PennedText text={summary} written={afterWhat} isActive={false} />
        </p>
      )}
    </>
  );
  return (
    // A swap, or versions let in, changes the row's height: the rows below glide.
    <GlidingHeight
      isClippedWhileGliding
      reachPx={ROW_REACH_PX}
      shouldAlwaysReach
      glideGroup={glideGroup}
      onGlide={onGlide}
      // On the plan a row wholly above the screen takes its new height with the page scrolled
      // by as much in the same write, so a change of the day's energy halfway down never moves
      // the rows in view; only those in view glide.
      shouldHoldTheView={railTo !== null}
    >
      <div
        className={cn(
          railTo === null ? ROW_CLASSES : RAIL_ROW_CLASSES,
          isProposed ? "text-swap" : "text-ink",
        )}
      >
        <span
          className={cn(
            GUTTER_CLASSES,
            isProposed
              ? "text-swap"
              : railTo !== null && isGoldenAt(daylight, span.from)
                ? "text-amber"
                : "text-muted",
          )}
        >
          <PennedText text={time} written={written} isActive={false} />
          {/* Under its time: it takes no room from the row's words. */}
          {isProposed && <span className={cn("block", MARK_CLASSES)}>proposed</span>}
        </span>
        {railTo !== null && (
          <LightRail
            daylight={daylight}
            from={span.from}
            to={railTo}
            hasBead
            // The bead and its rail come with the stop's time, as the pen writes it.
            className={cn(written < time.length && "invisible")}
          />
        )}
        <div className={cn("flex min-w-0 flex-col gap-1", railTo !== null && "pb-6")}>
          {isCarousel ? (
            <VersionCarousel
              stop={stop}
              pick={pick}
              name={name}
              onPick={onPick}
              isNudged={isNudged}
              renderVersion={(candidate) => (
                <VersionWords place={candidates[candidate] ?? stop.primary} span={span} />
              )}
            >
              {words}
            </VersionCarousel>
          ) : (
            <>
              {words}
              {isVersionsShown && !isProposed && others.length > 0 && (
                <VersionsLine
                  stop={stop}
                  others={others}
                  isPenned={isPenned || !isVersionsFirst}
                  onChoose={onChoose}
                />
              )}
            </>
          )}
        </div>
      </div>
    </GlidingHeight>
  );
}

/**
 * A version's words as it waits beside its stop on the plan: its name, what and where, and its
 * line, as the row would say them once it is taken, with no pen.
 */
function VersionWords({ place, span }: { place: PlaceDraft; span: { from: number; to: number } }) {
  const name = place.name ?? "";
  const quarter = place.neighborhood ?? "";
  const what = [
    kindWordOf(place.kind, span.from),
    quarter !== "" && !isQuarterNamed(name, quarter) ? quarter : null,
    `until ${formatClock(span.to)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <p className="type-name">{name}</p>
      <p className="type-note text-muted">{what}</p>
      {place.summary && <p className="mt-0.5 type-prose text-ink-soft">{place.summary}</p>}
    </>
  );
}

interface VersionsLineProps {
  stop: StopDraft;
  others: readonly { place: PlaceDraft; candidate: number }[];
  /** Let in after its row was written: the pen writes it in. */
  isPenned: boolean;
  onChoose?: (candidateIndex: number) => void;
}

/** "or" and the versions the stop could be swapped for, each with how it differs. */
function VersionsLine({ stop, others, isPenned, onChoose }: VersionsLineProps) {
  // Each version as its name and the way it differs, which `versionOf` says as the chart's
  // sheet does. A stop the list lets in is whole: its places' energies are written.
  const words = others.map(({ place, candidate }, at) => ({
    lead: at === 0 ? "or " : "",
    name: place.name ?? "",
    way: ` ${versionOf(stop as CurveStop, place as CurveStop["primary"])}`,
    // The dot between two versions ends the first one's line where they wrap, and never
    // opens the next: "· Ginkaku-ji Approach" read as a list's bullet.
    tail: at < others.length - 1 ? " ·" : "",
    id: place.id,
    candidate,
  }));
  const lengthOf = (part: (typeof words)[number]) =>
    part.lead.length + part.name.length + part.way.length + part.tail.length;
  // Where each version's words start in the line, for the pen.
  const parts = words.map((part, at) => ({
    ...part,
    start: words.slice(0, at).reduce((sum, before) => sum + lengthOf(before), 0),
  }));
  const last = parts.at(-1);
  const length = last ? last.start + lengthOf(last) : 0;
  const [isFirstPenned] = useState(isPenned);
  const written = useEntryPen(length, isFirstPenned);
  // Buttons once the line is written, so a name is never pressed half written.
  const isPressable = onChoose !== undefined && written >= length;
  // Each version on a line of its own where they wrap, the lines 8 px apart: run on as
  // text, a version on the first of two lines had 19.5 px to be pressed in, the target of
  // the one under it taking the rest of its 24.
  return (
    <p className="flex flex-wrap gap-x-1 gap-y-2 pt-0.5 type-note text-muted">
      {parts.map((part) => {
        const lead = part.start;
        const name = lead + part.lead.length;
        const way = name + part.name.length;
        const tail = way + part.way.length;
        return (
          <span key={part.id}>
            <PennedText text={part.lead} written={written - lead} isActive={false} />
            {isPressable ? (
              <button
                type="button"
                onClick={() => onChoose?.(part.candidate)}
                className={VERSION_CLASSES}
              >
                {part.name}
              </button>
            ) : (
              <span className="text-swap">
                <PennedText text={part.name} written={written - name} isActive={false} />
              </span>
            )}
            <PennedText text={part.way} written={written - way} isActive={false} />
            <PennedText text={part.tail} written={written - tail} isActive={false} />
          </span>
        );
      })}
    </p>
  );
}

/**
 * How many of a row's letters the pen has written as the row comes in: none to all on the
 * gentle spring, once, as the chart's pen writes a row's words in. A row that was there
 * already, or any row under reduced motion, is written whole at once.
 */
function useEntryPen(length: number, isPenned: boolean): number {
  const isReducedMotion = useReducedMotion() ?? false;
  const [written, setWritten] = useState(isPenned ? 0 : Infinity);
  // The length when the row came in: its words are final by then, so the pen is set once.
  const [penLength] = useState(length);
  useEffect(() => {
    if (!isPenned || isReducedMotion) return undefined;
    const controls = animate(0, penLength, {
      ...SPRINGS.gentle,
      onUpdate: (count) => setWritten(Math.round(count)),
      onComplete: () => setWritten(Infinity),
    });
    return () => controls.stop();
  }, [isPenned, isReducedMotion, penLength]);
  return isReducedMotion ? Infinity : written;
}
