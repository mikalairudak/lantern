# Voice

Status: agreed 2026-10-22. Rulings 1 to 11 are at the end of this file, the tests below include them, and the curated days pass them.

A model writes Lantern's text and a person judges it. This file is the judging side. What each field should say is already written once, in the `.describe()` strings of `src/lib/schema/itinerary.schema.ts`, which the model reads as its field-level prompt. The rubric checks whether a generation met them in the voice Lantern needs. It serves three uses:

- **Pre-MVP 6:** the owner judges the curated fixtures with it.
- **MVP 2:** its three tests become the system prompt's voice rules, and the banned-phrase list feeds the prompt and the check.
- **MVP 5, optional:** an LLM-as-judge asks the same three questions. It is the first thing to drop. Built on 2026-11-05 as `EVAL_ROUND=voice` (`docs/harness.md`, "The voice judge"), measured against the verdicts below before it scores a model's days.

Only the banned-phrase list is checked by code. The rest needs a reader. `docs/harness.md` lists voice as the one judged check in the eval.

## Text roles

The rubric judges roles, not fields. The schema changes: the generated title left it in `1801478`, leaving the dek as the one line about the day, and the design direction adds a reason to each assumption the model makes. The roles survive that.

| Role                        | Field today                    | Earned means                                                               |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| Line about the day          | `dek`                          | It names this day's places and hours, not the city in general              |
| Place summary               | `place.summary`                | Why this place, at this hour, in this day, without help from the other two |
| Texture                     | `sensory.texture`              | What you would hear and feel there at the scheduled time                   |
| Light note                  | `light.note`                   | How the light changes through the day, and why this hour                   |
| Swap reason                 | `options[].reason`             | What it shares with the original pick, then what it trades                 |
| Assumption reason, proposed | none yet, from a design branch | Why the model assumed or revised a fact about the visitor                  |

A swap reason keeps that order: "The same old town, on its busiest street instead of its quietest." The opening varies ("The same …", "Still …", "… again"), so a day's reasons do not read as one template.

## Three tests

Each line gets three yes-or-no answers. A line passes when all three are yes.

**Concrete: could a visitor point at it, hear it or taste it there?**
"Fishmongers calling prices, knives on boards, a crowd at the bar" passes; "A lively market full of local character" does not.

Concrete means sensory and typical, not encyclopedic. A model invents a date, an architect or "the city's oldest church" with the same confidence as a true one, and place grounding (MVP 3) checks that a place exists, not when it was built. Nobody can check a one-off scene either, such as "someone's birthday" at the next table. The prompt asks for what is typically there at that hour, so dates, history, superlatives and counts nothing can check fail this test. So does a relation between two places, such as a shared owner, kitchen or maker: grounding checks that each place exists, not who runs it. A place that is part of another, as its name shows ("Nanzen-ji Hojo Garden" as "the temple's own dry garden"), is geography and passes.

**Plain: would a friend who knows the city say it this way?**
"Point at what looks good and keep ordering" passes; "Immerse yourself in a vibrant tapestry of flavours" does not. No exclamation marks, rhetorical questions or stacked adjectives, and nothing from the banned list.

- **Hyperbole fails.** "It fills with families at dusk" passes; "Half of Alicante walks it at dusk" does not.
- **An image passes only when it is literally visible.** "The water does the glittering" passes; an image that stands for a feeling does not.
- **An everyday turn of phrase passes.** "A small room talking over itself" is how anyone describes a loud room. The image rule is for literary images.
- **One tip per stop.** A tip is a sentence in the imperative, such as "Order one for the table". It is how a friend talks, so one per stop passes and a second one fails. "You" as a point of view ("the castle above you") is not a tip.

**Earned: does it stop being true at another stop or another hour? This is the swap test.**
Move the line to a different stop of the same day, or to a different time at the same place. If it still reads as true, it is not earned. "Low morning sun warms the whitewash; by noon the lanes glare" passes: it is only true for a morning visit. "Whitewashed houses on a quiet hill" does not: it fits any hour.

Each line passes on its own. A summary does not borrow its hour from the light note.

Each role reads the swap test through its "Earned means" column above:

- **Summary:** must carry the hour by itself. Moved to another part of the same visit, it should stop being true. The reason is about the time of day: an opening or closing time, how the crowd moves at that hour, a meal, or the light. The day of the week alone does not earn the hour: "It is shut on Sundays, so Saturday afternoon is the time to see it" says why Saturday, not why the afternoon.
- **Texture:** earned when it belongs to this place and nothing in it contradicts the hour. A museum may sound like a museum all day.
- **Light note:** earned when it says how the light changes through the day, or what it is at this hour and not at others. Moved to another part of the day at the same place, it should stop being true; "bright" alone fits every daylight hour. An indoor place earns it by saying, or plainly showing, why the hour does not matter: "Bright overhead light on the platters; the only daylight comes in at the front windows" passes.

### One line, broken three ways

Each broken version fails exactly one test.

| Version                                                                                                     | Fails    |
| ----------------------------------------------------------------------------------------------------------- | -------- |
| The city beach below the castle cliff, before anyone has put a towel down. The sun comes up out of the bay. | none     |
| A beautiful beach with a special atmosphere in the early hours.                                             | concrete |
| Nestled beneath the iconic castle, this stunning stretch of sand awakens with breathtaking sunrises.        | plain    |
| The city beach below the castle cliff, with fine sand and clear water.                                      | earned   |

## Scoring

- **Per line:** three yes-or-no answers.
- **Per day:** the share of lines passing each test, by role.
- **No thresholds yet.** The first fully judged curated day sets them.
- **Not a test, but noted per stop:** the lines of one stop should not repeat each other. In the first pass, the Explanada stop mentioned its marble ripples in all three of its lines.

## Banned phrases

The one part checked by code. It is a hard check in `docs/harness.md`: one hit fails the day.

- **Matching:** case-insensitive, whole words and phrases, in every generated string except place names and neighbourhoods. A bar called Oasis is a name, not a cliché. A plural counts ("hidden gems"), and so does a typographic apostrophe ("whether you’re").
- **Where it lives:** `BANNED_PHRASES` in `src/lib/quality/banned-phrases.ts` is the single source, with the check that uses it. The system prompt imports it in MVP 2.
- **The list:** from "hidden gem" and "nestled" to "world-class" and "look no further", plus any exclamation mark.

Run over the Alicante fixture, its 78 text lines and 51 aesthetic tags, the list has no hits. Run over the 246 lines of the curated days, it has none either.

## First pass: the Alicante day

The first hand-written day was the Alicante fixture. It holds the day in `src/lib/fixtures/hand-made/alicante-sketch.ts` and the swap candidates in `src/lib/fixtures/hand-made/abacus-candidates.ts`. The curated days below were judged the same way.

**Method.** A first pass judges every line against the rubric. The owner then marks where they disagree. The disagreement rate is the rubric's own test: if a careful reader often disagrees with it, it is not ready to become a prompt. The same measure decides in MVP 5 whether an LLM judge can be trusted. It has to agree with the owner's verdicts on a judged day about as often as the owner agrees with themselves. The owner ruled on the questions below rather than on each line, here and on the curated days, so the agreement between a person and a judge is still unmeasured; "Second judge and close" below says what was measured instead.

**Result, under the owner's rulings.** 66 of 78 lines pass all three tests.

| Role               | Lines | Pass all three |
| ------------------ | ----- | -------------- |
| Line about the day | 2     | 2              |
| Place summary      | 21    | 11             |
| Texture            | 21    | 20             |
| Light note         | 21    | 20             |
| Swap reason        | 13    | 13             |

Summaries are where the voice breaks. Most of them describe the place instead of saying why it belongs at that hour, or reach for history. Textures, light notes and swap reasons hold up. So the system prompt's voice rules should spend their words on the summary.

**Flagged lines**

| Stop                      | Line                                                                                                          | Fails            | Why                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| Barrio de Santa Cruz      | Whitewashed houses stacked up the castle hill, with potted geraniums on the steps. Steep, quiet and lived-in. | earned           | True at any hour; the dek, not the summary, says "before it wakes" |
| Castillo de Santa Bárbara | A hilltop fortress over the whole bay, reached by a lift cut into the rock across the road from the beach.    | earned           | Says how to get there, not why at 09:45                            |
| Mercado Central           | A modernist market hall from the early 1920s, at its busiest on a Saturday. Have a vermouth at a stall bar …  | concrete         | A date the model would invent just as confidently                  |
| MACA                      | The contemporary art museum in a 17th-century building beside the Basilica of Santa María, with a room of …   | concrete, earned | A date and a collection; nothing about 16:15                       |
| Explanada de España       | … Half of Alicante walks it at dusk.                                                                          | plain            | Hyperbole                                                          |
| Nou Manolín               | A busy tapas bar in the centre where locals stand at the long counter. …                                      | earned           | Any tapas bar; the hour sits in the light note instead             |
| Nou Manolín (light)       | Warm bar light; it only fills up after nine.                                                                  | earned           | A line about the crowd in the light role; nothing about this hour  |
| Basílica de Santa María   | The city's oldest church, Gothic behind a baroque front, cool and nearly empty.                               | concrete         | A superlative of age                                               |
| MUBAG                     | Fine art in an 18th-century palace at the foot of the castle hill.                                            | concrete, earned | A date; true at any hour                                           |
| Plaza de los Luceros      | The fountain square a few streets from the market, with a café terrace.                                       | earned           | Fits any hour                                                      |
| La Taberna del Gourmet    | A packed counter in the centre, with rice and wine by the glass.                                              | earned           | Fits any hour and almost any bar                                   |
| Calle Castaños (texture)  | Glasses, shouted orders, someone's birthday.                                                                  | concrete         | An invented one-off, not what is typically there                   |

## Judged: the curated days, 2026-10-22

The curated days are in `src/lib/fixtures/curated/`: Kyoto, calm, the hero day; Alicante, calm, the first hand-written day rewritten to this rubric; Lisbon, lively. All 246 lines were judged the same way, a first reading against the rubric. The banned-phrase list has no hits.

| Role               | Kyoto | Alicante | Lisbon | All     |
| ------------------ | ----- | -------- | ------ | ------- |
| Line about the day | 2/2   | 2/2      | 2/2    | 6/6     |
| Place summary      | 23/23 | 17/21    | 20/22  | 60/66   |
| Texture            | 23/23 | 21/21    | 22/22  | 66/66   |
| Light note         | 23/23 | 21/21    | 22/22  | 66/66   |
| Swap reason        | 15/15 | 13/13    | 14/14  | 42/42   |
| All                | 86/86 | 74/78    | 80/82  | 240/246 |

Under ruling 7, agreed after this pass, three Kyoto summaries also fail concrete, making 237 of 246. Their counts were cut the same day.

These numbers check a writer who had the rubric in hand, not a model, so a high pass rate is expected. What they can still measure is how often the owner disagrees with the verdicts. Every fail is again a summary. All 12 lines flagged in the first pass were rewritten, and all 12 now pass.

**Fails.** All six are summaries of alternatives that do not carry their hour.

| Day, slot      | Place                  | Line                                                                        | Why                                                        |
| -------------- | ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Alicante 10:00 | Rambla de Méndez Núñez | The main avenue below the hill, busy with Saturday shoppers.                | Fits any hour of a Saturday                                |
| Alicante 14:00 | Monastrell             | A tasting menu of rice and local wine in a hushed room by the port.         | Lunch or dinner alike                                      |
| Alicante 17:20 | Parque de Canalejas    | Old ficus trees and benches by the port, at the quiet end of the promenade. | Nothing about sunset; only the light note has it           |
| Alicante 21:00 | Piripi                 | Nou Manolín's sister restaurant: the same kitchen, with tables.             | No hour, and it says what its swap reason says             |
| Lisbon 20:15   | Cantinho do Avillez    | … booked ahead, so a Saturday dinner at nine starts on time.                | Names nine o'clock for a 20:15 slot, a fixture bug as well |
| Lisbon 20:15   | Sol e Pesca            | … on the pink-painted street that is loud by midnight.                      | The only hour it names is midnight                         |

**Borderline passes.** The bar sits on these ten, so the owner's marks on them say the most about it.

| Day, slot      | Place, role                        | Line                                                                                                        | Why it passes                                        |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Kyoto 08:25    | Philosopher's Path, texture        | Water running beside you, gravel underfoot, a jogger coming up behind.                                      | The jogger places it in the morning                  |
| Kyoto 08:25    | Daimonji Trail, texture            | Roots and timber steps, your own breathing, a hello from hikers on the way down.                            | Hikers coming down fit 08:30; the rest fits any hour |
| Kyoto 13:00    | KYOCERA Museum of Art, light       | The glass entrance takes the low sun late in the afternoon; inside, the galleries are lit the same all day. | Says why the hour does not matter                    |
| Alicante 14:00 | Monastrell, light                  | Big windows onto the harbour: bright, never harsh.                                                          | Daytime only; no change through the day              |
| Alicante 14:00 | La Taberna del Gourmet, light      | Warm indoor light; the street outside is in shade.                                                          | Daytime only                                         |
| Alicante 14:00 | La Taberna del Gourmet, texture    | A full bar, plates landing, everyone talking at once.                                                       | "Everyone" reads as an impression, not hyperbole     |
| Lisbon 09:45   | Mercado de Sapadores, summary      | A covered market where Graça does its Saturday shopping, fruit and vegetables until two in the afternoon.   | The closing hour ties it to the morning              |
| Lisbon 13:05   | Cervejaria Ramiro, light           | Bright overhead light on the platters; the only daylight comes in at the front windows.                     | Daytime only                                         |
| Lisbon 15:00   | Convento do Carmo, summary         | … It is shut on Sundays, so Saturday afternoon is the time to see it.                                       | Earns the day more than the hour                     |
| Lisbon 20:15   | Taberna da Rua das Flores, texture | A small room talking over itself, glasses, the door opening on people asking for a table.                   | An image, but literally audible                      |

**The judge disagrees with itself.** 47 Alicante lines are unchanged since the first pass, and four verdicts reversed: the Rambla, Monastrell, Canalejas and Piripi summaries, which the first pass let through. Nine summaries are unchanged, so the judge kept its verdict on only five of them. The first pass read an alternative's summary next to its stop and its swap reason; this pass read it alone, as ruling 2 says. Whoever judges, a person or an LLM, the hour in a summary is where verdicts drift. It is the first thing to check when an LLM judge is calibrated in MVP 5.

**Noted, not scored.**

- "Steps" or "footsteps" appear in 11 of 66 textures, glasses in 7 and cups in 6. A model repeats the same few sounds too, so the system prompt should ask for variety across a day.
- All 42 swap reasons trade with "instead of". Ruling 6 asked for the order, not the words, but the words settled anyway. A visitor sees two reasons at most, so it does not hurt yet.
- The Explanada stop has palms in all three of its lines, and the Piripi summary says what its swap reason says.
- The fixtures' own comments mark two Kyoto coordinates as estimates and two Lisbon opening hours as resting on older sources. Facts are outside this rubric: the walk-radius check in pre-MVP 4 shows a pin that is far off, and grounding checks places in MVP 3.

### Second judge and close

**A second judge.** The six fails and ten borderline passes went to ChatGPT, twice, each time in a fresh chat. It had the rubric and each line with its stop, and none of the first reading's verdicts. Lines were relabelled and ordered by city and time, so fails and passes interleaved. Every verdict not listed here matched the first reading in both runs.

| Line                                        | First reading | Run 1 | Run 2        |
| ------------------------------------------- | ------------- | ----- | ------------ |
| KYOCERA Museum of Art, light (Kyoto)        | pass          | pass  | fail, "sure" |
| Monastrell, light (Alicante)                | pass          | fail  | fail         |
| Convento do Carmo, summary (Lisbon)         | pass          | fail  | fail         |
| Taberna da Rua das Flores, texture (Lisbon) | pass          | fail  | pass         |

- Each run agreed with the first reading on 13 of 16 verdicts, and the two runs agreed with each other on 14 of 16.
- Both runs failed the Monastrell light note and the Carmo summary on the weakness the first reading had already named, and both are conceded.
- The runs split on the Taberna da Rua das Flores texture. It passes under ruling 10.
- The second run failed the KYOCERA light note as "sure", reading its late-afternoon clause as a claim about 13:00; its indoor clause makes it pass. Confidence labels matched between runs on 12 of 16 lines and did not predict agreement.
- Both runs also failed the Piripi summary on concrete, for "sister restaurant" and "the same kitchen". Ruling 11 makes that a rule.

One pass of an LLM judge is not a measurement: the same prompt flipped 2 of 16 verdicts. Every disagreement fell where the rubric left room, and the judge named those places: how a summary earns its hour, what a light note must say about this hour, and figures of speech. Rulings 8 to 10 close them. The model that writes the day would have met the same gaps in the system prompt.

**Closed** on the first reading's verdicts for the 16 lines, which rulings 8 to 10 turn into rules. So 13 of 16 is a model against the first reading on hard cases, not a person against a judge. If an LLM judge is built in MVP 5, the owner marks one judged day first, about 80 lines, and the judge runs three times with the majority verdict, sending splits to the owner.

Applying rulings 8 to 10 to all 246 lines fails two more: the Monastrell light note, and the Restaurante Dársena light note, "Under the awning the light is bright but soft; the water does the glittering", which survives a move to eleven o'clock just as Monastrell's does. Ruling 4 still holds for it: the image passes plain. No other line changes.

| Day      | As judged | After the counts were cut | After the rewrites |
| -------- | --------- | ------------------------- | ------------------ |
| Kyoto    | 83/86     | 86/86                     | 86/86              |
| Alicante | 72/78     | 72/78                     | 78/78              |
| Lisbon   | 79/82     | 80/82                     | 82/82              |
| All      | 234/246   | 238/246                   | 246/246            |

As judged, summaries pass 56 of 66 and light notes 64 of 66; every other role passes. After the counts were cut, the Kyoto counts are gone and the Cantinho do Avillez summary says "a quarter past eight", which is judged a pass. Ruling 11, accepted after this table, fails three more lines: the Piripi swap reason and the ZEN CAFE swap reason in every column, and the ZEN CAFE summary in the last two, where it no longer fails on its count. That makes 232, 235 and 243; "Ruling 11" below lists the three lines.

**Failing after the counts were cut, then rewritten.** All eight rewrites were judged a pass. A writer who had this list in hand rewrote them, so 246 of 246 says the fixtures are ready to calibrate against, not that a model writes this well.

| Day, slot      | Place                  | Role    | Fails because                                  |
| -------------- | ---------------------- | ------- | ---------------------------------------------- |
| Alicante 10:00 | Rambla de Méndez Núñez | summary | Fits any hour of a Saturday                    |
| Alicante 14:00 | Monastrell             | summary | Lunch or dinner alike                          |
| Alicante 14:00 | Monastrell             | light   | "Bright, never harsh" fits every daylight hour |
| Alicante 14:00 | Restaurante Dársena    | light   | "Bright but soft" fits every daylight hour     |
| Alicante 17:20 | Parque de Canalejas    | summary | Nothing about sunset                           |
| Alicante 21:00 | Piripi                 | summary | No hour, and it repeats its swap reason        |
| Lisbon 15:00   | Convento do Carmo      | summary | Earns Saturday, not the afternoon              |
| Lisbon 20:15   | Sol e Pesca            | summary | The only hour it names is midnight             |

Not a rule: a light note that says the light is the same all day while its `bestWindow` names a window, as Monastrell's does at midday, contradicts its own data. A check could catch that later.

## Rulings, agreed 2026-10-22

The tests above already include every ruling; this list keeps the reasons.

1. **History and superlatives** ("from the early 1920s", "the city's oldest church") are left out of the prompt and fail concrete. Grounding cannot verify them, and the day reads as well without them.
2. **The summary passes the swap test on its own.** It is the one line whose job is "why this place earns its slot", and the texture and the light have jobs of their own.
3. **A tip in the second person** ("Order one for the table and take your time") is allowed, at most one per stop. It is how a friend talks. In the Alicante day three stops have one each and none has two.
4. **A figurative line** passes when the image is literally visible and fails when it stands for a feeling. The Dársena light note, "the water does the glittering", passes, which is why the tally moved from 65 to 66.
5. **Hyperbole** fails plain. "It fills with families at dusk" says the same and can be true.
6. **A swap reason says what it shares, then what it trades,** as the house pattern. It makes the trade easy to scan, and the schema's description asks for exactly that. Corrected the same day: the draft said all 13 reasons read "The same …, … instead of …". In fact six open with "The same", five use "still" and two use "… again", and twelve trade with "instead of" while one says "traded for". The varied opening is part of the pattern, so the prompt asks for the order, not the words.
7. **Counts that nothing can check** ("capped at fifteen people an hour", "sixteen seats", "twenty-odd platters", all in the first draft of the Kyoto day) fail concrete, like dates. The numbers a day is planned around stay: opening hours, days closed and walking minutes are what make a summary earned ("The grounds open at six and cost nothing, so at half past seven …"), and the visitor needs them. A count of seats or dishes plans nothing, and a model invents it as confidently as a date.
8. **A summary earns its hour with a reason about the time of day,** not the day of the week. The Carmo summary earns Saturday, not the afternoon, and fails.
9. **A light note passes the swap test against other hours of daylight.** "Bright" fits every one of them, so the Monastrell and Dársena light notes fail. An indoor place may show, not only say, why the hour does not matter, so the Cervejaria Ramiro and Taberna del Gourmet notes pass.
10. **An everyday turn of phrase passes plain.** The image rule of ruling 4 is for literary images. "A small room talking over itself" passes.
11. **A relation between places** ("Nou Manolín's sister restaurant", "the same kitchen", "Kagizen's own café") fails concrete, like a date. Grounding checks that a place exists, not who runs it, and a model invents a relation as confidently as a year. Both runs of the second judge failed the Piripi summary on it unprompted. A place that is part of another, as its name shows, is geography and passes: the Nanzen-ji Hojo Garden is "the temple's own dry garden". In a swap reason, what the option shares with the stop is what the visitor gets, such as the dish, the room or the hour, not who runs it; otherwise ruling 6 leads straight back to the relation.

Rulings 8 to 10 came out of closing the curated pass: they are what the verdicts on the sixteen hardest lines imply.

Ruling 11 came after the curated pass closed. The first reading had named two lines it would fail; applying it to all 246 found a third, the ZEN CAFE swap reason. After the rewrites it fails these three, which go back to the writer:

| Day, slot      | Place    | Role        | Line                                                                                                                                  |
| -------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Kyoto 15:00    | ZEN CAFE | summary     | Kagizen's own café down a lane south of Shijo: a small room, seasonal fruit sandwiches and café au lait, and a shorter wait at three. |
| Kyoto 15:00    | ZEN CAFE | swap reason | The same sweets maker, in its quieter café off the main street instead of the old shop on it.                                         |
| Alicante 21:00 | Piripi   | swap reason | The same kitchen as Nou Manolín, at a table instead of standing at the counter.                                                       |

**Rewritten the same day.** All three are judged a pass. The ZEN CAFE summary earns three o'clock with the queues at the sweet shops on the main street. Both swap reasons share what the visitor gets, something sweet at three and dinner at nine. "Three deep at the counter" repeats Nou Manolín's own summary for a packed bar, so it is not hyperbole. Since the titles left the schema, the curated days have 243 lines, and all 243 pass rulings 1 to 11.
