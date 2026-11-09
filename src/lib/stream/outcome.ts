import type { DeepPartial } from "ai";
import type { GeneratedDay, Itinerary } from "@/lib/schema/itinerary.schema";

/**
 * A generated day as it streams, in schema order. Any field may be missing yet, the last
 * string may stop mid-word, and a number grows (1 → 15 → 150) until the next field starts.
 */
export type PartialDay = DeepPartial<GeneratedDay>;

/**
 * How a day's stream ended, as the client reads it. The simulator and the live route send
 * the same stream, so nothing here depends on the mock. `docs/harness.md`, "The outcome
 * protocol", lists which failure gives which outcome.
 *
 * - `complete`: the model finished and the day validated and normalized.
 * - `cut`: the server stopped early (max tokens, an error, a timeout) after some text.
 * - `disconnected`: the connection failed, before or during the stream.
 * - `refused`: the model declined; nothing of the partial is shown.
 * - `invalid`: the model finished, but the day did not parse or the normalizer refused it.
 * - `unavailable`: nothing came: the call was rejected, retries ran out, the server failed.
 * - `limited`: our own spend cap or rate limit answered.
 *
 * On `cut` and `disconnected`, `itinerary` is the salvage rule applied once: the day without
 * the swaps that did not arrive when the stream stopped inside them, or `null` when it
 * stopped earlier and the UI shows a failure instead.
 *
 * On `invalid`, `isEmpty` says the model closed the day's stops with none in them
 * (`docs/decisions.md`, "A day has at least one stop"): the visitor's day is given back and
 * the page asks for it once more. Any other invalid day is false.
 */
export type DayOutcome =
  | { kind: "complete"; itinerary: Itinerary }
  | { kind: "cut"; itinerary: Itinerary | null }
  | { kind: "disconnected"; itinerary: Itinerary | null }
  | { kind: "refused" }
  | { kind: "invalid"; reason: string; isEmpty: boolean }
  | { kind: "unavailable" }
  | { kind: "limited" };
