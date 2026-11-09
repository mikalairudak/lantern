import { normalizeIntake } from "@/lib/normalizer/normalize-intake";
import { formatPath } from "@/lib/quality/path";
import {
  GeneratedIntakeSchema,
  type CityReading,
  type IntakeResult,
} from "@/lib/schema/intake.schema";
import { resolveCities, type TextSearch } from "./resolve-city";

/**
 * Why an intake the model wrote could not be answered, named as the server's log line and the
 * record's `error.type` name it, apart from Claude's own errors: its output was not an intake,
 * or Geoapify could not look its cities up.
 */
export type IntakeFailureType = "intake-output-unparsable" | "city-lookup-failed";

export interface IntakeFailure {
  type: IntakeFailureType;
  message: string;
}

/** What became of a model's output: the start screen's answer, or why there is none. */
export type IntakeReading =
  { kind: "answered"; result: IntakeResult } | { kind: "failed"; failure: IntakeFailure };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The intake route's body after its model call: the output checked against its schema, its
 * names looked up, and the answer the start screen gets, or the failure that stopped it. The
 * caller's own abort is passed on, since nobody reads the answer then.
 */
export async function readIntake(
  output: unknown,
  search: TextSearch,
  now: Date,
  signal?: AbortSignal,
  text: string | null = null,
): Promise<IntakeReading> {
  const intake = GeneratedIntakeSchema.safeParse(output);
  if (!intake.success) {
    const message = intake.error.issues
      .map((issue) => `${formatPath(issue.path) || "intake"}: ${issue.message}`)
      .join("; ");
    return { kind: "failed", failure: { type: "intake-output-unparsable", message } };
  }
  let cities: CityReading[];
  try {
    cities = await resolveCities(intake.data, search, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "failed", failure: { type: "city-lookup-failed", message: messageOf(error) } };
  }
  return { kind: "answered", result: normalizeIntake(intake.data, cities, now, text) };
}

/**
 * The same, as the start screen reads it: an output that is not an intake, or a lookup that
 * fails, is answered as an intake that could not run.
 */
export async function answerIntake(
  output: unknown,
  search: TextSearch,
  now: Date,
  signal?: AbortSignal,
  text: string | null = null,
): Promise<IntakeResult> {
  const reading = await readIntake(output, search, now, signal, text);
  return reading.kind === "answered" ? reading.result : { kind: "unavailable" };
}
