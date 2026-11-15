import type { StopDraft } from "@/features/abacus/day-draft";
import {
  ELCHE_RECEIPTS,
  forkViewAt,
  type ForkExample,
  type ForkMoment,
} from "@/features/abacus/fork-row-examples";
import { dayContextOf } from "@/features/abacus/light";
import { newStopsOf, windowsOf } from "@/features/abacus/replan-frame";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { receiptOf, type WorkMoment } from "@/features/abacus/work-line";
import { writtenDayAt } from "@/lib/days/written/days";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { CROWDED_DAY, LATE_NIGHT_DAY } from "@/lib/fixtures/edge/edge-days";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { KANAZAWA_LATE_DINNER } from "@/lib/fixtures/replan/kanazawa-dinner";
import { KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import {
  UTRECHT_EARLY_MORNING,
  UTRECHT_MORNING_BASIS,
} from "@/lib/fixtures/replan/utrecht-morning";
import type { DayContext } from "@/lib/geo/sun";
import { mergeShownReplan, movedStopsOf, type ReplanBasis } from "@/lib/replan/merge";
import type { Itinerary, Place, Stop } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { formatClock, runningSpans } from "@/lib/time/clock";
import type { ReplanEnding } from "./replan-controls";
import { placesKeptOf, type ForkView } from "./replan-work";
import { partsOf } from "./part-slip-lines";

/**
 * The part slip's examples for its matrix and its tests (`part-slip-matrix.tsx`): a part's two
 * versions on real days, each proposal as the merge takes it, and the fork's moments from the
 * press to a choice and every ending. A plain module, so the server's registry of matrices
 * reads it.
 */

/** A changed word's part: its two versions, the fork's place among its parts, its receipts. */
export interface SlipExample {
  fork: ForkExample;
  /** The part in the day before the change, and in the proposal. */
  before: readonly StopDraft[];
  after: readonly StopDraft[];
  /** Where the part opens on the day's running clock; null where it starts the day. */
  opens: number | null;
  /**
   * The stop the day keeps before the part, drawn over the slip so the plan's clock runs on into
   * the part as on the page; null where the part starts the day.
   */
  lead: StopDraft | null;
  /** The day's light, for the part's first row drawn under the slip. */
  daylight: DayContext;
}

/** A part's proposal merged into its day, as the page merges it, or a failure to say so. */
function mergedOf(basis: ReplanBasis, replan: GeneratedReplan): Itinerary {
  const merged = mergeShownReplan({ ...basis, replan });
  if (!merged.ok) throw new Error(`The slip's example does not merge: ${merged.reason}`);
  return merged.itinerary;
}

type Change = ForkExample["change"];

/** A part of a re-planned day, its receipts counted as the page counts them once whole. */
function partOf(
  basis: ReplanBasis,
  replan: GeneratedReplan,
  change: Change,
  index: number,
): SlipExample {
  const after = mergedOf(basis, replan);
  const windows = windowsOf(basis.itinerary, basis.windows);
  const moves = [...movedStopsOf(basis, after.stops).values()];
  const later = moves.filter((move) => move === "later").length;
  const counts = {
    added: newStopsOf(after.stops, [basis.idPrefix]).size - moves.length,
    same: null,
    later,
    earlier: moves.length - later,
  };
  const before = basis.itinerary.stops;
  const part = partsOf(before, windows)[index] ?? [];
  const first = part[0];
  return {
    fork: {
      change,
      reach: "part",
      receipts: {
        proposal: receiptOf(change, "part", before, after.stops, counts),
        before: receiptOf(
          { word: change.word, to: change.from },
          "part",
          after.stops,
          before,
          null,
        ),
      },
      index,
      count: windows.length,
    },
    before: part,
    after: partsOf(after.stops, windows)[index] ?? [],
    opens: windows[index]?.opens ?? null,
    lead: (first && before[before.indexOf(first) - 1]) ?? null,
    daylight: dayContextOf(basis.itinerary),
  };
}

const LATE_DINNER: Change = { word: "dinner", from: "early dinner", to: "eating late" };
const ELCHE_LUNCH = partOf(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED, LATE_DINNER, 0);
const ELCHE_EVENING = partOf(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED, LATE_DINNER, 1);

/** Kanazawa's written day, its dinner changed to "eating late", which rewrites its evening. */
function kanazawaBasis(): ReplanBasis {
  const day = writtenDayAt("kanazawa");
  if (!day) throw new Error("Kanazawa is a written day");
  return {
    itinerary: day.itinerary,
    request: { ...day.request, dinner: "late" },
    changed: "dinner",
    windows: [{ from: 6, to: 7 }],
    idPrefix: "r1",
  };
}

/**
 * Elche's lunch with the longest name a fixture day holds, its museum's, put at the lunch's
 * hour: three lines at a phone's width, four with what it is and until when.
 */
function longestNameOf(lunch: SlipExample): SlipExample {
  const museum = ELCHE_DINNER_BASIS.itinerary.stops[2]?.primary;
  const [first] = lunch.after;
  if (!museum || !first) throw new Error("Elche's day has its museum and its lunch");
  return {
    ...lunch,
    fork: { ...lunch.fork, receipts: ELCHE_RECEIPTS },
    after: [{ ...first, primary: museum, alternatives: [], selectedPlaceId: museum.id }],
  };
}

/** The most stops the matrix shows a slip with: a whole day of sixteen. */
const MOST_STOPS = 16;
const HOUR = 60;
/** The whole day of sixteen starts at eight, a stop an hour, each three quarters long. */
const FIRST_START = 8 * HOUR;
const STOP_MINUTES = 45;

/**
 * Barcelona's crowded day written again whole for friends, as sixteen stops: the day's own
 * versions first, at places the day does not plan, then its own places, a stop an hour from
 * eight, so the slip's longest list sets new places, places that stay and places that moved.
 */
function sixteenStopsOf(): SlipExample {
  const itinerary = itineraryOf(CROWDED_DAY);
  const before = itinerary.stops;
  const planned = new Set(before.map(({ primary }) => primary.name));
  const versions = before
    .flatMap(({ alternatives }) => alternatives)
    .filter(({ name }) => !planned.has(name))
    .filter((place, at, all) => all.findIndex(({ name }) => name === place.name) === at);
  const places = [...versions, ...before.map(({ primary }) => primary)].slice(0, MOST_STOPS);
  const after: Stop[] = places.map((place, at) => ({
    id: `stop-${at}`,
    startTime: formatClock(FIRST_START + at * HOUR),
    durationMinutes: STOP_MINUTES,
    primary: { ...place, id: `stop-${at}:p` },
    alternatives: [],
    selectedPlaceId: `stop-${at}:p`,
    dependsOn: ["energy", "company"],
  }));
  const change: Change = { word: "company", from: "with anyone", to: "with friends" };
  return {
    fork: {
      change,
      reach: "whole",
      receipts: {
        proposal: receiptOf(change, "whole", before, after, placesKeptOf(before, after)),
        before: receiptOf({ word: change.word, to: change.from }, "whole", after, before, null),
      },
      index: 0,
      count: 1,
    },
    before,
    after,
    opens: null,
    lead: null,
    daylight: dayContextOf(itinerary),
  };
}

/** A stop at a place, at a start and for as long, under an id of the proposal's. */
function stopAt(id: string, startTime: string, durationMinutes: number, place: Place): Stop {
  const primary = { ...place, id: `${id}:p` };
  return {
    id,
    startTime,
    durationMinutes,
    primary,
    alternatives: [],
    selectedPlaceId: primary.id,
    dependsOn: ["energy", "company"],
  };
}

/**
 * Lisbon's night past midnight, its company changed to friends: the part from the river at one
 * o'clock rewritten as a late supper on Pink Street at ten to one, the river after it. The part
 * opens where the cocktails before it end, a quarter to one, so its hours run on past midnight:
 * the supper is a late supper, never a breakfast, and the river moved half an hour.
 */
function pastMidnightOf(): SlipExample {
  const itinerary = itineraryOf(LATE_NIGHT_DAY);
  const before = itinerary.stops;
  const [shellfish, cocktails, river] = before;
  const fish = itineraryOf(LISBON_DAY)
    .stops.flatMap(({ alternatives }) => alternatives)
    .find(({ name }) => name === "Tinned fish on Pink Street");
  if (!shellfish || !cocktails || !river || !fish) {
    throw new Error("The night past midnight has its three stops, and Lisbon its tinned fish");
  }
  const supper = stopAt("r1-stop-0", "00:50", 40, fish);
  const later = stopAt("r1-stop-1", "01:30", 150, river.primary);
  const after = [shellfish, cocktails, supper, later];
  const change: Change = { word: "company", from: "with a partner", to: "with friends" };
  const counts = { added: 1, same: null, later: 1, earlier: 0 };
  return {
    fork: {
      change,
      reach: "part",
      receipts: {
        proposal: receiptOf(change, "part", before, after, counts),
        before: receiptOf({ word: change.word, to: change.from }, "part", after, before, null),
      },
      index: 0,
      count: 1,
    },
    before: [river],
    lead: cocktails,
    after: [supper, later],
    opens: runningSpans(before)[1]?.to ?? null,
    daylight: dayContextOf(itinerary),
  };
}

/**
 * The examples the matrix sets each moment on, the axis across. Utrecht's morning stands first:
 * the visual baseline holds each axis but the moments at its first value, and this part has a
 * new stop and two moved, and draws every ending.
 */
export const SLIP_EXAMPLES: readonly { label: string; example: SlipExample }[] = [
  {
    label: "two of the day's made earlier: Utrecht's morning",
    example: partOf(
      UTRECHT_MORNING_BASIS,
      UTRECHT_EARLY_MORNING,
      { word: "start", from: "slow morning", to: "early start" },
      0,
    ),
  },
  { label: "a part past midnight: Lisbon's late supper", example: pastMidnightOf() },
  {
    label: "the longest answers: Elche's lunch",
    example: partOf(
      ELCHE_DINNER_BASIS,
      ELCHE_LATE_DINNER_UNREPEATED,
      { word: "travel", from: "getting around …", to: "by public transport" },
      0,
    ),
  },
  { label: "one stop: Elche's lunch, 1 of 2", example: ELCHE_LUNCH },
  { label: "three, one that stays: Elche's evening, 2 of 2", example: ELCHE_EVENING },
  { label: "the longest name", example: longestNameOf(ELCHE_LUNCH) },
  { label: "sixteen stops: a whole day", example: sixteenStopsOf() },
  {
    label: "a part that starts the day: Kyoto's morning",
    example: partOf(
      KYOTO_MORNING_BASIS,
      KYOTO_SLOW_MORNING,
      { word: "start", from: "early start", to: "slow morning" },
      0,
    ),
  },
  {
    label: "a part that ends the day: Kanazawa's evening",
    example: partOf(kanazawaBasis(), KANAZAWA_LATE_DINNER, LATE_DINNER, 0),
  },
];

/** How many of the proposal's stops are drawn while it is written: none, the first, or all. */
type Written = "none" | "first" | "all";

/** One moment of the fork, as the slip shows it. */
export interface SlipMoment {
  fork: ForkMoment;
  /** While written, how many lines have arrived. */
  written?: Written;
  /** Before the search is said: the head alone, its room held. */
  isBeforeLooking?: boolean;
}

const ENDINGS: readonly { label: string; ending: ReplanEnding }[] = [
  { label: "an ending: didn't fit", ending: "invalid" },
  { label: "an ending: cut", ending: "cut" },
  { label: "an ending: the connection lost", ending: "disconnected" },
  { label: "an ending: refused", ending: "refused" },
  { label: "an ending: busy", ending: "unavailable" },
  { label: "an ending: our limit", ending: "limited" },
];

const LOOKING: WorkMoment = { kind: "looking" };

/** The moments the matrix sets, the axis down. */
export const SLIP_MOMENTS: readonly { label: string; moment: SlipMoment }[] = [
  {
    label: "nothing yet",
    moment: {
      fork: { status: "writing", moment: LOOKING },
      written: "none",
      isBeforeLooking: true,
    },
  },
  {
    label: "writing: no line yet",
    moment: { fork: { status: "writing", moment: LOOKING }, written: "none" },
  },
  {
    label: "writing: its first line",
    moment: {
      fork: { status: "writing", moment: { kind: "stops", written: 1 } },
      written: "first",
    },
  },
  {
    label: "writing: every line",
    moment: { fork: { status: "writing", moment: { kind: "dek" } }, written: "all" },
  },
  { label: "whole: take it", moment: { fork: { status: "proposed" } } },
  // The slip is the comparison, so a chosen fork's receipt stands as it does once compared.
  {
    label: "taken: the day before beside it",
    moment: { fork: { status: "taken", isCompared: true } },
  },
  { label: "kept: the visitor's own", moment: { fork: { status: "left", isCompared: true } } },
  ...ENDINGS.map(({ label, ending }) => ({
    label,
    moment: { fork: { status: "failed" as const, ending } },
  })),
];

/** A part's fork at one moment: its view, and the part's stops on screen and beside it. */
export interface SlipStill {
  view: ForkView;
  shown: readonly StopDraft[];
  other: readonly StopDraft[];
}

/** The slip of one example at one moment, as the page would work it out. */
export function slipStillOf({ fork, before, after }: SlipExample, at: SlipMoment): SlipStill {
  const forkView = forkViewAt(fork, at.fork);
  const view =
    at.isBeforeLooking && forkView.line !== null
      ? { ...forkView, line: { ...forkView.line, words: "" } }
      : forkView;
  if (view.chosen === "to") return { view, shown: after, other: before };
  const written = at.written === "none" ? 0 : at.written === "first" ? 1 : after.length;
  return { view, shown: before, other: after.slice(0, written) };
}
