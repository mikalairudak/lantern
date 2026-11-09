/** Writes a path into a generated day the way a person reads it: `stops[2].place.summary`. */
export function formatPath(segments: readonly PropertyKey[]): string {
  return segments
    .map((segment, index) => {
      if (typeof segment === "number") return `[${segment}]`;
      const key = String(segment);
      return index === 0 ? key : `.${key}`;
    })
    .join("");
}

/** A generated string and where it is. */
export interface TextAt {
  /** As `formatPath` writes it, e.g. `stops[2].place.summary`. */
  path: string;
  text: string;
}

/**
 * Every string in `value` with its path, except under the object keys in `skippedKeys`. It
 * walks the whole value, so a field added to the schema is covered without changing a check.
 */
export function textsIn(value: unknown, skippedKeys: ReadonlySet<string> = new Set()): TextAt[] {
  const texts: TextAt[] = [];
  const walk = (node: unknown, path: PropertyKey[]): void => {
    if (typeof node === "string") {
      texts.push({ path: formatPath(path), text: node });
    } else if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, [...path, index]));
    } else if (node !== null && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        if (!skippedKeys.has(key)) walk(child, [...path, key]);
      }
    }
  };
  walk(value, []);
  return texts;
}
