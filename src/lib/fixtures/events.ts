import type { ProductEvent } from "@/lib/events/event.schema";

/** Kyoto's written day, reached by its link and read on the chart, as events about it say. */
export const KYOTO_ON_CHART = { city: "kyoto", via: "link", written: true, view: "chart" } as const;

/** The curve dragged on Kyoto's written day. */
export const KYOTO_DRAGGED = {
  kind: "curve-dragged",
  ...KYOTO_ON_CHART,
} as const satisfies ProductEvent;

/** One product event of each kind, as the client would send them. */
export const ONE_EVENT_OF_EACH_KIND: readonly ProductEvent[] = [
  { kind: "home-viewed" },
  { kind: "day-opened", city: "kyoto", via: "pressed", written: true },
  {
    kind: "day-ended",
    city: "kyoto",
    via: "pressed",
    written: true,
    view: "read",
    outcome: "complete",
  },
  { kind: "day-left", city: "sao-paulo", via: "typed", written: false, stage: "before-end" },
  KYOTO_DRAGGED,
  { kind: "stop-swapped", city: "lisbon", via: "word", written: false, view: "read" },
  { kind: "link-shared", city: "kanazawa", via: "kept", written: false, view: "chart" },
  { kind: "calendar-saved", ...KYOTO_ON_CHART },
  { kind: "route-opened", city: "kanazawa", via: "typed", written: false, view: "read" },
  { kind: "day-read-to-end", ...KYOTO_ON_CHART },
  { kind: "word-changed", city: "lisbon", word: "company" },
  { kind: "intake-ended", outcome: "question" },
];
