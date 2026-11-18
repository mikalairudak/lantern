"use client";

import { AnimatePresence, animate, useIsPresent, useReducedMotion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
   * What each part's head is kept by, beside its part (`headKeysOf`): the hour the part's window
   * opens at, which a take keeps, so the head is drawn again in place, and a part that opens at
   * another hour folds its head in anew. Left out, a head is kept by its part alone.
   */
  keys?: readonly string[];
  /**
   * Each part's stop, by id: the first of the day's stops in the part, or, for a part the day on
   * screen has no stop in, the first stop after it. Null where none follows: its head stands
   * under the last row.
   */
  anchors: readonly (string | null)[];
  headOf: (part: number) => ReactNode;
  /**
   * Each part's last stop on the list, by id, after which it holds the room its head stands
   * beside the list; null where it has none, as a part under the last row. Left out, its anchor.
   */
  ends?: readonly (string | null)[];
  /**
   * A head stands out beside the list, as a slip in the margin does: its fold then feathers no
   * edge, which would hide what stands beside it, and its opacity alone hides a line it cuts.
   */
  isBeside?: boolean;
}

/** The list's name, which a screen reader hears and the page finds it by. */
export const READING_LIST_LABEL = "The day, to read";

const NO_STOPS: ReadonlySet<string> = new Set();
/** Marks each row by its stop's id. */
const STOP_ATTRIBUTE = "data-stop";
/** Marks what a part's head stands beside the list, out of flow, as a slip in the margin. */
export const BESIDE_ATTRIBUTE = "data-beside";

/** The room after the last row for a slip beside the list whose part no stop of the day follows. */
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
  const [wholeIds, setWholeIds] = useState(
    () => new Set([...shown.map(({ stop }) => stop.id), ...hidden]),
  );
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
  // Heads there before the list is first painted stand whole with it, those of a fork the page
  // places once it has measured its column, in the render before that paint, among them; a
  // head that comes after folds in.
  const [isPainted, setIsPainted] = useState(false);
  useEffect(() => {
    const painted = requestAnimationFrame(() => setIsPainted(true));
    return () => cancelAnimationFrame(painted);
  }, []);
  // A slip beside the list stands out of flow, so its part holds the room it takes after its
  // last row: it never reaches the next part's rule, nor the page's foot under the last row.
  const isBeside = parts?.isBeside ?? false;
  const ends = parts?.ends ?? NO_ANCHORS;
  const rooms = useRoomsBeside(list, isBeside, anchors, ends);
  /**
   * The room of each part whose last row this is, or under the last: it opens from nothing where
   * it comes to stand, glides to each new height, and folds away as its part goes, as an
   * answered fork's heads do, each on its own spring kept to a row's reach (`ROW_REACH_PX`), not
   * timed with the rows a new energy changes together: so the rows under it glide, never jump.
   */
  const roomsAt = (place: string | null) => (
    <AnimatePresence initial={false}>
      {isBeside &&
        anchors.flatMap((anchor, part) =>
          (ends[part] ?? anchor) === place
            ? [
                <Fold key={part} isAppearing={false} reachPx={ROW_REACH_PX}>
                  <RoomBeside part={part} room={roomOf(rooms, part, place)} isPainted={isPainted} />
                </Fold>,
              ]
            : [],
        )}
    </AnimatePresence>
  );
  /**
   * The heads of the parts that stand over a row, or under the last: each an item of the list of
   * its own, just before its part's first row, kept by its part and the hour its window opens at
   * (`headKeysOf`). A take changes the rows under a head and not the head: it stays where it was
   * pressed, in full ink, its answers changing sides in place, while the rows of the version
   * left fold out under it and those of the version taken fold in. A head folds in and out as
   * its part comes and goes; one there before the list's first paint stands whole. In the column
   * one that comes after comes into full ink on its spring's own time while its room still opens
   * at a row's pace: its fork line says Lantern has begun, and ink that followed the room a whole
   * day holds on a phone would leave it pale for seconds. In the margin its room is a line's, and
   * its ink follows it.
   */
  const headsAt = (anchor: string | null) =>
    anchors.flatMap((each, part) => {
      const head = each === anchor ? parts?.headOf(part) : null;
      const key = `head ${part} ${parts?.keys?.[part] ?? ""}`;
      return head
        ? [
            // Positioned, so a slip in the margin stands from the head's top, out of its fold.
            <li key={key} className={cn("group relative", rowClassName)}>
              <Fold
                reachPx={ROW_REACH_PX}
                isAppearing={isPainted ? undefined : false}
                isOpenToTheSide={isBeside}
                isInkOnItsSpring={!isBeside}
                onGlide={glideOf(key)}
              >
                <PartHead part={part}>{head}</PartHead>
              </Fold>
            </li>,
          ]
        : [];
    });
  return (
    <ol
      ref={list}
      aria-label={READING_LIST_LABEL}
      aria-busy={!isWritten || isGliding}
      className="flex flex-col"
    >
      <AnimatePresence initial={false}>
        {shown.flatMap(({ stop, index }, at) => [
          ...headsAt(stop.id),
          <li
            key={stop.id}
            {...{ [STOP_ATTRIBUTE]: stop.id }}
            className={cn("group relative", rowClassName)}
          >
            {/* The last row let in as the day is written opens on the layout spring, with
                nothing on the list below it to move. Every other row, and every row of a list
                written whole, as a version taken coming in or the one it replaces folding away
                with rows after it, moves no faster than the rows below can glide. */}
            <Fold
              reachPx={at === shown.length - 1 && !isWritten ? undefined : ROW_REACH_PX}
              onGlide={glideOf(`${stop.id} fold`)}
            >
              <RowWords stop={stop.id}>
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
              </RowWords>
              {roomsAt(stop.id)}
            </Fold>
          </li>,
        ])}
        {headsAt(null)}
        {isBeside && anchors.includes(null) && (
          <li key={TAIL_KEY} className={cn("group relative", rowClassName)}>
            <Fold isAppearing={isPainted} reachPx={ROW_REACH_PX}>
              {roomsAt(null)}
            </Fold>
          </li>
        )}
      </AnimatePresence>
    </ol>
  );
}

/** Marks a row's words, by its stop, which a part's room is measured against. */
const ROW_WORDS_ATTRIBUTE = "data-row-words";
/** Marks the words of a row folding away, whose rest is nothing. */
const ROW_LEAVING_ATTRIBUTE = "data-row-leaving";
/**
 * Marks a row's words inside the box that glides to their height: as tall as they will rest,
 * whatever the box is drawn at this frame.
 */
const ROW_AT_REST_ATTRIBUTE = "data-row-at-rest";
/** Marks a part's head, by its part. */
const PART_HEAD_ATTRIBUTE = "data-part-head";
/** Marks the room a part holds after its last row for its slip beside the list, by its part. */
const ROOM_ATTRIBUTE = "data-room-beside";

/**
 * The room a part holds after its last row for what its head stands beside the list, gliding
 * to each new height on its own spring, kept to a row's reach, so the rows under it glide; at
 * once before the list is first painted, where it stands whole with the fork.
 */
function RoomBeside({ part, room, isPainted }: { part: number; room: number; isPainted: boolean }) {
  return (
    <div {...{ [ROOM_ATTRIBUTE]: part }}>
      <GlidingHeight reachPx={ROW_REACH_PX} shouldAlwaysReach isInstant={!isPainted}>
        <div style={{ height: room }} />
      </GlidingHeight>
    </div>
  );
}

/**
 * The room each part holds after its last row, by its part: how much taller what its head
 * stands beside the list is than the head and the part's rows. Each is read as it will rest:
 * the head and the rows inside their folds, so one folding in or out never reads short, and a
 * row's words inside the box that glides to them, so a swap or a re-pick moves no room while
 * the rows glide. A row folding away counts for nothing, its rest, and the head is the part's
 * that stands, never one folding away with its fork. Read after each render and as any of
 * them is resized; none while nothing stands beside the list, when those measured are dropped.
 * Between two forks that stand one after the other, a room is kept by where it stands (`roomOf`).
 */
function useRoomsBeside(
  list: RefObject<HTMLOListElement | null>,
  isBeside: boolean,
  anchors: readonly (string | null)[],
  ends: readonly (string | null)[],
): Rooms {
  const [rooms, setRooms] = useState<Rooms>(NO_ROOMS);
  // Rooms measured beside the list go when nothing stands beside it, so the next open from nothing.
  if (!isBeside && rooms !== NO_ROOMS) setRooms(NO_ROOMS);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element || !isBeside) return undefined;
    const measure = () => {
      const rows = [
        ...element.querySelectorAll<HTMLElement>(
          `[${ROW_WORDS_ATTRIBUTE}]:not([${ROW_LEAVING_ATTRIBUTE}])`,
        ),
      ];
      const next: Record<number, Room> = {};
      anchors.forEach((anchor, part) => {
        const head = element.querySelector<HTMLElement>(
          `[${PART_HEAD_ATTRIBUTE}="${part}"]:not([inert])`,
        );
        const beside = head?.querySelector<HTMLElement>(`[${BESIDE_ATTRIBUTE}]`);
        if (!head || !beside) return;
        const first = rows.findIndex((row) => row.getAttribute(ROW_WORDS_ATTRIBUTE) === anchor);
        const end = ends[part] ?? anchor;
        const last = rows.findIndex((row) => row.getAttribute(ROW_WORDS_ATTRIBUTE) === end);
        const words =
          first === -1 || last === -1
            ? 0
            : rows.slice(first, last + 1).reduce((sum, row) => sum + atRestOf(row), 0);
        const height = Math.ceil(Math.max(0, beside.offsetHeight - head.offsetHeight - words));
        next[part] = { at: end, height };
      });
      setRooms((current) => (isSameRooms(current, next) ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    const measured = `[${BESIDE_ATTRIBUTE}], [${PART_HEAD_ATTRIBUTE}], [${ROW_AT_REST_ATTRIBUTE}]`;
    for (const box of element.querySelectorAll(measured)) observer.observe(box);
    return () => observer.disconnect();
  });
  return rooms;
}

/** A row's words as tall as they will rest: the sun's lines as drawn, its words at rest. */
function atRestOf(row: HTMLElement): number {
  return [...row.children].reduce((sum, child) => {
    const box = child.querySelector<HTMLElement>(`[${ROW_AT_REST_ATTRIBUTE}]`) ?? child;
    return sum + (box instanceof HTMLElement ? box.offsetHeight : 0);
  }, 0);
}

/** The room a part holds, and after which row it was measured to stand: null under the last. */
interface Room {
  at: string | null;
  height: number;
}

/** Each part's room, by its part. */
type Rooms = Readonly<Record<number, Room>>;

const NO_ROOMS: Rooms = {};

/**
 * The room a part holds after a row, or under the last: what was measured for it there, and
 * nothing where it has just come to stand, so it opens from nothing to what is measured for it.
 */
function roomOf(rooms: Rooms, part: number, place: string | null): number {
  const room = rooms[part];
  return room?.at === place ? room.height : 0;
}

function isSameRooms(a: Rooms, b: Rooms) {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => {
      const [one, other] = [a[Number(key)], b[Number(key)]];
      return one?.at === other?.at && one?.height === other?.height;
    })
  );
}

/**
 * A row's words, marked by its stop for the room beside its part, and as leaving while the row
 * folds away: it still stands in the list, but its rest is nothing.
 */
function RowWords({ stop, children }: { stop: string; children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <div {...{ [ROW_WORDS_ATTRIBUTE]: stop, [ROW_LEAVING_ATTRIBUTE]: isPresent ? undefined : "" }}>
      {children}
    </div>
  );
}

/**
 * A part's head, which takes no press and no focus once it folds away: it still says the fork
 * as it stood before it went.
 */
function PartHead({ part, children }: { part: number; children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <div inert={!isPresent} {...{ [PART_HEAD_ATTRIBUTE]: part }}>
      {children}
    </div>
  );
}

/** No fork: one array for every list without one. */
const NO_ANCHORS: readonly (string | null)[] = [];

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
      <div {...{ [ROW_AT_REST_ATTRIBUTE]: "" }} className={cn(ROW_CLASSES, "text-ink")}>
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
