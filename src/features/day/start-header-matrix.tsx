import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { MAX_INTAKE_TEXT_CHARS, type IntakeWords } from "@/lib/schema/intake.schema";
import { StartHeader, type CityQuestion, type StartHeaderProps } from "./start-header";
import { startOffersOf } from "./start-offers";
import type { YourDay } from "./your-days";
import { writtenPool } from "./written-pool";

/**
 * The page's gutter on a laptop, as it sets the start screen there. A phone cell holds the
 * phone's own gutters (`matrix-view.tsx`).
 */
const LAPTOP_GUTTER_CLASSES = "px-16";

/** A text that named nothing: the energy is Lantern's middle one. */
const NO_WORDS: IntakeWords = {
  date: null,
  energy: "balanced",
  energySource: "assumed",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

const ignore = () => undefined;

/** A text that named a calm day, a slow start and family, and no city. */
const CALM_QUESTION: CityQuestion = {
  kind: "question",
  words: {
    ...NO_WORDS,
    energy: "calm",
    energySource: "chosen",
    start: "slow",
    company: "family",
  },
  readings: [],
  unplaced: [],
};

/** Lisbon's written day asked without its city: lively, with friends. */
const LISBON_QUESTION: CityQuestion = {
  kind: "question",
  words: { ...NO_WORDS, energy: "lively", energySource: "chosen", company: "friends" },
  readings: [],
  unplaced: [],
};

/** The city it was answered with, as Lantern would set the day off for it. */
const ANSWERED = "Porto";

/** A visitor's words as the intake reads them, and words that run past the field. */
const READ = "Bologna, with friends";
const READ_LONG =
  "Porto, with my dog, a slow morning with coffee somewhere quiet, a long lunch by the river and a cloister in the afternoon";

/**
 * A visitor's sentence as long as the field takes, and cut to leave the room the field names
 * near its end: the first count it says, one, and none.
 */
const FULL_TEXT = `${READ_LONG}, then somewhere calm to sit at dusk before an early dinner near the water, home by ten`;
const textLeaving = (left: number) => FULL_TEXT.slice(0, MAX_INTAKE_TEXT_CHARS - left);

/** Saturday evening in the visitor's own calendar, as the matrix is set. */
const NOW = new Date(2026, 9, 31, 21, 0);

/** A visitor back on the start screen, with a day of six stops Lantern wrote them an hour ago. */
const RETURNING_DAY: YourDay = {
  id: "lab-returning",
  request: LISBON_DAY.request,
  startedAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
  energies: ["calm", "balanced", "lively", "lively", "social", "balanced"],
  ending: "written",
  seconds: 41,
};

/**
 * The start screen in every line a reading can give, with live generation off and on, over its
 * index: the day on its way from the visitor's words or from a city pressed with the field left
 * empty, the city asked for, and each ending without a day; and the question itself, its field
 * focused, its button hollow, filled and pointed at, the room left near the field's end, and a
 * returning visitor's days over the index.
 */
export const START_HEADER_MATRIX: LabMatrix = labMatrix<StartHeaderProps>({
  key: "start-header",
  title: "Start header",
  note: "The start screen's question and its index, in every line a reading can give",
  base: {
    starts: startOffersOf(writtenPool()),
    line: null,
    text: "",
    onTextChange: ignore,
    isLive: false,
    isCityFocused: false,
    onPlan: ignore,
    onChooseWritten: ignore,
    onChooseReading: ignore,
  },
  axes: [
    {
      name: "line",
      values: [
        { label: "asking", props: { line: null } },
        // The field wraps a sentence onto lines of its own and grows with it, so a phone shows
        // the whole of it.
        { label: "asking, a sentence longer than a line", props: { line: null, text: READ_LONG } },
        // The waiting line's light passes through the visitor's words while they are read
        // (`docs/decisions.md`, "The first screen asks one question, and no day is drawn until a
        // press"), however far they run past the field.
        { label: "reading the visitor's words", props: { line: { kind: "reading" }, text: READ } },
        {
          label: "reading words longer than the field",
          props: { line: { kind: "reading" }, text: READ_LONG },
        },
        {
          label: "read, being written",
          props: { line: { kind: "writing", request: LISBON_DAY.request }, text: "Lisbon" },
        },
        {
          label: "a city pressed, being written",
          props: { line: { kind: "writing", request: KYOTO_DAY.request } },
        },
        {
          // The longest start's line, which takes two lines on a phone, into the room under it.
          label: "the longest start pressed, being written",
          props: { line: { kind: "writing", request: MADRID_START_REQUEST } },
        },
        { label: "city asked, words read", props: { line: CALM_QUESTION } },
        {
          label: "city asked, its answer read",
          props: { line: { kind: "reading", answering: CALM_QUESTION }, text: ANSWERED },
        },
        {
          // A written day's words, answered with its city: said back with live generation off too.
          label: "city answered, being written",
          props: {
            line: { kind: "writing", request: LISBON_DAY.request, answering: LISBON_QUESTION },
            text: LISBON_DAY.request.city,
          },
        },
        {
          label: "city asked, a shared name, a phrase unplaced",
          props: {
            line: {
              kind: "question",
              words: { ...NO_WORDS, end: "late", company: "friends" },
              readings: [
                {
                  placeId: "lab-portland-oregon",
                  name: "Portland",
                  region: "Oregon, United States",
                  timezone: "America/Los_Angeles",
                },
                {
                  placeId: "lab-portland-maine",
                  name: "Portland",
                  region: "Maine, United States",
                  timezone: "America/New_York",
                },
              ],
              unplaced: ["somewhere with live music"],
            },
          },
        },
        { label: "no day yet", props: { line: { kind: "not-yet" } } },
        { label: "refused", props: { line: { kind: "refused" } } },
        { label: "limited", props: { line: { kind: "limited" } } },
        // The field as the focus draws it, its button hollow until there are words.
        { label: "asking, the field focused", props: { line: null, drawnAsPointed: "field" } },
        // Pointed at with the field empty, the hollow button fills in ink.
        { label: "asking, the button pointed", props: { line: null, drawnAsPointed: "button" } },
        // With words the button is filled; pointed at, it steps to `ink-soft`.
        { label: "a short text", props: { line: null, text: READ } },
        {
          label: "a short text, the button pointed",
          props: { line: null, text: READ, drawnAsPointed: "button" },
        },
        // Near the field's end it says the room left, under the button.
        { label: "40 left", props: { line: null, text: textLeaving(40) } },
        { label: "1 left", props: { line: null, text: textLeaving(1) } },
        { label: "the longest text, none left", props: { line: null, text: textLeaving(0) } },
        {
          label: "a returning visitor's days",
          props: {
            line: null,
            yourDays: { days: [RETURNING_DAY], now: NOW, onOpen: ignore, onForget: ignore },
          },
        },
      ],
    },
    {
      name: "note",
      values: [
        { label: "before launch", props: { isLive: false } },
        { label: "after launch", props: { isLive: true } },
      ],
    },
  ],
  // In the page's own gutter, as it sets the start screen on a phone or a laptop, where the
  // written cities stand in a row. Positioned, so the header's unseen status line stays
  // inside its cell and the grid, not the page, scrolls sideways, as the day stage header's is.
  render: (props, width) => (
    <div className={cn("relative", width === "wide" && LAPTOP_GUTTER_CLASSES)}>
      <StartHeader {...props} />
    </div>
  ),
  wide: "page",
});
