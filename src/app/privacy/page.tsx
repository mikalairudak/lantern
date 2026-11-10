import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { CONTACT_EMAIL, PRIVACY_PATH } from "@/features/day/foot-line";
import { LINK_CLASSES } from "@/features/day/link-classes";
import { Masthead } from "@/features/day/masthead";
import { DAY_LINK_DAYS } from "@/lib/days/stored-day";
import { VISITOR_DAILY_LIMITS } from "@/lib/live/limits";
import { isLiveNow } from "@/lib/live/live-now";
import { VISITOR_TEXT_RETENTION_DAYS } from "@/lib/live/retention";
import { listedPageMetadata } from "@/lib/site";
import { browserStorageLine } from "@/lib/browser-storage";

const TITLE = "Privacy and terms";
const DESCRIPTION =
  "What Lantern keeps, why, who handles it, for how long, your rights, and its short terms.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...listedPageMetadata(PRIVACY_PATH, { title: TITLE, description: DESCRIPTION }),
};

/** When the page last changed what it says. */
const UPDATED = "10 November 2026";

/**
 * Who handles what Lantern keeps, by what each does rather than by name: the recipients'
 * categories, as the GDPR allows (article 13(1)(e)), and their names to anyone who asks. The page
 * is about the visitor's data, not Lantern's stack (`docs/decisions.md`, "What Lantern keeps is
 * said on one page").
 */
const RECIPIENTS = [
  {
    category: "An AI model's provider",
    does: "Its model reads your text and writes the day.",
  },
  {
    category: "A map data service",
    does: "Checks that the city exists, from open map data. It gets the city's name, never your text.",
  },
  {
    category: "Our host",
    does: "Serves Lantern and counts its page views. Like any host, it sees your IP address in its logs.",
  },
  {
    category: "Our database provider",
    does: "Keeps Lantern's database.",
  },
] as const;

const BODY_LINK_CLASSES = cn(LINK_CLASSES, "text-ink");

/** The term an item of a list starts with, in the ink the text around it is softer than. */
const TERM_CLASSES = "text-ink";

/**
 * A privacy notice as a visitor expects one: the short version first, then what Lantern
 * keeps, why, who handles it, for how long, the visitor's rights and the terms, each sentence
 * true to the code (`docs/decisions.md`, "What Lantern keeps is said on one page"). Set as
 * the other pages are, under the masthead; on a laptop each section's heading stands in the
 * margin, as the day's times stand beside its places.
 */
export default function Privacy() {
  return (
    <main className="mx-auto flex max-w-page flex-col px-4 pb-16 md:px-10 lg:px-16">
      <header className="flex shrink-0 flex-col pt-5 pb-5">
        <Masthead />
        <h1 className="mt-5 type-voice text-title text-pretty text-ink">{TITLE}</h1>
        <p className="mt-2 type-note text-muted">Updated {UPDATED}</p>
      </header>
      {/* Whether Lantern writes new days is read for each visit, as the start screen reads
          it, so the notice streams in under the header whole, and nothing in it moves. */}
      <Suspense fallback={null}>
        <Notice />
      </Suspense>
    </main>
  );
}

/**
 * The notice itself. With live generation off the start screen reads the text in the browser
 * and sends none of it, so the short version says that, and that the sections below describe
 * Lantern when it writes new days.
 */
async function Notice() {
  const isLive = await isLiveNow();
  const contact = (
    <a href={`mailto:${CONTACT_EMAIL}`} className={BODY_LINK_CLASSES}>
      {CONTACT_EMAIL}
    </a>
  );
  return (
    <>
      <Section heading="In short">
        <ul className="flex flex-col gap-2 type-voice text-dek text-ink-soft">
          <li>Lantern has no accounts and sets no cookies.</li>
          {isLive ? (
            <>
              <li>
                What you type is read by an AI model to plan your day, and kept for{" "}
                {VISITOR_TEXT_RETENTION_DAYS} days.
              </li>
              <li>
                To keep the free service from being overused, Lantern counts requests by a coded
                form of your IP address. It never stores the address itself.
              </li>
              <li>To have your text deleted, write to {contact}.</li>
            </>
          ) : (
            <>
              <li>
                Lantern isn&apos;t writing new days right now, so what you type is read in your
                browser and never sent.
              </li>
              <li>Write to {contact} with any question.</li>
            </>
          )}
        </ul>
        {!isLive && <p>The sections below describe Lantern when it writes days.</p>}
      </Section>

      <Section heading="What Lantern keeps">
        <ul className="flex flex-col gap-3">
          <li>
            <span className={TERM_CLASSES}>Your text.</span> An AI model reads it once to understand
            the request: the city, the date and the kind of day you want. The day is written from
            that request, not from your words. Your text is kept for {VISITOR_TEXT_RETENTION_DAYS}{" "}
            days. Leave out anything you&apos;d rather not share, such as a name or a phone number.
          </li>
          <li>
            <span className={TERM_CLASSES}>Your request and your day.</span> The request and the day
            written from it are kept longer, to make Lantern&apos;s days better. They hold nothing
            that identifies you unless your text did.
          </li>
          <li>
            <span className={TERM_CLASSES}>Your days&apos; links.</span> Each day Lantern writes for
            you has its own link. Anyone with the link can open that day for {DAY_LINK_DAYS} days.
            The link shows the day and its request, never what you typed.
          </li>
          <li>
            <span className={TERM_CLASSES}>A count of your requests.</span> Lantern writes up to{" "}
            {VISITOR_DAILY_LIMITS.day} days and reads up to {VISITOR_DAILY_LIMITS.intake} texts per
            visitor a day. To count them, it keeps a code made from your IP address with a secret
            key. The code can&apos;t be turned back into your address, but it isn&apos;t anonymous:
            with the key, a known address can be matched to it. A day rewritten for a changed word
            counts too, and the counts start again at midnight UTC.
          </li>
          <li>
            <span className={TERM_CLASSES}>How the page is used.</span> Short notes such as
            &ldquo;the start page was opened&rdquo;, &ldquo;a day was opened&rdquo;, &ldquo;a stop
            was swapped&rdquo; or &ldquo;a day was read to its end&rdquo;, with the city, the date,
            how you came to the day and whether you were reading it on the chart or as a list. They
            carry a code that changes every day and can&apos;t be traced back to you after that day.
            They never hold your IP address, your device or what you typed.
          </li>
          <li>
            <span className={TERM_CLASSES}>Page views.</span> Our host&apos;s analytics notes each
            page opened: its address, with a day&apos;s own link written as /day/[id], the page you
            came from, your country, region and city, and your browser, system and kind of device.
            It sets no cookie, and tells one visit from another by a code made from your request,
            which it drops after a day.
          </li>
          <li>
            <span className={TERM_CLASSES}>In your browser.</span> {browserStorageLine()}{" "}
            &ldquo;Forget these days&rdquo; clears the list of your days, and what your browser
            keeps of every day Lantern keeps for you or that you opened by its link: whether you
            watched it to the end, the places you chose on it, and the words of yours it could not
            plan around.
          </li>
        </ul>
      </Section>

      <Section heading="Why">
        <p>
          To write the day you ask for, to keep a free service from being overused, and to make the
          days better. Lantern relies on its legitimate interest in running the service for these;
          it uses nothing for advertising and sells nothing.
        </p>
      </Section>

      <Section heading="Who handles it">
        <dl className="flex flex-col gap-3">
          {RECIPIENTS.map((recipient) => (
            <div key={recipient.category}>
              <dt className="text-ink">{recipient.category}</dt>
              <dd>{recipient.does}</dd>
            </div>
          ))}
        </dl>
        <p>
          Some of them process data in the United States, relying on the EU&ndash;US Data Privacy
          Framework or the EU&apos;s standard contractual clauses.
        </p>
        <p>Write to {contact} for the list of them by name.</p>
      </Section>

      <Section heading="How long">
        <ul className="flex flex-col gap-3">
          <li>
            Your text: deleted once it is {VISITOR_TEXT_RETENTION_DAYS} days old. The clean-up runs
            when Lantern is next used, so a text can stay a little longer.
          </li>
          <li>
            A day&apos;s link: it opens the day for {DAY_LINK_DAYS} days from when it was written.
            Lantern keeps the request and the day longer, as above.
          </li>
          <li>
            A count of your requests: deleted once it is two days old, when Lantern is next used.
          </li>
          <li>
            Usage notes: the key that could tie a day&apos;s notes to your address is deleted the
            next day. The notes stay, with nothing that leads back to you.
          </li>
          <li>Page views: our host keeps them for a month.</li>
          <li>Everything else: until it is no longer needed, or you ask.</li>
          <li>Deleted data can stay in the database provider&apos;s backups for a short while.</li>
        </ul>
      </Section>

      <Section heading="Your rights">
        <p>
          You can ask for a copy of your text, or for it to be deleted, by writing to {contact}.
          Nothing in Lantern ties a text to you, so say roughly when you typed it and what it said.
          You can also complain to your local data protection authority.
        </p>
      </Section>

      <Section heading="Terms" id="terms">
        <ul className="flex flex-col gap-3">
          <li>Lantern is free to use and offered as it is, with no warranty.</li>
          <li>
            A model writes the days and can be wrong: a place may be closed, moved or not there at
            all, and hours and walking times may be off. Check what matters before you go.
          </li>
          <li>
            Lantern may change or stop at any time. It may also pause new days for a while; days
            already written stay open.
          </li>
        </ul>
      </Section>

      <Section heading="Contact">
        <p>Lantern is run by Mikalai Rudak. Questions about any of this: {contact}.</p>
      </Section>
    </>
  );
}

interface SectionProps {
  heading: string;
  id?: string;
  children: ReactNode;
}

/**
 * One part of the page: its heading above it on a phone, in the margin on a laptop, on the
 * first line's baseline, and its text in a column a line of which reads at a glance.
 */
function Section({ heading, id, children }: SectionProps) {
  return (
    <section
      id={id}
      className="mt-10 flex flex-col gap-2 lg:flex-row lg:items-baseline lg:gap-x-12"
    >
      <h2 className="type-voice text-dek text-balance text-ink lg:w-label lg:shrink-0 lg:text-body">
        {heading}
      </h2>
      <div className="flex max-w-measure flex-col gap-3 type-voice text-body text-pretty text-ink-soft">
        {children}
      </div>
    </section>
  );
}
