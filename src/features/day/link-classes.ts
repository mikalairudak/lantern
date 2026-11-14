/**
 * How Lantern's text links and link-like buttons look: underlined, the rule twice as heavy under a pointer
 * and for the keyboard, which rings it in ink too. A plain module, not a client one, so a Server Component
 * such as the not-found page gets the string itself rather than a client reference to it.
 */
/**
 * A small link's target reaches 8 px past its words on every side, unseen, so a thumb finds
 * it: the masthead's "New day" (52 × 20 px as set) and the foot's links (154 × 13 px). The
 * words, the underline and the focus ring stay as they are.
 */
export const TARGET_CLASSES = "relative after:absolute after:-inset-2";

export const LINK_CLASSES =
  "rounded-sm underline decoration-1 underline-offset-4 transition-colors pointed:decoration-2 focus-ring";
