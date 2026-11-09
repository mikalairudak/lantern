import { writtenDayFor } from "@/lib/days/written/days";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { DAY_PROMPT_VERSION } from "@/lib/live/day-prompt";
import { REPLAN_PROMPT_VERSION } from "@/lib/live/replan-prompt";
import { liveConfigOf } from "@/lib/live/flag";
import { INTAKE_PROMPT_VERSION } from "@/lib/live/intake-prompt";
import { DAY_RESERVE_USD, SHADOW_RESERVE_USD } from "@/lib/live/live-day";
import { REPLAN_RESERVE_USD } from "@/lib/live/live-replan";
import {
  DAY_INPUT_TOKENS_CEILING,
  INTAKE_INPUT_TOKENS_CEILING,
  INTAKE_MAX_OUTPUT_TOKENS,
  MODEL_IDS,
  REPLAN_INPUT_TOKENS_CEILING,
  worstCaseUsd,
  type CallRole,
} from "@/lib/live/models";
import { MAX_CITY_READINGS } from "@/lib/normalizer/normalize-intake";
import {
  SHADOW_EFFORTS,
  SHADOW_RULES,
  type ShadowEffort,
  type ShadowExperiment,
  type ShadowRule,
} from "./shadow-experiment";
import { FREE_PLAN_DAILY_CREDITS } from "@/lib/places/geoapify";
import { isAreaKind, type DayRequest, type PlaceKind } from "@/lib/schema/itinerary.schema";
import type { IntakeCase } from "@/lib/quality/intake-checks";

/**
 * A live eval round, planned before anything is sent (`docs/harness.md`, "B. The intake
 * eval"): what it calls, about what it costs, the most it can cost, and the confirmation
 * without which it calls nothing. The rounds themselves are `intake-round.ts` and
 * `day-round.ts`; `scripts/live-eval.ts` runs them on the server's keys.
 */

/** Runs of each golden intake: three, so one lucky answer cannot pass a case. */
export const INTAKE_RUNS_PER_CASE = 3;

/**
 * Runs of each gate text in a round of the gate alone: three passed the cocaine text on
 * intake-v1 and one in three failed it on v2 (`docs/harness.md`, "B. The intake eval", "The live
 * intake gate"), so before live intake turns on each runs ten in a row, about $0.006 for both.
 */
export const GATE_RUNS_PER_CASE = 10;

/** The variable that confirms a round, set to at least its worst case in US dollars. */
export const CONFIRM_VARIABLE = "EVAL_CONFIRM_USD";

/** The most one intake can cost: what the route holds against the app's cap before the call. */
export const INTAKE_CALL_WORST_USD = worstCaseUsd(
  MODEL_IDS.intake,
  INTAKE_INPUT_TOKENS_CEILING,
  INTAKE_MAX_OUTPUT_TOKENS,
);

/** The most one day can cost: Sonnet's day and Haiku's shadow written beside it. */
export const DAY_WORST_USD = DAY_RESERVE_USD + SHADOW_RESERVE_USD;

/**
 * Tokens a call is expected to read and write: the first live pass's on v0 (2026-10-29: an
 * intake read 1,942 and wrote about 90, a day read 6,695 and wrote 5,099 to 7,679, its shadow
 * about 6,000), with the characters v1's prompts added at about four a token. Only the plan's
 * expected sum reads them; a round is confirmed against its worst case.
 */
const EXPECTED_TOKENS: Readonly<Record<CallRole, { input: number; output: number }>> = {
  intake: { input: 2_300, output: 100 },
  day: { input: 7_100, output: 6_500 },
  shadow: { input: 7_100, output: 6_000 },
};

/**
 * Tokens a targeted re-plan is expected to read and write: its first schema probe read about
 * 8,670 on the written Kyoto morning (2026-10-31), and a day writes about 850 tokens a stop with
 * its options, so the golden set's windows, 1, 4, 2 and 1 stops, write about 2,000 a case with
 * their lines. Only the plan's expected sum reads them; the round is confirmed against its worst.
 */
const EXPECTED_REPLAN_TOKENS = { input: 8_700, output: 2_000 };

/**
 * About how many places one request's day holds, and how many of them are meals
 * (`place-round.ts`), its shadow's unchecked: the 80 days the live rounds checked from `day-v3` to
 * the golden days held 23.6 places on average, 10.7 of them coffee, food or bar, and took 25 to 44
 * lookups each.
 */
const EXPECTED_PLACES_PER_REQUEST = 24;
const EXPECTED_MEALS_PER_REQUEST = 11;

/**
 * Whose places a round checks: its days' alone, as it always has, since every lookup comes
 * out of the credits production shares; the shadows' too, for a round that compares the two
 * models; the shadows' alone, for a round that tries the shadow in another setting; or none,
 * for a round whose places another round has measured.
 */
export type PlaceScope = "days" | "both" | "shadows" | "none";

const PLACE_SCOPES: readonly PlaceScope[] = ["days", "both", "shadows", "none"];

/** The days a scope checks the places of, for each request: a day, its shadow, both, or neither. */
const DAYS_CHECKED: Readonly<Record<PlaceScope, number>> = {
  days: 1,
  both: 2,
  shadows: 1,
  none: 0,
};

/** Whose places the plan says it checks, and whose it does not. */
const CHECKED_LABELS: Readonly<Record<PlaceScope, string>> = {
  days: "days",
  both: "days and their shadows",
  shadows: "shadows",
  none: "",
};
const UNCHECKED_NOTES: Readonly<Record<PlaceScope, string>> = {
  days: "; the shadows' places are not checked",
  both: "",
  shadows: "; the days' places are not checked",
  none: "",
};

/** A place's lookups: its name, and for a meal its area too. */
export function lookupsFor(kind: PlaceKind): number {
  return isAreaKind(kind) ? 2 : 1;
}

/**
 * The most lookups the places may take for each request a round sends, so a runaway day cannot
 * spend the free plan's credits for the day, which production and the dev server share. The
 * busiest of the 80 checked days took 44.
 */
const MAX_PLACE_LOOKUPS_PER_REQUEST = 60;

function expectedUsdOf(role: CallRole): number {
  const { input, output } = EXPECTED_TOKENS[role];
  return worstCaseUsd(MODEL_IDS[role], input, output);
}

/** The calls the schema probe may make: the day's model and its shadow's, on one schema. */
export type ProbeRole = Exclude<CallRole, "intake">;
export const PROBE_ROLES: readonly ProbeRole[] = ["day", "shadow"];

/** Enough for the provider to start writing, which it does only once the grammar compiled. */
export const PROBE_MAX_OUTPUT_TOKENS = 16;

/** Which call's schema a probe asks about: the day's, or a targeted re-plan's, on the day's model alone. */
export type ProbeKind = "day" | "replan";

const PROBE_ROLES_OF: Readonly<Record<ProbeKind, readonly ProbeRole[]>> = {
  day: PROBE_ROLES,
  replan: ["day"],
};

/**
 * The most a probe's call reads: the call's own ceiling. A re-plan reads the kept stops and
 * windows besides the day's instructions, and its first probe read about 8,670 tokens on the
 * written Kyoto morning, past the day's ceiling, then 8,000: it cost $0.0175 against a
 * quoted $0.0162.
 */
const PROBE_INPUT_CEILING: Readonly<Record<ProbeKind, number>> = {
  day: DAY_INPUT_TOKENS_CEILING,
  replan: REPLAN_INPUT_TOKENS_CEILING,
};

/** What the probe's calls cost, each reading this much input, if the token count cannot tell. */
function probeUsdOf(inputTokensOf: (role: ProbeRole) => number, probe: ProbeKind): number {
  return PROBE_ROLES_OF[probe].reduce(
    (sum, role) =>
      sum + worstCaseUsd(MODEL_IDS[role], inputTokensOf(role), PROBE_MAX_OUTPUT_TOKENS),
    0,
  );
}

/** How the day route answers a request the round would send. */
export type DayKind = "live" | "written";

/** A written day answers its own request from its file, at no cost; any other goes to the model. */
export function dayKindOf(body: DayRequest): DayKind {
  return writtenDayFor(body, new Date()) !== null ? "written" : "live";
}

/**
 * Whether the route writes this request's city only under the intake's signature: a city
 * Lantern has not written, or a written one in another zone. The round signs it as the intake
 * would, with the same salt (`day-round.ts`): the signature keeps the route from writing
 * a visitor's city of their own choosing, and the round is the server's own tool.
 */
export function needsSignature(body: DayRequest): boolean {
  return !WRITTEN_REQUESTS.some(
    ({ city, timezone }) => city === body.city && timezone === body.timezone,
  );
}

/** Cities one intake looks up: its city and readings, at most three (`resolve-city.ts`). */
function lookupsOf({ recorded }: IntakeCase): number {
  const names = (recorded.city === null ? 0 : 1) + recorded.cityReadings.length;
  return Math.min(names, MAX_CITY_READINGS);
}

export interface RoundPlan {
  intakeCases: number;
  runsPerCase: number;
  intakeCalls: number;
  /** About how many cities Geoapify looks up, as the recorded outputs name them. */
  cityLookups: number;
  /** The requests a model writes, each a day and its shadow. */
  liveDays: number;
  writtenDays: number;
  /** The live ones for a city Lantern has not written, which the round signs. */
  signedDays: number;
  /** Whose places are checked. */
  places: PlaceScope;
  /** About how many lookups the days' places take, free on Geoapify's plan. */
  placeLookups: number;
  /** The most they may take; the place checks stop there. */
  placeLookupsCap: number;
  /** The schema probe alone: Claude's token count, and a call a model if it cannot tell. */
  isSchemaProbe: boolean;
  /** Whose schema the probe asks about. */
  probe: ProbeKind;
  intakeWorstUsd: number;
  dayWorstUsd: number;
  probeWorstUsd: number;
  /** The targeted re-plans the round writes, each on the day's model, with no shadow. */
  replanCases: number;
  replanWorstUsd: number;
  expectedUsd: number;
}

/** What a round adds to its intake cases and day requests; each is none, unless given. */
export interface PlanOptions {
  runsPerCase?: number;
  /** The schema probe alone, and whose schema it asks about: none, if the round is no probe. */
  probe?: ProbeKind | null;
  replanCases?: number;
  places?: PlaceScope;
}

export function planRound(
  cases: readonly IntakeCase[],
  bodies: readonly DayRequest[],
  options: PlanOptions = {},
): RoundPlan {
  const { runsPerCase = INTAKE_RUNS_PER_CASE, replanCases = 0, places = "days" } = options;
  const isSchemaProbe = options.probe != null;
  const probe = options.probe ?? "day";
  const intakeCalls = cases.length * runsPerCase;
  const kinds = bodies.map(dayKindOf);
  const liveDays = kinds.filter((kind) => kind === "live").length;
  const checkedDays = liveDays * DAYS_CHECKED[places];
  const expectedDayUsd = expectedUsdOf("day") + expectedUsdOf("shadow");
  return {
    intakeCases: cases.length,
    runsPerCase,
    intakeCalls,
    cityLookups: cases.reduce((sum, golden) => sum + lookupsOf(golden), 0) * runsPerCase,
    liveDays,
    writtenDays: kinds.filter((kind) => kind === "written").length,
    signedDays: bodies.filter((body) => dayKindOf(body) === "live" && needsSignature(body)).length,
    places,
    placeLookups: checkedDays * (EXPECTED_PLACES_PER_REQUEST + EXPECTED_MEALS_PER_REQUEST),
    placeLookupsCap: checkedDays * MAX_PLACE_LOOKUPS_PER_REQUEST,
    intakeWorstUsd: intakeCalls * INTAKE_CALL_WORST_USD,
    isSchemaProbe,
    probe,
    dayWorstUsd: liveDays * DAY_WORST_USD,
    probeWorstUsd: isSchemaProbe ? probeUsdOf(() => PROBE_INPUT_CEILING[probe], probe) : 0,
    replanCases,
    replanWorstUsd: replanCases * REPLAN_RESERVE_USD,
    expectedUsd:
      intakeCalls * expectedUsdOf("intake") +
      liveDays * expectedDayUsd +
      (isSchemaProbe ? probeUsdOf((role) => EXPECTED_TOKENS[role].input, probe) : 0) +
      replanCases *
        worstCaseUsd(MODEL_IDS.day, EXPECTED_REPLAN_TOKENS.input, EXPECTED_REPLAN_TOKENS.output),
  };
}

export function worstUsdOf(plan: RoundPlan): number {
  return plan.intakeWorstUsd + plan.dayWorstUsd + plan.probeWorstUsd + plan.replanWorstUsd;
}

/** Places a dollar sum shows: four under a dollar, where an intake's cost would vanish, two above. */
function placesOf(amount: number): number {
  return amount < 1 ? 4 : 2;
}

export function usd(amount: number): string {
  return `$${amount.toFixed(placesOf(amount))}`;
}

/** Below a sum's last shown place, so 81 × $0.0009 adding up to 0.07290000000000001 stays $0.0729. */
const FLOAT_NOISE = 1e-9;
/** Micro-dollars in a dollar: what a confirmation is compared in. */
const MICRO_USD = 1_000_000;

/** A sum rounded up at the given places, so a worst case is never shown under itself. */
function upTo(amount: number, places: number): string {
  const scale = 10 ** places;
  return (Math.ceil(amount * scale - FLOAT_NOISE) / scale).toFixed(places);
}

/** A worst case as the plan shows it and as a confirmation may name it, rounded up. */
function usdUp(amount: number): string {
  return `$${upTo(amount, placesOf(amount))}`;
}

export function planReport(plan: RoundPlan): string[] {
  const lines = ["The live eval round, nothing sent yet:"];
  if (plan.intakeCalls > 0) {
    lines.push(
      `  Intake: ${plan.intakeCases} cases × ${plan.runsPerCase} runs = ${plan.intakeCalls} calls to ${MODEL_IDS.intake} (${INTAKE_PROMPT_VERSION}), about ${plan.cityLookups} Geoapify lookups (free plan).`,
    );
  }
  if (plan.liveDays + plan.writtenDays > 0) {
    lines.push(
      `  Days: ${plan.liveDays} requests = ${plan.liveDays * 2} calls, each a day on ${MODEL_IDS.day} and its shadow on ${MODEL_IDS.shadow} (${DAY_PROMPT_VERSION}); ${plan.writtenDays} answered by a written day and skipped; ${plan.signedDays} for a city Lantern has not written, signed by the round as the intake signs one.`,
    );
  }
  if (plan.liveDays > 0) {
    lines.push(
      plan.places === "none"
        ? "  Places: none checked (EVAL_PLACES=none)."
        : `  Places: each place in the ${CHECKED_LABELS[plan.places]} checked by its name, and each coffee, food or bar place by its area too, about ${plan.placeLookups} Geoapify lookups, at most ${plan.placeLookupsCap}${UNCHECKED_NOTES[plan.places]}.`,
    );
  }
  const credits = plan.cityLookups + plan.placeLookups;
  if (credits > 0) {
    lines.push(
      `  Geoapify: about ${credits.toLocaleString("en-US")} of the ${FREE_PLAN_DAILY_CREDITS.toLocaleString("en-US")} credits a day that production shares, its intake of a city included. One round with days a day, and none on a day Lantern is shown.`,
    );
  }
  if (plan.isSchemaProbe) {
    const version = plan.probe === "replan" ? REPLAN_PROMPT_VERSION : DAY_PROMPT_VERSION;
    const calls =
      plan.probe === "replan"
        ? `one call to ${MODEL_IDS.day}`
        : `one call each to ${MODEL_IDS.day} and ${MODEL_IDS.shadow}`;
    lines.push(
      `  Schema probe: Claude's token count on ${version}'s schema and on a control built as the refused one, free; if the count cannot tell, ${calls} held to ${PROBE_MAX_OUTPUT_TOKENS} output tokens.`,
      `  Expected $0 if the count tells, else about ${usd(plan.expectedUsd)}; at most ${usdUp(worstUsdOf(plan))}.`,
    );
    return lines;
  }
  if (plan.replanCases > 0) {
    lines.push(
      `  Re-plans: ${plan.replanCases} calls to ${MODEL_IDS.day} (${REPLAN_PROMPT_VERSION}), each case as many times as its runs, each call held to its worst case of ${usdUp(REPLAN_RESERVE_USD)}; no shadow, no place checked.`,
      `  Expected about ${usd(plan.expectedUsd)}; at most ${usdUp(worstUsdOf(plan))}.`,
    );
    return lines;
  }
  lines.push(
    `  Expected about ${usd(plan.expectedUsd)}; at most ${usdUp(worstUsdOf(plan))} (intake ${usdUp(plan.intakeWorstUsd)}, days ${usdUp(plan.dayWorstUsd)}).`,
  );
  return lines;
}

export type Confirmation = { kind: "confirmed" } | { kind: "refused"; reason: string };

/**
 * A round runs only when its confirmation names at least its worst case, so a confirmation
 * left from a smaller round never covers a bigger one. Each round then runs under its own
 * cap at its worst case, so the confirmed sum bounds what it can spend.
 */
export function confirmationOf(value: string | undefined, plan: RoundPlan): Confirmation {
  return confirmationFor(value, worstUsdOf(plan));
}

/** The same, for a round planned elsewhere, by its worst case alone (`voice/round.ts`). */
export function confirmationFor(value: string | undefined, worst: number): Confirmation {
  const ask = `No call made. The round may cost at most ${usdUp(worst)}; to run it, set ${CONFIRM_VARIABLE}=${upTo(worst, 2)} or more.`;
  if (value === undefined || value.trim() === "") return { kind: "refused", reason: ask };
  const confirmed = Number(value);
  if (!Number.isFinite(confirmed)) {
    return { kind: "refused", reason: `${CONFIRM_VARIABLE} is not a number. ${ask}` };
  }
  // In whole micro-dollars, the worst case rounded up and the confirmation down, so it always
  // covers the worst case; less the floating point's noise, as ten re-plans at $0.084 add up to
  // 0.8400000000000001, and the $0.84 it asks for was refused.
  const needed = Math.ceil(worst * MICRO_USD - FLOAT_NOISE);
  const given = Math.floor(confirmed * MICRO_USD + FLOAT_NOISE);
  if (given < needed) {
    return {
      kind: "refused",
      reason: `${CONFIRM_VARIABLE}=${value} is under the worst case. ${ask}`,
    };
  }
  return { kind: "confirmed" };
}

/**
 * Which rounds a run sends: `gate` is the intake's gate texts alone, `suggest` its suggestions.
 * `schema` probes the day's schema, `replan-schema` a targeted re-plan's; `replan` writes its
 * golden set. `voice` judges the voice of labelled lines, or of saved rounds' days
 * (`voice/round.ts`).
 */
const ROUND_CHOICES = [
  "intake",
  "day",
  "both",
  "gate",
  "suggest",
  "schema",
  "replan-schema",
  "replan",
  "voice",
] as const;

export type RoundChoice = (typeof ROUND_CHOICES)[number];

/** Who judges a voice round: the day's model or its shadow's (`MODEL_IDS`). */
export type VoiceJudgeChoice = "sonnet" | "haiku";
const VOICE_JUDGES: readonly VoiceJudgeChoice[] = ["sonnet", "haiku"];

/** How `pnpm eval:live` is told what to run: variables, since Vitest takes no flags of ours. */
export interface LiveEvalSettings {
  round: RoundChoice;
  /** Runs of each intake case: `EVAL_RUNS`, or three, or ten for the gate alone. */
  runsPerCase: number;
  /** Day requests as JSON lines, one `DayRequest` each; needed by the day round. */
  dayBodiesPath: string | null;
  /** Records of an earlier round to compare the days with, as a JSON array. */
  baselinePath: string | null;
  /** Whose places the day round checks: `EVAL_PLACES`, the days' alone if unset. */
  places: PlaceScope;
  /** Who judges a voice round: `EVAL_JUDGE`, Sonnet if unset. */
  judge: VoiceJudgeChoice;
  /**
   * Saved rounds whose days a voice round judges: `EVAL_VOICE_DAYS`, their folders separated
   * by commas; none, to judge the labelled lines and measure the judge.
   */
  voiceDays: string[];
  /**
   * A voice round's folder to report again from the runs it saved, calling nothing:
   * `EVAL_VOICE_REPORT`. Its days come from the folder's `writers.json`, not `EVAL_VOICE_DAYS`.
   */
  voiceReport: string | null;
  /**
   * What a day round changes on the shadow's call alone (`shadow-experiment.ts`):
   * `EVAL_SHADOW_EFFORT` and `EVAL_SHADOW_RULE`, nothing if unset.
   */
  shadow: ShadowExperiment;
  /** Where the runs and the report are written; a new folder under `eval-runs/` if unset. */
  outDir: string | null;
  confirmation: string | undefined;
}

function isRoundChoice(value: string): value is RoundChoice {
  return (ROUND_CHOICES as readonly string[]).includes(value);
}

/** The rounds that probe a schema and write no day. */
export const PROBE_ROUNDS: Readonly<Partial<Record<RoundChoice, ProbeKind>>> = {
  schema: "day",
  "replan-schema": "replan",
};

/** The rounds that send day requests. */
const DAY_ROUNDS: readonly RoundChoice[] = ["day", "both"];

function pathIn(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[name]?.trim() ?? "";
  return value === "" ? null : value;
}

/** `EVAL_RUNS` as a whole number of runs from one, or the round's own when it is unset. */
function runsPerCaseOf(
  value: string | undefined,
  round: RoundChoice,
): number | { problem: string } {
  const fallback = round === "gate" ? GATE_RUNS_PER_CASE : INTAKE_RUNS_PER_CASE;
  if (value === undefined || value.trim() === "") return fallback;
  const runs = Number(value);
  if (!Number.isInteger(runs) || runs < 1) {
    return { problem: `EVAL_RUNS is "${value}"; it is a whole number of runs, 1 or more.` };
  }
  return runs;
}

export function liveEvalSettingsOf(
  env: Readonly<Record<string, string | undefined>>,
): LiveEvalSettings | { problem: string } {
  const roundName = env.EVAL_ROUND?.trim() || "both";
  if (!isRoundChoice(roundName)) {
    return {
      problem: `EVAL_ROUND is "${env.EVAL_ROUND}"; it is one of ${ROUND_CHOICES.join(", ")}.`,
    };
  }
  const round = roundName;
  const runsPerCase = runsPerCaseOf(env.EVAL_RUNS, round);
  if (typeof runsPerCase !== "number") return runsPerCase;
  const isDayRound = DAY_ROUNDS.includes(round);
  const dayBodiesPath = pathIn(env, "EVAL_DAY_BODIES");
  if (isDayRound && dayBodiesPath === null) {
    return { problem: "The day round reads its requests from EVAL_DAY_BODIES, which is not set." };
  }
  const places = (env.EVAL_PLACES?.trim() || "days") as PlaceScope;
  if (!PLACE_SCOPES.includes(places)) {
    return {
      problem: `EVAL_PLACES is "${env.EVAL_PLACES}"; it is one of ${PLACE_SCOPES.join(", ")}.`,
    };
  }
  const judge = (env.EVAL_JUDGE?.trim() || "sonnet") as VoiceJudgeChoice;
  if (!VOICE_JUDGES.includes(judge)) {
    return {
      problem: `EVAL_JUDGE is "${env.EVAL_JUDGE}"; it is one of ${VOICE_JUDGES.join(", ")}.`,
    };
  }
  const voiceDays = (env.EVAL_VOICE_DAYS ?? "")
    .split(",")
    .map((dir) => dir.trim())
    .filter((dir) => dir !== "");
  const voiceReport = pathIn(env, "EVAL_VOICE_REPORT");
  if (voiceReport !== null && round !== "voice") {
    return { problem: "EVAL_VOICE_REPORT reports a voice round again; set EVAL_ROUND=voice." };
  }
  if (voiceReport !== null && voiceDays.length > 0) {
    return {
      problem:
        "EVAL_VOICE_REPORT reads the days its round judged from its writers.json; leave EVAL_VOICE_DAYS unset.",
    };
  }
  const effort = pathIn(env, "EVAL_SHADOW_EFFORT");
  if (effort !== null && !(SHADOW_EFFORTS as readonly string[]).includes(effort)) {
    return {
      problem: `EVAL_SHADOW_EFFORT is "${effort}"; it is one of ${SHADOW_EFFORTS.join(", ")}.`,
    };
  }
  const rule = pathIn(env, "EVAL_SHADOW_RULE");
  if (rule !== null && !(SHADOW_RULES as readonly string[]).includes(rule)) {
    return {
      problem: `EVAL_SHADOW_RULE is "${rule}"; it is one of ${SHADOW_RULES.join(", ")}.`,
    };
  }
  return {
    round,
    runsPerCase,
    dayBodiesPath: isDayRound ? dayBodiesPath : null,
    baselinePath: pathIn(env, "EVAL_DAY_BASELINE"),
    places,
    judge,
    voiceDays,
    voiceReport,
    shadow: { effort: effort as ShadowEffort | null, rule: rule as ShadowRule | null },
    outDir: pathIn(env, "EVAL_OUT"),
    confirmation: env[CONFIRM_VARIABLE],
  };
}

function isSet(env: Readonly<Record<string, string | undefined>>, name: string): boolean {
  return (env[name]?.trim() ?? "") !== "";
}

/**
 * The names a confirmed round still lacks, never their values. The schema probe asks Claude
 * alone, on its key. Every other round needs the live config's, and Geoapify's key, which the
 * config does not ask for: without it each intake's city lookup fails and its paid call ends
 * `unavailable`, and no day's place can be checked.
 */
export function missingFor(
  round: RoundChoice,
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  // A probe and a voice round ask Claude alone.
  if (PROBE_ROUNDS[round] !== undefined || round === "voice") {
    return isSet(env, "ANTHROPIC_API_KEY") ? [] : ["ANTHROPIC_API_KEY"];
  }
  const config = liveConfigOf(env);
  const missing: string[] = config.kind === "misconfigured" ? [...config.missing] : [];
  // A re-plan round checks no place: the live config alone.
  if (round !== "replan" && !isSet(env, "GEOAPIFY_API_KEY")) missing.push("GEOAPIFY_API_KEY");
  return missing;
}

/** Next's `after()` in a process with no response to wait on: the work runs when drained. */
export interface AfterQueue {
  schedule: (task: () => Promise<void>) => void;
  drain: () => Promise<void>;
}

export function afterQueue(): AfterQueue {
  const tasks: (() => Promise<void>)[] = [];
  return {
    schedule: (task) => {
      tasks.push(task);
    },
    drain: async () => {
      while (tasks.length > 0) await Promise.all(tasks.splice(0).map((task) => task()));
    },
  };
}

/** Minutes and seconds, for how long a round took. */
export function elapsed(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

/** Rows as columns, each as wide as its widest cell. */
export function table(rows: readonly (readonly string[])[], indent = "  "): string[] {
  const columns = Math.max(0, ...rows.map((row) => row.length));
  const widths = Array.from({ length: columns }, (_, index) =>
    Math.max(...rows.map((row) => row[index]?.length ?? 0)),
  );
  return rows.map(
    (row) =>
      indent +
      row
        .map((cell, index) => cell.padEnd(widths[index] ?? 0))
        .join("  ")
        .trimEnd(),
  );
}
