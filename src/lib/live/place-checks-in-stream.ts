import { createUIMessageStream, parsePartialJson, type UIMessageChunk } from "ai";
import { distanceInMeters } from "@/lib/geo/distance";
import type { PlaceVerifier } from "@/lib/places/verify-place";
import type { PlaceKind } from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import type { PartialDay } from "@/lib/stream/outcome";
import {
  PLACE_CHECK_PART,
  placeCheckOf,
  readyPlacesIn,
  type PlaceCheck,
  type ReadyPlace,
} from "@/lib/stream/place-checks";

/**
 * Checks the places of the visitor's day against Geoapify while it streams, and writes each
 * place's check into the visitor's stream beside the model's text (`docs/grounding.md`). A
 * place is checked as soon as what the check reads of it is final; the stream closes once the
 * model has ended and the checks still running have answered, or once the deadline after the
 * model's last word has passed, when they end `unchecked` and their lookups stop.
 */

/**
 * How long the stream's close waits for the last checks after the model's last word. Geoapify
 * answered Vercel in 0.25 to 0.5 s on production, so the tail of options waits about that;
 * `main` chose 3 s over 6, since the page's "written in" waits for the close.
 */
export const PLACE_CHECK_DEADLINE_MS = 3_000;

/** One place's check as the log keeps it. */
export interface PlaceCheckRecord {
  id: string;
  name: string;
  kind: PlaceKind;
  state: Exclude<PlaceCheck["state"], "checking">;
  /** Why it is unconfirmed or unchecked: the verifier's reason, or `deadline`. */
  reason: string | null;
  /** How far the provider moved a place confirmed by name, in metres. */
  shiftMeters: number | null;
}

export interface PlaceChecking {
  /** Reads the model's text so far and starts a check for each place it has finished. */
  read: (text: string) => void;
  /** The visitor's stream: the model's parts, each place's check beside them. */
  streamWith: (model: ReadableStream<UIMessageChunk>) => ReadableStream<UIMessageChunk>;
  /** Every check, as it ended; whole once the stream has closed. */
  records: () => PlaceCheckRecord[];
  /**
   * Each place's last check as the stream carried it, by its id, the provider's point with
   * those confirmed by name: what the log keeps to show the day again (`0007`).
   */
  checks: () => Record<string, PlaceCheck>;
  /** How long the close waited for checks after the model's last word; null before it did. */
  msWaited: () => number | null;
}

export interface PlaceCheckingOptions {
  verifier: PlaceVerifier;
  city: string;
  /** The calls' stop, when the route fails before `after()`: no lookup outlives it. */
  signal: AbortSignal;
  deadlineMs?: number;
  /** Milliseconds; tests give their own. */
  clock?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Resolves after `ms`, or at once when the signal aborts. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

/** The model's stream as it is, calling `onEnd` once it closes, errors or is cancelled. */
function endingWith(
  stream: ReadableStream<UIMessageChunk>,
  onEnd: () => void,
): ReadableStream<UIMessageChunk> {
  const reader = stream.getReader();
  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          onEnd();
          controller.close();
        } else {
          controller.enqueue(next.value);
        }
      } catch (cause) {
        onEnd();
        controller.error(cause);
      }
    },
    cancel(reason) {
      onEnd();
      return reader.cancel(reason);
    },
  });
}

export function startPlaceChecking({
  verifier,
  city,
  signal,
  deadlineMs = PLACE_CHECK_DEADLINE_MS,
  clock = () => performance.now(),
}: PlaceCheckingOptions): PlaceChecking {
  const seen = new Set<string>();
  const pending = new Map<string, Promise<void>>();
  const ended = new Map<string, PlaceCheckRecord>();
  const asked = new Map<string, ReadyPlace>();
  // Lookups stop with the calls, and when the close stops waiting for them.
  const stopLookups = new AbortController();
  const lookupSignal = AbortSignal.any([signal, stopLookups.signal]);
  let write: ((part: UIMessageChunk) => void) | null = null;
  const unwritten: UIMessageChunk[] = [];
  let latestText = "";
  let isParseQueued = false;
  let parsing: Promise<void> = Promise.resolve();
  let waited: number | null = null;

  const latest = new Map<string, PlaceCheck>();
  const send = (check: PlaceCheck): void => {
    latest.set(check.placeId, check);
    const part: UIMessageChunk = { type: PLACE_CHECK_PART, id: check.placeId, data: check };
    if (write === null) unwritten.push(part);
    else write(part);
  };

  const end = (ready: ReadyPlace, check: PlaceCheck, reason: string | null): void => {
    if (ended.has(ready.id) || check.state === "checking") return;
    const shiftMeters =
      check.state === "confirmed" && check.by === "name"
        ? Math.round(distanceInMeters(ready.place.coordinates, check.coordinates))
        : null;
    ended.set(ready.id, {
      id: ready.id,
      name: ready.place.name,
      kind: ready.place.kind,
      state: check.state,
      reason,
      shiftMeters,
    });
    send(check);
  };

  const start = (ready: ReadyPlace): void => {
    seen.add(ready.id);
    asked.set(ready.id, ready);
    send({ placeId: ready.id, state: "checking" });
    const lookup = verifier.verify(ready.place, { city }, lookupSignal).then((result) => {
      end(ready, placeCheckOf(ready.id, result), result.kind === "verified" ? null : result.reason);
    });
    pending.set(ready.id, lookup);
  };

  const parseLatest = async (): Promise<void> => {
    isParseQueued = false;
    const { value } = await parsePartialJson(latestText);
    // Read as the visitor's reader reads it, letters escaped twice unescaped.
    const day = withLettersUnescaped(value);
    if (!isRecord(day)) return;
    for (const ready of readyPlacesIn(day as PartialDay, seen)) start(ready);
  };

  return {
    read(text) {
      latestText = text;
      if (isParseQueued) return;
      isParseQueued = true;
      parsing = parsing.then(parseLatest);
    },
    streamWith(model) {
      return createUIMessageStream({
        execute: async ({ writer }) => {
          write = (part) => writer.write(part);
          for (const part of unwritten.splice(0)) writer.write(part);
          let onModelEnd: () => void = () => undefined;
          const modelEnded = new Promise<void>((resolve) => {
            onModelEnd = resolve;
          });
          writer.merge(endingWith(model, () => onModelEnd()));
          await modelEnded;
          // Every place the model finished has its check started before the wait begins.
          await parsing;
          const since = clock();
          await Promise.race([Promise.allSettled(pending.values()), delay(deadlineMs, signal)]);
          waited = Math.round(clock() - since);
          for (const [id, ready] of asked) {
            if (!ended.has(id)) end(ready, { placeId: id, state: "unchecked" }, "deadline");
          }
          stopLookups.abort();
        },
      });
    },
    records: () => [...ended.values()],
    checks: () => Object.fromEntries(latest),
    msWaited: () => waited,
  };
}

/**
 * The place checks a live call runs in `city`, the same for a day and a re-plan, with the
 * deadline its close waits for them under; none without a verifier, as the shadow, the eval's
 * rounds and most tests run.
 */
export function placeCheckingFor(
  deps: { placeVerifier?: PlaceVerifier; placeCheckDeadlineMs?: number },
  city: string,
  signal: AbortSignal,
): { checking: PlaceChecking; deadlineMs: number } | null {
  if (deps.placeVerifier === undefined) return null;
  const deadlineMs = deps.placeCheckDeadlineMs ?? PLACE_CHECK_DEADLINE_MS;
  return {
    checking: startPlaceChecking({ verifier: deps.placeVerifier, city, signal, deadlineMs }),
    deadlineMs,
  };
}
