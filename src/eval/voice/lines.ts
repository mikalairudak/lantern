import { z } from "zod";
import type { Itinerary, Place } from "@/lib/schema/itinerary.schema";

/**
 * The lines the voice rubric judges (`docs/voice.md`, "Text roles"): the line about the day,
 * and each place's summary, texture and light note, with an alternative's swap reason. A line
 * is read from the day the visitor sees, the normalized itinerary, so a version the normalizer
 * dropped is not judged and a trimmed line is judged as shown.
 */

export const VOICE_ROLES = ["dek", "summary", "texture", "light", "reason"] as const;
export type VoiceRole = (typeof VOICE_ROLES)[number];

export interface VoiceLine {
  /** Unique within a judged batch: its group, then its place and role. */
  id: string;
  /** The day it belongs to, as the judge sees it: no word of who wrote it. */
  group: string;
  /** Its stop's start, "" for the line about the day. */
  time: string;
  /** The place it is about, "" for the line about the day. */
  place: string;
  kind: string;
  /** Whether it is about an alternative rather than the stop's own place. */
  isAlternative: boolean;
  role: VoiceRole;
  text: string;
}

/** The three tests, each passed or failed (`docs/voice.md`, "Three tests"). */
const VerdictSchema = z.strictObject({
  concrete: z.boolean(),
  plain: z.boolean(),
  earned: z.boolean(),
});
export type VoiceVerdict = z.infer<typeof VerdictSchema>;

export const VOICE_TESTS = [
  "concrete",
  "plain",
  "earned",
] as const satisfies readonly (keyof VoiceVerdict)[];

/** Whether a line passes all three tests, as the rubric scores it. */
export function passesAll(verdict: VoiceVerdict): boolean {
  return verdict.concrete && verdict.plain && verdict.earned;
}

function placeLines(group: string, time: string, place: Place, reason: string | null): VoiceLine[] {
  const base = {
    group,
    time,
    place: place.name,
    kind: place.kind,
    isAlternative: reason !== null,
  };
  const lines: VoiceLine[] = [
    { ...base, id: `${group}/${place.id}/summary`, role: "summary", text: place.summary },
    { ...base, id: `${group}/${place.id}/texture`, role: "texture", text: place.sensory.texture },
    { ...base, id: `${group}/${place.id}/light`, role: "light", text: place.light.note },
  ];
  if (reason !== null) {
    lines.push({ ...base, id: `${group}/${place.id}/reason`, role: "reason", text: reason });
  }
  return lines;
}

/** Every line of a day the judge reads, in the order the day shows them. */
export function voiceLinesOf(group: string, itinerary: Itinerary): VoiceLine[] {
  const dek: VoiceLine = {
    id: `${group}/dek`,
    group,
    time: "",
    place: "",
    kind: "",
    isAlternative: false,
    role: "dek",
    text: itinerary.dek,
  };
  return [
    dek,
    ...itinerary.stops.flatMap((stop) => [
      ...placeLines(group, stop.startTime, stop.primary, null),
      ...stop.alternatives.flatMap((alternative) =>
        placeLines(group, stop.startTime, alternative, alternative.reason),
      ),
    ]),
  ];
}

const GoldenLineSchema = z.strictObject({
  id: z.string(),
  /** Which judged pass it comes from (`docs/voice.md`): the curated days, their rewrites, the first pass. */
  set: z.enum(["curated", "rewritten", "first-pass"]),
  day: z.string(),
  time: z.string(),
  place: z.string(),
  kind: z.string(),
  isAlternative: z.boolean(),
  role: z.enum(VOICE_ROLES),
  text: z.string(),
  verdict: VerdictSchema,
  /** Why it fails, as the rubric's tables say; "" for a line that passes. */
  why: z.string(),
});
export type GoldenLine = z.infer<typeof GoldenLineSchema>;

/** The judge's labelled lines (`src/lib/fixtures/voice/golden-lines.jsonl`), one JSON line each. */
export function goldenLinesOf(text: string): GoldenLine[] {
  return text
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== "")
    .map(({ line, number }) => {
      const parsed = GoldenLineSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`Line ${number} is not a labelled line: ${parsed.error.message}`);
      }
      return parsed.data;
    });
}

/** A labelled line as the judge reads it, grouped by the pass and day it was judged in. */
export function voiceLineOfGolden(golden: GoldenLine): VoiceLine {
  return {
    id: golden.id,
    group: `${golden.set}:${golden.day}`,
    time: golden.time,
    place: golden.place,
    kind: golden.kind,
    isAlternative: golden.isAlternative,
    role: golden.role,
    text: golden.text,
  };
}
