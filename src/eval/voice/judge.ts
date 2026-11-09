import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { costOf, providerOptionsFor, type ModelId } from "@/lib/live/models";
import { describeProviderError } from "@/lib/live/provider-error";
import type { VoiceLine, VoiceVerdict } from "./lines";

/**
 * The voice rubric as a model's judgement (`docs/voice.md`): the three tests and the
 * owner's rulings 1 to 11, asked of every line of a day at once, so the judge can try a line at
 * another stop or hour while it judges each on its own. Who wrote the day is never said.
 */

/**
 * v2, 2026-11-05: v1 failed 24 of the 243 labelled passes, half of them textures it held to an
 * hour the rubric does not ask a texture to keep, and summaries whose one reason it found too
 * slight; v2 says both as the rubric does. No labelled line is quoted to it but the rubric's own.
 */
export const VOICE_JUDGE_VERSION = "voice-judge-v2";

/** The rubric, as `docs/voice.md` agreed it on 2026-10-22, its rulings worked into the tests. */
export const VOICE_INSTRUCTIONS = `You judge the voice of the lines a travel planner wrote for one day in one city. Each line has a role: the line about the day, a place's summary, its texture, its light note, or a swap reason, which says why an alternative may take a stop's place. Judge every line on its own with three yes-or-no tests. You see the whole day so you can move a line to another stop or hour; never let a line borrow what another line says.

CONCRETE: could a visitor point at it, hear it or taste it there?
Concrete means sensory and typical, not encyclopedic.
- Fail: a date, history or an architect; a superlative of age or size ("the city's oldest church"); a count nothing can check, such as seats, dishes or people an hour; a one-off scene nobody can check ("someone's birthday" at the next table).
- Fail: a relation between two places, such as a shared owner, kitchen or maker ("its sister restaurant", "the same kitchen", "the sweets maker's own café").
- Pass: the numbers a day is planned around, such as opening hours, days closed and walking minutes ("the grounds open at six and cost nothing, so at half past seven ...").
- Pass: a place that is part of another, as its name shows ("the temple's own dry garden" for a temple's garden). That is geography.

PLAIN: would a friend who knows the city say it this way?
- Fail: brochure words, stacked adjectives, exclamation marks, rhetorical questions.
- Fail: hyperbole. "Half the city walks it at dusk" fails; "it fills with families at dusk" passes.
- Fail: a literary image that stands for a feeling. Pass: an image that is literally visible ("the water does the glittering"), and an everyday turn of phrase anyone uses ("a small room talking over itself").
- One tip per stop passes: a sentence in the imperative, such as "Order one for the table". A second tip in the lines of the same stop fails. "You" as a point of view ("the castle above you") is not a tip.

EARNED: does it stop being true at another stop or another hour? This is the swap test.
Move the line to another stop of the same day, or to another time at the same place. If it still reads as true, it is not earned. Read it by its role:
- Line about the day: earned when it names this day's places and hours, not the city in general.
- Summary: it says why this place earns its slot, and must carry the hour by itself, with a reason about the time of day: an opening or closing time, how the crowd moves at that hour, a meal, or the light. One such reason is enough, however briefly it is given: a closing time ties a visit to the hours before it, and the crowd at that hour ties it to that hour. Moved to another part of the same visit, it should stop being true. The day of the week alone does not earn the hour ("shut on Sundays, so Saturday afternoon is the time" earns Saturday, not the afternoon). A summary that describes the place, says how to get there, or names an hour other than its slot fails.
- Texture: what you would hear and feel there. It is earned when it belongs to this kind of place and nothing in it contradicts the hour. It does not have to change through the day, so never fail a texture for being true at other hours too: a museum may sound like a museum all day, and a harbour like a harbour. Fail it only when the hour rules something in it out, or when it would fit any kind of place.
- Light note: earned when it says how the light changes through the day, or what it is at this hour and not at others. A note that puts the light in the hours of its slot, such as morning sun on a facade for a morning stop, earns it. Try it against the other hours of daylight: "bright" alone, or "bright but soft", fits them all and fails. An indoor place earns it by saying, or plainly showing, why the hour does not matter ("bright overhead light on the platters; the only daylight comes in at the front windows").
- Swap reason: earned when it says what the alternative shares with the stop, as what the visitor gets (the dish, the room, the hour), and then what it trades.

Judge as strictly as these tests say, and no more strictly: a line that gives what its role asks for passes, even in a few words.

Answer every line, by its id, in the order given. For each, write why first: one short sentence naming what decides a failed test, or an empty string when all three pass. Then answer concrete, plain and earned, true for a pass.`;

const JudgedLineSchema = z.strictObject({
  id: z.string().describe("The line's id, exactly as given."),
  why: z
    .string()
    .describe("One short sentence on what fails, or an empty string when all three pass."),
  concrete: z.boolean().describe("Could a visitor point at it, hear it or taste it there?"),
  plain: z.boolean().describe("Would a friend who knows the city say it this way?"),
  earned: z.boolean().describe("Does it stop being true at another stop or another hour?"),
});

/** What the judge writes: a verdict for each line, by its id. Portable, as the day's schema is. */
export const VoiceJudgementSchema = z.strictObject({
  verdicts: z.array(JudgedLineSchema).describe("One verdict for every line, in the order given."),
});

export type JudgedLine = z.infer<typeof JudgedLineSchema>;

const ROLE_LABELS: Readonly<Record<VoiceLine["role"], string>> = {
  dek: "line about the day",
  summary: "summary",
  texture: "texture",
  light: "light note",
  reason: "swap reason",
};

/** The day's lines as the judge reads them: each place under its stop's hour, each line by its id. */
export function voicePromptFor(lines: readonly VoiceLine[]): string {
  const out: string[] = ["The day's lines:"];
  let heading = "";
  for (const line of lines) {
    const place =
      line.role === "dek"
        ? "The day"
        : `${line.isAlternative ? "  Alternative" : "Stop"} at ${line.time}: ${line.place} (${line.kind})`;
    if (place !== heading) {
      out.push("", place);
      heading = place;
    }
    out.push(`    [${line.id}] ${ROLE_LABELS[line.role]}: ${line.text}`);
  }
  return out.join("\n");
}

/** About the most a verdict writes: its id, a sentence and three answers. */
const OUTPUT_TOKENS_PER_LINE = 80;
const OUTPUT_TOKENS_FLOOR = 400;

/** The output cap for a batch, so a judge that runs on is cut rather than paid for. */
export function maxOutputTokensFor(lines: readonly VoiceLine[]): number {
  return OUTPUT_TOKENS_FLOOR + lines.length * OUTPUT_TOKENS_PER_LINE;
}

/**
 * Characters a token, counted low so a ceiling holds: the provider counted about 2.2 on the
 * day's JSON (`models.ts`), and prose runs longer.
 */
const CHARACTERS_PER_TOKEN_CEILING = 2;
/** The schema's own wrapping, as the provider adds it to the input. */
export const SCHEMA_TOKENS = 600;

/** What a batch sends besides the schema: the rubric and the lines, in characters. */
export function promptCharactersOf(lines: readonly VoiceLine[]): number {
  return VOICE_INSTRUCTIONS.length + voicePromptFor(lines).length;
}

/** The most a batch reads: the rubric, the lines and the schema. */
export function inputTokensCeilingFor(lines: readonly VoiceLine[]): number {
  return Math.ceil(promptCharactersOf(lines) / CHARACTERS_PER_TOKEN_CEILING) + SCHEMA_TOKENS;
}

export interface VoiceJudge {
  model: LanguageModel;
  modelId: ModelId;
  /** Whose thinking settings it takes: the day's model's, or its shadow's. */
  role: "day" | "shadow";
  maxRetries?: number;
}

export interface VoiceJudgement {
  /** Each line's verdict, by its id; a line the judge left out has none. */
  verdicts: Map<string, VoiceVerdict & { why: string }>;
  /** Lines sent that came back without a verdict. */
  unjudged: string[];
  costUsd: number | null;
  msToFinish: number;
  finishReason: string | null;
  /** What went wrong, when the call gave no judgement at all. */
  error: string | null;
}

/** One judgement of one day's lines. A call that fails gives no verdicts, never a guessed one. */
export async function judgeVoice(
  judge: VoiceJudge,
  lines: readonly VoiceLine[],
  signal?: AbortSignal,
): Promise<VoiceJudgement> {
  const started = performance.now();
  const ids = new Set(lines.map((line) => line.id));
  try {
    const result = await generateText({
      model: judge.model,
      instructions: VOICE_INSTRUCTIONS,
      prompt: voicePromptFor(lines),
      output: Output.object({ schema: VoiceJudgementSchema }),
      maxOutputTokens: maxOutputTokensFor(lines),
      maxRetries: judge.maxRetries,
      abortSignal: signal,
      providerOptions: providerOptionsFor(judge.role),
    });
    const verdicts = new Map<string, VoiceVerdict & { why: string }>();
    for (const { id, why, concrete, plain, earned } of result.output.verdicts) {
      if (ids.has(id) && !verdicts.has(id)) verdicts.set(id, { why, concrete, plain, earned });
    }
    return {
      verdicts,
      unjudged: [...ids].filter((id) => !verdicts.has(id)),
      costUsd: costOf(judge.modelId, result.totalUsage),
      msToFinish: Math.round(performance.now() - started),
      finishReason: result.finishReason,
      error: null,
    };
  } catch (cause) {
    const error = NoObjectGeneratedError.isInstance(cause)
      ? `no judgement in the answer: ${cause.message}`
      : describeProviderError(cause).message;
    return {
      verdicts: new Map(),
      unjudged: [...ids],
      costUsd: NoObjectGeneratedError.isInstance(cause) ? costOf(judge.modelId, cause.usage) : null,
      msToFinish: Math.round(performance.now() - started),
      finishReason: NoObjectGeneratedError.isInstance(cause) ? (cause.finishReason ?? null) : null,
      error,
    };
  }
}
