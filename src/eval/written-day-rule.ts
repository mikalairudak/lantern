import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import type { StreamingModel } from "@/lib/live/streamed-call";
import { withRuleAfterInstructions } from "./shadow-experiment";

/**
 * A rule a day round says to the day's own call alone, after the day's instructions
 * (`EVAL_DAY_RULE`), for a round that writes days the site keeps (`docs/decisions.md`, "The
 * public site offers only days the product wrote"). A written day is shown on later dates of its
 * weekday than the one it was written for, which its words cannot know, so it is written under
 * the visitor's prompt and this one rule. The route and the live prompt never send it: a
 * visitor's day is read on its own date.
 */

export const DAY_RULES = ["undated"] as const;
export type DayRule = (typeof DAY_RULES)[number];

/**
 * Words that stay true on every date a written day is shown: no month or season, and no clock
 * time for the sun, which the page draws for each date itself. The light is still said, as what
 * it does at the place and the hour.
 */
export const UNDATED_RULE = `This day is kept and shown again on the same weekday for weeks after its date, and the page draws each date's sunrise, sunset and dark itself. So that every line stays true on each of those dates:
1. Never name the month or the season, or anything only one time of year has.
2. Never give a clock time for sunrise, sunset or dark, nor say when the light goes.
Say what the light does at the place and the hour instead, as the voice asks.`;

const RULES: Readonly<Record<DayRule, string>> = { undated: UNDATED_RULE };

/** How a round says what it changed on the day's call, or null for a day as production sends it. */
export function dayRuleLabel(rule: DayRule | null): string | null {
  return rule === null ? null : `the ${rule} rule after the day's instructions`;
}

/** Adds the rule to the day's first system message, leaving everything else as sent. */
function dayRuleMiddleware(rule: DayRule): LanguageModelMiddleware {
  return {
    transformParams: async ({ params }) => ({
      ...params,
      prompt: withRuleAfterInstructions(params.prompt, RULES[rule]),
    }),
  };
}

/** The day's model for a round: as given, or wrapped to say the round's rule. */
export function dayModelFor(model: StreamingModel, rule: DayRule | null): StreamingModel {
  if (rule === null) return model;
  return wrapLanguageModel({ model, middleware: dayRuleMiddleware(rule) });
}
