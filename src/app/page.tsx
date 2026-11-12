import type { Metadata } from "next";
import { Suspense } from "react";
import { START_ADDRESS } from "@/lib/days/address";
import { StartDay } from "@/features/day/start-day";
import { shownPool } from "@/features/day/written-pool";
import { isLiveNow } from "@/lib/live/live-now";
import { listedPageMetadata, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = listedPageMetadata(START_ADDRESS, {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
});

/**
 * The landing is the start screen: one question and the cities Lantern has written, with no
 * day until the visitor asks for one (`docs/decisions.md`, "The first screen asks one question,
 * and no day is drawn until a press"). The written days are
 * normalized here, on the server. Whether Lantern writes new days is read for each visit,
 * so the static shell holds the layout alone and the start screen streams in after it.
 */
export default function Home() {
  // The start screen holds its own main, with the page's last line after it.
  return (
    // Nothing in its place: the screen's first frame is its words, never a placeholder.
    <Suspense fallback={null}>
      <LiveStartDay />
    </Suspense>
  );
}

async function LiveStartDay() {
  // Read once the visit has arrived (`isLiveNow`), so the clock that picks each day's season is
  // the visit's, never the build's.
  const isLive = await isLiveNow();
  const now = new Date();
  return <StartDay pool={shownPool(now)} isLive={isLive} isCounted />;
}
