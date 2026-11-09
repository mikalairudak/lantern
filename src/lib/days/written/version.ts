import type { WrittenDay } from "./written-day";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";

/**
 * A written day's version, and how a browser says it has watched one to its end
 * (`docs/decisions.md`, "A day can be read as a list, written as the chart is"). The page and the
 * route work the version out from the day as built, the same way, so a day rewritten in a later
 * build reads as new to a visitor who had seen it.
 */

/** A written day's version: sixteen hex digits, two 32-bit FNV-1a hashes side by side. */
export const WRITTEN_VERSION_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Sent by the browser with a written day it has watched to its end: its address's slug and
 * the version it saw, as `kyoto:0123456789abcdef`. Anything else is no header at all.
 */
export const SEEN_DAY_HEADER = "X-Lantern-Seen-Day";

/** Each written day's answer says its version, for the browser to keep once it has played. */
export const DAY_VERSION_HEADER = "X-Lantern-Day-Version";

/** A written day the browser has seen in this version comes whole at once, and says so. */
export const WHOLE_DAY_HEADER = "X-Lantern-Day-Whole";

const FNV_PRIME = 0x01000193;
/** FNV-1a's offset basis, and a second one for the other half. */
const OFFSETS = [0x811c9dc5, 0x050c5d1f] as const;

function fnv1a(text: string, offset: number): string {
  let hash = offset;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Which version of a written day the build holds, from the day as the page draws it: the
 * same for every build that writes it the same, and another once a word of it changes.
 * Worked out from the day alone, never from the clock or the visit.
 */
export function writtenVersionOf(itinerary: Itinerary): string {
  const text = JSON.stringify(itinerary);
  return OFFSETS.map((offset) => fnv1a(text, offset)).join("");
}

const versions = new WeakMap<WrittenDay, string>();

/** A written day's version, normalized as its page draws it; worked out once. */
export function writtenVersionFor(written: WrittenDay): string {
  const known = versions.get(written);
  if (known !== undefined) return known;
  const normalized = normalizeDay(written.request, written.day);
  if (!normalized.ok) throw new Error(`A written day does not normalize: ${normalized.reason}`);
  const version = writtenVersionOf(normalized.itinerary);
  versions.set(written, version);
  return version;
}

const SEEN_DAY_VALUE = /^([a-z0-9-]{1,64}):([0-9a-f]{16})$/;

/**
 * The version a request says this browser has watched to its end for the written day at
 * `slug`, or null: for no header, one for another day, or anything not in its exact form.
 */
export function seenVersionOf(header: string | null, slug: string): string | null {
  const parsed = header === null ? null : SEEN_DAY_VALUE.exec(header);
  return parsed !== null && parsed[1] === slug ? (parsed[2] ?? null) : null;
}
