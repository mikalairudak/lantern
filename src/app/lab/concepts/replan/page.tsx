import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { DayRequestSchema, GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import { ReplanConcept, type BenchDay } from "./replan-concept";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Composition · Re-plan");
}

/** The golden set's case whose dinner rewrites the day's last two stops. */
const LISBON_CASE = "dinner: early to late";

/** Sonnet's Lisbon day from the golden set, read on the server, as the bench's second day. */
function lisbonDay(): BenchDay {
  const file = path.join(process.cwd(), "src/lib/fixtures/replan/golden-replans.jsonl");
  const line = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((text) => JSON.parse(text) as { name: string; request: unknown; outputText: string })
    .find((entry) => entry.name === LISBON_CASE);
  if (!line) throw new Error(`The golden set has no "${LISBON_CASE}"`);
  return {
    request: DayRequestSchema.parse(line.request),
    day: withLettersUnescaped(GeneratedDaySchema.parse(JSON.parse(line.outputText))),
  };
}

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function ReplanConceptPage() {
  await requireStudioLogin();
  return <ReplanConcept lisbon={lisbonDay()} />;
}
