import type { DeepPartial } from "ai";
import { formatPath } from "@/lib/quality/path";
import { mergeShownReplan, type ReplanBasis } from "@/lib/replan/merge";
import { GeneratedReplanSchema, type GeneratedReplan } from "@/lib/schema/replan.schema";
import {
  endingOfState,
  isRecord,
  parsedForVisitor,
  readMessageStream,
  type StreamState,
} from "./message-stream";
import type { DayOutcome } from "./outcome";
import { withProviderPoints, type PlaceCheck } from "./place-checks";
import { replannedIdOf } from "@/lib/schema/positions";

/** A targeted re-plan as it streams, in schema order: its new stops, their versions, the line. */
export type PartialReplan = DeepPartial<GeneratedReplan>;

export interface ReadReplanStreamOptions {
  /** The day on screen, the request with the changed word, its windows and the round's prefix. */
  basis: ReplanBasis;
  /** `fetch()` to the route; a connection that fails before any response reads as `disconnected`. */
  response: Promise<Response>;
  /** Called with every parsed partial re-plan, in schema order. */
  onPartial: (partial: PartialReplan) => void;
  /** Called with each new place's check, keyed by its id in the merged day. */
  onPlaceCheck?: (check: PlaceCheck) => void;
  /** The signal the caller also gave `fetch`; aborting rejects with its reason. */
  signal?: AbortSignal;
}

/**
 * Reads a targeted re-plan's stream into partial re-plans and one outcome: a day's outcomes,
 * the finished re-plan merged into the day on screen. A re-plan is all or nothing
 * (`docs/targeted-replan.md`, section 4), so a cut or lost stream keeps nothing and an answer
 * the merge refuses, or one it would drop a new stop of (`mergeShownReplan`), is `invalid`: the
 * day stays as it was. The stream keys a place's check by its id in the re-plan (`stop-1:p`);
 * the merged day holds it under the round's prefix (`r2-stop-1:p`), and so does every check
 * this hands on. Loadable in a browser: the page and the server read the same bytes into the
 * same day.
 */
export async function readReplanStream({
  basis,
  response,
  onPartial,
  onPlaceCheck = () => undefined,
  signal,
}: ReadReplanStreamOptions): Promise<DayOutcome> {
  const idOf = (placeId: string): string => replannedIdOf(basis.idPrefix, placeId);
  const end = await readMessageStream({
    response,
    signal,
    onPlaceCheck: (check) => onPlaceCheck({ ...check, placeId: idOf(check.placeId) }),
    onText: async (text) => {
      const { value } = await parsedForVisitor(text);
      if (isRecord(value)) onPartial(value as PartialReplan);
    },
  });
  if (end.kind === "lost") return { kind: "disconnected", itinerary: null };
  return end.kind === "read" ? outcomeOf(basis, end.state, idOf) : end;
}

async function outcomeOf(
  basis: ReplanBasis,
  state: StreamState,
  idOf: (placeId: string) => string,
): Promise<DayOutcome> {
  const ending = endingOfState(state);
  if (ending === "refused" || ending === "unavailable") return { kind: ending };
  if (ending === "cut") return { kind: "cut", itinerary: null };

  const { value, state: parse } = await parsedForVisitor(state.text);
  if (parse !== "successful-parse") {
    return { kind: "invalid", reason: "the re-plan ended before its JSON closed", isEmpty: false };
  }
  const parsed = GeneratedReplanSchema.safeParse(value);
  if (!parsed.success) {
    const reason = parsed.error.issues
      .map((issue) => `${formatPath(issue.path) || "re-plan"}: ${issue.message}`)
      .join("; ");
    return { kind: "invalid", reason, isEmpty: false };
  }
  const merged = mergeShownReplan({ ...basis, replan: parsed.data });
  if (!merged.ok) return { kind: "invalid", reason: merged.reason, isEmpty: false };
  const checks = new Map([...state.placeChecks].map(([id, check]) => [idOf(id), check]));
  return { kind: "complete", itinerary: withProviderPoints(merged.itinerary, checks) };
}
