import { Fira_Sans } from "next/font/google";

// One sans in one weight sets every text role (`docs/decisions.md`, "One sans in one weight:
// Fira Sans"), so Fira Sans loads only its regular, with its true italic.
// latin-ext covers place names such as Hōnen-in; Cyrillic is the app's second script.
// next/font self-hosts the files, so browsers never call Google. The variable is named
// for the voice, not the face, so the lab can put another face in a subtree.
// Loaded here once, for the two documents that draw a page: the root layout's, and the one
// `global-error.tsx` draws in its place (next/font hosts one instance per call).
export const firaSans = Fira_Sans({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--family-sans",
});

/** The page's ground, its sans and its ink, under everything either document draws. */
export const BODY_CLASSES = "bg-ground font-sans text-body text-ink antialiased";
