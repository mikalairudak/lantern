"use client";

import { useCallback } from "react";
import { isAreaKind, type PlaceKind } from "@/lib/schema/itinerary.schema";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import { PlaceChecksContext } from "./place-check";
import { StopRowCell, type StopRowCellProps } from "./stop-row-cell";
import { STOP_ROW_EXAMPLES } from "./stop-row-examples";
import { stopIndexOfId } from "@/lib/schema/positions";

/** How the cell's own place stands with the search; null for a day never checked. */
export type CheckState =
  "checking" | "confirmed by name" | "confirmed by area" | "unconfirmed" | "unchecked" | null;

export interface PlaceCheckCellProps extends StopRowCellProps {
  check: CheckState;
}

/** How far the search's point stands from the model's, in degrees: about 40 m. */
const PROVIDER_SHIFT = 0.0003;

interface Point {
  lat: number;
  lng: number;
}

/** The check a state names, for one place; the search's point near the model's for a name. */
function checkOf(state: CheckState, placeId: string, point: Point): PlaceCheck | null {
  switch (state) {
    case null:
      return null;
    case "confirmed by name":
      return {
        placeId,
        state: "confirmed",
        by: "name",
        coordinates: { lat: point.lat + PROVIDER_SHIFT, lng: point.lng - PROVIDER_SHIFT },
      };
    case "confirmed by area":
      return { placeId, state: "confirmed", by: "area" };
    case "checking":
      return { placeId, state: "checking" };
    case "unconfirmed":
      return { placeId, state: "unconfirmed" };
    case "unchecked":
      return { placeId, state: "unchecked" };
  }
}

/**
 * Why a day never shows this check on this kind of place, or null when it can: a place to eat
 * or drink is checked only by the places of its kind around its point, any other only by its
 * name (`src/lib/places/verify-place.ts`).
 */
function unreachableCheckOf(check: CheckState, kind: PlaceKind | undefined): string | null {
  const isArea = kind !== undefined && isAreaKind(kind);
  if (check === "confirmed by area" && !isArea) {
    return "Only a place to eat or drink is confirmed by the places of its kind around it.";
  }
  if (check === "confirmed by name" && isArea) {
    return "A place to eat or drink is confirmed by the places of its kind around it, not by its name.";
  }
  return null;
}

/**
 * The stop row with its place checked: every version of the example's stop in the check the
 * cell names, and its neighbours not confirmed (still being looked up while it is), so only
 * the row under study can carry the mark. A check a day never gives its kind of place says so.
 */
export function PlaceCheckCell({ check, ...row }: PlaceCheckCellProps) {
  const subject = STOP_ROW_EXAMPLES[row.example];
  const kind = subject?.fixture.day.stops[subject.stop]?.place.kind;
  const placeCheckOf = useCallback(
    (placeId: string) => {
      const example = STOP_ROW_EXAMPLES[row.example];
      const point = example?.fixture.day.stops[example.stop]?.place.coordinates;
      const isSubject = example !== undefined && stopIndexOfId(placeId) === example.stop;
      const state = isSubject || check === "checking" || check === null ? check : "unconfirmed";
      return checkOf(state, placeId, point ?? { lat: 0, lng: 0 });
    },
    [row.example, check],
  );
  const note = unreachableCheckOf(check, kind);
  if (note !== null) return <p className="p-3 type-note text-muted">{note}</p>;
  return (
    <PlaceChecksContext.Provider value={placeCheckOf}>
      <StopRowCell {...row} />
    </PlaceChecksContext.Provider>
  );
}
