import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { DayRequestSchema, GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";
import type { BenchDay } from "./fork-benches";
import { ForkConcept } from "./fork-concept";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Concept · Fork");
}

/** The golden set's Kyoto day for friends, the bench's whole day written again. */
const KYOTO_FRIENDS_CASE = "the start, one run: slow to early";

/** Sonnet's Kyoto day for friends from the golden set, read on the server. */
function kyotoFriendsDay(): BenchDay {
  const file = path.join(process.cwd(), "src/lib/fixtures/replan/golden-replans.jsonl");
  const line = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((text) => JSON.parse(text) as { name: string; request: unknown; outputText: string })
    .find((entry) => entry.name === KYOTO_FRIENDS_CASE);
  if (!line) throw new Error(`The golden set has no "${KYOTO_FRIENDS_CASE}"`);
  return {
    request: DayRequestSchema.parse(line.request),
    day: withLettersUnescaped(GeneratedDaySchema.parse(JSON.parse(line.outputText))),
  };
}

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function ForkConceptPage() {
  await requireStudioLogin();
  return <ForkConcept kyotoFriends={kyotoFriendsDay()} />;
}
