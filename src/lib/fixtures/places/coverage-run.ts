import type { PlaceToCheck } from "@/lib/places/verify-place";

/**
 * Geoapify's answers for the 66 places of the three written days, recorded by the
 * integrations session on 2026-10-28 ("Geoapify coverage v2"): one geocoding search for
 * "name, city" inside a 1 km circle around the day's point, biased to that point, in English.
 * The run kept one candidate per place, the one whose name was closest and then nearest, and
 * of it only what is here: its names, its distance from the day's point, its result type and
 * its category. Its coordinates and its id were not kept, so `coverage-responses.ts` rebuilds
 * a response around these fields. Three Lisbon places were found by the run on the Places
 * endpoint, which the name check does not call (the area check of a café, restaurant or bar
 * does, by category rather than name, since day-v3); for them this holds the answer of the
 * first run's geocoding search for the same place, which found it within 8 m.
 *
 * Data © OpenStreetMap contributors, under the ODbL, provided by Geoapify (`NOTICE`).
 */

/** The candidate the run kept for a place. */
export interface RecordedCandidate {
  /** Every name the run read on it, its own first: the name, and the address line when it differed. */
  names: readonly string[];
  /** From the day's point, as the run measured it, in whole metres. */
  meters: number;
  resultType: string;
  category: string | null;
}

export interface RecordedLookup {
  city: string;
  /** The place as the day wrote it, which is what the run searched for. */
  place: PlaceToCheck;
  /** null when nothing came back inside the circle. */
  found: RecordedCandidate | null;
  /** Whether the run counted it a match: its name and distance, with no check of the category. */
  matchedByRun: boolean;
}

/**
 * The places the run's audit found confirmed as the wrong place: a bicycle rental named for
 * the walk, and probably another restaurant than the one the day meant.
 */
export const KNOWN_WRONG_MATCHES: readonly string[] = [
  "Gion Shirakawa",
  "Taberna da Rua das Flores",
];

/** One lookup per place of the written days, Kyoto's first, then Alicante's and Lisbon's. */
export const COVERAGE_RUN: readonly RecordedLookup[] = [
  {
    city: "Kyoto",
    place: {
      name: "Honen-in",
      kind: "sacred",
      neighborhood: "Shishigatani",
      coordinates: { lat: 35.0234, lng: 135.7974 },
    },
    found: { names: ["Hōnen Temple"], meters: 28, resultType: "amenity", category: null },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Philosopher's Path",
      kind: "walk",
      neighborhood: "Shishigatani",
      coordinates: { lat: 35.0234, lng: 135.7961 },
    },
    found: { names: ["Philosopher path"], meters: 384, resultType: "amenity", category: null },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Murin-an",
      kind: "garden",
      neighborhood: "Nanzen-ji",
      coordinates: { lat: 35.0116, lng: 135.7866 },
    },
    found: {
      names: ["Murin-an"],
      meters: 61,
      resultType: "amenity",
      category: "leisure.park.garden",
    },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Okutan Nanzenji",
      kind: "food",
      neighborhood: "Nanzen-ji",
      coordinates: { lat: 35.0124, lng: 135.7931 },
    },
    found: {
      names: ["Okutan Nanzenji"],
      meters: 5,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "National Museum of Modern Art, Kyoto",
      kind: "museum",
      neighborhood: "Okazaki",
      coordinates: { lat: 35.0124, lng: 135.7824 },
    },
    found: {
      names: ["The National Museum of Modern Art, Kyoto"],
      meters: 41,
      resultType: "amenity",
      category: "entertainment.museum",
    },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Kagizen Yoshifusa",
      kind: "coffee",
      neighborhood: "Gion",
      coordinates: { lat: 35.004, lng: 135.7747 },
    },
    found: null,
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Gion Shirakawa",
      kind: "walk",
      neighborhood: "Gion",
      coordinates: { lat: 35.0056, lng: 135.7745 },
    },
    found: {
      names: ["MODISH GION SHIRAKAWA"],
      meters: 181,
      resultType: "amenity",
      category: "rental.bicycle",
    },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Pontocho Masuda",
      kind: "food",
      neighborhood: "Pontocho",
      coordinates: { lat: 35.0058, lng: 135.7711 },
    },
    found: { names: ["Pontochō Alley"], meters: 37, resultType: "street", category: null },
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Shinnyo-do",
      kind: "sacred",
      neighborhood: "Jodoji",
      coordinates: { lat: 35.0211, lng: 135.7907 },
    },
    found: {
      names: ["Main Hall"],
      meters: 97,
      resultType: "amenity",
      category: "building.place_of_worship",
    },
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Daimonji Trail",
      kind: "walk",
      neighborhood: "Ginkakuji",
      coordinates: { lat: 35.0284, lng: 135.7985 },
    },
    found: {
      names: ["Daimonji Hitoko"],
      meters: 794,
      resultType: "amenity",
      category: "tourism.attraction.viewpoint",
    },
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Ginkaku-ji Approach",
      kind: "walk",
      neighborhood: "Ginkakuji",
      coordinates: { lat: 35.0272, lng: 135.7951 },
    },
    found: { names: ["Ginkaku-ji"], meters: 271, resultType: "amenity", category: null },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Konchi-in",
      kind: "garden",
      neighborhood: "Nanzen-ji",
      coordinates: { lat: 35.0109, lng: 135.7911 },
    },
    found: { names: ["Konchi Temple"], meters: 73, resultType: "amenity", category: null },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Nanzen-ji Hojo Garden",
      kind: "garden",
      neighborhood: "Nanzen-ji",
      coordinates: { lat: 35.0112, lng: 135.7942 },
    },
    found: null,
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Yachiyo",
      kind: "food",
      neighborhood: "Nanzen-ji",
      coordinates: { lat: 35.011, lng: 135.7889 },
    },
    found: {
      names: ["Yoshino"],
      meters: 32,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Nanzenji Junsei",
      kind: "food",
      neighborhood: "Nanzen-ji",
      coordinates: { lat: 35.0114, lng: 135.7899 },
    },
    found: {
      names: ["Junsei Nanzenji"],
      meters: 33,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Kyoto Museum of Crafts and Design",
      kind: "museum",
      neighborhood: "Okazaki",
      coordinates: { lat: 35.0129, lng: 135.781 },
    },
    found: null,
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Kyoto City KYOCERA Museum of Art",
      kind: "museum",
      neighborhood: "Okazaki",
      coordinates: { lat: 35.0129, lng: 135.783 },
    },
    found: {
      names: ["Kyoto City KYOCERA Museum of Art"],
      meters: 79,
      resultType: "amenity",
      category: "rental.bicycle",
    },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "ZEN CAFE",
      kind: "coffee",
      neighborhood: "Gion",
      coordinates: { lat: 35.003, lng: 135.7734 },
    },
    found: { names: ["Zen Café"], meters: 5, resultType: "amenity", category: "catering.cafe" },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Gion Tokuya",
      kind: "coffee",
      neighborhood: "Gion",
      coordinates: { lat: 35.0025, lng: 135.7749 },
    },
    found: {
      names: ["ぎおん徳屋"],
      meters: 1,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Ishibe-koji",
      kind: "walk",
      neighborhood: "Higashiyama",
      coordinates: { lat: 35.001, lng: 135.7787 },
    },
    found: { names: ["Ishibei-koji"], meters: 148, resultType: "street", category: null },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Hanamikoji",
      kind: "walk",
      neighborhood: "Gion",
      coordinates: { lat: 35.0037, lng: 135.7752 },
    },
    found: null,
    matchedByRun: false,
  },
  {
    city: "Kyoto",
    place: {
      name: "Mishima-tei",
      kind: "food",
      neighborhood: "Teramachi",
      coordinates: { lat: 35.0084, lng: 135.7671 },
    },
    found: {
      names: ["Mishima-tei"],
      meters: 4,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Kyoto",
    place: {
      name: "Gyoza Hohei",
      kind: "food",
      neighborhood: "Gion",
      coordinates: { lat: 35.0051, lng: 135.7749 },
    },
    found: {
      names: ["Gyoza Hohei"],
      meters: 38,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Playa del Postiguet",
      kind: "viewpoint",
      neighborhood: "Postiguet",
      coordinates: { lat: 38.3459, lng: -0.4776 },
    },
    found: { names: ["El Postiguet Beach"], meters: 133, resultType: "amenity", category: "beach" },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "Barrio de Santa Cruz",
      kind: "walk",
      neighborhood: "Casco Antiguo",
      coordinates: { lat: 38.3468, lng: -0.4797 },
    },
    found: {
      names: ["Mirador barrio Santa Cruz"],
      meters: 358,
      resultType: "amenity",
      category: "tourism.attraction",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Castillo de Santa Bárbara",
      kind: "architecture",
      neighborhood: "Benacantil",
      coordinates: { lat: 38.3456, lng: -0.4784 },
    },
    found: {
      names: ["Castell de Santa Bàrbara"],
      meters: 398,
      resultType: "amenity",
      category: "tourism.attraction",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Mercado Central",
      kind: "market",
      neighborhood: "Centro",
      coordinates: { lat: 38.3479, lng: -0.4875 },
    },
    found: {
      names: ["Alicante Central Market"],
      meters: 121,
      resultType: "amenity",
      category: "commercial.marketplace",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Restaurante Dársena",
      kind: "food",
      neighborhood: "Puerto",
      coordinates: { lat: 38.3412, lng: -0.48 },
    },
    found: {
      names: ["Dársena"],
      meters: 661,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "MACA",
      kind: "museum",
      neighborhood: "Casco Antiguo",
      coordinates: { lat: 38.3453, lng: -0.4808 },
    },
    found: {
      names: ["MACA - Museo de Arte Contemporáneo de Alicante"],
      meters: 164,
      resultType: "amenity",
      category: "entertainment.museum",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Explanada de España",
      kind: "walk",
      neighborhood: "Centro",
      coordinates: { lat: 38.3421, lng: -0.484 },
    },
    found: { names: ["Explanada de España"], meters: 131, resultType: "street", category: null },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Nou Manolín",
      kind: "bar",
      neighborhood: "Centro",
      coordinates: { lat: 38.3462, lng: -0.4869 },
    },
    found: {
      names: ["Nou Manolín"],
      meters: 185,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Paseo de Gomiz",
      kind: "walk",
      neighborhood: "Raval Roig",
      coordinates: { lat: 38.3489, lng: -0.4713 },
    },
    found: { names: ["Passeig de Gómiz"], meters: 425, resultType: "street", category: null },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Parque de la Ereta",
      kind: "garden",
      neighborhood: "Casco Antiguo",
      coordinates: { lat: 38.3481, lng: -0.4801 },
    },
    found: {
      names: ["Parc de l'Ereta"],
      meters: 94,
      resultType: "amenity",
      category: "leisure.park",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Calle Mayor",
      kind: "walk",
      neighborhood: "Casco Antiguo",
      coordinates: { lat: 38.3449, lng: -0.4823 },
    },
    found: { names: ["Carrer Major"], meters: 37, resultType: "street", category: null },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "MUBAG",
      kind: "museum",
      neighborhood: "Casco Antiguo",
      coordinates: { lat: 38.3449, lng: -0.4814 },
    },
    found: {
      names: ["Museo Bellas Artes Gravina"],
      meters: 170,
      resultType: "amenity",
      category: "entertainment.museum",
    },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "Rambla de Méndez Núñez",
      kind: "walk",
      neighborhood: "Centro",
      coordinates: { lat: 38.3455, lng: -0.4858 },
    },
    found: { names: ["Rambla de Méndez Núñez"], meters: 195, resultType: "street", category: null },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Plaza de los Luceros",
      kind: "coffee",
      neighborhood: "Centro",
      coordinates: { lat: 38.3466, lng: -0.4905 },
    },
    found: {
      names: ["Plaça dels Estels"],
      meters: 67,
      resultType: "amenity",
      category: "leisure.park.garden",
    },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "Calle Castaños",
      kind: "bar",
      neighborhood: "Centro",
      coordinates: { lat: 38.3457, lng: -0.4864 },
    },
    found: { names: ["Carrer de Castaños"], meters: 151, resultType: "street", category: null },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Monastrell",
      kind: "food",
      neighborhood: "Puerto",
      coordinates: { lat: 38.3405, lng: -0.4825 },
    },
    found: { names: ["Alicante"], meters: 605, resultType: "city", category: "administrative" },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "La Taberna del Gourmet",
      kind: "food",
      neighborhood: "Centro",
      coordinates: { lat: 38.3447, lng: -0.4842 },
    },
    found: {
      names: ["La Taberna del Gourmet"],
      meters: 225,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "Plaza de Santa María",
      kind: "coffee",
      neighborhood: "Casco Antiguo",
      coordinates: { lat: 38.3457, lng: -0.4799 },
    },
    found: {
      names: ["Plaça de Santa Maria / Plaza de Santa María"],
      meters: 43,
      resultType: "street",
      category: null,
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Parque de Canalejas",
      kind: "garden",
      neighborhood: "Centro",
      coordinates: { lat: 38.3412, lng: -0.4878 },
    },
    found: {
      names: ["Parc de Canalejas"],
      meters: 98,
      resultType: "amenity",
      category: "leisure.park",
    },
    matchedByRun: true,
  },
  {
    city: "Alicante",
    place: {
      name: "Antiu Xixona",
      kind: "food",
      neighborhood: "Centro",
      coordinates: { lat: 38.3427, lng: -0.4845 },
    },
    found: { names: ["Alicante"], meters: 337, resultType: "city", category: "administrative" },
    matchedByRun: false,
  },
  {
    city: "Alicante",
    place: {
      name: "Piripi",
      kind: "food",
      neighborhood: "Ensanche",
      coordinates: { lat: 38.3448, lng: -0.4935 },
    },
    found: {
      names: ["Piripi"],
      meters: 284,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: false,
  },
  {
    city: "Lisbon",
    place: {
      name: "Feira da Ladra",
      kind: "market",
      neighborhood: "São Vicente",
      coordinates: { lat: 38.7154, lng: -9.1259 },
    },
    found: {
      names: ["Urinol Público Masculino do Chão da Feira"],
      meters: 615,
      resultType: "amenity",
      category: "amenity.toilet",
    },
    matchedByRun: false,
  },
  {
    city: "Lisbon",
    place: {
      name: "Mosteiro de São Vicente de Fora",
      kind: "sacred",
      neighborhood: "São Vicente",
      coordinates: { lat: 38.7148, lng: -9.1279 },
    },
    found: {
      names: ["Museu de São Vicente de Fora"],
      meters: 3,
      resultType: "amenity",
      category: "entertainment.museum",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Cantinho do Aziz",
      kind: "food",
      neighborhood: "Mouraria",
      coordinates: { lat: 38.7142, lng: -9.1356 },
    },
    found: {
      names: ["Cantinho do Aziz"],
      meters: 4,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Convento do Carmo",
      kind: "architecture",
      neighborhood: "Chiado",
      coordinates: { lat: 38.712, lng: -9.1406 },
    },
    found: {
      names: ["Museu Arqueológico do Carmo"],
      meters: 1,
      resultType: "amenity",
      category: "entertainment.museum",
    },
    matchedByRun: true,
  },
  // Geocoded in the first run; the second found it on the Places endpoint.
  {
    city: "Lisbon",
    place: {
      name: "Miradouro de Santa Catarina",
      kind: "viewpoint",
      neighborhood: "Santa Catarina",
      coordinates: { lat: 38.7095, lng: -9.1477 },
    },
    found: {
      names: ["Miradouro de Santa Catarina"],
      meters: 6,
      resultType: "amenity",
      category: "tourism.attraction.viewpoint",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "A Vida Portuguesa",
      kind: "shop",
      neighborhood: "Chiado",
      coordinates: { lat: 38.7101, lng: -9.1392 },
    },
    found: {
      names: ["A Vida Portuguesa"],
      meters: 4,
      resultType: "amenity",
      category: "commercial.books",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Taberna da Rua das Flores",
      kind: "food",
      neighborhood: "Chiado",
      coordinates: { lat: 38.7101, lng: -9.1436 },
    },
    found: {
      names: ["Das Flores"],
      meters: 93,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Rua da Atalaia",
      kind: "walk",
      neighborhood: "Bairro Alto",
      coordinates: { lat: 38.7107, lng: -9.145 },
    },
    found: { names: ["Rua da Atalaia"], meters: 230, resultType: "street", category: null },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Mercado de Sapadores",
      kind: "market",
      neighborhood: "Graça",
      coordinates: { lat: 38.7218, lng: -9.129 },
    },
    found: {
      names: ["Mercado de Sapadores"],
      meters: 3,
      resultType: "amenity",
      category: "commercial.marketplace",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Panteão Nacional",
      kind: "sacred",
      neighborhood: "São Vicente",
      coordinates: { lat: 38.715, lng: -9.1247 },
    },
    found: { names: ["Panteão Nacional"], meters: 3, resultType: "amenity", category: null },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Sé de Lisboa",
      kind: "sacred",
      neighborhood: "Sé",
      coordinates: { lat: 38.7098, lng: -9.1328 },
    },
    found: {
      names: ["Sé de Lisboa"],
      meters: 33,
      resultType: "amenity",
      category: "building.residential",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Zambeze",
      kind: "food",
      neighborhood: "Mouraria",
      coordinates: { lat: 38.7123, lng: -9.135 },
    },
    found: {
      names: ["Zambeze"],
      meters: 5,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Cervejaria Ramiro",
      kind: "food",
      neighborhood: "Intendente",
      coordinates: { lat: 38.7202, lng: -9.1357 },
    },
    found: {
      names: ["Cervejaria Ramiro"],
      meters: 1,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Igreja de São Roque",
      kind: "sacred",
      neighborhood: "Bairro Alto",
      coordinates: { lat: 38.7136, lng: -9.1434 },
    },
    found: { names: ["Igreja de São Roque"], meters: 3, resultType: "amenity", category: null },
    matchedByRun: true,
  },
  // Geocoded in the first run; the second found it on the Places endpoint.
  {
    city: "Lisbon",
    place: {
      name: "Elevador de Santa Justa",
      kind: "architecture",
      neighborhood: "Baixa",
      coordinates: { lat: 38.7121, lng: -9.1394 },
    },
    found: {
      names: ["Santa Justa Lift"],
      meters: 2,
      resultType: "amenity",
      category: "tourism.attraction",
    },
    matchedByRun: true,
  },
  // Geocoded in the first run; the second found it on the Places endpoint.
  {
    city: "Lisbon",
    place: {
      name: "Miradouro de São Pedro de Alcântara",
      kind: "viewpoint",
      neighborhood: "Bairro Alto",
      coordinates: { lat: 38.7155, lng: -9.144 },
    },
    found: {
      names: ["Miradouro de São Pedro de Alcântara"],
      meters: 8,
      resultType: "amenity",
      category: "tourism.attraction.viewpoint",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Park",
      kind: "bar",
      neighborhood: "Bairro Alto",
      coordinates: { lat: 38.7112, lng: -9.1476 },
    },
    found: { names: ["Park Rooftop"], meters: 1, resultType: "amenity", category: "catering.bar" },
    matchedByRun: false,
  },
  {
    city: "Lisbon",
    place: {
      name: "Livraria Bertrand",
      kind: "shop",
      neighborhood: "Chiado",
      coordinates: { lat: 38.7107, lng: -9.1412 },
    },
    found: {
      names: ["Livraria Bertrand - Chiado"],
      meters: 6,
      resultType: "amenity",
      category: "commercial.books",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Armazéns do Chiado",
      kind: "shop",
      neighborhood: "Chiado",
      coordinates: { lat: 38.711, lng: -9.1394 },
    },
    found: {
      names: ["Armazéns do Chiado"],
      meters: 1,
      resultType: "amenity",
      category: "commercial.shopping_mall",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Cantinho do Avillez",
      kind: "food",
      neighborhood: "Chiado",
      coordinates: { lat: 38.7087, lng: -9.1421 },
    },
    found: {
      names: ["Cantinho do Avillez"],
      meters: 4,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Sol e Pesca",
      kind: "food",
      neighborhood: "Cais do Sodré",
      coordinates: { lat: 38.7073, lng: -9.1438 },
    },
    found: {
      names: ["Sol e Pesca"],
      meters: 1,
      resultType: "amenity",
      category: "catering.restaurant",
    },
    matchedByRun: true,
  },
  {
    city: "Lisbon",
    place: {
      name: "Rua Garrett",
      kind: "walk",
      neighborhood: "Chiado",
      coordinates: { lat: 38.7106, lng: -9.1423 },
    },
    found: { names: ["Rua Garrett"], meters: 30, resultType: "street", category: null },
    matchedByRun: true,
  },
];
