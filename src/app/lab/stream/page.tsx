import type { Metadata } from "next";
import { StreamScrubber } from "./stream-scrubber";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Stream scrubber");
}

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function StreamPage() {
  await requireStudioLogin();
  return (
    <main className="mx-auto flex max-w-page flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="type-voice text-display">Stream scrubber</h1>
        <p className="max-w-measure text-body text-ink-soft">
          A fixture day as the stream delivers it, one delta at a time. End it at any frame to read
          what the stream reader hands the UI, or play it through the app&apos;s stream hook at a
          model&apos;s pace.
        </p>
      </header>
      <StreamScrubber />
    </main>
  );
}
