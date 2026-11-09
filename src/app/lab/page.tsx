import type { Metadata } from "next";
import Link from "next/link";
import { EDGE_FRAMES } from "./concepts/abacus/edge-frames";
import { MATRICES } from "./matrix/matrices";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Lab");
}

const PAGES = [
  { href: "/lab/tokens", title: "Tokens", note: "Color, type, spacing, shape, motion" },
  {
    href: "/lab/type/candidates",
    title: "Type candidates",
    note: "The faces measured for the type, in Latin, Cyrillic and italic",
  },
  {
    href: "/lab/stream",
    title: "Stream scrubber",
    note: "A fixture day one delta at a time, ended any way the outcome protocol knows",
  },
  ...MATRICES.map(({ key, title, note }) => ({ href: `/lab/matrix/${key}`, title, note })),
  {
    href: "/lab/concepts/abacus",
    title: "Concept · Abacus",
    note: "The day as a chart of its candidates, picked by an energy curve you drag",
  },
  {
    href: "/lab/concepts/day",
    title: "Composition · Day",
    note: "The product's day, header over chart, played to any ending",
  },
  {
    href: "/lab/concepts/start",
    title: "Concept · Start",
    note: "The start screen: one question over a day Lantern has already written, its named pick",
  },
  {
    href: "/lab/concepts/invitation",
    title: "Concept · Invitation",
    note: "The ring and the example that invite the first drag on Lisbon, never changing the day",
  },
  ...EDGE_FRAMES.map(({ key, day }) => ({
    href: `/lab/concepts/abacus/edge/${key}`,
    title: `Abacus · ${key.replace("-", " ")}`,
    note: `Edge day: ${day.edge}`,
  })),
];

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function LabPage() {
  await requireStudioLogin();
  return (
    <main className="mx-auto flex max-w-page flex-col gap-10 px-6 py-16">
      <h1 className="type-voice text-display">Lab</h1>
      <ul className="flex flex-col border-t border-line">
        {PAGES.map(({ href, title, note }) => (
          <li key={href} className="border-b border-line">
            <Link
              href={href}
              className="flex flex-col gap-1 py-5 transition-colors hover:text-swap"
            >
              <span className="type-voice text-heading">{title}</span>
              <span className="text-small text-muted">{note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
