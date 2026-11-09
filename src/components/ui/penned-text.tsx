import { Ink } from "@/components/ui/ink";

interface PennedTextProps {
  text: string;
  /** How many of its letters the pen has written. */
  written: number;
  /** The stream is still writing it, so its last letters are in drying ink. */
  isActive: boolean;
}

/**
 * Text as far as the pen has written it, the rest holding its room unseen, so nothing after
 * it moves and no word changes lines as it is written; whole, as the stream gives it.
 */
export function PennedText({ text, written, isActive }: PennedTextProps) {
  if (written >= text.length) return <Ink text={text} isActive={isActive} />;
  const shown = text.slice(0, Math.max(0, written));
  return (
    <>
      <Ink text={shown} isActive />
      <span className="invisible">{text.slice(shown.length)}</span>
    </>
  );
}
