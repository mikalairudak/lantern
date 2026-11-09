import { z } from "zod";

/**
 * A value with each object's keys in its schema's order, the order structured outputs write
 * them in. A fixture written by hand, in whatever order its keys were typed, then streams as the
 * model would write it, and a change to the schema's order reaches every simulated stream.
 * Keys the schema does not know keep their place after the ones it does.
 */
export function inSchemaOrder<T>(schema: z.ZodType, value: T): T {
  if (value === null || value === undefined) return value;
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return inSchemaOrder(schema.unwrap() as z.ZodType, value);
  }
  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    return value.map((item: unknown) => inSchemaOrder(schema.element as z.ZodType, item)) as T;
  }
  if (schema instanceof z.ZodObject && typeof value === "object") {
    const shape = schema.shape as Record<string, z.ZodType>;
    const record = value as Record<string, unknown>;
    const known = Object.keys(shape).filter((key) => key in record);
    const unknown = Object.keys(record).filter((key) => !(key in shape));
    return Object.fromEntries([
      ...known.map((key) => [key, inSchemaOrder(shape[key] as z.ZodType, record[key])]),
      ...unknown.map((key) => [key, record[key]]),
    ]) as T;
  }
  return value;
}
