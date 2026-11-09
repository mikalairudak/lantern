import { parsePartialJson } from "ai";
import { WRITTEN_DAY_PACE } from "@/lib/stream/answer-day-request";
import type { PartialDay } from "@/lib/stream/outcome";
import {
  DEFAULT_PACE,
  dayText,
  type StreamEnding,
  type StreamPace,
} from "@/lib/stream/simulate-day-stream";
import type { UnevenPace } from "@/lib/stream/uneven-pace";
import type { GeneratedDay } from "@/lib/schema/itinerary.schema";

/** What a client has after the first `at` characters of a day's text. */
export interface Frame {
  at: number;
  partial: PartialDay;
}

/**
 * A partial for every token-sized delta of a day's text, parsed with the stream reader's
 * own `parsePartialJson`. The reader parses whatever prefix it holds when the SDK hands it
 * text, and the SDK batches deltas, so a live client skips some of these frames. Each
 * carries its character offset, so a scrubbed frame can be where a stream ends.
 */
export async function framesOf(day: GeneratedDay): Promise<Frame[]> {
  const text = dayText(day);
  const offsets: number[] = [];
  for (let at = 0; at < text.length; at += DEFAULT_PACE.deltaChars) offsets.push(at);
  offsets.push(text.length);
  return Promise.all(offsets.map(async (at) => ({ at, partial: await partialAt(text, at) })));
}

/** The partial a client holds after the first `at` characters of `text`. */
export async function partialAt(text: string, at: number): Promise<PartialDay> {
  const { value } = await parsePartialJson(text.slice(0, at));
  return isRecord(value) ? (value as PartialDay) : {};
}

/**
 * Where the stream is writing: the path to the last value in the partial. Properties stream
 * in schema order, so the last key at each level is the one still open.
 */
export function openPathOf(partial: unknown): (string | number)[] {
  const path: (string | number)[] = [];
  let node = partial;
  for (;;) {
    if (Array.isArray(node) && node.length > 0) {
      path.push(node.length - 1);
      node = node.at(-1);
    } else if (isRecord(node) && Object.keys(node).length > 0) {
      const key = Object.keys(node).at(-1) ?? "";
      path.push(key);
      node = node[key];
    } else {
      return path;
    }
  }
}

/** A moment in a day's stream worth a cell in the matrix, found in its text. */
export interface FramePoint {
  label: string;
  /** The character offset in `dayText(day)`, or null when the day never reaches it. */
  at: (text: string) => number | null;
}

/** Just past the start of the first `"key":"` in `text`, by `into` characters. */
function into(key: string, chars: number): (text: string) => number | null {
  return (text) => {
    const start = text.indexOf(`"${key}":`);
    return start === -1 ? null : start + `"${key}":`.length + chars;
  };
}

// Inside a string, past its opening quote and a few letters: the word stops mid-way.
const MID_WORD = 6;

/** The moments a stream-aware component has to look right in, in the order they stream. */
export const FRAME_POINTS: readonly FramePoint[] = [
  { label: "nothing yet", at: () => 0 },
  { label: "the day's line, mid-word", at: into("dek", MID_WORD) },
  { label: "the first name, mid-word", at: into("name", MID_WORD) },
  // One digit of a duration: 1 of 15 or of 150, final only once the next key starts.
  { label: "a duration still growing", at: into("durationMinutes", 1) },
  { label: "every stop, no swaps yet", at: into("alternatives", 1) },
  { label: "the whole day", at: (text) => text.length },
];

/** A way to end the stream, as `docs/harness.md` "The outcome protocol" lists them. */
export interface EndingPreset {
  label: string;
  /** The ending, given the scrubbed frame's offset; only positioned endings use it. */
  ending: (at: number) => StreamEnding;
  /** Ends at the scrubbed frame, rather than at the end or before any text. */
  isPositioned: boolean;
}

export const ENDING_PRESETS: readonly EndingPreset[] = [
  { label: "The model finishes", ending: () => ({ kind: "finished" }), isPositioned: false },
  {
    label: "Max tokens here",
    ending: (at) => ({ kind: "cut", at, by: "length" }),
    isPositioned: true,
  },
  {
    label: "An error here",
    ending: (at) => ({ kind: "cut", at, by: "error" }),
    isPositioned: true,
  },
  {
    label: "A timeout here",
    ending: (at) => ({ kind: "cut", at, by: "timeout" }),
    isPositioned: true,
  },
  {
    label: "The connection drops here",
    ending: (at) => ({ kind: "dropped", at }),
    isPositioned: true,
  },
  {
    label: "The model refuses here",
    ending: (at) => ({ kind: "refused", at }),
    isPositioned: true,
  },
  { label: "Rejected before any text", ending: () => ({ kind: "rejected" }), isPositioned: false },
  { label: "Our own limit", ending: () => ({ kind: "limited" }), isPositioned: false },
  { label: "Offline", ending: () => ({ kind: "offline" }), isPositioned: false },
];

/** How fast a played day arrives: even deltas, or a live model's bursts and pauses. */
export type Pace = Partial<StreamPace> | UnevenPace;

/**
 * A live model sends a day in uneven bursts with pauses, in about a minute; the landing
 * plays it eight times faster with the same pauses, as the route does. The even pace, ten
 * times a live model's, reads a whole day in a few seconds.
 */
export const PACES: Readonly<Record<string, Pace>> = {
  "A live model": { kind: "uneven" },
  "The landing, eight times faster": WRITTEN_DAY_PACE,
  "Ten times faster": { deltaChars: 40, deltaDelayMs: 13 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
