import { placedStopsOf } from "@/features/abacus/day-draft";
import type { ReplanFrame } from "@/features/abacus/replan-frame";
import {
  partMomentOf,
  workLineOf,
  type WorkChange,
  type WorkLine,
  type WorkMoment,
} from "@/features/abacus/work-line";
import { isSameSpelling } from "@/lib/places/match";
import type { Stop } from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { ASKED_LABELS, FACT_OPTIONS } from "./facts";
import { replanEndedOf } from "./not-yet";
import type {
  ForkSide,
  ReplanControls,
  ReplanEnding,
  ReplanPlaces,
  ReplanWritten,
} from "./replan-controls";

/**
 * A fork as its rows show it over the parts a changed word rewrites (`docs/decisions.md`, "A
 * changed word proposes its part beside the day, and the visitor takes it"), worked out from the
 * page's change (`ReplanControls`), so the chart and the lab's matrix draw the same rows.
 */
export interface ForkView {
  /** The visitor's answer before the change, as the sentence says it: "early dinner". */
  from: string;
  /** The proposal's answer: "eating late". */
  to: string;
  /** Whose version is the day on screen: the visitor's before, or the proposal taken. */
  chosen: ForkSide;
  /** The proposal is being written: its answer is lit, its ring dashed, and it cannot be taken. */
  isWriting: boolean;
  /** The proposal is whole and no choice is made yet: "Take" stands beside its answer. */
  isReady: boolean;
  /** A version was chosen: the row stands folded to its answers, the other a tap away. */
  isChosen: boolean;
  /** The version not on screen is drawn beside the day. */
  isCompared: boolean;
  /** "Compare" is offered: a part's fork once chosen. A whole day's has no rows to draw beside. */
  isComparable: boolean;
  /** It ended without a proposal: the visitor's answer stands alone, with why. */
  isFailed: boolean;
  /**
   * The line under the answers: what Lantern is doing while it writes, what the version beside
   * the day would change once whole, or why it failed. Null where the row is folded.
   */
  line: WorkLine | null;
  /** The receipt's second line, where the day's end moves: "ends 23:45, not 20:45". */
  end: string | null;
  /** A failure another try might mend offers "Ask again": not our limit, nor a refusal. */
  canAskAgain: boolean;
}

/** What the page knows of a changed word, as its fork rows tell it. */
export interface ForkViewInput {
  /** The change as the page tells it (`ReplanControls`). */
  replan: ReplanControls;
  /** A part's proposal while it streams beside the day (`replanFrameOf`); null otherwise. */
  frame: ReplanFrame | null;
  /** A beat has passed since the press: until then the search is not said. */
  isLookingDue: boolean;
}

/** Failures another try will meet again: our limit, and a refusal. */
const ASKED_IN_VAIN: ReadonlySet<ReplanEnding> = new Set(["limited", "refused"]);

/** A word's answer as its vocabulary names it, from the sentence's label or the value itself. */
function valueOf(word: WorkChange["word"], answer: string): string {
  return (
    FACT_OPTIONS[word].find(({ label, value }) => label === answer || value === answer)?.value ??
    answer
  );
}

/**
 * Where a whole day's proposal stands, from how far its stream is written: looking until its
 * first stop, then its stops, then their versions. Its line about the day, written first, is no
 * moment of its own: said, it stood for 23 s of the bench's 25.
 */
function wholeMomentOf(written: ReplanWritten | null): WorkMoment {
  if (written === null || written.stops === 0) return { kind: "looking" };
  if (written.versioning > 0) {
    return { kind: "versions", written: written.versioning, of: written.stops };
  }
  return { kind: "stops", written: written.stops };
}

/**
 * The fork rows' view of a changed word, as the page tells it: while Lantern writes, a part's
 * moment from its frame and a whole day's from how far its stream is written; once whole, the
 * receipt of the version beside the day; folded once a version is chosen, until compared; and
 * why it ended without a proposal. None at rest.
 */
export function forkViewOf({ replan, frame, isLookingDue }: ForkViewInput): ForkView | null {
  const { status, change, reach } = replan;
  if (status === "idle" || change === null || reach === null) return null;
  const work: WorkChange = {
    word: change.word,
    from: change.from,
    isFromAsked: change.from === ASKED_LABELS[change.word],
    toValue: valueOf(change.word, change.to),
    to: change.to,
  };
  const isChosen = status === "taken" || status === "left";
  const base = {
    from: change.from,
    to: change.to,
    chosen: status === "taken" ? ("to" as const) : ("from" as const),
    isWriting: status === "writing",
    isReady: status === "proposed",
    isChosen,
    isCompared: replan.isCompared,
    isComparable: isChosen && reach === "part",
    isFailed: status === "failed",
    canAskAgain: false,
  };
  if (status === "writing") {
    const moment =
      reach === "whole"
        ? wholeMomentOf(replan.written)
        : frame === null
          ? { kind: "looking" as const }
          : partMomentOf(frame);
    const line = workLineOf(work, reach, moment);
    // Its row stands from the press; its words come a beat later.
    const said = moment.kind === "looking" && !isLookingDue ? { ...line, words: "" } : line;
    return { ...base, line: said, end: null };
  }
  if (status === "failed") {
    const ending = replan.ending ?? "invalid";
    const said = replanEndedOf(ending, change.word, reach);
    return {
      ...base,
      line: workLineOf(work, reach, { kind: "failed", said }),
      end: null,
      canAskAgain: !ASKED_IN_VAIN.has(ending),
    };
  }
  const receipt = replan.receipt;
  const isReceiptSaid = receipt !== null && (status === "proposed" || replan.isCompared);
  return {
    ...base,
    line: isReceiptSaid ? { words: receipt.words, count: null, isWorking: false } : null,
    end: isReceiptSaid ? receipt.end : null,
  };
}

/** How far a whole day's stream is written, which the day held on screen does not show. */
export function writtenOf(partial: PartialDay | null): ReplanWritten {
  const stops = placedStopsOf(partial?.stops).length;
  // The set being written counts, so the last is said, "8 of 8".
  const versioning = Math.min(stops, partial?.alternatives?.length ?? 0);
  return { stops, versioning };
}

/**
 * What a whole day written again kept of the day before: its stops at places the day before
 * did not have, and those at the same places, by spelling.
 */
export function placesKeptOf(
  before: readonly { primary: Pick<Stop["primary"], "name"> }[],
  after: readonly { primary: Pick<Stop["primary"], "name"> }[],
): ReplanPlaces {
  const same = after.filter((stop) =>
    before.some((old) => isSameSpelling(old.primary.name, stop.primary.name)),
  ).length;
  return { added: after.length - same, same, later: 0, earlier: 0 };
}
