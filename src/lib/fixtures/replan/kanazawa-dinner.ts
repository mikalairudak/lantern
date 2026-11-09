import { GeneratedReplanSchema, type GeneratedReplan } from "@/lib/schema/replan.schema";
import recorded from "./kanazawa-dinner.json";

/**
 * A re-plan of the written Kanazawa day's dinner, "early dinner" changed to "eating late", as
 * the re-plan UX review composed it from the day's own evening (2026-11-05): no call wrote it.
 * Its window is the day's last two stops, oden at 17:30 and Kazue-machi at 19:15; the re-plan
 * writes three in their place, the samurai lanes at 17:00, the river at dusk and oden at 20:45.
 * The page's e2e answers the re-plan route with it on the written day's own page.
 */
export const KANAZAWA_LATE_DINNER: GeneratedReplan = GeneratedReplanSchema.parse(recorded);
