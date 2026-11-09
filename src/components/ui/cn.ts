/** Joins class names, skipping the falsy ones; lint checks strings passed to `cn`. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
