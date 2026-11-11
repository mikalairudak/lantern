# Lantern Roadmap

Status: v1.0, 2026-11-09. Planned 2026-10-20; fixtures-only build done 2026-10-27; live since 2026-10-31; the milestones after v1.0 planned 2026-11-10.

## What we are building, and for whom

Lantern is a small, finished product first: a few things done completely. It may grow into a larger one later, and nothing here should prevent that.

Most visitors arrive from a shared link and give it 30 seconds to 3 minutes. Success means they remember the signature interactions.

Principles:

- **Depth over breadth.** A few signature interactions polished to 100%, everything else kept minimal.
- **One filter for every decision:** will a visitor see it?
- **Production-grade where undoing is expensive.** The data contract and module boundaries are built properly from day one. Infrastructure that is cheap to add later (auth, database, payments) waits until Lantern becomes a product.
- **Typography-first.** A day stands on its type and its light, without photos. Pictures may help a visitor choose a way in (`docs/decisions.md`, "Pictures may help a visitor choose a way in; a day needs none").

## The first ten seconds

A visitor lands on one line about what Lantern is and one question, "Where, and anything else", with "Plan this day". Under it stand six quick starts, days Lantern has already written, each said in the product's words ("A lively Saturday in Bologna, with friends") beside a small drawing of its day's shape. No day is on screen until they press: a start writes its day in place, the same every time, and it is theirs to change. They drag the energy curve and the day reshapes around it, tap a stop's quieter or livelier bead and that version takes its place, and read on the time axis when the light turns golden, then blue, then dark. Or they type their own city and a few words: Lantern reads them in about a second and writes the day live in the same place.

Pre-MVP builds all of this on fixtures: before launch the visitor's text plays only a day already written, and any other city is told Lantern is not writing new days yet. MVP connects the intake and the day to live models and makes it safe to share.

## Timeline

This plan assumes daily review sessions with the owner. Most of the iteration time goes into the golden component and motion tuning. Each week ends with a checkpoint review.

| Dates           | Focus                                                                               | Checkpoint                                        |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| Oct 21 – Oct 27 | Pre-MVP steps 1–5: scaffold, tokens, primitives, data without services, `/lab`      | Tokens, text roles, matrix and scrubber in `/lab` |
| Oct 28 – Nov 3  | Pre-MVP steps 6–8: golden component, skills, canvas                                 | One-row stop approved; a curated day streams in   |
| Nov 4 – Nov 10  | Pre-MVP steps 9–10: features, polish                                                | **Pre-MVP done**, with a screen recording         |
| Nov 11 – Nov 16 | MVP steps 1–5: hosting, live generation, grounding, cost protection, quality checks | A live day for a typed-in city, on a preview URL  |
| Nov 17 – Nov 19 | MVP step 6: packaging                                                               | **Send-out on Nov 19**                            |

The case study and the decisions log are in this repository and in `/studio`; the site does not link to them.

**Where we are (2026-10-28).** Pre-MVP steps 1 to 10 are done in week one. Before the screen recording come the polish from the owner's first look at the deployed day and one design round, so the recording shows what MVP builds on. The weeks it frees go to MVP, whose dates hold: the send-out date is fixed, and an early start on hosting and live generation buys room for grounding and the eval.

**Where we are (2026-11-05): the public site is the product.** Live generation has run in production since 2026-10-31. The milestone holds:

- **The day page:**
  - the day can be read as a chart or a list, the choice kept on the device;
  - a written day's page is served whole from the CDN, and a day already watched opens whole;
  - the versions a visitor picks are kept on the device;
  - a stop's sheet opens Google Maps and says what was checked;
  - the phone's first screen gives more of itself to the day;
  - the stream draws no version the finished day drops.
- **Only the product is public:** the public site offers only the six quick starts the product wrote; the hand-written days moved to the lab bench.
- **Security:** the firewall's two rules, the studio's lock and provider names stripped from responses.
- **Evaluation:**
  - round A kept Sonnet writing the days: Haiku is a twentieth of the price per token, about 24 times cheaper per day as measured, and twice as fast, but leaves a third of its stops without versions (`docs/harness.md`);
  - a model judge for the voice was built and calibrated.

Left before the send-out on 2026-11-19, in order:

1. A version's name on hover, focus and drag.
2. On a phone, the energy scale held in view, with a way back to the plan.
3. The day's end in the interface: its summary, the calendar, the walking route and the link; the "Written in" line goes.
4. The palette: a lighter day ground, one green for energy, drawn rings for versions.
5. The small things: the "bar ⌖" jump on a laptop, an error page in the product's voice, and the matrices' phone cells at the page's width.
6. A last pass on real phones, iPhone and Android.

After it: `/studio` as a walk through the project, and a digest of the decisions.

**Where we are (2026-11-09): v1.0.** The milestone is reached, and is tagged `v1.0` once the repository is public. Since 2026-11-05:

- the list left before the send-out is done, its phone pass on WebKit (iPhone 15) and Chromium (Pixel 7) emulation rather than on real phones;
- a changed word proposes the part of the day it shaped beside the day, as a fork the visitor takes or leaves, and a failure changes nothing (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor takes it");
- company re-plans the stops that name it; travel, and a word no stop names, change the word alone;
- the start screen gives the page once Lantern's words for the headline are whole;
- the page has a footer: the sources on its left, Lantern's links on its right;
- a written day is shown on the next date of its weekday, and its page shows its day whatever its play ends with, which is also what a search engine reads;

Next: the milestones below. Each of the six written days gets its next season before `pnpm days:fresh` says its light stops holding: early December for Kanazawa and late January to early February for the rest, by its count on 11 November (`docs/decisions.md`, "A city's written day is one of its seasons, picked by the date it is shown on").

## After v1.0: three milestones

Each milestone is one release. Its work reaches `develop` as small pull requests (`docs/decisions.md`, "Every change reaches develop as a pull request the owner merges"). There is no date: each milestone is done when all of it is done.

1. **Foundation (v1.0.x).** The way work lands, and what is measured before the start screen changes:
   - every change through a reviewed pull request, its text checked, and `develop` merged only from a green one;
   - one fix taken from a branch to a release, `v1.0.1`, to prove the path end to end;
   - the events that say whether a day was used: the start screen seen, a day read to its end, and the way in and the view of each day's gestures; and their values before the start screen changes;
   - the header's top row aligned;
   - the lint's dependencies updated.
2. **First impression (v1.1).** What a visitor sees in their first ten seconds, released as one:
   - a start screen with two ways in, the question and tiles for a mood or an occasion, each tile opening a day already written for it, and a still excerpt of a day beneath them; the six written days leave it and keep their pages, as examples a search can find;
   - a day shown first as a plan to read, with its light, and the chart as its second view;
   - the header's remaining polish, the tiles' picture style, and a reaction a visitor gives in one tap;
   - a test with five people;
   - the events compared with their values before.
3. **Day quality (v1.2).** The day itself: the model's and the data's open issues, and the six written days' next seasons.

After them: a weekend, tiles by season or region, and a page of the product's measures in `/studio`.

## Pre-MVP: the canvas, on fixtures

**Goal:** the full experience runs locally on hand-made fixtures, with no external services and no API keys.

Outcomes, in order:

1. **Scaffold.** Next.js App Router, TypeScript strict, Tailwind, Motion, Zod, Lucide. Vitest, Testing Library and Playwright. ESLint and Prettier. A project `CLAUDE.md` and a decisions log. The schema checks become `itinerary.schema.test.ts`.
2. **Tokens.** Color (light and dark), a type scale with text roles (one sans in one weight, `docs/design-direction.md`, "Type: one sans"), spacing, radii, icon stroke, and motion springs and durations. Lint rejects any value outside the tokens.
3. **Primitives.** Text roles are theme utilities (`type-voice`, `type-prose`, `type-name`, `type-note`, `type-time`). Components in `src/components/ui` are lifted from the abacus when the one-row stop moves into `src/features` in step 6, with the `cn` class helper, rather than designed ahead of it; a meter and a tag only if the density decision brings sound, crowd and tags back to the row.
4. **Data without services.** Curated fixture days for two or three cities, plus edge-case fixtures, and the request schema (city, date, energy preference). The normalizer (`GeneratedDay` → `Itinerary`) with tests; it returns the repairs it made alongside the itinerary. Quality check functions in `src/lib/quality/`, run in Vitest over every fixture. A stream simulator built on the AI SDK's mock model, which replays fixtures as partial objects, simulates failures (refusal, slow start, rejection, cut stream, invalid result, dropped connection) and ends every stream with an explicit outcome. If the week slips, the checks move to week two; the outcome protocol does not, because step 8 designs the failure states against it.
5. **`/lab`.** A matrix renderer: a component lists its states × data extremes × densities × themes × widths as plain data beside it, and one renderer lays the list out. A stream scrubber that plays any curated or edge day through the harness's simulator and reader, frame by frame, ending in each of the seven outcomes. A composition page.
6. **Golden component.** The one-row stop: each stop is one row of the abacus, with its name at its bead (`docs/decisions.md`, "The day is drawn as an abacus"). Polished together to 100% across every state and density.
7. **Project skills,** distilled from the golden component: `lab-component` and `ui-review`.
8. **Canvas.** The day header and timeline, the streaming entry choreography, a curated-day switcher, and the "Plan your own day" request form. One hook reads partials and the outcome from the app's own route, `POST /api/day`, which streams curated days through the simulator now and Claude in MVP. Failure states, including what a cut stream still shows, are designed here against the simulator's outcomes, so MVP only has to wire them up.
9. **Features,** in this order: energy slider, then quick swap, then light radar.
10. **Polish.** Dark mode, phone width, keyboard access for the slider and swap, reduced motion, and a visual-regression baseline, now 1,074 shots and about 37 MB, kept in plain git.

Phone review happens over the local network (`next dev -H 0.0.0.0`), so hosting is not needed yet.

**Done when:**

- A curated day plays from the simulated stream with no layout jumps, and all features work on desktop and phone.
- Every component and failure state appears in `/lab`, and tests and visual regression pass.
- There is a screen recording we would be comfortable showing.

## MVP: live and shareable

**Goal:** a link you can send to anyone. It works for a city they type in, shows real places, and cannot run up a bill.

Outcomes:

1. **Hosting** on Vercel, with preview deploys, and CI on GitHub Actions running `pnpm check` and `pnpm e2e`.
2. **Live generation.** A route on Claude that streams with `streamText` and `Output.object`, and a system prompt covering voice and anti-slop rules. The route ends every stream with the same outcome as the simulator, so the UI reads it through the same hook, and the failure states designed in pre-MVP are mapped to real errors. Before the day, an intake call reads the start screen's free text into a typed request, or a question when the city is missing or shared by several (`docs/harness.md`).
3. **Place grounding through Geoapify** (OpenStreetMap's data; Google Places until 2026-10-28). Every place is verified before it renders, and coordinates come from the provider, not the model. Verification is a card state, so the streaming choreography holds.
4. **Cost protection (hard requirement).** Per-visitor rate limiting and a provider spend cap on the public endpoint.
5. **Generation quality checks.** The check functions from pre-MVP step 4 run over live generations for a golden set of twelve requests (listed in `docs/harness.md`; eight until 2026-10-31); the curated fixtures calibrate the thresholds. A script writes the results table the README shows: schema validity, walk radius, verified places, banned phrases and the rest of the checks. The same script runs the intake's golden set, 45 texts, scored by exact match.
6. **Packaging.** A README that explains the architecture, the case study, a demo video, and a public repo.

**Done when:**

- A stranger on a phone gets a grounded day for their own city, and every failure path shows a designed state.
- The endpoint cannot exceed the spend cap.
- The README, case study and video are published, and the repo is public.

## If we fall behind

The date holds; scope gets cut. Cut in this order, starting with what a visitor is least likely to notice:

1. The visual-regression baseline. Keep the `/lab` screenshot review.
2. The eval script and its README table. The checks keep running on fixtures; spot-check live days by hand.
3. Place grounding. Fall back to curated cities whose places are already verified.

Never cut: cost protection, designed failure states, the polish of the signature interactions, the demo video.

## Feature set

We start with three features: energy slider, quick swap and the light on the chart (the light radar until 2026-10-28). The set is open. A new feature idea goes through the same filter as everything else. Before Nov 19, adding one means naming what it replaces or which cut it triggers.

## Post-MVP: product candidates

These are not commitments. Each one waits for a single trigger: deciding to turn Lantern into a product.

- A weekend: two days in one city, then trips of more days.
- Saving and sharing a day (a link first, then accounts).
- An editorial map view for spatial context.
- Provider photos as an optional layer.
- Weather-aware light (cloud cover means diffused light).
- A personal taste profile across trips.
- Live opening hours and crowd data.
- **A paid place in the meal's slot:** a café or restaurant asks to be recommended where a day says where to eat. Only labelled as paid, and only once Lantern becomes a product.
- **Hours set on the chart.** The visitor moves the day's ends on the time axis: a day written from 9:45 to 22:30 could start at 7:30, or run to 4 or 5 in the morning. A night that long needs what the city's nightlife does after midnight, which the places provider would have to supply. Today the sentence's start and end words carry this coarsely.
- **Travel that widens the day.** Public transport or a taxi would let the day reach a second district across the city: a future day prompt, `day-v12`, would budget its legs by the way of travel, with `day-flow` and the swap's walk read by it, and a change of travel would re-plan the stops it shaped. Today a day is planned a walk's way across whatever the travel word, and a change of travel changes the word alone (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor takes it").
- **The day ties a stop to the word it asks about.** A day leaves a word open, "with …?", as the answer that would change it most, yet can name no stop for it, so the answer changes the word alone. The day's prompt either marks `dependsOn` for the word it leaves open, or does not ask about one the day does not depend on.
- **A day already written opens rather than being written again.** A visitor who has seen a day never watches it written a second time. A day the system already holds might open with an animation of its own, never one that pretends to write it; the owner is not yet sure it needs one at all. Today the written days replay a simulated stream; a live day's stream is real and keeps its choreography.

## Non-goals

Booking, ratings and reviews, a chat interface, and social features.
