import type { MetadataRoute } from "next";
import { dayAddressOf, START_ADDRESS } from "@/lib/days/address";
import { PRIVACY_PATH } from "@/features/day/foot-line";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { siteUrlOf } from "@/lib/site";

/**
 * The pages Lantern wants found: the start screen, every day it has written at its own
 * address, and what it keeps. The start screen reaches the written days by script alone, so a
 * crawler that reads only the HTML finds them here. A visitor's day and the lab stay out.
 * No dates: a page's last change is not tracked, and a wrong date is worse than none.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const addresses = [START_ADDRESS, ...WRITTEN_REQUESTS.map(dayAddressOf), PRIVACY_PATH];
  return addresses.map((address) => ({ url: siteUrlOf(address) }));
}
