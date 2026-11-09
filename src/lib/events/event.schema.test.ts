import { describe, expect, expectTypeOf, it } from "vitest";
import type { IntakeResult } from "@/lib/schema/intake.schema";
import { ONE_EVENT_OF_EACH_KIND } from "@/lib/fixtures/events";
import { FACT_KEYS } from "@/lib/schema/itinerary.schema";
import { MAX_LIVE_CITY_CHARS } from "@/lib/stream/answer-day-request";
import type { DayOutcome } from "@/lib/stream/outcome";
import {
  DAY_OUTCOMES,
  DAY_VIAS,
  HEADER_WORDS,
  INTAKE_OUTCOMES,
  LEFT_STAGES,
  MAX_EVENT_CITY_CHARS,
  ProductEventSchema,
} from "./event.schema";

/** The words `db/migrations/0005_product_events.sql` lets a vocabulary column hold. */
const STORED_WORD = /^[a-z]+(-[a-z]+)*$/;

describe("the product's events", () => {
  it("list every way a day ends and every answer the intake gives, no more", () => {
    expectTypeOf<(typeof DAY_OUTCOMES)[number]>().toEqualTypeOf<DayOutcome["kind"]>();
    expectTypeOf<(typeof INTAKE_OUTCOMES)[number]>().toEqualTypeOf<IntakeResult["kind"]>();
    expect(HEADER_WORDS).toEqual(["city", ...FACT_KEYS]);
  });

  it.each(ONE_EVENT_OF_EACH_KIND)("accept a $kind event", (event) => {
    expect(ProductEventSchema.parse(event)).toEqual(event);
  });

  it.each([
    ["an unknown kind", { kind: "page-viewed", city: "kyoto" }],
    ["no kind", { city: "kyoto" }],
    ["a field its kind does not have", { kind: "curve-dragged", city: "kyoto", word: "energy" }],
    ["the visitor's text", { kind: "intake-ended", outcome: "request", text: "Kyoto, slowly" }],
    ["a field missing", { kind: "day-opened", city: "kyoto", via: "link" }],
    ["a word outside its vocabulary", { kind: "word-changed", city: "kyoto", word: "date" }],
    ["an outcome of the other attempt", { kind: "intake-ended", outcome: "complete" }],
    ["a city with capitals", { kind: "stop-swapped", city: "Kyoto" }],
    ["a city with spaces", { kind: "stop-swapped", city: "sao paulo" }],
    ["an empty city", { kind: "stop-swapped", city: "" }],
    ["a stray hyphen", { kind: "stop-swapped", city: "-kyoto" }],
    ["a boolean as text", { kind: "day-opened", city: "kyoto", via: "link", written: "true" }],
    ["an array of events", [{ kind: "curve-dragged", city: "kyoto" }]],
  ])("refuse %s", (_name, value) => {
    expect(ProductEventSchema.safeParse(value).success).toBe(false);
  });

  it("take a city as long as a live day's, and no longer", () => {
    const longest = "a".repeat(MAX_EVENT_CITY_CHARS);

    expect(MAX_EVENT_CITY_CHARS).toBe(MAX_LIVE_CITY_CHARS);
    expect(ProductEventSchema.safeParse({ kind: "stop-swapped", city: longest }).success).toBe(
      true,
    );
    expect(
      ProductEventSchema.safeParse({ kind: "stop-swapped", city: `${longest}a` }).success,
    ).toBe(false);
  });

  it("use only words the database's columns can hold", () => {
    const words = [
      ...ProductEventSchema.options.map((option) => option.shape.kind.value),
      ...DAY_VIAS,
      ...LEFT_STAGES,
      ...HEADER_WORDS,
      ...DAY_OUTCOMES,
      ...INTAKE_OUTCOMES,
    ];

    for (const word of words) {
      expect(word).toMatch(STORED_WORD);
      expect(word.length).toBeLessThanOrEqual(32);
    }
  });
});
