# Discoverability

How Lantern is found and how a link to it looks, what the code does about it and why, and the steps only the owner can take. A written day's page is built whole, so a search engine or a link's preview reads all of it (`docs/decisions.md`, "A written day's page is built whole, and plays only for a visitor who has not seen it").

## What the code does

| Page                         | Search engines                                                                 | A link's card                                 |
| ---------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| `/`                          | Listed, canonical, in the sitemap                                              | "Lantern" and the site's line                 |
| `/day/<written city>`        | Listed, canonical, in the sitemap                                              | The day's sentence and its line               |
| `/privacy`                   | Listed, canonical, in the sitemap                                              | "Privacy and terms" and its line              |
| `/day/<id>`, a visitor's day | `noindex, nofollow`                                                            | The day's sentence and line, no address       |
| `/studio/*`, `/lab/*`        | Barred in `robots.txt`; a 401 behind the owner's password, `noindex, nofollow` | None: a link-preview crawler is given the 401 |
| A city with no written day   | 404, `noindex`                                                                 | The page for no day                           |

- `robots.txt` (`src/app/robots.ts`): every crawler may read every public page, and is told where the sitemap is. It is asked to keep off `/api/intake`, `/api/replan` and `/api/events`; `/api/day` stays open: a renderer the next point's list misses still plays a written day through it, and barring it would end that page as a dropped connection. It is asked to keep off `/studio` and `/lab` too: every answer there is a 401 until the owner's password is given (`src/proxy.ts`), so a crawler would spend a request to read nothing. AI crawlers (GPTBot, ClaudeBot, PerplexityBot and the rest) are allowed as search engines are.
- A search engine's renderer reads a written day whole, never played (`isRenderingCrawler` in `src/features/day/seen-days.ts`): Googlebot, Search Console's live test (Google-InspectionTool) and Bingbot, told by their user agents, are taken as a device that has seen the day, so the page keeps the day its HTML holds and asks `/api/day` for nothing. Before, the page played the day for them as for a first visit, and on 2026-11-08 the live test of `/day/kanazawa` showed Google's renderer giving that request up ("Other error") and keeping the page's ending, "The connection dropped before Lantern finished this day", with the other days under it. The content is the same as a visitor's, only the playing is left out, so it is no cloaking.
- `sitemap.xml` (`src/app/sitemap.ts`): the start screen, every written day, the privacy page. A new written day joins it by itself.
- The production host is `SITE_URL` in `src/lib/site.ts`; the root layout's `metadataBase` makes every page's addresses whole on it.
- The listed pages are prerendered with their tags in the `<head>`, so any crawler reads them without running a script. A visitor's day is rendered for each visit: Next still puts its tags in the `<head>` for the link-preview crawlers it knows (LinkedIn, Slack, iMessage, WhatsApp, X, Discord and others), but streams them into the body for one it does not, such as Telegram's.
- Every page names its author, Mikalai Rudak, in a meta tag, unseen on the page (`SITE_AUTHOR` in `src/lib/site.ts`): LinkedIn's Post Inspector reads it; Google does not. The privacy page names the same person as who runs Lantern. No page shows a credit.
- X shows a card only when asked for one: the root layout asks for its large card, `summary_large_image`, which reads the Open Graph tags and image.

- Every page's card shows one image (`src/app/opengraph-image.tsx`, 1200 by 630, drawn at build time): Lantern's mark, a lit bead on a sagging wire across the card, over the name and the site's line in two lines, on the night's ground (2026-11-02). Its colours are read from `globals.css` and its type is Fira Sans from `assets/fonts/`. Next adds a root image by itself only to pages that set no preview of their own, so every page that sets one names it (`SITE_CARD` in `src/lib/site.ts`).
- `/favicon.ico` answers with the mark at 16, 32 and 48 px on the night's tile (`src/app/favicon.ico`, drawn by `scripts/favicon.mts`, `docs/brand/README.md`), for whatever asks for it by name. It is listed beside `icon.svg` at its own sizes, so a browser that reads the SVG keeps taking it.

Not done, and why: no `llms.txt` (no major search engine or assistant reads it yet), no structured data (little gain for a dozen pages found by name), no card of its own for each day (one card speaks for the whole site), and no publication date (a date in a search result would age days that do not age; 2026-11-08).

## The owner's steps

Only after the branch is deployed to production, since Google and Bing read the live files.

Done on 2026-11-08: Search Console verified by the TXT record, the sitemap submitted, the start screen found already indexed; Bing imported from Search Console, its sitemap added by hand; the card checked in LinkedIn's Post Inspector. Left: once the renderer's fix is live, a live test of one written day should show the day in its screenshot; then Request indexing for all six written days, since Google read them from the sitemap before the fix and may keep their dropped-connection ending until it reads them again. Then the Pages report, in a few days.

### 1. Google Search Console, about 15 minutes

Why: it is the only way to know what Google has indexed and why a page is left out, and the sitemap and a request to index tell Google the site exists now rather than whenever it finds a link.

1. Open https://search.google.com/search-console with the Google account that should own the site, and add a property of the **Domain** kind for `lanternday.com`. A Domain property covers `www` and the apex, `http` and `https`, in one.
2. Google shows a TXT record, `google-site-verification=…`. In Vercel, open the domain `lanternday.com` (Domains) and add a DNS record: type `TXT`, name left empty (the apex), value the string Google gave. The domain was bought on Vercel, so its DNS lives there.
3. Back in Search Console, press Verify. A record can take a few minutes to be seen; keep the record afterwards, since Google checks it again.
4. Sitemaps: submit `https://www.lanternday.com/sitemap.xml`. It should read "Success", with 8 pages found today: the start screen, the six written days and the privacy page. The three days written by hand left the site on 2026-11-04, so a sitemap read before then listed 11.
5. URL inspection: inspect `https://www.lanternday.com/` and press Request indexing. Do the same for every written day once a live test of one (Test live URL, View tested page, Screenshot) shows its day, not an ending.
6. In a few days, open Pages. A visitor's day, if any was crawled, shows as "Excluded by 'noindex' tag". The studio and the lab show, if at all, as "Blocked by robots.txt": Google is asked not to read them, so it never sees their 401. A lab page Google listed before the lock of 2026-11-04 may stay a while as "Indexed, though blocked by robots.txt"; Removals hides it from results at once if that matters. The old addresses of the days written by hand, `/day/kyoto`, `/day/alicante` and `/day/lisbon`, now answer as a city with no day, a 404 with `noindex`, so they show under "Not found (404)", or under "Excluded by 'noindex' tag" where Google was given a first visit's 200. All intended.

### 2. Bing Webmaster Tools, about 5 minutes

Why: Bing's index serves Bing, DuckDuckGo, Yahoo and Ecosia, and several AI assistants search the web through it.

1. Open https://www.bing.com/webmasters and sign in.
2. Choose Import from Google Search Console and pick `lanternday.com`. It brings the verified site and its sitemap across, so nothing has to be verified twice.

### 3. Check the card, about 5 minutes

Why: LinkedIn keeps a link's card for about a week, so a link posted before the tags existed keeps showing the old one until it is refreshed.

1. Paste `https://www.lanternday.com/` and `https://www.lanternday.com/day/kanazawa` into https://www.linkedin.com/post-inspector/. It shows the card, with its image, and refreshes LinkedIn's copy.
2. Send both links to yourself in Slack and in iMessage.

### 4. Your name, ongoing

Why: a search engine ties a name to a site mostly through links from pages that are already about the person.

- Link `https://www.lanternday.com` from the LinkedIn profile (Featured, and the website in Contact info), from the GitHub profile's website field and the repository's About.
