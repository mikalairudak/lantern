"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { useHydrated } from "@/components/ui/use-hydrated";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { routeSourceFor } from "@/features/itinerary/day-route";
import { replanRouteSourceFor, type ReplanAsk } from "@/features/itinerary/replan-route";
import { useReplanStream, type ReplanSource } from "@/features/itinerary/use-replan-stream";
import {
  WHOLE_DAY_WINDOW,
  forkFrameOf,
  newStopsOf,
  replanFrameOf,
  windowsOf,
  type ReplanFrame,
  type ReplanWindow,
} from "@/features/abacus/replan-frame";
import { receiptOf } from "@/features/abacus/work-line";
import type { ShownPlaces } from "@/features/abacus/curve";
import { PAGE_INVITATION_MEMORY } from "@/features/abacus/use-invitation";
import type { GeoPoint } from "@/lib/geo/sun";
import { movedStopsOf, type ReplanBasis } from "@/lib/replan/merge";
import { replanPlanOf } from "@/lib/replan/windows";
import {
  NO_CHECKS,
  useDayStream,
  type DaySource,
  type DayStream,
  type PlaceChecks,
} from "@/features/itinerary/use-day-stream";
import type { DayVia } from "@/lib/events/event.schema";
import type {
  AssumableFactKey,
  DayRequest,
  EnergyLevel,
  Itinerary,
} from "@/lib/schema/itinerary.schema";
import { isSameRequest } from "@/lib/days/request";
import { isWrittenRequest, shownRequestOf } from "@/lib/days/written/requests";
import { isOnItsWeekday } from "@/lib/days/written/shown-date";
import { picksOf, type ReplanBasisRef } from "@/lib/replan/request";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import { signedKeyOf } from "@/lib/intake/signed-city";
import { writtenRequestFor } from "@/lib/intake/written-intake";
import { SPRINGS } from "@/lib/tokens/motion";
import { dateInZone, requestOf } from "@/lib/normalizer/normalize-intake";
import type { CityReading } from "@/lib/schema/intake.schema";
import { useLiveNow } from "./live-flag";
import {
  clearSeenNote,
  isKeptSeen,
  isSeen,
  keptSeenKeyOf,
  markSeen,
  seenKeyAt,
  seenKeyOf,
} from "./seen-days";
import { START_ADDRESS, dayAddressOf, dayAddressOfId, daySlugOf } from "@/lib/days/address";
import { dayTitleOf } from "./day-title";
import {
  endingOf,
  energiesOfDay,
  energiesSoFarOf,
  forgetDay,
  forgetDays,
  keepDay,
  useDaysAskedAgain,
  useForgetCount,
  useYourDays,
} from "./use-your-days";
import { browserStorage, type YourDay } from "./your-days";
import { keepCaveats } from "./caveats";
import { useKeptCaveats } from "./use-caveats";
import type {
  ForkReceipt,
  ForkSide,
  ReplanControls,
  ReplanEnding,
  ReplanPlaces,
  ReplanStatus,
} from "./replan-controls";
import { placesKeptOf, writtenOf } from "./replan-work";
import { shownEnergiesOf } from "./day-shape";
import { endedDayOf, phaseOf } from "./stream-ending";
import { isSentenceStreamed } from "./header-ready";
import { readIntakeRoute } from "./intake-route";
import { FootLine } from "./foot-line";
import { replanningOf, replanningPartOf } from "./not-yet";
import { requestFor, standInZoneOf } from "./start";
import { StartHeader, type CityQuestion, type StartLine } from "./start-header";
import type { TypedCity, TypedCityFailure } from "./city-word";
import { askedLabelsOf, FACT_OPTIONS, optionOf, type FactKey } from "./facts";
import { useFirstImpression } from "./first-impression";
import { useDayEvents } from "./use-day-events";
import { NO_CONFIRMED, DayStage } from "./day-stage";
import { shownDayOf, wholeInPlaceOf, type EndedDay } from "./shown-day";
import type { StartExcerpt } from "./start-excerpt";
import { startOffersOf } from "./start-offers";
import { keptKeyOf, type KeptLanding } from "./kept-day";
import type { StartReader, StartResult } from "./written-reader";

/**
 * The longest the start screen keeps the visitor's day while it waits for the day's own words,
 * counted from its request being read (`docs/decisions.md`, "The first screen asks one question,
 * and no day is drawn until a press"): the page turns once Lantern's words for the headline have
 * streamed whole, onto its own sentence, and the line about the day is written on the day's page. A
 * live day's first bytes and first words take about two seconds more on production
 * (`docs/harness.md`, "Where a request's seconds go"), so only a stalled day turns the page with
 * what it has.
 */
export const START_WORDS_CAP_MS = 8000;

const MS_PER_SECOND = 1000;
/**
 * The longest a fork folding a version away holds its frame should the chart never say its
 * stops are off the curve: five gentle springs, past the slowest a stretch of curve leaves.
 */
const FOLDING_LONGEST_MS = 5 * SPRINGS.gentle.visualDuration * MS_PER_SECOND;

/** One request on screen, played from the route. */
interface Asked {
  request: DayRequest;
  run: number;
  /** How the visitor reached it, as the product's events count it. */
  via: DayVia;
  /** Chosen by the visitor, rather than by landing or by a replay: the city word takes the focus. */
  isChosen: boolean;
  /** The visitor's phrases that fit no word of the request, said back under the day. */
  unplaced: readonly string[];
  /** Lantern's words of a written day that the visitor's text said as they are: theirs. */
  confirmed: readonly AssumableFactKey[];
  /** Its stream was started while the start screen kept its place. */
  isStreamed: boolean;
  /** Played in place of a day that ended without one. */
  isAfterExit: boolean;
  /** The height of the header's room on the day this one was played from, if it had a chart. */
  heldRoom: number | null;
  /**
   * The cities the name could mean, when the day was played as one of them: the city word
   * lists them, and which one is played is told by its place id, as two of them can share
   * a name and a zone. Empty for a city named whole and for written days.
   */
  readings: readonly CityReading[];
  playedReading: string | null;
  /** A day kept on the server, drawn as it ended: nothing is played for it. */
  kept: KeptLanding | null;
  /**
   * The kept day drawn whole, its pen and its rows with it, once the page reads that this
   * device watched it to its end (`isKeptSeen`). Its page's first HTML holds the pen's first
   * frame, as a visitor who has not seen it sees the day begin.
   */
  isKeptWhole: boolean;
  /**
   * A written day drawn whole with nothing played: the page's own in its first HTML, and any
   * this device has watched to its end (`seen-days.ts`), with its place checks. Also a day a
   * changed word wrote again whole, and the day before it put back from memory.
   */
  whole: WholeDay | null;
  /**
   * The day's record in the log, for a day drawn whole that the stream on screen may no longer
   * hold: a day a changed word wrote again whole, and the day before it put back from memory.
   * Its id is its address, and its round the re-plans it has taken. Null otherwise: the stream
   * or the kept landing says them.
   */
  record: DayRecord | null;
  /**
   * A whole day's version taken from memory by its fork: the visitor's list already holds it,
   * so the stream, which may still hold the same request, never tells it.
   */
  isFromMemory: boolean;
}

/** A day's row in the log as the page knows it: its id, once named, and its re-plans so far. */
interface DayRecord {
  id: string | null;
  round: number;
}

/** A written day drawn whole: the day, and each place's check as its run had it. */
interface WholeDay {
  itinerary: Itinerary;
  checks: PlaceChecks;
}

/** How a day is played, beyond its request and whether the visitor chose it. */
interface PlayOptions {
  /** How the visitor reached it: from a word of the header, unless said otherwise. */
  via?: DayVia;
  unplaced?: readonly string[];
  /** The reading played, by place id, when the day is one of the cities a name could mean. */
  played?: string;
  confirmed?: readonly AssumableFactKey[];
  /** The cities the name could mean, when an intake just read them for this day. */
  readings?: readonly CityReading[];
}

/** How a day is asked for on the start screen, beyond its request. */
interface AskOptions {
  /** How the visitor reached it: by their words, or a written city pressed. */
  via: DayVia;
  /** The visitor's phrases that fit no word of the request, said back under the day. */
  unplaced?: readonly string[];
  /** The cities the name could mean, when an intake read them for this day. */
  readings?: readonly CityReading[];
  /** The reading played, by place id, when the day is one of the cities a name could mean. */
  playedReading?: string | null;
  /** Lantern's words of a written day that the visitor's text said as they are: theirs. */
  confirmed?: readonly AssumableFactKey[];
  /** The question the day answers, "in …?", which the line saying it back still names. */
  answering?: CityQuestion;
}

/** The visitor's day, streaming while the start screen keeps its place for a moment. */
interface Pending {
  request: DayRequest;
  /** Typed, or a written city pressed. */
  via: DayVia;
  unplaced: readonly string[];
  confirmed: readonly AssumableFactKey[];
  readings: readonly CityReading[];
  playedReading: string | null;
}

/**
 * The day a changed word asks for, once live: it streams while the day it was asked from
 * holds its place, and takes the page once its header has streamed whole.
 */
interface Replanning {
  request: DayRequest;
  /** The run of the day on screen it was asked from. */
  run: number;
  unplaced: readonly string[];
  /** The word the visitor chose, as the facts line names it. */
  word: string;
  /** When it was asked, as the visitor's list says once its answer names it. */
  at: number;
  /** The day on screen as it was asked from, which the fork takes back from memory. */
  before: Asked | null;
}

/**
 * A time word's re-plan of its part of the day (`docs/targeted-replan.md`), streaming over the
 * day on screen, which keeps its run: the word the visitor chose, the request with it, and
 * what the frames read.
 */
interface Targeted {
  run: number;
  word: string;
  request: DayRequest;
  basis: ReplanBasis;
  round: number;
  /** The day's id in the log as the re-plan began. */
  fromId: string | null;
  /** The header's room as it began, held as its floor while the re-plan streams. */
  room: number | null;
  /** When it began, for how long the day took to write again. */
  at: number;
  /** The day merged into this run as the re-plan began, if one was: what taking it back shows. */
  merged: Merged | null;
}

/** A day a re-plan merged into, drawn in its run's place from then on: the run keeps its key. */
interface Merged {
  run: number;
  request: DayRequest;
  outcome: DayOutcome;
  checks: PlaceChecks;
  /** How many re-plans this run's day has taken: the next one's ids start with the next. */
  round: number;
  /** The re-plan's id in the log, the merged day's address, once its answer named it. */
  dayId: string | null;
  /** The id the day had before, whose row in the visitor's list it takes. */
  fromId: string | null;
  /** When the re-plan began: the row says how long the day took to write again. */
  startedAt: string;
  /** The word the visitor changed, which takes the focus back once the merged day stands. */
  changed: AssumableFactKey;
}

/** The day on screen as it last streamed, drawn from here while another request streams. */
interface HeldDay {
  run: number;
  partial: PartialDay | null;
  outcome: DayOutcome | null;
  checks: PlaceChecks;
  /** Its id in the log as it was held, its address while the day asked for streams. */
  dayId: string | null;
}

/**
 * A word changed on the day on screen, its fork, as the header and the chart are told of it
 * (`ReplanControls`): from the press, while Lantern writes the proposal, to a choice and after,
 * until the next word changes.
 */
interface WordChange {
  /** The run it is told on: the day's own for a part of it; a whole day's from its taking. */
  run: number;
  word: AssumableFactKey;
  /** The word's answer before, and the one chosen, as the sentence says them. */
  from: string;
  to: string;
  /** The same two as values of the word's vocabulary; null for a word Lantern asked. */
  fromValue: string | null;
  toValue: string;
  reach: "part" | "whole";
  status: Exclude<ReplanStatus, "idle">;
  /** The parts the fork stands over, known at the press. */
  windows: readonly ReplanWindow[];
  /** The version not on screen is drawn beside the day. */
  isCompared: boolean;
  /** Why it ended without a proposal, once failed. */
  ending?: ReplanEnding;
  /**
   * Once whole, what each version would change against the other: the proposal's against the
   * day before, and the day before's against the proposal, once taken.
   */
  receipts?: { proposal: ForkReceipt; before: ForkReceipt };
  /** The change as it was asked, to ask it again after a failure. */
  ask: ChangeAsk;
}

/** A changed word as the page asks for it. */
interface ChangeAsk {
  request: DayRequest;
  word: string;
  changed: FactKey;
  shown: ShownPlaces;
}

/**
 * A whole day a changed word wrote again and the day before it, as days drawn whole from
 * memory, so taking either plays neither again and asks for nothing.
 */
interface WholeTurn {
  before: Asked;
  after: Asked;
}

/**
 * A part's proposal once whole: the day merged with it, held until it is taken, and the merged
 * day the run showed as it was asked, if any, which taking it back shows again. Both are drawn
 * in the run's place, so taking either changes no row's id and draws nothing anew.
 */
interface PartFork {
  run: number;
  basis: ReplanBasis;
  before: Merged | null;
  after: Merged;
}

/** What the facts line of a run says of a re-plan asked from it. */
interface ReplanLine {
  run: number;
  text: string;
}

/** No fork on screen: no parts to stand over. */
const NO_WINDOWS: readonly ReplanWindow[] = [];

/** A city named whole: no other city it could mean. */
const NO_READINGS: readonly CityReading[] = [];

/**
 * A history entry of a day's, as the day pushes or replaces it: told apart from the start
 * screen's own entry when both are at the start screen's address, as a day for a city
 * Lantern writes no day for is.
 */
const DAY_ENTRY = { lantern: "day" } as const;

function isDayEntry(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as { lantern?: unknown }).lantern === DAY_ENTRY.lantern
  );
}

/** A day kept under the start screen: the viewport's size, out of the flow, unseen. */
const BEHIND_START_CLASSES = "invisible fixed inset-0 overflow-hidden";

/** No phrases said back. */
const NO_PHRASES: readonly string[] = [];

/** No days to ask about: a page with no start screen lists none. */
const NO_YOUR_DAYS: readonly YourDay[] = [];

/**
 * A day Lantern has already written, as the page hands it to the start screen: its request,
 * what the day says of each word, and the energy of each stop the day shows. Never the day
 * itself, which plays from the route when it is asked for, so the first page stays light.
 */
export interface WrittenGist {
  request: DayRequest;
  facts: Itinerary["facts"];
  energies: readonly EnergyLevel[];
}

/** The start screen: one question, and the days Lantern has written, as words. */
export interface DayStart {
  /**
   * The days Lantern has written, normalized by the page, in the order the start screen
   * offers them. The first one's zone stands in for a city typed that Lantern does not know.
   */
  pool: readonly WrittenGist[];
  /** Reads the visitor's text into a request or a question. */
  read: StartReader;
  /** A written day's first stops, still, under the start screen's ways in. */
  excerpt?: StartExcerpt | null;
}

/** What a page around the day can ask of it. */
export interface DayHandle {
  /** Writes the day on screen again from its empty frame. */
  replay: () => void;
  /**
   * A changed word on the day as it now stands, as the header is told it: a lab's controls take
   * either version or compare them, as its fork rows do.
   */
  replan: () => ReplanControls;
}

/**
 * Where the day lands: on a request played at once, on the start screen with no day, or on a
 * day kept on the server, at its own address.
 */
type DayLanding =
  | {
      /** The request the day lands on, played from the route on arrival. */
      first: DayRequest;
      start?: never;
      kept?: never;
    }
  | {
      first?: never;
      /** The start screen: the question and the written days, and no day until one is asked. */
      start: DayStart;
      kept?: never;
    }
  | {
      first?: never;
      start?: never;
      /**
       * A day kept on the server: drawn whole as it ended, or what its address says in its
       * place. A new landing for it, as a day still being written lands, takes the page while
       * it is on screen; once the visitor has played another day, it is past.
       */
      kept: KeptLanding;
    };

type DayProps = DayLanding & {
  /**
   * Live generation is on, as the server read it for this page: Lantern writes new days, the
   * start screen says so, every day comes from the route, and a city typed on the city word
   * is read by the intake first. Off, only the written days play. Left out, the answer noted
   * for this visit (`LiveFlag`), off until it has come.
   */
  isLive?: boolean;
  /**
   * Where each day streams from: the app's route, or a lab's stand-in at another pace. It is
   * given the intake's signature of the request's city, when the page holds one.
   */
  sourceFor?: (request: DayRequest, signature: string | null) => DaySource;
  /** Where a time word's re-plan streams from: the app's route, or a lab's recorded stream. */
  /**
   * A targeted re-plan's stream, or null when this source cannot write one for the ask, as the
   * route cannot for a day it holds by neither an id nor a written address: the day is then
   * re-planned whole.
   */
  replanSourceFor?: (ask: ReplanAsk) => ReplanSource | null;
  /**
   * The page's address and title name the day on screen (`dayAddressOf`), so a copied link
   * opens it. Only the product's pages ask; a lab keeps its own address.
   */
  isAddressed?: boolean;
  /**
   * The days played, the intake's answers and the visitor's gestures are sent as the
   * product's events (`src/lib/events`). Only the product's pages count; a lab sends nothing.
   */
  isCounted?: boolean;
  /**
   * Where the first day's first place is, known on the server for a day Lantern has written,
   * so its sun is said from the first frame, in the page's own HTML too.
   */
  firstPlace?: GeoPoint;
  /**
   * The first day whole, as the page has it for a day Lantern has written, and the version
   * the build wrote it in: drawn whole in the page's first HTML, for a reader without its
   * script, and played for a visitor who has not watched it to its end on this device.
   */
  written?: { itinerary: Itinerary; version: string; checks: PlaceChecks };
  ref?: Ref<DayHandle>;
};

/**
 * A day streamed from the app's own route, under the request it was asked for. The day
 * never knows where the stream comes from; it plays a request and draws whatever arrives,
 * so the same day takes the live model in MVP. On the start screen no day is drawn until
 * the visitor asks for one, by a written city's word or in their own words; it is then
 * written where the question was.
 */
export function Day({
  first,
  start,
  kept,
  isLive: isLiveGiven,
  sourceFor,
  replanSourceFor = replanRouteSourceFor,
  isAddressed = false,
  isCounted = false,
  firstPlace,
  written,
  ref,
}: DayProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  // A written day's page passes none: it is drawn in the page's static shell, and the answer
  // for this visit comes after (`LiveFlag`).
  const isLive = useLiveNow(isLiveGiven);
  const isHydrated = useHydrated();
  // The quick starts the start screen offers, each with the shape of its written day.
  const starts = useMemo(() => (start ? startOffersOf(start.pool) : []), [start]);
  // The page's own written day, by the key this device notes it seen by.
  const firstSeenKey =
    first !== undefined && written !== undefined
      ? seenKeyOf(daySlugOf(first), written.version)
      : null;
  // Whether this device had seen it, as storage stood when the page first ran: decided once,
  // so storage cleared in another tab never plays again the day on screen. The server, and
  // the page as it hydrates, take it as seen: the first HTML holds the day whole.
  const [seenAtStart, setSeenAtStart] = useState<boolean | null>(null);
  if (isHydrated && seenAtStart === null) {
    setSeenAtStart(kept ? isKeptSeen(kept.id) : firstSeenKey !== null && isSeen(firstSeenKey));
  }
  const isFirstSeen = seenAtStart ?? true;
  /** The page's own written day whole, where it is the day asked and this device has seen it. */
  const wholeOf = useCallback(
    (request: DayRequest): WholeDay | null =>
      first !== undefined &&
      written !== undefined &&
      firstSeenKey !== null &&
      isSameRequest(request, first) &&
      isSeen(firstSeenKey)
        ? { itinerary: written.itinerary, checks: written.checks }
        : null,
    [first, written, firstSeenKey],
  );
  // Null while the start screen shows: nothing hands a day back to it, so once a day takes
  // the page there is always one.
  const [asked, setAsked] = useState<Asked | null>(() =>
    first
      ? {
          ...landingOf(first),
          whole: written ? { itinerary: written.itinerary, checks: written.checks } : null,
        }
      : kept
        ? keptLandingOf(kept, 0, false)
        : null,
  );
  // A visitor who has not watched the page's day to its end has it played, from its empty
  // frame, as soon as the page can tell, before it first paints it: drawn whole in the first
  // HTML, it was unseen. The server and the page as it hydrates take it as seen.
  // Only the day the page gave whole: another, the page's own among them where the page gave
  // none, comes whole from the route because it was seen.
  const isFirstWhole =
    asked?.whole != null &&
    firstSeenKey !== null &&
    first !== undefined &&
    isSameRequest(asked.request, first);
  // Only the page's first landing waits: a day landed whole later on this page, as the city
  // word brings it back once seen, was seen when it was asked for.
  const isAwaitingPlay = isFirstWhole && asked.run === 0 && !isFirstSeen;
  if (isAwaitingPlay) {
    setAsked((last) => (last?.whole ? { ...last, run: last.run + 1, whole: null } : last));
  }
  // A kept day's page draws the pen's first frame, as its server did, and a day this device
  // has seen is drawn whole as soon as the page can tell (`docs/decisions.md`, "A written day's
  // page is built whole, and plays only for a visitor who has not seen it"): its first frame holds
  // the whole day's room, so its words and rows come with nothing moving.
  const isKeptAwaitingWhole =
    asked?.kept != null && !asked.isKeptWhole && asked.run === 0 && seenAtStart === true;
  if (isKeptAwaitingWhole) {
    setAsked((last) =>
      last?.kept && !last.isKeptWhole ? { ...last, run: last.run + 1, isKeptWhole: true } : last,
    );
  }
  // The page's note on <html> that its day was not seen is done with once the day is drawn
  // as the visitor will see it, so a day landed whole later on this page is never unseen.
  useLayoutEffect(() => {
    if (isFirstWhole && firstSeenKey !== null && !isSeen(firstSeenKey)) return;
    clearSeenNote();
  }, [asked, firstSeenKey, isFirstWhole]);

  // A kept day that lands another way, as one still being written lands once done, takes the
  // page as a new run while the kept day is still on screen.
  const keptKey = kept ? keptKeyOf(kept) : null;
  const [landedKey, setLandedKey] = useState(keptKey);
  if (keptKey !== landedKey) {
    setLandedKey(keptKey);
    if (kept && asked?.kept?.id === kept.id) {
      setAsked(keptLandingOf(kept, asked.run + 1, isKeptSeen(kept.id)));
    }
  }
  // What the day says back of the visitor's words that Lantern could not plan around: those it
  // was asked with on this page, or, for a kept day opened at its address, those this device
  // keeps beside it (`caveats.ts`), taken as its own once read, so every version a fork takes
  // carries them on as it carries words typed here.
  const keptCaveats = useKeptCaveats(asked?.kept?.id ?? null);
  if (asked?.kept != null && asked.unplaced.length === 0 && keptCaveats.length > 0) {
    setAsked({ ...asked, unplaced: keptCaveats });
  }
  const saidBack = asked?.unplaced ?? NO_PHRASES;
  // A word changed on the day, its fork, from the press to a choice and after: what the header
  // and the chart are told of it, and which version can be taken.
  const [change, setChange] = useState<WordChange | null>(null);
  const changeShown = isThisRun(change, asked) ? change : null;
  // A part's proposal taken is drawn as it ended, in its run's place, and says its request;
  // taken back, the run shows what it showed before, from memory, in the same place.
  const [merged, setMerged] = useState<Merged | null>(null);
  const mergedShown = isThisRun(merged, asked) ? merged : null;
  const shownRequest = mergedShown?.request ?? asked?.request ?? null;
  // The day on screen as it last streamed, held while a changed word's whole day streams.
  const [heldDay, setHeldDay] = useState<HeldDay | null>(null);
  const held = isThisRun(heldDay, asked) ? heldDay : null;
  // An energy re-picked on the day on screen plays no new day, so its address stays; its
  // title says the energy the headline says. Kept with its run, so a new day drops it.
  const [repicked, setRepicked] = useState<{ run: number; energy: EnergyLevel } | null>(null);
  const shownEnergy = isThisRun(repicked, asked) ? repicked.energy : undefined;
  // Back from a day asked on the start screen shows the start screen again, while the day writes on
  // in memory; Forward shows the day again as it stands (`docs/decisions.md`, "A day is written to
  // its end, and kept to be opened again").
  const [isStartShown, setIsStartShown] = useState(false);
  const [line, setLine] = useState<StartLine>(null);
  // What the visitor has typed: held here, so a day on its way keeps it.
  const [text, setText] = useState("");
  // A city typed on the city word, while the intake reads it or once it could not play it.
  const [typedCity, setTypedCity] = useState<TypedCity | null>(null);
  // The reading under way: any other gesture, or a new reading, aborts it.
  const reading = useRef<AbortController | null>(null);
  const stopReading = useCallback(() => {
    reading.current?.abort();
    reading.current = null;
  }, []);
  useEffect(() => () => reading.current?.abort(), []);
  const stream = useDayStream();
  const { play, stop } = stream;
  /**
   * A day played here to its end is seen on this device from now on: the page's own by the
   * version the page has, any other written day by the version its answer said.
   */
  const playedVersion = hasStreamTaken(stream, asked?.request)
    ? (stream.written?.version ?? null)
    : null;
  // The shown day's id in the log, once its answer has named it, or the kept day's: its
  // address from then on. A merged day is the re-plan's: by its id when the answer named one,
  // and otherwise by its request, as a day asked again without one is, never the day before.
  // A day held while a changed word's whole day streams keeps its own, and so does a day drawn
  // whole from memory.
  const shownDayId = mergedShown
    ? mergedShown.dayId
    : (asked?.kept?.id ??
      asked?.record?.id ??
      (hasStreamTaken(stream, asked?.request) ? stream.dayId : null) ??
      held?.dayId ??
      null);
  const dayAddress = shownDayId !== null ? dayAddressOfId(shownDayId) : dayAddressOf(shownRequest);
  // A written day by the key this device knows it by, its address and the version on screen:
  // the page's own by the version the page has, any other by the version its answer said.
  const writtenKey = useMemo(() => {
    if (!asked || asked.kept || !isWrittenRequest(asked.request)) return null;
    const isFirst = first !== undefined && isSameRequest(asked.request, first);
    if (isFirst && firstSeenKey !== null) return firstSeenKey;
    return playedVersion !== null ? seenKeyOf(daySlugOf(asked.request), playedVersion) : null;
  }, [asked, first, firstSeenKey, playedVersion]);
  // The places chosen on the day on screen are kept under the same key as its seen mark: a day
  // the log keeps by its id, a written one by its version. A re-plan's day not yet named has
  // none, so nothing chosen on it is taken for the written day it came from.
  const picksKey =
    shownDayId !== null ? keptSeenKeyOf(shownDayId) : mergedShown === null ? writtenKey : null;
  const notePlayedThrough = useCallback(() => {
    // A day the log keeps, watched to its end here, opens whole at its address next time: one
    // written here, a re-plan's, or one from someone's link, by its id (`docs/decisions.md`,
    // "A written day's page is built whole, and plays only for a visitor who has not seen it").
    // Only an end the visitor saw counts: the list of days says how a day ended, read from the log,
    // whether or not anyone watched it.
    if (shownDayId !== null) markSeen(keptSeenKeyOf(shownDayId));
    if (writtenKey !== null) markSeen(writtenKey);
  }, [writtenKey, shownDayId]);
  // A day taking the page from the start screen pushes its address, so Back comes back to
  // the start screen; a day after a day replaces it, so a re-plan or a city changed is one
  // entry. The router keeps its tree, so nothing remounts and nothing is fetched.
  useEffect(() => {
    if (!isAddressed || isStartShown) return;
    const here = window.location.pathname;
    const entry = window.history.state as unknown;
    // The start screen with no day keeps its own entry.
    if (shownRequest !== null && (here !== dayAddress || !isDayEntry(entry))) {
      const isFromStart = here === START_ADDRESS && start !== undefined && !isDayEntry(entry);
      if (isFromStart) window.history.pushState(DAY_ENTRY, "", dayAddress);
      else window.history.replaceState(DAY_ENTRY, "", dayAddress);
    }
    document.title = dayTitleOf(shownRequest, shownEnergy, dayAddress);
  }, [isAddressed, isStartShown, dayAddress, start, shownRequest, shownEnergy]);
  useEffect(() => {
    if (!isAddressed) return undefined;
    const onPop = (event: PopStateEvent) => {
      const here = window.location.pathname;
      // The start screen's own entry, not a day's at the same address, as a city Lantern
      // writes no day for has.
      if (here === START_ADDRESS && start !== undefined && !isDayEntry(event.state)) {
        setIsStartShown(true);
        document.title = dayTitleOf(null);
      } else if (here === dayAddress) {
        setIsStartShown(false);
      } else {
        // Any other day of the visitor's: its own page opens it.
        window.location.assign(here);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isAddressed, start, dayAddress]);
  // A day with an id keeps its caveats on this device under it, and a re-plan merged into it, or
  // written whole from it, under its own id once it is the day on screen: so a re-plan the visitor
  // let go, never on screen, keeps none.
  // Once the visitor's days are forgotten, phrases said back before it are never kept again: each
  // set of phrases is noted with the count of forgets it was first said under.
  const forgets = useForgetCount();
  const saidUnder = useRef(new WeakMap<readonly string[], number>());
  useEffect(() => {
    const under = saidUnder.current.get(saidBack) ?? forgets;
    saidUnder.current.set(saidBack, under);
    if (shownDayId === null || saidBack.length === 0 || under < forgets) return;
    keepCaveats(browserStorage(), shownDayId, saidBack);
  }, [shownDayId, saidBack, forgets]);
  // Each day with an id is the visitor's own, kept in this browser as it is written.
  const yourDays = useYourDays();
  // The start screen lists them, so it asks how a day left while it was written ended.
  useDaysAskedAgain(start ? yourDays : NO_YOUR_DAYS, shownDayId);
  const startedAt = useRef<{ id: string; at: number } | null>(null);
  const shownStops = energiesSoFarOf(stream.partial).length;
  useEffect(() => {
    // A kept day's record is told by its page, from the log, and a merged one's as it merged.
    // Only the day the stream holds is told by it: a day held while a whole day streams is the
    // list's as it stood, and a whole day's version taken from memory is the list's already,
    // though the stream may still hold its request.
    if (
      shownDayId === null ||
      asked === null ||
      asked.kept !== null ||
      asked.isFromMemory ||
      mergedShown !== null ||
      !hasStreamTaken(stream, asked.request)
    )
      return;
    if (startedAt.current?.id !== shownDayId)
      startedAt.current = { id: shownDayId, at: Date.now() };
    const { at } = startedAt.current;
    keepDay({
      id: shownDayId,
      request: asked.request,
      startedAt: new Date(at).toISOString(),
      energies: energiesOfDay(stream.partial, stream.outcome),
      ending: endingOf(stream.outcome),
      seconds:
        stream.outcome?.kind === "complete" ? Math.round((Date.now() - at) / MS_PER_SECOND) : null,
    });
    // Kept again as each stop arrives and as the day ends, not on every frame of its text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownDayId, asked, shownStops, stream.outcome]);
  // Before the effects that play a day: an outcome that arrives as another day is played is
  // this day's ending, not its leaving.
  const events = useDayEvents(stream, isCounted);
  const { open: openDay, leave: leaveDay } = events;
  const [pending, setPending] = useState<Pending | null>(null);
  const [isHoldOver, setIsHoldOver] = useState(false);
  // Where the next day streams from: a lab that changes the pace changes the next day's,
  // never restarts the one on screen.
  const routeOf =
    sourceFor ??
    ((request: DayRequest, signature: string | null) =>
      routeSourceFor(request, {
        isLive,
        signature,
        seenKey: isWrittenRequest(request) ? seenKeyAt(daySlugOf(request)) : null,
        // A page opened at a kept day's address has no intake's signature: the route reads the
        // day's city from its own record by the id instead.
        keptId: kept?.id ?? null,
      }));
  const source = useRef(routeOf);
  useLayoutEffect(() => {
    source.current = routeOf;
  });
  // Every city an intake answer signed, by city and zone, so any day played there later, a
  // word changed, another reading or a retry, carries its signature without a second read.
  const signatures = useRef(new Map<string, string>());
  const remember = (answer: StartResult) => {
    for (const city of answer.signed ?? []) {
      signatures.current.set(signedKeyOf(city), city.signature);
    }
  };
  const sourceOf = useCallback(
    (request: DayRequest): DaySource =>
      source.current(request, signatures.current.get(signedKeyOf(request)) ?? null),
    [],
  );
  /** Plays a day from where it streams, opened as the visitor reached it. */
  const playFrom = useCallback(
    (source: DaySource, via: DayVia) => {
      openDay(source.request, via);
      play(source);
    },
    [openDay, play],
  );
  useEffect(() => {
    if (asked && !asked.isStreamed && asked.kept === null && asked.whole === null) {
      playFrom(sourceOf(asked.request), asked.via);
    }
  }, [asked, playFrom, sourceOf]);
  // A day drawn whole is opened, and ended, as one played to its end is, once it is the day
  // this visit shows.
  useEffect(() => {
    if (asked?.whole != null && !isAwaitingPlay) openDay(asked.request, asked.via, "complete");
  }, [asked, isAwaitingPlay, openDay]);
  // A kept day with its stops is opened by its own address and ended the way it was kept,
  // whether its pen writes it in or it comes whole. A notice in a day's place, for one not
  // finished, past its link or still being written, opens no day.
  useEffect(() => {
    const outcome = asked?.kept?.outcome;
    const hasStops =
      outcome?.kind === "complete" || (outcome?.kind === "cut" && outcome.itinerary !== null);
    if (!asked || !outcome || !hasStops) return;
    openDay(asked.request, "kept", outcome.kind);
  }, [asked, openDay]);
  useEffect(() => {
    if (pending) playFrom(sourceOf(pending.request), pending.via);
  }, [pending, playFrom, sourceOf]);
  useEffect(() => {
    if (!pending) return undefined;
    const timer = window.setTimeout(() => setIsHoldOver(true), START_WORDS_CAP_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  /** A new reading takes the question back: the visitor's day stops streaming behind it. */
  const dropPending = () => {
    if (!pending) return;
    setPending(null);
    stop();
    leaveDay();
  };

  // The visitor's day takes the page once Lantern's words for its headline have streamed
  // whole, or at the end of the hold with what it has, its header holding room for what has
  // arrived as on its own address: the line about the day takes its room as it comes, and the
  // frame waits for that room, so nothing drawn rides its growth. The start screen has no
  // chart whose place it would keep.
  const isPendingDue =
    pending !== null &&
    hasStreamTaken(stream, pending.request) &&
    (isHoldOver || isSentenceStreamed(stream.partial, stream.outcome));
  useEffect(() => {
    if (!pending || !isPendingDue) return undefined;
    // On the next frame, so the line saying the day back is drawn before it gives way.
    const turn = requestAnimationFrame(() => {
      setPending(null);
      setLine(null);
      setIsStartShown(false);
      setAsked((last) => ({
        request: pending.request,
        run: (last?.run ?? 0) + 1,
        via: pending.via,
        isChosen: true,
        unplaced: pending.unplaced,
        confirmed: pending.confirmed,
        isStreamed: true,
        isAfterExit: false,
        heldRoom: null,
        readings: pending.readings,
        playedReading: pending.playedReading,
        kept: null,
        isKeptWhole: false,
        whole: null,
        record: null,
        isFromMemory: false,
      }));
    });
    return () => cancelAnimationFrame(turn);
  }, [pending, isPendingDue]);

  // A changed word's proposal streams while the day on screen stays the visitor's, drawn as it
  // last streamed: a proposal that ends without one leaves it exactly as it was, its curve and
  // its words included, and its fork row says why.
  const [replanning, setReplanning] = useState<Replanning | null>(null);
  const [replanLine, setReplanLine] = useState<ReplanLine | null>(null);
  // A whole day a changed word wrote again, once whole, and the day before it.
  const [wholeTurn, setWholeTurn] = useState<WholeTurn | null>(null);
  // A word's proposal for its part of the day, streaming beside the day on screen.
  const replanStream = useReplanStream();
  const { play: playReplan, stop: stopReplan } = replanStream;
  const [targeted, setTargeted] = useState<Targeted | null>(null);
  // A part's proposal once whole, held beside the day until it is taken, and after.
  const [partFork, setPartFork] = useState<PartFork | null>(null);
  // A version folding away, held a moment while its rows fade where they stand.
  const [folding, setFolding] = useState<{ run: number; frame: ReplanFrame } | null>(null);
  /**
   * Holds a frame while the other version's rows in it fade, rising with the rows under them into
   * the room they give back, until they are off the curve, then lets it go: nothing to hold for a
   * frame with none of them on screen.
   */
  const foldOut = (run: number, frame: ReplanFrame | null) => {
    if (!frame || (frame.fading?.length ?? 0) === 0) return;
    setFolding({ run, frame });
  };
  /**
   * A proposal that ended without one: the change fails, its reason said in its fork row
   * (`ReplanControls.ending`), the facts line keeping its hint, no letter of it written over;
   * the proposal's rows already on screen fade out where they stand, and the day was never
   * touched.
   */
  const failReplan = (run: number, ending: ReplanEnding, frame: ReplanFrame | null) => {
    setReplanLine(null);
    setChange((last) => (last === null ? null : { ...last, status: "failed", ending }));
    if (frame !== null) {
      foldOut(run, { ...frame, proposed: [], replaced: [], fading: frame.proposed });
    }
  };
  // A day drawn whole keeps one outcome for as long as it stands, so every render draws the
  // same day.
  const wholeShown = asked?.whole ?? null;
  const whole = useMemo(
    (): EndedDay | null =>
      wholeShown === null
        ? null
        : {
            outcome: { kind: "complete", itinerary: wholeShown.itinerary },
            checks: wholeShown.checks,
          },
    [wholeShown],
  );
  // Until the stream has taken this run's request, what it holds is the last run's day, or
  // a re-plan's, while the day on screen is drawn as it was held.
  const keptShown = asked?.kept ?? null;
  const takenStream = hasStreamTaken(stream, asked?.request) ? stream : null;
  // In a memo, so React's lint reads the day drawn as settled for this render: taken from a
  // plain call, the handlers below that hold its frame, and stamp the time, read as render work.
  const shown = useMemo(
    () => shownDayOf({ merged: mergedShown, kept: keptShown, whole, stream: takenStream, held }),
    [mergedShown, keptShown, whole, takenStream, held],
  );
  const { partial, outcome, checks, isStreaming } = shown;
  // A written day this device has seen comes from the route whole at once: it lands whole,
  // as the page's own does, before a frame of it is drawn played.
  if (
    shown.isFromStream &&
    asked !== null &&
    stream.written?.isWhole === true &&
    stream.outcome?.kind === "complete" &&
    asked.whole === null
  ) {
    const itinerary = stream.outcome.itinerary;
    setAsked({ ...asked, run: asked.run + 1, whole: { itinerary, checks: stream.checks } });
  }
  // A play of the page's own written day that ends without the day complete, its connection
  // dropped or its route busy, gives way to that day whole, as a device that has seen it draws
  // it: the page holds it in its first HTML, so no ending is said for a day the page has
  // (`docs/decisions.md`, "A written day's page is built whole, and plays only for a visitor who
  // has not seen it"). A live day, and another written day played here, keep their endings.
  const pageOwnWhole =
    asked !== null &&
    asked.kept === null &&
    first !== undefined &&
    written !== undefined &&
    isSameRequest(asked.request, first)
      ? { itinerary: written.itinerary, checks: written.checks }
      : null;
  const wholeInPlace =
    shown.isFromStream && asked !== null && asked.whole === null
      ? wholeInPlaceOf(shown.outcome, pageOwnWhole)
      : null;
  if (asked !== null && wholeInPlace !== null) {
    setAsked({ ...asked, run: asked.run + 1, whole: wholeInPlace });
  }
  // Whether the day on screen ended without one, as last drawn, for the run played next.
  const endingPhase = phaseOf(outcome, endedDayOf(outcome));
  const isEndedWithoutDay = endingPhase === "failed" || endingPhase === "not-yet";
  const endedWithoutDay = useRef(isEndedWithoutDay);
  useLayoutEffect(() => {
    endedWithoutDay.current = isEndedWithoutDay;
  });
  /** The box of the header's room on screen, whose height a day played from it keeps. */
  const room = useRef<HTMLDivElement>(null);
  const isFirstImpression = useFirstImpression();
  // A copy each time, so playing the same request again is a run of its own. The same city
  // keeps the cities its name could mean, as a word changed or a replay plays it again;
  // another city drops them, unless the day is another of them (`played`), or an intake has
  // just read the city's (`readings`).
  const playDay = useCallback(
    (
      request: DayRequest,
      isChosen: boolean,
      { via = "word", unplaced = [], played, confirmed = NO_CONFIRMED, readings }: PlayOptions = {},
    ) => {
      // A city still being read for the city word gives way to the day played instead, and
      // so does a re-plan on its way.
      stopReading();
      setTypedCity(null);
      setReplanning(null);
      setReplanLine(null);
      setTargeted(null);
      stopReplan();
      // Another day: no change of this one's is told, or taken back, from now on.
      setChange(null);
      setWholeTurn(null);
      setPartFork(null);
      // A day the visitor plays from one with a chart keeps its header's room until its own
      // is known. A replay writes the day again from its empty frame, and a day played after
      // one that ended without a day has only a notice's room above no chart.
      const isHeld = isChosen && !endedWithoutDay.current;
      const heldRoom = isHeld ? (room.current?.getBoundingClientRect().height ?? null) : null;
      setAsked((last) => {
        const isSameCity =
          last?.request.city === request.city && last.request.timezone === request.timezone;
        const keepsReadings = played !== undefined || isSameCity;
        return {
          request: { ...request },
          run: (last?.run ?? 0) + 1,
          via,
          isChosen,
          unplaced,
          confirmed,
          isStreamed: false,
          isAfterExit: endedWithoutDay.current,
          heldRoom,
          readings: readings ?? (keepsReadings ? (last?.readings ?? NO_READINGS) : NO_READINGS),
          playedReading: played ?? (keepsReadings ? (last?.playedReading ?? null) : null),
          kept: null,
          isKeptWhole: false,
          whole: wholeOf(request),
          record: null,
          isFromMemory: false,
        };
      });
    },
    [stopReading, stopReplan, wholeOf],
  );

  /** A change of a word, from the day on screen as it stands to the answer chosen. */
  const changeOf = (
    ask: ChangeAsk,
    key: AssumableFactKey,
    reach: WordChange["reach"],
    windows: readonly ReplanWindow[],
  ): WordChange | null => {
    if (!asked) return null;
    const day = endedDayOf(outcome);
    const fromValue = day ? day.facts[key].value : (shownRequest?.[key] ?? null);
    const toValue = ask.request[key];
    if (toValue === null) return null;
    const from = wordLabelOf(key, fromValue, isFirstImpression);
    return {
      run: asked.run,
      word: key,
      from,
      to: ask.word,
      fromValue,
      toValue,
      reach,
      status: "writing",
      windows,
      isCompared: true,
      ask,
    };
  };
  /** How many re-plans the day on screen has taken: the next one's ids start with the next. */
  const shownRound = mergedShown?.round ?? asked?.kept?.round ?? asked?.record?.round ?? 0;
  /**
   * The day on screen as it stands, to be taken back whole from memory once a changed word has
   * written the whole day again: its words, places, checks and address. None for a day not
   * written to its end, which could not be shown again as it was.
   */
  const dayBeforeOf = (): Asked | null => {
    if (!asked || outcome?.kind !== "complete") return null;
    return {
      ...asked,
      request: shownRequest ?? asked.request,
      isChosen: false,
      isAfterExit: false,
      kept: null,
      isKeptWhole: false,
      whole: { itinerary: outcome.itinerary, checks },
      record: { id: shownDayId, round: shownRound },
      isFromMemory: true,
    };
  };
  /**
   * A changed word's whole day, asked for while the day on screen holds its place: its facts
   * line says the day is being re-planned, and the day before stays on screen, its rows and
   * words, until the new one is whole, and then until the visitor takes it.
   */
  const replanWholeDay = (ask: ChangeAsk, changed?: AssumableFactKey) => {
    if (!asked) return;
    stopReading();
    setTypedCity(null);
    setHeldDay({ run: asked.run, partial, outcome, checks, dayId: shownDayId });
    setReplanning({
      request: { ...ask.request },
      run: asked.run,
      unplaced: saidBack,
      word: ask.word,
      at: Date.now(),
      before: dayBeforeOf(),
    });
    setReplanLine({ run: asked.run, text: replanningOf(ask.word) });
    setWholeTurn(null);
    setChange(changed === undefined ? null : changeOf(ask, changed, "whole", [WHOLE_DAY_WINDOW]));
  };

  // A word proposes only the part of a finished day it shaped, streaming beside the day on
  // screen, the rest of the day where it stands (`docs/decisions.md`, "A changed word proposes its
  // part beside the day, and the visitor takes it"). A word no stop names, a day not finished, or a
  // word whose windows hold most of the day, proposes the whole day, as the route also says.
  const replan = (ask: ChangeAsk) => {
    const { request, changed, shown } = ask;
    const key = changed === "energy" ? undefined : changed;
    const day = outcome?.kind === "complete" ? outcome.itinerary : null;
    if (!asked || day === null || key === undefined) return replanWholeDay(ask, key);
    const plan = replanPlanOf(day, request, key);
    if (plan.kind === "full") return replanWholeDay(ask, key);
    // A word that changes no stop the day keeps alone, before it asks here (`DayStage`).
    if (plan.kind === "word") return undefined;
    // Where the route reads the day: the log, by the id its answer named, or a written day's
    // file, by its address.
    const basis: ReplanBasisRef | null =
      shownDayId !== null
        ? { kind: "kept", id: shownDayId }
        : shownRequest !== null && isWrittenRequest(shownRequest)
          ? { kind: "written", slug: daySlugOf(shownRequest) }
          : null;
    // The route requires the day's own count plus one: a kept day's from its record, so a
    // re-plan opened at its address or reloaded is re-planned in part.
    const round = shownRound + 1;
    const routeAsk = {
      itinerary: day,
      request: { ...request },
      changed: key,
      windows: plan.windows,
      round,
      // What the visitor sees in place of the plan, so the part re-planned and the new line
      // are written around it (`docs/decisions.md`, "A re-plan reads its day from the server's own
      // records").
      picks: picksOf(day, shown),
    };
    const source = replanSourceFor({ ...routeAsk, basis });
    if (source === null) return replanWholeDay(ask, key);
    stopReading();
    setTypedCity(null);
    setTargeted({
      run: asked.run,
      word: ask.word,
      request: routeAsk.request,
      basis: source.basis,
      round,
      fromId: shownDayId,
      room: room.current?.getBoundingClientRect().height ?? null,
      at: Date.now(),
      merged: mergedShown,
    });
    setReplanLine({ run: asked.run, text: replanningPartOf(ask.word, key) });
    setWholeTurn(null);
    setChange(changeOf(ask, key, "part", windowsOf(day, plan.windows)));
    playReplan(source);
  };
  const targetedShown = isThisRun(targeted, asked) ? targeted : null;
  // The re-plan's stream knows a re-plan by its basis, as the day's stream knows a day by its
  // request: by the object itself (`hasStreamTaken`).
  const isTargetedRead = targetedShown !== null && replanStream.basis === targetedShown.basis;
  // Drawn beside the day once the route has answered with the proposal's stream: a word it sends
  // on to the whole day draws no part beside it.
  const isTargetedAnswered = isTargetedRead && replanStream.isAnswered;
  const replanFrame = useMemo(
    () =>
      isTargetedAnswered && targetedShown !== null
        ? replanFrameOf(targetedShown.basis, replanStream.partial ?? {})
        : null,
    [isTargetedAnswered, targetedShown, replanStream.partial],
  );
  // The route sends a word whose windows hold most of the day on to the whole day's proposal.
  if (targetedShown !== null && isTargetedRead && replanStream.isWholeDay) {
    setTargeted(null);
    // Its reading was stopped as the re-plan began, so only the day's state changes here.
    setHeldDay({ run: targetedShown.run, partial, outcome, checks, dayId: shownDayId });
    setReplanning({
      request: targetedShown.request,
      run: targetedShown.run,
      unplaced: saidBack,
      word: targetedShown.word,
      at: targetedShown.at,
      before: dayBeforeOf(),
    });
    setReplanLine({ run: targetedShown.run, text: replanningOf(targetedShown.word) });
    if (changeShown !== null) {
      setChange({ ...changeShown, reach: "whole", windows: [WHOLE_DAY_WINDOW] });
    }
  }
  // As soon as the proposal's answer names its id, it is one of the visitor's days, a row of its
  // own while it is written: a reload or a closed tab never loses a day the visitor paid for
  // (P13). Whole, it keeps its row, taken or not; ended without one, its row goes.
  const targetedId = isTargetedRead ? replanStream.dayId : null;
  // A re-plan that ended without a day, its row in the visitor's list to go.
  const [dropped, setDropped] = useState<string | null>(null);
  useEffect(() => {
    if (dropped !== null) forgetDay(dropped);
  }, [dropped]);
  useEffect(() => {
    if (targetedShown === null || targetedId === null) return;
    keepDay({
      id: targetedId,
      request: targetedShown.request,
      startedAt: new Date(targetedShown.at).toISOString(),
      energies: [],
      ending: "writing",
      seconds: null,
    });
  }, [targetedShown, targetedId]);
  // A proposal is all or nothing: whole, it stands beside the day until the visitor takes it;
  // otherwise the day stays exactly as it was, and its fork row says why.
  const targetedEnding = isTargetedRead ? replanStream.outcome : null;
  if (targetedShown !== null && targetedEnding !== null) {
    setTargeted(null);
    setReplanLine(null);
    if (targetedEnding.kind === "complete") {
      const mergedChecks = { ...checks, ...replanStream.checks };
      const after: Merged = {
        run: targetedShown.run,
        request: targetedShown.request,
        outcome: targetedEnding,
        checks: mergedChecks,
        round: targetedShown.round,
        dayId: replanStream.dayId,
        fromId: targetedShown.fromId,
        startedAt: new Date(targetedShown.at).toISOString(),
        changed: targetedShown.basis.changed,
      };
      setPartFork({
        run: targetedShown.run,
        basis: targetedShown.basis,
        before: targetedShown.merged,
        after,
      });
      // Its new stops counted now, by the re-plan's ids: those at the part's own places at
      // another hour by which way they moved, the rest as new.
      const { stops } = targetedEnding.itinerary;
      const written = newStopsOf(stops, [targetedShown.basis.idPrefix]).size;
      const moves = [...movedStopsOf(targetedShown.basis, stops).values()];
      const later = moves.filter((move) => move === "later").length;
      const places: ReplanPlaces = {
        added: written - moves.length,
        same: null,
        later,
        earlier: moves.length - later,
      };
      const beforeStops = targetedShown.basis.itinerary.stops;
      if (changeShown !== null) {
        setChange({
          ...changeShown,
          status: "proposed",
          isCompared: true,
          receipts: {
            proposal: receiptOf(changeShown, "part", beforeStops, stops, places),
            before: receiptOf(
              { word: changeShown.word, to: changeShown.from },
              "part",
              stops,
              beforeStops,
              null,
            ),
          },
        });
      }
    } else {
      failReplan(targetedShown.run, targetedEnding.kind, replanFrame);
      if (isNoDayOf(targetedEnding.kind)) setDropped(targetedId);
    }
  }
  // A proposal whose merge will drop one of its new stops is lost already, however far it has
  // to go: the frame knows it by the merge's own rule (`ReplanFrame.isLost`), the stream is let
  // go, and the fork fails as for one that ended "invalid", which the server's merge then ends
  // it as.
  const [lostBasis, setLostBasis] = useState<ReplanBasis | null>(null);
  if (targetedShown !== null && targetedEnding === null && replanFrame?.isLost === true) {
    setTargeted(null);
    setLostBasis(targetedShown.basis);
    failReplan(targetedShown.run, "invalid", replanFrame);
    setDropped(targetedId);
  }
  // Its stream let go once the page has let it go: the server still writes it to its end, where
  // its merge drops the stop and ends it "invalid", so it is no day of the visitor's.
  const lostStreaming = replanStream.basis === lostBasis ? lostBasis : null;
  useEffect(() => {
    if (lostStreaming !== null) stopReplan();
  }, [lostStreaming, stopReplan]);
  // The proposal is one of the visitor's days once whole: a row of its own, taken or not.
  useEffect(() => {
    const after = partFork?.after;
    if (after?.dayId == null || after.outcome.kind !== "complete") return;
    keepDay({
      id: after.dayId,
      request: after.request,
      startedAt: after.startedAt,
      energies: shownEnergiesOf(after.outcome.itinerary),
      ending: "written",
      seconds: Math.round((Date.now() - Date.parse(after.startedAt)) / MS_PER_SECOND),
    });
  }, [partFork]);
  // A part's fork once whole: the two versions as the chart draws them, the day's own and the
  // other beside it while it is compared.
  const partForkShown = isThisRun(partFork, asked) ? partFork : null;
  const versionsOf = (fork: PartFork) => {
    const before = fork.basis.itinerary.stops;
    const after = fork.after.outcome.kind === "complete" ? fork.after.outcome.itinerary.stops : [];
    return { before, after };
  };
  const forkFrameShown = useMemo((): ReplanFrame | null => {
    if (partForkShown === null || changeShown === null || !changeShown.isCompared) return null;
    if (changeShown.status === "failed" || changeShown.status === "writing") return null;
    const { before, after } = versionsOf(partForkShown);
    const isTaken = changeShown.status === "taken";
    return forkFrameOf(
      isTaken ? after : before,
      isTaken ? before : after,
      partForkShown.basis.idPrefix,
      changeShown.windows,
      "proposed",
    );
  }, [partForkShown, changeShown]);
  // A version folding away is held while its rows fade, until the chart says their stops are
  // off the curve: a long stretch of curve leaves slower than the rows fade, and letting it go
  // sooner snapped the curve's start 25 px on a phone. Its rows hold no room meanwhile: the rows
  // under them rise into it from the tap (`DayRows`).
  const foldingShown = isThisRun(folding, asked) ? folding.frame : null;
  const letFoldingGo = useCallback(() => setFolding(null), []);
  useEffect(() => {
    if (folding === null) return undefined;
    // Only should the chart never say so.
    const gone = window.setTimeout(letFoldingGo, isReducedMotion ? 0 : FOLDING_LONGEST_MS);
    return () => window.clearTimeout(gone);
  }, [folding, isReducedMotion, letFoldingGo]);
  useEffect(() => {
    if (replanning) playFrom(sourceOf(replanning.request), "word");
  }, [replanning, playFrom, sourceOf]);
  const replanned = hasStreamTaken(stream, replanning?.request) ? stream : null;
  // The whole day asked again, as one of the visitor's days, from when its answer names it.
  const replannedId = replanned?.dayId ?? null;
  useEffect(() => {
    if (replanning === null || replannedId === null) return;
    // The row says when it was asked, and keeps saying so once the day is whole.
    startedAt.current = { id: replannedId, at: replanning.at };
    keepDay({
      id: replannedId,
      request: replanning.request,
      startedAt: new Date(replanning.at).toISOString(),
      energies: [],
      ending: "writing",
      seconds: null,
    });
  }, [replanning, replannedId]);
  const replanEnding = replanned?.outcome ?? null;
  // A whole day is proposed only written to its end: one that ends any other way, cut with some
  // of its stops among them, leaves the day as it was, as a part's proposal does.
  const isReplanFailed = replanEnding !== null && replanEnding.kind !== "complete";
  if (replanning !== null && replanEnding !== null && isReplanFailed) {
    if (isNoDayOf(replanEnding.kind)) setDropped(replannedId);
    setReplanning(null);
    setReplanLine(null);
    setChange((last) =>
      last === null ? null : { ...last, status: "failed", ending: replanEnding.kind },
    );
  }
  // One written to its end is the day as it would be taken, drawn whole from memory when it is:
  // until then the day before stays on screen, its rows and its words, and the new day keeps a
  // row of its own among the visitor's days. A day not written to its end, cut or still being
  // written, has none to take back, so the new day takes the page as it lands, as no fork.
  const isReplanDue = replanned !== null && replanEnding?.kind === "complete";
  const replannedChecks = replanned?.checks ?? NO_CHECKS;
  useEffect(() => {
    if (!replanning || !isReplanDue || !asked || replanEnding?.kind !== "complete") return;
    const turn = requestAnimationFrame(() => {
      const landed: Asked = {
        request: replanning.request,
        run: asked.run + 1,
        via: "word",
        isChosen: true,
        unplaced: replanning.unplaced,
        confirmed: NO_CONFIRMED,
        isStreamed: true,
        isAfterExit: false,
        heldRoom: room.current?.getBoundingClientRect().height ?? null,
        // The same city: the cities its name could mean stay.
        readings: asked.readings,
        playedReading: asked.playedReading,
        kept: null,
        isKeptWhole: false,
        whole: { itinerary: replanEnding.itinerary, checks: replannedChecks },
        // A day written again whole is a new day of the log's: it has taken no re-plan.
        record: { id: replannedId, round: 0 },
        isFromMemory: false,
      };
      if (replannedId !== null) {
        keepDay({
          id: replannedId,
          request: replanning.request,
          startedAt: new Date(replanning.at).toISOString(),
          energies: shownEnergiesOf(replanEnding.itinerary),
          ending: "written",
          seconds: Math.round((Date.now() - replanning.at) / MS_PER_SECOND),
        });
      }
      setReplanning(null);
      setReplanLine(null);
      const { before } = replanning;
      if (before === null) {
        setHeldDay(null);
        setAsked(landed);
        setChange(null);
        return;
      }
      setWholeTurn({ before, after: { ...landed, isChosen: false, isFromMemory: true } });
      const beforeStops = before.whole?.itinerary.stops ?? [];
      const afterStops = replanEnding.itinerary.stops;
      const places = placesKeptOf(beforeStops, afterStops);
      setChange((last) =>
        last === null
          ? null
          : {
              ...last,
              status: "proposed",
              isCompared: false,
              receipts: {
                proposal: receiptOf(last, "whole", beforeStops, afterStops, places),
                before: receiptOf(
                  { word: last.word, to: last.from },
                  "whole",
                  afterStops,
                  beforeStops,
                  null,
                ),
              },
            },
      );
    });
    return () => cancelAnimationFrame(turn);
  }, [replanning, isReplanDue, asked, replanEnding, replannedChecks, replannedId]);

  const roomHeight = () => room.current?.getBoundingClientRect().height ?? null;
  /** A frame of the fork's two versions with the other one fading out where it stands. */
  const foldedFrameOf = (frame: ReplanFrame): ReplanFrame => ({
    ...frame,
    proposed: [],
    replaced: [],
    fading: frame.rows.flatMap((row) => (row.source === "proposed" ? [row.stop.id] : [])),
  });
  /**
   * Shows one of a part's two versions as the day, in the run's place, the other folding away
   * where it stands: its rows keep their ids, so nothing is drawn anew, and the taken one's
   * address is the page's.
   */
  const showPart = (fork: PartFork, side: ForkSide) => {
    if (changeShown === null) return;
    const { before, after } = versionsOf(fork);
    const isTaken = side === "to";
    setMerged(isTaken ? fork.after : fork.before);
    foldOut(
      fork.run,
      forkFrameOf(
        isTaken ? after : before,
        isTaken ? before : after,
        fork.basis.idPrefix,
        changeShown.windows,
        "fading",
      ),
    );
    setChange({ ...changeShown, status: isTaken ? "taken" : "left", isCompared: false });
    if (isTaken && fork.after.dayId !== null) markSeen(keptSeenKeyOf(fork.after.dayId));
  };
  /**
   * Shows one of a whole day's two versions, drawn whole from memory as a run of its own: its
   * words, places, checks and address, with no model call.
   */
  const showWhole = (turn: WholeTurn, side: ForkSide) => {
    if (!asked || changeShown === null) return;
    const run = asked.run + 1;
    const day = side === "to" ? turn.after : turn.before;
    setAsked({ ...day, run, heldRoom: roomHeight() });
    setChange({ ...changeShown, run, status: side === "to" ? "taken" : "left" });
    const id = day.record?.id ?? null;
    if (side === "to" && id !== null) markSeen(keptSeenKeyOf(id));
  };
  /**
   * One of the fork's answers chosen, on its row, its bead or its word's list: the other
   * version taken as the day, or, the answer already the day's, the other folded away. Whether
   * anything changed.
   */
  const chooseSide = (side: ForkSide): boolean => {
    if (changeShown === null) return false;
    const { status } = changeShown;
    if (status === "writing" || status === "failed") return false;
    const chosen: ForkSide = status === "taken" ? "to" : "from";
    if (side === chosen) {
      if (status !== "proposed" && !changeShown.isCompared) return false;
      if (partForkShown !== null && forkFrameShown !== null) {
        foldOut(partForkShown.run, foldedFrameOf(forkFrameShown));
      }
      setChange({
        ...changeShown,
        status: status === "proposed" ? "left" : status,
        isCompared: false,
      });
      return true;
    }
    if (partForkShown !== null) showPart(partForkShown, side);
    else if (wholeTurn !== null) showWhole(wholeTurn, side);
    else return false;
    return true;
  };
  /** Draws the version not on screen beside the day again, or folds it away. */
  const compareFork = () => {
    if (changeShown === null || partForkShown === null) return;
    if (changeShown.status !== "taken" && changeShown.status !== "left") return;
    if (changeShown.isCompared && forkFrameShown !== null) {
      foldOut(partForkShown.run, foldedFrameOf(forkFrameShown));
    }
    setChange({ ...changeShown, isCompared: !changeShown.isCompared });
  };
  /**
   * The fork settles as the next word changes (`docs/decisions.md`, "A changed word proposes its
   * part beside the day, and the visitor takes it"): the version on screen stays the day, the
   * other stays among the visitor's days as a row of its own, and its rows fold away. A word
   * re-picked settles it at once, with no fold: the re-picked stops are the ones then shown, as
   * the curve is told of them, so no row of the other version stands among them meanwhile.
   */
  const settleFork = (isFolded = true) => {
    if (isFolded && changeShown !== null && partFork !== null && changeShown.isCompared) {
      const run = changeShown.run;
      foldOut(run, forkFrameShown === null ? null : foldedFrameOf(forkFrameShown));
    }
    if (!isFolded) setFolding(null);
    setChange(null);
    setPartFork(null);
    setWholeTurn(null);
  };

  /** A word changed in the sentence: the fork before it settles, and the word proposes anew. */
  const changeWord = (request: DayRequest, word: string, changed: FactKey, shown: ShownPlaces) => {
    settleFork();
    replan({ request, word, changed, shown });
  };
  /** The same change asked again, after a failure Lantern can retry. */
  const askAgain = () => {
    if (changeShown?.status !== "failed") return;
    const { ask } = changeShown;
    changeWord(ask.request, ask.word, ask.changed, ask.shown);
  };
  const changeStatus = changeShown?.status;
  const replanControls: ReplanControls = {
    status: changeStatus ?? "idle",
    change:
      changeShown === null
        ? null
        : { word: changeShown.word, from: changeShown.from, to: changeShown.to },
    reach: changeShown?.reach ?? null,
    ending: changeStatus === "failed" ? (changeShown?.ending ?? "invalid") : null,
    written: changeStatus === "writing" && replanned !== null ? writtenOf(replanned.partial) : null,
    receipt:
      changeShown?.receipts === undefined
        ? null
        : changeStatus === "taken"
          ? changeShown.receipts.before
          : changeShown.receipts.proposal,
    windows: changeShown?.windows ?? NO_WINDOWS,
    isCompared: changeShown?.isCompared ?? false,
    choose: chooseSide,
    compare: compareFork,
    askAgain,
  };

  // The controls as they now stand, for a page around the day that asks after a render.
  const controlsNow = useRef(replanControls);
  useLayoutEffect(() => {
    controlsNow.current = replanControls;
  });
  useImperativeHandle(
    ref,
    () => ({
      // The same day again, reached as it was.
      replay: () => {
        if (asked) playDay(asked.request, false, { via: asked.via });
      },
      replan: () => controlsNow.current,
    }),
    [asked, playDay],
  );

  /**
   * Reads a text, any reading under way stopped for it. On the start screen the visitor's day on
   * its way gives way to it, and the line says "Reading" while it takes a frame or more: with live
   * generation off the stand-in answers at once, and its "Reading" would flash past. Null when
   * another gesture took its place. Every city the answer signed is kept.
   */
  const readText = async (
    text: string,
    read: StartReader,
    isSaid: boolean,
    answering?: CityQuestion,
  ): Promise<StartResult | null> => {
    stopReading();
    if (isSaid) dropPending();
    const controller = new AbortController();
    reading.current = controller;
    const saying = isSaid
      ? requestAnimationFrame(() => setLine({ kind: "reading", answering }))
      : null;
    // A reader that fails is a reading that is unavailable, as the contract answers it.
    const answer = await read(text, controller.signal).catch((): StartResult => ({
      kind: "unavailable",
    }));
    if (saying !== null) cancelAnimationFrame(saying);
    if (controller.signal.aborted) return null;
    reading.current = null;
    remember(answer);
    // Only the intake's answers count: with live generation off its stand-in reads in the page.
    if (isLive) events.send({ kind: "intake-ended", outcome: answer.kind });
    return answer;
  };

  /** A line that can write no day: the answer's own, or "not yet" for one that could not run. */
  const sayNoDay = (kind: "refused" | "limited" | "unavailable") =>
    setLine({ kind: kind === "unavailable" ? "not-yet" : kind });

  const plan = async (text: string) => {
    if (!start) return;
    if (line?.kind === "question") return answerQuestion(text, line);
    const read = await readText(text, start.read, true);
    if (read === null) return;
    if (read.kind === "request") {
      const playedReading = read.readings[0]?.placeId ?? null;
      return ask(read.request, {
        via: "typed",
        unplaced: read.unplaced,
        readings: read.readings,
        playedReading,
        confirmed: read.confirmed,
      });
    }
    if (read.kind === "question") {
      const { words, readings, unplaced } = read;
      // The field now asks for the city: it starts again empty.
      setText("");
      return setLine({
        kind: "question",
        words,
        readings,
        unplaced,
      });
    }
    sayNoDay(read.kind);
  };

  /**
   * The answer to "in …?": a city alone, read with the words already understood. A written city, or
   * any city with live generation off, is the request at once (`requestFor`). Once live, any other
   * city is read by the intake, which finds its zone and signs it; the words already read stay, and
   * a name that could mean several cities asks which, as the first text did.
   */
  const answerQuestion = async (
    text: string,
    question: Extract<StartLine, { kind: "question" }>,
  ) => {
    if (!start) return;
    if (!isLive || writtenRequestFor(text) !== null) {
      return ask(
        requestFor(
          text,
          question.words,
          standInZoneOf(Intl.DateTimeFormat().resolvedOptions().timeZone),
          new Date(),
        ),
        { via: "typed", unplaced: question.unplaced, answering: question },
      );
    }
    const read = await readText(text, start.read, true, question);
    if (read === null) return;
    if (read.kind === "request") {
      const { date, ...words } = question.words;
      const { city, citySource, timezone } = read.request;
      const request = { ...words, city, citySource, timezone, date: date ?? read.request.date };
      const playedReading = read.readings[0]?.placeId ?? null;
      return ask(request, {
        via: "typed",
        unplaced: question.unplaced,
        readings: read.readings,
        playedReading,
        answering: question,
      });
    }
    if (read.kind === "question") {
      setText("");
      // The city is still open: the same words, asking among the cities this name could be.
      return setLine({ ...question, readings: read.readings });
    }
    sayNoDay(read.kind);
  };

  /**
   * A city typed on the city word that Lantern has not written, once live: read by the intake
   * first, as the start screen's text is, then played with the day's words in its zone. A
   * name that could mean several cities plays the likeliest as Lantern's assumption, with
   * the others on the city word, since the word has no question of its own. The word's list
   * says it is read, and a city the intake could not read plays no day: the list says why,
   * and the day on screen stays.
   */
  const chooseTypedCity = async (typed: DayRequest) => {
    setTypedCity({ name: typed.city, failure: null });
    const read = await readText(typed.city, start?.read ?? readIntakeRoute, false);
    if (read === null || !asked) return;
    const { unplaced } = asked;
    const played = playedCityOf(read);
    if (played === null) {
      return setTypedCity({ name: typed.city, failure: typedCityFailureOf(read.kind) });
    }
    const { city, citySource, timezone, readings } = played;
    const date = dateInZone(typed, timezone, new Date());
    playDay({ ...typed, city, citySource, timezone, date }, true, {
      unplaced,
      readings,
      played: readings[0]?.placeId,
    });
  };

  /**
   * One of the cities a shared name could be: the words read take its zone and today. The
   * others stay with the day, so the city word can change it to another of them later.
   */
  const chooseReading = (reading: CityReading) => {
    if (line?.kind !== "question") return;
    const request = requestOf(line.words, reading, new Date());
    ask(request, {
      via: "typed",
      unplaced: line.unplaced,
      readings: line.readings,
      playedReading: reading.placeId,
      answering: line,
    });
  };

  /**
   * The day asked for, by the visitor's words or a written city's: it starts streaming while
   * the start screen says it back, then is written where the question was. A reading under
   * way is dropped for it, and a day already on its way gives way to it, unless it is the
   * same day pressed again. It was reached by the visitor's words, or a written city pressed.
   */
  const ask = (
    asked: DayRequest,
    {
      via,
      unplaced = [],
      readings = NO_READINGS,
      playedReading = null,
      confirmed = NO_CONFIRMED,
      answering,
    }: AskOptions,
  ) => {
    // A written day, pressed or typed, is asked on the date it is shown on.
    const request = shownRequestOf(asked, new Date());
    stopReading();
    if (pending && isSameRequest(pending.request, request)) return;
    setIsHoldOver(false);
    setPending({ request: { ...request }, via, unplaced, confirmed, readings, playedReading });
    // Said back as on its way only when it is: with live generation on, or a day Lantern has
    // written. With it off any other is answered at once that no new day is written, and the line
    // keeps reading until then.
    if (isLive || isWritten(start, request)) setLine({ kind: "writing", request, answering });
    // The page comes back to its top while the day is on its way, so the day's header is
    // written in view, where the question was, even from a phone scrolled to the starts.
    window.scrollTo({ top: 0, behavior: isReducedMotion ? "instant" : "smooth" });
  };

  /**
   * One of the visitor's days, pressed on the start screen: the day still in memory comes
   * back as it stands, as Forward brings it; any other opens at its own address.
   */
  const openYourDay = (id: string) => {
    if (id === shownDayId) {
      window.history.pushState(DAY_ENTRY, "", dayAddress);
      setIsStartShown(false);
    } else {
      window.location.assign(dayAddressOfId(id));
    }
  };

  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      {asked && (
        // Kept under the start screen after Back, writing on and as the visitor left it, its
        // energy, open stop and curve included, so Forward brings it back as it stands: out
        // of the page's flow at the size it had, unseen and out of reach.
        <div
          className={isStartShown ? BEHIND_START_CLASSES : undefined}
          inert={isStartShown}
          aria-hidden={isStartShown || undefined}
        >
          <DayStage
            // A new run remounts the day, so it is written from the empty frame.
            key={asked.run}
            request={mergedShown?.request ?? asked.request}
            // A day put back from memory is drawn anew, header and all: the word changed takes
            // the focus it had as its answer was chosen.
            focusedWord={
              mergedShown?.changed ??
              (asked.isFromMemory && changeShown !== null ? changeShown.word : null)
            }
            partial={partial}
            outcome={outcome}
            isStreaming={isStreaming}
            isChosen={asked.isChosen}
            isAfterExit={asked.isAfterExit}
            isFromStart={asked.isStreamed && asked.kept === null}
            isDrawnWhole={asked.whole !== null || asked.isKeptWhole}
            onPlayedThrough={notePlayedThrough}
            picksKey={picksKey}
            placeHint={asked.request === first ? firstPlace : undefined}
            keptNotice={asked.kept?.notice ?? null}
            checks={checks}
            // A day at the start screen's address has no link that would open it.
            address={dayAddress === START_ADDRESS ? null : dayAddress}
            replanFrame={replanFrame ?? forkFrameShown ?? foldingShown}
            onReplanFaded={letFoldingGo}
            replanRoom={targetedShown?.room ?? null}
            heldRoom={asked.heldRoom}
            roomRef={room}
            unplaced={saidBack}
            confirmed={asked.confirmed}
            readings={asked.readings}
            playedReading={asked.playedReading}
            onChooseReading={(request, reading) =>
              playDay(request, true, { unplaced: saidBack, played: reading.placeId })
            }
            onChooseCity={isLive ? (typed) => void chooseTypedCity(typed) : undefined}
            isLive={isLive}
            onEnergyPicked={(energy) => {
              setRepicked({ run: asked.run, energy });
              if (!replanning) setReplanLine(null);
              // A word re-picked settles the fork, as any changed word does, at once.
              settleFork(false);
            }}
            // Once live, a changed word asks for the day again with it, under the same city's
            // signature, while the day holds its place, and plays it as a day chosen from the
            // city word: its said-back phrases stay. With live generation off the word says what it
            // would have re-planned.
            onReplan={isLive ? changeWord : undefined}
            isReplanning={isThisRun(replanning, asked) || targetedShown !== null}
            // A changed word's fork, while Lantern writes its proposal and after: either version
            // is taken from memory until the next word changes.
            replan={replanControls}
            replanLine={isThisRun(replanLine, asked) ? replanLine.text : null}
            // A written day chosen from a list plays on the date it is shown on.
            onPlay={(request) => playDay(shownRequestOf(request, new Date()), true)}
            onOpenWritten={(request) =>
              playDay(shownRequestOf(request, new Date()), true, { via: "pressed" })
            }
            // Asked again as it was asked, and counted as reached the same way: its said-back
            // phrases and confirmed words stay, and as after choosing a written day, the focus
            // comes back to its city word.
            onRetry={() =>
              playDay(asked.request, true, {
                via: asked.via,
                unplaced: saidBack,
                confirmed: asked.confirmed,
              })
            }
            typedCity={typedCity}
            // Closed while a typed city is read, the list stops the reading.
            onTypedCityDropped={() => {
              stopReading();
              setTypedCity(null);
            }}
            onEvent={events.send}
            onDayAct={events.act}
            onDayAnswer={events.answer}
            // The chart's invitation to drag shows once a page load, not on each day that lands
            // here nor again after a client navigation away and back (`useInvitation`).
            invitationMemory={PAGE_INVITATION_MEMORY}
          />
        </div>
      )}
      {(asked === null || isStartShown) && start && (
        // The day's own page, so the question stands where the day's header will be written,
        // at least a screen tall, so its last line stands at the foot of the screen.
        <div className="mx-auto flex min-h-svh max-w-page flex-col px-4 md:px-10 lg:px-16">
          <main className="grow">
            <StartHeader
              excerpt={start?.excerpt ?? null}
              starts={starts}
              line={line}
              text={text}
              onTextChange={setText}
              isLive={isLive}
              // The city is asked for only after the visitor's text, so the field takes the focus.
              isCityFocused={line?.kind === "question"}
              onPlan={(text) => void plan(text)}
              onChooseWritten={(request) => ask(request, { via: "pressed" })}
              onChooseReading={chooseReading}
              yourDays={{
                days: yourDays,
                onOpen: (day) => openYourDay(day.id),
                onForget: forgetDays,
              }}
              // Back from a day: the start screen's headline takes the focus the day had.
              isReturnedTo={isStartShown}
            />
          </main>
          {/* Lantern's own links, and no source: the start screen shows no place. Outside
                the main, so it is the page's contentinfo. Drawn with the starts, once the
                visitor's days are read, so they never push it down the screen. */}
          {isHydrated && <FootLine className="mt-12 pb-8" />}
        </div>
      )}
    </MotionConfig>
  );
}

/**
 * The state was set on the run on screen. Each run has its own number, and state that names
 * its run (a change, a merged or held day, a re-plan, a line) is drawn only on that run: what
 * a run left behind never shows on the next one, though nothing cleared it.
 */
function isThisRun<State extends { run: number }>(
  state: State | null,
  asked: Asked | null,
): state is State {
  return state !== null && asked !== null && state.run === asked.run;
}

/**
 * The stream has taken this request: it plays, or last played, this very object. The stream
 * knows requests, not runs, and every play copies its request (`playDay`, `ask`), so a day
 * played again is told from the one before though every word of it is the same.
 */
function hasStreamTaken(
  stream: Pick<DayStream, "request">,
  request: DayRequest | undefined,
): boolean {
  return request !== undefined && stream.request === request;
}

/**
 * Whether a re-plan's ending leaves the visitor no day of it: every ending but a whole one and a
 * lost connection, after which the server still writes it to its end (`docs/decisions.md`, "A day
 * is written to its end, and kept to be opened again").
 */
function isNoDayOf(ending: DayOutcome["kind"]): boolean {
  return ending !== "disconnected" && ending !== "complete";
}

/** The day a page lands on, played from the route on arrival: its address was opened. */
function landingOf(request: DayRequest): Asked {
  return {
    request,
    run: 0,
    via: "link",
    isChosen: false,
    unplaced: [],
    confirmed: NO_CONFIRMED,
    isStreamed: false,
    isAfterExit: false,
    heldRoom: null,
    readings: NO_READINGS,
    playedReading: null,
    kept: null,
    isKeptWhole: false,
    whole: null,
    record: null,
    isFromMemory: false,
  };
}

/** A kept day as the page lands on it, or as a new landing for it takes the page. */
function keptLandingOf(kept: KeptLanding, run: number, isWhole: boolean): Asked {
  return { ...landingOf(kept.request), run, isStreamed: true, kept, isKeptWhole: isWhole };
}

/** A word as the sentence says it: its answer's label, or its open question's cue. */
function wordLabelOf(
  key: AssumableFactKey,
  value: string | null,
  isFirstImpression: boolean,
): string {
  return (
    optionOf({ options: FACT_OPTIONS[key] }, value)?.label ?? askedLabelsOf(isFirstImpression)[key]
  );
}

/** A city an answer would play a day in, with the cities its name could mean. */
interface PlayedCity {
  city: string;
  citySource: DayRequest["citySource"];
  timezone: string;
  readings: readonly CityReading[];
}

/**
 * Where an answer to a city typed on the city word plays its day: the request's city, or for
 * a name that could mean several the likeliest, as Lantern's assumption. Null for an answer
 * that names no city.
 */
function playedCityOf(read: StartResult): PlayedCity | null {
  if (read.kind === "request") {
    const { city, citySource, timezone } = read.request;
    return { city, citySource, timezone, readings: read.readings };
  }
  const [likeliest] = read.kind === "question" ? read.readings : [];
  if (read.kind !== "question" || likeliest === undefined) return null;
  return {
    city: likeliest.name,
    citySource: "assumed",
    timezone: likeliest.timezone,
    readings: read.readings,
  };
}

/**
 * Why a city typed on the city word plays no day, for the word to say in its list: an
 * answer that names no city, or a refusal, our limit, or a reading that could not run.
 */
function typedCityFailureOf(kind: StartResult["kind"]): TypedCityFailure {
  if (kind === "refused" || kind === "limited") return kind;
  return kind === "unavailable" ? "unavailable" : "no-city";
}

/**
 * The request is one of the days Lantern has written: the same city, the same words, on any
 * date of its weekday, as a press moves it to the date it is shown on.
 */
function isWritten(start: DayStart | undefined, request: DayRequest): boolean {
  return start?.pool.some((each) => isOnItsWeekday(each.request, request)) ?? false;
}
