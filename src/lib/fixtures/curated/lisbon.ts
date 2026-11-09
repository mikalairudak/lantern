import type { WrittenDay } from "@/lib/days/written/written-day";
import { LISBON_REQUEST } from "./requests";

/**
 * A lively Saturday in Lisbon, east to west: the flea market at Santa Clara, which runs
 * only on Tuesdays and Saturdays, lunch in Mouraria, the Carmo and the Chiado through the
 * afternoon, sunset at Santa Catarina and Bairro Alto after dinner. Hours were checked
 * against the places' own pages, Visit Lisboa, Time Out and OpenStreetMap in October 2026;
 * Park's and Taberna da Rua das Flores' have only older sources. Coordinates are entrances,
 * or the starting point of a walk, from OpenStreetMap.
 */
export const LISBON_DAY: WrittenDay = {
  request: LISBON_REQUEST,
  day: {
    assumptions: { travel: "transit", start: "slow", dinner: "late", end: "late", company: null },
    dek: "The Saturday flea market at Santa Clara while the blankets are full, Bangladeshi curry in Mouraria at one, sunset over the river from Santa Catarina, and the lanes of Bairro Alto after dinner.",
    stops: [
      {
        startTime: "09:45",
        durationMinutes: 105,
        place: {
          name: "Feira da Ladra",
          kind: "market",
          neighborhood: "São Vicente",
          summary:
            "Sellers only spread their blankets here on Tuesdays and Saturdays, and before eleven the tables are still full and the aisles easy to walk.",
          aesthetic: ["loose azulejos", "vinyl crates", "cobbles"],
          coordinates: { lat: 38.7154, lng: -9.1259 },
          sensory: {
            energy: "social",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Haggling in Portuguese and English, cups clinking as they are turned over, records flicked through in crates.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "Low sun from the river side catches the glass and cutlery laid out on the ground and throws long shadows up the square.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "11:40",
        durationMinutes: 60,
        place: {
          name: "Mosteiro de São Vicente de Fora",
          kind: "sacred",
          neighborhood: "São Vicente",
          summary:
            "A few steps from the stalls and much quieter: cloisters lined with tiled animal fables, for an hour between the market and lunch.",
          aesthetic: ["blue-and-white tiles", "stone cloisters", "river view"],
          coordinates: { lat: 38.7148, lng: -9.1279 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture:
              "Footsteps on stone, a guide's voice in the next cloister, the market only a murmur over the wall.",
          },
          light: {
            exposure: "covered",
            orientation: "s",
            bestWindow: "midday",
            note: "The cloister walks stay in shade; at noon the low November sun sits over the river, so from the roof terrace the water glitters and the Alfama roofs are backlit.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "13:05",
        durationMinutes: 90,
        place: {
          name: "Curry on Rua do Benformoso",
          kind: "food",
          neighborhood: "Mouraria",
          summary:
            "The small rooms along the street at the foot of Mouraria cook Bangladeshi and Indian curries, a filling lunch at one after a morning on your feet at the market. Order samosas while you wait.",
          aesthetic: ["south asian", "no-frills tascas"],
          coordinates: { lat: 38.7142, lng: -9.1356 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Close tables, cutlery and talk, and cumin and chilli in the air from the kitchens.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Lamps on even at lunch; daylight from the narrow street only reaches the tables by the doors.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "15:00",
        durationMinutes: 60,
        place: {
          name: "Convento do Carmo",
          kind: "architecture",
          neighborhood: "Chiado",
          summary:
            "A Gothic nave open to the sky, at the top of the steps up from Rossio. The morning tour groups have gone by three, and the ruins stay open until six.",
          aesthetic: ["gothic arches", "pale limestone", "roofless nave"],
          coordinates: { lat: 38.712, lng: -9.1406 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Gravel underfoot, voices carrying, pigeons settling high on the walls.",
          },
          light: {
            exposure: "open",
            orientation: "w",
            bestWindow: "afternoon",
            note: "By mid-afternoon the low sun has left the floor of the nave and lights only the tops of the arches.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "16:25",
        durationMinutes: 100,
        place: {
          name: "Miradouro de Santa Catarina",
          kind: "viewpoint",
          neighborhood: "Santa Catarina",
          summary:
            "By half past four on a Saturday the terrace is filling up, beers from the kiosk in hand, faces turned west.",
          aesthetic: ["red bridge", "river view", "kiosk terrace"],
          coordinates: { lat: 38.7095, lng: -9.1477 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "A busker's guitar, bottles clinking on the steps, talk in several languages, a cold wind once the sun goes.",
          },
          light: {
            exposure: "open",
            orientation: "sw",
            bestWindow: "sunset",
            note: "In November the sun sets to the right of the bridge, and the river keeps the colour for a few minutes after.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "18:25",
        durationMinutes: 60,
        place: {
          name: "A Vida Portuguesa",
          kind: "shop",
          neighborhood: "Chiado",
          summary:
            "Portuguese tins, soaps and enamel mugs, bought at the end of the day so you have not been carrying them since breakfast. It stays open until half past seven.",
          aesthetic: ["vintage packaging", "enamelware", "printed tins"],
          coordinates: { lat: 38.7101, lng: -9.1392 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Paper bags at the till, people reading labels to each other, the door letting in the cold.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "After dark the shop runs on its own lamps, and the windows onto the street have gone black.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "20:15",
        durationMinutes: 120,
        place: {
          name: "Petiscos on Rua das Flores",
          kind: "food",
          neighborhood: "Chiado",
          summary:
            "Saturday dinner at the hour Lisbon eats it: tavern plates chalked on blackboards along the steep street just below Bairro Alto.",
          aesthetic: ["taverns", "blackboard menus", "small plates"],
          coordinates: { lat: 38.7101, lng: -9.1436 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Small rooms talking over themselves, glasses, doors opening on people asking for a table.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Low lamps over close tables; outside, the shutters on the street are down for the night.",
          },
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "22:30",
        durationMinutes: 90,
        place: {
          name: "Rua da Atalaia",
          kind: "walk",
          neighborhood: "Bairro Alto",
          summary:
            "Around eleven on a Saturday the drinking moves out of the bars and into the lanes. Walk up Rua da Atalaia and down Diário de Notícias while it fills.",
          aesthetic: ["cobbles", "graffiti", "narrow lanes"],
          coordinates: { lat: 38.7107, lng: -9.145 },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Plastic cups, three songs playing at once, a crowd standing in the middle of the street.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Shuttered and grey by day; after dark a few street lamps and the glow from open doorways light the walls yellow.",
          },
        },
        dependsOn: ["end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Mercado de Sapadores",
            kind: "market",
            neighborhood: "Graça",
            summary:
              "A covered market where Graça does its Saturday shopping, fruit and vegetables until two in the afternoon.",
            aesthetic: ["market hall", "produce stalls"],
            coordinates: { lat: 38.7218, lng: -9.129 },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture:
                "Stallholders weighing fruit, shopping trolleys, small talk at the counters.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Shade under the roof all morning, with daylight only at the doors.",
            },
            reason:
              "Still a Saturday market morning, among produce stalls instead of blankets of old things.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Panteão Nacional",
            kind: "sacred",
            neighborhood: "São Vicente",
            summary:
              "The white dome at the far end of the market square, with marble floors and few visitors even on a market morning.",
            aesthetic: ["white dome", "coloured marble"],
            coordinates: { lat: 38.715, lng: -9.1247 },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Every step echoes, and people drop their voices to a whisper.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "midday",
              note: "Daylight from the high windows is strongest around noon and gone by late afternoon.",
            },
            reason:
              "The same end of Santa Clara, under a dome in near silence instead of in the cloisters.",
          },
          {
            name: "Sé de Lisboa",
            kind: "sacred",
            neighborhood: "Sé",
            summary:
              "The cathedral below the castle, with tour groups coming and going through the late morning.",
            aesthetic: ["romanesque towers", "rose window", "dark stone"],
            coordinates: { lat: 38.7098, lng: -9.1328 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Tram 28 grinding round the corner outside, guides talking low in the nave.",
            },
            light: {
              exposure: "interior",
              orientation: "w",
              bestWindow: "afternoon",
              note: "The nave is dim before noon; the rose window over the door lights up once the sun comes round to the west.",
            },
            reason:
              "A church again on the way down to the Baixa, busy and right on the street instead of behind cloister walls.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Curry on the castle slope",
            kind: "food",
            neighborhood: "Mouraria",
            summary:
              "Mozambican and Portuguese cooking in the dining rooms along the castle slope, for a slower lunch with the Baixa spread out below their windows.",
            aesthetic: ["panoramic windows", "mozambican"],
            coordinates: { lat: 38.7123, lng: -9.135 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Low talk, cutlery, the city through the glass with no sound.",
            },
            light: {
              exposure: "interior",
              orientation: "w",
              bestWindow: "sunset",
              note: "At lunch the sun is still in the south, so the view west is bright but flat; it warms towards evening.",
            },
            reason:
              "Curry again two streets away, at a table by the glass instead of in a full room.",
          },
          {
            name: "Shellfish in Intendente",
            kind: "food",
            neighborhood: "Intendente",
            summary:
              "Shellfish and cold beer in the big halls at the foot of Almirante Reis, where Saturday lunch means a queue on the pavement first.",
            aesthetic: ["beer halls", "shellfish platters"],
            coordinates: { lat: 38.7202, lng: -9.1357 },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Crab shells cracking, orders called across the tables, beer glasses landing hard.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Bright overhead light on the platters; the only daylight comes in at the front windows.",
            },
            reason:
              "The same Saturday lunch at the bottom of the hill, seafood at full volume instead of curry at a crowded table.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Igreja de São Roque",
            kind: "sacred",
            neighborhood: "Bairro Alto",
            summary:
              "Gilded side chapels behind a plain stone front, with only a handful of people in the pews on a Saturday afternoon.",
            aesthetic: ["gilded chapels", "painted ceiling", "plain facade"],
            coordinates: { lat: 38.7136, lng: -9.1434 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Soft steps, a cough carrying, a door closing somewhere behind the altar.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Little daylight reaches the chapels by mid-afternoon, and the gilt glows under the lamps.",
            },
            reason:
              "Still a church a few streets from the Carmo, under a roof and in near silence instead of open to the sky.",
          },
          {
            name: "Elevador de Santa Justa",
            kind: "architecture",
            neighborhood: "Baixa",
            summary:
              "The iron lift that climbs from the Baixa to the Carmo, with a queue at the bottom all afternoon.",
            aesthetic: ["cast iron", "wooden cabin", "rooftop deck"],
            coordinates: { lat: 38.7121, lng: -9.1394 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture:
                "The wooden cabin creaking up, strangers pressed together, wind on the walkway at the top.",
            },
            light: {
              exposure: "open",
              orientation: "e",
              bestWindow: "afternoon",
              note: "In the afternoon the sun is behind you on the top deck and full on the castle hill across the Baixa.",
            },
            reason:
              "The same corner of Chiado, in the queue for the iron lift instead of among the arches.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Miradouro de São Pedro de Alcântara",
            kind: "viewpoint",
            neighborhood: "Bairro Alto",
            summary:
              "The other side of the sunset: a garden terrace that looks east across the Baixa while the sun goes down behind it.",
            aesthetic: ["garden terrace", "castle view"],
            coordinates: { lat: 38.7155, lng: -9.144 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Benches under the trees, couples on the railing, traffic far below.",
            },
            light: {
              exposure: "open",
              orientation: "e",
              bestWindow: "sunset",
              note: "At sunset the castle walls across the valley turn gold while the terrace itself is already in shade.",
            },
            reason: "Still a terrace at sunset, facing the castle instead of the river.",
          },
          {
            name: "Cocktails on the roofs",
            kind: "bar",
            neighborhood: "Bairro Alto",
            summary:
              "Bars on the roofs above Bairro Alto, reached by lifts and back stairs, that are full well before the sun goes down on a Saturday.",
            aesthetic: ["rooftops", "concrete", "river view"],
            coordinates: { lat: 38.7112, lng: -9.1476 },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Music over the crowd, ice in glasses, people pressing to the rail.",
            },
            light: {
              exposure: "open",
              orientation: "sw",
              bestWindow: "sunset",
              note: "The roofs face the sunset over the river; once it is gone, heaters and covered corners take over.",
            },
            reason: "The same sunset, from a roof several floors up instead of a public terrace.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Livraria Bertrand",
            kind: "shop",
            neighborhood: "Chiado",
            summary:
              "Connected rooms of books on Rua Garrett, open until ten, so the hour before dinner can be spent browsing without a rush.",
            aesthetic: ["wooden shelves", "connected rooms"],
            coordinates: { lat: 38.7107, lng: -9.1412 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Pages turning, low voices, the street muffled behind the door.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lamplight on the shelves, and the windows already dark.",
            },
            reason:
              "Still something to take home, books in hushed rooms instead of tins on shelves.",
          },
          {
            name: "Armazéns do Chiado",
            kind: "shop",
            neighborhood: "Chiado",
            summary: "A shopping centre on Rua do Carmo, open late and full on a Saturday evening.",
            aesthetic: ["department store", "escalators"],
            coordinates: { lat: 38.711, lng: -9.1394 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Escalators, shop music, crowds with bags at the doors.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Bright shop light inside, and the Baixa already dark through the glass.",
            },
            reason:
              "Shopping on the same Chiado corner, among chain shops on several floors instead of a quiet room of Portuguese brands.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Bacalhau in Chiado",
            kind: "food",
            neighborhood: "Chiado",
            summary:
              "Bacalhau and other Portuguese plates in the bistros around the corner, which take bookings, so a Saturday dinner at a quarter past eight starts on time.",
            aesthetic: ["bistros", "modern portuguese"],
            coordinates: { lat: 38.7087, lng: -9.1421 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "A steady murmur, plates arriving in order, wine poured at the table.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "By dinner the windows have gone dark and the rooms run on low lamps.",
            },
            reason:
              "Portuguese plates for dinner again, with room between tables instead of a crush at the door.",
          },
          {
            name: "Tinned fish on Pink Street",
            kind: "food",
            neighborhood: "Cais do Sodré",
            summary:
              "The pink-painted street by the river, where tinned sardines and a glass make a quick dinner as its bars start to fill.",
            aesthetic: ["pink street", "tin labels"],
            coordinates: { lat: 38.7073, lng: -9.1438 },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Shoulder to shoulder at the tables, glasses of white wine, street noise coming in the door.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Bright inside, with neon from the bars across the street after dark.",
            },
            reason:
              "Small plates still, opened from tins on a packed street instead of cooked in a tavern.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Rua Garrett",
            kind: "walk",
            neighborhood: "Chiado",
            summary:
              "Chiado's main street once the shops have shut, with people drifting between the Baixa and Bairro Alto.",
            aesthetic: ["calçada paving", "shopfronts"],
            coordinates: { lat: 38.7106, lng: -9.1423 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Footsteps, talk from a café terrace, a busker at Largo do Chiado.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Street lamps on pale paving, and shop windows lit behind half-lowered shutters.",
            },
            reason: "Out walking at night again, with room to move instead of in the crush.",
          },
        ],
      },
    ],
  },
};
