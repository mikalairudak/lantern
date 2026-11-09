import type { Metadata } from "next";
import Link from "next/link";
import { MATRICES } from "@/app/lab/matrix/matrices";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";
import { UncountedBrowser } from "./uncounted-browser";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Studio");
}

/**
 * The case study lives in the repository, so the studio links to it on GitHub rather than
 * keeping a copy that would drift.
 */
const CASE_STUDY = "https://github.com/mikalairudak/lantern/blob/main/docs/case-study.md";

/** What the studio holds: the case study, then the lab's pages. */
const PAGES = [
  { href: CASE_STUDY, title: "Case study", note: "How Lantern was made, and why" },
  ...MATRICES.map(({ key, title }) => ({
    href: `/lab/matrix/${key}`,
    title: `Matrix · ${title}`,
    note: "A component in every state, in both themes",
  })),
  { href: "/lab/stream", title: "Stream scrubber", note: "A day one delta at a time, any ending" },
  { href: "/lab/concepts/day", title: "Composition · Day", note: "The day, played to any ending" },
  { href: "/lab", title: "The whole lab", note: "Tokens, type, concepts and edge days" },
];

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function StudioPage() {
  await requireStudioLogin();
  return (
    <main className="mx-auto flex max-w-page flex-col gap-10 px-6 py-16">
      <h1 className="type-voice text-display">Studio</h1>
      <ul className="flex flex-col border-t border-line">
        {PAGES.map(({ href, title, note }) => {
          const linkClasses = "flex flex-col gap-1 py-5 transition-colors hover:text-swap";
          const words = (
            <>
              <span className="type-voice text-heading">{title}</span>
              <span className="text-small text-muted">{note}</span>
            </>
          );
          return (
            <li key={href} className="border-b border-line">
              {href.startsWith("/") ? (
                <Link href={href} className={linkClasses}>
                  {words}
                </Link>
              ) : (
                <a href={href} className={linkClasses}>
                  {words}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <UncountedBrowser />
    </main>
  );
}
