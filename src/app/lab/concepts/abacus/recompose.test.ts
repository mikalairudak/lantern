import { describe, expect, it } from "vitest";
import { ItinerarySchema } from "@/lib/schema/itinerary.schema";
import { minutesOf } from "@/lib/time/clock";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { changesOf, clauseOf } from "@/features/abacus/clause";
import { candidatesOf, energyOf, modelPicks, plannedPlace } from "@/features/abacus/curve";
import { DEK } from "@/features/abacus/day-draft";
import { ALICANTE_FACTS, optionOf } from "./facts";
import {
  REASON,
  recomposedDayOf,
  recompositionLength,
  replanForEnergy,
  revealRecomposition,
  revisedFacts,
  stopsRecomposedBy,
  type DayState,
  type Recomposition,
} from "./recompose";
import { ALICANTE_DEK, FACT_PARTS, dekOf, withFragment } from "./dek";
import { ALICANTE_DEPENDS_ON, RECOMPOSITIONS, recompositionFor } from "./recompositions";
import { WITH_FAMILY } from "./recompositions-evening";

const DAY: DayState = {
  fragments: ALICANTE_DEK,
  stops: ABACUS_DAY.stops,
  dependsOn: ALICANTE_DEPENDS_ON,
};
const RUN = 1;
const CALM = 1;
const LIVELY = 3;

function written(recomposition: Recomposition, budget?: number) {
  const { generation, answer } = recomposition;
  const revealed = revealRecomposition(generation, budget ?? recompositionLength(generation));
  return { revealed, day: recomposedDayOf(DAY, answer, RUN, revealed) };
}

const names = (stops: readonly { primary: { name?: string } }[]) =>
  stops.map((stop) => stop.primary.name);

describe("which stops an answer re-composes", () => {
  it.each([
    ["company", "family", ["stop-7"]],
    ["company", "alone", ["stop-7"]],
    ["dinner", "early", ["stop-7"]],
    ["end", "late", ["stop-7"]],
    ["travel", "transit", ["stop-6"]],
    ["travel", "taxi", ["stop-6"]],
    ["start", "slow", ["stop-0", "stop-1", "stop-2"]],
  ] as const)("%s %s re-composes %j", (key, value, stops) => {
    const recomposition = recompositionFor({ key, value });
    if (!recomposition) throw new Error(`No re-composition for ${key} ${value}`);

    expect(stopsRecomposedBy(DAY, recomposition)).toEqual(stops);
  });

  it.each(RECOMPOSITIONS.map((each) => [`${each.answer.key} ${each.answer.value}`, each]))(
    "%s writes exactly the stops that depend on it, and no others",
    (_, recomposition) => {
      const rewritten = recomposition.generation.stops.map((stop) => stop.id);
      const { day } = written(recomposition);

      expect(rewritten).toEqual(stopsRecomposedBy(DAY, recomposition));
      day.stops.forEach((stop, index) => {
        if (!rewritten.includes(stop.id)) expect(stop).toBe(DAY.stops[index]);
      });
    },
  );

  it("has a re-composition for every answer that is not already the first day's", () => {
    const facts = Object.values(ALICANTE_FACTS).filter((fact) => fact.key !== "energy");
    for (const fact of facts) {
      for (const option of fact.options) {
        expect(
          recompositionFor({ key: fact.key, value: option.value }),
          option.label,
        ).not.toBeNull();
      }
    }
  });
});

describe("each re-composition", () => {
  it.each(RECOMPOSITIONS.map((each) => [`${each.answer.key} ${each.answer.value}`, each]))(
    "%s rewrites only the fragment of the line for its own part of the day",
    (_, recomposition) => {
      const { answer, generation } = recomposition;

      expect(answer.key).not.toBe("energy");
      expect(generation.dekPart).toBe(FACT_PARTS[answer.key as keyof typeof FACT_PARTS]);
    },
  );

  it.each(RECOMPOSITIONS.map((each) => [`${each.answer.key} ${each.answer.value}`, each]))(
    "%s gives a valid day, in order, with a quieter and a livelier version where it can",
    (_, recomposition) => {
      const { day } = written(recomposition);
      const { dekPart, dek } = recomposition.generation;
      const line = dekOf(withFragment(ALICANTE_DEK, dekPart, dek));
      const itinerary = { ...ABACUS_DAY, dek: line, stops: day.stops };

      expect(ItinerarySchema.safeParse(itinerary).error).toBeUndefined();
      for (const id of recomposition.generation.stops.map((stop) => stop.id)) {
        const stop = day.stops.find((each) => each.id === id)!;
        const planned = energyOf({ sensory: { energy: plannedPlace(stop).sensory!.energy! } });
        const versions = stop.alternatives.map((each) => energyOf(each));
        expect(versions.length, stop.primary.name).toBeGreaterThan(0);
        expect(versions.every((energy) => energy !== planned)).toBe(true);
      }
    },
  );
});

describe("with family", () => {
  it("revises eating late to an early dinner, for a reason", () => {
    const { revealed } = written(WITH_FAMILY);
    const facts = revisedFacts(ALICANTE_FACTS, revealed.value);

    expect(facts.dinner).toMatchObject({
      value: "early",
      source: "assumed",
      revisedFrom: "late",
      reason: "an earlier dinner suits a family",
    });
    expect(optionOf(facts.dinner, facts.dinner.revisedFrom)?.label).toBe("eating late");
    expect(optionOf(facts.dinner, facts.dinner.value)?.label).toBe("early dinner");
  });

  it("moves dinner earlier, to a table that suits a family, and rewrites the line", () => {
    const { day } = written(WITH_FAMILY);
    const dinner = day.stops[7]!;

    expect(dinner).toMatchObject({ id: "stop-7", startTime: "20:30" });
    expect(dinner.primary).toMatchObject({ name: "Rice on Calle Mayor", kind: "food" });
    expect(dinner.alternatives.map((version) => version.name)).toEqual([
      "Rice dishes in El Pla",
      "Rice dishes on Óscar Esplá",
    ]);
    expect(WITH_FAMILY.generation.dekPart).toBe("evening");
    expect(day.dek).toBe("a table for everyone in the old town at half past eight");
    expect(names(day.stops.slice(0, 7))).toEqual(names(ABACUS_DAY.stops.slice(0, 7)));
  });

  it("empties dinner at once, at its old time, before anything is written", () => {
    const { day } = written(WITH_FAMILY, 0);
    const dinner = day.stops[7]!;

    expect(day.rewriting).toEqual(["stop-7"]);
    expect(dinner.startTime).toBe("21:00");
    expect(dinner.primary.name).toBeUndefined();
    expect(dinner.primary.id).not.toBe(ABACUS_DAY.stops[7]!.primary.id);
    expect(day.dek).toBeUndefined();
  });

  it("writes the revision's reason first, then dinner by its stable id, then the line", () => {
    const length = recompositionLength(WITH_FAMILY.generation);
    const writing = Array.from({ length }, (_, budget) => written(WITH_FAMILY, budget).day.writing);
    const firstOf = (key: string | null) => writing.indexOf(key);

    expect(firstOf(REASON)).toBeGreaterThanOrEqual(0);
    expect(firstOf(REASON)).toBeLessThan(firstOf("stop-7:r1:p.name"));
    expect(firstOf("stop-7:r1:p.name")).toBeLessThan(firstOf(DEK));
  });
});

describe("a slow morning", () => {
  const SLOW = recompositionFor({ key: "start", value: "slow" })!;

  it("moves the stops still empty along, so no wire sits before the one above it", () => {
    const length = recompositionLength(SLOW.generation);
    const days = Array.from({ length }, (_, budget) => written(SLOW, budget).day.stops);

    for (const stops of days) {
      const mids = stops.map((stop) => minutesOf(stop.startTime) + stop.durationMinutes / 2);
      expect(mids).toEqual([...mids].sort((a, b) => a - b));
    }
    const breakfastOnly = days.find(
      (stops) => stops[0]?.primary.name !== undefined && stops[1]?.primary.name === undefined,
    );
    expect(breakfastOnly?.[1]?.startTime).toBe("09:45");
  });
});

describe("replanForEnergy", () => {
  it("shifts the plan with the energy word, keeping the day's shape", () => {
    const lively = replanForEnergy(DAY.stops, CALM, LIVELY);

    expect(names(lively.map((stop) => ({ primary: plannedPlace(stop) })))).toEqual([
      "Churros in the old town",
      "Calle Mayor",
      "Rambla de Méndez Núñez",
      "Vermouth on Calle Castaños",
      "Tapas on San Fernando",
      "Horchata by Santa María",
      "Ice cream on the Explanada",
      "Tapas on Calle Villegas",
    ]);
  });

  it("makes the new picks the plan, so the headline gains no clause", () => {
    const lively = replanForEnergy(DAY.stops, CALM, LIVELY);

    expect(clauseOf(changesOf(lively, modelPicks(lively)))).toBeNull();
  });

  it("keeps the plan where two versions are as near, and leaves the day for the same word", () => {
    const balanced = replanForEnergy(DAY.stops, CALM, 2);
    const lunch = balanced[4]!;

    expect(plannedPlace(lunch).name).toBe("Paella on the marina");
    expect(candidatesOf(lunch)).toHaveLength(3);
    expect(replanForEnergy(DAY.stops, CALM, CALM)).toEqual(DAY.stops);
  });
});
