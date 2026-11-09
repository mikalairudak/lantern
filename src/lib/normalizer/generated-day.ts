import {
  ASSUMABLE_FACT_KEYS,
  generatedLightOf,
  type Alternative,
  type AssumableFactKey,
  type GeneratedAlternative,
  type GeneratedAssumptions,
  type GeneratedDay,
  type GeneratedPlace,
  type Itinerary,
  type Place,
} from "@/lib/schema/itinerary.schema";

/**
 * An itinerary written back as the model writes a day, the normalizer's work undone as far as
 * a check can tell: the ids go, "none" comes back for a light the app reads as null, and each
 * stop's versions return to their own set. The day's quality checks read a generated day, so a
 * day the app made, such as a targeted re-plan merged into the day on screen, is scored through
 * this (`docs/targeted-replan.md`, section 6). The lab's stand-in streams read it too.
 */

/** A place as the model writes it, in schema order, without the id the app gives it. */
export function toGeneratedPlace(place: Place): GeneratedPlace {
  const { name, kind, neighborhood, summary, aesthetic, coordinates, sensory, light } = place;
  return {
    name,
    kind,
    neighborhood,
    coordinates,
    sensory,
    light: generatedLightOf(light),
    summary,
    aesthetic,
  };
}

/** An alternative as the model writes it: the place in schema order, then why it fits. */
export function toGeneratedOption(alternative: Alternative): GeneratedAlternative {
  return { ...toGeneratedPlace(alternative), reason: alternative.reason };
}

/** What the model assumed, as it writes it: nothing for the visitor's words or the asked one. */
function assumptionsOf({ facts }: Itinerary): GeneratedAssumptions {
  const assumed = <Key extends AssumableFactKey>(key: Key): Itinerary["facts"][Key]["value"] =>
    facts[key].source === "assumed" ? facts[key].value : null;
  return Object.fromEntries(
    ASSUMABLE_FACT_KEYS.map((key) => [key, assumed(key)]),
  ) as GeneratedAssumptions;
}

/** The day as the model would have written it, in schema order. */
export function generatedDayOf(itinerary: Itinerary): GeneratedDay {
  return {
    assumptions: assumptionsOf(itinerary),
    dek: itinerary.dek,
    stops: itinerary.stops.map((stop) => ({
      startTime: stop.startTime,
      durationMinutes: stop.durationMinutes,
      place: toGeneratedPlace(stop.primary),
      // The model leaves out the energy word, which shapes every stop.
      dependsOn: ASSUMABLE_FACT_KEYS.filter((key) => stop.dependsOn.includes(key)),
    })),
    alternatives: itinerary.stops.map((stop, stopIndex) => ({
      stopIndex,
      options: stop.alternatives.map(toGeneratedOption),
    })),
  };
}
