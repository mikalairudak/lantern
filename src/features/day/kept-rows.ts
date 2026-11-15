import type { z } from "zod";
import type { DayStorage } from "./your-days";

/**
 * The rows of a list kept under `key`, in its order. A browser that keeps nothing, or a value
 * that is no list, reads as no rows, rather than as a page that breaks. A row that does not
 * read, another version's or one edited by hand, is let go alone: the next write puts the list
 * back as it was read, so one row must never take the rows beside it.
 */
export function readKeptRows<Row>(
  storage: DayStorage | null,
  key: string,
  schema: z.ZodType<Row>,
): Row[] {
  try {
    const kept = storage?.getItem(key);
    if (!kept) return [];
    const rows: unknown = JSON.parse(kept);
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => rowOf(row, schema));
  } catch {
    return [];
  }
}

/** One row, or none: a row whose reading fails or throws is the only one let go. */
function rowOf<Row>(row: unknown, schema: z.ZodType<Row>): Row[] {
  try {
    const read = schema.safeParse(row);
    return read.success ? [read.data] : [];
  } catch {
    return [];
  }
}
