import type { EdgeDay } from "./edge-day";

/**
 * A Saturday night out in Lisbon that runs through midnight: a stop that starts before it
 * and ends after it, then one that starts at one in the morning, written on the clock as
 * "01:00". Hours from Time Out, Difford's, Lojas com História and Mes Prestiges, October
 * 2026: Ramiro until 00:30 except Mondays, Pavilhão Chinês until two, Lux Frágil Thursday
 * to Saturday until six.
 */
export const LATE_NIGHT_DAY: EdgeDay = {
  edge: "a night that runs through midnight and starts a stop after it",
  request: {
    city: "Lisbon",
    date: "2026-11-21",
    timezone: "Europe/Lisbon",
    citySource: "chosen",
    energy: "social",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: "late",
    end: "late",
    company: null,
  },
  day: {
    assumptions: { travel: "taxi", start: "slow", dinner: null, end: null, company: null },
    dek: "Shellfish at Ramiro at nine, a drink among the toy soldiers of Pavilhão Chinês through midnight, and Lux Frágil by the river from one until four.",
    stops: [
      {
        startTime: "21:00",
        durationMinutes: 105,
        place: {
          name: "Shellfish in Intendente",
          kind: "food",
          neighborhood: "Intendente",
          summary:
            "Prawns, clams and crab sold by weight at the steel tables of the beer halls, with a steak roll to finish; on a Saturday night the wait for a table can pass an hour.",
          aesthetic: ["seafood tanks", "steel tables"],
          coordinates: { lat: 38.7207, lng: -9.1357 },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Wooden mallets on crab shells, beer glasses set down hard, orders called down the room.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Bright overhead light on every table, the same at nine as at noon.",
          },
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "23:15",
        durationMinutes: 90,
        place: {
          name: "Cocktails in Príncipe Real",
          kind: "bar",
          neighborhood: "Príncipe Real",
          summary:
            "Bars in old shopfronts along Rua Dom Pedro V, with armchairs in back rooms that only fill after eleven.",
          aesthetic: ["old shopfronts", "armchairs"],
          coordinates: { lat: 38.7159, lng: -9.1477 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Ice in a shaker, low talk between armchairs, the door bell now and then.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Low lamps in the old shop windows; at eleven the street outside is dark and quiet.",
          },
        },
        // Until a quarter to one, so it was planned on staying out late too.
        dependsOn: ["end", "company"],
      },
      {
        startTime: "01:00",
        durationMinutes: 180,
        place: {
          name: "Late drinks on the river",
          kind: "bar",
          neighborhood: "Santa Apolónia",
          summary:
            "The warehouses on the river at Santa Apolónia, open until six on a Saturday; their floors fill after two, and their roofs look out over the Tagus.",
          aesthetic: ["warehouses", "river terraces"],
          coordinates: { lat: 38.7143, lng: -9.1223 },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "A kick drum through the floor downstairs, a cold wind off the river on the roofs.",
          },
          light: {
            exposure: "interior",
            orientation: "se",
            bestWindow: "after-dark",
            note: "From the roofs, the lights of the far bank and the cranes of the port across black water.",
          },
        },
        dependsOn: ["travel", "end"],
      },
    ],
    alternatives: [],
  },
};
