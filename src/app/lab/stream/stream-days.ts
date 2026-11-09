import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { WRITTEN_DAYS } from "@/lib/days/written/days";
import { EDGE_DAYS, REFUSED_DAY } from "@/lib/fixtures/edge/edge-days";
import type { DayRequest, GeneratedDay } from "@/lib/schema/itinerary.schema";

/** A fixture day a stream can be played from. */
export interface StreamDay {
  label: string;
  request: DayRequest;
  day: GeneratedDay;
}

/**
 * Every fixture day: the ones written by hand, the starts' the site serves, the edge ones,
 * and the refused one, which only a finished stream reaches, as `invalid`.
 */
export const STREAM_DAYS: readonly StreamDay[] = [
  ...[...CURATED_DAYS, ...WRITTEN_DAYS].map(({ request, day }) => ({
    label: request.city,
    request,
    day,
  })),
  ...[...EDGE_DAYS, REFUSED_DAY].map(({ edge, request, day }) => ({
    label: `${request.city}: ${edge}`,
    request,
    day,
  })),
];
