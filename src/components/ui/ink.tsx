/** How many of the newest characters stay light while a text is being written. */
const FRESH_CHARACTERS = 14;

interface InkProps {
  text: string | undefined;
  /** True while this is the text the stream is writing. */
  isActive: boolean;
}

/**
 * Text that dries as it is written: the newest characters are lighter and darken as the
 * stream moves past them. Once the text is finished it is plain ink.
 */
export function Ink({ text, isActive }: InkProps) {
  if (!text) return null;
  return <InkPart text={text} from={0} to={text.length} isActive={isActive} />;
}

interface InkPartProps {
  /** The whole text being written. */
  text: string;
  /** Where the part starts and ends in it. */
  from: number;
  to: number;
  /** True while the whole text is the one the stream is writing. */
  isActive: boolean;
}

/**
 * A part of a text being written, dried as the whole text dries, for a text set in pieces:
 * a last word kept on one line with the mark after it is a piece of its own.
 */
export function InkPart({ text, from, to, isActive }: InkPartProps) {
  const fresh = isActive ? Math.max(0, text.length - FRESH_CHARACTERS) : text.length;
  const dryTo = Math.min(to, Math.max(from, fresh));
  return (
    <>
      {text.slice(from, dryTo)}
      {dryTo < to && <span className="text-muted">{text.slice(dryTo, to)}</span>}
    </>
  );
}
