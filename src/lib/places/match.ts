import type { PlaceKind } from "@/lib/schema/itinerary.schema";
import { foldToLatin } from "./names";
import type { CityToCheck, PlaceToCheck } from "./verify-place";

/**
 * The rule that confirms a place the model named, as the integrations session measured it on
 * the 66 places of the written days ("Geoapify coverage v2", 2026-10-28), with the category
 * check it recommended added. A candidate confirms the place only when its distance fits the
 * place's kind, its name matches, and its category fits the kind. Geoapify's
 * `rank.confidence` is not read: wrong places came back with a confidence of 1.
 */

/** A geocoding result as the rule reads it. */
export interface Candidate {
  /** Its name, then its international and other names. */
  names: readonly string[];
  /** From the model's coordinates. */
  meters: number;
  /** Geoapify's `result_type`: "amenity", "building", "street", "city" and so on. */
  resultType: string;
  /** Geoapify's dotted `category`, such as "catering.restaurant"; null when it gives none. */
  category: string | null;
}

/**
 * How far from the model's coordinates the provider's point may be. The measured run's radii:
 * a venue is a point at its door, so 200 m holds every right venue it found by name up to
 * Nou Manolín at 185 m; gardens, viewpoints and markets have grounds whose centre is off the
 * gate; a walk's point is its start while the provider's is the street's middle, and a
 * castle's is far from its gate, so the right walks reached 425 m and the castle 398 m. Three
 * right restaurants lay farther (225, 284 and 661 m) and stay unconfirmed: a radius that held
 * them would hold another restaurant of a similar name a few streets away.
 *
 * Sites with grounds were widened on 2026-10-31, from the live place rounds' right names left
 * just outside (`docs/grounding.md`, "Better name matching"): a temple's or a church's point
 * is the middle of its precinct, not its gate (Hōnen-in 203 m, Konchi-in 356 m, São Vicente de
 * Fora 294 m), a garden's its lawns (the Torel 309 m, Murin-an 436 m), a market's hall and a
 * museum's building spread from their doors (Alicante's central market 380 m), and a walk
 * named after a square or a long street is measured from the walk's start to the street's
 * middle (Plaça de l'Abat Penalva 572 m). A candidate whose name says another kind of place
 * never confirms (`namesAnotherKind`), which keeps the wider rings from taking a market for a
 * shrine.
 */
export const RADIUS_METERS: Readonly<Record<PlaceKind, number>> = {
  coffee: 200,
  food: 200,
  bar: 200,
  shop: 200,
  gallery: 200,
  museum: 300,
  sacred: 400,
  garden: 500,
  viewpoint: 400,
  market: 400,
  walk: 700,
  architecture: 600,
};

/**
 * The categories each kind may come back as, matched as dotted prefixes: "catering.bar" holds
 * "catering.bar.wine". A religious house that is now a museum is still its building, as
 * Lisbon's Carmo and São Vicente de Fora come back. A bar takes a restaurant, since a tapas
 * bar is often mapped as one (Nou Manolín in the recording), but not a café or a fast-food
 * counter. Architecture takes a building of note, never a house. A walk is a street or a
 * path: a street comes back as a result type rather than a category, and is the only kind a
 * street confirms.
 */
export const KIND_CATEGORIES: Readonly<Record<PlaceKind, readonly string[]>> = {
  coffee: ["catering", "commercial.food_and_drink"],
  food: ["catering", "commercial.food_and_drink"],
  bar: [
    "catering.bar",
    "catering.pub",
    "catering.biergarten",
    "catering.taproom",
    "catering.restaurant",
    "adult.nightclub",
  ],
  gallery: ["entertainment.culture", "entertainment.museum", "commercial.art", "tourism"],
  museum: ["entertainment.museum", "entertainment.culture", "heritage", "tourism"],
  architecture: [
    "building.historic",
    "building.tourism",
    "building.place_of_worship",
    "building.public_and_civil",
    "building.transportation",
    "building.entertainment",
    "heritage",
    "tourism",
    "man_made",
    "religion",
    "entertainment.museum",
  ],
  sacred: ["religion", "building.place_of_worship", "heritage", "tourism", "entertainment.museum"],
  garden: ["leisure.park", "natural", "national_park", "religion", "tourism"],
  viewpoint: ["tourism", "natural", "leisure", "man_made", "beach"],
  market: ["commercial.marketplace", "catering.food_court"],
  shop: ["commercial"],
  // A walk along a beach comes back as the beach (Playa del Postiguet, four times in the rounds).
  walk: ["highway", "beach"],
};

/** Categories a kind refuses inside one it takes: a shop is not where the groceries are. */
const REFUSED_CATEGORIES: Readonly<Partial<Record<PlaceKind, readonly string[]>>> = {
  shop: ["commercial.supermarket", "commercial.convenience", "commercial.discount_store"],
};

/** Whether a dotted category is one of the prefixes or under one: "catering.bar.wine". */
export function isCategoryUnder(category: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => category === prefix || category.startsWith(`${prefix}.`));
}

/** The result types a venue or a site comes back as; an area or an address never confirms one. */
const SITE_RESULT_TYPES: readonly string[] = ["amenity", "building"];
const STREET_RESULT_TYPE = "street";

/** A candidate's name matches when it shares at least half the words of the shorter name. */
export const MIN_NAME_SCORE = 0.5;

/**
 * When both names say two distinctive things or more, one shared word is not the place:
 * "Casa Batlló" is not "Casa Milà". A name that says only one thing ("MACA", "Convento do
 * Carmo") may still be found inside a longer one.
 */
export const MIN_SHARED_WORDS_OF_LONGER_NAMES = 2;

/**
 * Words that say what a place is, not which one: the measured run's list, and the heads the
 * live days' false confirmations shared with another place (2026-10-30): "Cervecería Sento"
 * confirmed by "La cervecería", the district word dropped and the head left to match.
 */
const COMMON_WORDS = new Set(
  (
    "the of de del la el los las da do dos das di du le a e y and en " +
    "restaurante restaurant cafe coffee bar taberna tavern cervejaria livraria libreria bookshop " +
    "mercado market mercat museo museu museum igreja iglesia church mosteiro monastery convento " +
    "convent temple shrine plaza placa praca square calle carrer rua street paseo passeig " +
    "avenida parque parc park garden jardin jardim " +
    "cerveceria cafeteria pastelaria pasteleria bodega izakaya kissa kissaten"
  ).split(" "),
);

/** A text's words in plain Latin letters, lower case, one letter long left out. */
export function wordsOf(text: string): string[] {
  return foldToLatin(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
}

/** The name's Latin letters and digits run together; "" for a name in another script. */
function compact(text: string): string {
  return foldToLatin(text).replace(/[^a-z0-9]/g, "");
}

/** Whether two names are spelled the same, case, accents, spaces and punctuation aside. */
export function isSameSpelling(a: string, b: string): boolean {
  const spelled = compact(a);
  return spelled !== "" && spelled === compact(b);
}

/** The words that say where a place is rather than which it is: its city and its district. */
export function contextWordsOf(place: PlaceToCheck, city: CityToCheck): Set<string> {
  return new Set([...wordsOf(city.city), ...wordsOf(place.neighborhood)]);
}

/** A name's words that tell it from others: no common word, and none of `leftOut`. */
export function distinctiveWordsOf(text: string, leftOut: ReadonlySet<string>): Set<string> {
  return new Set(wordsOf(text).filter((word) => !COMMON_WORDS.has(word) && !leftOut.has(word)));
}

/**
 * 0 to 1: how well a candidate's name stands for the place's, in any word order, leaving out
 * common words and the place's own district and city, so "Pontocho Masuda" in Pontocho does
 * not match a restaurant on Pontocho. A name with no Latin letters scores 0 against any
 * other, its own included: the rule cannot read it, so it fails closed unless the candidate's
 * international or other names give a Latin form.
 */
export function nameScore(place: PlaceToCheck, city: CityToCheck, name: string): number {
  if (isSameSpelling(place.name, name)) return 1;
  const context = contextWordsOf(place, city);
  return overlapScore(distinctiveWordsOf(place.name, context), distinctiveWordsOf(name, context));
}

const NO_WORDS: ReadonlySet<string> = new Set();

/**
 * Whether a site stands for a place that gave its district its name: "Nanzen-ji Temple" in
 * Nanzen-ji has no word left once the district's are out, so its whole name, common words
 * aside, must be the candidate's, no more and no less. Never a street, since streets take a
 * district's name as often as not ("Okazaki Street" is not Okazaki Park), and "Jardim da Cerca
 * da Graça" is not "Jardim da Graça", one word more.
 */
function isDistrictsNamesake(
  place: PlaceToCheck,
  city: CityToCheck,
  candidate: Candidate,
): boolean {
  if (candidate.resultType === STREET_RESULT_TYPE) return false;
  if (distinctiveWordsOf(place.name, contextWordsOf(place, city)).size > 0) return false;
  const ours = distinctiveWordsOf(place.name, NO_WORDS);
  if (ours.size === 0) return false;
  return candidate.names.some((name) => {
    const theirs = distinctiveWordsOf(name, NO_WORDS);
    return theirs.size === ours.size && [...ours].every((word) => theirs.has(word));
  });
}

/** Shared words over the shorter name's, with two required of two longer names. */
function overlapScore(ours: ReadonlySet<string>, theirs: ReadonlySet<string>): number {
  const shorter = Math.min(ours.size, theirs.size);
  if (shorter === 0) return 0;
  const shared = [...ours].filter((word) => theirs.has(word)).length;
  const required =
    shorter >= MIN_SHARED_WORDS_OF_LONGER_NAMES ? MIN_SHARED_WORDS_OF_LONGER_NAMES : 1;
  return shared < required ? 0 : shared / shorter;
}

/**
 * Words that say a walk is a route, not which one: "Shirakawa Canal in Gion" walks along the
 * street called Shirakawa, and "Philosopher's Path" is no "Path of peace".
 */
const ROUTE_WORDS = new Set(
  (
    "path walk lane alley road way trail promenade canal river bank riverside steps stairs " +
    "bridge crossing loop route along boardwalk waterfront seafront embankment " +
    // How the model wraps a route's name: "Shirakawa Canal in Gion", "canal after dark".
    "in at on by near to from through around after dark night evening morning"
  ).split(" "),
);

/**
 * Whether a street stands for a walk named after it: their names scored without the words
 * that only say a route, as the name check scores any other two names.
 */
function walksAlong(place: PlaceToCheck, city: CityToCheck, candidate: Candidate): boolean {
  if (place.kind !== "walk" || candidate.resultType !== STREET_RESULT_TYPE) return false;
  const context = contextWordsOf(place, city);
  const routeless = (text: string): Set<string> =>
    new Set([...distinctiveWordsOf(text, context)].filter((word) => !ROUTE_WORDS.has(word)));
  const ours = routeless(place.name);
  return candidate.names.some((name) => overlapScore(ours, routeless(name)) >= MIN_NAME_SCORE);
}

function bestNameScore(place: PlaceToCheck, city: CityToCheck, candidate: Candidate): number {
  return Math.max(0, ...candidate.names.map((name) => nameScore(place, city, name)));
}

export function isWithinRadius(kind: PlaceKind, meters: number): boolean {
  return meters <= RADIUS_METERS[kind];
}

/**
 * Whether a venue or site that Geoapify gives no category passes the category check for a
 * kind, leaving the name and the distance to decide. A site does: six places of the recording
 * that its audit took as right came back so (Hōnen-in, Konchi-in, the Panteão, São Roque, the
 * Philosopher's Path and, borderline, the Ginkaku-ji approach), and refusing them would
 * confirm 33 of 66 rather than 39; Geoapify leaves the category out for some temples and
 * churches. A place to eat or drink does not: in Sonnet's 408 places of the first two live
 * passes (2026-10-30) an uncategorised temple confirmed "Okutan" and "Omen" as food five
 * times, the temple's name inside the restaurant's, and refusing it there lost no right
 * confirmation. Every kind is listed, so a new one fails the typecheck until someone decides.
 */
export const UNCATEGORISED_CONFIRMS: Readonly<Record<PlaceKind, boolean>> = {
  coffee: false,
  food: false,
  bar: false,
  shop: true,
  gallery: true,
  museum: true,
  sacred: true,
  garden: true,
  viewpoint: true,
  market: true,
  walk: true,
  architecture: true,
};

/** Whether what came back is the kind of thing the place is. */
export function isCategoryFor(kind: PlaceKind, candidate: Candidate): boolean {
  if (candidate.resultType === STREET_RESULT_TYPE) return kind === "walk";
  if (!SITE_RESULT_TYPES.includes(candidate.resultType)) return false;
  const { category } = candidate;
  if (category === null) return UNCATEGORISED_CONFIRMS[kind];
  return (
    isCategoryUnder(category, KIND_CATEGORIES[kind]) &&
    !isCategoryUnder(category, REFUSED_CATEGORIES[kind] ?? [])
  );
}

/**
 * The words that say what kind of place a name is, grouped by the kind they say, in the
 * languages of the live days' cities. "ji" is the Japanese temple's suffix, as "Nanzen-ji"
 * splits.
 */
const HEAD_WORDS = {
  sacred: [
    "temple",
    "shrine",
    "church",
    "igreja",
    "iglesia",
    "esglesia",
    "basilica",
    "cathedral",
    "catedral",
    "concatedral",
    "cocatedral",
    "chapel",
    "capela",
    "capilla",
    "ermita",
    "mosteiro",
    "monastery",
    "monasterio",
    "convent",
    "convento",
    "jinja",
    "jingu",
    "taisha",
    "ji",
    "dera",
  ],
  market: ["market", "mercado", "mercat", "ichiba"],
  museum: ["museum", "museu", "museo", "gallery", "galeria"],
  garden: ["garden", "gardens", "jardim", "jardin", "jardines", "parque", "park", "parc"],
  viewpoint: ["miradouro", "mirador", "viewpoint", "lookout", "belvedere"],
  street: ["plaza", "placa", "praca", "calle", "carrer", "rua", "street", "avenida", "largo"],
  castle: ["castle", "castillo", "castell", "castelo"],
} as const;

type HeadGroup = keyof typeof HEAD_WORDS;

/**
 * The head words a kind's own name may carry. Kyoto's gardens are a temple's, so a garden takes
 * a temple's name; a viewpoint is often a castle; a walk is a street or runs through a park.
 * A kind not listed is not guarded: architecture covers castles, churches and squares alike,
 * and a meal or a shop is checked by its area in the route.
 */
const OWN_HEADS: Readonly<Partial<Record<PlaceKind, readonly HeadGroup[]>>> = {
  // A religious house that is now a museum, as the categories take it: São Vicente de Fora.
  sacred: ["sacred", "museum"],
  garden: ["garden", "sacred"],
  museum: ["museum"],
  gallery: ["museum"],
  market: ["market"],
  viewpoint: ["viewpoint", "castle"],
  walk: ["street", "garden"],
};

/**
 * Whether a candidate's names say another kind of place than the one asked for, and none of
 * its own kind: "Nishiki Market" is not Nishiki Tenmangu Shrine 227 m away, nor "Plaça de
 * Santa Maria" the basilica on it, nor a chapel the miradouro beside it. A kind the place's
 * own name says counts as its own, in any of the words for it: "Plaza Gabriel Miró" is the
 * Plaça, and "Hokan-ji lane" may be found by the temple. A name spelled the same always matches.
 */
export function namesAnotherKind(place: PlaceToCheck, candidate: Candidate): boolean {
  const kindsOwn = OWN_HEADS[place.kind];
  if (kindsOwn === undefined || isSpelledAlike(place, candidate)) return false;
  const groups = Object.keys(HEAD_WORDS) as HeadGroup[];
  const placeWords = new Set(wordsOf(place.name));
  const own = new Set<HeadGroup>([
    ...kindsOwn,
    ...groups.filter((group) => HEAD_WORDS[group].some((word) => placeWords.has(word))),
  ]);
  const ownWords = new Set<string>([...own].flatMap((group) => HEAD_WORDS[group]));
  const words = candidate.names.flatMap(wordsOf);
  const saysOwn = words.some((word) => ownWords.has(word));
  const saysOther = groups
    .filter((group) => !own.has(group))
    .flatMap((group) => HEAD_WORDS[group])
    .some((word) => !ownWords.has(word) && words.includes(word));
  return saysOther && !saysOwn;
}

export function isConfirmedBy(
  place: PlaceToCheck,
  city: CityToCheck,
  candidate: Candidate,
): boolean {
  return (
    isWithinRadius(place.kind, candidate.meters) &&
    (bestNameScore(place, city, candidate) >= MIN_NAME_SCORE ||
      walksAlong(place, city, candidate) ||
      isDistrictsNamesake(place, city, candidate)) &&
    (isCategoryFor(place.kind, candidate) || isViewpointSquare(place, candidate)) &&
    !namesAnotherKind(place, candidate)
  );
}

/**
 * A viewpoint that is a square mapped as a street, "Largo das Portas do Sol": a street confirms
 * it only when it is spelled as the place, since a viewpoint shares its name with the street
 * up to it as often as not.
 */
function isViewpointSquare(place: PlaceToCheck, candidate: Candidate): boolean {
  return (
    place.kind === "viewpoint" &&
    candidate.resultType === STREET_RESULT_TYPE &&
    isSpelledAlike(place, candidate)
  );
}

function isSpelledAlike(place: PlaceToCheck, candidate: Candidate): boolean {
  return candidate.names.some((name) => isSameSpelling(place.name, name));
}

/**
 * The candidate that confirms the place, or null: of those that pass all three, one spelled
 * as the place is, then the best name, then the nearest. "Das Flores" shares every distinctive
 * word of "Taberna da Rua das Flores", so a whole spelling is what tells the two apart.
 */
export function bestMatch<T extends Candidate>(
  place: PlaceToCheck,
  city: CityToCheck,
  candidates: readonly T[],
): T | null {
  const ranked = candidates
    .filter((candidate) => isConfirmedBy(place, city, candidate))
    .map((candidate) => ({
      candidate,
      isSpelledAlike: isSpelledAlike(place, candidate),
      score: bestNameScore(place, city, candidate),
    }))
    .sort(
      (a, b) =>
        Number(b.isSpelledAlike) - Number(a.isSpelledAlike) ||
        b.score - a.score ||
        a.candidate.meters - b.candidate.meters,
    );
  return ranked[0]?.candidate ?? null;
}
