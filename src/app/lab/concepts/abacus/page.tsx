/**
 * The abacus as first built, on a hand-written day: the prototype the product's chart was
 * lifted from (`docs/decisions.md`, "The day is drawn as an abacus"). Its re-composition, which
 * rewrites a stop in place, is the lab's alone: the product re-plans a part of the day through
 * `replanFrameOf` instead.
 */
import type { Metadata } from "next";
import { AbacusConcept } from "./abacus-concept";
import { ABACUS_DAY, ABACUS_WEATHER } from "@/lib/fixtures/hand-made/abacus-candidates";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Concept · Abacus");
}

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function AbacusConceptPage() {
  await requireStudioLogin();
  return <AbacusConcept itinerary={ABACUS_DAY} weather={ABACUS_WEATHER} />;
}
