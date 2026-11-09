import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, request as requests, test, type APIRequestContext } from "./fixtures";
import { E2E_STUDIO_LOGIN } from "./studio-login";

// The studio and the lab are the owner's alone: every path of theirs asks for the password, and no
// page of the public site leads to one (`docs/security.md`, S14).

const APP = join(__dirname, "..", "src", "app");
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const UNKNOWN_DAY_ID = "00000000-0000-4000-8000-000000000000";

/** Every page's route under a directory of the app, as its folders name it: `/lab/[matrix]`. */
function routesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return routesUnder(path);
    if (name !== "page.tsx") return [];
    const route = relative(APP, directory).split(sep).join("/");
    return [`/${route}`];
  });
}

const ROUTES = [...routesUnder(join(APP, "studio")), ...routesUnder(join(APP, "lab"))];

/** A route's folders as a pattern of the paths it serves: `[matrix]` stands for any segment. */
function patternOf(route: string): RegExp {
  const segments = route
    .split("/")
    .map((segment) =>
      /^\[[^\]]+\]$/.test(segment) ? "[^/]+" : segment.replace(/[.*+?^${}()|\\]/g, "\\$&"),
    );
  return new RegExp(`^${segments.join("/")}$`);
}

/** Basic authentication for a user and a password, as a browser sends it. */
function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

const RIGHT = basic(E2E_STUDIO_LOGIN.username, E2E_STUDIO_LOGIN.password);
// The password opens the studio under any user name, an empty one included.
const RIGHT_UNDER_ANY_USER = [
  basic("someone else", E2E_STUDIO_LOGIN.password),
  basic("", E2E_STUDIO_LOGIN.password),
];
const WRONG = [
  basic(E2E_STUDIO_LOGIN.username, `${E2E_STUDIO_LOGIN.password}x`),
  basic(E2E_STUDIO_LOGIN.username, ""),
  basic(E2E_STUDIO_LOGIN.password, ""),
  `Bearer ${E2E_STUDIO_LOGIN.password}`,
  "Basic not-base64!",
];

/** A client that gives no password unless a request carries one. */
async function withoutLogin(baseURL: string | undefined): Promise<APIRequestContext> {
  return requests.newContext({ baseURL, extraHTTPHeaders: {} });
}

/** The studio's paths a page leads to, by its links and the frames it loads. */
function studioLinksIn(html: string): string[] {
  return [...html.matchAll(/(?:href|src)="(\/(?:lab|studio)[^"#?]*)"/g)].map(
    ([, path]) => path ?? "",
  );
}

/** Asks for a path as a browser without the password would, wrongly, and with it. */
async function expectLocked(client: APIRequestContext, path: string): Promise<string> {
  const asked = await client.get(path, { maxRedirects: 0 });
  expect(asked.status(), `${path} without the password`).toBe(HTTP_UNAUTHORIZED);
  expect(asked.headers()["www-authenticate"]).toBe('Basic realm="Lantern studio", charset="UTF-8"');
  expect(asked.headers()["cache-control"]).toBe("private, no-store");
  expect(asked.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(await asked.text()).toContain("This part of Lantern is private.");

  for (const authorization of WRONG) {
    const refused = await client.get(path, { headers: { Authorization: authorization } });
    expect(refused.status(), `${path} with ${authorization}`).toBe(HTTP_UNAUTHORIZED);
  }

  for (const authorization of RIGHT_UNDER_ANY_USER) {
    const opened = await client.get(path, { headers: { Authorization: authorization } });
    expect(opened.status(), `${path} with ${authorization}`).toBe(HTTP_OK);
  }
  const opened = await client.get(path, { headers: { Authorization: RIGHT } });
  expect(opened.status(), `${path} with the password`).toBe(HTTP_OK);
  expect(opened.headers()["cache-control"]).toContain("no-store");
  expect(opened.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  return opened.text();
}

test("every page of the studio and the lab asks for the password, and opens with it", async ({
  baseURL,
}) => {
  test.setTimeout(240_000);
  const client = await withoutLogin(baseURL);
  const fixed = ROUTES.filter((route) => !route.includes("["));
  expect(fixed).toEqual(expect.arrayContaining(["/studio", "/lab", "/lab/stream"]));

  // Each page by its own route, and each route with a segment of its own by a path a page
  // of the studio leads to.
  const linked = new Set<string>();
  for (const path of fixed) {
    for (const link of studioLinksIn(await expectLocked(client, path))) linked.add(link);
  }
  for (const route of ROUTES.filter((each) => each.includes("["))) {
    const path = [...linked].find((link) => patternOf(route).test(link));
    expect(path, `a page of the studio leads to ${route}`).toBeDefined();
    await expectLocked(client, path ?? route);
  }
  await client.dispose();
});

test("a page's payload for the router asks for the password too", async ({ baseURL }) => {
  const client = await withoutLogin(baseURL);
  const router: Record<string, string>[] = [
    { RSC: "1" },
    { RSC: "1", "Next-Router-Prefetch": "1" },
    { RSC: "1", "Next-Router-Prefetch": "1", "Next-Router-Segment-Prefetch": "/_tree" },
  ];
  for (const path of ["/studio", "/lab", "/lab/stream"]) {
    for (const headers of router) {
      const asked = await client.get(`${path}?_rsc=e2e`, { headers });
      expect(asked.status(), `${path} as ${JSON.stringify(headers)}`).toBe(HTTP_UNAUTHORIZED);
    }
  }
  await client.dispose();
});

test("no page of the public site leads to the studio or the lab", async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const client = await withoutLogin(baseURL);
  for (const address of [
    "/",
    "/day/kanazawa",
    `/day/${UNKNOWN_DAY_ID}`,
    "/privacy",
    "/no-such-page",
  ]) {
    // In the HTML as served, and among the links the page draws once its script runs.
    const html = await (await client.get(address)).text();
    expect(html, address).not.toMatch(/href="\/(?:lab|studio)(?:[/"?#])/);

    // Once the page has loaded its script and drawn its main part: a day's page streams on,
    // so the network never falls idle.
    await page.goto(address);
    await expect(page.locator("main").first()).toBeAttached();
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((links) =>
        links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
      );
    expect(
      hrefs.filter((path) => /^\/(?:lab|studio)(?:$|[/.])/.test(path)),
      address,
    ).toEqual([]);
  }
  await client.dispose();
});
