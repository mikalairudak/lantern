import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { START_REQUESTS } from "@/lib/days/written/quick-starts";
import { AddressPage } from "./address-page";
import { daySlugOf } from "@/lib/days/address";
import { LINK_CLASSES } from "./link-classes";
import { OPENS_HERE, STILL_WRITING } from "./not-yet";
import { AskedSentence } from "./asked-sentence";

/** The headline of an address Lantern shows no day at. */
export const NO_DAY_HERE = "Lantern has no day at this address.";

/** The title of a page with no day, before the site's own. */
export const NO_DAY_TITLE = "No day here";

/** The title of a day's address while its day is still being written, before the site's own. */
export const STILL_WRITING_TITLE = "A day being written";

/**
 * Any address Lantern has no page for, a city it has written no day for, and a day's id the
 * log never kept: said plainly, with the days the quick starts open, each as its sentence, and
 * the way to one's own.
 */
export function NoDayHere() {
  return (
    <AddressPage headline={NO_DAY_HERE}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {START_REQUESTS.map((request) => (
          <li key={request.city}>
            <Link
              href={`/day/${daySlugOf(request)}`}
              className={cn(
                LINK_CLASSES,
                "inline-block text-left type-voice text-body text-ink-soft",
              )}
            >
              <AskedSentence request={request} />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5">
        <Link href="/" className={cn(LINK_CLASSES, "type-voice text-body text-ink-soft")}>
          Plan your own day
        </Link>
      </p>
    </AddressPage>
  );
}

/**
 * A day's address while its day is still being written, for a visitor whose browser did not
 * ask it, so nothing here says what it was asked for: the page waits, and the day takes it
 * once its record lands.
 */
export function StillWritingHere() {
  return (
    <AddressPage headline={STILL_WRITING}>
      <p className="type-voice text-body text-ink-soft">{OPENS_HERE}</p>
    </AddressPage>
  );
}
