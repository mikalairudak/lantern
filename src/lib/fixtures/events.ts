import type { ProductEvent } from "@/lib/events/event.schema";

/** One product event of each kind, as the client would send them. */
export const ONE_EVENT_OF_EACH_KIND: readonly ProductEvent[] = [
  { kind: "day-opened", city: "kyoto", via: "pressed", written: true },
  { kind: "day-ended", city: "kyoto", via: "pressed", written: true, outcome: "complete" },
  { kind: "day-left", city: "sao-paulo", via: "typed", written: false, stage: "before-end" },
  { kind: "curve-dragged", city: "kyoto" },
  { kind: "stop-swapped", city: "lisbon" },
  { kind: "word-changed", city: "lisbon", word: "company" },
  { kind: "link-shared", city: "kanazawa" },
  { kind: "calendar-saved", city: "kanazawa" },
  { kind: "route-opened", city: "kanazawa" },
  { kind: "intake-ended", outcome: "question" },
];
