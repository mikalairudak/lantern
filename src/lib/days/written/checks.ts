import type { PlaceCheck } from "@/lib/places/verify-place";

/**
 * Each start's place checks from the run that wrote its day, on 2026-10-31, as Geoapify answered
 * them then (`docs/grounding.md`): a meal by its area, any other place by its name, as the live
 * route checks them, a place confirmed by name with the provider's point. Only the places the
 * normalizer keeps: an option it drops for its distance has no row to mark. Keyed by the start's
 * city, then by the id the normalizer gives each place (`stop-2:p`, `stop-2:a1`). Written from
 * the place rounds' records of those runs (`quick-starts` and `rewrite-starts`, each start's
 * generation named above its checks), so the written days carry the checks their runs had, and
 * the route plays them as a live day's (`src/lib/stream/written-place-checks.ts`). Every written
 * day is a start's, so every one has its checks (`writtenChecksOf`).
 *
 * Data © OpenStreetMap contributors, under the ODbL, provided by Geoapify (`NOTICE`).
 */
export const START_PLACE_CHECKS: Readonly<Record<string, Readonly<Record<string, PlaceCheck>>>> = {
  // quick-starts, generation faebcc08-8385-4a92-ba3e-aa61475b419f, 2026-11-07
  Bologna: {
    // Coffee along Via Drapperie
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 44.4941,
      lng: 11.3445,
      placesAround: 20,
      source: "geoapify",
    },
    // Basilica di San Petronio
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 44.4927365,
      lng: 11.3430324,
      providerId:
        "51d1ef56f1a1af264059d38558fd113f4640f00102f9015e188d1300000000c00201920318426173696c6963612064692053616e20506574726f6e696f",
      source: "geoapify",
    },
    // Tagliatelle in the Quadrilatero
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 44.4934,
      lng: 11.3452,
      placesAround: 20,
      source: "geoapify",
    },
    // Mercato delle Erbe
    "stop-3:p": {
      kind: "verified",
      by: "name",
      lat: 44.4960715,
      lng: 11.3382767,
      providerId:
        "5163ff869a32ad264059247d5a457f3f4640f00102f901c21cdf0800000000c002019203124d65726361746f2064656c6c652045726265",
      source: "geoapify",
    },
    // Due Torri and Strada Maggiore
    "stop-4:p": { kind: "unverified", reason: "no-match" },
    // Spritz around Piazza Verdi
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 44.4968,
      lng: 11.3516,
      placesAround: 13,
      source: "geoapify",
    },
    // Tortellini along Via del Pratello
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 44.4975,
      lng: 11.3365,
      placesAround: 20,
      source: "geoapify",
    },
    // Wine on Via del Pratello
    "stop-7:p": {
      kind: "verified",
      by: "area",
      lat: 44.4972,
      lng: 11.3355,
      placesAround: 14,
      source: "geoapify",
    },
    // Coffee along Via Clavature
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 44.4932,
      lng: 11.3441,
      placesAround: 18,
      source: "geoapify",
    },
    // Coffee along Via Rizzoli
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 44.4936,
      lng: 11.3459,
      placesAround: 20,
      source: "geoapify",
    },
    // Chiesa di Santo Stefano
    "stop-1:a1": { kind: "unverified", reason: "no-match" },
    // Piazza Maggiore
    "stop-1:a2": {
      kind: "verified",
      by: "name",
      lat: 44.4936561,
      lng: 11.3430486,
      providerId:
        "518ee0eb10a4af264059477c821f303f4640f00101f901f213c20000000000c0020192030f5069617a7a61204d616767696f7265",
      source: "geoapify",
    },
    // Tortellini in Via Santo Stefano
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 44.4908,
      lng: 11.3485,
      placesAround: 15,
      source: "geoapify",
    },
    // Pasta near Piazza Maggiore
    "stop-2:a2": {
      kind: "verified",
      by: "area",
      lat: 44.4932,
      lng: 11.3435,
      placesAround: 20,
      source: "geoapify",
    },
    // Wine along Via Pescherie Vecchie
    "stop-3:a2": {
      kind: "verified",
      by: "area",
      lat: 44.4943,
      lng: 11.3453,
      placesAround: 20,
      source: "geoapify",
    },
    // Piazza Santo Stefano
    "stop-4:a1": {
      kind: "verified",
      by: "name",
      lat: 44.4921451,
      lng: 11.3482911,
      providerId:
        "51caf9073653b22640597eb1529cfe3e4640f00102f9018f79630100000000c002019203145069617a7a612053616e746f2053746566616e6f",
      source: "geoapify",
    },
    // Via Indipendenza
    "stop-4:a2": { kind: "unverified", reason: "no-match" },
    // Wine on Via Santo Stefano
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 44.4905,
      lng: 11.3492,
      placesAround: 4,
      source: "geoapify",
    },
    // Beer around Via Zamboni
    "stop-5:a2": { kind: "unverified", reason: "too-few-places" },
  },
  // rewrite-starts, generation 08c69745-9337-4b67-b267-8ffb1daff6db, 2026-11-15
  Porto: {
    // Coffee on Rua das Flores
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 41.1432,
      lng: -8.6119,
      placesAround: 20,
      source: "geoapify",
    },
    // Palácio da Bolsa
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 41.1414113,
      lng: -8.6157292,
      providerId:
        "516e6292db403b21c0597664f6c319924440f00103f9016309c09300000000c0020192031150616cc3a163696f20646120426f6c7361",
      source: "geoapify",
    },
    // Igreja de São Francisco
    "stop-2:p": {
      kind: "verified",
      by: "name",
      lat: 41.1409824,
      lng: -8.6157079,
      providerId:
        "5116c7dc103e3b21c059e2a716b60b924440f00102f901a1bd8e0c00000000c00201920318436875726368206f662053c3a36f204672616e636973636f",
      source: "geoapify",
    },
    // Petiscos along Rua de São João
    "stop-3:p": {
      kind: "verified",
      by: "area",
      lat: 41.1405,
      lng: -8.6148,
      placesAround: 20,
      source: "geoapify",
    },
    // Port cellar lanes in Vila Nova de Gaia
    "stop-4:p": { kind: "unverified", reason: "no-match" },
    // Jardim do Morro
    "stop-5:p": {
      kind: "verified",
      by: "name",
      lat: 41.1376202,
      lng: -8.6086894,
      providerId:
        "51fed71423a63721c0596e22e9899d914440f00103f9016032001400000000c0020192030f4a617264696d20646f204d6f72726f",
      source: "geoapify",
    },
    // Francesinha in Cedofeita
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 41.1527,
      lng: -8.6174,
      placesAround: 19,
      source: "geoapify",
    },
    // Igreja do Carmo
    "stop-0:a1": {
      kind: "verified",
      by: "name",
      lat: 41.147456,
      lng: -8.6162547,
      providerId:
        "5139036dbc853b21c059abcc94d6df924440f00102f901bb0db20d00000000c0020192030f496772656a6120646f204361726d6f",
      source: "geoapify",
    },
    // Cafés on Praça de Carlos Alberto
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 41.1469,
      lng: -8.6157,
      placesAround: 20,
      source: "geoapify",
    },
    // Mercado Ferreira Borges
    "stop-1:a2": {
      kind: "verified",
      by: "name",
      lat: 41.1416949,
      lng: -8.615018,
      providerId:
        "5114e7a8a3e33a21c05947c1f80e23924440f00103f9010f386f8601000000c0020192031c4d65726361646f20466572726569726120426f726765732028343929",
      source: "geoapify",
    },
    // Igreja de Santa Clara
    "stop-2:a1": {
      kind: "verified",
      by: "name",
      lat: 41.1425058,
      lng: -8.6092307,
      providerId:
        "5139701816ed3721c059c33e4ba13d924440f00102f901dc393d0e00000000c00201920315496772656a612064652053616e746120436c617261",
      source: "geoapify",
    },
    // Cais da Ribeira
    "stop-2:a2": {
      kind: "verified",
      by: "name",
      lat: 41.1403515,
      lng: -8.6130468,
      providerId:
        "51bcd52945e13921c059e738b709f7914440f00102f901eb0a3f0e00000000c0020492030f436169732064612052696265697261",
      source: "geoapify",
    },
    // Cafés on Rua das Taipas
    "stop-3:a1": {
      kind: "verified",
      by: "area",
      lat: 41.1444,
      lng: -8.6166,
      placesAround: 17,
      source: "geoapify",
    },
    // Tapas along Rua da Alfândega
    "stop-3:a2": {
      kind: "verified",
      by: "area",
      lat: 41.1417,
      lng: -8.6176,
      placesAround: 20,
      source: "geoapify",
    },
    // Cais de Gaia
    "stop-4:a2": {
      kind: "verified",
      by: "name",
      lat: 41.1373251,
      lng: -8.6162085,
      providerId:
        "51d10836ae7f3b21c059c0b56ede93914440f00102f901d385d51300000000c0020192032554656c6566c3a97269636f2064652047616961202845737461c3a7c3a36f20426169786129e203216f70656e7374726565746d61703a76656e75653a7761792f333332373630353331",
      source: "geoapify",
    },
    // Mosteiro da Serra do Pilar
    "stop-5:a1": {
      kind: "verified",
      by: "name",
      lat: 41.1383454,
      lng: -8.608065,
      providerId:
        "513aafb14b543721c059a946544db5914440f00101f901fd4f470000000000c0020192031a4d6f73746569726f20646120536572726120646f2050696c6172",
      source: "geoapify",
    },
    // Miradouro da Vitória
    "stop-5:a2": {
      kind: "verified",
      by: "name",
      lat: 41.1431234,
      lng: -8.6157657,
      providerId:
        "5142ff4ea4453b21c0596b2519de51924440f00103f9010a31aba100000000c002019203154d697261646f75726f20646120566974c3b3726961",
      source: "geoapify",
    },
    // Caldo verde along Rua do Almada
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 41.1491,
      lng: -8.6144,
      placesAround: 20,
      source: "geoapify",
    },
  },
  // quick-starts, generation 1110d5c6-3041-4a54-81ba-fe3e63d06a67, 2026-11-07
  Kanazawa: {
    // Kenroku-en
    "stop-0:p": {
      kind: "verified",
      by: "name",
      lat: 36.5624267,
      lng: 136.6623546,
      providerId:
        "515d2b46023215614059d8721d99fd474240f00102f9011356ff0200000000c0020192030f4b656e726f6b752d656e205061726b",
      source: "geoapify",
    },
    // Coffee in Kenrokumachi
    "stop-1:p": {
      kind: "verified",
      by: "area",
      lat: 36.5632,
      lng: 136.6598,
      placesAround: 13,
      source: "geoapify",
    },
    // Higashi Chaya District
    "stop-2:p": { kind: "unverified", reason: "no-match" },
    // Seafood Bowls at Omicho Market
    "stop-3:p": { kind: "unverified", reason: "no-match" },
    // Kanazawa Castle Park
    "stop-4:p": { kind: "unverified", reason: "no-match" },
    // 21st Century Museum of Contemporary Art
    "stop-5:p": { kind: "unverified", reason: "no-match" },
    // Oden in Katamachi
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 36.5612,
      lng: 136.6523,
      placesAround: 20,
      source: "geoapify",
    },
    // Kazue-machi Chaya District
    "stop-7:p": { kind: "unverified", reason: "no-match" },
    // Oyama Shrine
    "stop-0:a1": {
      kind: "verified",
      by: "name",
      lat: 36.566036,
      lng: 136.6558803,
      providerId:
        "51e7d2aef8fc14614059e82d1ede73484240f00102f90105dd171200000000c002019203164f79616d6120536872696e65204d61696e2048616c6c",
      source: "geoapify",
    },
    // Coffee near Hirosaka
    "stop-1:a2": {
      kind: "verified",
      by: "area",
      lat: 36.5625,
      lng: 136.6585,
      placesAround: 6,
      source: "geoapify",
    },
    // Utatsuyama Craft Workshop Hill
    "stop-2:a1": { kind: "unverified", reason: "no-match" },
    // Soba near Omicho
    "stop-3:a1": {
      kind: "verified",
      by: "area",
      lat: 36.5712,
      lng: 136.6585,
      placesAround: 20,
      source: "geoapify",
    },
    // Seafood Grills in Omicho
    "stop-3:a2": {
      kind: "verified",
      by: "area",
      lat: 36.5719,
      lng: 136.6579,
      placesAround: 20,
      source: "geoapify",
    },
    // Gyokusen-inmaru Garden
    "stop-4:a1": {
      kind: "verified",
      by: "name",
      lat: 36.5653134,
      lng: 136.657333,
      providerId:
        "519c3237df0815614059cb7e82305c484240f00102f9014497623400000000c0020192031647796f6b7573656e2d696e6d6172752047617264656e",
      source: "geoapify",
    },
    // Hirosaka Street
    "stop-4:a2": { kind: "unverified", reason: "no-match" },
    // D.T. Suzuki Museum
    "stop-5:a1": {
      kind: "verified",
      by: "name",
      lat: 36.55772,
      lng: 136.661369,
      providerId:
        "51d33252ef29156140599e29745e63474240f00103f90122d1ca7f00000000c00201920313442e20542e2053757a756b69204d757365756d",
      source: "geoapify",
    },
    // Soba in Katamachi
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 36.5615,
      lng: 136.653,
      placesAround: 20,
      source: "geoapify",
    },
    // Izakaya Alley in Katamachi
    "stop-6:a2": {
      kind: "verified",
      by: "area",
      lat: 36.5608,
      lng: 136.6518,
      placesAround: 20,
      source: "geoapify",
    },
    // Asano River Bank Path
    "stop-7:a1": { kind: "unverified", reason: "no-match" },
  },
  // rewrite-starts, generation 4645b45c-2da2-4e47-bd59-bd1df35e786c, 2026-11-14
  Madrid: {
    // Churros by Plaza Mayor
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 40.4155,
      lng: -3.7075,
      placesAround: 20,
      source: "geoapify",
    },
    // El Rastro
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 40.4086332,
      lng: -3.7073295,
      providerId:
        "51e0f76f5e9ca80dc059a807bb174e344440f00101f9019ea7c50000000000c0020192030d52617374726f204d61726b6574",
      source: "geoapify",
    },
    // Tapas on Cava Baja
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 40.4127,
      lng: -3.7094,
      placesAround: 20,
      source: "geoapify",
    },
    // Parque del Retiro
    "stop-3:p": {
      kind: "verified",
      by: "name",
      lat: 40.414946,
      lng: -3.6832845,
      providerId:
        "51e2e82add5d770dc05992cd55f31c354440f00101f90121c7cf0000000000c0020192030e456c2052657469726f205061726b",
      source: "geoapify",
    },
    // Plaza del Dos de Mayo
    "stop-4:p": {
      kind: "verified",
      by: "area",
      lat: 40.4251,
      lng: -3.7048,
      placesAround: 20,
      source: "geoapify",
    },
    // Raciones on Calle del Pez
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 40.4263,
      lng: -3.7061,
      placesAround: 20,
      source: "geoapify",
    },
    // Cocktails around Calle de la Palma
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 40.4268,
      lng: -3.7055,
      placesAround: 20,
      source: "geoapify",
    },
    // Coffee on Calle del Arenal
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 40.4177,
      lng: -3.7084,
      placesAround: 20,
      source: "geoapify",
    },
    // Mercado de San Miguel
    "stop-0:a2": {
      kind: "verified",
      by: "name",
      lat: 40.4153741,
      lng: -3.7090151,
      providerId:
        "511bf6d61b10ac0dc0597f8d7ffa2a354440f00102f901bef3440000000000c002019203154d65726361646f2064652053616e204d696775656c",
      source: "geoapify",
    },
    // Plaza de la Paja
    "stop-1:a1": {
      kind: "verified",
      by: "name",
      lat: 40.4129877,
      lng: -3.7115786,
      providerId:
        "518a44fc1e50b10dc0593c93ecc7dc344440f00102f9018c57420000000000c00201920310506c617a61206465206c612050616a61",
      source: "geoapify",
    },
    // Plaza de Cascorro
    "stop-1:a2": {
      kind: "verified",
      by: "name",
      lat: 40.4105843,
      lng: -3.7073209,
      providerId:
        "51e2372adc97a80dc0592260be068e344440f00102f90103d2fa1300000000c00201920311506c617a6120646520436173636f72726f",
      source: "geoapify",
    },
    // Calle de Segovia
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 40.4143,
      lng: -3.7128,
      placesAround: 20,
      source: "geoapify",
    },
    // Plaza de San Ildefonso
    "stop-4:a1": {
      kind: "verified",
      by: "area",
      lat: 40.4263,
      lng: -3.701,
      placesAround: 20,
      source: "geoapify",
    },
    // Calle de San Vicente Ferrer
    "stop-4:a2": {
      kind: "verified",
      by: "area",
      lat: 40.4266,
      lng: -3.7048,
      placesAround: 20,
      source: "geoapify",
    },
    // Calle del Pez side streets
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 40.4258,
      lng: -3.7066,
      placesAround: 20,
      source: "geoapify",
    },
    // Wine bars around Plaza de San Ildefonso
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 40.4263,
      lng: -3.701,
      placesAround: 20,
      source: "geoapify",
    },
  },
  // quick-starts, generation 9e34e7ed-deb2-47ba-8834-ce60dc61cd61, 2026-11-08
  Utrecht: {
    // Coffee on the Oudegracht
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 52.0923,
      lng: 5.1186,
      placesAround: 20,
      source: "geoapify",
    },
    // Domtoren
    "stop-1:p": {
      kind: "verified",
      by: "name",
      lat: 52.090615,
      lng: 5.121321,
      providerId:
        "51a6457d923b7c14405976c3b645990b4a40f00102f9015eb1a90f00000000c00201920309446f6d20746f776572e203216f70656e7374726565746d61703a76656e75653a7761792f323632373739323330",
      source: "geoapify",
    },
    // Pancakes on the Domplein
    "stop-2:p": {
      kind: "verified",
      by: "area",
      lat: 52.0913,
      lng: 5.1226,
      placesAround: 20,
      source: "geoapify",
    },
    // Centraal Museum
    "stop-3:p": {
      kind: "verified",
      by: "name",
      lat: 52.0836118,
      lng: 5.1256638,
      providerId:
        "51122add02ae80144059a4479dcab30a4a40f00101f901a543650000000000c0020192030f43656e747261616c204d757365756d",
      source: "geoapify",
    },
    // Dinner on the Wijk C streets
    "stop-4:p": {
      kind: "verified",
      by: "area",
      lat: 52.0885,
      lng: 5.1182,
      placesAround: 20,
      source: "geoapify",
    },
    // Oudegracht Canal Walk
    "stop-5:p": { kind: "unverified", reason: "no-match" },
    // Coffee on Springweg
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 52.0942,
      lng: 5.1155,
      placesAround: 9,
      source: "geoapify",
    },
    // Drinks on the Neude
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 52.0942,
      lng: 5.1192,
      placesAround: 20,
      source: "geoapify",
    },
    // Domkerk
    "stop-1:a1": {
      kind: "verified",
      by: "name",
      lat: 52.0908623,
      lng: 5.1224535,
      providerId:
        "51791f4773647d1440593c783760a10b4a40f00102f901d65e1e4500000000c00201920307446f6d6b65726b",
      source: "geoapify",
    },
    // Museum Speelklok
    "stop-1:a2": {
      kind: "verified",
      by: "name",
      lat: 52.0907282,
      lng: 5.1194134,
      providerId:
        "5111d19e81477a14405998e94dfb9c0b4a40f00103f901a8e8b52c02000000c002019203104d757365756d20537065656c6b6c6f6b",
      source: "geoapify",
    },
    // Soup on the Zadelstraat
    "stop-2:a1": {
      kind: "verified",
      by: "area",
      lat: 52.0899,
      lng: 5.1196,
      placesAround: 20,
      source: "geoapify",
    },
    // Beer on the Ledig Erf
    "stop-2:a2": {
      kind: "verified",
      by: "area",
      lat: 52.0903,
      lng: 5.1189,
      placesAround: 16,
      source: "geoapify",
    },
    // Spoorwegmuseum
    "stop-3:a2": {
      kind: "verified",
      by: "name",
      lat: 52.0877182,
      lng: 5.1319832,
      providerId:
        "51577c9e9a2687144059ca2198593a0b4a40f00102f9011f2fe70200000000c0020192030e53706f6f727765676d757365756d",
      source: "geoapify",
    },
    // Soup on the Twijnstraat
    "stop-4:a1": {
      kind: "verified",
      by: "area",
      lat: 52.0891,
      lng: 5.1235,
      placesAround: 20,
      source: "geoapify",
    },
    // Beer on the Oudegracht
    "stop-4:a2": {
      kind: "verified",
      by: "area",
      lat: 52.0919,
      lng: 5.1183,
      placesAround: 20,
      source: "geoapify",
    },
    // Drinks on the Neude
    "stop-5:a2": {
      kind: "verified",
      by: "area",
      lat: 52.0942,
      lng: 5.1192,
      placesAround: 20,
      source: "geoapify",
    },
  },
  // quick-starts, generation f2bf6ba0-2037-48e6-be18-09ff41f9e2c0, 2026-11-07
  Nafplio: {
    // Coffee on Staikopoulou
    "stop-0:p": {
      kind: "verified",
      by: "area",
      lat: 37.5679,
      lng: 22.8028,
      placesAround: 5,
      source: "geoapify",
    },
    // Archaeological Museum of Nafplio
    "stop-1:p": { kind: "unverified", reason: "no-match" },
    // Arvanitia Promenade
    "stop-2:p": { kind: "unverified", reason: "no-match" },
    // Souvlaki on Vasileos Konstantinou
    "stop-3:p": {
      kind: "verified",
      by: "area",
      lat: 37.5672,
      lng: 22.8043,
      placesAround: 9,
      source: "geoapify",
    },
    // Palamidi Fortress
    "stop-4:p": {
      kind: "verified",
      by: "name",
      lat: 37.5623868,
      lng: 22.8026146,
      providerId:
        "51c84a822678cd364059ded9684afcc74240f00103f901005c80c602000000c0020192031854686520466f727472657373206f662050616c616d696469e203246f70656e7374726565746d61703a76656e75653a6e6f64652f3131393230323335353230",
      source: "geoapify",
    },
    // Fish by the Harbour on Akti Miaouli
    "stop-5:p": {
      kind: "verified",
      by: "area",
      lat: 37.5668,
      lng: 22.807,
      placesAround: 10,
      source: "geoapify",
    },
    // Tea on Plateia Syntagmatos
    "stop-6:p": {
      kind: "verified",
      by: "area",
      lat: 37.5667,
      lng: 22.8055,
      placesAround: 8,
      source: "geoapify",
    },
    // Coffee on Komninou
    "stop-0:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5683,
      lng: 22.8036,
      placesAround: 4,
      source: "geoapify",
    },
    // Coffee on Syntagma Square
    "stop-0:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5666,
      lng: 22.8056,
      placesAround: 8,
      source: "geoapify",
    },
    // Church of Agios Spyridon
    "stop-1:a1": { kind: "unverified", reason: "no-match" },
    // Peloponnesian Folklore Foundation Museum
    "stop-1:a2": { kind: "unverified", reason: "no-match" },
    // Bourtzi Viewpoint on Akti Miaouli
    "stop-2:a1": { kind: "unverified", reason: "no-match" },
    // Coffee on Akti Miaouli
    "stop-2:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5666,
      lng: 22.8068,
      placesAround: 6,
      source: "geoapify",
    },
    // Spoon Sweets on Staikopoulou
    "stop-3:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5679,
      lng: 22.8029,
      placesAround: 5,
      source: "geoapify",
    },
    // Meze on Plateia Syntagmatos
    "stop-3:a2": {
      kind: "verified",
      by: "area",
      lat: 37.5667,
      lng: 22.8056,
      placesAround: 8,
      source: "geoapify",
    },
    // Panagia Church Garden
    "stop-4:a1": { kind: "unverified", reason: "no-match" },
    // Akronafplia Fortress Walls
    "stop-4:a2": { kind: "unverified", reason: "no-match" },
    // Fish on Staikopoulou
    "stop-5:a1": {
      kind: "verified",
      by: "area",
      lat: 37.5679,
      lng: 22.803,
      placesAround: 15,
      source: "geoapify",
    },
    // Ouzo on Bouboulinas
    "stop-5:a2": { kind: "unverified", reason: "too-few-places" },
    // Herbal Tea on Papanikolaou
    "stop-6:a1": {
      kind: "verified",
      by: "area",
      lat: 37.567,
      lng: 22.8047,
      placesAround: 10,
      source: "geoapify",
    },
    // Wine on Plateia Philellinon
    "stop-6:a2": { kind: "unverified", reason: "too-few-places" },
  },
};

/**
 * A written day's place checks, by its city. Every day the public site serves from a file is a
 * start's and has them (`checks.test.ts`); one without is a fixture out of step, said at once.
 */
export function writtenChecksOf(city: string): Readonly<Record<string, PlaceCheck>> {
  const checks = START_PLACE_CHECKS[city];
  if (checks === undefined) throw new Error(`The written day in ${city} has no place checks`);
  return checks;
}
