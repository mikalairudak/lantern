import type { Metadata } from "next";
import { SignCell, type SignPlace } from "./sign-of-work-matrix";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Concept · Sign of work");
}

const THEMES = ["light", "dark"] as const;

const PLACES: readonly { place: SignPlace; label: string }[] = [
  { place: "alone", label: "Alone, 24 px" },
  { place: "button", label: "In the start button's frame, 32 px" },
];

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

/**
 * The sign of work running, in both themes, alone and in the start button's frame. Its held
 * moments and its tally are its matrices' (`/lab/matrix/sign-of-work-loop`, `/lab/matrix/sign-of-work`).
 */
export default async function SignConceptPage() {
  await requireStudioLogin();
  return (
    <main className="mx-auto flex max-w-page flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-meta tracking-caps text-muted uppercase">Lab · Concept</p>
        <h1 className="type-voice text-display">The sign of work</h1>
        <p className="max-w-measure type-voice text-dek text-ink-soft">
          A paper lantern cut in one stroke of the pen, lit from its wick and put out, running.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {THEMES.map((theme) => (
          <section
            key={theme}
            data-theme={theme}
            data-testid={`sign-${theme}`}
            className="flex flex-col gap-6 rounded-sm border border-line bg-ground p-6 text-ink"
          >
            <h2 className="text-meta tracking-caps text-muted uppercase">
              {theme === "light" ? "By day" : "By night"}
            </h2>
            <ul className="flex flex-wrap items-end gap-10">
              {PLACES.map(({ place, label }) => (
                <li key={place} className="flex flex-col items-start gap-2">
                  <SignCell work={{ kind: "running" }} place={place} />
                  <span className="text-caption text-muted">{label}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
