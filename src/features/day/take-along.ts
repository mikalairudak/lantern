import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { dayEndWordsOf, routeLabelOf } from "./day-end-words";
import { COPY_LINK, LINK_COPIED } from "./day-export-words";
import type { DayExports } from "./day-exports";
import type { DayMenuItem } from "./day-menu";

export const COPY_THE_LINK = "Copy the link";
export const ADD_TO_YOUR_CALENDAR = "Add to your calendar";
/** What a way to take the day along says until the day is whole. */
export const WAITING_NOTE = "Ready once the day is written";

interface TakeAlongOptions {
  /** The finished day, or null while it is written: its ways then wait. */
  day: Itinerary | null;
  shown: readonly number[];
  checks: PlaceChecks;
  /** A day kept short of its end offers its link alone, as the line under it does. */
  isCut: boolean;
  exports: DayExports;
  onRoute: () => void;
  hasLink: boolean;
}

/**
 * The ways to take a day along, as the day menu lists them: its link, its calendar and its
 * walking route, each saying what it does, worked out from the day as shown and the visitor's
 * picks. While the day is written they are listed and wait, so the visitor learns where they are.
 */
export function takeAlongOf({
  day,
  shown,
  checks,
  isCut,
  exports,
  onRoute,
  hasLink,
}: TakeAlongOptions): DayMenuItem[] {
  const items: DayMenuItem[] = [];
  const isWaiting = day === null;
  if (hasLink && exports.sendLink) {
    const send = exports.sendLink;
    items.push({
      key: "link",
      label:
        exports.copied === COPY_LINK
          ? COPY_THE_LINK
          : exports.copied === LINK_COPIED
            ? "Link copied"
            : "Link not copied",
      note: isWaiting ? WAITING_NOTE : "Opens this day for anyone you send it to",
      onSelect: () => void send(),
      isDisabled: isWaiting,
      keepsOpen: true,
      status:
        exports.copied === LINK_COPIED
          ? "The day's link is copied"
          : exports.copied === COPY_LINK
            ? undefined
            : "The day's link could not be copied",
    });
  }
  if (isCut) return items;
  const stops = day?.stops.length ?? 0;
  items.push({
    key: "calendar",
    label: ADD_TO_YOUR_CALENDAR,
    note: day
      ? stops === 1
        ? `1 event, for the day's one stop, at its hour in ${day.city}`
        : `${stops} events, one for each stop, at its hour in ${day.city}`
      : WAITING_NOTE,
    onSelect: exports.saveCalendar,
    isDisabled: isWaiting,
  });
  const route = day ? dayEndWordsOf(day, shown, checks).route : null;
  if (day && !route) return items;
  items.push({
    key: "route",
    label: route ? routeLabelOf(route) : "Walk it in Google Maps",
    note: route
      ? route.included < route.total
        ? `The first ${route.included} stops in order, as a walk`
        : `The ${route.total} stops in order, as a walk`
      : WAITING_NOTE,
    href: route?.url,
    onSelect: onRoute,
    isDisabled: isWaiting,
  });
  return items;
}
