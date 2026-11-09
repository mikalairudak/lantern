import type { Itinerary } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";

/** What the UI is handed when a stream ends, in a line to check against the protocol. */
export function outcomeLine(outcome: DayOutcome): string {
  switch (outcome.kind) {
    case "complete":
      return `complete: ${countsOf(outcome.itinerary)}`;
    case "cut":
    case "disconnected":
      return outcome.itinerary === null
        ? `${outcome.kind}: nothing kept, so the UI shows a failure`
        : `${outcome.kind}: kept ${countsOf(outcome.itinerary)}`;
    case "refused":
      return "refused: the partial is cleared";
    case "invalid":
      return `invalid: ${outcome.reason}`;
    case "unavailable":
    case "limited":
      return `${outcome.kind}: nothing arrived`;
  }
}

function countsOf(itinerary: Itinerary): string {
  const swaps = itinerary.stops.reduce((sum, stop) => sum + stop.alternatives.length, 0);
  return `${plural(itinerary.stops.length, "stop")}, ${plural(swaps, "swap")}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
