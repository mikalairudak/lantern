import { createAnthropic } from "@ai-sdk/anthropic";
import { Output, streamText, type LanguageModelUsage } from "ai";
import { z } from "zod";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { distanceInMeters } from "@/lib/geo/distance";
import { DAY_INSTRUCTIONS, DAY_PROMPT_VERSION, dayPromptFor } from "@/lib/live/day-prompt";
import type { StreamingModel } from "@/lib/live/streamed-call";
import { costOf, MODEL_IDS, providerOptionsFor, type ModelId } from "@/lib/live/models";
import { describeProviderError } from "@/lib/live/provider-error";
import {
  REPLAN_INSTRUCTIONS,
  REPLAN_PROMPT_VERSION,
  replanPromptFor,
  type ReplanPromptInput,
} from "@/lib/live/replan-prompt";
import {
  CompassPointSchema,
  GeneratedAlternativeSetSchema,
  GeneratedDaySchema,
  GeneratedLightProfileSchema,
  GeneratedPlaceSchema,
  GeneratedStopSchema,
  LightWindowSchema,
} from "@/lib/schema/itinerary.schema";
import { GeneratedReplanSchema } from "@/lib/schema/replan.schema";
import { PROBE_MAX_OUTPUT_TOKENS, PROBE_ROLES, usd, type ProbeRole as DayRole } from "./round";

/**
 * Whether Anthropic takes the day's schema, asked before any round (`docs/decisions.md`, "The
 * model's schema keeps its union types few"). The provider compiles a structured output's
 * schema into a grammar before it writes a word and refuses one too large with a 400, which
 * costs nothing; the limit has no number to check offline. The probe first asks Claude's token
 * count, which is free, with the day's schema and with a control built as `day-v3`'s refused one:
 * when the count refuses the control, it compiles the grammar too, and its answer on the day's
 * schema stands. Otherwise each model gets one call with the day's own instructions, schema and a
 * request, held to a few output tokens.
 */

/**
 * The day's schema as the `day-v3` round sent it, its structure at least: a place's fare
 * and its light's direction and window nullable, eleven union types, which the provider
 * refused as "The compiled grammar is too large". Descriptions are not part of the grammar.
 */
const ControlLightSchema = GeneratedLightProfileSchema.extend({
  orientation: CompassPointSchema.nullable().describe("Direction the main view or facade faces."),
  bestWindow: LightWindowSchema.nullable().describe("When the light here is at its best."),
});
// The fare stood right after the kind, where the refused schema had it; day-v4 has none.
const { name, kind, ...placeAfterKind } = GeneratedPlaceSchema.shape;
const ControlPlaceSchema = z.strictObject({
  name,
  kind,
  fare: z.string().nullable().describe("What to eat or drink here."),
  ...placeAfterKind,
  light: ControlLightSchema.describe("How light falls on the place through the day."),
});
export const RefusedControlSchema = GeneratedDaySchema.extend({
  stops: z
    .array(GeneratedStopSchema.extend({ place: ControlPlaceSchema.describe("Where.") }))
    .min(1)
    .describe("The stops."),
  alternatives: z
    .array(
      GeneratedAlternativeSetSchema.extend({
        options: z
          .array(ControlPlaceSchema.extend({ reason: z.string().describe("Why.") }))
          .describe("The options."),
      }),
    )
    .describe("The alternatives."),
});

/** Any schema a call could be constrained to: the day's, a re-plan's, or the control. */
type Schema = z.ZodType;

/**
 * What a probe asks about: a call's schema with its own instructions and a request of its
 * kind, on the models that make that call, and what may follow once the provider takes it.
 */
export interface ProbeTarget {
  version: string;
  schema: Schema;
  instructions: string;
  prompt: string;
  roles: readonly DayRole[];
  /** What the report says may follow: "a day round". */
  next: string;
}

export const DAY_PROBE: ProbeTarget = {
  version: DAY_PROMPT_VERSION,
  schema: GeneratedDaySchema,
  instructions: DAY_INSTRUCTIONS,
  prompt: dayPromptFor(KYOTO_REQUEST),
  roles: PROBE_ROLES,
  next: "a day round",
};

/**
 * A re-plan of the written Kyoto day, its early start changed to a slow one: the morning's two
 * stops are written again, before the garden at ten, and the rest is kept.
 */
const KEPT_FROM = 2;
const stops = KYOTO_DAY.day.stops;
const firstKept = stops[KEPT_FROM];
const keptStops = stops.slice(KEPT_FROM);
export const SAMPLE_REPLAN: ReplanPromptInput = {
  request: { ...KYOTO_REQUEST, start: "slow" },
  changed: "start",
  // The written day's words, its start changed: what it assumed, and the company it asked about.
  facts: {
    energy: { value: KYOTO_REQUEST.energy, source: KYOTO_REQUEST.energySource },
    travel: { value: "on-foot", source: "assumed" },
    start: { value: "slow", source: "chosen" },
    dinner: { value: "early", source: "assumed" },
    end: { value: "early", source: "assumed" },
    company: { value: null, source: "asked" },
  },
  kept: keptStops.map(({ startTime, durationMinutes, place }) => ({
    startTime,
    durationMinutes,
    name: place.name,
    kind: place.kind,
    neighborhood: place.neighborhood,
    coordinates: place.coordinates,
    energy: place.sensory.energy,
  })),
  windows: [
    {
      after: null,
      before:
        firstKept === undefined
          ? null
          : { startTime: firstKept.startTime, name: firstKept.place.name },
      // A slow start has a limit alone, so its window gives no hour to reach.
      dayStartsAt: null,
      dayEndsAt: null,
      oldStops: stops
        .slice(0, KEPT_FROM)
        .map(({ place }) => ({ name: place.name, kind: place.kind })),
    },
  ],
  keptFlowMeters: Math.round(
    keptStops.reduce((sum, { place }, index) => {
      const previous = keptStops[index - 1];
      return previous === undefined
        ? sum
        : sum + distanceInMeters(previous.place.coordinates, place.coordinates);
    }, 0),
  ),
};

/** A re-plan is written by the day's model alone: it has no shadow (`docs/targeted-replan.md`). */
export const REPLAN_PROBE: ProbeTarget = {
  version: REPLAN_PROMPT_VERSION,
  schema: GeneratedReplanSchema,
  instructions: REPLAN_INSTRUCTIONS,
  prompt: replanPromptFor(SAMPLE_REPLAN),
  roles: ["day"],
  next: "a re-plan round",
};

function callOptions(role: DayRole, schema: Schema, target: ProbeTarget = DAY_PROBE) {
  return {
    instructions: target.instructions,
    prompt: target.prompt,
    output: Output.object({ schema }),
    maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    providerOptions: providerOptionsFor(role),
  };
}

/** A request as the day's call would send it: its body, and the betas it names, if any. */
export interface CapturedRequest {
  body: Record<string, unknown>;
  beta: string | null;
}

/**
 * The request the day's call sends for a schema, as `@ai-sdk/anthropic` writes it, caught
 * before it leaves: the probe counts the same request the day makes.
 */
export async function requestOf(
  role: DayRole,
  schema: Schema,
  target: ProbeTarget = DAY_PROBE,
): Promise<CapturedRequest> {
  const captured: CapturedRequest = { body: {}, beta: null };
  const offline = createAnthropic({
    authToken: "offline",
    fetch: (_url, init) => {
      captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      captured.beta = new Headers(init?.headers).get("anthropic-beta");
      return Promise.resolve(new Response(null, { status: 418 }));
    },
  });
  const result = streamText({
    model: offline(MODEL_IDS[role]),
    ...callOptions(role, schema, target),
    onError: () => undefined,
  });
  await result.consumeStream();
  return captured;
}

/** What a message takes that a token count does not. */
const MESSAGE_ONLY_KEYS: ReadonlySet<string> = new Set(["stream", "max_tokens"]);

/** What Claude's token count is asked: the call's own request, less what only a message takes. */
export function countRequestOf({ body, beta }: CapturedRequest): CapturedRequest {
  const counted = Object.entries(body).filter(([key]) => !MESSAGE_ONLY_KEYS.has(key));
  return { body: Object.fromEntries(counted), beta };
}

export const COUNT_TOKENS_URL = "https://api.anthropic.com/v1/messages/count_tokens";
export const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Claude's token count on a key, by plain `fetch`: `@ai-sdk/anthropic` has no call for it, and
 * one endpoint for an eval does not earn the official SDK as a dependency. The key goes in a
 * header and never into what is returned.
 */
export function countTokensOn(
  apiKey: string,
  send: typeof fetch = globalThis.fetch,
): (request: CapturedRequest) => Promise<ApiAnswer> {
  return async ({ body, beta }) => {
    const response = await send(COUNT_TOKENS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        ...(beta === null ? {} : { "anthropic-beta": beta }),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // A body that is not JSON is kept as its text.
    }
    return { status: response.status, body: parsed };
  };
}

/** An answer of Claude's API: its status and parsed body. */
export interface ApiAnswer {
  status: number;
  body: unknown;
}

const GRAMMAR_REFUSAL = /compiled grammar is too large|schema is too complex/i;

function messageIn(body: unknown): string {
  const error = (body as { error?: { message?: unknown } } | null)?.error;
  return typeof error?.message === "string" ? error.message : "";
}

/** Whether an answer is the provider refusing the schema's grammar, the probe's one refusal. */
export function isGrammarRefusal({ status, body }: ApiAnswer): boolean {
  return status === 400 && GRAMMAR_REFUSAL.test(messageIn(body));
}

export interface ProbeServices {
  /** Claude's token count, `POST /v1/messages/count_tokens`, on the server's key. */
  countTokens: (request: CapturedRequest) => Promise<ApiAnswer>;
  /** The model a role's call is written by, on the server's key. */
  modelOf: (role: DayRole) => StreamingModel;
}

export type ProbeVerdict = "taken" | "refused";

export interface RoleProbe {
  role: DayRole;
  model: ModelId;
  verdict: ProbeVerdict;
  /** "count" when the free token count settled it, "call" when it took a call. */
  by: "count" | "call";
  costUsd: number;
  /** The provider's message for a refusal, or how the call ended. */
  detail: string;
  requestId: string | null;
}

export interface SchemaProbe {
  /** Whether the token count refused the control, and so compiles the grammar. */
  isCountConclusive: boolean;
  roles: RoleProbe[];
}

interface CallEnding {
  error: unknown;
  usage: LanguageModelUsage | undefined;
  finishReason: string | null;
}

async function callOnce(
  model: StreamingModel,
  role: DayRole,
  target: ProbeTarget,
): Promise<CallEnding> {
  const ending: CallEnding = { error: null, usage: undefined, finishReason: null };
  const result = streamText({
    model,
    ...callOptions(role, target.schema, target),
    onError: ({ error }) => {
      ending.error = error;
    },
    onFinish: ({ totalUsage, finishReason }) => {
      ending.usage = totalUsage;
      ending.finishReason = finishReason;
    },
  });
  await result.consumeStream();
  return ending;
}

async function probeByCall(
  services: ProbeServices,
  role: DayRole,
  target: ProbeTarget,
): Promise<RoleProbe> {
  const model = MODEL_IDS[role];
  const { error, usage, finishReason } = await callOnce(services.modelOf(role), role, target);
  const costUsd = costOf(model, usage) ?? 0;
  if (error === null) {
    return {
      role,
      model,
      verdict: "taken",
      by: "call",
      costUsd,
      detail: `wrote until ${finishReason}`,
      requestId: null,
    };
  }
  const described = describeProviderError(error);
  const isRefusal = isGrammarRefusal({
    status: described.status ?? 0,
    body: { error: { message: described.message } },
  });
  if (!isRefusal) throw new Error(`The probe's call failed otherwise: ${described.message}`);
  return {
    role,
    model,
    verdict: "refused",
    by: "call",
    costUsd,
    detail: described.message,
    requestId: described.requestId,
  };
}

async function countOf(
  services: ProbeServices,
  role: DayRole,
  schema: Schema,
  target: ProbeTarget = DAY_PROBE,
): Promise<ApiAnswer> {
  return services.countTokens(countRequestOf(await requestOf(role, schema, target)));
}

/**
 * The probe: the token count on the control and the target's schema for each of its models,
 * and a call for a model whose count cannot tell. A refusal by the count needs no call either
 * way. The control is the day's refused schema whatever the target, since it only tells whether
 * the count compiles the grammar.
 */
export async function probeSchema(
  services: ProbeServices,
  target: ProbeTarget = DAY_PROBE,
): Promise<SchemaProbe> {
  const control = await countOf(services, "day", RefusedControlSchema);
  const isCountConclusive = isGrammarRefusal(control);
  const roles: RoleProbe[] = [];
  for (const role of target.roles) {
    const counted = await countOf(services, role, target.schema, target);
    const model = MODEL_IDS[role];
    if (isGrammarRefusal(counted)) {
      roles.push({
        role,
        model,
        verdict: "refused",
        by: "count",
        costUsd: 0,
        detail: messageIn(counted.body),
        requestId: null,
      });
    } else if (isCountConclusive && counted.status === 200) {
      roles.push({
        role,
        model,
        verdict: "taken",
        by: "count",
        costUsd: 0,
        detail: "counted",
        requestId: null,
      });
    } else {
      roles.push(await probeByCall(services, role, target));
    }
  }
  return { isCountConclusive, roles };
}

/** The probe as a reader takes it in, ending on whether the target's round may follow. */
export function probeReport(
  { isCountConclusive, roles }: SchemaProbe,
  target: ProbeTarget = DAY_PROBE,
): string[] {
  const spent = roles.reduce((sum, { costUsd }) => sum + costUsd, 0);
  const isTaken = roles.every(({ verdict }) => verdict === "taken");
  return [
    `Schema probe: ${target.version}'s schema, spent ${usd(spent)}.`,
    isCountConclusive
      ? "  The token count refused the control built as day-v3's schema, so it compiles the grammar: its answers stand."
      : "  The token count took the control day-v3's call refused, so it cannot tell: each model got a call.",
    ...roles.map(
      ({ role, model, verdict, by, costUsd, detail, requestId }) =>
        `  ${role} on ${model}: ${verdict} by the ${by === "count" ? "token count" : "call"}, ${usd(costUsd)}; ${detail}${requestId === null ? "" : ` (${requestId})`}.`,
    ),
    isTaken
      ? `The provider takes the schema: ${target.next} may follow.`
      : `The provider refuses the schema: no ${target.next.replace(/^an? /, "")} until it is simpler.`,
  ];
}
