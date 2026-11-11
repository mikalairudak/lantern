import type { Metadata } from "next";
import { shownPool } from "@/features/day/written-pool";
import { StartConcept } from "./start-concept";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Concept · Start");
}

/**
 * The start screen over the written days, with the lab's controls. The days are normalized
 * here, on the server, as the landing does.
 */
// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function StartConceptPage() {
  await requireStudioLogin();
  return <StartConcept pool={shownPool(new Date())} />;
}
