import { describe, expect, it } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { ALICANTE_DEK, DEK_PARTS, dekOf, pieceOf, withFragment, type DekPart } from "./dek";
import { RECOMPOSITIONS } from "./recompositions";

/** Every fragment the fixtures can write for a part of the day, the first day's included. */
function fragmentsFor(part: DekPart): string[] {
  const written = RECOMPOSITIONS.filter(({ generation }) => generation.dekPart === part).map(
    ({ generation }) => generation.dek,
  );
  return [...new Set([ALICANTE_DEK[part], ...written])];
}

describe("the line about the day", () => {
  it("joins the first day's fragments into the line the model wrote", () => {
    expect(dekOf(ALICANTE_DEK)).toBe(ABACUS_DAY.dek);
  });

  it("is touched in the morning, at dusk and in the evening by answers, never at midday", () => {
    expect(fragmentsFor("morning")).toHaveLength(2);
    expect(fragmentsFor("midday")).toEqual([ALICANTE_DEK.midday]);
    expect(fragmentsFor("dusk")).toEqual([
      "",
      "the tram up the coast to San Juan at dusk",
      "a taxi out to the cape for the sunset",
    ]);
    expect(fragmentsFor("evening")).toHaveLength(7);
  });

  const combinations = fragmentsFor("morning").flatMap((morning) =>
    fragmentsFor("dusk").flatMap((dusk) =>
      fragmentsFor("evening").map((evening) => ({ ...ALICANTE_DEK, morning, dusk, evening })),
    ),
  );

  it.each(combinations.map((fragments) => [dekOf(fragments), fragments]))(
    "reads as one sentence: %s",
    (line, fragments) => {
      expect(line).toMatch(/^[A-Z]/);
      expect(line).toMatch(/[a-z]\.$/);
      expect(line.match(/, and /g)).toHaveLength(1);
      expect(line).not.toMatch(/ ,|,,|  |\.\./);
      for (const part of DEK_PARTS) expect(line).toContain(fragments[part]);
      // "and" comes once, before the evening that closes the line.
      expect(line.endsWith(`, and ${fragments.evening}.`)).toBe(true);
    },
  );

  it("drops a fragment with nothing to say, with what joins it", () => {
    expect(pieceOf("dusk", "")).toBe("");
    expect(dekOf(withFragment(ALICANTE_DEK, "dusk", "a taxi out to the cape"))).toContain(
      "rice on the marina, a taxi out to the cape, and tapas",
    );
  });

  it("closes the evening only once it is written in full", () => {
    expect(pieceOf("evening", "a table for", false)).toBe(", and a table for");
    expect(pieceOf("evening", "a table for everyone")).toBe(", and a table for everyone.");
  });
});
