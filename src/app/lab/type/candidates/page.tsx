import type { Metadata } from "next";
import { CANDIDATES } from "../candidates";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Type · Candidates");
}

/** Place names with the marks the day needs, times, and the figures a glance confuses. */
const LATIN_PROBE = "Hōnen-in · Dársena · Xixona · 07:45 10:30 17:12 · 0O 1lI 7 3 8";
/** Russian, Ukrainian and Serbian letters, the ones a fallback face gives away first. */
const CYRILLIC_PROBE = "Эрмитаж · Ёлки · Щука · Їжак · Ґанок · Ђурђевак · Љубљана";
/** The day's own words in italic, as the wordmark and the waiting row set them. */
const ITALIC_PROBE = "Lantern · the old town before it wakes";

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function TypeCandidatesPage() {
  await requireStudioLogin();
  return (
    <main className="mx-auto flex max-w-page flex-col gap-8 px-4 py-12 md:px-10">
      <h1 className="type-voice text-title">Type candidates</h1>
      <ul className="flex flex-col border-t border-line">
        {CANDIDATES.map((each) => (
          <li
            key={each.name}
            data-candidate={each.name}
            className="flex flex-col gap-1 border-b border-line py-4"
          >
            <span className="text-small text-muted">
              {each.name}
              {each.isInUse ? " · today" : ""}
            </span>
            <span style={each.style} className="text-dek" data-probe>
              {LATIN_PROBE}
            </span>
            <span style={each.style} className="text-dek" data-probe-cyrillic>
              {CYRILLIC_PROBE}
            </span>
            <span style={each.style} className="text-dek italic" data-probe-italic>
              {ITALIC_PROBE}
            </span>
            <span style={each.style} className="text-body" aria-hidden>
              <span data-figures="proportional">1111</span>{" "}
              <span data-figures="proportional-zero">0000</span>{" "}
              <span data-figures="tabular" className="tabular-nums">
                1111
              </span>{" "}
              <span data-figures="tabular-zero" className="tabular-nums">
                0000
              </span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
