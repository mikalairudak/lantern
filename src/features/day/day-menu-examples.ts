import { ELCHE_ITINERARY } from "@/lib/fixtures/replan/elche-dinner";
import { COPY_LINK, LINK_COPIED, LINK_NOT_COPIED } from "./day-export-words";
import type { DayExports } from "./day-exports";
import { DAY_END_EXAMPLES, writtenPicksOf } from "./day-end-examples";
import type { DayMenuItem } from "./day-menu";
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

const PLAN_ANOTHER: DayMenuItem = {
  key: "another",
  label: "Plan another day",
  note: "Ask for a day somewhere else",
  isApart: true,
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
    PLAN_ANOTHER,
  ];
}

/** Which masthead a cell draws: a day's with its menu, the start screen's, or a page's action. */
export type MastheadPage = "day" | "start" | "action";

export interface DayMenuState {
  label: string;
  page: MastheadPage;
  items: DayMenuItem[];
  isOpen: boolean;
}

/** The masthead and its menu in each state worth a look, on Kanazawa's written day. */
export const DAY_MENU_STATES: readonly DayMenuState[] = [
  { label: "a day, its menu open", page: "day", items: itemsOf({}), isOpen: true },
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
    label: "while a re-plan is written: another day locked",
    page: "day",
    items: [...itemsOf({}).slice(0, -1), { ...PLAN_ANOTHER, isLocked: true }],
    isOpen: true,
  },
  {
    label: "a stream that ended without a day",
    page: "day",
    items: [{ ...PLAN_ANOTHER, isApart: false }],
    isOpen: true,
  },
  { label: "the start screen", page: "start", items: [], isOpen: false },
  { label: "a page with an action", page: "action", items: [], isOpen: false },
];
