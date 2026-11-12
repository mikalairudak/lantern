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
  // city-days, generation 74b93e4e-4eee-45c4-9556-216b5b5b81c7, 2026-11-22
  Paris: {
    // Coffee along Quai de Valmy
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 48.8718,
      lng: 2.3641,
      placesAround: 13,
      source: "geoapify",
    },
    // Canal Saint-Martin
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 48.8689561,
      lng: 2.3671691,
      providerId:
        "5164d0645af6ef024059719417f4396f4840f00101f90115c5110000000000c0020192031243616e616c205361696e742d4d617274696e",
      source: "geoapify",
    },
    // Parc des Buttes-Chaumont
    "stop-2:p": {
      kind: "verified",
      by: "name",
      lat: 48.8795551,
      lng: 2.3820982,
      providerId:
        "513de24680890e034059d7c3f24295704840f00102f901ece3520a00000000c0020192031850617263206465732042757474657320436861756d6f6e74",
      source: "geoapify",
    },
    // Lunch around Rue Rébeval
    "stop-3:p": {
      kind: "verified",
      by: "area",
      lat: 48.8758,
      lng: 2.3795,
      placesAround: 16,
      source: "geoapify",
    },
    // Musée Cernuschi
    "stop-4:p": {
      kind: "verified",
      by: "name",
      lat: 48.8794322,
      lng: 2.3125644,
      providerId:
        "51a1269fc321800240595006fd3b91704840f00102f90180ff120400000000c002019203104d7573c3a965204365726e7573636869",
      source: "geoapify",
    },
    // Parc Monceau
    "stop-5:p": {
      kind: "verified",
      by: "name",
      lat: 48.879374,
      lng: 2.3088732,
      providerId:
        "510ee324839278024059f279c5538f704840f00101f901b5222b0000000000c0020192030c50617263204d6f6e63656175",
      source: "geoapify",
    },
    // Bistrot Dinner on Rue de Lévis
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 48.8826,
      lng: 2.3102,
      placesAround: 13,
      source: "geoapify",
    },
    // Wine along Rue des Dames
    "stop-7:p": {
      kind: "verified",
      by: "area",
      lat: 48.8836,
      lng: 2.318,
      placesAround: 6,
      source: "geoapify",
    },
    // Coffee around Rue des Vinaigriers
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 48.8716,
      lng: 2.3611,
      placesAround: 20,
      source: "geoapify",
    },
    // Brunch on Rue du Faubourg Saint-Martin
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 48.8725,
      lng: 2.3565,
      placesAround: 20,
      source: "geoapify",
    },
    // Square des Récollets
    "stop-1:a1": {
      kind: "verified",
      by: "name",
      lat: 48.8736258,
      lng: 2.3633403,
      providerId:
        "51f68c8ef51ee80240598ef85ff8d26f4840f00102f901168e950400000000c0020192031453717561726520646573205265636f6c6c657473",
      source: "geoapify",
    },
    // Place de la République
    "stop-1:a2": {
      kind: "verified",
      by: "name",
      lat: 48.8675421,
      lng: 2.3639583,
      providerId:
        "51b0dc1cf862e90240599bb3999e0b6f4840f00102f901da70d41a00000000c00201920317506c616365206465206c612052c3a97075626c69717565",
      source: "geoapify",
    },
    // Rue Georges Lardennois
    "stop-2:a1": {
      kind: "verified",
      by: "name",
      lat: 48.8769072,
      lng: 2.3767276,
      providerId:
        "512b018cc289030340593fd0c07e3e704840f00102f90179e1340300000000c002049203165275652047656f72676573204c617264656e6e6f6973",
      source: "geoapify",
    },
    // Rue Manin
    "stop-2:a2": {
      kind: "verified",
      by: "name",
      lat: 48.8808716,
      lng: 2.3800961,
      providerId:
        "5179b2f6d26f0a034059d3fc8c66c0704840f00102f90180853b5500000000c00204920309527565204d616e696e",
      source: "geoapify",
    },
    // Tea around Rue des Pyrénées
    "stop-3:a1": {
      kind: "verified",
      by: "area",
      lat: 48.8717,
      lng: 2.3868,
      placesAround: 6,
      source: "geoapify",
    },
    // Street food on Rue de Belleville
    "stop-3:a2": {
      kind: "verified",
      by: "area",
      lat: 48.8725,
      lng: 2.3846,
      placesAround: 20,
      source: "geoapify",
    },
    // Musée Nissim de Camondo
    "stop-4:a1": {
      kind: "verified",
      by: "name",
      lat: 48.8791733,
      lng: 2.3123464,
      providerId:
        "51ca2f2878af7f02405919822dc088704840f00102f90134ff120400000000c002019203184d7573c3a965204e697373696d2064652043616d6f6e646f",
      source: "geoapify",
    },
    // Musée Jacquemart-André
    "stop-4:a2": {
      kind: "verified",
      by: "name",
      lat: 48.8754502,
      lng: 2.3105444,
      providerId:
        "51c5a5cfb3fe7b0240596a238dc00e704840f00102f9012fdf190400000000c002019203184d7573c3a965204a61637175656d6172742d416e6472c3a9",
      source: "geoapify",
    },
    // Rue Cardinet
    "stop-5:a2": {
      kind: "verified",
      by: "name",
      lat: 48.8858253,
      lng: 2.3118992,
      providerId:
        "514230fd01c57e02405915bc32b962714840f00102f901a9eb961600000000c0020492030c5275652043617264696e6574",
      source: "geoapify",
    },
    // Dinner on Rue des Batignolles
    "stop-6:a2": {
      kind: "verified",
      by: "area",
      lat: 48.883,
      lng: 2.32,
      placesAround: 20,
      source: "geoapify",
    },
    // Tea along Rue Legendre
    "stop-7:a1": {
      kind: "verified",
      by: "area",
      lat: 48.886,
      lng: 2.318,
      placesAround: 9,
      source: "geoapify",
    },
    // Cocktails around Rue Lemercier
    "stop-7:a2": {
      kind: "verified",
      by: "area",
      lat: 48.8853,
      lng: 2.325,
      placesAround: 20,
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
  // city-days, generation d595f0fc-06cb-4e5a-b7dd-cc69a648c97f, 2026-11-20
  Seoul: {
    // Coffee on Samcheong-ro
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 37.5866,
      lng: 126.9815,
      placesAround: 7,
      source: "geoapify",
    },
    // Bukchon Hanok Village
    "stop-1:p": { kind: "unverified", reason: "no-match" },
    // Mandu and noodles near Anguk Station
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 37.576,
      lng: 126.9855,
      placesAround: 19,
      source: "geoapify",
    },
    // Changdeokgung Palace and Huwon
    "stop-3:p": { kind: "unverified", reason: "no-match" },
    // Ikseon-dong Hanok Alleys
    "stop-4:p": { kind: "unverified", reason: "no-match" },
    // Insadong-gil
    "stop-5:p": {
      kind: "verified",
      by: "name",
      lat: 37.5735237,
      lng: 126.9855961,
      providerId:
        "512b24aa0114bf5f40598f7d7f3969c94240f00102f9019cc6960100000000c0020492030c496e7361646f6e672d67696c",
      source: "geoapify",
    },
    // Tea on Insadong-gil side alleys
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 37.5738,
      lng: 126.9862,
      placesAround: 20,
      source: "geoapify",
    },
    // Grilled pork along Euljiro 3-ga
    "stop-7:p": {
      kind: "verified",
      by: "area",
      lat: 37.5663,
      lng: 126.9917,
      placesAround: 20,
      source: "geoapify",
    },
    // Beer along Euljiro Nogari Alley
    "stop-8:p": {
      kind: "verified",
      by: "area",
      lat: 37.5668,
      lng: 126.9939,
      placesAround: 20,
      source: "geoapify",
    },
    // Hangang View Cafe Street at Bukchon Lane
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5847,
      lng: 126.9832,
      placesAround: 8,
      source: "geoapify",
    },
    // Coffee on Samcheong-dong Gallery Street
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5841,
      lng: 126.9822,
      placesAround: 15,
      source: "geoapify",
    },
    // Gahoe-dong Alleys
    "stop-1:a2": { kind: "unverified", reason: "no-match" },
    // Tea and rice on Anguk side lanes
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5772,
      lng: 126.9868,
      placesAround: 20,
      source: "geoapify",
    },
    // Jongmyo Shrine
    "stop-3:a1": {
      kind: "verified",
      by: "name",
      lat: 37.5749525,
      lng: 126.9938788,
      providerId:
        "51048cd3b59bbf5f40597120240b98c94240f00101f901e949260100000000c0020192030e4a6f6e676d796f20536872696e65",
      source: "geoapify",
    },
    // Changgyeonggung Palace
    "stop-3:a2": { kind: "unverified", reason: "no-match" },
    // Tea at Ikseon-dong Courtyard Rooms
    "stop-4:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5745,
      lng: 126.9899,
      placesAround: 20,
      source: "geoapify",
    },
    // Dessert along Ikseon-dong Main Alley
    "stop-4:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5751,
      lng: 126.989,
      placesAround: 20,
      source: "geoapify",
    },
    // Jogyesa Temple Grounds
    "stop-5:a1": { kind: "unverified", reason: "no-match" },
    // Street food in Insadong Ssamziegil Courtyard
    "stop-5:a2": { kind: "unverified", reason: "no-match" },
    // Tea at Jogyesa Gate Lane
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5746,
      lng: 126.984,
      placesAround: 20,
      source: "geoapify",
    },
    // Makgeolli on Insadong Back Lane
    "stop-6:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5732,
      lng: 126.9862,
      placesAround: 11,
      source: "geoapify",
    },
    // Noodles on Euljiro Alley
    "stop-7:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5659,
      lng: 126.991,
      placesAround: 20,
      source: "geoapify",
    },
    // Chicken and beer along Euljiro Ho-Hoo Alley
    "stop-7:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5666,
      lng: 126.9925,
      placesAround: 20,
      source: "geoapify",
    },
    // Wine on Euljiro Quiet Lane
    "stop-8:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5655,
      lng: 126.993,
      placesAround: 20,
      source: "geoapify",
    },
    // Soju along Euljiro Pocha Street
    "stop-8:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5671,
      lng: 126.9948,
      placesAround: 10,
      source: "geoapify",
    },
  },
};
