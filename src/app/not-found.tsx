import type { Metadata } from "next";
import { NO_DAY_TITLE, NoDayHere } from "@/features/day/no-day-here";

export const metadata: Metadata = { title: NO_DAY_TITLE };

/**
 * Any address Lantern has no page for, and a city it has written no day for: said plainly,
 * with the days it has written, and the way to one's own.
 */
export default function NotFound() {
  return <NoDayHere />;
}
