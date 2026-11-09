import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOLOGNA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { InvitationPlay } from "../invitation-play";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Invitation · Bologna");
}

// A lab frame is opened as a link, so it may wait for its params rather than show a
// placeholder first.
export const instant = false;

/** Bologna in each theme, prerendered. */
export function generateStaticParams(): { theme: string }[] {
  return THEMES.map((theme) => ({ theme }));
}

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/**
 * Bologna written from the route as its own address writes it, in one theme: a page the
 * lab's side-by-side frames each load. Lisbon stood here until the days written by hand left
 * the route (2026-11-04); Bologna is the start with its words, a lively day with friends.
 */
export default async function InvitationPlayPage({
  params,
}: {
  params: Promise<{ theme: string }>;
}) {
  await requireStudioLogin();
  const { theme } = await params;
  if (!isTheme(theme)) notFound();
  return <InvitationPlay theme={theme} request={BOLOGNA_START_REQUEST} />;
}
