import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, cache } from "react";
import { Day } from "@/features/day/day";
import { dayAddressOf, daySlugOf } from "@/lib/days/address";
import { KeptDayPage } from "@/features/day/kept-day-page";
import { LiveFlag } from "@/features/day/live-flag";
import { seenKeyOf, seenScriptOf } from "@/features/day/seen-days";
import { writtenVersionOf } from "@/lib/days/written/version";
import { InlineScript } from "@/components/ui/inline-script";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { writtenChecksOf } from "@/lib/days/written/checks";
import { placeCheckOf } from "@/lib/stream/place-checks";
import { STILL_WRITING_TITLE } from "@/features/day/no-day-here";
import { requestSentenceOf } from "@/features/day/sentence";
import { shownWrittenDayAt, writtenDayAt, type NormalizedDay } from "@/lib/days/written/days";
import { isDayId, type StoredDay } from "@/lib/days/stored-day";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { isLiveNow } from "@/lib/live/live-now";
import { logToConsole } from "@/lib/live/provider-error";
import { storedDayOf } from "@/lib/live/stored-days";
import { listedPageMetadata, openGraphOf } from "@/lib/site";

/** Every day Lantern has written has an address of its own, prerendered. */
export function generateStaticParams(): { city: string }[] {
  return WRITTEN_REQUESTS.map((request) => ({ city: daySlugOf(request) }));
}

// A day's address is opened as a link, so it may wait for its params rather than show a
// placeholder first.
export const instant = false;

/**
 * The day kept under an id, read once for the page and its title. A log that cannot be read
 * answers as a day not found yet, which the page asks for again, never as a failed page.
 *
 * Read at request time, after `connection()`: an id is never in `generateStaticParams`, so its
 * first visit renders a static page for that address, and a read of the log or the clock there
 * is refused (`new Date()` in `readStoredDay`), the refusal production answered with a 500 on
 * 2026-11-01. `connection()` tells Cache Components the kept day is meant to be read for each
 * visit (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`,
 * "With Cache Components"); a written day's address, whose day is in the build, is untouched.
 */
const keptDayOf = cache(async (id: string): Promise<StoredDay> => {
  await connection();
  try {
    return await storedDayOf(id);
  } catch (cause) {
    logToConsole("stored-day-unread", {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return { status: "unknown" };
  }
});

/**
 * A link to a day says which day it is: its request as a sentence, and its line, in the tab,
 * a search result and a link's preview. A written day is listed at its own address; a day of
 * a visitor's, at its id, is theirs to send, never one for a search engine to list.
 */
export async function generateMetadata({ params }: PageProps<"/day/[city]">): Promise<Metadata> {
  const { city } = await params;
  if (isDayId(city)) {
    const stored = await keptDayOf(city);
    const isShown = stored.status === "written" || stored.status === "cut";
    // A day not found yet says it is being written, as its page does; a title left out
    // would leave the tab with none, not the site's default.
    const title = "request" in stored ? requestSentenceOf(stored.request) : STILL_WRITING_TITLE;
    const description = isShown ? stored.itinerary.dek : undefined;
    return {
      title,
      ...(description !== undefined && { description }),
      // Previewed where the visitor sends it, at no address of its own to be found at.
      openGraph: openGraphOf({ title, description }),
      robots: { index: false, follow: false },
    };
  }
  const written = writtenDayAt(city);
  if (!written) notFound();
  const summary = {
    title: requestSentenceOf(written.request),
    description: written.itinerary.dek,
  };
  return { ...summary, ...listedPageMetadata(dayAddressOf(written.request), summary) };
}

/**
 * A day Lantern has written, at its own address, so it can be sent as a link: written from
 * the route on arrival, as the stream plays it. The address follows the day on screen when
 * the city word plays another. A day's id in the log is a visitor's day, opened whole as it
 * ended, or what stands in for it (`KeptDayPage`). An address that is neither never reaches
 * the page: a rewrite answers it with the not-found page and a 404 (`notADaySource`), since
 * here its first visit would stream from the route's prerendered shell with a 200 before
 * `notFound()` ran. The page's own `notFound()` stays for what the rewrite leaves to it, a
 * slug followed by a dot.
 *
 * A written day is drawn in the page's static shell, served as built: it reads nothing of the
 * visit, and holds the day whole, for a reader without the page's script; a visitor who has
 * not watched it to its end on this device has it played (`seen-days.ts`). Whether Lantern
 * writes new days, which only a press on the day asks, is read for each visit in a part of
 * its own (`LiveFlag`): awaited around the whole day, it held every visit's first frame, the
 * header too, for the function, and a page read without its script had nothing in it at all.
 */
export default async function WrittenDayPage({ params }: PageProps<"/day/[city]">) {
  const { city } = await params;
  if (isDayId(city)) {
    return (
      // Nothing in its place: the day's first frame is its own, never a placeholder.
      <Suspense fallback={null}>
        <LiveKeptDay id={city} />
      </Suspense>
    );
  }
  const written = writtenDayAt(city);
  const shown = await shownDayAt(city);
  if (!written || !shown) notFound();
  // The day's version, worked out from it as built: a day rewritten plays as new, and one
  // whose date moved on is the same day.
  const version = writtenVersionOf(written.itinerary);
  // The day holds its own main, with the page's last line after it.
  return (
    <>
      {/* Before the day's markup: whether this device has seen the day, which the day's
          first HTML, drawn whole, waits for (`seen-days.ts`). */}
      <InlineScript html={seenScriptOf(seenKeyOf(city, version))} />
      <Day
        first={shown.request}
        firstPlace={shown.itinerary.stops[0]?.primary.coordinates}
        written={{
          itinerary: shown.itinerary,
          version,
          checks: placeChecksOf(written.request.city),
        }}
        isAddressed
        isCounted
      />
      {/* Nothing in its place: until it comes, the day is one Lantern does not write. */}
      <Suspense fallback={null}>
        <LiveNow />
      </Suspense>
    </>
  );
}

/** How long a written day's page stands before it is drawn again for the clock. */
const SHOWN_DAY_STALE_SECONDS = 5 * 60;
const SHOWN_DAY_REVALIDATE_SECONDS = 15 * 60;
const SHOWN_DAY_EXPIRE_SECONDS = 60 * 60;

/**
 * A written day on the date it is shown on (`shownDateOf`), drawn into the page's first HTML
 * and drawn again within the hour: a page is at most an hour behind its date, which moves on
 * once a week. An `expire` under five minutes would take the day out of the prerender, and a
 * page read without its script would have nothing in it.
 */
async function shownDayAt(slug: string): Promise<NormalizedDay | null> {
  "use cache";
  cacheLife({
    stale: SHOWN_DAY_STALE_SECONDS,
    revalidate: SHOWN_DAY_REVALIDATE_SECONDS,
    expire: SHOWN_DAY_EXPIRE_SECONDS,
  });
  return shownWrittenDayAt(slug, new Date());
}

/** A written day's place checks as the run that wrote it had them, as the route plays them. */
function placeChecksOf(city: string): PlaceChecks {
  const recorded = writtenChecksOf(city);
  return Object.fromEntries(
    Object.entries(recorded).map(([placeId, result]) => [placeId, placeCheckOf(placeId, result)]),
  );
}

/** Whether Lantern writes new days, read for this visit and noted for the day. */
async function LiveNow() {
  return <LiveFlag isLive={await isLiveNow()} />;
}

async function LiveKeptDay({ id }: { id: string }) {
  const [stored, isLive] = await Promise.all([keptDayOf(id), isLiveNow()]);
  return <KeptDayPage id={id} stored={stored} isLive={isLive} />;
}
