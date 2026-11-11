import { describe, expect, it } from "vitest";
import { ASSUMABLE_FACT_KEYS, type AssumableFactKey } from "@/lib/schema/itinerary.schema";
import {
  ALICANTE_FACTS,
  FACT_KEYS,
  FACT_OPTIONS,
  FACT_VOCABULARIES,
  answerFacts,
  answerKindOf,
  dependentStops,
  labelOf,
  restorePart,
  reviseFact,
  revisedFactOf,
  settleRevisions,
} from "./facts";

describe("fact options", () => {
  it.each(FACT_KEYS)("offers every value of the %s vocabulary, in its order", (key) => {
    expect(FACT_OPTIONS[key].map((option) => option.value)).toEqual([...FACT_VOCABULARIES[key]]);
  });

  it("maps the energy levels to the words a visitor would use, quiet to social", () => {
    expect(FACT_OPTIONS.energy.map((option) => option.label)).toEqual([
      "quiet",
      "calm",
      "balanced",
      "lively",
      "social",
    ]);
  });

  it("offers the answers the brief lists for each assumption and the question", () => {
    const labels = (key: (typeof FACT_KEYS)[number]) =>
      FACT_OPTIONS[key].map((option) => option.label);

    expect(labels("travel")).toEqual(["on foot", "by public transport", "by taxi"]);
    expect(labels("start")).toEqual(["early start", "slow morning"]);
    expect(labels("dinner")).toEqual(["early dinner", "eating late"]);
    expect(labels("end")).toEqual(["home by eight", "home by eleven", "out late"]);
    expect(labels("company")).toEqual(["alone", "with a partner", "with family", "with friends"]);
  });

  it("offers every value of the schema's vocabulary, in its order", () => {
    for (const key of FACT_KEYS) {
      expect(FACT_OPTIONS[key].map((option) => option.value)).toEqual([...FACT_VOCABULARIES[key]]);
    }
  });

  it("cues each empty word in its own words, asking only the last", () => {
    const empty = (key: AssumableFactKey) => ({ ...ALICANTE_FACTS[key], value: null });

    expect(ASSUMABLE_FACT_KEYS.map((key) => labelOf(empty(key)))).toEqual([
      "getting around …",
      "morning …",
      "dinner …",
      "night …",
      "with anyone",
    ]);
  });

  it("says the open question as a question until it is answered", () => {
    expect(labelOf(ALICANTE_FACTS.company)).toBe("with anyone");
    expect(labelOf(answerFacts(ALICANTE_FACTS, { key: "company", value: "family" }).company)).toBe(
      "with family",
    );
  });
});

describe("answerKindOf", () => {
  it("confirms an assumption when its current option is chosen, re-composing nothing", () => {
    expect(answerKindOf(ALICANTE_FACTS, { key: "travel", value: "on-foot" })).toBe("confirm");
  });

  it("does nothing when a word of the visitor's own is chosen again", () => {
    expect(answerKindOf(ALICANTE_FACTS, { key: "energy", value: "calm" })).toBe("none");
  });

  it("re-plans locally for another energy word", () => {
    expect(answerKindOf(ALICANTE_FACTS, { key: "energy", value: "lively" })).toBe("replan");
  });

  it("re-composes for any other answer, the open question included", () => {
    expect(answerKindOf(ALICANTE_FACTS, { key: "travel", value: "transit" })).toBe("recompose");
    expect(answerKindOf(ALICANTE_FACTS, { key: "company", value: "alone" })).toBe("recompose");
  });
});

describe("answerFacts", () => {
  it("makes a confirmed assumption the visitor's word, so it loses its dotted mark", () => {
    const facts = answerFacts(ALICANTE_FACTS, { key: "travel", value: "on-foot" });

    expect(facts.travel).toMatchObject({ value: "on-foot", source: "chosen" });
    expect(facts.start.source).toBe("assumed");
  });

  it("folds a revision's struck words and reason away at the next change", () => {
    const revised = reviseFact(
      ALICANTE_FACTS,
      { key: "dinner", value: "early" },
      "an earlier dinner suits a family",
    );
    expect(revisedFactOf(revised)?.revisedFrom).toBe("late");

    const next = answerFacts(revised, { key: "travel", value: "on-foot" });

    expect(revisedFactOf(next)).toBeNull();
    expect(next.dinner).toMatchObject({ value: "early", source: "assumed", reason: null });
  });

  it("keeps the first value a fact had through two revisions, as the sentence struck it", () => {
    const once = reviseFact(ALICANTE_FACTS, { key: "dinner", value: "early" }, "a reason");
    const twice = reviseFact(once, { key: "dinner", value: "late" }, "another");

    expect(twice.dinner.revisedFrom).toBe("late");
    expect(settleRevisions(twice).dinner.revisedFrom).toBeNull();
  });
});

describe("restorePart", () => {
  const family = reviseFact(
    answerFacts(ALICANTE_FACTS, { key: "company", value: "family" }),
    { key: "dinner", value: "early" },
    "an earlier dinner suits a family",
  );

  it("writes the other words of the answer's part back to the first day's assumptions", () => {
    const outLate = { key: "end", value: "late" } as const;

    const restored = restorePart(answerFacts(family, outLate), outLate, [], ALICANTE_FACTS);

    expect(labelOf(restored.company)).toBe("with anyone");
    expect(restored.company.source).toBe("asked");
    expect(restored.dinner).toMatchObject({ value: "late", source: "assumed", revisedFrom: null });
    expect(restored.end).toMatchObject({ value: "late", source: "chosen" });
  });

  it("leaves other parts of the day, and what the answer itself revises, to the answer", () => {
    const transit = { key: "travel", value: "transit" } as const;
    const familyAgain = { key: "company", value: "family" } as const;

    expect(
      restorePart(answerFacts(family, transit), transit, [], ALICANTE_FACTS).company.value,
    ).toBe("family");
    expect(restorePart(family, familyAgain, ["dinner"], ALICANTE_FACTS).dinner.revisedFrom).toBe(
      "late",
    );
  });

  it("strikes nothing when a revision finds the fact already so", () => {
    const early = answerFacts(ALICANTE_FACTS, { key: "dinner", value: "early" });

    expect(reviseFact(early, { key: "dinner", value: "early" }, "a reason")).toBe(early);
  });
});

describe("dependentStops", () => {
  it("lists the stops that depend on any of the facts, in the day's order", () => {
    const dependsOn = { a: ["energy", "start"], b: ["energy"], c: ["dinner", "company"] } as const;

    expect(dependentStops(["a", "b", "c"], dependsOn, ["company", "start"])).toEqual(["a", "c"]);
    expect(dependentStops(["a", "b", "c"], dependsOn, ["travel"])).toEqual([]);
  });
});
