import { isDayId } from "@/lib/days/stored-day";
import { logToConsole } from "@/lib/live/provider-error";
import { storedDayOf } from "@/lib/live/stored-days";

const HTTP_NOT_FOUND = 404;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Opens a day kept in the log by the id its answer named (`X-Lantern-Day`): always a 200 with
 * the day's `status` (`src/lib/days/stored-day.ts`), and a 404 only for a string that cannot be
 * an id. No model, no limit: it reads the day's row, and for a re-plan the rows of the days it
 * was made from, for its kept places' checks. A database that fails is a 503 the page may ask
 * again on. Never cached, since a day still being written is `unknown` until its row lands.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/day/[id]">,
): Promise<Response> {
  const { id } = await context.params;
  if (!isDayId(id)) return new Response(null, { status: HTTP_NOT_FOUND });
  try {
    return Response.json(await storedDayOf(id), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    logToConsole("stored-day-unread", {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return new Response(null, { status: HTTP_SERVICE_UNAVAILABLE });
  }
}
