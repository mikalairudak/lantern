import type { DayRequest, GeneratedDay } from "@/lib/schema/itinerary.schema";

/**
 * A hand-written day at an edge of what the schema allows: the fewest or the most of
 * something, a value the curated days never use, a sun that never rises or never sets, or
 * a generation the normalizer has to repair or refuse. These days drive `/lab`, the stream
 * simulator and tests. No visitor lands on one, so its lines are not judged against
 * `docs/voice.md`; they still name real places at roughly the right coordinates and keep
 * clear of the banned phrases, because the lab shows them as the product would.
 */
export interface EdgeDay {
  /** Which edge it sits on, for a `/lab` label and a test name. */
  edge: string;
  request: DayRequest;
  day: GeneratedDay;
}
