"use client";

import { useEffect, useState } from "react";
import { START_REQUESTS } from "@/lib/days/written/quick-starts";
import type { CityReading } from "@/lib/schema/intake.schema";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { cn } from "@/components/ui/cn";
import { CityWord, type TypedCity } from "./city-word";

export interface CityWordCellProps {
  request: DayRequest;
  readings: readonly CityReading[];
  playedReading: string | null;
  isOpen: boolean;
  /** A city typed in the open list, read or not played; null when none is. */
  typedCity: TypedCity | null;
}

const ignore = () => undefined;

/**
 * The city word in its place in the sentence, open or closed. An open list opens a frame
 * after the cell is drawn, as a press opens it, so the server's page and the first client
 * frame agree; drawn open rather than opened, it takes no focus, so no cell takes the
 * page's from another and the page stays where it was scrolled.
 */
export function CityWordCell({
  request,
  readings,
  playedReading,
  isOpen,
  typedCity,
}: CityWordCellProps) {
  const [isDrawn, setIsDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    // Open, the list hangs below the sentence and 24 px left of the word, so the cell makes
    // room for it both ways. A phone cell holds the page's gutters already, so the sentence
    // takes the phone's width there and the list keeps inside them, as on a phone.
    <div className={cn("px-8 pt-6 @max-chart:px-0", isOpen ? "pb-day" : "pb-6")}>
      <div className="type-voice text-title text-pretty text-ink-soft">
        A <span className="text-energy">lively</span> <span className="text-ink">Saturday</span> in{" "}
        <CityWord
          city={request.city}
          written={START_REQUESTS}
          current={request}
          readings={readings}
          playedReading={playedReading}
          openAt={isOpen && isDrawn ? "nowhere" : null}
          onOpenChange={ignore}
          onChooseWritten={ignore}
          onChooseCity={ignore}
          typedCity={isOpen ? typedCity : null}
          onChooseReading={ignore}
          trail=","
          isFocusedOnMount={false}
        />{" "}
        <span className="text-ink">
          {request.end === "late" ? "out late, with friends" : "with friends"}
        </span>
      </div>
    </div>
  );
}
