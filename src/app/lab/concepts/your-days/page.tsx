import type { Metadata } from "next";
import { YourDaysConcept } from "./your-days-concept";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Concept · Your days");
}

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

/** The visitor's own days as the start screen's ledger, with the other answers to its form. */
export default async function YourDaysConceptPage() {
  await requireStudioLogin();
  return <YourDaysConcept />;
}
