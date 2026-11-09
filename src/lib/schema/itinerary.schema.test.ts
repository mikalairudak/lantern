import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DayRequestSchema,
  endKeptBy,
  isTimeWordClash,
  generatedLightOf,
  GeneratedDaySchema,
  GeneratedPlaceSchema,
  GeneratedStopSchema,
  ItinerarySchema,
  type Alternative,
  type DayRequest,
  type Itinerary,
  type Place,
  type Stop,
} from "./itinerary.schema";
import { GeneratedIntakeSchema } from "./intake.schema";
import { GeneratedReplanSchema } from "./replan.schema";

// Keywords Anthropic structured outputs cannot enforce, plus ones other providers
// support unevenly. The generation layer must never emit them.
const UNPORTABLE_KEYWORDS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "prefixItems",
]);

interface SchemaIssue {
  path: string;
  problem: string;
}

/** A keyword a generated schema may carry at one path, with the one value it may take. */
interface AllowedKeyword {
  path: string;
  keyword: string;
  value: unknown;
}

/**
 * The one exception (`docs/decisions.md`, "A day has at least one stop"): Anthropic's
 * structured outputs take `minItems` of 0 or 1, and a day with no stops is no day.
 */
const DAY_ALLOWED_KEYWORDS: readonly AllowedKeyword[] = [
  { path: "$.properties.stops", keyword: "minItems", value: 1 },
];

function isAllowed(
  allowed: readonly AllowedKeyword[],
  path: string,
  keyword: string,
  value: unknown,
): boolean {
  return allowed.some(
    (exception) =>
      exception.path === path && exception.keyword === keyword && exception.value === value,
  );
}

interface SchemaNode {
  path: string;
  schema: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Every object in a JSON Schema, with field names kept apart from keywords. */
function collectSchemaNodes(node: unknown, path = "$"): SchemaNode[] {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => collectSchemaNodes(child, `${path}[${index}]`));
  }
  if (!isRecord(node)) return [];

  const children = Object.entries(node).flatMap(([key, value]) =>
    // Keys under `properties` are field names, not keywords.
    key === "properties" && isRecord(value)
      ? Object.entries(value).flatMap(([field, fieldSchema]) =>
          collectSchemaNodes(fieldSchema, `${path}.properties.${field}`),
        )
      : collectSchemaNodes(value, `${path}.${key}`),
  );
  return [{ path, schema: node }, ...children];
}

/**
 * Optional fields: OpenAI's strict mode rejects them, and Anthropic moves them after the
 * required ones, which breaks render order while streaming. `.nullable()` keeps both.
 */
function findOptionalFields(path: string, schema: Record<string, unknown>): SchemaIssue[] {
  if (!isRecord(schema.properties)) return [];
  const required = Array.isArray(schema.required) ? schema.required : [];
  return Object.keys(schema.properties)
    .filter((field) => !required.includes(field))
    .map((field) => ({ path: `${path}.properties.${field}`, problem: "optional field" }));
}

function findPortabilityIssues(
  jsonSchema: unknown,
  allowed: readonly AllowedKeyword[] = [],
): SchemaIssue[] {
  return collectSchemaNodes(jsonSchema).flatMap(({ path, schema }) => {
    const keywordIssues = Object.keys(schema)
      .filter((key) => UNPORTABLE_KEYWORDS.has(key))
      .filter((key) => !isAllowed(allowed, path, key, schema[key]))
      .map((key) => ({ path, problem: `unportable keyword "${key}"` }));
    const isOpenObject = schema.type === "object" && schema.additionalProperties !== false;
    const objectIssues = isOpenObject
      ? [{ path, problem: "object without additionalProperties: false" }]
      : [];
    return [...objectIssues, ...keywordIssues, ...findOptionalFields(path, schema)];
  });
}

/** Paths of fields without a description, which is the model's only prompt for them. */
function findUndocumentedFields(jsonSchema: unknown): string[] {
  return collectSchemaNodes(jsonSchema).flatMap(({ path, schema }) =>
    isRecord(schema.properties)
      ? Object.entries(schema.properties)
          .filter(([, field]) => !isRecord(field) || typeof field.description !== "string")
          .map(([field]) => `${path}.properties.${field}`)
      : [],
  );
}

function buildPlace(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    name: "Honen-in",
    kind: "sacred",
    neighborhood: "Higashiyama",
    summary: "A moss-lined gate and raked sand mounds, before the tour buses arrive.",
    aesthetic: ["moss", "raw timber"],
    coordinates: { lat: 35.0189, lng: 135.7963 },
    sensory: {
      energy: "reflective",
      acoustic: "hushed",
      crowd: "sparse",
      texture: "Gravel underfoot, cicadas, no music.",
    },
    light: {
      exposure: "dappled",
      orientation: "e",
      bestWindow: "morning",
      note: "Low sun rakes across the moss until nine; flat by noon.",
    },
    ...overrides,
  };
}

function buildAlternative(id: string): Alternative {
  return {
    ...buildPlace(id, { name: "Anraku-ji" }),
    reason: "Same moss, fewer steps, no gate fee.",
  };
}

function buildStop(index: number, startTime: string, overrides: Partial<Stop> = {}): Stop {
  const primaryId = `stop-${index}:p`;
  return {
    id: `stop-${index}`,
    startTime,
    durationMinutes: 60,
    primary: buildPlace(primaryId),
    alternatives: [buildAlternative(`stop-${index}:a0`)],
    selectedPlaceId: primaryId,
    dependsOn: ["energy", "start"],
    ...overrides,
  };
}

const FACTS: Itinerary["facts"] = {
  energy: { value: "calm", source: "chosen" },
  travel: { value: "on-foot", source: "chosen" },
  start: { value: "early", source: "assumed" },
  dinner: { value: "early", source: "assumed" },
  end: { value: "early", source: "assumed" },
  company: { value: null, source: "asked" },
};

function buildItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    dek: "A slow day east of the river.",
    city: "Kyoto",
    date: "2026-11-14",
    timezone: "Asia/Tokyo",
    facts: FACTS,
    stops: [buildStop(0, "08:00"), buildStop(1, "10:00")],
    ...overrides,
  };
}

function issueMessages(data: unknown): string[] {
  const result = ItinerarySchema.safeParse(data);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

/** Every schema a model is constrained to: the day's, the intake's and a targeted re-plan's. */
const GENERATED_SCHEMAS = [
  { name: "GeneratedDaySchema", schema: GeneratedDaySchema, allowed: DAY_ALLOWED_KEYWORDS },
  { name: "GeneratedIntakeSchema", schema: GeneratedIntakeSchema, allowed: [] },
  { name: "GeneratedReplanSchema", schema: GeneratedReplanSchema, allowed: [] },
];

describe("GeneratedDaySchema as JSON Schema", () => {
  it.each(
    GENERATED_SCHEMAS.flatMap((generated) =>
      (["input", "output"] as const).map((io) => ({ ...generated, io })),
    ),
  )("$name is portable across structured-output providers (io: $io)", ({ schema, allowed, io }) => {
    const jsonSchema = z.toJSONSchema(schema, { io });

    expect(findPortabilityIssues(jsonSchema, allowed)).toEqual([]);
  });

  it("carries its one exception, at least one stop, and no other count", () => {
    const jsonSchema = z.toJSONSchema(GeneratedDaySchema);

    expect(findPortabilityIssues(jsonSchema)).toEqual([
      { path: "$.properties.stops", problem: 'unportable keyword "minItems"' },
    ]);
  });

  it.each([
    ["a higher count on the stops", z.strictObject({ stops: z.array(z.string()).min(2) })],
    ["the same count on another array", z.strictObject({ tags: z.array(z.string()).min(1) })],
    ["another count on the stops", z.strictObject({ stops: z.array(z.string()).min(1).max(9) })],
  ])("still rejects %s", (_name, schema) => {
    const issues = findPortabilityIssues(z.toJSONSchema(schema), DAY_ALLOWED_KEYWORDS);

    expect(issues).not.toEqual([]);
  });

  it("flags an optional field, which would stream out of render order", () => {
    const jsonSchema = z.toJSONSchema(z.strictObject({ note: z.string().optional() }));

    expect(findPortabilityIssues(jsonSchema)).toEqual([
      { path: "$.properties.note", problem: "optional field" },
    ]);
  });

  it("streams the request's words first and what a stop depends on after its place", () => {
    expect(Object.keys(GeneratedDaySchema.shape)).toEqual([
      "assumptions",
      "dek",
      "stops",
      "alternatives",
    ]);
    expect(Object.keys(GeneratedStopSchema.shape)).toEqual([
      "startTime",
      "durationMinutes",
      "place",
      "dependsOn",
    ]);
  });

  // `docs/decisions.md`, "Field order is render order": a row waited about 1.48 s on Sonnet's days
  // for its light, behind the sheet's lines.
  it("streams all a row shows or holds room for before the lines only its sheet shows", () => {
    expect(Object.keys(GeneratedPlaceSchema.shape)).toEqual([
      "name",
      "kind",
      "neighborhood",
      "coordinates",
      "sensory",
      "light",
      "summary",
      "aesthetic",
    ]);
    expect(Object.keys(GeneratedPlaceSchema.shape.sensory.shape)[0]).toBe("energy");
  });

  // The card's meta line, the kind and what is eaten there, is written in one pass.
  it.each(GENERATED_SCHEMAS)("$name documents every field the model fills", ({ schema }) => {
    const jsonSchema = z.toJSONSchema(schema);

    expect(findUndocumentedFields(jsonSchema)).toEqual([]);
  });
});

/**
 * The fields the provider compiles as union types: a nullable field (`anyOf` with null, or a
 * type array) or any other `anyOf`, each path once however many times the place repeats it.
 */
function unionFieldsIn(node: unknown, path = "$"): string[] {
  if (typeof node !== "object" || node === null) return [];
  const schema = node as {
    anyOf?: unknown[];
    type?: unknown;
    properties?: Record<string, unknown>;
    items?: unknown;
  };
  const isUnion = schema.anyOf !== undefined || Array.isArray(schema.type);
  return [
    ...(isUnion ? [path] : []),
    ...Object.entries(schema.properties ?? {}).flatMap(([key, value]) =>
      unionFieldsIn(value, `${path}.${key}`),
    ),
    ...unionFieldsIn(schema.items, `${path}[]`),
  ];
}

/**
 * Anthropic compiles a structured output's schema into a grammar and refuses one too large
 * ("Schema complexity limits" in its structured outputs docs). Union types cost the most: at
 * most 16 in a request, and an unnamed limit on the grammar below that. day-v1's schema
 * passed live with 9; with `fare` nullable on a place and on an option it had 11, and the
 * provider refused every day of the `day-v3` round, "The compiled grammar is too large"
 * (`docs/decisions.md`, "The model's schema keeps its union types few"). A new union is a
 * deliberate act: add it here only after the live schema probe (`EVAL_ROUND=schema`) takes it.
 */
describe("the union types the provider compiles", () => {
  // day-v4 put a meal's food in its name, and the fare went with it: none repeats in a list
  // now.
  it("keeps the day's to the request's open words", () => {
    expect(unionFieldsIn(z.toJSONSchema(GeneratedDaySchema))).toEqual([
      "$.assumptions.travel",
      "$.assumptions.start",
      "$.assumptions.dinner",
      "$.assumptions.end",
      "$.assumptions.company",
    ]);
  });

  // Nine, as many as day-v1's, but flat: none repeats in a list, and intake-v1 took them in
  // every live pass.
  // A re-plan writes no assumptions: the changed word is the visitor's, the rest stay as they were.
  it("gives a re-plan none, its stops and alternatives the day's own", () => {
    expect(unionFieldsIn(z.toJSONSchema(GeneratedReplanSchema))).toEqual([]);
  });

  it("keeps the intake's to the nine it has run live with", () => {
    expect(unionFieldsIn(z.toJSONSchema(GeneratedIntakeSchema))).toEqual([
      "$.city",
      "$.energy",
      "$.energyGuess",
      "$.travel",
      "$.start",
      "$.dinner",
      "$.end",
      "$.company",
      "$.date",
    ]);
  });

  it("counts a nullable field and an anyOf, nested in lists", () => {
    const schema = z.strictObject({
      stops: z.array(z.strictObject({ fare: z.string().nullable(), kind: z.enum(["a", "b"]) })),
      mixed: z.union([z.string(), z.number()]),
    });

    expect(unionFieldsIn(z.toJSONSchema(schema))).toEqual(["$.stops[].fare", "$.mixed"]);
  });
});

describe("GeneratedDaySchema", () => {
  const { id, ...place } = buildPlace("unused");
  const generatedPlace = { ...place, light: generatedLightOf(place.light) };
  const generatedDay = {
    assumptions: { travel: "on-foot", start: null, dinner: "early", end: "early", company: null },
    dek: "A slow day east of the river.",
    stops: [
      { startTime: "8:00", durationMinutes: 42.5, place: generatedPlace, dependsOn: ["start"] },
    ],
    alternatives: [{ stopIndex: 0, options: [] }],
  };

  it("accepts soft value issues so the normalizer can repair them", () => {
    expect(GeneratedDaySchema.safeParse(generatedDay).success).toBe(true);
  });

  it("rejects keys outside the contract", () => {
    expect(GeneratedDaySchema.safeParse({ ...generatedDay, rating: 5 }).success).toBe(false);
  });

  // On `day-v1` Sonnet once closed the stops empty after a whole dek.
  it("rejects a day with no stops", () => {
    const empty = { ...generatedDay, stops: [], alternatives: [] };

    expect(GeneratedDaySchema.safeParse(empty).success).toBe(false);
  });

  it("rejects the energy word as an assumption or a dependency, since the request gives it", () => {
    const assumingEnergy = {
      ...generatedDay,
      assumptions: { ...generatedDay.assumptions, energy: "calm" },
    };
    const [stop] = generatedDay.stops;
    const dependingOnEnergy = { ...generatedDay, stops: [{ ...stop, dependsOn: ["energy"] }] };

    expect(GeneratedDaySchema.safeParse(assumingEnergy).success).toBe(false);
    expect(GeneratedDaySchema.safeParse(dependingOnEnergy).success).toBe(false);
  });

  it("rejects ids, which only the normalizer assigns", () => {
    const [stop] = generatedDay.stops;
    const dayWithIds = { ...generatedDay, stops: [{ ...stop, place: { ...generatedPlace, id } }] };

    expect(GeneratedDaySchema.safeParse(dayWithIds).success).toBe(false);
  });
});

describe("ItinerarySchema", () => {
  it("accepts a well-formed itinerary", () => {
    expect(issueMessages(buildItinerary())).toEqual([]);
  });

  it("accepts a stop swapped to one of its alternatives", () => {
    const itinerary = buildItinerary({
      stops: [buildStop(0, "08:00", { selectedPlaceId: "stop-0:a0" }), buildStop(1, "10:00")],
    });

    expect(issueMessages(itinerary)).toEqual([]);
  });

  it("accepts a stop with no alternatives left after the walk-radius check", () => {
    const itinerary = buildItinerary({
      stops: [buildStop(0, "08:00", { alternatives: [] })],
    });

    expect(issueMessages(itinerary)).toEqual([]);
  });

  it("accepts a stop that starts the minute the previous one ends", () => {
    const itinerary = buildItinerary({ stops: [buildStop(0, "08:00"), buildStop(1, "09:00")] });

    expect(issueMessages(itinerary)).toEqual([]);
  });

  it("accepts stops after midnight that follow a late evening", () => {
    const itinerary = buildItinerary({
      stops: [buildStop(0, "23:00", { durationMinutes: 90 }), buildStop(1, "00:45")],
    });

    expect(issueMessages(itinerary)).toEqual([]);
  });

  // Intl resolves some of these to legacy names (Asia/Calcutta), so the check
  // must not compare against what Intl reports back.
  it.each(["Asia/Kolkata", "America/Argentina/Buenos_Aires", "America/Port-au-Prince"])(
    "accepts the city time zone %s",
    (timezone) => {
      expect(issueMessages(buildItinerary({ timezone }))).toEqual([]);
    },
  );

  it.each(["Kyoto/Japan", "Asia/Atlantis", "+05:00", "EST", "UTC", "asia/tokyo"])(
    "rejects the time zone %s",
    (timezone) => {
      expect(issueMessages(buildItinerary({ timezone }))).toEqual([
        'timezone: Expected an IANA city time zone, e.g. "Asia/Tokyo"',
      ]);
    },
  );

  it.each(["9:00", "24:00", "25:99"])(
    "reports the malformed start time %s without a spurious overlap",
    (startTime) => {
      const itinerary = buildItinerary({ stops: [buildStop(0, startTime), buildStop(1, "08:00")] });

      expect(issueMessages(itinerary)).toEqual(["stops.0.startTime: Invalid ISO time"]);
    },
  );

  it("reports an overlong stop without a spurious overlap", () => {
    const itinerary = buildItinerary({
      stops: [buildStop(0, "08:00", { durationMinutes: 600 }), buildStop(1, "09:00")],
    });

    expect(issueMessages(itinerary)).toEqual([
      expect.stringMatching(/^stops\.0\.durationMinutes: Too big/),
    ]);
  });

  const threeAlternatives = [0, 1, 2].map((n) => buildAlternative(`stop-0:a${n}`));

  it.each<[string, Itinerary, RegExp]>([
    [
      "a selection that points at no place",
      buildItinerary({ stops: [buildStop(0, "08:00", { selectedPlaceId: "nowhere" })] }),
      /selectedPlaceId: selectedPlaceId must reference/,
    ],
    [
      "stops out of chronological order",
      buildItinerary({ stops: [buildStop(0, "10:00"), buildStop(1, "08:00")] }),
      /stops\.1\.startTime: Each stop must start after the previous one ends/,
    ],
    [
      "a stop in the small hours after a day that ended in the afternoon",
      buildItinerary({ stops: [buildStop(0, "15:00"), buildStop(1, "00:30")] }),
      /stops\.1\.startTime: Each stop must start after the previous one ends/,
    ],
    [
      "a stop after midnight that starts before the one through midnight ends",
      buildItinerary({
        stops: [buildStop(0, "23:30", { durationMinutes: 90 }), buildStop(1, "00:30")],
      }),
      /stops\.1\.startTime: Each stop must start after the previous one ends/,
    ],
    [
      "two stops at the same time",
      buildItinerary({ stops: [buildStop(0, "08:00"), buildStop(1, "08:00")] }),
      /stops\.1\.startTime: Each stop must start after the previous one ends/,
    ],
    [
      "a stop that starts before the previous one ends",
      buildItinerary({ stops: [buildStop(0, "08:00"), buildStop(1, "08:30")] }),
      /stops\.1\.startTime: Each stop must start after the previous one ends/,
    ],
    [
      "a stop longer than a working day",
      buildItinerary({ stops: [buildStop(0, "08:00", { durationMinutes: 481 })] }),
      /stops\.0\.durationMinutes: Too big/,
    ],
    [
      "an id reused across stops",
      buildItinerary({
        stops: [
          buildStop(0, "08:00"),
          buildStop(1, "10:00", { primary: buildPlace("stop-0:p"), selectedPlaceId: "stop-0:p" }),
        ],
      }),
      /Ids must be unique.*stop-0:p/,
    ],
    [
      "a stop id reused as a place id",
      buildItinerary({ stops: [buildStop(0, "08:00", { id: "stop-0:p" })] }),
      /Ids must be unique.*stop-0:p/,
    ],
    [
      "the same alternative twice in one stop",
      buildItinerary({
        stops: [
          buildStop(0, "08:00", {
            alternatives: [buildAlternative("stop-0:a0"), buildAlternative("stop-0:a0")],
          }),
        ],
      }),
      /Ids must be unique.*stop-0:a0/,
    ],
    [
      "a blank place name",
      buildItinerary({
        stops: [buildStop(0, "08:00", { primary: buildPlace("stop-0:p", { name: "" }) })],
      }),
      /stops\.0\.primary\.name: Text must not be blank/,
    ],
    [
      "a line about the day made of zero-width characters",
      buildItinerary({ dek: "\u200B\u200D" }),
      /dek: Text must not be blank/,
    ],
    ["a whitespace-only city", buildItinerary({ city: "  " }), /city: Text must not be blank/],
    [
      "a blank line of nested text",
      buildItinerary({
        stops: [
          buildStop(0, "08:00", {
            alternatives: [{ ...buildAlternative("stop-0:a0"), reason: " " }],
          }),
        ],
      }),
      /stops\.0\.alternatives\.0\.reason: Text must not be blank/,
    ],
    [
      "an unpadded start time",
      buildItinerary({ stops: [buildStop(0, "8:00")] }),
      /stops\.0\.startTime/,
    ],
    [
      "a fractional duration",
      buildItinerary({ stops: [buildStop(0, "08:00", { durationMinutes: 42.5 })] }),
      /stops\.0\.durationMinutes/,
    ],
    [
      "a latitude out of range",
      buildItinerary({
        stops: [
          buildStop(0, "08:00", {
            primary: buildPlace("stop-0:p", { coordinates: { lat: 135.8, lng: 35.0 } }),
          }),
        ],
      }),
      /stops\.0\.primary\.coordinates\.lat/,
    ],
    [
      "more than two alternatives",
      buildItinerary({ stops: [buildStop(0, "08:00", { alternatives: threeAlternatives })] }),
      /stops\.0\.alternatives/,
    ],
    [
      "more than three aesthetic tags",
      buildItinerary({
        stops: [
          buildStop(0, "08:00", {
            primary: buildPlace("stop-0:p", { aesthetic: ["a", "b", "c", "d"] }),
          }),
        ],
      }),
      /stops\.0\.primary\.aesthetic/,
    ],
    ["an empty day", buildItinerary({ stops: [] }), /stops: Too small/],
    [
      "an asked word with a value",
      buildItinerary({ facts: { ...FACTS, company: { value: "family", source: "asked" } } }),
      /facts\.company: Only an asked word has no value/,
    ],
    [
      "a chosen word without one",
      buildItinerary({ facts: { ...FACTS, travel: { value: null, source: "chosen" } } }),
      /facts\.travel: Only an asked word has no value/,
    ],
    [
      "a stop that does not depend on the energy word",
      buildItinerary({ stops: [buildStop(0, "08:00", { dependsOn: ["start"] })] }),
      /stops\.0\.dependsOn: dependsOn must name the energy word/,
    ],
    [
      "a stop that names a word twice",
      buildItinerary({
        stops: [buildStop(0, "08:00", { dependsOn: ["energy", "start", "start"] })],
      }),
      /stops\.0\.dependsOn: dependsOn must name the energy word, and each word once/,
    ],
  ])("rejects %s", (_name, itinerary, expected) => {
    expect(issueMessages(itinerary).join("\n")).toMatch(expected);
  });

  it("rejects keys outside the contract", () => {
    expect(issueMessages({ ...buildItinerary(), rating: 5 }).join("\n")).toMatch(/rating/);
  });
});

describe("DayRequestSchema", () => {
  const request: DayRequest = {
    city: "Kyoto",
    date: "2026-11-14",
    timezone: "Asia/Tokyo",
    citySource: "chosen",
    energy: "calm",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: "late",
    end: null,
    company: "family",
  };

  function requestIssues(data: unknown): string {
    const result = DayRequestSchema.safeParse(data);
    return result.success
      ? ""
      : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
  }

  it("accepts a city, a day, its zone, one energy word and the other words the visitor chose", () => {
    expect(DayRequestSchema.parse(request)).toEqual(request);
  });

  it.each<[string, unknown, RegExp]>([
    ["a blank city", { ...request, city: " \u200B" }, /city: Text must not be blank/],
    ["a date that is not a day", { ...request, date: "2026-11-31" }, /date/],
    ["a zone without a city", { ...request, timezone: "UTC" }, /timezone: Expected an IANA city/],
    ["a city with no word on who chose it", { ...request, citySource: undefined }, /citySource/],
    ["a city asked about inside a request", { ...request, citySource: "asked" }, /citySource/],
    ["an energy outside the scale", { ...request, energy: "wild" }, /energy/],
    ["an energy curve instead of a word", { ...request, energy: ["calm", "lively"] }, /energy/],
    ["a word outside its vocabulary", { ...request, travel: "bike" }, /travel/],
    ["a word left out rather than left to Lantern", { ...request, end: undefined }, /end/],
    ["keys outside the contract", { ...request, budget: "low" }, /budget/],
  ])("rejects %s", (_name, data, expected) => {
    expect(requestIssues(data)).toMatch(expected);
  });
});

describe("the time words' rules", () => {
  const at = (hours: number, minutes = 0) => hours * 60 + minutes;

  it("say the earliest end a day's last stop keeps: home by eight, by eleven, then out late", () => {
    expect(endKeptBy(at(19, 30))).toBe("evening");
    expect(endKeptBy(at(20))).toBe("evening");
    expect(endKeptBy(at(20, 15))).toBe("early");
    expect(endKeptBy(at(23))).toBe("early");
    // From eleven to midnight no end holds, and out late is the nearest not earlier than the day.
    expect(endKeptBy(at(23, 20))).toBe("late");
    expect(endKeptBy(at(25, 30))).toBe("late");
  });

  it("let home by eight and a late dinner never stand together, and every other pair", () => {
    expect(isTimeWordClash("late", "evening")).toBe(true);
    expect(isTimeWordClash("early", "evening")).toBe(false);
    expect(isTimeWordClash("late", "early")).toBe(false);
    expect(isTimeWordClash(null, "evening")).toBe(false);
    expect(isTimeWordClash("late", null)).toBe(false);
  });
});
