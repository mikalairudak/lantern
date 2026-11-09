import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import type { StreamingModel } from "@/lib/live/streamed-call";
import { ENERGY_LEVELS, SWAP_RADIUS_METERS } from "@/lib/schema/itinerary.schema";

/**
 * A day round's shadow, changed for one round only (`EVAL_SHADOW_EFFORT`, `EVAL_SHADOW_RULE`),
 * to try Haiku in another setting without touching the route: the visitor's day, its prompt and
 * Sonnet's call stay as production sends them, and the change is made on the shadow's call in
 * the round's own process. Round A found Haiku's days keep fewer versions than Sonnet's
 * (`docs/harness.md`, "Round A"); these are the two cheap tries that could change the answer.
 */

/** Haiku's call sets no effort, so it runs at its default, `medium`; a round may set one. */
export const SHADOW_EFFORTS = ["low", "medium", "high"] as const;
export type ShadowEffort = (typeof SHADOW_EFFORTS)[number];

export const SHADOW_RULES = ["versions"] as const;
export type ShadowRule = (typeof SHADOW_RULES)[number];

export interface ShadowExperiment {
  effort: ShadowEffort | null;
  rule: ShadowRule | null;
}

export const NO_EXPERIMENT: ShadowExperiment = { effort: null, rule: null };

const QUIETEST = ENERGY_LEVELS[0];
const LIVELIEST = ENERGY_LEVELS[ENERGY_LEVELS.length - 1];

/**
 * The day's own rules for versions (`SHARED_PLAN_RULES`), said again as a check to make before
 * the alternatives are written, at the end of the instructions, where nothing comes after it.
 * Nothing in it is new: it tries whether saying it last makes Haiku keep it.
 */
export const VERSIONS_RULE = `Before you write the alternatives, check every stop in turn:
1. It has its own entry in alternatives, with its stopIndex. No stop is left without one.
2. Each of its options stands within ${SWAP_RADIUS_METERS} m of the stop's coordinates in a straight line: the same street or the next few, never across the district.
3. One option is at an energy level below the stop's own and one above it. A ${QUIETEST} stop gets only the livelier one, a ${LIVELIEST} stop only the quieter one. Never the stop's own level, never two on one side.
When no place of the stop's kind is that close at the level an option needs, keep the level and the walk and take a nearby place of another kind that serves the same moment.`;

const RULES: Readonly<Record<ShadowRule, string>> = { versions: VERSIONS_RULE };

/** How a round says what it changed, or null for a shadow as production sends it. */
export function experimentLabel({ effort, rule }: ShadowExperiment): string | null {
  const parts = [
    ...(effort === null ? [] : [`effort ${effort}`]),
    ...(rule === null ? [] : [`the ${rule} rule after the day's instructions`]),
  ];
  return parts.length === 0 ? null : parts.join(", ");
}

/** Sets the effort and adds the rule to the first system message, leaving everything else. */
export function experimentMiddleware({ effort, rule }: ShadowExperiment): LanguageModelMiddleware {
  return {
    transformParams: async ({ params }) => {
      const first = params.prompt.findIndex((message) => message.role === "system");
      const prompt =
        rule === null || first === -1
          ? params.prompt
          : params.prompt.map((message, index) =>
              index === first && message.role === "system"
                ? { ...message, content: `${message.content}\n\n${RULES[rule]}` }
                : message,
            );
      const providerOptions =
        effort === null
          ? params.providerOptions
          : {
              ...params.providerOptions,
              anthropic: { ...params.providerOptions?.anthropic, effort },
            };
      return { ...params, prompt, providerOptions };
    },
  };
}

/** The shadow's model for a round: as given, or wrapped to make the round's one change. */
export function shadowModelFor(
  model: StreamingModel,
  experiment: ShadowExperiment,
): StreamingModel {
  if (experimentLabel(experiment) === null) return model;
  return wrapLanguageModel({ model, middleware: experimentMiddleware(experiment) });
}
