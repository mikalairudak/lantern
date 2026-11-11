"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the page draws the first impression (`src/lib/first-impression.ts`): read on the
 * server by the root layout and handed down, so a client component asks it here. Off where no
 * provider stands, as in a test or a bench that does not set it.
 */
const FirstImpressionContext = createContext(false);

export function FirstImpressionProvider({
  isOn,
  children,
}: {
  isOn: boolean;
  children: ReactNode;
}) {
  return <FirstImpressionContext value={isOn}>{children}</FirstImpressionContext>;
}

export function useFirstImpression(): boolean {
  return useContext(FirstImpressionContext);
}
