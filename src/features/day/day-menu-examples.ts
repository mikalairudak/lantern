import { COPY_LINK, LINK_COPIED } from "./day-export-words";
import type { DayExports } from "./day-exports";
import { DAY_END_EXAMPLES } from "./day-end-examples";
import type { DayMenuItem } from "./day-menu";
import { takeAlongOf } from "./take-along";

const KANAZAWA = DAY_END_EXAMPLES[0]!;
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

/** The day menu's items in each state worth a look, on Kanazawa's written day. */
export const DAY_MENU_STATES: readonly { label: string; items: DayMenuItem[] }[] = [
  { label: "the day whole", items: itemsOf({}) },
  { label: "while the day is written", items: itemsOf({ day: null }) },
  { label: "its link just copied", items: itemsOf({ exports: exportsOf(LINK_COPIED) }) },
  { label: "a day cut short", items: itemsOf({ isCut: true }) },
];
