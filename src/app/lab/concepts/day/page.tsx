import type { Metadata } from "next";
import { DayConcept } from "./day-concept";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Composition · Day");
}

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function DayConceptPage() {
  await requireStudioLogin();
  return <DayConcept />;
}
