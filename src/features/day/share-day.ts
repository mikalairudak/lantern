/**
 * "Copy the link": the day's address, sent the way the device sends things. On a phone its share
 * sheet, elsewhere the clipboard; a refusal of either comes back as an outcome, never thrown.
 * What is sent is Lantern's own: the day's address, a written day's by its city
 * (`dayAddressOf`) or a kept day's by its id (`dayAddressOfId`), on this site's origin, and the
 * page's title; nothing the model wrote.
 */

/** How sending the link went. */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** The day's link: its address on the origin the page is served from. */
export function dayLinkOf(address: string, origin: string): string {
  return new URL(address, origin).href;
}

/** The parts of `navigator` sending uses, so a test or an old browser can stand in. */
export interface ShareChannel {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: Pick<Clipboard, "writeText">;
}

/** A phone, as its pointer and lack of hover tell, where a share sheet is the way to send. */
function isPhoneNow(): boolean {
  try {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  } catch {
    return false;
  }
}

function channelNow(): ShareChannel | null {
  return typeof navigator === "undefined" ? null : navigator;
}

/**
 * Sends the day's link: the share sheet on a phone, which a visitor may close without
 * sending ("cancelled"), and the clipboard elsewhere, or where the sheet failed.
 */
export async function shareDayLink(
  link: { url: string; title: string },
  {
    channel = channelNow(),
    isPhone = isPhoneNow(),
  }: { channel?: ShareChannel | null; isPhone?: boolean } = {},
): Promise<ShareOutcome> {
  if (channel === null) return "failed";
  if (isPhone && channel.share) {
    try {
      await channel.share({ title: link.title, url: link.url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      // A sheet that cannot open falls back to the clipboard.
    }
  }
  try {
    if (!channel.clipboard) return "failed";
    await channel.clipboard.writeText(link.url);
    return "copied";
  } catch {
    return "failed";
  }
}
