import { routeSourceFor } from "@/features/itinerary/day-route";
import type { DaySource } from "@/features/itinerary/use-day-stream";
import type { WrittenDay } from "@/lib/days/written/written-day";
import { isSameRequest } from "@/lib/days/request";
import { isWrittenRequest } from "@/lib/days/written/requests";
import { REFUSED_DAY } from "@/lib/fixtures/edge/refused";
import type { DayRequest, GeneratedDay } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import {
  dayText,
  dayTextOffsets,
  simulateDayStream,
  type StreamEnding,
} from "@/lib/stream/simulate-day-stream";
import type { Pace } from "../../stream/frames";

/** The bench plays the landing's pace until another is chosen, so its day looks as `/day`'s. */
export const BENCH_PACE = "The landing, eight times faster";

/** What a stream sends and how it ends. */
export interface BenchStream {
  day: GeneratedDay;
  ending: StreamEnding;
}

/** One way the bench ends a day's first play. */
export interface BenchEnding {
  /** Stable, for the select and for the key that remounts the day. */
  key: string;
  label: string;
  /** What the stream reader makes of it, which decides what the day shows. */
  outcome: DayOutcome["kind"];
  /** The stream stops inside the swaps, so every stop is kept without the swaps after it. */
  isSalvaged: boolean;
  /** The stream for a city's day: that day, cut where the ending falls, or another day. */
  streamOf: (day: GeneratedDay) => BenchStream;
}

/** Where the bench cuts a day's text: at its middle stop, or halfway through its swaps. */
interface Cuts {
  midPlan: number;
  inTheSwaps: number;
}

function cutsOf(day: GeneratedDay): Cuts {
  const { midPlan, options } = dayTextOffsets(day);
  if (midPlan === null || options === null) {
    throw new Error("The bench plays only days with stops and swaps");
  }
  return { midPlan, inTheSwaps: options + Math.floor((dayText(day).length - options) / 2) };
}

/**
 * Every way a day can end, as `docs/harness.md` "The outcome protocol" lists them: a day
 * kept whole or without its later swaps, and each ending with no day to show.
 */
export const BENCH_ENDINGS: readonly BenchEnding[] = [
  {
    key: "finished",
    label: "The model finishes",
    outcome: "complete",
    isSalvaged: false,
    streamOf: (day) => ({ day, ending: { kind: "finished" } }),
  },
  {
    key: "length-in-swaps",
    label: "Max tokens in the swaps",
    outcome: "cut",
    isSalvaged: true,
    streamOf: (day) => ({ day, ending: { kind: "cut", at: cutsOf(day).inTheSwaps, by: "length" } }),
  },
  {
    key: "error-mid-plan",
    label: "An error mid-plan",
    outcome: "cut",
    isSalvaged: false,
    streamOf: (day) => ({ day, ending: { kind: "cut", at: cutsOf(day).midPlan, by: "error" } }),
  },
  {
    key: "dropped-in-swaps",
    label: "Dropped in the swaps",
    outcome: "disconnected",
    isSalvaged: true,
    streamOf: (day) => ({ day, ending: { kind: "dropped", at: cutsOf(day).inTheSwaps } }),
  },
  {
    key: "dropped-mid-plan",
    label: "Dropped mid-plan",
    outcome: "disconnected",
    isSalvaged: false,
    streamOf: (day) => ({ day, ending: { kind: "dropped", at: cutsOf(day).midPlan } }),
  },
  {
    key: "offline",
    label: "Offline",
    outcome: "disconnected",
    isSalvaged: false,
    streamOf: (day) => ({ day, ending: { kind: "offline" } }),
  },
  {
    key: "refused-mid-plan",
    label: "Refused mid-plan",
    outcome: "refused",
    isSalvaged: false,
    streamOf: (day) => ({ day, ending: { kind: "refused", at: cutsOf(day).midPlan } }),
  },
  {
    key: "invalid",
    label: "A blank line about the day",
    outcome: "invalid",
    isSalvaged: false,
    // The fixture whose line about the day is blank, played whole under the city's request.
    streamOf: () => ({ day: REFUSED_DAY.day, ending: { kind: "finished" } }),
  },
  {
    key: "rejected",
    label: "Rejected before any text",
    outcome: "unavailable",
    isSalvaged: false,
    streamOf: (day) => ({ day, ending: { kind: "rejected" } }),
  },
  {
    key: "limited",
    label: "Our own limit",
    outcome: "limited",
    isSalvaged: false,
    streamOf: (day) => ({ day, ending: { kind: "limited" } }),
  },
];

/**
 * Where the bench's day streams from. `Day` plays its first request itself when it mounts, and a
 * copy for every replay, retry and day picked from it, so only the mount play ends as chosen.
 * Strict Mode runs the mount effect twice, with the same request, so the play that survives still
 * ends as chosen, which a count of plays would not. A replay or a retry of a day written by hand
 * plays it whole from its file, since the route holds none of them (`docs/decisions.md`, "The
 * public site offers only days the product wrote"). Any other day streams from the route, as on
 * `/day`, a written day's retry too; live, it asks the route as live generation does, so a changed
 * word re-plans the day, and the route answers as the server is set, or as a test answers for it.
 */
export function benchSourceFor(
  curated: WrittenDay,
  ending: BenchEnding,
  pace: Pace,
  isLive = false,
): (request: DayRequest) => DaySource {
  const { day, ending: streamEnding } = ending.streamOf(curated.day);
  return (request) => {
    if (request === curated.request) {
      return {
        request,
        open: (signal) => simulateDayStream({ day, ending: streamEnding, pace, signal }),
      };
    }
    if (!isWrittenRequest(request) && isSameRequest(request, curated.request)) {
      return {
        request,
        open: (signal) =>
          simulateDayStream({ day: curated.day, ending: { kind: "finished" }, pace, signal }),
      };
    }
    return routeSourceFor(request, { isLive, signature: null });
  };
}
