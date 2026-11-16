"use client";

import { AnimatePresence, animate, useIsPresent, useReducedMotion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";
import { createGlideGroup, GlidingHeight, type GlideGroup } from "@/components/ui/gliding-height";
import { BestLightIcon } from "@/features/abacus/best-light-icon";
import { candidatesOf } from "@/features/abacus/curve";
import type { PlaceDraft, StopDraft } from "@/features/abacus/day-draft";
import { PennedText } from "@/components/ui/penned-text";
import { FORK_CONTROL_ATTRIBUTE, FORK_ROW_ATTRIBUTE } from "@/features/abacus/fork-row";
import { bestLightOf } from "@/features/abacus/light";
import { kindWordOf } from "@/features/abacus/meal";
import { isQuarterNamed } from "@/features/abacus/quarter";
import type { DayContext } from "@/lib/geo/sun";
import { formatClock, runningSpans } from "@/lib/time/clock";
import { ROW_REACH_PX, SPRINGS } from "@/lib/tokens/motion";
import { VersionCarousel } from "./version-carousel";
import { isGoldenAt, LightRail, sunLinesOf, sunsOf, SunLine } from "./light-rail";

/** "until" and its time stay on one line: a time alone at a line's start reads as the next stop's. */
const NO_BREAK = "\u00a0";

/**
 * The day's plan, to read rather than to drag: a timetable of the stops the chart draws, their
 * time in a gutter, the rail of the day's light beside it, each stop's name, what it is and where,
 * until when, its one line, and the versions it swipes along (`docs/decisions.md`, "A day can be
 * read as a list, written as the chart is", "A day opens on its plan, lit by the day's light" and
 * "A stop on the plan swipes along its versions"). Built from the chart's own stops and picks, so
 * a version swapped here is the one the chart shows.
 *
 * It is written as the chart is, and shows nothing the stream may still change: a stop is
 * let in once all its row says is final, and its versions once the stream has written them
 * all, a second pass, as the chart's beads come after its rows. The last row opens its room
 * on the layout spring, with nothing on the list below it to move; a row let in among
 * others, a row's versions coming in or a swap moves the rows below at most `ROW_REACH_PX` in
 * the spring's time, about 2.4 px a frame. Rows a new energy changes together glide as one and
 * settle in about 1.5 s, the rows on screen under 3 px a frame (`gestureGlideOver`). The
 * pen writes each row's words in, as the chart's pen writes a row's. Under reduced motion each
 * stands whole at once, and a row waits for its versions (`DayStage`).
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
   * The rows of a fork's other version among `stops`, by id, as the chart draws them beside the
   * day: the plan lists the day alone, so none of them stands in it. One that comes to be the
   * day, as a proposal taken, comes in whole: it is no row being written.
   */
  hidden?: ReadonlySet<string>;
  /** A changed word's fork: over each part it rewrites, the part's head, its slip. */
  parts?: PlanParts | null;
  /**
   * One row's pen held at a letter, as the lab's still frame of a row being written; the pen
   * runs on its own otherwise.
   */
  heldPen?: { id: string; written: number };
  /** The list says all the day will: busy until then, as the chart's `aria-busy`. */
  isWritten?: boolean;
  /** Classes for each row, as for a day drawn whole that a visitor has not seen yet. */
  rowClassName?: string;
  /** Swaps a stop to one of its versions; left out, the versions wait beside it. */
  onChoose?: (stopIndex: number, candidateIndex: number) => void;
  /**
   * Told as its rows set off, a row let in or its versions coming in, and once every one has
   * come to rest, so what stands under the list can wait for them, as the day's end does.
   */
  onGlide?: (isGliding: boolean) => void;
}

/**
 * A fork's parts on the plan: over which of the list's stops each part's head stands, and the
 * head itself, the part's slip (`PartSlip`).
 */
export interface PlanParts {
  /**
   * Each part's stop, by id: the first of the day's stops in the part, or, for a part the day on
   * screen has no stop in, the first stop after it. Null where none follows: its head stands
   * under the last row.
   */
  anchors: readonly (string | null)[];
  headOf: (part: number) => ReactNode;
  /**
   * A head stands out beside the list, as a slip in the margin does: its fold then feathers no
   * edge, which would hide what stands beside it, and its opacity alone hides a line it cuts.
   */
  isBeside?: boolean;
}

/** The list's name, which a screen reader hears and the page finds it by. */
export const READING_LIST_LABEL = "The day, to read";

const NO_STOPS: ReadonlySet<string> = new Set();
/** Marks each row by its stop's id, so a part's head is found by its stop. */
const STOP_ATTRIBUTE = "data-stop";
/** Marks what a part's head stands beside the list, out of flow, as a slip in the margin. */
export const BESIDE_ATTRIBUTE = "data-beside";

/** The heads of the parts no stop of the day follows, under the last row. */
const TAIL_KEY = "parts-after";

/**
 * The plan's row: no rule between rows, the rail between the time and the words doing that work,
 * and the words' own room under them, so the rail runs on.
 */
const ROW_CLASSES = "flex gap-3";
const GUTTER_CLASSES = "w-12 shrink-0 pt-0.5 type-time tabular-nums";
const NAME_CLASSES = "self-start type-name";

/** The day as a list to read. */
export function ReadingList({
  stops,
  entered,
  versionsShown,
  picks,
  daylight,
  hidden = NO_STOPS,
  parts = null,
  heldPen,
  isWritten = true,
  rowClassName,
  onChoose,
  onGlide,
}: ReadingListProps) {
  // Each stop let in with its place among the chart's stops, which its picks are counted by; a
  // fork's other version stands in no row.
  const shown = stops
    .slice(0, entered)
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => !hidden.has(stop.id));
  const spans = runningSpans(shown.map(({ stop }) => stop));
  // Rows on the list when it is first drawn, as a day come back to whole, stand whole; so do the
  // rows of a fork's other version, once it is taken. The rows let in after are written in.
  const [firstIds] = useState(() => new Set(shown.map(({ stop }) => stop.id)));
  const [wholeIds, setWholeIds] = useState(() => new Set([...firstIds, ...hidden]));
  const newlyHidden = [...hidden].filter((id) => !wholeIds.has(id));
  if (newlyHidden.length > 0) setWholeIds(new Set([...wholeIds, ...newlyHidden]));
  // Rows a new energy changes together glide as one, in about 1.5 s.
  const [glideGroup] = useState(createGlideGroup);
  // The list says it is written once its rows are at rest too, so the last row's final form, its
  // versions come in, is part of the day written rather than after it.
  const [isGliding, setIsGliding] = useState(false);
  const glideOf = useGlidesTold((isNow) => {
    setIsGliding(isNow);
    onGlide?.(isNow);
  });
  const sunLines = sunLinesOf(sunsOf(daylight), spans, isWritten);
  // The first stop on the plan with a version to swipe to leans once, when the day is whole.
  const firstSwappable = shown.findIndex(
    ({ stop }) => versionsShown.has(stop.id) && stop.alternatives.length > 0,
  );
  const list = useRef<HTMLOListElement>(null);
  const anchors = parts?.anchors ?? NO_ANCHORS;
  // A head under the last row, there when the list was first drawn, stands whole with it.
  const [isTailFirst] = useState(() => anchors.includes(null));
  const noteFocus = useForkFocusKept(list, anchors);
  // A slip beside the list stands out of flow, so the row it heads holds its room: it never
  // reaches the next part's rule, nor the page's foot under the last row.
  const rooms = useRoomsBeside(list, parts?.isBeside ?? false);
  const roomOf = (place: string) =>
    parts?.isBeside && anchors.includes(place === TAIL_KEY ? null : place)
      ? rooms[place]
      : undefined;
  /**
   * The heads of the parts that stand over a row, or under the last: each folds in and out as
   * its part comes and goes, and with its row as the row comes and goes. One over a row let in
   * after the list was drawn folds in with it.
   */
  const headsAt = (anchor: string | null, glideKey: string, isAppearing: boolean) => (
    <AnimatePresence initial={false} propagate>
      {anchors.flatMap((each, part) => {
        const head = each === anchor ? parts?.headOf(part) : null;
        return head
          ? [
              <Fold
                key={part}
                reachPx={ROW_REACH_PX}
                isAppearing={isAppearing || undefined}
                isOpenToTheSide={parts?.isBeside}
                onGlide={glideOf(`${glideKey} head ${part}`)}
              >
                <PartHead>{head}</PartHead>
              </Fold>,
            ]
          : [];
      })}
    </AnimatePresence>
  );
  return (
    <ol
      ref={list}
      aria-label={READING_LIST_LABEL}
      aria-busy={!isWritten || isGliding}
      className="flex flex-col"
      onFocus={noteFocus}
    >
      <AnimatePresence initial={false}>
        {shown.map(({ stop, index }, at) => (
          // Positioned, so a slip in the margin stands from the row's top, out of its head's fold.
          <li
            key={stop.id}
            {...{ [STOP_ATTRIBUTE]: stop.id }}
            className={cn("group relative", rowClassName)}
          >
            {headsAt(stop.id, stop.id, !firstIds.has(stop.id))}
            {/* The last row opens on the layout spring, with nothing on the list below it to
                move; one with rows below, as a version taken coming in or the one it replaces
                folding away, no faster than the rows below can glide. */}
            <Fold
              reachPx={at === shown.length - 1 ? undefined : ROW_REACH_PX}
              onGlide={glideOf(`${stop.id} fold`)}
            >
              <RoomBeside place={stop.id} room={roomOf(stop.id)}>
                {(sunLines[at]?.lead ?? []).map(({ sun, to }) => (
                  <SunLine key={sun.word} daylight={daylight} sun={sun} to={to} />
                ))}
                <ReadingRow
                  railTo={sunLines[at]?.railTo ?? 0}
                  onPick={onChoose && ((candidate) => onChoose(index, candidate))}
                  isNudged={isWritten && at === firstSwappable}
                  stop={stop}
                  span={spans[at] ?? { from: 0, to: 0 }}
                  pick={picks[index] ?? 0}
                  daylight={daylight}
                  isPenned={!wholeIds.has(stop.id)}
                  heldWritten={heldPen?.id === stop.id ? heldPen.written : undefined}
                  glideGroup={glideGroup}
                  isVersionsShown={versionsShown.has(stop.id)}
                  onGlide={glideOf(`${stop.id} row`)}
                />
                {(sunLines[at]?.trail ?? []).map(({ sun, to }) => (
                  <SunLine key={sun.word} daylight={daylight} sun={sun} to={to} />
                ))}
              </RoomBeside>
            </Fold>
          </li>
        ))}
        {anchors.includes(null) && (
          <li key={TAIL_KEY} className={cn("group relative", rowClassName)}>
            {headsAt(null, TAIL_KEY, !isTailFirst)}
            <Fold isAppearing={!isTailFirst || undefined}>
              <RoomBeside place={TAIL_KEY} room={roomOf(TAIL_KEY)} />
            </Fold>
          </li>
        )}
      </AnimatePresence>
    </ol>
  );
}

/** Marks the room a row holds for what its head stands beside the list, by the row's place. */
const ROOM_ATTRIBUTE = "data-room-beside";

/** A row's words, at least as tall as what its head stands beside the list. */
function RoomBeside({
  place,
  room,
  children,
}: {
  place: string;
  room: number | undefined;
  children?: ReactNode;
}) {
  return (
    <div
      {...{ [ROOM_ATTRIBUTE]: place }}
      style={room === undefined ? undefined : { minHeight: room }}
    >
      {children}
    </div>
  );
}

/**
 * How far below each row's top what its head stands beside the list reaches, by the row's
 * place, read after each render and as it is resized; none while nothing stands beside it.
 */
function useRoomsBeside(
  list: RefObject<HTMLOListElement | null>,
  isBeside: boolean,
): Readonly<Record<string, number>> {
  const [rooms, setRooms] = useState<Readonly<Record<string, number>>>({});
  useLayoutEffect(() => {
    const element = list.current;
    if (!element || !isBeside) return undefined;
    const measure = () => {
      const next: Record<string, number> = {};
      for (const room of element.querySelectorAll<HTMLElement>(`[${ROOM_ATTRIBUTE}]`)) {
        const row = room.closest("li");
        const top = room.getBoundingClientRect().top;
        const reaches = [...(row?.querySelectorAll(`[${BESIDE_ATTRIBUTE}]`) ?? [])].map(
          (beside) => beside.getBoundingClientRect().bottom - top,
        );
        const place = room.getAttribute(ROOM_ATTRIBUTE) ?? "";
        if (reaches.length > 0) next[place] = Math.ceil(Math.max(0, ...reaches));
      }
      setRooms((last) => (isSameRooms(last, next) ? last : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const beside of element.querySelectorAll(`[${BESIDE_ATTRIBUTE}]`))
      observer.observe(beside);
    return () => observer.disconnect();
  });
  return rooms;
}

function isSameRooms(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/**
 * A part's head, which takes no press and no focus once it folds away: it still says the fork
 * as it stood before, as a version taken moves the head to its own first stop.
 */
function PartHead({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();
  return <div inert={!isPresent}>{children}</div>;
}

/** No fork: one array for every list without one. */
const NO_ANCHORS: readonly (string | null)[] = [];

/** Which of a part's controls had the focus: by its part, and how to find it again. */
interface ForkFocus {
  part: number;
  selector: string;
}

/** The part's control `target` is, if it is one: an answer by its side, or an action. */
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
 * Keeps the keys' focus on a part's head that moves to another stop, as a take moves it: the
 * head is drawn anew over the first stop of the version taken, and the one that had the focus
 * folds away with its row. The focus goes to the same control in the head's new place, or to its
 * chosen answer. Gives the handler that notes which control has the focus.
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
    // Only the focus still on the head that folds away, or fallen to the page, is moved.
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
  /** Where the rail beside this stop runs to: the next stop's start, or its end. */
  railTo: number;
  stop: StopDraft;
  span: { from: number; to: number };
  pick: number;
  daylight: DayContext;
  /** Let in after the list was drawn: the pen writes it in. */
  isPenned: boolean;
  isVersionsShown: boolean;
  /** The pen held at this letter, for the lab's still frame. */
  heldWritten?: number;
  /** The list's rows, which glide as one when they change together. */
  glideGroup: GlideGroup;
  onGlide: (isGliding: boolean) => void;
  /** A version taken by the carousel, which keeps the focus where it is. */
  onPick?: (candidateIndex: number) => void;
  /** The first stop that can swipe leans once to show it. */
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
  isVersionsShown,
  heldWritten,
  glideGroup,
  onGlide,
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
    `until${NO_BREAK}${formatClock(span.to)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  // Every stop says its one line, a loud place's too: Read is where the words are read, and the
  // chart's folding by energy is the chart's. A version swapped in says its own line; what it
  // trades against the planned place is said where the choice is made, in its sheet.
  const summary = shown.summary ?? "";
  const light = bestLightOf(shown, span, daylight);
  // One pen through the row, in the order it reads.
  const penned = useEntryPen(time.length + name.length + what.length + summary.length, isPenned);
  const written = heldWritten ?? penned;
  const afterTime = written - time.length;
  const afterName = afterTime - name.length;
  const afterWhat = afterName - what.length;
  const others = candidates
    .map((place, candidate) => ({ place, candidate }))
    .filter(({ candidate }) => candidate !== pick);
  // A stop swipes along its versions, once they are written. Drawn from the moment its versions
  // are written, waiting until the day can be changed, so the stop's form never changes as the
  // day is done.
  const isCarousel = isVersionsShown && others.length > 0;
  const words = (
    <>
      <h2 className={NAME_CLASSES}>
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
      // A row wholly above the screen takes its new height with the page scrolled by as much in
      // the same write, so a change of the day's energy halfway down never moves the rows in
      // view; only those in view glide.
      shouldHoldTheView
    >
      <div className={cn(ROW_CLASSES, "text-ink")}>
        <span
          className={cn(
            GUTTER_CLASSES,
            isGoldenAt(daylight, span.from) ? "text-amber" : "text-muted",
          )}
        >
          <PennedText text={time} written={written} isActive={false} />
        </span>
        <LightRail
          daylight={daylight}
          from={span.from}
          to={railTo}
          hasBead
          // The bead and its rail come with the stop's time, as the pen writes it.
          className={cn(written < time.length && "invisible")}
        />
        <div className="flex min-w-0 flex-col gap-1 pb-6">
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
            words
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
    `until${NO_BREAK}${formatClock(span.to)}`,
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

/**
 * How many of a row's letters the pen has written as the row comes in: none to all on the
 * gentle spring, once, as the chart's pen writes a row's words in. A row that was there
 * already, or any row under reduced motion, is written whole at once.
 */
export function useEntryPen(length: number, isPenned: boolean): number {
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
