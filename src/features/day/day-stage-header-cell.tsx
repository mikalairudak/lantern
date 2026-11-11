"use client";

import { CellNote, StillNote, useStill } from "@/features/itinerary/use-still";
import { START_REQUESTS } from "@/lib/days/written/quick-starts";
import {
  HEADER_DAYS,
  stillOf,
  type HeaderDay,
  type HeaderMoment,
  type HeaderProps,
} from "./day-stage-header-examples";
import { DayStageHeader } from "./day-stage-header";

const ignore = () => undefined;

/** The header at rest: nothing open, nothing changing, no one waiting, every hand still. */
const AT_REST = {
  isWaiting: false,
  cityOpenAt: null,
  isCityFocused: false,
  onCityOpenChange: ignore,
  onChooseWritten: ignore,
  onChooseCity: ignore,
  onChooseReading: ignore,
  onChoose: ignore,
  onLight: ignore,
  onRetry: ignore,
} satisfies Partial<HeaderProps>;

export interface DayStageHeaderCellProps {
  /** Into `HEADER_DAYS`. */
  day: number;
  moment: HeaderMoment;
}

/** The day a cell is set on; an index past the days is a mistake in the matrix. */
function headerDayAt(day: number): HeaderDay {
  const chosen = HEADER_DAYS[day];
  if (!chosen) {
    throw new Error(`The day stage header has no day ${day}: it has ${HEADER_DAYS.length}`);
  }
  return chosen;
}

/**
 * The day's header at one moment of one day, set at rest in that moment's frame: a real
 * frame of the day's stream, the day as it ended, or what the visitor did to it.
 */
export function DayStageHeaderCell({ day, moment }: DayStageHeaderCellProps) {
  const chosen = headerDayAt(day);
  const reading = useStill(stillOf(chosen, moment));

  if (reading.status !== "read") return <StillNote reading={reading} />;
  const { still } = reading;
  if ("unreached" in still) return <CellNote>{still.unreached}</CellNote>;
  return (
    <DayStageHeader
      {...still.frame}
      {...AT_REST}
      readings={chosen.readings}
      playedReading={chosen.playedReading}
      written={START_REQUESTS}
    />
  );
}
