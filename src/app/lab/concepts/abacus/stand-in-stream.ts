import {
  ASSUMABLE_FACT_KEYS,
  generatedLightOf,
  type AssumableFactKey,
  type GeneratedAssumptions,
  type GeneratedDay,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";

/**
 * A stand-in for the stream, so the abacus concept can be felt while a day is written.
 * Concept-only: the real simulator replays `streamObject` partials (pre-MVP step 4).
 * It reveals a finished day in schema order, the way partial JSON arrives: free text
 * grows character by character, while times, numbers and enum values appear whole,
 * because a half-written "refl" is not a value a component can show.
 */

export type DeepPartial<T> = T extends readonly (infer Item)[]
  ? DeepPartial<Item>[]
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export interface RevealedDay {
  day: DeepPartial<GeneratedDay>;
  /** Dotted path of the text being written right now, such as "stops.2.place.summary". */
  activePath: string | null;
  isComplete: boolean;
}

// Fields whose text a reader can follow as it grows; everything else arrives whole.
export const FREE_TEXT_KEYS: ReadonlySet<string> = new Set([
  "dek",
  "name",
  "neighborhood",
  "summary",
  "aesthetic",
  "texture",
  "note",
]);
// What an atomic value costs from the budget, in characters: roughly one short token.
const ATOMIC_COST = 4;

/** What the model assumed, as it writes it: nothing for the visitor's words or the asked one. */
function assumptionsOf({ facts }: Itinerary): GeneratedAssumptions {
  const assumed = <Key extends AssumableFactKey>(key: Key): Itinerary["facts"][Key]["value"] =>
    facts[key].source === "assumed" ? facts[key].value : null;
  return {
    travel: assumed("travel"),
    start: assumed("start"),
    dinner: assumed("dinner"),
    end: assumed("end"),
    company: assumed("company"),
  };
}

/**
 * The generation-layer day an itinerary was normalized from, in schema field order but for
 * the assumptions. They come last here: the concepts read the request's words from their
 * own facts, and their pacing was tuned on streams that began with the line about the day.
 */
export function toGeneratedDay(itinerary: Itinerary): GeneratedDay {
  return {
    dek: itinerary.dek,
    stops: itinerary.stops.map((stop) => {
      const { name, kind, neighborhood, summary, aesthetic, coordinates, sensory, light } =
        stop.primary;
      return {
        startTime: stop.startTime,
        durationMinutes: stop.durationMinutes,
        place: {
          name,
          kind,
          neighborhood,
          coordinates,
          sensory,
          light: generatedLightOf(light),
          summary,
          aesthetic,
        },
        // The model leaves out the energy word, which shapes every stop.
        dependsOn: ASSUMABLE_FACT_KEYS.filter((key) => stop.dependsOn.includes(key)),
      };
    }),
    alternatives: [],
    assumptions: assumptionsOf(itinerary),
  };
}

interface Cursor {
  budget: number;
  activePath: string | null;
  /** The keys whose text grows character by character. */
  freeText: ReadonlySet<string>;
}

/** Any generated value as far as a budget reaches, in its own key order. */
export interface RevealedValue<T> {
  value: DeepPartial<T>;
  /** Dotted path of the text being written right now. */
  activePath: string | null;
  isComplete: boolean;
}

/** The value as far as the budget reaches, or undefined if it has not started. */
function reveal(value: unknown, path: string[], isFreeText: boolean, cursor: Cursor): unknown {
  // An empty list costs nothing: it is complete as soon as the fields before it are.
  if (Array.isArray(value) && value.length === 0) return [];
  if (cursor.budget <= 0) return undefined;

  if (typeof value === "string" && isFreeText) {
    if (cursor.budget >= value.length) {
      cursor.budget -= value.length;
      return value;
    }
    const written = value.slice(0, cursor.budget);
    cursor.budget = 0;
    cursor.activePath = path.join(".");
    return written;
  }

  if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (const [index, item] of value.entries()) {
      const revealed = reveal(item, [...path, String(index)], isFreeText, cursor);
      if (revealed === undefined) break;
      items.push(revealed);
    }
    return items;
  }

  if (value !== null && typeof value === "object") {
    const fields: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const revealed = reveal(child, [...path, key], cursor.freeText.has(key), cursor);
      if (revealed === undefined) break;
      fields[key] = revealed;
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
  }

  if (cursor.budget < ATOMIC_COST) {
    cursor.budget = 0;
    return undefined;
  }
  cursor.budget -= ATOMIC_COST;
  return value;
}

/** How many characters the whole day takes to write. */
export function revealLength(day: GeneratedDay): number {
  return writtenLength(day);
}

/** How many characters any generated value takes to write, given its free-text keys. */
export function writtenLength(
  value: unknown,
  freeText: ReadonlySet<string> = FREE_TEXT_KEYS,
): number {
  return measure(value, false, freeText);
}

function measure(value: unknown, isFreeText: boolean, freeText: ReadonlySet<string>): number {
  if (typeof value === "string" && isFreeText) return value.length;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + measure(item, isFreeText, freeText), 0);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).reduce<number>(
      (sum, [key, child]) => sum + measure(child, freeText.has(key), freeText),
      0,
    );
  }
  return ATOMIC_COST;
}

/**
 * Any generated value as it would look after `budget` characters of the stream, written
 * in its own key order. The day's fields are free text by default; a caller can add its own.
 */
export function revealValue<T>(
  value: T,
  budget: number,
  freeText: ReadonlySet<string> = FREE_TEXT_KEYS,
): RevealedValue<T> {
  const cursor: Cursor = { budget, activePath: null, freeText };
  const partial = (reveal(value, [], false, cursor) ?? {}) as DeepPartial<T>;
  return {
    value: partial,
    activePath: cursor.activePath,
    isComplete: budget >= writtenLength(value, freeText),
  };
}

/** The day as it would look after `budget` characters of the stream. */
export function revealDay(day: GeneratedDay, budget: number): RevealedDay {
  const { value, activePath, isComplete } = revealValue(day, budget);
  return { day: value, activePath, isComplete };
}
