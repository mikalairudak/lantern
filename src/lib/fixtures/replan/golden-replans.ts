import { z } from "zod";
import { normalizeDay } from "@/lib/normalizer/normalize";
import {
  AssumableFactKeySchema,
  DayRequestSchema,
  GeneratedDaySchema,
  type AssumableFactKey,
  type DayRequest,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import type { ReplanPicks } from "@/lib/replan/request";
import type { WindowSpan } from "@/lib/replan/windows";

/**
 * The targeted re-plan's golden set (`docs/targeted-replan.md`, section 6): days Sonnet wrote in
 * live rounds, each with a word to change and the windows that change should rewrite, written
 * by hand from the day's own stops. One `golden-replans.jsonl` line a case. The merge, the
 * windows and `replan-windows` are tested on them with no call; a live re-plan round sends them.
 * Beside the four the contract names, an end changed to home by eight and a start changed while
 * the visitor shows other versions of the kept stops (`docs/decisions.md`, "The end of the day is
 * said in real hours", "A re-plan reads its day from the server's own records").
 */

const GoldenReplanSchema = z.strictObject({
  name: z.string(),
  /**
   * The live round that wrote the day, by its prompt version and date, and the request's place in
   * that round's saved records.
   */
  source: z.string(),
  /** The request the day was written for. */
  request: DayRequestSchema,
  changed: AssumableFactKeySchema,
  /** The changed word's new value. */
  value: z.string(),
  /** The windows a careful reader marks for the change, by the stops' indices. */
  windows: z.array(z.strictObject({ from: z.number().int(), to: z.number().int() })),
  /** The versions the visitor shows in place of the plan, by stop id; none for most cases. */
  picks: z.record(z.string(), z.string()).default({}),
  /** How many times a round sends the case: more than once to see how a model's answers vary. */
  runs: z.number().int().min(1).default(1),
  /**
   * Whose windows the round's route writes into: the route's own, read from the day as it
   * reads any day, or the ones marked here by hand, for a rule the route has not taken up yet,
   * as windows a word no stop names could be given by what it means.
   */
  windowsFrom: z.enum(["route", "hand"]).default("route"),
  /** The model's text, byte for byte. */
  outputText: z.string(),
});

export interface GoldenReplan {
  name: string;
  source: string;
  /** The day as the page held it before the word changed. */
  itinerary: Itinerary;
  /** The request with the changed word. */
  request: DayRequest;
  changed: AssumableFactKey;
  windows: WindowSpan[];
  /** The places the visitor chose over the plan, by stop id, as the page sends them. */
  picks: ReplanPicks;
  /** How many times a round sends it. */
  runs: number;
  /** Whose windows the round's route writes into (`GoldenReplanSchema`). */
  windowsFrom: "route" | "hand";
  /** The request the day was written for, before the word changed, as the log keeps it. */
  dayRequest: DayRequest;
  /** The model's text of the day, byte for byte, as the log keeps it. */
  outputText: string;
}

/** The golden set's cases, from the file's text; throws on a line that is not one. */
export function goldenReplansOf(text: string): GoldenReplan[] {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const entry = GoldenReplanSchema.parse(JSON.parse(line));
      const day = GeneratedDaySchema.parse(JSON.parse(entry.outputText));
      const normalized = normalizeDay(entry.request, withLettersUnescaped(day));
      if (!normalized.ok) throw new Error(`${entry.name}: ${normalized.reason}`);
      const request = DayRequestSchema.parse({ ...entry.request, [entry.changed]: entry.value });
      return {
        name: entry.name,
        source: entry.source,
        itinerary: normalized.itinerary,
        request,
        changed: entry.changed,
        windows: entry.windows,
        picks: entry.picks,
        runs: entry.runs,
        windowsFrom: entry.windowsFrom,
        dayRequest: entry.request,
        outputText: entry.outputText,
      };
    });
}
