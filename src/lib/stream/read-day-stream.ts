import { parsePartialJson } from "ai";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { formatPath } from "@/lib/quality/path";
import {
  GeneratedDaySchema,
  type DayRequest,
  type GeneratedDay,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "./escaped-letters";
import {
  endingOfState,
  isRecord,
  parsedForVisitor,
  readMessageStream,
  type StreamState,
} from "./message-stream";
import type { DayOutcome, PartialDay } from "./outcome";
import { withProviderPoints, type PlaceCheck } from "./place-checks";

export interface ReadDayStreamOptions {
  /** What the day was generated for; the normalizer takes its city, date and time zone. */
  request: DayRequest;
  /**
   * `fetch()` to the route, or the simulator. Passed as a promise, so a connection that
   * fails before any response is read as `disconnected` too.
   */
  response: Promise<Response>;
  /** Called with every parsed partial, in schema order. */
  onPartial: (partial: PartialDay) => void;
  /**
   * Called with each place's check against Geoapify as the live day's stream carries it,
   * keyed by the place's id (`docs/grounding.md`); a written day's stream carries none.
   */
  onPlaceCheck?: (check: PlaceCheck) => void;
  /**
   * The signal the caller also gave `fetch`. Aborting rejects with its reason and gives no
   * outcome; without the same signal on both, an abort mid-body reads as `disconnected`.
   */
  signal?: AbortSignal;
}

/**
 * Reads the AI SDK's UI message stream (`toUIMessageStreamResponse`) into partial days and
 * one outcome. It resolves for every way a stream can end and rejects only when the
 * caller's `signal` aborts.
 */
export async function readDayStream({
  request,
  response,
  onPartial,
  onPlaceCheck = () => undefined,
  signal,
}: ReadDayStreamOptions): Promise<DayOutcome> {
  const end = await readMessageStream({
    response,
    onPlaceCheck,
    signal,
    onText: async (text) => {
      const { value } = await parsedForVisitor(text);
      // The text is a stream constrained to `GeneratedDaySchema`, repaired so far; only the
      // finished day is validated, as with the SDK's own `useObject`.
      if (isRecord(value)) onPartial(value as PartialDay);
    },
  });
  if (end.kind === "lost") {
    return { kind: "disconnected", itinerary: await salvage(request, end.text) };
  }
  return end.kind === "read" ? outcomeOf(request, end.state) : end;
}

async function outcomeOf(request: DayRequest, state: StreamState): Promise<DayOutcome> {
  const ending = endingOfState(state);
  if (ending === "refused" || ending === "unavailable") return { kind: ending };
  if (ending === "cut") return { kind: "cut", itinerary: await salvage(request, state.text) };

  const { value, state: parse } = await parsedForVisitor(state.text);
  if (parse !== "successful-parse") {
    return { kind: "invalid", reason: "the day ended before its JSON closed", isEmpty: false };
  }
  const parsed = GeneratedDaySchema.safeParse(value);
  if (!parsed.success) {
    const reason = parsed.error.issues
      .map((issue) => `${formatPath(issue.path) || "day"}: ${issue.message}`)
      .join("; ");
    return { kind: "invalid", reason, isEmpty: isEmptyDay(value) };
  }
  const normalized = normalizeDay(request, parsed.data);
  // A cut or a lost day keeps the model's points: a salvaged day is read as it was written.
  return normalized.ok
    ? { kind: "complete", itinerary: withProviderPoints(normalized.itinerary, state.placeChecks) }
    : { kind: "invalid", reason: normalized.reason, isEmpty: false };
}

/**
 * The model closed the day's stops with none in them, the one invalid day given back and
 * asked for again (`docs/decisions.md`, "A day has at least one stop"). A day whose stops
 * the normalizer drops to none had stops, and is not.
 */
function isEmptyDay(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.stops) && value.stops.length === 0;
}

/**
 * The salvage rule (`docs/decisions.md`, "The stream reports how it ended"). `alternatives` streams
 * after every stop, so its key in the partial means every stop arrived whole: the day is kept
 * without the swaps that did not arrive. A stream that stopped earlier keeps nothing. This is the
 * day as the model wrote it, before the normalizer and with its escaped letters as written, which
 * the server's log scores as it scores a whole one.
 */
export async function salvagedDay(text: string): Promise<GeneratedDay | null> {
  const { value } = await parsePartialJson(text);
  if (!isRecord(value) || !Array.isArray(value.alternatives)) return null;
  const parsed = GeneratedDaySchema.safeParse({
    ...value,
    alternatives: wholeSets(value.alternatives),
  });
  return parsed.success ? parsed.data : null;
}

/** The salvaged day as the visitor is shown it, or null when the normalizer refuses it too. */
async function salvage(request: DayRequest, text: string): Promise<Itinerary | null> {
  const day = await salvagedDay(text);
  if (day === null) return null;
  const normalized = normalizeDay(request, withLettersUnescaped(day));
  return normalized.ok ? normalized.itinerary : null;
}

/**
 * The sets before the last one closed before it began, so they are whole. In the last one,
 * the last option received is dropped: a string cut mid-word is repaired to look finished,
 * so a whole option and a cut one cannot be told apart. A set left empty goes too.
 */
function wholeSets(sets: unknown[]): unknown[] {
  const earlier = sets.slice(0, -1);
  const last = sets.at(-1);
  if (!isRecord(last) || !Array.isArray(last.options)) return earlier;
  const options = last.options.slice(0, -1);
  return options.length === 0 ? earlier : [...earlier, { ...last, options }];
}
