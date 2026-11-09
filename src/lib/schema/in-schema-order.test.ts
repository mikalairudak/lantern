import { describe, expect, it } from "vitest";
import { z } from "zod";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { inSchemaOrder } from "./in-schema-order";
import { GeneratedDaySchema } from "./itinerary.schema";
import { GeneratedReplanSchema } from "./replan.schema";

/** The containers `inSchemaOrder` walks into, and the values it leaves as they are. */
const FOLLOWED = [z.ZodObject, z.ZodArray, z.ZodNullable, z.ZodOptional];
const LEAVES = [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodEnum, z.ZodLiteral];

/** The paths of every node `inSchemaOrder` neither walks into nor may leave as it is. */
function unfollowedIn(schema: z.ZodType, path = "$"): string[] {
  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape as Record<string, z.ZodType>).flatMap(([key, value]) =>
      unfollowedIn(value, `${path}.${key}`),
    );
  }
  if (schema instanceof z.ZodArray) return unfollowedIn(schema.element as z.ZodType, `${path}[]`);
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return unfollowedIn(schema.unwrap() as z.ZodType, path);
  }
  const isKnown = [...FOLLOWED, ...LEAVES].some((kind) => schema instanceof kind);
  return isKnown ? [] : [path];
}

const Inner = z.strictObject({ first: z.string(), second: z.number() });
const Outer = z.strictObject({
  title: z.string(),
  inner: Inner,
  list: z.array(Inner),
  maybe: Inner.nullable(),
});

describe("inSchemaOrder", () => {
  it("puts every object's keys in its schema's order, through lists and nullables", () => {
    const typed = {
      maybe: { second: 3, first: "c" },
      list: [{ second: 2, first: "b" }],
      inner: { second: 1, first: "a" },
      title: "t",
    };

    expect(JSON.stringify(inSchemaOrder(Outer, typed))).toBe(
      '{"title":"t","inner":{"first":"a","second":1},"list":[{"first":"b","second":2}],"maybe":{"first":"c","second":3}}',
    );
    expect(inSchemaOrder(Outer, { ...typed, maybe: null }).maybe).toBeNull();
  });

  // A union, pipe or lazy field would stream every fixture out of the model's order unseen.
  it("follows every node of the schemas the model writes", () => {
    expect(unfollowedIn(GeneratedDaySchema)).toEqual([]);
    expect(unfollowedIn(GeneratedReplanSchema)).toEqual([]);
  });

  it("keeps a key the schema does not know, after the ones it does", () => {
    expect(Object.keys(inSchemaOrder(Inner, { extra: true, second: 1, first: "a" }))).toEqual([
      "first",
      "second",
      "extra",
    ]);
  });

  // `docs/decisions.md`, "Field order is render order": the simulated stream writes a hand-typed
  // fixture as the model would.
  it("streams a curated day's place with its point, sensory profile and light before its summary", () => {
    const [first] = KYOTO_DAY.day.stops;
    if (first === undefined) throw new Error("Kyoto has stops");
    const text = dayText(KYOTO_DAY.day);
    const at = (needle: string) => text.indexOf(needle);

    expect(text).toContain(
      `"coordinates":${JSON.stringify(first.place.coordinates)},"sensory":{"energy":"${first.place.sensory.energy}"`,
    );
    expect(at('"light":{')).toBeLessThan(at('"summary":'));
  });
});
