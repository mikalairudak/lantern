import { z } from "zod";
import { minutesOf, runningSpans } from "@/lib/time/clock";

/**
 * Lantern itinerary contract. Two layers, one source of truth.
 *
 * Generation layer (`Generated*`): what the model is constrained to through structured
 * outputs (AI SDK `streamText` with `Output.object`). Shape, enums and descriptions only.
 * No numeric, length, count or pattern keywords, because providers disagree on what they
 * can enforce (Anthropic structured outputs rejects min/max, string lengths and
 * minItems > 1), and `.int()` emits safe-integer bounds; the one exception is a day's
 * `minItems: 1` on its stops. Objects are strict so
 * `additionalProperties: false` is always emitted. Descriptions are the field-level
 * prompt. Property order is render order: partial objects paint top-down while
 * streaming. Every field is required, because providers move optional fields to the end. A
 * nullable field is a union type, which counts most against the grammar Anthropic compiles
 * the schema into, so a light's missing direction or window is an enum member (`NONE`), which
 * the normalizer reads as null; the request's open words stay nullable. A meal's food is in its
 * name, so a place has no nullable field. A test lists every union the schema has.
 *
 * App layer: what components consume. Generated shapes plus ids, request context, the
 * request's words with who chose them, selection state and the invariants the UI relies
 * on. A normalizer builds it from a finished generation; a parse failure there is a bug,
 * not a model hiccup. Parse through `ItinerarySchema`: unique ids, non-blank text and
 * non-overlapping stops are checked across the whole itinerary, not by the place and stop
 * schemas on their own.
 */

// ─── Vocabularies ──────────────────────────────────────────────────────────────
// Ordered low → high. The UI imports these rather than redefining them: the energy
// slider snaps to ENERGY_LEVELS, sensory meters render one segment per step.

export const ENERGY_LEVELS = ["reflective", "calm", "balanced", "lively", "social"] as const;

/**
 * The sides a stop's versions lie on, quieter (-1) then livelier (1): one each way, and only
 * the one toward the middle for a stop at an end of the scale. The slider moves a stop along
 * them; the normalizer, the checks and the eval's version reach read them so.
 */
export function swapSidesOf(energy: (typeof ENERGY_LEVELS)[number]): (-1 | 1)[] {
  const rank = ENERGY_LEVELS.indexOf(energy);
  return [
    ...(rank > 0 ? [-1 as const] : []),
    ...(rank < ENERGY_LEVELS.length - 1 ? [1 as const] : []),
  ];
}
export const ACOUSTIC_LEVELS = ["silent", "hushed", "murmur", "chatter", "loud"] as const;
export const CROWD_LEVELS = ["empty", "sparse", "steady", "busy", "packed"] as const;

export const PLACE_KINDS = [
  "coffee",
  "food",
  "bar",
  "gallery",
  "museum",
  "architecture",
  "sacred",
  "garden",
  "viewpoint",
  "market",
  "shop",
  "walk",
] as const;

/**
 * The kinds that name a place to eat or drink around, never one establishment: a street,
 * square or quarter where several stand close together, and the visitor picks the door
 * (`docs/decisions.md`, "Lantern names no restaurant, café or bar"). A place of these kinds
 * is checked by how many such places stand around its point, every other kind by its name.
 */
export const AREA_KINDS = [
  "coffee",
  "food",
  "bar",
] as const satisfies readonly (typeof PLACE_KINDS)[number][];
/** The area kinds as a sentence says them: "coffee, food or bar". */
export const AREA_KINDS_SAID = `${AREA_KINDS.slice(0, -1).join(", ")} or ${AREA_KINDS.at(-1)}`;

/** Whether a place of this kind is an area to eat or drink around rather than one venue. */
export function isAreaKind(kind: (typeof PLACE_KINDS)[number]): kind is AreaKind {
  return (AREA_KINDS as readonly string[]).includes(kind);
}

/**
 * The meals: a meal's name never says one, since the line under it says it by the stop's hour
 * (`mealAt` in `src/features/abacus/meal.ts`, whose test holds this list to every meal it
 * says). Whole words, a plural included. What is drunk, "coffee" or "drinks", is food's word
 * and may stand in a name.
 */
export const MEAL_WORDS = ["breakfast", "brunch", "lunch", "snack", "dinner", "supper"] as const;

/**
 * What a venue calls itself: a meal's name never says one, since Lantern names no venue and the
 * line under a coffee's or a bar's name says "café" or "bar". Read without accents, so "cafe"
 * is "café"; whole words, a plural included.
 */
export const VENUE_WORDS = ["café", "bar", "restaurant"] as const;

function quoted(words: readonly string[]): string {
  return words.map((word) => `"${word}"`).join(", ");
}

export const EXPOSURES = ["open", "dappled", "covered", "interior"] as const;
export const COMPASS_POINTS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

/**
 * When a place looks its best. The app resolves windows to clock times from
 * sun events for the stop's date and coordinates. Light quality at the scheduled time
 * (golden, soft, harsh, blue) is derived from sun altitude, so it is not part of this
 * contract.
 */
export const LIGHT_WINDOWS = [
  "sunrise",
  "morning",
  "midday",
  "afternoon",
  "sunset",
  "after-dark",
] as const;

/**
 * The request's words besides the energy word (`docs/decisions.md`, "The request sentence
 * is the input"). The visitor may choose any of them; Lantern assumes the rest, or asks about
 * one. These are the values the model picks; components own the words a sentence says.
 */
export const TRAVEL_MODES = ["on-foot", "transit", "taxi"] as const;
export const DAY_STARTS = ["early", "slow"] as const;
export const DINNER_TIMES = ["early", "late"] as const;
// In the evening's order: "evening" is home by eight, "early" by eleven, "late" past midnight.
export const DAY_ENDS = ["evening", "early", "late"] as const;
export const COMPANIES = ["alone", "partner", "family", "friends"] as const;

/**
 * The words the day's model may assume: all but the energy word, which every request
 * carries. When the visitor's text names no energy, the intake assumes it before the day,
 * and the request says so (`energySource`).
 */
export const ASSUMABLE_FACT_KEYS = ["travel", "start", "dinner", "end", "company"] as const;
/** The request's words in the order its sentence says them. */
export const FACT_KEYS = ["energy", ...ASSUMABLE_FACT_KEYS] as const;
/** Who put a word in the request: the visitor, Lantern, or nobody yet because Lantern asks. */
export const FACT_SOURCES = ["chosen", "assumed", "asked"] as const;

export const EnergyLevelSchema = z.enum(ENERGY_LEVELS);
export const AcousticLevelSchema = z.enum(ACOUSTIC_LEVELS);
export const CrowdLevelSchema = z.enum(CROWD_LEVELS);
export const PlaceKindSchema = z.enum(PLACE_KINDS);
export const ExposureSchema = z.enum(EXPOSURES);
export const CompassPointSchema = z.enum(COMPASS_POINTS);
export const LightWindowSchema = z.enum(LIGHT_WINDOWS);
export const TravelModeSchema = z.enum(TRAVEL_MODES);
export const DayStartSchema = z.enum(DAY_STARTS);
export const DinnerTimeSchema = z.enum(DINNER_TIMES);
export const DayEndSchema = z.enum(DAY_ENDS);
export const CompanySchema = z.enum(COMPANIES);
export const AssumableFactKeySchema = z.enum(ASSUMABLE_FACT_KEYS);
export const FactKeySchema = z.enum(FACT_KEYS);
export const FactSourceSchema = z.enum(FACT_SOURCES);

// ─── Limits ────────────────────────────────────────────────────────────────────

/**
 * The longest meal's name that two lines hold anywhere on a phone, even beside a bead mid-scale.
 * Past it `meal-name-lines` warns but never fails, since a third line only grows the row
 * (`docs/decisions.md`, "Lantern names no restaurant, café or bar", has the measurements).
 */
export const MEAL_NAME_TWO_LINES_CHARS = 26;
/** The longest a meal's name may run: three lines anywhere. */
export const MAX_MEAL_NAME_CHARS = 35;
/**
 * How many words a meal's name is asked for. A model counts words, not characters
 * (`docs/harness.md`, "The prompt versions"), and nearly every name this short keeps within
 * `MAX_MEAL_NAME_CHARS`. The screen is still checked in characters.
 */
export const MAX_MEAL_NAME_WORDS = 5;

// The hours the start, dinner and end words promise, in local clock time. A limit is what
// `time-words` and a re-plan's `replan-word` hold a day to, and where a targeted re-plan widens
// its windows (`src/lib/replan/windows.ts`). An aim is the hour the model is asked for, with room
// on the kept side of its limit, since a limit given alone is read as the target
// (`docs/harness.md`, "The prompt versions", `day-v7`).

/**
 * An early start: the first stop starts by 08:30, the owner's definition (`docs/decisions.md`,
 * "The end of the day is said in real hours").
 */
export const EARLY_START_BY = "08:30";
/** Where an early start is aimed: an hour inside its limit. */
export const EARLY_START_AIM = "07:30";
/** A slow start: the first stop starts mid-morning, from 09:00 to 11:30. */
export const SLOW_START_FROM = "09:00";
export const SLOW_START_BY = "11:30";
/** Dinner is the evening's meal: the day's first `food` stop from 17:00. */
export const EVENING_MEAL_FROM = "17:00";
/**
 * An early dinner: the evening's meal starts by 19:30, aimed at 19:00, the "by about seven" of
 * the day's description.
 */
export const EARLY_DINNER_BY = "19:30";
export const EARLY_DINNER_AIM = "19:00";
/**
 * A late dinner: the evening's meal starts from 20:30, aimed at 21:00, the "after nine" of the
 * day's description.
 */
export const LATE_DINNER_FROM = "20:30";
export const LATE_DINNER_AIM = "21:00";
/**
 * An evening end, home by eight: the last stop ends by 20:00, aimed at 19:30, so a visitor who
 * said "home by 8pm" is home by then (`docs/decisions.md`, "The end of the day is said in real
 * hours").
 */
export const EVENING_END_BY = "20:00";
export const EVENING_END_AIM = "19:30";
/** An early end, home by eleven: the last stop ends by 23:00. */
export const EARLY_END_BY = "23:00";
/**
 * Where a late end is aimed: an hour past its limit, midnight, as an early start's aim is an
 * hour inside its own. Given midnight alone, a calm day's re-plan ended at 22:40
 * (`docs/harness.md`, "The prompt versions", `replan-v2`).
 */
export const LATE_END_AIM = "01:00";
/**
 * A quiet day's late end: a reflective or calm day keeps the word from 23:30, any other day past
 * midnight, since a calm evening that runs to a quarter to twelve is a late one. The owner's
 * (`docs/decisions.md`, "The end of the day is said in real hours"); the aim stays `LATE_END_AIM`.
 */
export const QUIET_LATE_END_FROM = "23:30";

export const ALTERNATIVES_PER_STOP = 2;
export const MAX_SWAP_WALK_MINUTES = 10;
/** An unhurried city pace. With the 10-minute swap walk it gives 800 m. */
export const WALKING_METERS_PER_MINUTE = 80;
/** How far, in a straight line, an alternative may sit from its stop. */
export const SWAP_RADIUS_METERS = MAX_SWAP_WALK_MINUTES * WALKING_METERS_PER_MINUTE;
/**
 * The most a day's legs may add up to, in straight lines between its stops, whatever the travel
 * word. Kyoto's hero day covers 4.9 km, and a fifth more, rounded, leaves room for a looser city
 * without letting a day cross it twice (`docs/decisions.md`, "A changed word proposes its part
 * beside the day, and the visitor takes it"). `day-flow` checks it, and the day's and the re-plan's
 * prompts ask for it.
 */
export const MAX_DAY_FLOW_METERS = 6000;
export const MAX_AESTHETIC_TAGS = 3;
// A stop longer than a working day means the plan has collapsed into one stop.
export const MAX_STOP_MINUTES = 8 * 60;

// ─── Shared by both layers ─────────────────────────────────────────────────────

export const SensoryProfileSchema = z.strictObject({
  // Not derived from acoustic + crowd: a silent communal table is social,
  // a loud solo counter is not.
  energy: EnergyLevelSchema.describe(
    "Where the place sits between reflective solitude and social buzz.",
  ),
  acoustic: AcousticLevelSchema.describe("Typical sound level at the scheduled time."),
  crowd: CrowdLevelSchema.describe("Typical crowding at the scheduled time."),
  texture: z
    .string()
    .describe(
      `One short line on how it sounds and feels, e.g. "Gravel underfoot, cicadas, no music." For ${AREA_KINDS_SAID}, the street's, never one room or its staff.`,
    ),
});

/** How light falls on a place as the app reads it: a direction or a window it has none of is null. */
export const LightProfileSchema = z.strictObject({
  exposure: ExposureSchema,
  orientation: CompassPointSchema.nullable(),
  bestWindow: LightWindowSchema.nullable(),
  note: z.string(),
});

// ─── Generation layer ──────────────────────────────────────────────────────────

/**
 * What the model writes for a value a place has none of, where the app reads null. The
 * provider compiles the schema into a grammar with a size limit, and every nullable field is
 * a union type, which costs the most (`docs/decisions.md`, "The model's schema keeps its union
 * types few"); an enum member costs nothing of the kind.
 */
export const NONE = "none";

/** A generated value read by the app: the model's "none" is null. */
export function noneAsNull<Value extends string>(value: Value): Exclude<Value, typeof NONE> | null {
  return value === NONE ? null : (value as Exclude<Value, typeof NONE>);
}

/** A light profile as the model writes it, read by the app. */
export function lightOf(light: GeneratedLightProfile): LightProfile {
  return {
    ...light,
    orientation: noneAsNull(light.orientation),
    bestWindow: noneAsNull(light.bestWindow),
  };
}

/** The app's light profile as the model would write it, for days written by hand. */
export function generatedLightOf(light: LightProfile): GeneratedLightProfile {
  return { ...light, orientation: light.orientation ?? NONE, bestWindow: light.bestWindow ?? NONE };
}

export const GeneratedLightProfileSchema = z.strictObject({
  exposure: ExposureSchema.describe(
    "Sky exposure of the main space: open, dappled (trees, screens), covered (roofed but open-sided) or interior.",
  ),
  orientation: z
    .enum([...COMPASS_POINTS, NONE])
    .describe(
      `Direction the main view or facade faces. "${NONE}" if it has none or you are not confident.`,
    ),
  bestWindow: z
    .enum([...LIGHT_WINDOWS, NONE])
    .describe(`When the light here is at its best. "${NONE}" if light does not matter here.`),
  note: z
    .string()
    .describe(
      `One line on how light behaves here, e.g. "Low sun rakes across the moss until nine; flat by noon." For ${AREA_KINDS_SAID}, the street's light, never one room's.`,
    ),
});

/**
 * A place as the model writes it, in the order the page draws it (`docs/decisions.md`, "Field
 * order is render order"). Everything its row shows or holds room for comes first: its name,
 * kind and quarter, the point its map mark and sun are drawn from, its sensory profile with the
 * energy first, and its light. The summary and tags, which only its sheet shows, come last, so a
 * row is weighed as soon as its light is known, not after the sheet's lines (`docs/decisions.md`,
 * "Field order is render order").
 */
export const GeneratedPlaceSchema = z.strictObject({
  name: z
    .string()
    .describe(
      `The place's proper name in Latin or Cyrillic letters, with every accent the city writes; a name written in any other script in its usual Latin spelling, with no macrons, e.g. "Kiyomizu-dera". For ${AREA_KINDS_SAID}, never one café, restaurant or bar: ${MAX_MEAL_NAME_WORDS} words at most, the food in one or two words, then on, along, by or in, then the street, square or quarter by its shortest everyday name, e.g. "Petiscos on Rua das Flores", "Obanzai along Pontocho". A dish only if nearly every place there serves it, e.g. "Paella on the Explanada", never one kitchen's own. The app shows the meal, "café" or "bar" under it, so never a meal (${quoted(MEAL_WORDS)}), nor ${quoted(VENUE_WORDS)}, a venue's name or the city: "Petiscos in Alfama", not "Lunch on Rua de São Miguel"; "Beer on Rua da Atalaia", not "Bars on Rua da Atalaia"; "Coffee on Alfonso el Sabio", not "Coffee and pastries on Avenida Alfonso el Sabio".`,
    ),
  kind: PlaceKindSchema.describe(
    `Primary category. "sacred" covers temples, shrines and churches; "walk" is a route, not a venue; ${AREA_KINDS.map((kind) => `"${kind}"`).join(", ")} are a street, square or quarter to eat or drink in, not a venue.`,
  ),
  neighborhood: z
    .string()
    .describe(
      'Neighborhood or district, in the same letters as the name, with every accent the city writes, e.g. "Higashiyama".',
    ),
  coordinates: z
    .strictObject({
      lat: z.number().describe("Latitude, positive north."),
      lng: z.number().describe("Longitude, positive east."),
    })
    .describe(
      `Entrance coordinates in decimal degrees. For walks, the starting point; for ${AREA_KINDS_SAID}, the middle of the stretch where its places stand.`,
    ),
  sensory: SensoryProfileSchema.describe("How the place sounds and feels at the scheduled time."),
  light: GeneratedLightProfileSchema.describe("How light falls on the place through the day."),
  summary: z
    .string()
    .describe(
      `One or two sentences on why this place earns its slot in the day. For ${AREA_KINDS_SAID}, what the city eats or drinks there at that hour, as most of its places serve it: never a business, its room or its staff, nor one dish promised as if a single kitchen made it.`,
    ),
  aesthetic: z
    .array(z.string())
    .describe(
      `1 to ${MAX_AESTHETIC_TAGS} lowercase material or style descriptors, e.g. "raw timber", "brutalist concrete". For ${AREA_KINDS_SAID}, the street's, never one room's.`,
    ),
});

export const GeneratedStopSchema = z.strictObject({
  startTime: z
    .string()
    .describe(
      'Local arrival time, 24-hour "HH:mm", e.g. "08:30". After midnight it is the clock time, e.g. "00:30" after "23:00".',
    ),
  durationMinutes: z
    .number()
    .describe(`Time to spend here, in whole minutes, at most ${MAX_STOP_MINUTES}.`),
  place: GeneratedPlaceSchema.describe("Where the stop happens."),
  // After the place, so a stop's words paint before what only an answer reads.
  dependsOn: z
    .array(AssumableFactKeySchema)
    .describe(
      "The words of the request, besides the energy word, that shaped this stop: an answer that changes one of them plans this stop again. Empty when none did.",
    ),
});

export const GeneratedAlternativeSchema = GeneratedPlaceSchema.extend({
  reason: z
    .string()
    .describe(
      `One sentence: what it shares with the original pick and what it trades. For ${AREA_KINDS_SAID}, the streets and what is eaten or drunk there, never one place.`,
    ),
});

export const GeneratedAlternativeSetSchema = z.strictObject({
  stopIndex: z.number().describe("Zero-based index into `stops` of the stop these replace."),
  options: z
    .array(GeneratedAlternativeSchema)
    .describe(
      `A quieter and a livelier version of that stop: a place for the same moment within a ${MAX_SWAP_WALK_MINUTES}-minute walk, open at the same time, one with a lower and one with a higher energy than the stop's own. A stop at the quietest or liveliest energy gets only the one toward the middle.`,
    ),
});

/**
 * One field per word Lantern may assume. A word with no value is either the visitor's own or
 * the one Lantern asks about; the request tells which, so the model never restates a choice.
 */
export const GeneratedAssumptionsSchema = z.strictObject({
  travel: TravelModeSchema.nullable().describe(
    'How the visitor gets between stops: "on-foot" walks all day, "transit" takes buses, trams or the metro, "taxi" rides.',
  ),
  start: DayStartSchema.nullable().describe(
    `"early" means the first stop starts around ${EARLY_START_AIM}, no later than ${EARLY_START_BY}; "slow" begins mid-morning.`,
  ),
  dinner: DinnerTimeSchema.nullable().describe(
    '"early" is dinner by about seven; "late" is dinner after nine.',
  ),
  end: DayEndSchema.nullable().describe(
    `"evening" is home by eight: the last stop ends around ${EVENING_END_AIM}, no later than ${EVENING_END_BY}. "early" is home by eleven: the last stop ends by ${EARLY_END_BY}. "late" is out past midnight. Assume the earliest of them that the day you plan keeps.`,
  ),
  company: CompanySchema.nullable().describe("Who the visitor is with."),
});

export const GeneratedDaySchema = z.strictObject({
  // First: the request sentence above the line about the day says them, and the day is
  // planned on them.
  assumptions: GeneratedAssumptionsSchema.describe(
    "What you assumed about the visitor for each word the request leaves open; the page shows each one for the visitor to change. null for a word the request gives, and for the one word you ask the visitor about instead of assuming. Ask about at most one, the word whose answer would change the day most, or none.",
  ),
  // No title: the visitor's request is the headline, so the model only describes the day.
  dek: z
    .string()
    .describe(
      "One or two sentences about this day as planned: the parts that make it this day and not another, in the order they happen. Not a description of the city.",
    ),
  // At least one stop, the one count keyword allowed (`docs/decisions.md`, "A day has at least
  // one stop"). `@ai-sdk/anthropic` 4.0.85 strips `minItems` from the schema it sends and
  // appends "min items: 1." to this description, so Claude reads it as words and the stream's
  // reader, parsing through this schema, refuses an empty day.
  stops: z
    .array(GeneratedStopSchema)
    .min(1)
    .describe("The day in chronological order. Each stop starts after the previous one ends."),
  // Trails `stops` so the timeline fills before any alternative streams in.
  // Nesting two extra places inside every stop would hold back each next card.
  alternatives: z
    .array(GeneratedAlternativeSetSchema)
    .describe("Swap options, one entry per stop, written after all stops."),
});

// ─── Request ───────────────────────────────────────────────────────────────────

// Where and which day: the visitor's, never generated. The itinerary carries it too,
// because the light on the chart needs the date and the zone.
const REQUEST_CONTEXT = {
  city: z.string(),
  date: z.iso.date(),
  timezone: z.string().refine(isCityTimeZone, 'Expected an IANA city time zone, e.g. "Asia/Tokyo"'),
};

/**
 * What the visitor asked for. Energy is one word for the whole day ("a calm Saturday");
 * the curve a visitor drags afterwards is local state over the generated day, not part of
 * the request. Each other word of the request sentence is the visitor's choice, or null to
 * leave it to Lantern, which assumes it or asks about it.
 */
export const DayRequestSchema = z
  .strictObject({
    ...REQUEST_CONTEXT,
    // Assumed when the name could mean several cities and Lantern played the likeliest; the
    // intake's answer offers the others beside the request (`IntakeResult`).
    citySource: FactSourceSchema.exclude(["asked"]),
    energy: EnergyLevelSchema,
    // Never asked: the intake assumes it before the day when the visitor's text names none.
    energySource: FactSourceSchema.exclude(["asked"]),
    travel: TravelModeSchema.nullable(),
    start: DayStartSchema.nullable(),
    dinner: DinnerTimeSchema.nullable(),
    end: DayEndSchema.nullable(),
    company: CompanySchema.nullable(),
  })
  .superRefine((request, ctx) => {
    for (const path of findBlankStrings(request)) {
      ctx.addIssue({ code: "custom", message: "Text must not be blank", path });
    }
  });

// ─── App layer ─────────────────────────────────────────────────────────────────

const StartTimeSchema = z.iso.time({ precision: -1 });
const DurationSchema = z.number().int().positive().max(MAX_STOP_MINUTES);

const CoordinatesSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const PlaceSchema = GeneratedPlaceSchema.extend({
  // Doubles as the Framer Motion layoutId, so it must be unique per itinerary.
  id: z.string(),
  coordinates: CoordinatesSchema,
  aesthetic: z.array(z.string()).min(1).max(MAX_AESTHETIC_TAGS),
  light: LightProfileSchema,
});

export const AlternativeSchema = PlaceSchema.extend({
  reason: z.string(),
});

export const StopSchema = z
  .strictObject({
    id: z.string(),
    startTime: StartTimeSchema,
    durationMinutes: DurationSchema,
    // The model's original pick, never replaced, so swapping back is free.
    primary: PlaceSchema,
    // Up to two: the normalizer drops options that fail the walk-radius check.
    alternatives: z.array(AlternativeSchema).max(ALTERNATIVES_PER_STOP),
    // The version the day plans to show: the primary, until a changed energy word moves it
    // (`replanForEnergy`). A swap never writes it: the visitor's picks are kept beside the day
    // (`useEnergyCurve`). Place data never mutates.
    selectedPlaceId: z.string(),
    // The words of the request it was planned around. The energy word shapes every stop,
    // so it is always among them.
    dependsOn: z.array(FactKeySchema),
  })
  .refine(
    (stop) =>
      [stop.primary, ...stop.alternatives].some((place) => place.id === stop.selectedPlaceId),
    {
      message: "selectedPlaceId must reference the primary or one of its alternatives",
      path: ["selectedPlaceId"],
    },
  )
  .refine(
    (stop) =>
      stop.dependsOn.includes("energy") && new Set(stop.dependsOn).size === stop.dependsOn.length,
    { message: "dependsOn must name the energy word, and each word once", path: ["dependsOn"] },
  );

/** A word of the request as the day was planned on it, and who put it there. */
function factSchemaOf<Value extends z.ZodType>(value: Value) {
  return z.strictObject({ value: value.nullable(), source: FactSourceSchema });
}

/** Every word of the request, so the headline can say each one and open it in place. */
export const FactsSchema = z
  .strictObject({
    energy: factSchemaOf(EnergyLevelSchema),
    travel: factSchemaOf(TravelModeSchema),
    start: factSchemaOf(DayStartSchema),
    dinner: factSchemaOf(DinnerTimeSchema),
    end: factSchemaOf(DayEndSchema),
    company: factSchemaOf(CompanySchema),
  })
  .superRefine((facts, ctx) => {
    for (const key of FACT_KEYS) {
      const { value, source } = facts[key];
      if ((value === null) !== (source === "asked")) {
        ctx.addIssue({ code: "custom", message: "Only an asked word has no value", path: [key] });
      }
    }
  });

export const ItinerarySchema = GeneratedDaySchema.pick({ dek: true })
  .extend({
    ...REQUEST_CONTEXT,
    facts: FactsSchema,
    stops: z.array(StopSchema).min(1),
  })
  .superRefine((itinerary, ctx) => {
    // One rule for every string, so shared shapes need no app-layer copies.
    for (const path of findBlankStrings(itinerary)) {
      ctx.addIssue({ code: "custom", message: "Text must not be blank", path });
    }

    const overlappingIndex = findOverlappingStop(itinerary.stops);
    if (overlappingIndex !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Each stop must start after the previous one ends",
        path: ["stops", overlappingIndex, "startTime"],
      });
    }

    const duplicateIds = findDuplicateIds(itinerary.stops);
    if (duplicateIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Ids must be unique across stops and places: ${duplicateIds.join(", ")}`,
        path: ["stops"],
      });
    }
  });

// Region-based IANA names only. Intl also accepts offsets ("+05:00"), "UTC" and
// legacy abbreviations ("EST"), none of which carry a city's daylight-saving rules.
const TIME_ZONE_AREAS = [
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific",
];
const CITY_TIME_ZONE_PATTERN = new RegExp(`^(${TIME_ZONE_AREAS.join("|")})(/[A-Z][A-Za-z_-]*)+$`);

/** Whether a zone is a city's IANA zone, as a request's must be: "Asia/Tokyo", never "UTC". */
export function isCityTimeZone(timeZone: string): boolean {
  if (!CITY_TIME_ZONE_PATTERN.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    // Intl throws a RangeError for unknown zones.
    return false;
  }
}

// Format characters such as zero-width spaces survive `trim()` but render as nothing.
const INVISIBLE_CHARACTERS = /\p{Cf}/gu;

/** Paths of strings that would render as an empty line. */
function findBlankStrings(value: unknown, path: PropertyKey[] = []): PropertyKey[][] {
  if (typeof value === "string") {
    return value.replace(INVISIBLE_CHARACTERS, "").trim() === "" ? [path] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBlankStrings(item, [...path, index]));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => findBlankStrings(item, [...path, key]));
  }
  return [];
}

function isTimed(stop: Stop): boolean {
  return (
    StartTimeSchema.safeParse(stop.startTime).success &&
    DurationSchema.safeParse(stop.durationMinutes).success
  );
}

/**
 * Index of the first stop that starts before the previous one ends, or null. Starts run on
 * past midnight, so "00:15" after a stop that ends at 23:30 is in order.
 */
function findOverlappingStop(stops: readonly Stop[]): number | null {
  // An invalid time or duration already has its own issue; comparing it would only add noise.
  if (!stops.every(isTimed)) return null;

  const spans = runningSpans(stops);
  const index = spans.findIndex((span, i) => {
    const previous = spans[i - 1];
    return previous !== undefined && span.from < previous.to;
  });
  return index === -1 ? null : index;
}

function findDuplicateIds(stops: readonly Stop[]): string[] {
  const ids = stops.flatMap((stop) => [
    stop.id,
    stop.primary.id,
    ...stop.alternatives.map((alternative) => alternative.id),
  ]);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EnergyLevel = z.infer<typeof EnergyLevelSchema>;
export type AcousticLevel = z.infer<typeof AcousticLevelSchema>;
export type CrowdLevel = z.infer<typeof CrowdLevelSchema>;
export type PlaceKind = z.infer<typeof PlaceKindSchema>;
export type AreaKind = (typeof AREA_KINDS)[number];
export type Exposure = z.infer<typeof ExposureSchema>;
export type CompassPoint = z.infer<typeof CompassPointSchema>;
export type LightWindow = z.infer<typeof LightWindowSchema>;
export type TravelMode = z.infer<typeof TravelModeSchema>;
export type DayStart = z.infer<typeof DayStartSchema>;
export type DinnerTime = z.infer<typeof DinnerTimeSchema>;
export type DayEnd = z.infer<typeof DayEndSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type AssumableFactKey = z.infer<typeof AssumableFactKeySchema>;
export type FactKey = z.infer<typeof FactKeySchema>;
export type FactSource = z.infer<typeof FactSourceSchema>;

/** A point in decimal degrees: one shape in both layers, its bounds checked in the app's. */
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type SensoryProfile = z.infer<typeof SensoryProfileSchema>;
export type LightProfile = z.infer<typeof LightProfileSchema>;
export type GeneratedLightProfile = z.infer<typeof GeneratedLightProfileSchema>;

export type GeneratedPlace = z.infer<typeof GeneratedPlaceSchema>;
export type GeneratedStop = z.infer<typeof GeneratedStopSchema>;
export type GeneratedAlternative = z.infer<typeof GeneratedAlternativeSchema>;
export type GeneratedAlternativeSet = z.infer<typeof GeneratedAlternativeSetSchema>;
export type GeneratedAssumptions = z.infer<typeof GeneratedAssumptionsSchema>;
export type GeneratedDay = z.infer<typeof GeneratedDaySchema>;

export type DayRequest = z.infer<typeof DayRequestSchema>;

export type Place = z.infer<typeof PlaceSchema>;
export type Alternative = z.infer<typeof AlternativeSchema>;
export type Stop = z.infer<typeof StopSchema>;
export type Facts = z.infer<typeof FactsSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;

// ─── The time words' rules ─────────────────────────────────────────────────────

/**
 * The end word a day's hours keep most closely, from when its last stop ends in running
 * minutes (`runningSpans`): home by eight up to `EVENING_END_BY`, home by eleven up to
 * `EARLY_END_BY`, out late after it. An end Lantern assumed is said as this word, so the
 * headline never promises an hour the day does not keep (`docs/decisions.md`, "The end of the
 * day is said in real hours"). "out late" is true of any end after eleven as the visitor reads
 * it, though the prompt still asks a late day to run past midnight; the checks read an end so
 * fitted as it is said, not as it was promised (`WordReading` in `src/lib/quality/checks.ts`).
 */
export function endKeptBy(lastEndsAt: number): DayEnd {
  if (lastEndsAt <= minutesOf(EVENING_END_BY)) return "evening";
  if (lastEndsAt <= minutesOf(EARLY_END_BY)) return "early";
  return "late";
}

/**
 * Whether a dinner and an end cannot stand together: home by eight leaves no evening for a late
 * dinner, the one pair of time words that clash. On the page the word the visitor changed stands
 * and the other gives way; at intake the end stands, since a time to be home by is a limit, and
 * the late dinner is said back as one Lantern cannot plan around (`docs/decisions.md`, "The end of
 * the day is said in real hours").
 */
export function isTimeWordClash(dinner: DinnerTime | null, end: DayEnd | null): boolean {
  return dinner === "late" && end === "evening";
}
