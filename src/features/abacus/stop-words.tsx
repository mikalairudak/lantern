"use client";

import { Fragment, useLayoutEffect, type ReactNode } from "react";
import { Ink, InkPart } from "@/components/ui/ink";
import { useWrittenText } from "@/components/ui/use-written-text";
import { cn } from "@/components/ui/cn";

import { BestLightIcon } from "./best-light-icon";
import { plannedPlace } from "./curve";
import { isWriting, type PlaceDraft, type StopDraft } from "./day-draft";
import { type Density } from "./density";

import { type BestLight } from "./light";

import { kindWordOf } from "./meal";

import { CheckMark, usePlaceCheck } from "./place-check";

import { PennedText } from "@/components/ui/penned-text";

export const NAME_CLASSES = "type-name text-quote";

const META_CLASSES = "type-note";

interface SunlitNameProps {
  name: string;
  light: BestLight;
  /** The sun is drawn; until then it holds its room unseen. */
  isSunShown: boolean;
  /** How many of the name's letters the pen has written; all of them unless it writes it. */
  written?: number;
}

/**
 * A name written, with its best-light sun after it. The sun keeps to the name's last word:
 * where the line has no room for both, the word goes onto the next line with the sun rather
 * than leave the sun alone on a line of its own, as Gion Shirakawa's did on a phone. A last
 * word too wide for a line with the sun lets the sun go under it, never past the column.
 */
function SunlitName({ name, light, isSunShown, written = Infinity }: SunlitNameProps) {
  const lastWordAt = name.lastIndexOf(" ") + 1;
  return (
    <>
      <PennedText text={name.slice(0, lastWordAt)} written={written} isActive={false} />
      <span className="inline-block max-w-full">
        <PennedText text={name.slice(lastWordAt)} written={written - lastWordAt} isActive={false} />
        <BestLightIcon
          light={light}
          className={cn("ml-2 inline-block align-middle text-lamp", !isSunShown && "invisible")}
        />
      </span>
    </>
  );
}

interface StopWordsProps {
  stop: StopDraft;
  /**
   * When the stop starts on the day's running clock, which names a meal: past midnight it
   * runs on, so a meal there is never breakfast. Not known while the stop is placed.
   */
  start?: number;
  shown: PlaceDraft;
  /** Which way the shown version goes from the planned one; null for the planned one itself. */
  version: string | null;
  writing: string | null;
  /**
   * Its name already says its quarter, so its row does not say it again: decided by the row
   * once for its words on screen and the copies that measure them (`isQuarterNamed`).
   */
  isQuarterInName: boolean;
  light: BestLight | null;
  /** How much to say: the texture too, the name and note, or the name and kind alone. */
  density?: Density;
  /**
   * Says its second line: how it sounds and feels in the model's words where it opens, how
   * full and how loud in two words where it does not. The copy that measures the row's width
   * on one line leaves it out, as a line of its own.
   */
  isSecondLineSaid?: boolean;
  /**
   * The row on screen, whose neighbourhood and texture the pen writes in once the place is
   * weighed, into room held for them from when its energy is written. The unseen copy that
   * measures the row's width sets them whole.
   */
  isPenned?: boolean;
  /**
   * The row's words came as its bead was weighed, so the pen writes its name in too, over
   * the room the rest of it takes; a row shown as it rests from its first frame shows it.
   */
  isNamePenned?: boolean;
  /** Its bead has set off for its energy, so the pen writes and the sun shows. */
  isWeighed?: boolean;
  /**
   * Its words are seen laid out as they will rest, before or after its bead is weighed: the
   * line its bead adds holds its room among them from the first frame.
   */
  isAtRest?: boolean;
  /** The pen stops where it is, mid-word too, as the day fades out. */
  isStill?: boolean;
  /** Told whether the pen is still writing these words in, for the day to say it is busy. */
  onPen?: (isPenning: boolean) => void;
  /** A proposal's stop beside the day: its name in the versions' blue, not yet the day's ink. */
  isProposed?: boolean;
}

/**
 * A stop's name and, after it, what kind of place it is and its quarter; or, when the
 * visitor swapped in another version, which way it goes and what it replaces. A place to eat
 * or drink around is named by what is eaten there and where, so its row says its meal by the
 * hour, a café or a bar, for its kind: "Petiscos on Rua das Flores", "dinner · Chiado". A
 * quarter the name already says is not said again, at any kind ("Obanzai along Pontocho",
 * "dinner"); its sheet still says it.
 */
export function StopWords({
  stop,
  start,
  shown,
  version,
  writing,
  isQuarterInName,
  light,
  density = "standard",
  isSecondLineSaid = true,
  isPenned = false,
  isNamePenned = false,
  isWeighed = true,
  isAtRest = true,
  isStill = false,
  onPen,
  isProposed = false,
}: StopWordsProps) {
  const planned = plannedPlace(stop);
  const isPlanned = shown.id === planned.id;
  const isFolded = density === "folded";
  const isVersion = !isPlanned && version !== null;
  const isNameWriting = isWriting(writing, shown.id, "name");
  const pen = { isPenned, isWeighed, isStill };
  const kindWord = kindWordOf(shown.kind, start);
  // Folded, a row says its name and kind (`docs/decisions.md`, "The day is drawn as an abacus"); so
  // does a version swapped in, whose row says which way it went.
  const isQuarterSaid = !isFolded && !isVersion && !isQuarterInName;
  const penned = useWeighedText(isNamePenned ? shown.name : null, pen);
  // How much of the name the pen has written; all of it where it does not write the name.
  const nameWritten = penned ? penned.written.length : Infinity;
  // The rest of a weighed row's words waits for its name, in their room: the pen writes the
  // name, then what kind of place it is shows, then the pen writes where it is and how it
  // sounds, in reading order, as each stop arrives.
  const isNameWhole = penned === null || penned.rest === "";
  const restPen = { ...pen, isWeighed: isWeighed && isNameWhole };
  const neighbourhood = useWeighedText(isQuarterSaid ? shown.neighborhood : null, restPen);
  const isOpen = density === "open";
  const texture = useWeighedText(
    isSecondLineSaid && isOpen ? shown.sensory?.texture : null,
    restPen,
  );
  // Where a row does not open, its second line says how full and how loud it is, in the
  // sheet's words: a lively place in two words where a calm one speaks a line
  // (`docs/decisions.md`, "The day is drawn as an abacus"). Like the texture, it is what the bead
  // adds: a row laid out beside its hollow bead says its name and kind alone, and the pen writes
  // the line in as the bead sets off. A row seen at rest before then, as a day's first rows are,
  // holds the line's room unseen from its first frame, as the copies that measure it do: laid in
  // only as the bead was weighed, it widened the words' box as it came, and such a row hung left of
  // its bead moved its words 77 to 123 px in that frame on a laptop, Madrid's El Rastro and
  // Bologna's first three.
  const feel = useWeighedText(
    isSecondLineSaid && !isOpen && (isWeighed || isAtRest) ? feelWordsOf(shown) : null,
    restPen,
  );
  // The name waits unseen for the bead, and the pen writes it only once it is weighed:
  // until then the row is not being written, it is waiting. Its kind comes whole once the
  // name is, so the line under the name only ever grows at its end, as the pen writes where
  // it is.
  const isPenning = [...(isWeighed ? [penned] : []), neighbourhood, texture, feel].some(
    (words) => words !== null && words.rest !== "",
  );
  useLayoutEffect(() => {
    if (!onPen) return undefined;
    onPen(isPenning);
    // Gone, or written again, it is no longer writing.
    return () => onPen(false);
  }, [onPen, isPenning]);
  // Folded, a row keeps what kind of place it is, or which way a swap went, and no more.
  // Which way it went is energy, in energy's colour as the headline's clause says it; what
  // it replaced is the swap's, so one word never reads in two colours (2026-10-29).
  const meta: ReactNode[] = isVersion
    ? [
        <span key="way" className="text-energy">
          {version}
        </span>,
        !isFolded && `instead of ${planned.name ?? ""}`,
      ].filter(Boolean)
    : [kindWord].filter(Boolean);
  // A confirmed place says so after where it is, the row's quiet ink, a crosshair: on the
  // map. It comes once the row rests and the pen has written where the place is, into room
  // the row has held from its first frame, so nothing moves when it comes. A version swapped
  // in says which way it went there instead; its sheet says it is on the map.
  const check = usePlaceCheck(shown.id);
  // It shows only in the words as they rest: a row still folded beside its hollow bead says
  // less than it will.
  const isWhereWritten =
    isWeighed &&
    isNameWhole &&
    !isWriting(writing, shown.id, "neighborhood") &&
    (neighbourhood?.rest ?? "") === "";
  // Its room is held on the line, bound to the last word of where the place is, as the sun is
  // to the name's: alone, it wrapped onto a line of its own, as Souvlaki's on Nafplio's phone
  // ("lunch · Palio Nafplio" / "⌖"). It is held from the row's first frame, before its place
  // is checked and whatever the check says, in the row and in the copies that measure it
  // alike, so the row's lines and its width are decided before a word of them is seen.
  // Held from when its check came, or its name was whole, it came into a row already seen,
  // and a row hung left of its bead, whose words end at the bead, stepped 16 px left. Held
  // from the bead's weighing, it changed the row's measured words under the check that
  // weighs the row, which then unweighed it, and Madrid's phone looped. Held from the start,
  // weighing never changes it, and a name the pen is writing breaks its lines where the
  // whole name does (`SHOWN_WORDS_SLACK`).
  const mark = isVersion ? null : (
    <CheckMark check={check} isShown={isWhereWritten} className="ml-1" />
  );
  // What kind of place it is, or which way a swap went: unseen in its room until the name is
  // written whole.
  const kinds = meta.map((part, at) => (
    <Fragment key={at}>
      {at > 0 && " · "}
      {part}
    </Fragment>
  ));
  const kindsShown = isNameWhole ? kinds : <span className="invisible">{kinds}</span>;
  return (
    <>
      <span
        className={cn(NAME_CLASSES, "transition-colors", isProposed ? "text-swap" : "text-ink")}
      >
        {light && shown.name && !isNameWriting ? (
          <SunlitName
            name={shown.name}
            light={light}
            isSunShown={isWeighed && nameWritten >= shown.name.length}
            written={nameWritten}
          />
        ) : (
          <>
            <PennedText text={shown.name ?? ""} written={nameWritten} isActive={isNameWriting} />
            {light && (
              <BestLightIcon
                light={light}
                className={cn(
                  "ml-2 inline-block align-middle text-lamp",
                  !isWeighed && "invisible",
                )}
              />
            )}
          </>
        )}
      </span>
      {(meta.length > 0 || neighbourhood) && (
        <span className={cn(META_CLASSES, isPlanned ? "text-muted" : "text-swap")}>
          {neighbourhood ? (
            <>
              {kindsShown}
              <WeighedWords
                words={neighbourhood}
                lead={meta.length > 0 ? " · " : ""}
                isStreaming={isWriting(writing, shown.id, "neighborhood")}
                tail={mark ?? undefined}
              />
            </>
          ) : mark ? (
            <span className="inline-block max-w-full">
              {kindsShown}
              {mark}
            </span>
          ) : (
            kindsShown
          )}
        </span>
      )}
      {feel && (
        <span className={cn("block basis-full text-muted", META_CLASSES)}>
          {/* Both words are final before the line shows, so it never dries as it streams. */}
          <WeighedWords words={feel} isStreaming={false} />
        </span>
      )}
      {/* Open, a row says how the place sounds and feels, in the model's own italic. */}
      {texture && (
        <span className={cn("block basis-full type-prose text-small text-ink-soft")}>
          <WeighedWords
            words={texture}
            isStreaming={isWriting(writing, shown.id, "sensory.texture")}
          />
        </span>
      )}
    </>
  );
}

/**
 * How full and how loud a place is, as its row and its sheet say it: "busy · chatter". Both
 * words, or none while the second is still to come.
 */
function feelWordsOf(place: PlaceDraft): string | null {
  const { crowd, acoustic } = place.sensory ?? {};
  return crowd && acoustic ? `${crowd} · ${acoustic}` : null;
}

/** Words a row adds once weighed: what the pen has written, and the rest still to come. */
interface Weighed {
  written: string;
  rest: string;
}

/**
 * Words a row adds once its place is weighed, its neighbourhood or texture, or null when it
 * adds none. They have mostly arrived by then, so the pen writes them in from the frame the
 * bead sets off, in the drying ink of any new word, rather than letting them appear whole.
 * A row that shows them from its first frame shows them at once, as does the unseen copy,
 * which is not `isPenned`.
 */
function useWeighedText(
  text: string | null | undefined,
  { isPenned, isWeighed, isStill }: { isPenned: boolean; isWeighed: boolean; isStill: boolean },
): Weighed | null {
  const target = text ?? "";
  const pen = useWrittenText(isPenned && isWeighed ? target : "", "keep", false, isStill);
  if (target === "") return null;
  if (!isPenned) return { written: target, rest: "" };
  if (!isWeighed) return { written: "", rest: target };
  // The pen's spring starts from rest, which would hold the first letter back a few frames;
  // it comes in the frame the bead sets off instead, so the place is weighed as one event.
  const written = pen.text !== "" && target.startsWith(pen.text) ? pen.text : target.slice(0, 1);
  return { written, rest: target.slice(written.length) };
}

interface WeighedWordsProps {
  words: Weighed;
  /** What comes before them, as the separator after the kind, written with their first letter. */
  lead?: string;
  /** The stream is still writing these words. */
  isStreaming: boolean;
  /** A mark after them, kept on one line with their last word, written or not. */
  tail?: ReactNode;
}

/**
 * Weighed words as the pen writes them, over the room the rest will take: the row takes its
 * height and its lines at once, so a row below never rides its growth, and no written word
 * moves to another line as the next are written.
 */
function WeighedWords({ words, lead = "", isStreaming, tail }: WeighedWordsProps) {
  if (tail !== undefined) {
    return <TailedWords words={words} lead={lead} isStreaming={isStreaming} tail={tail} />;
  }
  if (words.written === "") {
    return (
      <span className="invisible">
        {lead}
        {words.rest}
      </span>
    );
  }
  return (
    <>
      {lead}
      <Ink text={words.written} isActive={words.rest !== "" || isStreaming} />
      {words.rest && <span className="invisible">{words.rest}</span>}
    </>
  );
}

/**
 * Weighed words whose last word keeps to the mark after it, as a name's to its sun: where the
 * line has no room for both, the word goes onto the next line with the mark. The pieces are
 * the same whether written yet or not, so the lines are decided before a word is seen.
 */
function TailedWords({
  words,
  lead,
  isStreaming,
  tail,
}: Required<Pick<WeighedWordsProps, "words" | "lead" | "isStreaming" | "tail">>) {
  const whole = words.written + words.rest;
  const written = words.written.length;
  const isActive = words.rest !== "" || isStreaming;
  const lastAt = whole.lastIndexOf(" ") + 1;
  /** The words from `from` to `to`: what is written in ink, the rest in its room, unseen. */
  const piece = (from: number, to: number): ReactNode => (
    <>
      {written > from && (
        <InkPart text={words.written} from={from} to={Math.min(to, written)} isActive={isActive} />
      )}
      {written < to && (
        <span className="invisible">{whole.slice(Math.max(from, written), to)}</span>
      )}
    </>
  );
  return (
    <>
      {written === 0 ? <span className="invisible">{lead}</span> : lead}
      {piece(0, lastAt)}
      <span className="inline-block max-w-full">
        {piece(lastAt, whole.length)}
        {tail}
      </span>
    </>
  );
}
