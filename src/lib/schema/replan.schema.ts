import { z } from "zod";
import { GeneratedAlternativeSetSchema, GeneratedStopSchema } from "./itinerary.schema";

/**
 * What a targeted re-plan writes (`docs/targeted-replan.md`): the new stops of the windows a
 * changed word shaped, their alternatives, and the line about the whole day. The kept stops
 * are not in it, so no answer can change one. Built from the day's own parts, kept portable as
 * they are, with no union type of its own: the day's five live in its assumptions, which a
 * re-plan does not write, since the changed word is the visitor's and the rest stay as they were.
 * The new stops stream first, being what changes on screen, and the line after the stops it names.
 */
export const GeneratedReplanSchema = z.strictObject({
  stops: z
    .array(GeneratedStopSchema)
    .describe(
      "The new stops, in time order, each inside one of the windows the request lists. Never a kept stop, and never a kept stop's place.",
    ),
  alternatives: z
    .array(GeneratedAlternativeSetSchema)
    .describe(
      "After all new stops, one entry for every new stop, its stopIndex counting the new stops from 0.",
    ),
  dek: z
    .string()
    .describe(
      "One line about the whole day as it now stands, kept stops and new, naming its places in the order they happen.",
    ),
});

export type GeneratedReplan = z.infer<typeof GeneratedReplanSchema>;
