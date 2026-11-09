import { z } from "zod";
import { GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";

/**
 * The bridge from a day's stream to the components that draw it: of everything partial
 * JSON has parsed so far, only what is final, and the text being written now.
 *
 * Free text grows where a reader can follow it, so a half-written summary is shown as it
 * is. Every other value is final only once the field after it has started: an enum streams
 * as "e", "ea", "early", a number grows 35 → 35.02, and partial JSON repairs a half-written
 * `nu` to null and `tr` to true. So the last value of an unfinished stream is left out
 * unless it is free text. The rule needs nothing but the partial and the outcome, so it
 * holds for the simulator and for the live model alike.
 *
 * It speaks only while the day streams and once it is complete. After any other ending the
 * outcome decides what is drawn (`docs/decisions.md`, "The stream reports how it ended"): a cut or
 * dropped stream's salvaged itinerary, or a designed failure. A partial cut short would show its
 * last words as if they were finished.
 */

/** Plain strings that still arrive whole: a clock time is not a value until it reads HH:mm. */
const ATOMIC_STRING_KEYS: ReadonlySet<string> = new Set(["startTime"]);

/**
 * The generated fields whose text a reader can follow as it grows: every plain string in
 * `GeneratedDaySchema`, or list of them, but a clock time. Read from the schema, so a text
 * field added to it grows too.
 */
export const GROWING_TEXT_KEYS: ReadonlySet<string> = textKeysOf(GeneratedDaySchema);

function textKeysOf(schema: z.ZodType, key: string | null = null): Set<string> {
  if (schema instanceof z.ZodNullable) return textKeysOf(schema.unwrap() as z.ZodType, key);
  if (schema instanceof z.ZodArray) return textKeysOf(schema.element as z.ZodType, key);
  if (schema instanceof z.ZodObject) {
    const fields = Object.entries(schema.shape as Record<string, z.ZodType>);
    return new Set(fields.flatMap(([field, value]) => [...textKeysOf(value, field)]));
  }
  const isText = schema instanceof z.ZodString && key !== null && !ATOMIC_STRING_KEYS.has(key);
  return new Set(isText ? [key] : []);
}

export interface RevealedPartial {
  /** The day as far as it is final, with the text being written as far as it has come. */
  day: PartialDay;
  /**
   * Dotted path of the text being written now, such as "stops.2.place.summary" or "dek";
   * null while the stream is between two values, and once it has ended.
   */
  activePath: string | null;
  /** The stream ended with a whole day that validated. */
  isComplete: boolean;
}

const EMPTY: RevealedPartial = { day: {}, activePath: null, isComplete: false };

type Json = unknown;
type Path = readonly (string | number)[];

/**
 * What can be drawn of a day from its latest partial and its outcome, null while it
 * streams. A complete day is shown whole. Any other ending draws nothing from the partial,
 * whatever arrived: the outcome says what the visitor sees instead.
 */
export function revealedOf(
  partial: PartialDay | null,
  outcome: DayOutcome | null,
): RevealedPartial {
  if (outcome?.kind === "complete") {
    return { day: partial ?? {}, activePath: null, isComplete: true };
  }
  if (partial === null || outcome !== null) return EMPTY;

  const path = lastLeafPath(partial);
  if (path === null) return { day: partial, activePath: null, isComplete: false };
  if (isGrowingText(partial, path)) {
    return { day: partial, activePath: path.join("."), isComplete: false };
  }
  return { day: without(partial, path) as PartialDay, activePath: null, isComplete: false };
}

function isContainer(value: Json): value is object {
  return value !== null && typeof value === "object";
}

/**
 * The path to the value written last: the last field of each object and the last item of
 * each list, down to a value that holds nothing else. Null when the last thing written is
 * an empty object or list, which has no value of its own to be unfinished.
 */
function lastLeafPath(value: Json): Path | null {
  const path: (string | number)[] = [];
  let current = value;
  while (isContainer(current)) {
    if (Array.isArray(current)) {
      if (current.length === 0) return null;
      path.push(current.length - 1);
      current = current.at(-1);
    } else {
      const keys = Object.keys(current);
      const last = keys.at(-1);
      if (last === undefined) return null;
      path.push(last);
      current = (current as Record<string, Json>)[last];
    }
  }
  return path.length > 0 ? path : null;
}

/** A string under a growing-text field, itself or as an item of its list ("aesthetic"). */
function isGrowingText(root: Json, path: Path): boolean {
  const leaf = path.reduce<Json>(
    (value, step) => (value as Record<string | number, Json>)[step],
    root,
  );
  const field = path.findLast((step) => typeof step === "string");
  return typeof leaf === "string" && field !== undefined && GROWING_TEXT_KEYS.has(field);
}

/** The value with the one at `path` taken out, copying only the containers on the way. */
function without(value: Json, path: Path): Json {
  const [step, ...rest] = path;
  if (step === undefined || !isContainer(value)) return value;
  if (Array.isArray(value)) {
    return rest.length === 0
      ? value.slice(0, -1)
      : value.map((item, index) => (index === step ? without(item, rest) : item));
  }
  const fields = value as Record<string, Json>;
  if (rest.length === 0) {
    return Object.fromEntries(Object.entries(fields).filter(([key]) => key !== step));
  }
  return { ...fields, [step]: without(fields[step], rest) };
}
