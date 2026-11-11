import type { PlaceCheck } from "@/lib/places/verify-place";

/**
 * Each city day's place checks from the run that wrote it, on 2026-11-11, as Geoapify answered
 * them then (`docs/grounding.md`), recorded as the starts' are (`checks.ts`): a meal by its area,
 * any other place by its name, a place confirmed by name with the provider's point, and only the
 * places the normalizer keeps. Keyed by the city, then by the id the normalizer gives each place.
 * Written from the place round's records of the `city-days` rounds, each day's generation named
 * above its checks.
 *
 * Data © OpenStreetMap contributors, under the ODbL, provided by Geoapify (`NOTICE`).
 */
export const CITY_PLACE_CHECKS: Readonly<Record<string, Readonly<Record<string, PlaceCheck>>>> = {
  // city-days, generation 3f89d5cf-0129-46dd-90c2-22c0cf23129e, 2026-11-15
  Paris: {
    // Coffee on Rue des Francs-Bourgeois
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 48.8571,
      lng: 2.3589,
      placesAround: 20,
      source: "geoapify",
    },
    // Musée Carnavalet
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 48.8573232,
      lng: 2.3624734,
      providerId:
        "51025c357458e6024059110d41c4bc6d4840f00101f90143b6240000000000c002019203114361726e6176616c6574204d757365756d",
      source: "geoapify",
    },
    // Lunch around Place des Vosges
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 48.8556,
      lng: 2.3655,
      placesAround: 20,
      source: "geoapify",
    },
    // Place des Vosges
    "stop-3:p": { kind: "unverified", reason: "no-match" },
    // Walk along the Île Saint-Louis
    "stop-4:p": { kind: "unverified", reason: "timeout" },
    // Dinner on Rue Mouffetard
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 48.8431,
      lng: 2.3503,
      placesAround: 20,
      source: "geoapify",
    },
    // Rue de Bretagne market coffee
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 48.8636,
      lng: 2.3613,
      placesAround: 20,
      source: "geoapify",
    },
    // Hôtel de Sully garden
    "stop-1:a1": {
      kind: "verified",
      by: "name",
      lat: 48.854403,
      lng: 2.363695,
      providerId:
        "51f0bf95ecd8e8024059594dd7135d6d4840f00101f901ca26060000000000c0020192030f48c3b474656c2064652053756c6c79e203236f70656e7374726565746d61703a76656e75653a72656c6174696f6e2f343033313436",
      source: "geoapify",
    },
    // Tea and tarts on Rue de Turenne
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 48.8587,
      lng: 2.3625,
      placesAround: 8,
      source: "geoapify",
    },
    // Falafel on Rue des Rosiers
    "stop-2:a2": {
      kind: "verified",
      by: "area",
      lat: 48.8573,
      lng: 2.3597,
      placesAround: 20,
      source: "geoapify",
    },
    // Jardin des Archives Nationales
    "stop-3:a1": {
      kind: "verified",
      by: "name",
      lat: 48.8599704,
      lng: 2.3587022,
      providerId:
        "51a90650429fde02405997c39382136e4840f00102f901b450df1400000000c0020192031e4a617264696e206465732041726368697665732d4e6174696f6e616c6573",
      source: "geoapify",
    },
    // Rue Vieille du Temple
    "stop-3:a2": {
      kind: "verified",
      by: "name",
      lat: 48.8607134,
      lng: 2.3621569,
      providerId:
        "517b2a4c84b2e50240594f1d50db2b6e4840f00102f9015ca4b50100000000c0020492031552756520566965696c6c652064752054656d706c65",
      source: "geoapify",
    },
    // Quai de Montebello
    "stop-4:a2": {
      kind: "verified",
      by: "name",
      lat: 48.8518802,
      lng: 2.349325,
      providerId:
        "51cf66d5e76acb024059128e0f690a6d4840f00102f901c3a43d0000000000c0020492031251756169206465204d6f6e746562656c6c6f",
      source: "geoapify",
    },
  },
  // city-days, generation 617b5ccd-9bc9-486f-9b9e-2f9f7f93a859, 2026-11-14
  Tokyo: {
    // Tsukiji Outer Market
    "stop-0:p": {
      kind: "verified",
      by: "name",
      lat: 35.6653884,
      lng: 139.7704732,
      providerId:
        "51398e69b7a778614059a29174722bd54140f00102f901f4c12d2400000000c002019203145473756b696a69204f75746572204d61726b6574",
      source: "geoapify",
    },
    // Coffee on Harumi-dori
    "stop-1:p": {
      kind: "verified",
      by: "area",
      lat: 35.6703,
      lng: 139.7667,
      placesAround: 20,
      source: "geoapify",
    },
    // Senso-ji
    "stop-2:p": {
      kind: "verified",
      by: "name",
      lat: 35.71475,
      lng: 139.7968,
      providerId:
        "517daeb6627f79614059736891ed7cdb4140c0020192030953656e73c58d204a69e2031767656f6e616d65733a76656e75653a3130393636373037",
      source: "geoapify",
    },
    // Soba and tempura on Kappabashi-dori
    "stop-3:p": {
      kind: "verified",
      by: "area",
      lat: 35.7143,
      lng: 139.7889,
      placesAround: 15,
      source: "geoapify",
    },
    // Sumida Park
    "stop-4:p": {
      kind: "verified",
      by: "name",
      lat: 35.711892,
      lng: 139.801181,
      providerId:
        "51a7255646a3796140595b24ed461fdb4140c0020492031153756d6964612052697665722057616c6be203266f70656e7374726565746d61703a7374726565743a706f6c796c696e653a3138363835303435",
      source: "geoapify",
    },
    // Ameyoko Shopping Street
    "stop-5:p": { kind: "unverified", reason: "no-match" },
    // Beer by the Yurakucho Tracks
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 35.6745,
      lng: 139.7633,
      placesAround: 20,
      source: "geoapify",
    },
    // Yakitori and izakaya under the Yurakucho arches
    "stop-7:p": {
      kind: "verified",
      by: "area",
      lat: 35.6741,
      lng: 139.7628,
      placesAround: 20,
      source: "geoapify",
    },
    // Tea on Tsukiji Hongan-ji Temple Grounds
    "stop-1:a1": {
      kind: "verified",
      by: "area",
      lat: 35.6671,
      lng: 139.7725,
      placesAround: 11,
      source: "geoapify",
    },
    // Breakfast Sets by Tsukiji Station
    "stop-1:a2": {
      kind: "verified",
      by: "area",
      lat: 35.6679,
      lng: 139.7686,
      placesAround: 20,
      source: "geoapify",
    },
    // Kinryuzan Garden Path
    "stop-2:a1": { kind: "unverified", reason: "no-match" },
    // Nakamise-dori
    "stop-2:a2": { kind: "unverified", reason: "no-match" },
    // Tea and Sweets near Kototoi-dori
    "stop-3:a1": {
      kind: "verified",
      by: "area",
      lat: 35.7128,
      lng: 139.7938,
      placesAround: 20,
      source: "geoapify",
    },
    // Izakaya Lanes near Hoppy-dori
    "stop-3:a2": {
      kind: "verified",
      by: "area",
      lat: 35.7117,
      lng: 139.7933,
      placesAround: 20,
      source: "geoapify",
    },
    // Ueno Park Paths
    "stop-5:a1": { kind: "unverified", reason: "no-match" },
    // Standing Bars by Ueno Station
    "stop-5:a2": {
      kind: "verified",
      by: "area",
      lat: 35.7117,
      lng: 139.777,
      placesAround: 20,
      source: "geoapify",
    },
    // Hibiya Park Paths
    "stop-6:a1": { kind: "unverified", reason: "no-match" },
    // Sushi Counters in Ginza
    "stop-7:a1": {
      kind: "verified",
      by: "area",
      lat: 35.6717,
      lng: 139.764,
      placesAround: 20,
      source: "geoapify",
    },
    // Ramen on Ginza Backstreets
    "stop-7:a2": {
      kind: "verified",
      by: "area",
      lat: 35.6702,
      lng: 139.7621,
      placesAround: 20,
      source: "geoapify",
    },
  },
  // city-days, generation 84123154-b2d9-4e77-85a3-e5bfc416daad, 2026-11-14
  Rome: {
    // Cornetti on Via Leonina
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 41.8955,
      lng: 12.4893,
      placesAround: 12,
      source: "geoapify",
    },
    // Roman Forum and Palatine Hill
    "stop-1:p": { kind: "unverified", reason: "no-match" },
    // Pizza al taglio around Campo de' Fiori
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 41.8956,
      lng: 12.4722,
      placesAround: 20,
      source: "geoapify",
    },
    // Piazza Navona and Sant'Agnese in Agone
    "stop-3:p": { kind: "unverified", reason: "no-match" },
    // Villa Farnesina and Lungotevere
    "stop-4:p": {
      kind: "verified",
      by: "name",
      lat: 41.89388,
      lng: 12.467777,
      providerId:
        "5159a4897780ef2840593546eba86af24440c0020492031b4c756e676f7465766572652064656c6c61204661726e6573696e61e203266f70656e7374726565746d61703a7374726565743a706f6c796c696e653a3333363534303630",
      source: "geoapify",
    },
    // Aperitivo along Via della Lungaretta
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 41.8895,
      lng: 12.4699,
      placesAround: 11,
      source: "geoapify",
    },
    // Cacio e pepe in Trastevere lanes
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 41.8897,
      lng: 12.4694,
      placesAround: 20,
      source: "geoapify",
    },
    // Coffee in Piazza della Madonna dei Monti
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 41.8949,
      lng: 12.4942,
      placesAround: 13,
      source: "geoapify",
    },
    // Colazione on Via Cavour
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 41.8957,
      lng: 12.4925,
      placesAround: 20,
      source: "geoapify",
    },
    // Colosseum interior
    "stop-1:a2": {
      kind: "verified",
      by: "name",
      lat: 41.89018,
      lng: 12.49231,
      providerId:
        "51cefc6a0e10fc284059d2c6116bf1f14440c00201920309436f6c6f737365756de2031667656f6e616d65733a76656e75653a36323639323438",
      source: "geoapify",
    },
    // Trattorie on Via dei Cappellari
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 41.8946,
      lng: 12.4709,
      placesAround: 20,
      source: "geoapify",
    },
    // Pantheon
    "stop-3:a1": {
      kind: "verified",
      by: "name",
      lat: 41.898616,
      lng: 12.4768334,
      providerId:
        "51ee47e58123f4284059c7d45dd905f34440f00101f901067d330000000000c0020192030850616e7468656f6e",
      source: "geoapify",
    },
    // Piazza Farnese
    "stop-3:a2": {
      kind: "verified",
      by: "name",
      lat: 41.8950608,
      lng: 12.4712585,
      providerId:
        "518dec4acb48f12840593ff72f5a91f24440f00102f9015b5b5e0100000000c0020192030e5069617a7a61204661726e657365",
      source: "geoapify",
    },
    // Orto Botanico di Roma
    "stop-4:a1": {
      kind: "verified",
      by: "name",
      lat: 41.8914273,
      lng: 12.4635272,
      providerId:
        "51e79ce96f53ed2840597b212e4a1af24440f00101f901a44aaf0000000000c00201920310426f74616e6963616c2047617264656e",
      source: "geoapify",
    },
    // Piazza di Santa Maria in Trastevere
    "stop-4:a2": {
      kind: "verified",
      by: "name",
      lat: 41.8897404,
      lng: 12.4703225,
      providerId:
        "515b25581ccef028405909f76f03e3f14440f00102f901adc7260c00000000c002049203235069617a7a612064692053616e7461204d6172696120696e2054726173746576657265",
      source: "geoapify",
    },
    // Wine on Via della Scala
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 41.8911,
      lng: 12.4694,
      placesAround: 13,
      source: "geoapify",
    },
    // Spritz around Piazza Trilussa
    "stop-5:a2": {
      kind: "verified",
      by: "area",
      lat: 41.8898,
      lng: 12.4713,
      placesAround: 10,
      source: "geoapify",
    },
    // Osterie on Via del Moro
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 41.8886,
      lng: 12.4708,
      placesAround: 20,
      source: "geoapify",
    },
    // Pizzerie on Via della Paglia
    "stop-6:a2": {
      kind: "verified",
      by: "area",
      lat: 41.8903,
      lng: 12.4688,
      placesAround: 20,
      source: "geoapify",
    },
  },
  // city-days, generation 8e758373-f18d-4090-9d9d-d1671c825cf1, 2026-11-14
  "New York": {
    // Coffee on Bleecker Street
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 40.7335,
      lng: -74.0035,
      placesAround: 16,
      source: "geoapify",
    },
    // Washington Square Park
    "stop-1:p": { kind: "unverified", reason: "no-match" },
    // Chelsea Market
    "stop-2:p": { kind: "unverified", reason: "no-match" },
    // West Chelsea Galleries
    "stop-3:p": { kind: "unverified", reason: "no-match" },
    // The High Line
    "stop-4:p": {
      kind: "verified",
      by: "name",
      lat: 40.7477038,
      lng: -74.0048912,
      providerId:
        "5172022e23508052c059260c14c2b45f4440f00101f90177f96c0000000000c0020192030d5468652048696768204c696e65",
      source: "geoapify",
    },
    // Wine on Bleecker and Jones
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 40.7326,
      lng: -74.0043,
      placesAround: 17,
      source: "geoapify",
    },
    // Dinner along East 6th Street
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 40.7286,
      lng: -73.9892,
      placesAround: 19,
      source: "geoapify",
    },
    // Drinks on Avenue A
    "stop-7:p": {
      kind: "verified",
      by: "area",
      lat: 40.7265,
      lng: -73.9815,
      placesAround: 20,
      source: "geoapify",
    },
    // Coffee on Christopher Street
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 40.7333,
      lng: -74.0044,
      placesAround: 15,
      source: "geoapify",
    },
    // Brunch on Bleecker and MacDougal
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 40.7298,
      lng: -74.0005,
      placesAround: 20,
      source: "geoapify",
    },
    // Mercer Street
    "stop-1:a1": {
      kind: "verified",
      by: "name",
      lat: 40.7284056,
      lng: -73.9954104,
      providerId:
        "514a86d2cdb47f52c059941c0b653c5d4440f00102f9010b85800100000000c0020492030d4d657263657220537472656574",
      source: "geoapify",
    },
    // Bleecker Street Playground and Sixth Avenue
    "stop-1:a2": { kind: "unverified", reason: "no-match" },
    // Hudson River Park at Pier 57
    "stop-2:a1": {
      kind: "verified",
      by: "name",
      lat: 40.743145,
      lng: -74.008941,
      providerId:
        "51fca5457d928052c059cc9717601f5f4440c0020492030750696572203537e203266f70656e7374726565746d61703a7374726565743a706f6c796c696e653a3134373030393931",
      source: "geoapify",
    },
    // Tacos on Ninth Avenue
    "stop-2:a2": {
      kind: "verified",
      by: "area",
      lat: 40.7418,
      lng: -74.0044,
      placesAround: 20,
      source: "geoapify",
    },
    // Tenth Avenue Gallery Openings
    "stop-3:a2": { kind: "unverified", reason: "no-match" },
    // Hudson Yards Terrace
    "stop-4:a1": { kind: "unverified", reason: "no-match" },
    // Tea on Perry Street
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 40.7353,
      lng: -74.0057,
      placesAround: 12,
      source: "geoapify",
    },
    // Cocktails on Hudson Street
    "stop-5:a2": {
      kind: "verified",
      by: "area",
      lat: 40.734,
      lng: -74.006,
      placesAround: 12,
      source: "geoapify",
    },
    // Dinner on East 7th Street
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 40.7275,
      lng: -73.984,
      placesAround: 20,
      source: "geoapify",
    },
    // Dumplings on St. Marks Place
    "stop-6:a2": {
      kind: "verified",
      by: "area",
      lat: 40.7295,
      lng: -73.988,
      placesAround: 20,
      source: "geoapify",
    },
    // Quiet Cocktails on East 9th Street
    "stop-7:a1": {
      kind: "verified",
      by: "area",
      lat: 40.7279,
      lng: -73.9855,
      placesAround: 20,
      source: "geoapify",
    },
  },
  // city-days, generation 12218de8-0954-4e56-889b-48740db747f7, 2026-11-15
  Amsterdam: {
    // Coffee along Prinsengracht
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 52.3745,
      lng: 4.8838,
      placesAround: 10,
      source: "geoapify",
    },
    // Westerkerk
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 52.3745473,
      lng: 4.8839863,
      providerId:
        "51bc7262b433891340590e277a2af12f4a40f00102f90189c0e90500000000c0020192030a5765737465726b65726b",
      source: "geoapify",
    },
    // Pancakes along Prinsengracht
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 52.3735,
      lng: 4.8832,
      placesAround: 20,
      source: "geoapify",
    },
    // Hortus Botanicus
    "stop-3:p": {
      kind: "verified",
      by: "name",
      lat: 52.366806,
      lng: 4.9077777,
      providerId:
        "510327367a90a113405900fdbe7ff32e4a40f00102f901a710e10100000000c00201920310486f7274757320426f74616e69637573",
      source: "geoapify",
    },
    // Hot chocolate on Plantage Middenlaan
    "stop-4:p": {
      kind: "verified",
      by: "area",
      lat: 52.3665,
      lng: 4.9092,
      placesAround: 4,
      source: "geoapify",
    },
    // Indonesian rijsttafel in the Plantage
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 52.367,
      lng: 4.91,
      placesAround: 12,
      source: "geoapify",
    },
    // Café quay on Bloemgracht
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 52.3733,
      lng: 4.8808,
      placesAround: 9,
      source: "geoapify",
    },
    // Coffee on Westermarkt
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 52.3757,
      lng: 4.8843,
      placesAround: 13,
      source: "geoapify",
    },
    // Begijnhof
    "stop-1:a1": { kind: "unverified", reason: "no-match" },
    // Noordermarkt
    "stop-1:a2": { kind: "unverified", reason: "no-match" },
    // Soup on Lindengracht
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 52.379,
      lng: 4.8815,
      placesAround: 20,
      source: "geoapify",
    },
    // Fries along Singel
    "stop-2:a2": {
      kind: "verified",
      by: "area",
      lat: 52.3735,
      lng: 4.8905,
      placesAround: 20,
      source: "geoapify",
    },
    // Hermitage Amsterdam
    "stop-3:a1": {
      kind: "verified",
      by: "name",
      lat: 52.36535,
      lng: 4.90286,
      providerId:
        "515c77f354879c134059fbcbeec9c32e4a40c002019203134865726d697461676520416d7374657264616de2031667656f6e616d65733a76656e75653a36393531373339",
      source: "geoapify",
    },
    // Artis Royal Zoo
    "stop-3:a2": { kind: "unverified", reason: "no-match" },
    // Tea at Hortus entrance
    "stop-4:a1": { kind: "unverified", reason: "too-few-places" },
    // Pastries on Weesperstraat
    "stop-4:a2": {
      kind: "verified",
      by: "area",
      lat: 52.365,
      lng: 4.9068,
      placesAround: 3,
      source: "geoapify",
    },
    // Soup on Plantage Kerklaan
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 52.3664,
      lng: 4.9115,
      placesAround: 12,
      source: "geoapify",
    },
    // Burgers along Weesperplein
    "stop-5:a2": {
      kind: "verified",
      by: "area",
      lat: 52.3645,
      lng: 4.9075,
      placesAround: 5,
      source: "geoapify",
    },
  },
  // city-days, generation c9053524-fb1a-45b0-9709-aa6ec588caf8, 2026-11-14
  Barcelona: {
    // Coffee on Carrer del Rec
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 41.3854,
      lng: 2.1826,
      placesAround: 18,
      source: "geoapify",
    },
    // Museu Picasso
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 41.3851039,
      lng: 2.1812015,
      providerId:
        "519fe3a3c51973014059f107a8154bb14440f00102f90111f7420b00000000c0020192030e5069636173736f204d757365756d",
      source: "geoapify",
    },
    // Mercat de Santa Caterina
    "stop-2:p": {
      kind: "verified",
      by: "name",
      lat: 41.3861363,
      lng: 2.1785048,
      providerId:
        "51a26eb1ec936d01405933260eea6cb14440f00102f90156a0e70100000000c002019203184d65726361742064652053616e7461204361746572696e61",
      source: "geoapify",
    },
    // Carrer del Bisbe and Plaça Sant Felip Neri
    "stop-3:p": { kind: "unverified", reason: "no-match" },
    // Parc de la Ciutadella
    "stop-4:p": {
      kind: "verified",
      by: "name",
      lat: 41.388416,
      lng: 2.1862546,
      providerId:
        "5124d63d0d737d0140591f9f909db7b14440f00101f9016724040000000000c0020192031550617263206465206c6120436975746164656c6c61",
      source: "geoapify",
    },
    // Vermouth along Carrer de la Princesa
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 41.3846,
      lng: 2.1813,
      placesAround: 20,
      source: "geoapify",
    },
    // Passeig de Gràcia
    "stop-6:p": {
      kind: "verified",
      by: "name",
      lat: 41.3917422,
      lng: 2.1654245,
      providerId:
        "513fa88b14ca5201405947bbc09b24b24440f00102f9010cee831100000000c0020492031250617373656967206465204772c3a0636961",
      source: "geoapify",
    },
    // Tapas around Plaça de la Vila de Gràcia
    "stop-7:p": {
      kind: "verified",
      by: "area",
      lat: 41.4005,
      lng: 2.1573,
      placesAround: 20,
      source: "geoapify",
    },
    // Cocktails and beer along Carrer de Joaquín Costa
    "stop-8:p": {
      kind: "verified",
      by: "area",
      lat: 41.3815,
      lng: 2.1695,
      placesAround: 18,
      source: "geoapify",
    },
    // Coffee in Plaça de Sant Agustí Vell
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 41.3868,
      lng: 2.1822,
      placesAround: 13,
      source: "geoapify",
    },
    // Coffee on Passeig del Born
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 41.3846,
      lng: 2.1833,
      placesAround: 19,
      source: "geoapify",
    },
    // Basilica de Santa Maria del Mar
    "stop-1:a1": {
      kind: "verified",
      by: "name",
      lat: 41.3837802,
      lng: 2.1820062,
      providerId:
        "51985aa5aabf7401405919eda7b51fb14440f00102f901372b0e0300000000c0020192031353616e7461204d617269612064656c204d6172",
      source: "geoapify",
    },
    // Born Centre de Cultura i Memòria
    "stop-1:a2": { kind: "unverified", reason: "no-match" },
    // Plaça de Santa Maria
    "stop-2:a1": {
      kind: "verified",
      by: "name",
      lat: 41.3834198,
      lng: 2.1818201,
      providerId:
        "51290bba185e74014059c6d166e613b14440f00102f901030f560100000000c00201920315506c61c3a7612064652053616e7461204d61726961",
      source: "geoapify",
    },
    // Bar-hopping on Carrer dels Banys Vells
    "stop-2:a2": {
      kind: "verified",
      by: "area",
      lat: 41.3846,
      lng: 2.1803,
      placesAround: 20,
      source: "geoapify",
    },
    // Plaça del Rei
    "stop-3:a1": {
      kind: "verified",
      by: "name",
      lat: 41.3841563,
      lng: 2.1773945,
      providerId:
        "5114ecbfce4d6b014059b4869c082cb14440f00101f90188781d0100000000c0020192030e506c61c3a7612064656c20526569",
      source: "geoapify",
    },
    // Carrer d'Avinyó
    "stop-3:a2": { kind: "unverified", reason: "no-match" },
    // Hivernacle del Parc de la Ciutadella
    "stop-4:a1": { kind: "unverified", reason: "no-match" },
    // Wine in Plaça de les Olles
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 41.3832,
      lng: 2.1827,
      placesAround: 20,
      source: "geoapify",
    },
    // Cocktails along Carrer dels Assaonadors
    "stop-5:a2": {
      kind: "verified",
      by: "area",
      lat: 41.3856,
      lng: 2.1815,
      placesAround: 20,
      source: "geoapify",
    },
    // Rambla de Catalunya
    "stop-6:a2": {
      kind: "verified",
      by: "name",
      lat: 41.3915653,
      lng: 2.1629302,
      providerId:
        "51f43e4459ae4d014059cddfcecf1eb24440f00102f9015f641e2800000000c0020492031352616d626c6120646520436174616c756e7961",
      source: "geoapify",
    },
    // Plaça del Sol
    "stop-7:a1": {
      kind: "verified",
      by: "area",
      lat: 41.4012,
      lng: 2.1569,
      placesAround: 20,
      source: "geoapify",
    },
    // Carrer de Verdi
    "stop-7:a2": {
      kind: "verified",
      by: "area",
      lat: 41.4035,
      lng: 2.1565,
      placesAround: 20,
      source: "geoapify",
    },
    // Wine on Carrer del Doctor Dou
    "stop-8:a1": {
      kind: "verified",
      by: "area",
      lat: 41.3825,
      lng: 2.1702,
      placesAround: 19,
      source: "geoapify",
    },
    // Dancing around Carrer de Nou de la Rambla
    "stop-8:a2": {
      kind: "verified",
      by: "area",
      lat: 41.379,
      lng: 2.1738,
      placesAround: 20,
      source: "geoapify",
    },
  },
  // city-days, generation 59e63a5c-3ae5-4bab-bdbb-9e917fb1cd8f, 2026-11-13
  Seoul: {
    // Coffee on Jahamun-ro 7-gil
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 37.5795,
      lng: 126.9712,
      placesAround: 20,
      source: "geoapify",
    },
    // Gyeongbokgung Palace
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 37.579754,
      lng: 126.9766818,
      providerId:
        "514c6661f481be5f4059d3dc0a6135ca4240f00101f9014df2530000000000c002019203144779656f6e67626f6b67756e672050616c616365",
      source: "geoapify",
    },
    // Mandu and noodles along Insadong-gil
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 37.5741,
      lng: 126.9857,
      placesAround: 19,
      source: "geoapify",
    },
    // Ikseon-dong Hanok Village
    "stop-3:p": { kind: "unverified", reason: "no-match" },
    // Cheonggyecheon Stream
    "stop-4:p": { kind: "unverified", reason: "no-match" },
    // Grilled pork along Jongno 3-ga alleys
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 37.5714,
      lng: 126.9916,
      placesAround: 20,
      source: "geoapify",
    },
    // Euljiro Hip-jiro Alleys
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 37.5663,
      lng: 126.9919,
      placesAround: 20,
      source: "geoapify",
    },
    // Late-night tteokbokki by Myeongdong Gil
    "stop-7:p": {
      kind: "verified",
      by: "area",
      lat: 37.5636,
      lng: 126.9853,
      placesAround: 20,
      source: "geoapify",
    },
    // Tongin Market
    "stop-0:a1": {
      kind: "verified",
      by: "name",
      lat: 37.5807552,
      lng: 126.9699963,
      providerId:
        "516d6f5c6b14be5f4059b07db72f56ca4240f00102f90198b84e1200000000c0020192030d546f6e67696e204d61726b6574",
      source: "geoapify",
    },
    // Seochon Hanok Lanes
    "stop-1:a1": { kind: "unverified", reason: "no-match" },
    // Tea houses along Insadong Tea Alley
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5747,
      lng: 126.9847,
      placesAround: 20,
      source: "geoapify",
    },
    // Jogyesa Temple
    "stop-3:a1": {
      kind: "verified",
      by: "name",
      lat: 37.5741432,
      lng: 126.981912,
      providerId:
        "5132e36da5d7be5f4059439c3d867dc94240f00102f901211d4d0d00000000c0020192030e4a6f67796573612054656d706c65",
      source: "geoapify",
    },
    // Nakwon Instrument Arcade
    "stop-3:a2": { kind: "unverified", reason: "no-match" },
    // Bibimbap and soup near Jongno 3-ga
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5709,
      lng: 126.9906,
      placesAround: 20,
      source: "geoapify",
    },
    // Pojangmacha along Jongno 3-ga
    "stop-5:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5717,
      lng: 126.9921,
      placesAround: 4,
      source: "geoapify",
    },
    // Wine bars along Euljiro 3-ga
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5668,
      lng: 126.9918,
      placesAround: 20,
      source: "geoapify",
    },
    // Noraebang along Myeongdong Gil
    "stop-6:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5632,
      lng: 126.9852,
      placesAround: 18,
      source: "geoapify",
    },
    // Convenience-store noodles near Myeongdong Station
    "stop-7:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5609,
      lng: 126.9863,
      placesAround: 20,
      source: "geoapify",
    },
    // Late supper along Myeongdong Gil
    "stop-7:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5638,
      lng: 126.9849,
      placesAround: 20,
      source: "geoapify",
    },
  },
};
