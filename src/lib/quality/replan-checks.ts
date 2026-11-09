import {
  droppedStopsOf,
  mergeReplan,
  type MergeRepair,
  type MergeResult,
  type ReplanBasis,
  replannedFactsOf,
} from "@/lib/replan/merge";
import { ASSUMABLE_FACT_KEYS, type Itinerary, type Stop } from "@/lib/schema/itinerary.schema";
import { GeneratedReplanSchema } from "@/lib/schema/replan.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import { formatClock, runningSpans } from "@/lib/time/clock";
import { timeWordMissOf, type CheckId, type CheckResult } from "./checks";
import { formatPath } from "./path";

/** What each of the merge's repairs says the model wrote. */
const FAULTS: Readonly<Record<MergeRepair["kind"], string>> = {
  "outside-windows": "outside the windows asked for",
  "shortened-at-kept": "runs into a kept stop",
  "dropped-at-kept": "runs into a kept stop",
  "dropped-repeat": "repeats a kept place",
  "yielded-version": "takes a kept stop's version off screen",
};

/** What the normalizer's drop of a new stop says, beside the merge's faults. */
const NORMALIZER_DROP = "the normalizer drops it";

/**
 * More than this between one stop's end and the next one's start is a hole in the day
 * (`replan-gap`): production's Elche evening stood empty from 17:30 to 21:00, three and a half
 * hours, where its kept day had no stretch past 45 minutes.
 */
export const MAX_GAP_MINUTES = 120;

const UNREAD = "not a re-plan the merge can read";

/**
 * `replan-windows` (`docs/targeted-replan.md`, section 6): hard, on a targeted re-plan as the
 * model wrote it, before the merge repairs it. Each new stop outside every window, running
 * into a kept stop or repeating a kept place is a finding, and so is a window left empty, which
 * fails the re-plan. The merge cuts a stop short or drops it, and a re-plan with a dropped stop
 * is never shown (`mergeShownReplan`); the eval counts how often the model needed either, as
 * `repairs` does for a day. A kept stop's version off screen given up to a new stop is no
 * finding: the prompt names no kept options, so the model cannot know the place was one.
 */
export function checkReplanWindows(basis: ReplanBasis, output: unknown): CheckResult {
  const parsed = GeneratedReplanSchema.safeParse(output);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const where = issue === undefined ? "" : `${formatPath(issue.path) || "re-plan"}: `;
    return result([`${where}${issue?.message ?? "not a re-plan"}`]);
  }
  const merged = mergeReplan({ ...basis, replan: withLettersUnescaped(parsed.data) });
  const findings = merged.mergeRepairs
    .filter(({ kind }) => kind !== "yielded-version")
    .map(({ kind, path, note }) => `${formatPath(path)}: ${FAULTS[kind]}, ${note}`);
  return result(merged.ok ? findings : [...findings, merged.reason]);
}

function result(findings: string[], id: CheckId = "replan-windows"): CheckResult {
  return {
    id,
    kind: "hard",
    passed: findings.length === 0,
    value: null,
    threshold: null,
    findings,
  };
}

/**
 * The re-plan merged as the model wrote it, a dropped stop and all, so the checks read the day
 * it would have made; null for what is not a re-plan.
 */
function mergeOf(basis: ReplanBasis, output: unknown): MergeResult | null {
  const parsed = GeneratedReplanSchema.safeParse(output);
  if (!parsed.success) return null;
  return mergeReplan({ ...basis, replan: withLettersUnescaped(parsed.data) });
}

/**
 * A hard check on the day a re-plan merged into, or, when it did not merge, failed with why: a
 * re-plan that does not merge has no day to read.
 */
function onMergedDay(
  id: CheckId,
  basis: ReplanBasis,
  output: unknown,
  findingsOf: (merged: Itinerary) => string[],
): CheckResult {
  const merged = mergeOf(basis, output);
  if (merged === null) return result([UNREAD], id);
  if (!merged.ok) return result([merged.reason], id);
  return result(findingsOf(merged.itinerary), id);
}

/**
 * `replan-word`: hard, on the day a targeted re-plan merged into. The day keeps the word the
 * re-plan was written for, by the hours `time-words` reads: a re-plan is asked for one word, so
 * `time-words`, which passes a day that misses one of three, would pass one that missed it.
 * replan-v1's first live round missed it in two of four cases and passed `time-words` in both
 * (`docs/harness.md`, "The prompt versions", `replan-v1`). A re-plan that does not merge has no day
 * to keep it, and says why.
 */
export function checkReplanWord(basis: ReplanBasis, output: unknown): CheckResult {
  return onMergedDay("replan-word", basis, output, (merged) => {
    const miss = timeWordMissOf(merged, basis.changed);
    return miss === null ? [] : [miss];
  });
}

/**
 * `replan-time-words`: hard, on the day a targeted re-plan merged into. The day keeps every
 * word that sets its hours, start, dinner and end, the ones Lantern assumed as well as the
 * visitor's, since its headline says them all. `replan-word` reads the changed word alone, and
 * passed production's Elche evening, its dinner changed and kept at 21:00, while the end Lantern
 * had assumed early, "home by eleven", ran to 23:45 (`docs/decisions.md`, "A changed word proposes
 * its part beside the day, and the visitor takes it"). The words are the ones the re-plan was asked
 * to keep (`replannedFactsOf`), before the merged day says an end Lantern assumed as its hours keep
 * it: fitted, Elche's would read "out late" and pass.
 */
export function checkReplanTimeWords(basis: ReplanBasis, output: unknown): CheckResult {
  const asked = replannedFactsOf(basis);
  return onMergedDay("replan-time-words", basis, output, (merged) =>
    ASSUMABLE_FACT_KEYS.flatMap((key) => timeWordMissOf({ ...merged, facts: asked }, key) ?? []),
  );
}

/**
 * `replan-drops`: hard, the count of new stops the merge left out of the day, and why each:
 * outside every window, no time left before a kept stop, a kept place, or a stop the normalizer
 * cannot show. Any drop fails the re-plan for the visitor (`mergeShownReplan`), so the log counts
 * how often the model cost a visitor their re-plan this way.
 */
export function checkReplanDrops(basis: ReplanBasis, output: unknown): CheckResult {
  const merged = mergeOf(basis, output);
  if (merged === null) return { ...result([UNREAD], "replan-drops"), value: null };
  const findings = droppedStopsOf(merged).map(({ kind, path, note }) => {
    const fault = kind === "dropped-stop" ? NORMALIZER_DROP : FAULTS[kind as MergeRepair["kind"]];
    return `${formatPath(path)}: ${fault}, ${note}`;
  });
  return { ...result(findings, "replan-drops"), value: findings.length };
}

/** A stretch of the day with no stop in it, in running minutes, and the stops either side. */
interface Gap {
  from: number;
  to: number;
  after: Stop;
  before: Stop;
}

function gapsOf({ stops }: Itinerary): Gap[] {
  const spans = runningSpans(stops);
  return spans.slice(1).flatMap((span, index): Gap[] => {
    const previous = spans[index];
    const after = stops[index];
    const before = stops[index + 1];
    if (previous === undefined || after === undefined || before === undefined) return [];
    if (span.from - previous.to <= MAX_GAP_MINUTES) return [];
    return [{ from: previous.to, to: span.from, after, before }];
  });
}

/**
 * `replan-gap`: hard, on the day a targeted re-plan merged into. No stretch between two stops
 * runs past `MAX_GAP_MINUTES` unless the kept day had one there too, at least in part: a hole
 * the re-plan opened, by a drop or by too few stops, is a part of the day the visitor asked for
 * and was not given.
 */
export function checkReplanGap(basis: ReplanBasis, output: unknown): CheckResult {
  const before = gapsOf(basis.itinerary);
  const wasThere = (gap: Gap) => before.some((old) => old.from < gap.to && gap.from < old.to);
  return onMergedDay("replan-gap", basis, output, (merged) =>
    gapsOf(merged)
      .filter((gap) => !wasThere(gap))
      .map(
        ({ from, to, after, before }) =>
          `${formatClock(from)} to ${formatClock(to)} stands empty, ${to - from} minutes, between ${after.primary.name} and ${before.primary.name}`,
      ),
  );
}
