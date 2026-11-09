import type { Metadata } from "next";
import { InvitationConcept } from "./invitation-concept";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Concept · Invitation");
}

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function InvitationConceptPage() {
  await requireStudioLogin();
  return <InvitationConcept />;
}
