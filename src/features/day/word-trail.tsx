import { motion, type MotionValue } from "motion/react";

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
 * round it rather than across it, and it never opens a line. Set apart, it takes none of
 * the word's underline or ink, keeps the sentence's, and is not heard as part of the word.
 */
export function WordTrail({ trail, opacity, room = trail }: WordTrailProps) {
  const unseen = room.startsWith(trail) ? room.slice(trail.length) : "";
  if (!trail && !unseen) return null;
  return (
    <>
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
    </>
  );
}
