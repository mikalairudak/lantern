# Place grounding in the live day: the contract (proposed 2026-10-31)

**Status: the lean v1's server and reader built on 2026-10-31 (section 8); the card's look built since, a quiet crosshair on a confirmed place (`src/features/abacus/place-check.tsx`; `docs/decisions.md`, "Places are checked through Geoapify, not Google Places").** It is MVP outcome 3 ("Every place is verified before it renders, and coordinates come from the provider, not the model. Verification is a card state, so the streaming choreography holds", `docs/roadmap.md`), built on what the eval already has. Its first questions were settled on 2026-10-31: a meal keeps the model's point, the name matching is improved for Kyoto and walks before the mark ships, and there is no credit counter. Asked whether it is over-engineered, the plan was cut to what the mark needs: no cache and no new column. The card's look is designed apart (see "Not in this contract").

## What existed when it was proposed

- **The verifier is built and measured, and no route calls it.** `createPlaceVerifier` (`src/lib/places/verify-place.ts`) sends a coffee, food or bar place to the area check and any other kind to the name check: one request, one Geoapify credit, per place. The name check searches "name, city" inside a 1 km circle around the model's point and confirms only when distance, name and category agree (`src/lib/places/match.ts`); the area check counts places of the kind within 240 m and confirms at three (`src/lib/places/area.ts`). It never rejects: a failure is an `unverified` result with its reason. Only the eval's place round runs it; the live routes call Geoapify only for the intake's cities.
- **The client and the queue.** One queue per process, at most 5 requests a second; a lookup more than 10 s from its turn times out unsent, a request after 5 s; a 401, 403 or 429 pauses both endpoints for 10 s; nothing is retried (`src/lib/places/geoapify.ts`).
- **The decision of 2026-10-28** (`docs/decisions.md`, "Places are checked through Geoapify"): a place not confirmed, a failed call or a spent quota shows the place unverified, and the day is never lost; the mark is quiet and sits on confirmed places rather than alarming on the others; OpenStreetMap and Geoapify are credited on every day.

What the last two place rounds measured on Sonnet's days (`day-v5`, `day-v6`; 547 places in 24 days):

|                                                  | `day-v5`                                     | `day-v6`                                     |
| ------------------------------------------------ | -------------------------------------------- | -------------------------------------------- |
| places in a day                                  | 19 to 29, median 24                          | 18 to 27, median 24                          |
| named, confirmed                                 | 92 of 160 (58%)                              | 75 of 137 (55%)                              |
| meals, confirmed by area                         | 112 of 124 (90%)                             | 115 of 126 (91%)                             |
| all, confirmed                                   | 204 of 284 (72%)                             | 190 of 263 (72%)                             |
| model's point to the provider's, confirmed names | median 68 m, 90% within 244 m, at most 467 m | median 76 m, 90% within 236 m, at most 496 m |

## 1. What is checked, and when

**Every place the visitor can see: each stop's place and each option**, since an option becomes the row's place on a swap. The shadow is never checked: it is never shown, and the eval's place round measures it.

**In the stream, not before it.** Waiting for every check before showing the day would hold the whole day back, which the roadmap rules out, and the queue's five a second would make a day's 24 checks a five-second wall if they all waited for the end. Each place is checked as soon as what the check reads is final: its name, kind and coordinates, which stream in that order inside a place, so a place is ready once the field after its coordinates has begun. A stop's place goes out as the stop streams, about one every five seconds over a day's 40 to 50 s; the options come in a burst at the end, which the queue paces, about three seconds for fifteen.

**On the server, in the day's own stream.** The day's call reads the model's text as it arrives and starts each check there, and writes the result into the visitor's stream as a data part beside the model's text, keyed by the id the normalizer gives the place (`stop-2:p`, `stop-2:a1`): a position in the generation, which no repair moves. The key stays on the server, the visitor makes no second request, and no new endpoint can spend the credits. The stream's close already waits for the server (`beforeClose`); it waits for the checks still running too, up to a deadline of 3 s after the model's last word (rather than 6 s, since the page's "written in" waits for the close), and a check still running then ends as `unchecked` and its lookup stops.

## 2. Where the coordinates come from

- **A place confirmed by name takes the provider's point**, in the finished itinerary. Nothing on screen moves for it, since the day has no map; the light windows and the legs read it, and a shift of 70 to 500 m moves neither the sun's hours nor the day's flow beyond its noise.
- **A meal keeps the model's point** (2026-10-31), which amends the decision of 2026-10-28: it is the middle of a stretch where several places stand, and the area check confirms by counting places around that very point.
- **An unconfirmed or unchecked place keeps the model's point.**
- **The walk radius is not judged again.** An option judged within 800 m on the model's points stays, even if the provider's point puts it further: the visitor may already have seen it.

## 3. What the visitor sees

A place's check is a **state of its card**. The data gives four states, and the decided rule says how loud each is:

| state         | when                                                                                                    | the rule of 2026-10-28                     |
| ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `checking`    | the place has streamed and its check is running                                                         | the card as it is today                    |
| `confirmed`   | by name (a place of this name and kind at this spot) or by area (three places of its kind within 240 m) | the quiet mark                             |
| `unconfirmed` | Geoapify answered and the rule could not confirm it                                                     | no mark; never hidden, never alarming      |
| `unchecked`   | a failed call, a timeout, a spent quota, or the deadline                                                | as `unconfirmed`; the log tells them apart |

**The card state, built 2026-11-01** (`docs/decisions.md`, "Places are checked through Geoapify, not Google Places"): a confirmed place carries a crosshair at the end of its row's kind and quarter, its room held from `checking`; `unconfirmed` and `unchecked` carry nothing. Its sheet said "map", the spot linked to OpenStreetMap, until the map row below took its place on 2026-11-04.

**The sheet's map row, built 2026-11-04** (`docs/decisions.md`, "Places are checked through Geoapify, not Google Places"): every open stop's sheet ends with "map", a Google Maps link, and under it, on a day whose places were checked, a line on how far the map vouches for the place; the row on the day stays as above. A named place is always asked for by its name and the day's city, so Google opens the place's card: "Open in Google Maps" when confirmed, under "Location found by its name on OpenStreetMap. Opening hours haven't been checked."; otherwise "Search in Google Maps", under "Location not confirmed." (`unconfirmed`, `unchecked`) or "Checking the location." (`checking`). A place to eat or drink around says it is an area to choose a place in; confirmed, it leads to its point, "Directions to the area", then "Places to eat found around it on OpenStreetMap."; a point no check vouches for is searched for by its name and city. A day written by hand, never checked, has the link alone. The table is in `src/features/abacus/map-action.ts`.

On the recorded days about seven places in ten would carry the mark today, and about eight in ten after the matching work in section 7. A written day replayed from its file shows no marks in v1: the written days are still hand-made, and the quick starts that replace them, days a paid run wrote, will carry the states their run recorded (2026-10-31). OpenStreetMap and Geoapify are credited on every day, which the free plan requires ("Powered by Geoapify" with a link); the page is checked for it once the mark ships.

## 4. Requests, latency and the free plan

- **One credit a place.** A Sonnet day shows 18 to 29 places, so about 24 credits a day; the intake adds one to three per read. The free plan gives 3,000 credits a day and 5 requests a second, with no card ([pricing](https://www.geoapify.com/pricing), [credits](https://www.geoapify.com/pricing-details)): about 110 days a day. The app's own cap, $10 a day at about $0.09 a day, allows about 110 too, so the two limits meet; the visitor's ten days a day sit far below both.
- **Over the quota** Geoapify answers 429, which pauses our queue for 10 s, and its places stay `unchecked`; Geoapify says it does not throttle a passing excess but may restrict an account that keeps above its plan. Nothing costs money. No credit counter: the log's checks show how many places each day checked, and a counter waits until a day nears the quota.
- **Latency.** Measured on production on 2026-10-31 through the intake's `Server-Timing`: Geoapify answers Vercel's `iad1` in 0.25 to 0.5 s (`docs/harness.md`, "Where a request's seconds go"). In the stream a place's mark arrives that long after the place, and nothing waits for it: the day's first words never do.
- **No cache in v1.** Each day checks its own places. A cache saves credits only once visitors repeat places often enough to near the quota, which the log will show first; the verifier already names which results could be cached (`isCacheable`).

## 5. What the log keeps

No new column: the three checks below go into the record's existing `checks`, as every other check does. Their findings name each place that went unconfirmed or unchecked, with its reason (`alternatives[1].options[0]: "Okazaki Canal Walk" unconfirmed, no-match`; `stops[3].place: unchecked, timeout`), and each confirmed place the provider moved far. A day of 24 places writes about 24 short lines at most, under 2 KB, the size of a swap-direction check's findings on a bad day, so `checks` holds it. What it leaves out, the provider's id and point for each confirmed place, the eval's place round keeps in full, with every answer.

## 6. Checks

- **`places-confirmed`**, scored: the share of a day's shown places that came back `confirmed`. It is the "Places exist" row the checks table has waited for since MVP 3, and the "verified places" column the MVP 5 table names. The rounds give 72%; its threshold is an alarm for a fall, about 60%, not a gate on a single day.
- **`provider-shift`**, a measure on the confirmed names: the largest distance in the day from the model's point to the provider's, its findings each place past 250 m. The rounds give a median near 70 m and 90% within about 240 m; past 500 m the model guessed the coordinates.
- **`places-wait`**: how long the close waited for the last checks after the model's last word, failing when it waited the whole deadline, so the log shows how often a day hits it.
- **Tests on recorded answers, no call:** the place rounds kept every lookup with Geoapify's answer (`place-checks.jsonl`), so a recorded day can stream on the fake Claude with its places answered as Geoapify answered them: a check per shown place, in the stream's order; a failed lookup ends `unchecked` and the day completes; leaving stops the lookups; the deadline closes the stream on time; the record's checks hold both results.

## 7. Better name matching, before the mark ships

The first aim: the rule should confirm more of Kyoto and of walks. The recorded answers say why each named place missed, at no cost (the current matcher run again on the lookups the place rounds kept). Of Sonnet's 297 named places in `day-v5` and `day-v6`, 167 are confirmed (56%) and 130 are not:

| why the nearest candidate failed                            | places | where                                                                                                                                                                   |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the right name, beyond the kind's radius                    | 35     | Kyoto's temples 203 to 482 m off (Honen-in, Anraku-ji, Konchi-in, Eikan-do); Lisbon's and Alicante's gardens near 490 m; Alicante's co-cathedral at 661 m               |
| no candidate came back                                      | 40     | mostly descriptions, not names: "Okazaki Park Pond", "Tatsumi Bridge Lane", "Paseo along the Explanada de Espana"; also "Heian Jingu Shinen Garden"                     |
| a candidate in place and of the kind, but the name scored 0 | 19     | "Nanzen-ji Temple" against "Nanzen-ji" 47 m away, its words left out as its own district's; walks against another street ("Philosopher's Path" against "Path of peace") |
| the right name in place, of another category                | 15     | a beach for a walk (Playa del Postiguet, four times); a square mapped as a street for a viewpoint (Largo das Portas do Sol)                                             |
| two or three criteria                                       | 21     | mostly a city or a different place                                                                                                                                      |

What to change, each measured on the same recorded answers before it ships:

1. **Radii by grounds, not by doors** (the largest share). A temple, a church and a garden have precincts whose middle is off the gate; their 200 m and 300 m were set by venues. Re-run with 200 m more, 24 of the 35 confirm, all with a name score of 1. The new radii are set where the right ones fall, and every new confirmation is listed for an audit by eye, as the decision's 39 were.
2. **A place that gives its district its name.** When leaving out the district's words leaves nothing of the name, compare the whole name: "Nanzen-ji Temple" in Nanzenji. A few places, Kyoto's mostly.
3. **Categories a kind may come back as:** a beach for a walk and a viewpoint, a square mapped as a street for a viewpoint. About six.
4. **A walk by its street.** A walk is a route, and its name usually holds a street or a canal's ("Shirakawa Canal in Gion" by "Shirakawa"); a street candidate within the walk's radius sharing that one word confirms it. Kyoto's walks most.
5. **Left as they are:** descriptions that name no place ("Okazaki Park Pond", "Walk along the Postiguet") stay unconfirmed: the rule should not vouch for them, and the prompt already asks for names. A second, looser search for the 40 with no candidate would cost a credit each and can only be measured with new lookups, so it waits for a round.

**Expected:** named places from 56% to about 69% (167 to about 205 of 297), most of it from the radii; all places from 72% to about 79%, Kyoto most. The audit sets the final figure: a looser rule is worth it only while what it confirms is right.

**Built and measured on 2026-10-31** (`src/lib/places/match.ts`), replayed on every Geoapify answer the four place rounds recorded (`day-v4` to `day-v7`): Sonnet's named places confirmed rose from 358 to 427 of 621 (58% to 69%), Haiku's from 209 to 248 of 388, and no place the rule confirmed before was lost. With the meals' 91%, about 79% of all the places a day shows would carry the mark, against 72%. The radii became 400 m for a temple or a church and for a viewpoint and a market, 500 m for a garden, 300 m for a museum, 600 m for architecture and 700 m for a walk. A candidate whose names say another kind of place and none of the place's own never confirms it (`namesAnotherKind`): with the wider rings, it keeps a market from standing for the shrine at its end, and it set six wrong matches of the rule before right, "Chafariz do Largo do Carmo", a fountain, standing for the Igreja do Carmo among them. Of the 58 places newly confirmed, 55 are right, two are the right place found by a part of it (Eikan-dō's precinct map, Shinnyo-dō's main hall), and one is doubtful ("Jardim Augusto Rosa" as a memorial of that name); the list is `docs/place-match-audit.md`, for the eye check the decision's 39 had.

## 8. Built (2026-10-31)

- **`src/lib/stream/place-checks.ts`**, loadable in a browser: the data part (`data-place-check`) and its schema, `readyPlacesIn`, which finds the places of a partial day whose name, kind and coordinates are final and keys each by the normalizer's id, and `withProviderPoints`. A test runs it over every curated and edge day, the repaired one included, and every place the normalizer keeps has its check under its own id.
- **`src/lib/live/place-checks-in-stream.ts`**, on the server: reads the model's text as it arrives, letters escaped twice unescaped as the reader reads them, starts each check once, and makes the visitor's stream with `createUIMessageStream`, the model's parts merged and the checks written beside them. The stream closes once the model has ended and every place it finished has its answer, or at the deadline; the AI SDK closes it only when its `execute` and every merged stream are done, which was read in its source before building.
- **`src/lib/live/live-day.ts`**: the visitor's call alone checks its places, when `placeVerifier` is given (`services.ts` gives Geoapify's); the shadow and the eval's rounds run without, so the place round stays the measurement. Its record's checks gain `places-confirmed`, `provider-shift` and `places-wait` (`src/lib/quality/place-results.ts`).
- **The reader** hands each check to the page as it arrives (`onPlaceCheck`), skips a part it cannot read, and gives the complete day with each place confirmed by name at the provider's point; a cut or a lost day keeps the model's points.
- **Tests on a fake verifier**: a check per place the visitor sees, `checking` then its answer; the shadow never checked; a lookup that never answers closes the stream at the deadline, its place `unchecked` and its lookup stopped; a failed lookup `unchecked` and an answer the rule could not confirm `unconfirmed`; leaving stops every lookup; the record keeps the three checks.

## Cost, payback and what it displaces

| piece                                                                                                                | hours        |
| -------------------------------------------------------------------------------------------------------------------- | ------------ |
| Checks in the day's stream: when a place is ready, data parts, the close's deadline                                  | 4 to 5       |
| The reader: states into the drafts and the itinerary, the provider's points                                          | 2 to 3       |
| `places-confirmed` and `provider-shift` into the record's checks, tests on recorded answers                          | 2 to 3       |
| **The lean v1, before the card state**                                                                               | **8 to 11**  |
| Better name matching (section 7): radii, the district rule, categories, walks by street, the audit; built 2026-10-31 | 4 to 6       |
| **In all**                                                                                                           | **12 to 17** |

No model spend: Geoapify's free plan costs nothing, and both parts are tested and measured on recorded answers. One live day on preview, about $0.09, shows it end to end before production.

**Payback.** It is the MVP's third outcome and the "verified places" column of the fifth, and it says on the page which places Lantern stands behind.

## Not in this contract

- **The card's look**: what `checking` and `confirmed` show, and whether a swap's options show their states.
- **A cache, a log column and a credit counter**, left out of v1; the log's checks say when any of them is needed.
- **Google Places as a fallback**, which the decision keeps for later.
- **The shadow**, never checked.
