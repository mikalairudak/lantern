import { ELCHE_ITINERARY } from "@/lib/fixtures/replan/elche-dinner";
import { COPY_LINK, LINK_COPIED, LINK_NOT_COPIED } from "./day-export-words";
import type { DayExports } from "./day-exports";
import { DAY_END_EXAMPLES, writtenPicksOf } from "./day-end-examples";
import type { DayMenuItem } from "./day-menu";
import { NEW_DAY, NEW_DAY_NOTE } from "./new-day";
import { takeAlongOf } from "./take-along";

const KANAZAWA = DAY_END_EXAMPLES[0]!;

function exampleOf(label: string) {
  const found = DAY_END_EXAMPLES.find((example) => example.label === label);
  if (!found) throw new Error(`No day's end example "${label}"`);
  return found;
}

const ONE_STOP = exampleOf("one stop: no way between places");
const CROWDED = exampleOf("twelve stops, past the route's nine waypoints");
const ignore = () => undefined;

function exportsOf(copied: DayExports["copied"]): DayExports {
  return { copied, sendLink: async () => undefined, saveCalendar: ignore };
}

const NEW_DAY_ROW: DayMenuItem = {
  key: "another",
  label: NEW_DAY,
  note: NEW_DAY_NOTE,
  isApart: true,
  isInRowFromMasthead: true,
};

function itemsOf(options: Partial<Parameters<typeof takeAlongOf>[0]>): DayMenuItem[] {
  return [
    ...takeAlongOf({
      day: KANAZAWA.day,
      shown: KANAZAWA.shown,
      checks: KANAZAWA.checks,
      isCut: false,
      exports: exportsOf(COPY_LINK),
      onRoute: ignore,
      hasLink: true,
      ...options,
    }),
    NEW_DAY_ROW,
  ];
}

/** Which masthead a cell draws: a day's with its menu, or the start screen's. */
type MastheadPage = "day" | "start";

export interface DayMenuState {
  label: string;
  page: MastheadPage;
  items: DayMenuItem[];
  isOpen: boolean;
  /** The item drawn pointed at, as a pointer or the keyboard leaves it. */
  pointedKey?: string;
  /**
   * The masthead's row set under `@masthead`, 320 px as a 320 px phone's: the new day is the
   * menu's last row there, under its rule, where a wider row holds it beside the menu.
   */
  isShortRow?: boolean;
}

/** The masthead and its menu in each state worth a look, on Kanazawa's written day. */
export const DAY_MENU_STATES: readonly DayMenuState[] = [
  { label: "a day, its menu open: the three ways", page: "day", items: itemsOf({}), isOpen: true },
  {
    label: "a row pointed at: the ground's band, its name ruled",
    page: "day",
    items: itemsOf({}),
    isOpen: true,
    pointedKey: "calendar",
  },
  {
    label: "the short row, its menu open: the new day last, under its rule",
    page: "day",
    items: itemsOf({}),
    isOpen: true,
    isShortRow: true,
  },
  {
    label: "the short row: the new day pointed at",
    page: "day",
    items: itemsOf({}),
    isOpen: true,
    pointedKey: NEW_DAY_ROW.key,
    isShortRow: true,
  },
  { label: "a day, its menu closed", page: "day", items: itemsOf({}), isOpen: false },
  {
    label: "while the day is written",
    page: "day",
    items: itemsOf({ day: null }),
    isOpen: true,
  },
  {
    label: "its link just copied",
    page: "day",
    items: itemsOf({ exports: exportsOf(LINK_COPIED) }),
    isOpen: true,
  },
  { label: "a day cut short", page: "day", items: itemsOf({ isCut: true }), isOpen: true },
  {
    label: "a long city name: Elx / Elche",
    page: "day",
    items: itemsOf({ day: ELCHE_ITINERARY, shown: writtenPicksOf(ELCHE_ITINERARY), checks: {} }),
    isOpen: true,
  },
  {
    label: "twelve stops: the route takes the first of them",
    page: "day",
    items: itemsOf({ day: CROWDED.day, shown: CROWDED.shown, checks: CROWDED.checks }),
    isOpen: true,
  },
  {
    label: "one stop: one event, no route",
    page: "day",
    items: itemsOf({ day: ONE_STOP.day, shown: ONE_STOP.shown, checks: ONE_STOP.checks }),
    isOpen: true,
  },
  {
    label: "no address of its own: no link",
    page: "day",
    items: itemsOf({ hasLink: false, exports: { ...exportsOf(COPY_LINK), sendLink: null } }),
    isOpen: true,
  },
  {
    label: "its link not copied",
    page: "day",
    items: itemsOf({ exports: exportsOf(LINK_NOT_COPIED) }),
    isOpen: true,
  },
  {
    label: "the short row, while a re-plan is written: the new day locked",
    page: "day",
    items: [...itemsOf({}).slice(0, -1), { ...NEW_DAY_ROW, isLocked: true }],
    isOpen: true,
    isShortRow: true,
  },
  {
    label: "the locked row pointed at: no band, no rule",
    page: "day",
    items: [...itemsOf({}).slice(0, -1), { ...NEW_DAY_ROW, isLocked: true }],
    isOpen: true,
    pointedKey: NEW_DAY_ROW.key,
    isShortRow: true,
  },
  { label: "the start screen", page: "start", items: [], isOpen: false },
];
