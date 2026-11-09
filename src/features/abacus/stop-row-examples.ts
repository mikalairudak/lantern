import { revealedOf } from "@/features/itinerary/revealed";
import { firstAt, partialAt } from "@/features/itinerary/stream-frames";
import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import {
  AROUND_DAY,
  CROWDED_DAY,
  LATE_NIGHT_DAY,
  LONG_STAY_DAY,
  MINIMAL_DAY,
  NEVER_QUIET_DAY,
} from "@/lib/fixtures/edge/edge-days";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { DayRequest, GeneratedDay, Itinerary } from "@/lib/schema/itinerary.schema";
import { dayText } from "@/lib/stream/simulate-day-stream";
import {
  completeDraftOf,
  draftDayOf,
  openableStopsOf,
  type DayDraft,
  type StopDraft,
} from "./day-draft";
import { askedHoursOf, dayBounds, type DaySpan } from "./geometry";
import { stopIdAt } from "@/lib/schema/positions";

/** A fixture day the stop row is shown on. */
export interface ExampleDay {
  request: DayRequest;
  day: GeneratedDay;
}

/** A stop of a fixture day at an extreme the schema allows, by its place in the day. */
export interface StopRowExample {
  label: string;
  fixture: ExampleDay;
  stop: number;
}

/**
 * The stop row at the extremes the schema allows, each a real stop of a curated or an edge
 * day, shown with the stops on either side of it so its row sits in a day.
 */
export const STOP_ROW_EXAMPLES: readonly StopRowExample[] = [
  { label: "a calm place, at its best light", fixture: ALICANTE_DAY, stop: 0 },
  { label: "a lively place", fixture: ALICANTE_DAY, stop: 3 },
  { label: "the longest name", fixture: CROWDED_DAY, stop: 0 },
  { label: "a long neighbourhood", fixture: CROWDED_DAY, stop: 6 },
  { label: "two versions at one energy", fixture: CROWDED_DAY, stop: 5 },
  // The most a stop can have: each a whole target's width from the next, two steps in.
  { label: "three versions at one energy", fixture: NEVER_QUIET_DAY, stop: 3 },
  { label: "one version only", fixture: MINIMAL_DAY, stop: 0 },
  { label: "after midnight", fixture: LATE_NIGHT_DAY, stop: 2 },
  { label: "eight hours", fixture: LONG_STAY_DAY, stop: 0 },
  // Open, its sheet lies on the wire above, whose beads are drawn again over it.
  { label: "a sheet on the wire above", fixture: KYOTO_DAY, stop: 2 },
  // A place to eat around, named by its food and where: its row says its meal by the hour
  // and its quarter, where another place says its kind and quarter. Calm, it rests open, so
  // the matrix's own view says both.
  { label: "a lunch named by its food and where", fixture: ALICANTE_DAY, stop: 4 },
  // A quarter the name already says is not said again, at any kind.
  { label: "a lunch whose name says its quarter", fixture: AROUND_DAY, stop: 2 },
  { label: "a place whose name says its quarter", fixture: LISBON_DAY, stop: 1 },
  // A place for coffee says it is a café, at any hour.
  { label: "a café", fixture: KYOTO_DAY, stop: 5 },
  // Past midnight on the running clock: a late supper, never breakfast.
  { label: "a late supper past midnight", fixture: AROUND_DAY, stop: 8 },
];

/** The moments of a row's life the matrix shows it in, in the order they happen. */
export const STOP_ROW_STATES = [
  { label: "placed in time", key: "placed" },
  // A row's words wait unseen for its bead (`docs/decisions.md`, "A row's words go where its bead
  // comes to rest, and rows ease rather than jump"): named, and then written up to its light, the
  // last of what it shows, it shows its time and, on its wire under it, its hollow bead alone.
  { label: "its name streamed, unseen until its bead is weighed", key: "naming" },
  { label: "its words streamed, waiting unseen for its light", key: "unweighed" },
  // The frame its bead is weighed in: its words come in with it, with motion the pen setting
  // off on its name while what kind of place it is and where wait unseen in their room, and
  // under reduced motion whole.
  { label: "weighed, its words coming in with its bead", key: "weighing" },
  { label: "written, no versions yet", key: "written" },
  { label: "open while the day is written", key: "open-written" },
  { label: "complete", key: "complete" },
  { label: "inviting the first drag, its example drawn", key: "invited" },
  { label: "open", key: "open" },
  { label: "another version swapped in", key: "swapped" },
  // Versions named before they are taken (2026-11-05), each by its bead.
  { label: "a version named under a pointer", key: "named" },
  { label: "its slider focused, the versions its arrows reach named", key: "keyed" },
  { label: "dragged onto another version, named away from the hand", key: "dragged" },
  // A changed word's proposal beside the day (`docs/decisions.md`, "A changed word proposes its
  // part beside the day, and the visitor takes it"): compact, blue, off the day's curve.
  { label: "proposed beside the day by a changed word", key: "proposed" },
] as const;

export type StopRowState = (typeof STOP_ROW_STATES)[number]["key"];

/**
 * How a cell frames its rows. On their own hours, at the chart's least height; or on the
 * page's frame of the day at that moment, at the page's pace: the whole of it, or in a
 * silence from the first hour of the rows shown, the day's last, with the waiting line under
 * them, its pen read against the page's frame.
 */
export type StillFrame =
  | { kind: "own" }
  | { kind: "silence"; page: DaySpan }
  /** A silence with the last row bare, its waiting line in that row's own place. */
  | { kind: "bare"; page: DaySpan }
  /** On the page's frame; a whole day's ends on the whole hour after its last visit. */
  | { kind: "page"; page: DaySpan; isWhole: boolean };

/** Rows on their own hours, at the chart's least height. */
const OWN_FRAME: StillFrame = { kind: "own" };

/**
 * The example's stop in one state, between its neighbours; or, for the light on the chart
 * and the silences, a day whole or its last rows.
 */
export interface StopRowStill {
  /**
   * The stops around the example's, as far as the stream has written them; in a silence,
   * the day's last rows.
   */
  draft: DayDraft;
  /** Where the example's stop sits among them; in a silence, the day's last row. */
  subject: number;
  /** Where in the day's stream the state is: characters of its text, or null once complete. */
  at: number | null;
  /** The finished day, for its place and date under the sun. */
  itinerary: Itinerary;
  frame: StillFrame;
  /**
   * The stops that open in this frame while the day is still written (`openableStopsOf`),
   * judged on the whole day's stream, which the window may not hold all of. Every stop of
   * a complete day opens; left out, none opens before its day is complete.
   */
  openableStops?: ReadonlySet<string>;
  /**
   * The frame the cell draws first, for a state a row lives through rather than lands in, as
   * a row weighed from its hollow bead: drawn first, then the state's, so its pen sets off.
   */
  before?: DayDraft;
}

/** Enough letters of a name to read as a word being written. */
const NAME_LETTERS = 6;

/** A cell's stops: the one at `at` among the draft's, with one on either side once written. */
export function windowAround(draft: DayDraft, at: number): { draft: DayDraft; subject: number } {
  const from = Math.max(0, at - 1);
  return { draft: { ...draft, stops: draft.stops.slice(from, at + 2) }, subject: at - from };
}

/** The stops the cell shows: the example's, with one on either side once they are written. */
function windowOf(draft: DayDraft, stopIndex: number): { draft: DayDraft; subject: number } {
  return windowAround(
    draft,
    draft.stops.findIndex((stop) => stop.id === stopIdAt(stopIndex)),
  );
}

/**
 * The day's frame as the page draws it once these stops are written: the hours the day's
 * words ask for, stretched to whole hours around any stop outside them. A silence's line
 * reads its pen against it: a plan that reaches the last hour asked for waits for its
 * versions, and one that does not waits for its next stop.
 */
export function pageFrameOf(
  stops: Parameters<typeof dayBounds>[0],
  { facts }: Pick<Itinerary, "facts">,
): DaySpan {
  return dayBounds(stops, askedHoursOf(facts.start.value, facts.end.value));
}

export function itineraryOf({ request, day }: ExampleDay): Itinerary {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`A fixture day does not normalize: ${normalized.reason}`);
  return normalized.itinerary;
}

/** What the chart can draw after the first `at` characters of the day's stream. */
export async function draftAt(text: string, at: number): Promise<DayDraft> {
  return draftDayOf(revealedOf(await partialAt(text, at), null));
}

/** The first prefix of the stream at which the chart's draft reaches a state. */
function firstDraftAt(text: string, isReached: (draft: DayDraft) => boolean): Promise<number> {
  return firstAt(text, (revealed) => isReached(draftDayOf(revealed)));
}

/**
 * A waiting state, a silence among them: the frame of the stream before what it waits for
 * arrives in the chart's draft.
 */
export async function frameBefore(
  text: string,
  isReached: (draft: DayDraft) => boolean,
): Promise<number> {
  return Math.max(0, (await firstDraftAt(text, isReached)) - 1);
}

/**
 * Where in the stream a state is, for the stop at `stopIndex`. Each is found by its first
 * frame, the stream only ever adding to what is shown; a waiting state is the frame before
 * what it waits for arrives.
 */
async function stateAt(text: string, stopIndex: number, state: StopRowState): Promise<number> {
  const stopOf = (draft: DayDraft): StopDraft | undefined =>
    draft.stops.find((stop) => stop.id === stopIdAt(stopIndex));
  const before = (isReached: (draft: DayDraft) => boolean) => frameBefore(text, isReached);
  switch (state) {
    case "placed":
      return firstDraftAt(text, (draft) => stopOf(draft) !== undefined);
    case "naming": {
      // A name shorter than a word's worth is caught a letter before its end.
      const name = stopOf(await draftAt(text, text.length))?.primary.name ?? "";
      const letters = Math.max(1, Math.min(NAME_LETTERS, name.length - 1));
      return firstDraftAt(text, (draft) => (stopOf(draft)?.primary.name?.length ?? 0) >= letters);
    }
    case "unweighed":
      return before((draft) => stopOf(draft)?.primary.sensory?.energy !== undefined);
    case "weighing":
      return firstDraftAt(text, (draft) => stopOf(draft)?.primary.sensory?.energy !== undefined);
    case "open-written": {
      // Written as the state before it, its versions not yet come, if every line of it is
      // final by then; else the first frame it is, as for the day's last stop, whole once a
      // version has begun. A day with no versions has no such frame: its last stop opens
      // only once the stream has ended, so it shows written and shut.
      const written = await before((draft) => (stopOf(draft)?.alternatives.length ?? 0) > 0);
      const opens = await firstAt(text, (revealed) =>
        openableStopsOf(revealed.day, draftDayOf(revealed)).has(stopIdAt(stopIndex)),
      );
      return Math.max(written, opens);
    }
    default:
      return before((draft) => (stopOf(draft)?.alternatives.length ?? 0) > 0);
  }
}

const stills = new Map<string, Promise<StopRowStill>>();

/**
 * The example's stop in a state: a frame of the day's real stream, read as the page reads
 * it, or the finished itinerary. Worked out once per example and state, since every density
 * shows the same frame.
 */
export function stillOf(example: StopRowExample, state: StopRowState): Promise<StopRowStill> {
  const key = `${example.label}:${state}`;
  const known = stills.get(key);
  if (known) return known;
  const still = (async (): Promise<StopRowStill> => {
    const itinerary = itineraryOf(example.fixture);
    if (
      state === "complete" ||
      state === "invited" ||
      state === "open" ||
      state === "swapped" ||
      state === "proposed" ||
      state === "named" ||
      state === "keyed" ||
      state === "dragged"
    ) {
      const draft = completeDraftOf(itinerary);
      const openableStops = openableStopsOf({}, draft);
      return {
        ...windowOf(draft, example.stop),
        at: null,
        itinerary,
        frame: OWN_FRAME,
        openableStops,
      };
    }
    const text = dayText(example.fixture.day);
    const at = await stateAt(text, example.stop, state);
    const revealed = revealedOf(await partialAt(text, at), null);
    const draft = draftDayOf(revealed);
    const openableStops = openableStopsOf(revealed.day, draft);
    const still = {
      ...windowOf(draft, example.stop),
      at,
      itinerary,
      frame: OWN_FRAME,
      openableStops,
    };
    if (state !== "weighing") return still;
    const unweighed = await draftAt(text, await stateAt(text, example.stop, "unweighed"));
    return { ...still, before: windowOf(unweighed, example.stop).draft };
  })();
  stills.set(key, still);
  return still;
}
