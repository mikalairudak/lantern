import type { ReactElement, ReactNode } from "react";
import { AddressHeadline } from "./address-headline";
import { FootLine } from "./foot-line";
import { Masthead } from "./masthead";

interface AddressPageProps {
  /** What the page says in place of what was asked for, as its one heading. */
  headline: string;
  /** The ways on, under the headline. */
  children: ReactNode;
  /**
   * The page takes the place of a page the visitor pressed on, as the page for a failure does:
   * its headline takes the focus the press had (`AddressHeadline`).
   */
  isFocusedAfterPress?: boolean;
}

/**
 * A page of Lantern's own with no day on it: its wordmark and a headline set where the start
 * screen sets them, what follows, and the page's last line at the foot of the screen. The page
 * for no day, for a day still being written and for a page that failed share it.
 */
export function AddressPage({
  headline,
  children,
  isFocusedAfterPress = false,
}: AddressPageProps): ReactElement {
  return (
    // At least a screen tall, so its last line stands at the foot of the screen.
    <div className="mx-auto flex min-h-svh max-w-page flex-col px-4 md:px-10 lg:px-16">
      <main className="flex grow flex-col">
        {/* Set as the start screen's header sets it, so the wordmark sits where it does there. */}
        <header className="flex shrink-0 flex-col pt-5 pb-5">
          <Masthead />
          <AddressHeadline headline={headline} isFocusedAfterPress={isFocusedAfterPress} />
        </header>
        {children}
      </main>
      {/* Outside the main, so it is the page's contentinfo. */}
      <FootLine className="mt-12 pb-8" />
    </div>
  );
}
