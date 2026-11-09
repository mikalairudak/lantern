import { formatPath } from "@/lib/quality/path";
import type { PartialDay } from "@/lib/stream/outcome";
import { openPathOf } from "./frames";

/**
 * A partial day as plain lines: what has arrived, in schema order, and the field the
 * stream is still writing. A tool for reading the stream, not a design of the day: it
 * shows a word cut mid-way and a number still growing exactly as they arrive.
 */

/** Stands in for a value that has not arrived yet. */
const MISSING = "…";
// An open value is cut to this many characters, so a long summary keeps the view short.
const OPEN_VALUE_CHARS = 120;

const LINE_CLASSES = "flex gap-3";
const TIME_CLASSES = "w-12 shrink-0 type-time text-muted";
const NOTE_CLASSES = "type-note text-muted";

interface PartialDayViewProps {
  partial: PartialDay;
}

export function PartialDayView({ partial }: PartialDayViewProps) {
  const openPath = openPathOf(partial);
  const openValue = valueAt(partial, openPath);
  const stops = partial.stops ?? [];
  const sets = partial.alternatives ?? [];

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="partial-day">
      <p className="type-prose text-body text-ink-soft">{partial.dek || MISSING}</p>
      <ol className="flex flex-col gap-2" aria-label="Stops so far">
        {stops.map((stop, index) => (
          <li key={index} className={LINE_CLASSES}>
            <span className={TIME_CLASSES}>{stop?.startTime || MISSING}</span>
            <span className="flex min-w-0 flex-col">
              <span className="type-name text-ink">{stop?.place?.name || MISSING}</span>
              <span className={NOTE_CLASSES}>
                {[stop?.place?.kind, stop?.place?.neighborhood, stop?.place?.sensory?.energy]
                  .filter(Boolean)
                  .join(" · ") || MISSING}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {sets.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Swaps so far">
          {sets.map((set, index) => (
            <li key={index} className={NOTE_CLASSES}>
              {`Stop ${set?.stopIndex ?? MISSING}: `}
              {(set?.options ?? []).map((option) => option?.name || MISSING).join(", ") || MISSING}
            </li>
          ))}
        </ul>
      )}
      <p className={NOTE_CLASSES} data-testid="open-field">
        {openPath.length === 0
          ? "Nothing has arrived."
          : `Writing ${formatPath(openPath)}: ${preview(openValue)}`}
      </p>
    </div>
  );
}

function valueAt(root: unknown, path: readonly (string | number)[]): unknown {
  return path.reduce<unknown>(
    (node, key) =>
      typeof node === "object" && node !== null
        ? (node as Record<string | number, unknown>)[key]
        : undefined,
    root,
  );
}

function preview(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > OPEN_VALUE_CHARS ? `${text.slice(0, OPEN_VALUE_CHARS)}…` : text;
}
