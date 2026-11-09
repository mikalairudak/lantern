import {
  CROWDED_DAY,
  LATE_NIGHT_DAY,
  LONG_STAY_DAY,
  MIDNIGHT_SUN_DAY,
  MINIMAL_DAY,
  POLAR_NIGHT_DAY,
  REPAIRED_DAY,
} from "@/lib/fixtures/edge/edge-days";
import type { EdgeDay } from "@/lib/fixtures/edge/edge-day";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";

/**
 * The edge days, each on the abacus by its own path, so the rows can be read at the
 * extremes the schema allows: one stop, an eight-hour stop, twelve stops with the longest
 * names, polar suns and a night past midnight.
 */
export const EDGE_FRAMES = [
  { key: "minimal", day: MINIMAL_DAY },
  { key: "long-stay", day: LONG_STAY_DAY },
  { key: "crowded", day: CROWDED_DAY },
  { key: "polar-night", day: POLAR_NIGHT_DAY },
  { key: "midnight-sun", day: MIDNIGHT_SUN_DAY },
  { key: "late-night", day: LATE_NIGHT_DAY },
  { key: "repaired", day: REPAIRED_DAY },
] as const satisfies readonly { key: string; day: EdgeDay }[];

export type EdgeFrameKey = (typeof EDGE_FRAMES)[number]["key"];

/** The edge day a path names, or null for anything else. */
export function edgeDayOf(value: unknown): EdgeDay | null {
  return EDGE_FRAMES.find((frame) => frame.key === value)?.day ?? null;
}

/**
 * The itinerary the normalizer makes of an edge day. Every day in the list normalizes;
 * the refused one is left out of it, so a refusal here is a broken fixture.
 */
export function edgeItineraryOf(edge: EdgeDay): Itinerary {
  const result = normalizeDay(edge.request, edge.day);
  if (!result.ok) throw new Error(`Edge day "${edge.edge}" was refused: ${result.reason}`);
  return result.itinerary;
}
