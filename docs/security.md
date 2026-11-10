# Security

Lantern's threat model and a ranked audit of its production at https://www.lanternday.com. A living document: each finding keeps its state, and agreed decisions move to `docs/decisions.md`.

First written 2026-11-02, against production and the code as they stood on 2026-11-01. The audit made no live call and cost nothing. Production saw only plain GETs: `/`, `/lab`, `/day/kyoto`, `/privacy`, the bare domain and `/robots.txt`. Every attack below was shown in unit tests on mock models and in-memory stores, or read in the code.

## Threat model

### What is worth protecting

| Asset                  | Where it lives                                                                                  | What a loss costs the owner                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Keys                   | Vercel's environment (production, preview), `.env.local` on the laptop                          | A spent workspace; a database read or wiped; a key to rotate everywhere                                  |
| Money                  | Claude workspaces: `lantern-prod` capped at $100 a month, `lantern-dev` at $50; Geoapify's plan | At most the caps: the app's own stop at $10 a day and $95 a month comes first                            |
| Live generation        | The caps above, shared by every visitor                                                         | Visitors get "not yet" with the written days, and the live site looks broken                             |
| Visitor text           | `generation_log.visitor_text` on intake rows, 30 days                                           | A privacy promise broken; a text a visitor would not want read                                           |
| Visitor counters       | `visitor_counters`: a salted hash of the address, per UTC day                                   | Pseudonymous history of who used Lantern when                                                            |
| Kept days              | `generation_log` rows, opened at `/day/<uuid>` for 30 days                                      | A visitor's day read by someone it was not sent to                                                       |
| The domain's good name | Pages on lanternday.com, mail from its address                                                  | Ugly or false words under the owner's name, shared by link or by mail                                    |
| The repository         | GitHub `mikalairudak/lantern`, public                                                           | Secrets or personal data in history; a path for a contributor's code to run on the laptop or in a deploy |
| The laptop             | `.env.local` (dev key, dev database), the user's npm config, SSH keys                           | Everything the laptop can reach                                                                          |

### Who can reach what

| Actor                     | Can do                                                                                          | What stands today                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous visitor         | Use the app: 10 live days and 20 intake reads a day per address                                 | Per-visitor counts under a salted hash, worst-case holds against the daily and monthly caps in one transaction (`src/lib/live/limits.ts`)                                                           |
| Scripted visitor          | Send any body to any route, rotate addresses (Tor, proxies, cloud machines), skip the page      | The same counts per address; zod on every body; the city's HMAC signature (`src/lib/live/city-signature.ts`); bounded re-plan input (`src/lib/replan/request.ts`). Nothing against rotation: see S3 |
| Another site              | Make each of its own visitors' browsers send a simple POST to Lantern, from their own addresses | A same-site check on every route that counts, keeps or spends, since 2026-11-02 (S2)                                                                                                                |
| Link holder               | Open one kept day at `/day/<uuid>`                                                              | Random v4 UUIDs; the read filters id, environment and `role = 'day'`; no visitor text in a day's row; `noindex`; 30 days                                                                            |
| Contributor (once public) | Open pull requests from a fork; ask the owner to check a branch out                             | CI with no secrets and `contents: read`, on `pull_request`; Vercel's Git Fork Protection; a fork's branch is checked out only in a throwaway clone (S11)                                            |
| Compromised dependency    | Run at install, at build (Vercel's build sees the environment) and at runtime                   | pnpm 12 blocks dependency build scripts except `unrs-resolver`; a built-in one-day release age, not strict; exact pins on the AI SDK, Next, Neon; frozen lockfile in CI (S10)                       |
| Account takeover          | Push to `main` (Vercel deploys it), read every key in Vercel, change DNS                        | The accounts' own sign-in protection: the one control the code cannot add ("Accounts")                                                                                                              |

The models have no tools and read no secrets, so prompt injection can only change words on a page. Where those words can reach someone other than the person who wrote the input, it matters. That is S1.

## Verified and left alone

Each of these was checked in code or tests and needs nothing. "Leave it" is the verdict.

- **Guessing a day's link.** Ids are `crypto.randomUUID()`, 122 random bits. `DAY_RECORD` (`src/lib/live/postgres-stores.ts`) reads only `role = 'day'` rows of its own environment, so a shadow's or an intake's id answers `unknown`. A day's row and answer carry no visitor text; the request (city, date, words) is shown, as `/privacy` says. Sharing a link shares the day, by design.
- **Prompt injection through the intake.** The shape is the defence (`docs/harness.md`, "Prompt injection"): the text is fenced, with its tags escaped, and the output is enums, an ISO date, a city that Geoapify must resolve and that the server then signs, and `unplaced` phrases shown only to the visitor who typed them. The day's model reads only the signed city and enums.
- **Model output on the page.** React renders it as text. The one `dangerouslySetInnerHTML` is the constant theme script (`src/components/ui/inline-script.tsx`); the map link is Google Maps' fixed address with the place's name and city, or its point, in its query, encoded by `URLSearchParams` (`src/features/abacus/map-action.ts`), so a name can add no parameter and change no address. No markdown, no HTML, no tool calls. **Out of the page** (the end of a day, 2026-11-05): the calendar file puts a place's name, quarter and summary in as RFC 5545 text, escaped, control characters dropped and lines folded at 75 octets, so no name can end a line or an event (`src/features/day/day-calendar.ts`, tested with hostile names); its zone, ids and points are checked for their form. The walking route's address carries the places' points alone, numbers, on Google Maps' fixed address (`walk-route.ts`). "Copy link" sends the day's own address and the page's title (`share-day.ts`). The visitor's own words reach none of them but the day's city, which the intake resolved, in the location of their own calendar file.
- **SQL.** Every statement is parameterized; driver errors are stripped of the connection string and its password before they are logged (`src/lib/db/redact.ts`).
- **Keys in the browser or the logs.** `GEOAPIFY_API_KEY` is read only in `src/lib/places/server.ts`, which refuses to load in a browser; no `NEXT_PUBLIC_` variable exists. Geoapify failures are enum strings, and the fetch error that could quote the URL with its `apiKey` is dropped (`src/lib/places/geoapify.ts`). Logs are JSON lines of event names and error descriptions, never a prompt or a visitor's text.
- **Secrets in git history.** Every commit on every ref was scanned for key and connection-string shapes (Anthropic, Neon, Postgres URLs with passwords, GitHub, AWS, Vercel, Slack, private keys). The only hits are test fixtures with fake hosts (`ep-test-1234`, `ep-dev-1234`) and placeholder passwords. `.env*` is ignored apart from `.env.example`, which holds names only. Every commit is signed with the GitHub noreply address. The studio's old login is the one thing the history held, and it was removed (S11).
- **Spend under concurrency.** Holds at each call's worst case, checked and taken in one transaction, expiring after 10 minutes (`limits-contract.ts` runs the same contract on memory and Postgres). A deploy without a database refuses live generation (`src/lib/live/flag.ts`).
- **The visitor's address.** It is read from `x-real-ip`, which Vercel's edge sets and overwrites, never from `x-forwarded-for`. IPv6 is grouped by /64, but the domain has no AAAA record, so today every client arrives over IPv4.
- **The city's signature.** HKDF from the salt under its own label, verified in constant time. A replayed signature only lets the same city be written again, under the same limits.
- **Retention.** Intake text is cleared 30 days after it is written, when Lantern is next used, as `/privacy` says (`src/lib/live/retention.ts`). Event salts are dropped the next day.
- **`/api/events`.** Enums and slugs only, a 1 KB body, per-visitor and per-app daily caps, and a same-site check. It is the model the other routes should follow (S2).
- **CI.** No secrets, `permissions: contents: read`, `pull_request` rather than `pull_request_target`, `--frozen-lockfile`.
- **HSTS** is Vercel's default, `max-age=63072000`. `access-control-allow-origin: *` on pages is Vercel's default for static responses; the pages are public and Lantern sets no cookies, so it exposes nothing.

## Findings, ranked as found

Ranked by what an incident would cost the owner times how likely it is. Hours include tests and review.

### S1. A re-plan's link shows words the client wrote, on Lantern's domain

**State:** fixed. The production stopgap went out on 2026-11-02; fix R reached production the same day at 15:51, removing the stopgap. One change from the plan below: the body keeps the page's `request`, since only the page knows the words a visitor took as their own or the energy picked again on the day; its city, date and zone must be the day's. A source that cannot name a day's basis answers null, and the page then re-plans the day whole. `src/lib/live/live-replan.test.ts` holds the regression: a body carrying a day is refused, and no client's line reaches the model or the link. The page's re-plan view, built on 2026-11-01, first reached production in that same push: neither push before it, on 2026-11-01 nor the stopgap's on 2026-11-02 at 13:39 (+0100), has a client call to the route (the pushed commits, read 2026-11-06). So the stopgap, from 13:39 to 15:51, refused no visitor's re-plan, and the page has re-planned in production since 15:51.

**Since 2026-11-07** the body also carries the visitor's picks, `{ stopId: placeId }`, so the kept stops are read as the visitor sees them and the new line about the day names them (`docs/decisions.md`, "A re-plan reads its day from the server's own records"). They are ids alone, at most `MAX_REPLAN_STOPS` of them, each shaped as the normalizer writes ids and at most 32 characters, in a body now bounded at 2 KB. The server reads each against its own record of the day (`picksIssueOf`): a stop the day does not hold, or a place that is not one of that stop's own, its primary or an option, is a 400 before any count or call. A pick moves only which of the day's own places a stop plans (`withPicks`), so the prompt and the record still carry no word the client wrote. Tests: `src/lib/live/live-replan.test.ts`, "refuses a pick of …" and "reads the kept stops as the visitor sees them".

**What happens.** `POST /api/replan` takes the day it re-plans from the client's body. The model reads only the kept stops' names and neighbourhoods, but the record keeps the whole client itinerary in `context`, and `/day/<re-plan id>` rebuilds the day from it (`shownReplanOf` → `mergeReplan`): every kept stop's summary, swap reason, light note and name is shown word for word. `MAX_KEPT_TEXT_CHARS` bounds only names and neighbourhoods; the other fields are bounded only by the 64 KB body. The model never sees the planted text, so it writes the window as usual and the re-plan ends `complete`. Kyoto and the other written cities need no signature. The result is a link on lanternday.com, valid 30 days, carrying any words the sender chose. React escapes them, so this is content injection, not script execution. `src/lib/live/replan-kept-text.test.ts` pins the behaviour, with a `text/plain` body.

**How likely.** Production has had the route since 2026-10-31, behind `LIVE_GENERATION`, which is on. No production page calls it yet, so a sender must first find the route. Its neighbours `/api/day` and `/api/intake` are visible in the client's JavaScript, and a wrong body answers 400 with every schema issue (S9), so the schema can be read from the route itself. Once the re-plan screen ships, "Copy as fetch" in DevTools is enough.

**Stopgap** (0.5 h, built). In production only (`VERCEL_ENV === "production"`): `POST /api/replan` answers 503 before it reads the body, and a kept re-plan opens as `failed` with its request, through both `GET /api/day/<id>` and the page. Preview and the laptop are unchanged. It costs no visitor anything while no production page re-plans, and it must leave with R: the re-plan screen cannot ship with it, nor without R. Production was checked for records planted before it, with `pnpm prod:read replans`, and held none (log).

**Fix R** (8 to 10 h in all). The server builds the day to re-plan from its own record, never from the client:

- The body becomes `{ basis, changed, value, round }`, about 200 bytes instead of 19 KB. `basis` is `{ kind: "written", slug }` for a written day (its address, `daySlugOf`) or `{ kind: "kept", id }` for a live day or an earlier re-plan (the id its answer named in `X-Lantern-Day`).
- The server reads the basis with `writtenDayAt(slug)` or `readStoredDay(id)` (status `written` or `cut`), builds the request from the basis's own request with the changed word, and plans the windows, the prompt and `context.itinerary` from it. The city's signature is no longer needed: the city passed when the day was written. `round` is checked against the basis.
- A re-plan of a re-plan reads one record, since that record's `context` is now the server's own.
- `shownReplanOf` shows only records whose `context` names a server basis, so a record planted before R never opens.
- A word changed just after the day lands may find its record not yet written: the server reads up to four times over about 2 to 3 seconds, then answers 409 with the reason, which the page takes through its usual reset. A `failed` or `expired` basis is a 409 or 410 the same way.
- The page's copy and the server's may differ by tens of metres in a point checked after the stream's deadline. The merge works on ids, order and times, so the harness accepts that; one test holds ids, times, names and selections equal across written, kept, cut and re-plan-of-re-plan bases.
- Files: `src/lib/replan/request.ts`, `src/lib/live/live-replan.ts`, `src/lib/live/stored-days.ts`, `src/lib/live/services.ts` (`dayArchive` in the re-plan's deps), `src/features/itinerary/replan-route.ts`, `use-replan-stream.ts`, `src/features/day/day.tsx`, their tests on PGlite. The eval round (`src/eval/replan-round.ts`) moves onto a fake archive. `docs/targeted-replan.md` ("Questions settled before the build", question 1), `docs/decisions.md` and `request.ts`'s comment change with it.

R also closes the last path for prompt injection into the day's model: the kept names it reads become words a model wrote from a signed city and enums.

**What it supersedes.** The answer of 2026-10-31 to question 1 of `docs/targeted-replan.md`, "Questions settled before the build": kept stops from the client, bounded, in a fence. That answer was about what the model reads; the link was not part of the question.

**Compared with V**, which checks the client's kept stops against the record and refuses a mismatch: the same hours, false 400s on exactly the word changed right after a day lands (points, escaping, float serialization), and the client's names still in the prompt. R is better.

**Prevents:** the owner's domain carrying a stranger's words in a link anyone can open. **Pays back:** the day the re-plan screen ships, which it must precede. **Displaces:** about a day of the re-plan screen's own work.

### S2. The routes that spend accept a POST sent by another site

**State:** fixed in production on 2026-11-02, with the S1 stopgap.

`/api/events` refuses a request whose `Sec-Fetch-Site` is not `same-origin`, and its comment says why: a page elsewhere can make each of its visitors' browsers send a simple request, from each visitor's own address, past every per-address limit. `/api/day`, `/api/intake` and `/api/replan` had no such check until the fix, and `request.json()` reads a `text/plain` body as JSON, so no preflight stands in the way. A page with traffic, or an ad, that posts Kyoto with one word changed (no signature needed) spends Lantern's daily cap from thousands of real addresses. The sender never reads the answers, so CORS (the browser's cross-origin read rule) does not help. This is the one way to drain the cap without owning addresses, and an edge rate limit per address cannot see it either.

**Fix** (built, 1.5 h). One rule, `isFromAnotherSite` in `src/lib/same-site.ts`, for `/api/day`, `/api/intake`, `/api/replan` and `/api/events`, before the body is read or anything counted. `Sec-Fetch-Site` decides when the browser sends it, as every current one does to an HTTPS address: only `same-origin` passes. A browser that sends none, an older one or a page over plain HTTP such as `pnpm dev:lan` on a phone, is judged by `Origin` against the request's own host (`Host`, `X-Forwarded-Host` or the URL). curl sends neither and is held to its address's limits, as on events. The answer is an empty 403, which every reader of these routes takes as `unavailable`. Checked on the dev server: the page's own `POST /api/day` and `/api/events` pass on `localhost` and on the laptop's LAN address over HTTP; `sec-fetch-site: cross-site` and a foreign `Origin` get 403 on all four routes. A Vercel preview serves its page and its API from one host, so it passes as production does.

**Prevents:** a third party draining the cap with its own visitors. **Pays back:** the first time anyone tries it; insurance for an hour's work. **Displaces:** nothing of note.

### S3. Denial of wallet by rotating addresses

**State:** by design; options below.

A live day holds its worst case, about $0.14, against the caps before it starts, and settles at about half that. A sender who rotates addresses gets each address's own allowance, so enough addresses can spend the daily cap and stop live days for everyone until midnight UTC. Clearing cookies changes nothing: Lantern sets none. A visitor over a limit, or a day over the cap, gets "not yet" with the written days, so the site still plays, but without its live part.

What it costs: at most $10 a day and $95 a month, by design, with the model provider's own monthly limit behind them. The real loss is the live part failing while someone is looking.

The places provider's daily allowance is a second ceiling, shared by every key on the account. Past it, place checks end "unchecked", which the page survives, and the intake cannot look up a new city until the allowance turns over. A reserve kept for the intake, and a cache of city lookups, would blunt it.

A trade-off to know: an office behind one address shares one visitor's 10 days. A team that opens the link together can reach "not yet" without any attacker.

The intake's early call (since 2026-11-05; `docs/decisions.md`, "The limits and the log live in Postgres, and every hold expires") gives rotation nothing more. Haiku's read starts beside the limits only after the process has heard nothing from the database for four minutes, and each early call opens a new quiet spell, so a process starts at most one every four minutes however many addresses send; a flood keeps the database answering and starts none past a new process's first. A read the limits refuse is stopped and charged to `app_spend` in `after()`, by its usage or else the intake's $0.0009 hold, so the caps count it: at most $0.33 a day per process. It keeps no row in `generation_log`, so the log sums a little less than `app_spend`.

Options:

- **(a) Accept and watch.** The ceiling was designed for this. The spend is read once a week (`pnpm prod:read spend`, `docs/ops.md`). 0 h.
- **(b) Vercel BotID, Basic level, on the three routes.** Free on every plan. An invisible client-side challenge, checked with `checkBotId()` before anything is counted. curl and plain scripts fail; a headless browser that runs the page's JavaScript still passes Basic. It needs a new dependency (`botid`) and a `next.config.ts` wrapper, so a Next 16 check; e2e needs its development bypass. 3 to 4 h.
- **(c) An hourly sub-cap,** for example $2.50 an hour inside the $10, so a burst costs an hour of live days, not a day. `app_spend`'s bucket check only allows days and months, so it needs a migration applied to production by hand, and a change to `limits.ts`. 3 to 4 h.
- **(d) An edge rate limit** cannot see rotation. It belongs to S4.

**Recommendation:** (a) with S2. (b) is the cheapest real raise in a scripted sender's cost, if the live part must survive one. (c) only if the log ever shows a burst.

### S4. A flood against the platform's ceilings

**State:** mitigated at the edge since 2026-11-04 (`docs/ops.md`, "Edge rules"); what is left is by design: a flood from many addresses can still reach the plans' ceilings, and the way back is known. Checked in production that day: a written day played in a browser, its own requests passing both rules.

The hosting and database plans have monthly ceilings on function invocations, transferred bytes and compute. A flood past one stops more than live days: a written day also streams through `POST /api/day`, so the site would show its pages and no day. This outranks S3 in what it costs, while it needs a malicious sender rather than a curious one.

- **Large bodies.** A handler refuses an oversized body only after its bytes have reached the function and been counted, whatever its path or method.
- **Many small requests.** Each counts an invocation; a per-address limit slows one address, and rotation gets past it.
- **The database's compute.** Every event and every kept-day read wakes the database; past its month's compute it stops, and the live routes and kept links answer 503 or "unknown".

What stands between, with no code:

1. **Edge rules** refuse oversized bodies before they reach a function, on any path and any method, and rate-limit `/api/` per address. A request the edge refuses costs nothing and counts no invocation. Every request Lantern's own pages make declares its length and stays far under the limit.
2. **The way back** from a paused deployment is known, and takes minutes.
3. **Usage is read weekly,** on the host and the database, beside the spend.

### S5. Visitor counters are never deleted

**State:** fixed, in production since 2026-11-02 at 17:13, `/privacy` saying how long a count is kept.

`visitor_counters` rows (salted hash × UTC day × count) are never deleted, and the salt never changes, so the table becomes a pseudonymous history of which days each address used Lantern. `/privacy` says the counts start again at midnight UTC, and that everything else is kept "until it is no longer needed". A past day's count is not needed. Under the GDPR's storage limitation it should go.

**Fix** (0.5 to 1 h): delete rows before yesterday in the same once-a-day clearing as the intake text (`clearExpiredOncePerDay`, `src/lib/live/postgres-stores.ts`), with a PGlite test. `spend_holds` already drops its expired rows; `app_spend` holds no visitor data.

### S6. Mail can be forged from Lantern's domain

**State:** fixed. `_dmarc.lanternday.com` answers `v=DMARC1; p=reject; adkim=s; aspf=s`, read in public DNS on 2026-11-04 and again on 2026-11-05.

lanternday.com receives mail through ImprovMX (MX records) and publishes SPF with a soft fail (`~all`). Until 2026-11-04 it had no DMARC record (`_dmarc.lanternday.com` had no TXT), so a message forged "from" the contact address to anyone was judged by each receiver's own policy, and many would deliver it.

**Fix.** Nobody sends mail as the @lanternday.com address, so the strictest policy costs nothing: a DMARC record that rejects mail failing strict alignment. The SPF record stays as ImprovMX set it. If mail is ever sent from the address, its DKIM record comes first.

### S7. Response headers

**State:** fixed, in production since 2026-11-02 at 17:13: the three headers answer on every page, the prerendered ones included, read with plain GETs on 2026-11-03.

`next.config.ts` sets no headers. Worth adding, for every path, in `headers()`:

- `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`: no site may frame Lantern (clickjacking, or a scam page dressing itself in Lantern), no plugins, no `<base>` hijack.
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`, the browser default written down.

Not worth adding: a script CSP. A nonce-based one forces every page to render per request, and the Next 16 guide says it is incompatible with Partial Prerendering, which this app uses (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). One with `'unsafe-inline'` would be theatre, and hash-based SRI is experimental. With no HTML sink for model text (above), the gain is small. HSTS stays Vercel's: adding `includeSubDomains; preload` commits the whole domain for little gain.

1 h with `pnpm build:check` and e2e.

### S8. `/lab` in production

**State:** fixed, in production since 2026-11-02 at 17:13: the route source plays written days alone, and the lab asks not to be indexed (`noindex, nofollow`, read on 2026-11-03). Since 2026-11-04 the lab is the studio's, behind the owner's password (S14), and `robots.txt` disallows it: a crawler reads only a 401 there.

`/lab` is public and indexable; there is no `robots.txt`. It is fixture-only with one exception: on `/lab/stream`, with the source set to "The route", the edge day "Lisbon: a night that runs through midnight" is a written city with words no written day has, so production writes it live with Sonnet, counted against the visitor's limits and the caps like any day. Seven other edge days are cities with no signature and answer 403. No new money exposure, but a lab page that spends, and shows a model's day in place of its fixture, is a surprise.

**Fix:** the route source offers written days alone, and the lab's layout asks not to be indexed; S14 then put the lab behind the studio's password.

### S9. 400 answers list every schema issue

**State:** open, low.

`/api/day`, `/api/intake` and `/api/replan` answer a malformed body with each zod issue's path and message; `/api/events` answers with no body. For the day and the intake the schema is already in the client's JavaScript, and the repository will be public. For the re-plan it shortened finding S1, and R reduces its body to four fields, five since the picks (2026-11-07). **Leave it**; the messages help whoever builds the page.

### S10. Supply chain

**State:** fixed on 2026-11-02: `minimumReleaseAge` strict and the zod override. `trustPolicy: no-downgrade` was tried and left out: it refused six packages, `@vercel/functions`, `@vercel/oidc`, `@vercel/cli-config`, `@vercel/cli-exec`, `semver@6.3.1` and `eslint-import-resolver-typescript@3.10.1`, each explained by a publisher's pipeline (since 3.7.7 on 2026-08-03, `@vercel/functions` publishes through GitHub's trusted publishing without a provenance attestation, under a new OIDC configuration). An exclusion list that grows would teach whoever installs to wave refusals through, and the release age already covers the hours in which a hijacked publish is usually pulled.

- `pnpm audit`: one high and one moderate, neither reachable. Zod 4.1.11 (memory exhaustion on oversized constrained collections, GHSA-mrhx-c7xc-m3w5) comes only through `@vercel/functions` → `@vercel/oidc` → `@vercel/cli-config`, which parses CLI config files, never a request; Lantern imports only `ipAddress`, and its own zod is 4.6.7. Minimatch is dev-only, under ESLint.
- pnpm 12 already blocks dependency build scripts (only `unrs-resolver` may run), and its built-in `minimumReleaseAge` is one day but not strict: it falls back to a newer version when nothing is old enough.
- Proposed in `pnpm-workspace.yaml` (0.5 to 1 h, with a clean install and `pnpm check`): `minimumReleaseAge: 1440` written down, which makes it strict; `trustPolicy: no-downgrade`, which fails an install when a package's provenance drops below its earlier releases, as the 2025 npm account takeovers' publishes did; and an override lifting the vulnerable zod copy to 4.6.7, so `pnpm audit` reads clean. Prevents: a malicious publish reaching Vercel's build, which sees every production key.
- GitHub Actions are pinned by tag, not by commit. With no secrets in CI and a read-only token, that is acceptable; revisit if CI ever gets a secret.

### S11. Opening the repository

**State:** the history and the files are clean (below); a contributor's branch is a matter of process.

- **Running a contributor's branch runs their code on the laptop.** `core.hooksPath` is `.githooks`, so a branch's commit hooks run on the owner's next commit there; `.claude/settings.json` runs a SessionStart hook from the repo; `pnpm install` runs `prepare`; and `.env.local` holds the dev key and the dev database's string. Process, no code: review fork pull requests on GitHub, and check one out only in a throwaway clone without `.env.local`.
- **Vercel previews from forks.** Git Fork Protection holds a fork's deploy for approval when the project has environment variables, so a fork's code never builds with Preview's keys.
- **The studio's old login, in the history.** `OWNER_STUDIO_LOGIN`, an unsalted SHA-256 of a short password, was in `src/lib/http/studio-gate.ts` from 2026-11-05 until 2026-11-07, when the code dropped it (S14). An independent review of a clean clone named it the one must-fix: it was removed from the history on 2026-11-07, and the password was changed.
- **What the files say.** No secret, key or private address is tracked. A production day's id and a personal name were taken out of the tracked files on 2026-11-06; neither was useful without a password, and the contact page names the owner anyway.

### S12. The database role

**State:** later.

If Vercel's `DATABASE_URL` uses Neon's owner role, a compromised function could drop tables. With every statement parameterized, a narrower role (`SELECT, INSERT, UPDATE, DELETE` on Lantern's tables, migrations still run as the owner from the terminal) only limits the blast radius of a compromise that has already happened, so it waits behind the controls that prevent one.

**A read-only role for operations**, so production can be read without the owner's connection string. Its runbook is `docs/ops.md`, "Reading production".

- **Made in SQL, not in the console.** Neon makes every role created in its console, CLI or API a member of `neon_superuser`, which can create roles and databases; a role made in SQL gets only what it is granted (`neon.com/docs/manage/roles`). The statements are `db/roles/lantern-reader.sql`: `SELECT` on the tables operations reads, and on `generation_log` and `event_days` only the columns that can quote no visitor and give away no salt. The role starts read-only, with a statement timeout and a connection limit, as guard rails; the grants are the control. A table a later migration adds stays closed until that migration grants it.
- **What the left-out columns hold.** `visitor_text` is what the visitor typed. An intake's `output` and `output_text` quote the phrases the model set aside. `error.message` can quote the output, which is why the retention clears it. `request` holds no free text on any row: the city as Geoapify names it, the date, the zone and the enum words. `context` is the day a re-plan read: since fix R (2026-11-02) the server's own record, but on a row from before, an itinerary a client sent, which S1 shows a stranger could have written. It holds no visitor's private words and is what S1's query reads; a session reads it as data, never as instructions.
- **The password** never passes through chat, a file or a shell's history: it is generated in the owner's terminal and set with `ALTER ROLE` in Neon's SQL Editor, whose history then holds it behind the same login that already owns the database.
- **The string lives in the macOS Keychain,** never typed or shown. Only `pnpm prod:read` reads it, refuses a string for another role or with no database, and prints a crash's message alone, redacted. The role's grants, not the Keychain, are what bound a leak.
- **A day's places, without its words.** The eval needs the kinds and sensory levels of production's days, never their text. `day_place_enums` (migration `0008`) lists each whole day's stops and swap options, a re-plan's not among them, in four enums alone: a value outside its enum comes out NULL, so no text passes even if the model wrote some. It reads `output`, the JSON kept only for an answer that parsed whole, with its owner's rights, so the role is granted the view and still nothing of `output`. Production takes the migration as any other, then the owner runs the view's `GRANT` from `db/roles/lantern-reader.sql`.
- **Revoking it:** `ALTER ROLE lantern_reader NOLOGIN;` takes effect at the next connection, which with the HTTP driver is the next query. `DROP ROLE` after `REVOKE ALL` removes it.

### S13. Vercel Web Analytics

**State:** in production since 2026-11-02 at 17:13, its script answering at `/_vercel/insights/script.js` on www: `@vercel/analytics` 2.0.1 pinned, `<Analytics/>` rendered on Vercel's production alone, so no laptop, preview or e2e server loads Vercel's development script from its other origin, a `beforeSend` that writes `/day/<uuid>` as `/day/[id]`, and `/privacy` in the same commit.

What it changes, read in Vercel's privacy page for it (`vercel.com/docs/analytics/privacy-policy`):

- **What it collects:** each page view's URL and dynamic path, the referrer, filtered query parameters, the visitor's country, region and city, browser, OS and device type. No cookie; a visitor is a hash made from the request and dropped after 24 hours.
- **`/privacy` must change** with the install, in the same commit. Its usage-notes item says they "never hold your IP address, your device or what you typed", and the device would no longer be true of everything; Vercel's line under "Who handles it" says only that it hosts Lantern. Both name what Web Analytics records, and that it sets no cookie.
- **Kept-day links are capabilities.** A page view of `/day/<uuid>` sends the uuid that opens that day to Vercel's analytics. A `beforeSend` that writes it as `/day/[id]` keeps the links out of a second store and makes the report readable (`vercel.com/docs/analytics/redacting-sensitive-data`). 15 min, with the install.
- **S7:** no conflict. The script is served from Lantern's own origin under a random path (version 2's "resilient intake"), and the headers proposed in S7 restrict no scripts.
- **S10:** one new dependency, Vercel's own, pinned to an exact version. The script it injects is Vercel's, served at deploy time and not pinned by the lockfile, and it runs on every page, where it could read what a visitor types. That adds no new party: Vercel already serves every byte of Lantern's pages.
- **The owner's own visits:** a browser whose storage holds `lantern.uncounted.v1`, set only by opening the studio, sends no page view, since the `beforeSend` returns `null` for it (`pageViewToSend`), and no product event. A visitor's page view holds what it held, so `/privacy` is unchanged; a visitor who writes the key by hand leaves out their own browser alone (`docs/decisions.md`, "Product events are kept under a visitor key that lives one day").

**Verdict:** safe to add with the `/privacy` change and the `beforeSend`. Whether it is worth adding beside Lantern's own events is a product question: it adds referrers and places, where the audience comes from, which `product_events` deliberately does not keep.

### S14. The studio: the lab and the case study behind a password

**State:** fixed. The proxy has asked for the password since 2026-11-04, and every page of the studio checks the login itself since 2026-11-05, after the proxy was found stepped round at an escaped path (below). The code holds no login: one password, set only in Vercel's environment, opens the studio, and a production build without it is shut. Checked in production: `/studio` and `/lab` answer 401 without the password and with a wrong one. A path that names the studio only once its escapes are read, as `/%6Cab`, `/%73tudio` or `/lab%2Fstream`, is a page that is not there: the proxy answers it with the site's not-found page and a 404, with the password or without (below).

The public site is the finished product, and everything that explains it (the case study, the lab, its benches) sits in a section only the owner opens. `src/proxy.ts`, Next 16's name for middleware, asks every request for `/studio` and `/lab` for a password by HTTP Basic authentication over HTTPS (`src/lib/http/studio-gate.ts`).

- **Why Basic, not a login page.** It sets no cookie, so `/privacy`'s "sets no cookies" stays true. A crawler gets a 401 with nothing to index. It needs no login route, no session and no logout to secure. The browser draws the dialog. A form with a signed cookie was weighed and dropped: 3 to 4 hours more and a cookie on `/privacy`, for one person who signs in.
- **The login.** `STUDIO_PASSWORD` alone, the password itself, Sensitive in Vercel for Production and Preview (`docs/ops.md`, "The studio's password"). The code holds none, and a test fails on a 64-digit hex string in `src/lib/http/studio-gate.ts`. No user name: a name is not a secret, and a second variable was one more thing to set and get wrong. The browser still asks for one; any opens, an empty one included. The SHA-256 of what was typed is compared with the SHA-256 of the variable by `timingSafeEqual`, two digests of one length, so the answer's time says nothing of the password's length or of how much of it was right. The value is taken as it is, with no trimming, and an empty one counts as none.
- **With no login set.** A production build, on Vercel, a preview or `pnpm build:check`, answers 401 to everyone, whatever the request gives; so does one whose `STUDIO_PASSWORD` is empty. Shut, not open: a deploy that missed its variable keeps the studio shut. Its first refused request writes one line to the log, `studio-closed`, with the variable's name alone, never its value or anything worked out from it, once per instance of the proxy and of the pages, so a flood of 401s writes no more. `next dev` with no login set stays open, so the benches work on a laptop. Whether a build is `next dev` is `process.env.NODE_ENV === "development"`, which Next writes into every bundle as a constant, so no variable set on a deploy makes a production build open. With a password set it asks too, which is how the e2e run proves the lock with its own (`e2e/studio-login.ts`). The tests prove the rule on passwords of their own; only a GET with the real one after a deploy proves the variable was taken.
- **What is behind it.** Only the studio: it reads no visitor's data and no database, holds no key and calls no paid service. The lab's code is public with the repository anyway; the password guards how the product is presented, not a secret.
- **Before the cache.** Vercel runs Routing Middleware "globally before the cache" (vercel.com/docs/routing-middleware, read 2026-11-04), so a prerendered page of the lab is served from the cache only past the proxy. The danger is the matcher: `/lab/:path*` does not take `/lab.rsc`, `/lab.html` or `/lab.segments/...`, files the build writes beside a prerendered page. The matcher takes every path that starts with either name, `/(lab|studio)(.*)`, and every path with an escape in its first segment, `/([^/]*%.*)`, and the proxy itself tells the studio's paths from the rest. It runs on nothing else, and no address of the public site has an escape in its first segment, so the site neither waits on it nor counts an invocation for it.
- **An escaped name is not found.** Vercel matches the proxy against the path as it is written and finds the page by the path with its escapes read, so `/%6Cab` reaches the lab's page past the first matcher. There the page's own lock answers with the not-found page, but only after the response has begun: a page that reads its request streams, and a status is sent with the first byte (Next's streaming guide, "The HTTP contract"), so it would answer 200 with `noindex`. The proxy answers such a path first. `isEscapedStudioPath` takes a path the studio does not hold as written and holds once its escapes are read, and the proxy rewrites it to `/_not-a-page`, which no route serves, since a folder named with an underscore is never one: the site's not-found page, 404, with `noindex` in the page and the studio's two headers below on the answer, whatever the request gives. The studio is at its plain address alone. Each run of escapes is read on its own, and one that spells no text is left as it is written, so a malformed escape never fails a public path and cannot hide a name of the studio before it.
- **Every answer of the studio** says `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`, the 200s included. A shared cache may keep an answer to a request with `Authorization` when it carries `s-maxage`, as a prerendered page's does, and this header is the one Next served after the proxy, on a page the cache held (`x-nextjs-cache: HIT`).
- **For crawlers.** `robots.txt` disallows `/studio` and `/lab`. Naming them there tells nothing the lock relies on: the lock is the password, not the address. The sitemap lists neither, and no public page links to them (an e2e spec reads the links on `/`, a written day, a kept day's address, `/privacy` and a 404).

**Proven on the production build,** `pnpm build:check`'s `.next-build` served by `next start` on 2026-11-04, with a login set and then with none, by curl with `--path-as-is`. Each path was asked without a password, as a router request (`RSC: 1`, `Next-Router-Prefetch: 1`, and the `x-middleware-subrequest` header of CVE-2025-29927) and with the password:

| Paths                                                                                                                                                                                                                                                                                                                                         | Without                    | With |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---- |
| `/studio`, `/lab`, `/lab/stream`, `/lab/tokens`, `/lab/matrix/stop-row`, `/lab/concepts/invitation/light`, `/./lab`, `/lab/./stream`, `/x/../lab`, `/lab/%2e/stream`, `/lab?_rsc=1`, `/studio?__nextDataReq=1`                                                                                                                                | 401                        | 200  |
| `/lab.rsc`, `/lab.html`, `/lab.meta`, `/lab.segments/_tree.segment.rsc`, the same beside `/studio` and `/lab/stream`, `/lab;x`, `/_next/data/x/lab.json`                                                                                                                                                                                      | 401                        | 404  |
| `/%6Cab`, `/%6cab/stream`, `/l%61b`, `/l%61b/stream`, `/%73tudio`, `/%6Cab.rsc`, `/%6Cab%2Fstream`, `/lab%2Fstream`, `/lab%2F`, and with a malformed escape further on, `/%6Cab/x/%ZZ`, `/%6Cab/matrix/%E0%A4%A`, `/%6Cab/concepts/invitation/%ZZ`: the proxy's rewrite to the not-found page, `X-Robots-Tag: noindex, nofollow` (2026-11-10) | 404                        | 404  |
| `/LAB`, `/Lab/stream`, `/lab%00`, `/lab%20`, `/labs`, `/index/lab`, `/%E0%A4%A`, `/100%25`: not the proxy's, the site's not-found page                                                                                                                                                                                                        | 404                        | 404  |
| `/studio/`, `/lab/`, `//lab`, `//studio`                                                                                                                                                                                                                                                                                                      | 308 to `/studio` or `/lab` | 308  |

No path served a page of the studio without the password. With no login set, `/studio`, `/lab`, `/lab/stream` and `/lab.rsc` answered 401 to any password, and `/` 200. The 401 carries the three headers of S7.

**What this does not prove,** and what the lock does not hide:

- `next start` is not Vercel's routing, and the difference mattered: see the next part. It proves the proxy's answer to an escaped name; only a GET of the same paths after a deploy proves that Vercel hands them to the proxy and answers its rewrite with the 404.
- The lab's code is in its script files under `/_next/static/`, public to whoever has their names. The names appear only in the studio's pages, and the code is public with the repository anyway.
- The browser keeps the password until it is closed; there is no logout but closing it.

**The way round, in production (2026-11-04, plain GETs with `--path-as-is`).** The plain paths answered 401 as above. A path with a letter written escaped did not: `/%6Cab`, `/l%61b`, `/%6Cab/stream`, `/lab%2F` and `/%73tudio` answered 200 with the page itself, `x-matched-path: /lab`, `x-vercel-cache: HIT` and a public `Cache-Control`. Vercel matches the proxy against the path as it is written, so `/%6Cab` is not a path the matcher takes, and then routes it as `/lab` and serves the page prerendered in its cache. `next start` answers the same paths 404, which is why the build's proof missed it. Nothing spends behind the studio, so nothing but the lab's pages was exposed, and they had been public until that morning anyway.

**The fix: the lock inside the pages** (`src/lib/http/studio-access.ts`). Every page and both layouts of the studio and the lab first call `requireStudioLogin()`, which reads the request's `Authorization` and, without the login, answers as a page that is not there (`notFound()`); a test fails any page or layout that does not call it first. Every page, not only the layouts: a router request that says it already holds a layout is answered without that layout, so a check there alone could be stepped round. A page that reads its request is rendered for each one (`instant = false`), so none is prerendered into the cache: the build lists every route of both as `ƒ`, `lab.html` is written empty, and no file the build writes for them holds a word of their content. What the build still writes for prefetching holds the root layout's frame alone: each page's title is given per request, and only with the login (`studioMetadataOf`), since a title set as a constant was written there and production showed it at `/%6Cab/stream` (2026-11-05). The proxy stays, so the plain path still gets its 401 and the browser's dialog.

**Proven** on a build made without the proxy (`src/proxy.ts` set aside, then put back), so every path reaches the pages as an escaped one did on Vercel past the first matcher alone. Without the password, `/studio`, `/lab`, `/lab/stream`, `/lab/tokens`, `/lab/matrix/stop-row`, `/lab/concepts/day` and `/lab/concepts/invitation/light` answered the site's "no day here" page, `noindex`, with none of the studio's words; `/lab.rsc` and the segment files 404 or a title only; with the password, the pages. They answer 200, not 404, since the not-found page streams in after the response has begun: the content is what matters, and a crawler meets `noindex`. That is why the proxy answers an escaped name itself, before any page renders (above). The check after the push repeated the same GETs on production, the escaped ones included.

### S15. `Server-Timing` named the services behind the site

**State:** fixed, in production since 2026-11-04.

The public site does not name Lantern's stack, as `/privacy` names categories of recipients rather than providers. `/api/intake`, `/api/day` and `/api/replan` answer with a `Server-Timing` header (`src/lib/server-timing.ts`, built for measuring where a request's seconds go, `docs/harness.md`), which any browser's network panel shows. Its descriptions named the database, the model's provider and the map service (`desc="Neon: the visitor's count and the app's spend"`, `desc="Claude, the whole call"`, `desc="Geoapify: the cities the text names"`), and `cold` said how long the function's process had run before the request (`cold;desc="… 84287.5 ms after its process began"`), a hint of the platform's instance life.

**Fix.** In production (`VERCEL_ENV=production`) the header says each metric's name and duration alone, `limits;dur=…, model;dur=…, cities;dur=…, total;dur=…`, with no description and no `cold`. The names say what a step is, not whose: the harness's measurements read them and their durations, and keep them. A laptop and a preview deploy keep the descriptions and `cold`, for measuring. A test holds that an intake answered in production names no service and carries no `desc` or `cold`.

**Left as it is:** `server: Vercel` and the day stream's `x-vercel-ai-ui-message-stream` header, which say the host and the stream's format; the host is on every answer either way.

### S16. A day opened by its link could not be written again in its own city

**State:** fixed, and checked in production on 2026-11-05: a kept New York day, its company changed from "with friends" to "with a partner", `POST /api/day` 200 and a new day of nine stops, for $0.10.

**What happened.** A visitor's day opened at its address, `/day/<id>`, holds no intake's signature: the page that draws it never read an intake's answer. A word that writes the whole day again there (travel or company, any word on a day not finished, "Write it again" on a day that failed or whose link expired) asks `POST /api/day` for the same city, and the route answered 403, which the page reads as "not yet", for every city but the written days'. So it had been since live generation reached production on 2026-10-31. Nothing was exposed: the control failed closed, on the visitor's own day, and on the path a shared link takes, where a first-time visitor opening a shared link and changing a word met a refusal.

**Fix.** The page names the kept day it opened in the `lantern-kept-day` header (`KEPT_DAY_HEADER`), and the route writes the request when the city and zone of the day the server kept under that id are the request's: written city first, then the intake's signature, then the kept day (`mayWriteCity` in `src/lib/live/live-day.ts`, `keptCityOf` in `city-signature.ts`). The record is read from the log a re-plan reads its day from (fix R, S1), whatever way the day ended, since a failed, cut or expired day is the one the page offers to write again, under the same deadline as the counts; an id that cannot be a UUID is never read; a log that fails or is late answers 503, never 403, and nothing is counted either way. A re-plan recorded before the server read its own day held a client's request, and vouches for no city. The same-site check, the visitor's limit and the app's caps stand as they were.

**What it opens.** Nothing a signature does not. Every record with a request was written under the intake's signature or for a written day's city, and every re-plan since fix R in the city of the day it read, so naming a kept day is a replayed signature by another name: the same city again, counted against the asker's own ten days and the app's caps. Like a signature, the id is bound to no visitor, and a shared link gives it away: whoever holds the link can have days written in its city on their own count, as they could by typing the city. It adds one read of the log by its key before any count, which `GET /api/day/<id>` already allows anyone. The date and the sentence's words stay the client's, as under a signature.

**Proof.** `live-day.test.ts`: the same Paris request, its travel changed, answers 403 without the kept day's id and streams a whole day with it, counted as any day; another city's or zone's request, an id no day is kept under, and an id that is no UUID (one that holds a record in the test's log, never read) answer 403 with nothing counted or called; a log that fails or is late answers 503. `kept-day-page.test.tsx`: a word changed on a kept Kyoto day, and "Write it again" on one past its link, send the id and no signature. `city-signature.test.ts`: which records vouch for a city. The route's tests all fail with the kept read taken out, and the page's with its id taken out.

**Left as it is.** A day whose record never landed, which the browser that asked it shows as unfinished once the wait is over, has nothing to read, so it is still refused from its address; the visitor asks for it again from the start, through the intake. A preview or a laptop's `Server-Timing` describes `basis` as the kept day a re-plan rewrites or whose city a day asks again; production names it alone (S15).

## Accounts

Account-level controls are set in each provider's dashboard and kept out of this file: two-factor sign-in, keys scoped to their environment and marked sensitive, preview deploys behind the host's own login, the model provider's monthly spend limit, alerts on the dependencies Lantern ships, and the domain's renewal. None can be done from code; each was weighed by what skipping it would cost on the plans Lantern runs on.

## The questions on the table, and where each is settled

| Question                                                | Verdict                                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Prompt injection through the intake's free text         | Handled by the shape; leave it ("Verified")                                                     |
| Prompt injection through a re-plan's stop names         | Fixed (S1)                                                                                      |
| A visitor rotating addresses to spend the daily cap     | By design, bounded at $10 a day; S2 closes the free version, S3 lists what raises the paid one  |
| Guessing or sharing `/day/<uuid>`                       | Guessing is infeasible; sharing shows the day and its request, as `/privacy` says ("Verified")  |
| Visitor text in `generation_log`                        | Intake rows only, cleared after 30 days, as promised; the counters deleted after a day (S5)     |
| Headers with no middleware                              | HSTS is there; framing and sniffing headers added, no script CSP (S7)                           |
| Dependencies and the supply chain                       | Audit findings unreachable; pnpm settings added (S10)                                           |
| Secrets in git history                                  | None today; the old studio login was removed from history (S11)                                 |
| Preview deploys' reach into `lantern-dev` and live keys | Behind the host's preview protection and Fork Protection ("Accounts"); the caps apply there too |
| Error messages and logs                                 | Logs are clean; 400s list schema issues, left as they are (S9)                                  |
| `/lab` in production                                    | Behind the studio's password since 2026-11-04 (S8, S14)                                         |

## Log

- **2026-11-02.** First audit. S1 found and proven in a test; a stopgap built, and fix R agreed with its amendments (a body without the itinerary, a basis by slug or id, a short wait then 409, old records refused, the eval round's archive). S2's fix built beside it, so one push closes both.
- **2026-11-02, later.** S1's stopgap and S2's fix in production. S3 to S13 written against the plans Lantern runs on, each with a verdict.
- **2026-11-02, the first `pnpm prod:read`.** A crash printed the read-only role's connection string into a local terminal session: the string had been stored cut short, so the connection failed, and the Neon driver's pool raised an error event no one listened to, which Node printed whole. The password of a role that can only read, and is granted no column a visitor's words are in, was changed within the hour, so the printed copy opens nothing. The shared `scripts/neon-session.mts` now hears the pool's error event, and `prod:read` prints a crash's message alone and redacted and refuses a string with no database. The same unheard event could have printed the owner's own string while migrating production by hand; `db-migrate`, `log-report` and `events-report` should print a crash the same way.
- **2026-11-02, S1 checked in production.** Read as `lantern_reader`: `pnpm prod:read replans` (records with a `context`, environment `production`, 30 days) found none, and no `generation_log` row has a `replan-` prompt version at all. No one planted a day while the route was open, from 2026-10-31 to the stopgap, so nothing needs deleting.
- **2026-11-03.** The agreed fixes are in production: fix R with the push of 2026-11-02 at 15:51, the rest of it and Vercel Web Analytics with the push at 17:13. Read with plain GETs on 2026-11-03: the three headers on `/`, `/day/kyoto`, `/lab` and `/privacy`, the lab's `noindex`, `/privacy`'s new lines, and the page-view script, added in the browser. S4's body rule widened to every path and method, after a review found the first draft easy to go round.
- **2026-11-04, transfers outside the EU, checked for `/privacy`.** The page now names categories of recipients, not providers, and says in one sentence that some process data in the United States under the EU–US Data Privacy Framework or the EU's standard contractual clauses. Checked against each provider's own terms that day: Anthropic builds its data processing addendum, with the clauses, into its Commercial Terms for the API; Vercel is certified under the Data Privacy Framework, while its addendum with the clauses names only Pro and Enterprise; Databricks lists Neon, LLC under its Data Privacy Framework certification, while Neon's own addendum takes effect only once signed, which costs nothing and puts a processor contract beside the certification; Geoapify is a German company and receives no personal data, only the names of cities and places.
- **2026-11-04, the studio.** The lab and the case study went behind a password (S14). Proven with curl on the production build, with a login and without one.
- **2026-11-04, `Server-Timing`.** Production's header says names and durations alone, with no description naming a service and no `cold` (S15).
- **2026-11-04, the studio, round the proxy.** A check of production found the lab served from Vercel's cache at an escaped path, `/%6Cab`, past the proxy. Closed by a lock inside every page, which renders each one per request, proven on a build without the proxy (S14).
- **2026-11-05, the studio checked in production.** GETs: every plain path 401, every escaped one the "no day here" page, no word of the studio's; only a page's title in the prefetch files, now given per request with the login alone.
- **2026-11-05, a kept day's city.** A day opened by its link was refused when a word wrote it again, for every city but the written days' (S16). Fixed by naming the kept day in a header and reading its city from the server's own record, under the same rules as a signature.
- **2026-11-05, the public routes after the day's changes.** Read in the code: the kept-day header (S16), the studio's lock, `Server-Timing` (`basis` now on `/api/day` too, bare in production), the map link, the seen-day and view scripts, the `kept` event and the browser's keys against `/privacy`. Nothing new to fix. GETs of production: `/studio`, `/lab` and `/lab/stream` 401; `/%73tudio`, `/%6Cab` and their `.rsc` and segment files the "no day here" page or the route's name alone, no word of the studio's.
- **2026-11-05, statuses after the milestone.** S4: both edge rules stand in production since 2026-11-04. S6: the DMARC record answers `p=reject` in DNS. S16: checked live in production, a kept New York day written again with another company, $0.10. S14: in production, 401 without the login and with a wrong one.
- **2026-11-06, what a re-plan's `context` holds.** Two lines still said a client sends it and no production page re-plans. Since fix R it is the server's own record, and the page has re-planned in production since fix R's push; only a row from before fix R holds a client's itinerary, read as data, never as instructions, as `db/roles/lantern-reader.sql` and `docs/ops.md` now say. The re-plan view was built on 2026-11-01 but first pushed with fix R on 2026-11-02 at 15:51, so S1's "no production page calls it yet" held while the stopgap stood; S1's state now says so.
- **2026-11-06, the intake's early call.** A process the database has been quiet to for four minutes starts Haiku's read beside the limits. S3 says what bounds it: one early call per process every four minutes, a refused one charged to the caps, at most $0.33 a day per process.
- **2026-11-07, the studio's login leaves the code.** Before the repository opens (S11), on an independent review of a clean clone: the login built into the code is gone, the studio takes one password, `STUDIO_PASSWORD`, set only in Vercel's environment, and a build without it is shut to everyone and logs one `studio-closed` line saying why. The old login was removed from the history the same day, and the password was changed.
- **2026-11-10, an escaped name of the studio is not found.** The proxy answers a path that names the studio only once its escapes are read, as `/%6Cab`, with the site's not-found page and a 404, before any page of the studio streams (S14).
