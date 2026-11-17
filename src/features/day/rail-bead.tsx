import { cn } from "@/components/ui/cn";

/**
 * A stop's bead, 8 px: ink, or lit, the lamp with one flat 4 px step of its glow round it. It is
 * drawn as its border, which forced colours draw in the text colour, where a background would
 * take the page's own and vanish; the glow is not drawn there. A bead is lit or not from its
 * first frame, so a row streamed in, drawn whole in the first HTML or come onto the plan as a
 * version taken stands as it will stay.
 */
export function RailBead({ isLit }: { isLit: boolean }) {
  return (
    <span data-bead={isLit ? "lit" : "ink"} className="relative mt-2 size-2">
      {isLit && (
        <span className="absolute -inset-1 rounded-full bg-lamp-glow forced-colors:hidden" />
      )}
      <span
        className={cn(
          "absolute inset-0 rounded-full border-4",
          isLit ? "border-lamp" : "border-ink",
        )}
      />
    </span>
  );
}
