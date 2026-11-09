import type { Metadata } from "next";
import { requireStudioLogin } from "@/lib/http/studio-access";

/**
 * The studio is the owner's alone, behind a password (`src/proxy.ts`), and stays out of search
 * even for a crawler that reached it.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  await requireStudioLogin();
  return children;
}
