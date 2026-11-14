import { z } from "zod";
import type { IntakeResult } from "@/lib/schema/intake.schema";
import { FACT_KEYS } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";

/**
 * The product's events: what the page tells the server a visitor did, counted for the
 * owner's questions (`docs/decisions.md`, "Product events are kept under a visitor key that lives
 * one day"). Their shapes and vocabularies are defined here and nowhere else: the client builds
 * events from these schemas, and `POST /api/events` refuses anything they do not allow. Every value
 * is a word from a closed vocabulary or a city as its address writes it, so no event can carry the
 * visitor's text.
 */

/**
 * How a day came on screen:
 * - `typed`: the visitor's own words, read by the intake, its question's answer included;
 * - `pressed`: a written city pressed on the start screen;
 * - `link`: a written day's own address opened, as a link or a reload;
 * - `word`: a word of the header changed, which plays a new day;
 * - `kept`: a day kept on the server opened at its own address, `/day/<id>`, as a link or a
 *   reload, told from a written day's link, as one is the visitor's or someone's, the other
 *   Lantern's own.
 */
export const DAY_VIAS = ["typed", "pressed", "link", "word", "kept"] as const;

/**
 * How far a day had streamed when the visitor left it, by closing the page or playing
 * another: before its first stop arrived, or with stops on screen but the day not ended.
 */
export const LEFT_STAGES = ["before-first-stop", "before-end"] as const;

/** How the day on screen is read: on the chart, or as a list (`DayView`, which is these words). */
export const DAY_VIEWS = ["read", "chart"] as const;

/**
 * What the visitor does with the day on screen, each counted once a day opened and told with
 * the day and the view it is read in: the day's menu opened, the curve dragged, a stop swapped,
 * the day taken along by one of the three ways under it, and the day read to its end.
 */
export const DAY_ACTS = [
  "menu-opened",
  "curve-dragged",
  "stop-swapped",
  "link-shared",
  "calendar-saved",
  "route-opened",
  "day-read-to-end",
] as const;

/**
 * The one-tap answer at a day's end, "Would you follow this day?": yes, or not quite. Asked once
 * a day opened, with nothing kept in the browser, and never in free text.
 */
export const DAY_ANSWERS = ["yes", "not-quite"] as const;

export type DayAnswer = (typeof DAY_ANSWERS)[number];

/** The header's words a visitor can change: the city, and each word of the request. */
export const HEADER_WORDS = ["city", ...FACT_KEYS] as const;

/**
 * The control a word was changed at: the energy word on the plan's bar, or the headline's own
 * word, where every other word is changed.
 */
export const WORD_CONTROLS = ["headline", "bar"] as const;

/** Every way a day's stream ends, as the client's reader reads it (`DayOutcome`). */
export const DAY_OUTCOMES = [
  "complete",
  "cut",
  "disconnected",
  "refused",
  "invalid",
  "unavailable",
  "limited",
] as const satisfies readonly DayOutcome["kind"][];

/** Every answer the intake gives the visitor's text (`IntakeResult`). */
export const INTAKE_OUTCOMES = [
  "request",
  "question",
  "refused",
  "unavailable",
  "limited",
] as const satisfies readonly IntakeResult["kind"][];

/**
 * The longest city an event names. A live day's city is held to 100 characters
 * (`MAX_LIVE_CITY_CHARS`), and its address is never longer than its name.
 */
export const MAX_EVENT_CITY_CHARS = 100;

/** A city as its day's address writes it (`daySlugOf`): lower case, hyphens between words. */
const CITY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CitySchema = z
  .string()
  .max(MAX_EVENT_CITY_CHARS)
  .regex(CITY_SLUG, "A city as its day's address writes it, such as sao-paulo");

/** What every event about the day on screen says of it. */
const DAY_FIELDS = {
  city: CitySchema,
  via: z.enum(DAY_VIAS),
  /** True for a day Lantern wrote, streamed from its file; false for the model's. */
  written: z.boolean(),
};

/** The day's fields, and the view it is read in as the event happens. */
const DAY_IN_VIEW_FIELDS = { ...DAY_FIELDS, view: z.enum(DAY_VIEWS) };

export const ProductEventSchema = z.discriminatedUnion("kind", [
  /** The start screen was opened. */
  z.strictObject({ kind: z.literal("home-viewed") }),
  /** A day started on screen. */
  z.strictObject({ kind: z.literal("day-opened"), ...DAY_FIELDS }),
  /** A day's stream ended while the visitor was there. */
  z.strictObject({
    kind: z.literal("day-ended"),
    ...DAY_IN_VIEW_FIELDS,
    outcome: z.enum(DAY_OUTCOMES),
  }),
  /** The visitor left a day before its stream ended. */
  z.strictObject({ kind: z.literal("day-left"), ...DAY_FIELDS, stage: z.enum(LEFT_STAGES) }),
  /**
   * The day's menu, "Take this day", was opened: once a day opened, however often it is opened
   * again.
   */
  z.strictObject({ kind: z.literal("menu-opened"), ...DAY_IN_VIEW_FIELDS }),
  /** The energy curve was dragged and let go. */
  z.strictObject({ kind: z.literal("curve-dragged"), ...DAY_IN_VIEW_FIELDS }),
  /** A stop was swapped for one of its alternatives. */
  z.strictObject({ kind: z.literal("stop-swapped"), ...DAY_IN_VIEW_FIELDS }),
  /**
   * The day was taken along from the line under it: its link sent, copied or shared from a
   * phone's sheet; its calendar file saved; its walking route opened in a map.
   */
  z.strictObject({ kind: z.literal("link-shared"), ...DAY_IN_VIEW_FIELDS }),
  z.strictObject({ kind: z.literal("calendar-saved"), ...DAY_IN_VIEW_FIELDS }),
  z.strictObject({ kind: z.literal("route-opened"), ...DAY_IN_VIEW_FIELDS }),
  /**
   * The line under the whole day stayed in view for a moment, the visitor still there
   * (`READ_TO_END_MS`).
   */
  z.strictObject({ kind: z.literal("day-read-to-end"), ...DAY_IN_VIEW_FIELDS }),
  /** The visitor answered the day's end: would they follow it. Once a day opened. */
  z.strictObject({
    kind: z.literal("day-answered"),
    ...DAY_IN_VIEW_FIELDS,
    answer: z.enum(DAY_ANSWERS),
  }),
  /** A word of the header was changed, at the control it was changed at. */
  z.strictObject({
    kind: z.literal("word-changed"),
    city: CitySchema,
    word: z.enum(HEADER_WORDS),
    control: z.enum(WORD_CONTROLS),
  }),
  /** The intake answered the visitor's text. */
  z.strictObject({ kind: z.literal("intake-ended"), outcome: z.enum(INTAKE_OUTCOMES) }),
]);

export type ProductEvent = z.infer<typeof ProductEventSchema>;
export type ProductEventKind = ProductEvent["kind"];
export type DayVia = (typeof DAY_VIAS)[number];
export type DayAct = (typeof DAY_ACTS)[number];
export type LeftStage = (typeof LEFT_STAGES)[number];
export type HeaderWord = (typeof HEADER_WORDS)[number];
export type WordControl = (typeof WORD_CONTROLS)[number];
