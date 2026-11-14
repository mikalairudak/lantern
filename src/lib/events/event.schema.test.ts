import { describe, expect, expectTypeOf, it } from "vitest";
import type { IntakeResult } from "@/lib/schema/intake.schema";
import { KYOTO_DRAGGED, KYOTO_ON_CHART, ONE_EVENT_OF_EACH_KIND } from "@/lib/fixtures/events";
import { FACT_KEYS } from "@/lib/schema/itinerary.schema";
import { MAX_LIVE_CITY_CHARS } from "@/lib/stream/answer-day-request";
import type { DayOutcome } from "@/lib/stream/outcome";
import {
  DAY_ACTS,
  DAY_OUTCOMES,
  DAY_VIAS,
  DAY_VIEWS,
  HEADER_WORDS,
  INTAKE_OUTCOMES,
  LEFT_STAGES,
  MAX_EVENT_CITY_CHARS,
  ProductEventSchema,
  WORD_CONTROLS,
  type ProductEventKind,
} from "./event.schema";

/** The words `db/migrations/0005_product_events.sql` lets a vocabulary column hold. */
const STORED_WORD = /^[a-z]+(-[a-z]+)*$/;

describe("the product's events", () => {
  it("list every way a day ends and every answer the intake gives, no more", () => {
    expectTypeOf<(typeof DAY_OUTCOMES)[number]>().toEqualTypeOf<DayOutcome["kind"]>();
    expectTypeOf<(typeof INTAKE_OUTCOMES)[number]>().toEqualTypeOf<IntakeResult["kind"]>();
    expect(HEADER_WORDS).toEqual(["city", ...FACT_KEYS]);
  });

  it("have one of each kind in the fixture", () => {
    const kinds = ProductEventSchema.options.map((option) => option.shape.kind.value);

    expect(ONE_EVENT_OF_EACH_KIND.map((event) => event.kind)).toEqual(kinds);
  });

  it.each(ONE_EVENT_OF_EACH_KIND)("accept a $kind event", (event) => {
    expect(ProductEventSchema.parse(event)).toEqual(event);
  });

  it.each(DAY_ACTS)("tell a %s with the day, how it was reached and its view", (kind) => {
    expectTypeOf(kind).toExtend<ProductEventKind>();
    const { view, ...day } = KYOTO_ON_CHART;

    expect(ProductEventSchema.safeParse({ kind, ...KYOTO_ON_CHART }).success).toBe(true);
    expect(ProductEventSchema.safeParse({ kind, ...day }).success).toBe(false);
    expect(ProductEventSchema.safeParse({ kind, city: "kyoto", view }).success).toBe(false);
  });

  it("tell how a day ended with the view it was read in, and the start screen with nothing", () => {
    const { view, ...day } = KYOTO_ON_CHART;

    expect(
      ProductEventSchema.safeParse({ kind: "day-ended", ...day, view, outcome: "complete" })
        .success,
    ).toBe(true);
    expect(
      ProductEventSchema.safeParse({ kind: "day-ended", ...day, outcome: "complete" }).success,
    ).toBe(false);
    expect(ProductEventSchema.safeParse({ kind: "home-viewed" }).success).toBe(true);
    expect(ProductEventSchema.safeParse({ kind: "home-viewed", city: "kyoto" }).success).toBe(
      false,
    );
  });

  it.each(WORD_CONTROLS)(
    "tell a word changed at the %s, and no other kind a control",
    (control) => {
      const changed = { kind: "word-changed", city: "kyoto", word: "energy", control } as const;

      expect(ProductEventSchema.safeParse(changed).success).toBe(true);
      expect(
        ProductEventSchema.safeParse({ kind: "menu-opened", ...KYOTO_ON_CHART, control }).success,
      ).toBe(false);
      expect(ProductEventSchema.safeParse({ ...KYOTO_DRAGGED, control }).success).toBe(false);
    },
  );

  it.each([
    ["an unknown kind", { kind: "page-viewed", city: "kyoto" }],
    ["no kind", { city: "kyoto" }],
    [
      "a field its kind does not have",
      { kind: "curve-dragged", ...KYOTO_ON_CHART, word: "energy" },
    ],
    ["the visitor's text", { kind: "intake-ended", outcome: "request", text: "Kyoto, slowly" }],
    ["a field missing", { kind: "day-opened", city: "kyoto", via: "link" }],
    [
      "a word outside its vocabulary",
      { kind: "word-changed", city: "kyoto", word: "date", control: "headline" },
    ],
    ["a word changed with no control", { kind: "word-changed", city: "kyoto", word: "energy" }],
    [
      "a control the page has none of",
      { kind: "word-changed", city: "kyoto", word: "energy", control: "slider" },
    ],
    [
      "the day's menu without its view",
      { kind: "menu-opened", city: "kyoto", via: "link", written: true },
    ],
    ["an outcome of the other attempt", { kind: "intake-ended", outcome: "complete" }],
    ["a view the page has none of", { kind: "stop-swapped", ...KYOTO_ON_CHART, view: "plan" }],
    ["a way in the page has none of", { kind: "stop-swapped", ...KYOTO_ON_CHART, via: "tile" }],
    ["a city with capitals", { kind: "stop-swapped", ...KYOTO_ON_CHART, city: "Kyoto" }],
    ["a city with spaces", { kind: "stop-swapped", ...KYOTO_ON_CHART, city: "sao paulo" }],
    ["an empty city", { kind: "stop-swapped", ...KYOTO_ON_CHART, city: "" }],
    ["a stray hyphen", { kind: "stop-swapped", ...KYOTO_ON_CHART, city: "-kyoto" }],
    ["a boolean as text", { kind: "day-opened", city: "kyoto", via: "link", written: "true" }],
    ["an array of events", [{ kind: "curve-dragged", ...KYOTO_ON_CHART }]],
  ])("refuse %s", (_name, value) => {
    expect(ProductEventSchema.safeParse(value).success).toBe(false);
  });

  it("take a city as long as a live day's, and no longer", () => {
    const longest = "a".repeat(MAX_EVENT_CITY_CHARS);
    const swapped = { kind: "stop-swapped", ...KYOTO_ON_CHART };

    expect(MAX_EVENT_CITY_CHARS).toBe(MAX_LIVE_CITY_CHARS);
    expect(ProductEventSchema.safeParse({ ...swapped, city: longest }).success).toBe(true);
    expect(ProductEventSchema.safeParse({ ...swapped, city: `${longest}a` }).success).toBe(false);
  });

  it("use only words the database's columns can hold", () => {
    const words = [
      ...ProductEventSchema.options.map((option) => option.shape.kind.value),
      ...DAY_VIAS,
      ...DAY_VIEWS,
      ...LEFT_STAGES,
      ...HEADER_WORDS,
      ...DAY_OUTCOMES,
      ...INTAKE_OUTCOMES,
      ...WORD_CONTROLS,
    ];

    for (const word of words) {
      expect(word).toMatch(STORED_WORD);
      expect(word.length).toBeLessThanOrEqual(32);
    }
  });
});
