import type { FullConfig } from "@playwright/test";
import { BASE_URL } from "./servers";
import { E2E_STUDIO_AUTHORIZATION } from "./studio-login";

/**
 * One address for each route the specs open, so `next dev` compiles them all before the first
 * test, not inside it: on CI's runner a first compile took a test's own wait. A route with a
 * parameter compiles once for every value.
 */
const PAGES = [
  "/",
  "/day/kanazawa",
  "/privacy",
  "/studio",
  "/lab",
  "/lab/matrix/stop-row",
  "/lab/stream",
  "/lab/tokens",
  "/lab/concepts/abacus/edge/crowded",
  "/lab/concepts/day",
  "/lab/concepts/start",
  "/lab/concepts/replan",
  "/lab/concepts/invitation/light",
];
/** An API route compiles on any method, so a GET it refuses still warms it, and posts nothing. */
const API_ROUTES = ["/api/day", "/api/day/warm-up", "/api/intake", "/api/replan", "/api/events"];

const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;
const MS_PER_SECOND = 1000;

/**
 * Asks the e2e server for every route once, one after another, and says how long it took. Not
 * together: pages that `next dev` compiles at the same moment from a cold start sometimes
 * answer 500, one reading a manifest another is still writing (a JSON SyntaxError in its log),
 * in one of three cold runs on the laptop. A page that does not answer 200, or a route that
 * fails, stops the run here: the list is stale, or the server is broken, and every test would
 * say so later and less plainly.
 */
export default async function warmUp(_config: FullConfig): Promise<void> {
  const started = performance.now();
  const answers: { route: string; status: number }[] = [];
  for (const route of [...PAGES, ...API_ROUTES]) {
    const response = await fetch(new URL(route, BASE_URL), {
      headers: { Authorization: E2E_STUDIO_AUTHORIZATION },
    });
    // Read to its end: a page compiles and renders as its body is sent.
    await response.arrayBuffer();
    answers.push({ route, status: response.status });
  }
  const faults = answers.filter(({ route, status }) =>
    PAGES.includes(route) ? status !== HTTP_OK : status >= HTTP_SERVER_ERROR,
  );
  if (faults.length > 0) {
    const list = faults.map(({ route, status }) => `${route} ${status}`).join(", ");
    throw new Error(`Warming the e2e server, these answered wrong: ${list}`);
  }
  const seconds = ((performance.now() - started) / MS_PER_SECOND).toFixed(1);
  process.stdout.write(`Warmed ${answers.length} routes of the e2e server in ${seconds} s\n`);
}
