import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AbacusConcept } from "../../abacus-concept";
import { EDGE_FRAMES, edgeDayOf, edgeItineraryOf } from "../../edge-frames";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Concept · Abacus · Edge day");
}

/** Every edge day, prerendered; any other path is not found. */
export function generateStaticParams(): { edge: string }[] {
  return EDGE_FRAMES.map(({ key }) => ({ edge: key }));
}

// An edge day is opened by its URL from the lab, so it may wait for its params rather
// than show a placeholder first.
export const instant = false;

/**
 * One of the edge days on the abacus, finished. The header's words are the Alicante
 * concept's, so only the chart and its rows are under test here, and the chart spans the
 * stops rather than the header's hours. Edge days carry no forecast.
 */
export default async function EdgeDayPage({
  params,
}: PageProps<"/lab/concepts/abacus/edge/[edge]">) {
  await requireStudioLogin();
  const { edge } = await params;
  const day = edgeDayOf(edge);
  if (!day) notFound();
  return (
    <AbacusConcept
      itinerary={edgeItineraryOf(day)}
      weather="no forecast"
      isFramedByStops
      isInitiallyComplete
    />
  );
}
