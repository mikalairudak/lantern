import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { LanguageModelUsage } from "ai";

/**
 * Which Claude writes what, how it thinks, and what each call costs (`docs/decisions.md`,
 * "Sonnet writes the day, and Haiku writes it again, unseen, for comparison").
 */

/**
 * The three calls Lantern makes: the visitor's day, the same day unseen, and the intake. A
 * targeted re-plan is made in the day's role: the role picks its model and thinking, and the
 * archive opens its record as it opens a day's (`generation-log.ts`, `context`).
 */
export type CallRole = "day" | "shadow" | "intake";

export const MODEL_IDS = {
  day: "claude-sonnet-5-5",
  shadow: "claude-haiku-5-5",
  intake: "claude-haiku-5-5",
} as const satisfies Record<CallRole, string>;

export type ModelId = (typeof MODEL_IDS)[CallRole];

/**
 * Thinking off on every call. Sonnet 5.5 thinks adaptively by default at `high` effort, and its
 * thinking is output: paid at the output price, counted against `maxOutputTokens`, and spent before
 * the first words stream, while the waiting line was designed for about 1.4 s of quiet. A day is a
 * structured plan whose fields the schema already orders, so every call asks for the words at once:
 * at the old 8,000-token cap, the first live key's day spent 7,999 tokens thinking and wrote
 * nothing (`docs/harness.md`, "The first live key"). Sonnet 5.5 answers `disabled` with a 400 and
 * the provider swaps in `between_tools` with a warning, so it is asked for by name; with no tools
 * in the call it means no thinking. Haiku 5.5 takes `disabled` at its default effort. The shadow
 * matches the day so a pair compares the models, not their settings.
 */
export const THINKING = {
  day: { type: "between_tools" },
  shadow: { type: "disabled" },
  intake: { type: "disabled" },
} as const satisfies Record<CallRole, AnthropicLanguageModelOptions["thinking"]>;

/** The provider options each call sends. No `temperature`: the 5.5 models ignore it. */
export function providerOptionsFor(role: CallRole): {
  anthropic: { thinking: (typeof THINKING)[CallRole] };
} {
  return { anthropic: { thinking: THINKING[role] } };
}

/**
 * The most the visitor's day may write (`docs/decisions.md`, "Every model call holds its worst case
 * against the spend caps before it is made"). The first live key measured a day's JSON at about 2.4
 * characters a token, not the four the curated days were estimated at: a lively Kyoto day wrote
 * 6,439 tokens on Sonnet, where the old cap of 8,000 left it 24% room (`docs/harness.md`, "The
 * first live key"). A day that reaches it ends `cut`.
 */
export const DAY_MAX_OUTPUT_TOKENS = 12_000;
/**
 * The most the shadow may write, its own cap so the two can part. Haiku's days ran from 3,043
 * tokens to past 8,000 on the same request, and a shadow cut short pairs with nothing.
 */
export const SHADOW_MAX_OUTPUT_TOKENS = 12_000;
/** An intake is about 150 tokens; this caps a runaway one. */
export const INTAKE_MAX_OUTPUT_TOKENS = 1_000;
/**
 * The most a targeted re-plan may write, half the day's (`docs/targeted-replan.md`, section 2):
 * a day of about eight stops runs to about 6,500 tokens, and a re-plan's windows hold two or
 * three stops, rarely six.
 */
export const REPLAN_MAX_OUTPUT_TOKENS = 6_000;

/**
 * Generous ceilings on what a call reads: the instructions, the schema and the request, with
 * the provider's own wrapping of the schema. They only size what a call may cost before it is
 * made (`worstCaseUsd`); a call is charged what the provider reports. The day route caps the
 * city's length and the intake the text's, so a request cannot carry the input past these.
 * The provider counts about 2.2 characters a token on these calls: `day-v8`'s golden round
 * read 8,503 to 8,517 tokens a day (2026-10-31), past the 8,000 the day had, so the day's
 * hold was short by about a tenth of a cent. A test counts each call's characters at 2.
 */
export const DAY_INPUT_TOKENS_CEILING = 10_000;
export const INTAKE_INPUT_TOKENS_CEILING = 4_000;
/**
 * A re-plan reads its own instructions and schema, about 8,200 tokens at the provider's
 * count, and the kept stops and windows besides, which the request bounds
 * (`src/lib/replan/request.ts`): at most 16 stops of names and neighbourhoods up to 120
 * characters, under 3,000 tokens however they are written. Its first probe read about 8,670
 * on the written Kyoto morning.
 */
export const REPLAN_INPUT_TOKENS_CEILING = 12_000;

interface PricePerMillion {
  input: number;
  output: number;
}

/**
 * US dollars per million tokens, for prompts under Haiku's 100K tier. From Anthropic's published
 * pricing (read 2026-10-28). Thinking is billed as output. Cache reads are cheaper than input, but
 * these calls write no cache, so every input token is priced as input.
 */
export const PRICES_PER_MILLION: Readonly<Record<ModelId, PricePerMillion>> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

const TOKENS_PER_MILLION = 1_000_000;

/** What a call costs from the usage the provider reported; null when it reported none. */
export function costOf(model: ModelId, usage: LanguageModelUsage | undefined): number | null {
  if (usage?.inputTokens === undefined || usage.outputTokens === undefined) return null;
  const price = PRICES_PER_MILLION[model];
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / TOKENS_PER_MILLION;
}

/** The most a call can cost: its input ceiling read and its output cap written. */
export function worstCaseUsd(model: ModelId, inputTokens: number, outputTokens: number): number {
  const price = PRICES_PER_MILLION[model];
  return (inputTokens * price.input + outputTokens * price.output) / TOKENS_PER_MILLION;
}
