import { connection } from "next/server";
import { isLiveGeneration } from "./flag";

/**
 * Whether live generation is on, for a page that hands the client the answer. Read once a
 * visitor's request has arrived, never while the page is prerendered: under Cache Components
 * a value read during the build would stay in the static shell, so turning the flag on
 * would need a new build, and turning it off would leave the client asking routes that
 * answer only the written days. Only the boolean reaches the client.
 */
export async function isLiveNow(): Promise<boolean> {
  await connection();
  return isLiveGeneration(process.env);
}
