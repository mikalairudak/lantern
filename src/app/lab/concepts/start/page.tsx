import type { Metadata } from "next";
import { connection } from "next/server";
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
  // The login is read from the headers, which a prefetched shell already holds, so the page
  // waits for the visit here, and the clock that picks each day's season is the visit's.
  await connection();
  return <StartConcept pool={shownPool(new Date())} />;
}
