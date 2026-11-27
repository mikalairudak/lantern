import { motion, type MotionValue } from "motion/react";

/**
 * A word of the sentence inside its box (`whitespace-nowrap`), which wraps only where it is
 * wider than the line, as a long answer is on a phone with the browser's text at 200%; narrower,
 * the box stands whole on one line, as it always has. Its words, in an element of these, wrap
 * between them, and the comma after them stays with the last (`WordTrail`).
 */
export const WORD_WRAP_CLASSES = "whitespace-normal";

/** A city of one word, which breaks between its letters where it is wider than the line. */
const ONE_WORD_CITY_CLASSES = "whitespace-normal break-all";

/**
 * How a city's name wraps where it is wider than the line, as Amsterdam's is on a phone with the
 * browser's text at 200%: between its words where it has more than one, and between the letters
 * of a name of one word, which has nowhere else to break. Either way the comma after the name
 * stays with its last letter (`WordTrail`).
 */
export function cityWrapClassesOf(city: string): string {
  return city.includes(" ") ? WORD_WRAP_CLASSES : ONE_WORD_CITY_CLASSES;
}

interface WordTrailProps {
  /** The comma after a word of the sentence, or nothing. */
  trail: string;
  /** A comma that leaves with Lantern's words fades with them. */
  opacity?: MotionValue<number>;
  /**
   * The comma it will have once the sentence is whole, its room held unseen until then:
   * a comma that came with Lantern's next word moved what followed it. Its own by default.
   */
  room?: string;
}

/**
 * The comma after a word of the sentence, inside the word's own box: the focus ring goes
 * round it rather than across it, and it never opens a line, joined to the word before it
 * by a word joiner it holds on its line with it (`joined-before`). Set apart, it takes none of
 * the word's underline or ink, keeps the sentence's, and is not heard as part of the word.
 */
export function WordTrail({ trail, opacity, room = trail }: WordTrailProps) {
  const unseen = room.startsWith(trail) ? room.slice(trail.length) : "";
  if (!trail && !unseen) return null;
  return (
    <span aria-hidden className="whitespace-nowrap joined-before">
      {trail && (
        <motion.span aria-hidden style={{ opacity }} className="inline-block text-ink-soft">
          {trail}
        </motion.span>
      )}
      {unseen && (
        <span aria-hidden className="invisible inline-block">
          {unseen}
        </span>
      )}
    </span>
  );
}
