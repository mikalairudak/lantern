import localFont from "next/font/local";

/**
 * One serif in one weight sets every text role (`docs/decisions.md`, "One serif in one weight:
 * Literata"): Literata at 400, roman and its true italic, with its optical size axis kept, so
 * the browser sets a 12 px note in the sturdy cut and a 34 px sentence in the fine one. The
 * files are cut from the variable font to that one weight, in Latin, Latin Extended and
 * Cyrillic (`assets/fonts/README.md`): `next/font/google` keeps the optical size only with
 * every weight, more than twice the bytes. Served from the site, so browsers call no one else.
 * The fallback is Times New Roman sized to Literata's metrics, so the page holds still when
 * the face lands. Loaded here once, for the two documents that draw a page: the root layout's,
 * and the one `global-error.tsx` draws in its place (next/font hosts one instance per call).
 */
export const literata = localFont({
  src: [
    { path: "../../assets/fonts/Literata-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../assets/fonts/Literata-Italic.woff2", weight: "400", style: "italic" },
  ],
  adjustFontFallback: "Times New Roman",
  variable: "--family-serif",
});

/** The page's ground, its serif and its ink, under everything either document draws. */
export const BODY_CLASSES = "bg-ground font-serif text-body text-ink antialiased";
