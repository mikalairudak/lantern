import { FACT_OPTIONS } from "@/features/day/facts";
import { replanEndedOf } from "@/features/day/not-yet";
import type {
  ReplanControls,
  ReplanEnding,
  ReplanPlaces,
  ReplanStatus,
} from "@/features/day/replan-controls";
import { forkViewOf, placesKeptOf, type ForkView } from "@/features/day/replan-work";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { KANAZAWA_LATE_DINNER } from "@/lib/fixtures/replan/kanazawa-dinner";
import { writtenDayAt } from "@/lib/days/written/days";
import { mergeShownReplan, movedStopsOf, type ReplanBasis } from "@/lib/replan/merge";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { newStopsOf } from "./replan-frame";
import { receiptOf, workLineOf, type WorkMoment, type WorkReceipt } from "./work-line";

/**
 * The fork row's examples for its matrix and its tests (`fork-row-matrix.tsx`): each moment of
 * a changed word's fork on real data, production's Elche day and its dinner's proposal, as the
 * merge takes it. A plain module, so the server's registry of matrices reads it.
 */

/** A part's proposal merged into its day, as the page merges it, or a failure to say so. */
function mergedOf(basis: ReplanBasis, replan: typeof KANAZAWA_LATE_DINNER): Itinerary {
  const merged = mergeShownReplan({ ...basis, replan });
  if (!merged.ok) throw new Error(`The fork's example does not merge: ${merged.reason}`);
  return merged.itinerary;
}

/** What a part's proposal counts against its day, as the page counts it once whole. */
function placesOf(basis: ReplanBasis, after: Itinerary): ReplanPlaces {
  const written = newStopsOf(after.stops, [basis.idPrefix]).size;
  const moves = [...movedStopsOf(basis, after.stops).values()];
  const later = moves.filter((move) => move === "later").length;
  return { added: written - moves.length, same: null, later, earlier: moves.length - later };
}

const ELCHE_AFTER = mergedOf(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED);
const ELCHE_BEFORE = ELCHE_DINNER_BASIS.itinerary;

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
const KANAZAWA_BASIS = kanazawaBasis();
const KANAZAWA_AFTER = mergedOf(KANAZAWA_BASIS, KANAZAWA_LATE_DINNER);

/** Elche's dinner, "early dinner" changed to "eating late", which rewrites two parts. */
const LATE_DINNER = { word: "dinner", from: "early dinner", to: "eating late" } as const;

/** What Elche's proposal would change, and what its day before would once the proposal is taken. */
export const ELCHE_RECEIPTS: { proposal: WorkReceipt; before: WorkReceipt } = {
  proposal: receiptOf(
    LATE_DINNER,
    "part",
    ELCHE_BEFORE.stops,
    ELCHE_AFTER.stops,
    placesOf(ELCHE_DINNER_BASIS, ELCHE_AFTER),
  ),
  before: receiptOf(
    { word: "dinner", to: LATE_DINNER.from },
    "part",
    ELCHE_AFTER.stops,
    ELCHE_BEFORE.stops,
    null,
  ),
};

/** A changed word's fork as one example draws it: its change, its reach, its receipts, its row. */
export interface ForkExample {
  change: NonNullable<ReplanControls["change"]>;
  reach: "part" | "whole";
  receipts: { proposal: WorkReceipt; before: WorkReceipt };
  /** Which of the fork's rows, from 0, and how many there are. */
  index: number;
  count: number;
}

/**
 * A whole day written again for a family, its receipt counted against Elche's day as if the
 * family's day kept five of its places: the count's words, as a whole day's receipt says them.
 */
const FAMILY_PLACES = placesKeptOf(ELCHE_BEFORE.stops, ELCHE_BEFORE.stops.slice(0, 5));

/**
 * A whole day written again for a change of a word no stop's hours name, its receipt counted as
 * the family's is: the longer answers a phone's line has to hold.
 */
function wholeChangeOf(change: ForkExample["change"]): ForkExample {
  return {
    change,
    reach: "whole",
    receipts: {
      proposal: receiptOf(change, "whole", ELCHE_BEFORE.stops, ELCHE_BEFORE.stops, {
        ...FAMILY_PLACES,
        added: 3,
      }),
      before: receiptOf(
        { word: change.word, to: change.from },
        "whole",
        ELCHE_BEFORE.stops,
        ELCHE_BEFORE.stops,
        null,
      ),
    },
    index: 0,
    count: 1,
  };
}

/** Elche's evening with the day's end brought forward: "home by eleven" to "home by eight". */
const EARLIER_END = { word: "end", from: "home by eleven", to: "home by eight" } as const;

/** The examples the matrix sets each moment on, the axis across. */
export const FORK_EXAMPLES: readonly { label: string; example: ForkExample }[] = [
  {
    label: "Elche's lunch, 1 of 2",
    example: { change: LATE_DINNER, reach: "part", receipts: ELCHE_RECEIPTS, index: 0, count: 2 },
  },
  {
    label: "its evening, 2 of 2",
    example: { change: LATE_DINNER, reach: "part", receipts: ELCHE_RECEIPTS, index: 1, count: 2 },
  },
  {
    label: "Kanazawa's evening, one part",
    example: {
      change: LATE_DINNER,
      reach: "part",
      receipts: {
        proposal: receiptOf(
          LATE_DINNER,
          "part",
          KANAZAWA_BASIS.itinerary.stops,
          KANAZAWA_AFTER.stops,
          placesOf(KANAZAWA_BASIS, KANAZAWA_AFTER),
        ),
        before: receiptOf(
          { word: "dinner", to: LATE_DINNER.from },
          "part",
          KANAZAWA_AFTER.stops,
          KANAZAWA_BASIS.itinerary.stops,
          null,
        ),
      },
      index: 0,
      count: 1,
    },
  },
  {
    label: "a whole day, a question answered",
    example: {
      change: { word: "company", from: "with …?", to: "with family" },
      reach: "whole",
      receipts: {
        proposal: receiptOf(
          { word: "company", to: "with family" },
          "whole",
          ELCHE_BEFORE.stops,
          ELCHE_BEFORE.stops,
          { ...FAMILY_PLACES, added: 3 },
        ),
        before: receiptOf(
          { word: "company", to: "with …?" },
          "whole",
          ELCHE_BEFORE.stops,
          ELCHE_BEFORE.stops,
          null,
        ),
      },
      index: 0,
      count: 1,
    },
  },
  {
    label: "the day's end, 2 of 2",
    example: {
      change: EARLIER_END,
      reach: "part",
      receipts: {
        proposal: receiptOf(EARLIER_END, "part", ELCHE_AFTER.stops, ELCHE_BEFORE.stops, null),
        before: receiptOf(
          { word: "end", to: EARLIER_END.from },
          "part",
          ELCHE_BEFORE.stops,
          ELCHE_AFTER.stops,
          null,
        ),
      },
      index: 1,
      count: 2,
    },
  },
  {
    label: "a partner to friends, a whole day",
    example: wholeChangeOf({ word: "company", from: "with a partner", to: "with friends" }),
  },
  {
    label: "the longest pair, a question answered",
    example: wholeChangeOf({ word: "travel", from: "getting around …", to: "by public transport" }),
  },
];

/** One moment of a fork: where its change stands, and what its row's line says then. */
export interface ForkMoment {
  status: Exclude<ReplanStatus, "idle">;
  isCompared?: boolean;
  /** While written, how far: looking until its first stop, then its stops and versions. */
  moment?: WorkMoment;
  ending?: ReplanEnding;
}

/** The moments the matrix sets, the axis down. */
export const FORK_MOMENTS: readonly { label: string; moment: ForkMoment }[] = [
  { label: "writing: looking", moment: { status: "writing", moment: { kind: "looking" } } },
  {
    label: "writing: its new stops",
    moment: { status: "writing", moment: { kind: "stops", written: 1 } },
  },
  {
    label: "writing: their versions",
    moment: { status: "writing", moment: { kind: "versions", written: 2, of: 3 } },
  },
  { label: "ready: take it", moment: { status: "proposed" } },
  { label: "taken, folded", moment: { status: "taken" } },
  { label: "left, folded", moment: { status: "left" } },
  { label: "taken, compared", moment: { status: "taken", isCompared: true } },
  { label: "failed: didn't fit", moment: { status: "failed", ending: "invalid" } },
  { label: "failed: our limit", moment: { status: "failed", ending: "limited" } },
];

const ignore = () => undefined;

/** The fork row's view of one example at one moment, as the page works it out. */
export function forkViewAt(example: ForkExample, at: ForkMoment): ForkView {
  const isWhole = at.status !== "writing" && at.status !== "failed";
  const controls: ReplanControls = {
    status: at.status,
    change: example.change,
    reach: example.reach,
    ending: at.status === "failed" ? (at.ending ?? "invalid") : null,
    written: null,
    receipt: !isWhole
      ? null
      : at.status === "taken"
        ? example.receipts.before
        : example.receipts.proposal,
    windows: [],
    isCompared: at.isCompared ?? at.status === "proposed",
    choose: () => false,
    compare: ignore,
    askAgain: ignore,
  };
  const view = forkViewOf({ replan: controls, frame: null, isLookingDue: true });
  if (view === null) throw new Error("A fork's example has no view");
  if (at.status !== "writing" || at.moment === undefined) return view;
  const work = {
    word: example.change.word,
    from: example.change.from,
    isFromAsked: example.change.from.endsWith("?"),
    toValue:
      FACT_OPTIONS[example.change.word].find(({ label }) => label === example.change.to)?.value ??
      example.change.to,
    to: example.change.to,
  };
  return { ...view, line: workLineOf(work, example.reach, at.moment) };
}

/** Why a fork failed, as its row says it: the words its matrix and its tests read. */
export function failedLineOf(ending: ReplanEnding, example: ForkExample): string {
  return replanEndedOf(ending, example.change.word, example.reach);
}
