"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";

const THEMES = ["light", "dark"] as const;

const FRAME_CLASSES = "w-phone h-phone-height shrink-0 rounded-sm border border-line bg-ground";
const LINK_CLASSES = "rounded-sm underline decoration-1 underline-offset-4 focus-ring";

/**
 * How the chart invites its first drag, never changing the day by itself (2026-10-30), on
 * Bologna at a phone's width in both themes; each opens at full width too.
 */
export function InvitationConcept() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col gap-8 px-4 py-6 md:px-10">
      <header className="flex max-w-measure flex-col gap-2">
        <h1 className="type-voice text-title text-ink">Inviting the first drag</h1>
        <p className="type-note text-muted">
          Bologna, written from its request. Once the day can be dragged, a ring with arrows waits
          at a stop in view, and a dashed curve draws the version a pull there would pick, its bead
          ringed. Under a pointer that moves over the chart, the dashed curve is the day a pull to
          it would give; the headline says only the day. Nothing changes until the curve is dragged
          or a bead tapped, and all of it goes with the first touch. A phone has no pointer to
          hover, so it shows the example.
        </p>
        <p className="flex gap-4 type-note text-ink">
          {THEMES.map((theme) => (
            <a
              key={theme}
              href={`/lab/concepts/invitation/${theme}`}
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASSES}
            >
              Full width, {theme}
            </a>
          ))}
          <button
            type="button"
            onClick={() => setRun((current) => current + 1)}
            className={cn(LINK_CLASSES, "type-note text-ink")}
          >
            Write the days again
          </button>
        </p>
      </header>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {THEMES.map((theme) => (
          <iframe
            key={`${theme}-${run}`}
            title={`Bologna, ${theme}`}
            src={`/lab/concepts/invitation/${theme}`}
            className={FRAME_CLASSES}
          />
        ))}
      </div>
    </div>
  );
}
