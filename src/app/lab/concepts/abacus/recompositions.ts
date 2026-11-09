import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { ALICANTE_DEK, FACT_PARTS } from "./dek";
import type { Answer, DependsOn } from "./facts";
import type { Recomposition } from "./recompose";
import { DAYTIME_RECOMPOSITIONS } from "./recompositions-daytime";
import { EVENING_RECOMPOSITIONS } from "./recompositions-evening";
import { toGeneratedOption, toGeneratedPlace } from "./stream";

/**
 * Every answer the Alicante request can take, with the re-composition a model would write
 * for it. Hand-written fixtures until MVP. Each is written from the first day and changes
 * only the stops that depend on the answer and its part's fragment of the line about the
 * day. Answers to different parts of the day combine; within one part the newer answer
 * wins, so "with family" after "out late" reads the family evening alone.
 */

/**
 * What each stop of the first day depends on. Every stop depends on the energy word. The
 * morning was shaped by the early start, the walk at dusk by going on foot, and dinner by
 * eating late, coming home by eleven and who is coming.
 */
export const ALICANTE_DEPENDS_ON: Readonly<Record<string, DependsOn>> = {
  "stop-0": ["energy", "start"],
  "stop-1": ["energy", "start"],
  "stop-2": ["energy", "start"],
  "stop-3": ["energy"],
  "stop-4": ["energy"],
  "stop-5": ["energy"],
  "stop-6": ["energy", "travel"],
  "stop-7": ["energy", "dinner", "end", "company"],
};

/**
 * An answer that takes an assumption back to what the first day assumed writes those
 * stops and its part of the line about the day as they first were.
 */
function restoring(
  answer: Answer & { key: keyof typeof FACT_PARTS },
  consequence: string,
  stopIds: readonly string[],
): Recomposition {
  const restored = ABACUS_DAY.stops.filter((stop) => stopIds.includes(stop.id));
  const dekPart = FACT_PARTS[answer.key];
  return {
    answer,
    consequence,
    generation: {
      revisions: [],
      stops: restored.map((stop) => ({
        id: stop.id,
        startTime: stop.startTime,
        durationMinutes: stop.durationMinutes,
        place: toGeneratedPlace(stop.primary),
      })),
      alternatives: restored.map((stop) => ({
        stopId: stop.id,
        options: stop.alternatives.map(toGeneratedOption),
      })),
      dekPart,
      dek: ALICANTE_DEK[dekPart],
    },
  };
}

export const RECOMPOSITIONS: readonly Recomposition[] = [
  ...DAYTIME_RECOMPOSITIONS,
  ...EVENING_RECOMPOSITIONS,
  restoring({ key: "start", value: "early" }, "sunrise on the beach", [
    "stop-0",
    "stop-1",
    "stop-2",
  ]),
  restoring({ key: "travel", value: "on-foot" }, "the promenade at dusk", ["stop-6"]),
  restoring({ key: "dinner", value: "late" }, "tapas after nine", ["stop-7"]),
  restoring({ key: "end", value: "early" }, "tapas, then home", ["stop-7"]),
];

/** The re-composition for an answer, if the fixtures have one. */
export function recompositionFor({ key, value }: Answer): Recomposition | null {
  return RECOMPOSITIONS.find(({ answer }) => answer.key === key && answer.value === value) ?? null;
}
