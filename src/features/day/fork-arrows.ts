/** The keys that move between a fork's two answers, on the chart and on the plan. */
const FORK_ARROWS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

/** What a key press says of itself, as a keyboard event carries it. */
interface KeyPress {
  key: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

/**
 * Whether a key is a fork's own arrow, which takes the other answer as a radio group's does. An
 * arrow held with Alt, Command or Control is the browser's or the system's, as Back is, and
 * takes no answer.
 */
export function isForkArrow(press: KeyPress): boolean {
  return FORK_ARROWS.includes(press.key) && !press.altKey && !press.metaKey && !press.ctrlKey;
}
