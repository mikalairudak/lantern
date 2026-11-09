import type { Metadata } from "next";
import { requireStudioLogin } from "@/lib/http/studio-access";

/**
 * The lab is the studio's, behind the owner's password (`src/proxy.ts`), and stays out of search:
 * its pages are benches with no line of their own, and a search for Lantern should find the product
 * first.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function LabLayout({ children }: LayoutProps<"/lab">) {
  await requireStudioLogin();
  return children;
}
