# Lantern

@AGENTS.md

Lantern plans one day in a city, hour by hour, as quiet or as lively as the visitor wants it. A generative model lays out the day as typed JSON, and deterministic React components render it. **The public site is a finished product.** Nothing on the site names the stack or speaks to anyone but a visitor: no provider names in pages, metadata or responses, beyond the licence-required OpenStreetMap and Geoapify credit, who runs it on `/privacy`, and the owner's name in each page's author tag, which shows on no page. The project's story lives behind the owner's password in `/studio`, where `/lab` is too. Scope, stages and dates live in `docs/roadmap.md`; the reasoning behind decisions lives in `docs/decisions.md`.

## Ground rules

- **Current stage: v1.0 (from 2026-11-09).** Live calls to Claude and Geoapify run only behind the `LIVE_GENERATION` flag. It has been on in production since 2026-10-31, behind per-visitor limits and the app's daily and monthly spend caps (`src/lib/live/limits.ts`); a schema change that a live day writes needs production migrated before the release that carries it (`docs/harness.md`, "Database"). Provider API keys and secrets, the studio's password (`STUDIO_PASSWORD`) among them, live only in `.env.local` and Vercel's environment, never in the repository. One credential lives elsewhere: the production read-only role's connection string, in the owner's macOS Keychain, read only by `pnpm prod:read` (`docs/ops.md`). Tests never call a live service: they run on mock models and recorded responses.
- **Work reaches `develop` through pull requests; `main` holds only releases.** Commit on a branch named `<kind>/<words>`, one change each, with conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Once the definition of done holds and `/pr-ready` is clean, the engineering session pushes the branch and opens a pull request into `develop`; once its checks on GitHub pass, the engineering session squash-merges it, and Vercel builds `develop` as a preview. A release, on the owner's word, fast-forwards `main` to a `develop` that passed the gate and is tagged (`v1.1`, or `v1.0.1` for fixes alone); Vercel builds production from `main`. Only the engineering session pushes, and only a work branch, or `main` and its tag for a release; `develop` moves only by a merged pull request. Agents never push and never merge.
- A pre-commit hook runs `pnpm check`. Never bypass it with `--no-verify`; fix what it reports.
- **Comments say what is true now.** State the rule and one clause of why, in the present tense; name a state ("with live generation off"), not a stage or a date, and cite a decision by its heading in `docs/decisions.md`. What used to be true belongs in the decision's entry and in git.
- When a decision is worth explaining to someone who reads the code later, add an entry to `docs/decisions.md`.

## Everything committed is public

The repository is public, and so is everything pushed to it, `develop` included: code, comments, docs, fixtures, screenshots, commit messages and branch names. Write each for a reader of the code. `src/lib/repo-hygiene.test.ts`, in `pnpm check`, the `commit-msg` hook, and the pull request check (`scripts/check-pr-text.mts`, run by `.github/workflows/pr-text.yml` on the branch name, title and body of each pull request into `develop`) hold the plainest of these rules; the rest are kept by whoever writes.

- **English only,** in code, comments, docs, UI copy and commit messages. The exceptions are test data that exercises other scripts, listed in the hygiene test.
- **Say what is true and why, never how it was agreed.** No record of conversations, approvals or requests, of who asked for what, and no quotes from a chat. A product call is stated with its reason; a comment cites a decision. Sessions, agents, tickets, rounds of work, worktrees and reviews are how the work gets done, not what the code is, and stay out.
- **Nothing personal** about the owner or anyone else: background, plans, skills, whereabouts, or words from a chat or a note. An agent's brief describes its role and its work.
- **No pointers that leak or rot.** No links to chats, sessions or shared pages; no local paths, machine or account names; no ids of production records; no secret and no hash of one. No commit hashes or branch names in docs or comments, since history can be rewritten: name a date or a state.
- **Plans and notes stay out of git.** Status, handoffs, ask lists, transcripts and working notes live in a session's memory or in the gitignored `/notes/`. The repository holds what is built and why: `docs/decisions.md`, `docs/harness.md`, and the scope in `docs/roadmap.md`.
- **Security docs describe the controls in place.** An open weakness, and how one would use it, stays out of the repository until it is fixed.
- **A commit message is a short record for a reader:** the subject says what changed, the body why. It tells no story of the work and names no one who did it, beyond the co-author trailer. That trailer ends every commit and every pull request's body, since a pull request's body becomes its squash commit's: the work is written with Claude, and the history shows it.

## Commands

Node 24 (`.nvmrc`) and pnpm (pinned in `package.json`; run `corepack enable` once). `pnpm install` also turns on the commit gate in `.githooks/`; an install that is already up to date skips that, so run `pnpm run prepare` once. In Claude Code, a SessionStart hook (`.claude/hooks/use-project-node.sh`) puts this Node first on PATH; if `node --version` is not 24, the hook did not run.

| Command                | What it does                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`             | Dev server on port 3000                                                                                                                                      |
| `pnpm dev:lan`         | The same, reachable from a phone on the local network at `http://<computer's IP>:3000`                                                                       |
| `pnpm check`           | Format check, lint, typecheck, and unit tests with an 80% coverage gate (routes are excluded and covered by e2e). Runs on every commit.                      |
| `pnpm e2e`             | Playwright on desktop and phone. Its own server (port 3417, `.next-e2e`) runs alongside `pnpm dev`; a parallel session sets `E2E_PORT`                       |
| `pnpm e2e:visual`      | The matrices' visual baseline at a phone's width, in both themes. Never beside `pnpm e2e` in one checkout: they share `.next-e2e`                            |
| `pnpm e2e:busy`        | `pnpm e2e` with each page's CPU twice as slow, as on a busy machine; `E2E_CPU_RATE=4` for one spec. Before a frame-by-frame spec lands                       |
| `pnpm e2e:replan-pace` | The fork's story on the Elche bench (`e2e/replan-story.spec.ts`) alone, at the bench's live pace, which `pnpm e2e` plays too. Before a re-plan change merges |
| `pnpm build:check`     | The production build Vercel runs, in `.next-build` beside a running `pnpm dev`, then served and asked for its pages, as production renders them              |
| `pnpm format`          | Prettier, including Tailwind class sorting                                                                                                                   |

## Architecture

- **The data contract is `src/lib/schema/itinerary.schema.ts`,** and `intake.schema.ts` beside it reads the visitor's text into a request. Never redefine their shapes or vocabularies elsewhere; import them.
  - `Generated*` schemas are what the model is constrained to. Keep them portable: no numeric, length, count, pattern or format keywords (the one exception is the day's `minItems: 1` on stops), strict objects only, and every field required, never `.optional()`. A test enforces this.
  - Nullable is a union type and counts against the provider's grammar limit: for "none", prefer an empty string or an enum member. A union type or an optional field joins the schema only after `EVAL_ROUND=schema pnpm eval:live` shows Claude takes it (`docs/decisions.md`, "The model's schema keeps its union types few").
  - App-layer schemas (`Itinerary`, `Stop`, `Place`) add ids, request context and invariants. A normalizer builds them from a finished generation.
- **The model never emits markdown or HTML.** Text fields are plain strings; components own all rendering.
- **Interactivity is local.** The energy slider, swaps and light calculations run on the client. A model call happens only to read the visitor's first text (the intake) and for structural regeneration.
- **Swaps change selection, not data.** `Stop.selectedPlaceId` is the day's plan, the primary place or one of its alternatives, and a swap never writes it: the visitor's picks live beside the day, by stop id, in `useEnergyCurve`. Place ids double as Motion `layoutId`s and are unique per itinerary.
- **State that follows a prop is set while rendering.** Where a component must answer a changed prop or state in the same paint, it sets state during render, guarded by a condition the set itself makes false, most often the previous value it stored (`if (lastRoom !== room) { setLastRoom(room); … }`), as React's "You Might Not Need an Effect" describes under "Adjusting some state when a prop changes". An effect would paint one frame with the old state first, which on a streamed page reads as a flash or a jump. Nothing outside React (a timer, a fetch, the DOM, an event) is touched there: that stays in effects and handlers.

Layout:

```
src/app/                    routes: / (the start screen), /day/[city] (a written day's slug or a kept day's id),
                            /privacy, the API (intake, day, day/[id], replan, events), and /lab and /studio
src/proxy.ts                asks for the owner's password on /lab and /studio, and nowhere else
src/features/<x>/           components, hooks and logic per feature; day, abacus and itinerary open on a README.md
  day/                      the page around a day: the start screen, the request as a sentence, the day's plan,
                            the visitor's days, kept days, and the orchestrator (day.tsx)
  abacus/                   the chart: rows, beads, the energy curve and swaps, light on the time axis,
                            the streamed draft and a re-plan's fork
  itinerary/                the stream on the client: the hooks that play a day or a re-plan, and what of a partial
                            day may be drawn (revealed.ts)
  theme/                    the visitor's theme, set before the first paint
  analytics/                page views, each kept day's id left out and none from the owner's browsers
src/eval/                   the paid eval (`pnpm eval:live`): rounds that call a model or write round files;
                            no non-test module in src imports it
src/components/ui/          primitives built on the design tokens
src/lib/                    everything under the React layer, mapped in its README.md
  schema/                   the data contract: the day, the intake, the re-plan
  normalizer/               a finished generation to the app layer: repairs, refusals, ids
  stream/                   the wire: the simulator, the reader, the seven outcomes, place checks, POST /api/day's handler
  live/                     live generation on the server: model calls, prompts, limits and spend, the generation log
  intake/                   POST /api/intake: the model reads the text, the city is looked up and signed
  replan/                   a targeted re-plan: its request, windows and merge
  days/                     the thirteen written days the site serves (written/), a day's address, a kept day's
                            record, and what GET /api/day/<id> answers
  places/                   Geoapify and place matching
  quality/                  checks over one generation, recorded on every live day
  events/                   anonymous product events: schema, sender, route handler, stores, report
  db/                       the Sql port, the migrations runner, read-only reports, crashes that print no secret
  fixtures/                 hand-made and edge days, golden sets, test doubles: for the tests and the lab alone
  geo/, time/               the sun, light windows and distances; the clock past midnight
  tokens/                   Motion springs, icon sizes, the root's size, the token catalog, the lint's and palette's tests
  http/                     security headers and the studio's lock
  analytics/, brand/, ops/  what a page view leaves out; the link card and the favicon; pnpm prod:read
  *.ts                      the site's address, same-site posts, Server-Timing, browser storage, the lab matrix's shape,
                            the rules for what is committed
db/                         forward-only SQL migrations, and the read-only production role
scripts/                    build check, migrations, reports, the production read, the paid eval round and its table,
                            the favicon, the commit message check, the pull request text check
e2e/                        Playwright specs; e2e/visual/ holds the matrices' pixel baseline
assets/fonts/               Literata: the page's face, and its cuts to Latin for the link card the server draws
.githooks/, .github/        the commit gate (pnpm check) and the commit message check; CI: pnpm check and build:check
                            on pushes to develop and main and on pull requests; pnpm e2e in four shards, all but the
                            @frame tests, on pull requests that change more than inert paths, on pushes to main and
                            by hand, answered as one check, E2E result, in Playwright's own image; the @frame tests
                            alone by hand; the pull request template, and the check of a pull request's text
docs/                       decisions, harness, design direction, security, ops, roadmap, case study, the contracts
                            (targeted re-plan, grounding, voice), discoverability; brand/ and media/ (the README's demo)
```

## Designing components (Dynamic UI)

The model writes the content, so a component is designed for the whole space of data and states, not for one mockup:

1. **Every value the schema allows** must look intentional: shortest and longest text, `null` fields, 1–3 tags, 0/1/2 alternatives.
2. **Lifecycle states:** nothing yet (no skeletons: only what has arrived is shown) → partially streamed (fields arrive in schema order) → complete → interactive (swapped, collapsed by the slider), plus every ending without a day (`src/lib/stream/outcome.ts`), which a written day's own page never shows: there a play that ends without the day gives way to the day whole (`docs/decisions.md`, "A written day's page is built whole, and plays only for a visitor who has not seen it"). Transitions preserve layout and can be interrupted. A streamed number or enum value is final only once the next field has started: a duration grows 1 → 15 → 150 as it streams, and a string can stop mid-word.
3. **Density is an axis:** open, standard and folded variants of the same data. On the abacus a row's density follows the energy of the version it shows (`docs/decisions.md`, "The day is drawn as an abacus").
4. **Props are schema types** (`Place`, `Stop`, or the draft types while streaming, `StopDraft` and `DayDraft`). Enum values map to labels deterministically.
5. **Registered in `/lab/matrix`:** a `labMatrix` entry (`src/lib/lab-matrix.ts`) beside the component lists its states × densities × data extremes as plain data, driven by fixtures that include edge cases, and is added to `src/app/lab/matrix/matrices.tsx`. The renderer sets every cell in both themes, at a phone's width and at the column the component takes on a laptop (the abacus's for the chart's parts, the page's for the header; an entry declares `wide`). The baseline (`pnpm e2e:visual`) shoots a matrix's default view at a phone's width; declare `baseline` for other views or none. Phone cells are containers, so their type reads true at any viewport width. `/lab/stream` scrubs a fixture day's stream frame by frame and ends it in each outcome.

## Consistency

- **Design tokens only.** Visual values live in `src/app/globals.css` (a closed Tailwind theme: colors, type scale, spacing, widths, radii) and `src/lib/tokens/` (Motion springs, icon stroke and sizes). Lint rejects classes outside the theme, arbitrary values (`text-[13px]`), per-class durations, `dark:` overrides, removed focus outlines, raw colors (hex, `rgb()`, `oklch()`…), literal values in `style` and CSS imports. Lint only sees class strings in `className`, `cn()`-style helpers, constants named `*Classes` or `*_CLASSES`, and `className` keys in object literals, so keep them there. Need a new value? Add a token, list it in `src/lib/tokens/catalog.ts` (a test checks the two match), and it shows up in `/lab/tokens`.
- **The keyboard's focus ring is `focus-ring`,** or `focus-ring-inset` where what stands around an element would cut it (`src/app/globals.css`). A ring of another shape is written where it is drawn, and the comment above the two utilities says why each one differs.
- **Colors carry both themes** through `light-dark()` in `@theme inline`, so `data-theme="light|dark"` on any element switches its subtree, except under forced colours, where the device's theme stands. Keep colors inline: a `--color-*` variable on `:root` freezes one theme.
- Build feature components from the primitives in `src/components/ui`, not from one-off styled divs.
- Anything that moves uses a spring from `SPRINGS` (`src/lib/tokens/motion.ts`), so feel is tuned in one place.
- If a token edit does not show up in `pnpm dev`, stop it and delete `.next/dev`: Turbopack has served a stale stylesheet before.
- Project skills, distilled from the golden component (the one-row stop): `/lab-component` is the order of work for building or changing a component, and `/ui-review <branch> <dev server URL>` reviews UI work in a fresh agent before it merges.

## Definition of done

- `pnpm check` and `pnpm build:check` pass. For UI changes, `pnpm e2e` passes too, `pnpm e2e:visual` passes or its diffs are reviewed and the baseline updated on purpose, and you have reviewed screenshots at desktop and phone widths in both themes.
- New logic has tests; components are covered by Testing Library and `/lab`.
- No `console.log`, no unused code, no values outside the tokens.
