import { dayAddressOf } from "../src/lib/days/address";
import { STILL_WRITING_TITLE } from "../src/features/day/no-day-here";
import { writtenDayAt } from "../src/lib/days/written/days";
import { icoSidesOf } from "../src/lib/brand/ico";
import { WRITTEN_REQUESTS } from "../src/lib/days/written/requests";
import { SITE_AUTHOR, SITE_CARD, SITE_DESCRIPTION, SITE_NAME, siteUrlOf } from "../src/lib/site";
import { expect, test, type Page } from "./fixtures";

/**
 * Each page is read as a link preview reads it: LinkedIn's crawler, with no script run, so
 * what is checked is the HTML's head as served, and no day plays.
 */
test.use({
  userAgent:
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  javaScriptEnabled: false,
});

const KANAZAWA = writtenDayAt("kanazawa");
/** Where every page's card is, as a crawler is given it. */
const CARD_URL = siteUrlOf(SITE_CARD.url);
/** A PNG's width follows its 8-byte signature and the header chunk's length and type. */
const PNG_WIDTH_AT = 16;
/** An id no visitor's day has, which the page answers as a day still being written. */
const UNKNOWN_DAY_ID = "00000000-0000-4000-8000-000000000000";

/** The pages Lantern wants found, and what each one's preview says. */
const LISTED = [
  { address: "/", title: SITE_NAME, description: SITE_DESCRIPTION },
  {
    address: "/day/kanazawa",
    title: "A calm Saturday in Kanazawa, early start",
    description: KANAZAWA?.itinerary.dek ?? "",
  },
  {
    address: "/privacy",
    title: "Privacy and terms",
    description:
      "What Lantern keeps, why, who handles it, for how long, your rights, and its short terms.",
  },
];

function headMeta(page: Page, property: string) {
  return page.locator(`head meta[property="${property}"]`);
}

test("robots.txt lets every crawler read the pages and a written day's stream, keeps off the rest of the API and the studio, and names the sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const lines = (await response.text()).split("\n").map((line) => line.trim());

  expect(lines).toEqual(
    expect.arrayContaining(["User-Agent: *", "Allow: /", `Sitemap: ${siteUrlOf("/sitemap.xml")}`]),
  );
  // A renderer the crawler list misses plays a written day through /api/day, and a visitor's
  // day says noindex on its page, which a crawler barred from it would never read.
  // The studio and the lab answer a crawler with a 401 alone.
  expect(lines.filter((line) => line.startsWith("Disallow:"))).toEqual([
    "Disallow: /api/events",
    "Disallow: /api/intake",
    "Disallow: /api/replan",
    "Disallow: /studio",
    "Disallow: /lab",
  ]);
});

test("the sitemap lists the start screen, every written day and the privacy page, and no other", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const listed = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, url]) => url,
  );

  const addresses = ["/", ...WRITTEN_REQUESTS.map(dayAddressOf), "/privacy"];
  expect(listed).toEqual(addresses.map(siteUrlOf));
});

for (const { address, title, description } of LISTED) {
  test(`${address} names its own address and previews as itself`, async ({ page }) => {
    await page.goto(address);
    const url = siteUrlOf(address).replace(/\/$/, "");

    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`^${url}/?$`),
    );
    await expect(headMeta(page, "og:url")).toHaveAttribute("content", new RegExp(`^${url}/?$`));
    await expect(headMeta(page, "og:title")).toHaveAttribute("content", title);
    await expect(headMeta(page, "og:description")).toHaveAttribute("content", description);
    await expect(headMeta(page, "og:site_name")).toHaveAttribute("content", SITE_NAME);
    await expect(headMeta(page, "og:image")).toHaveAttribute("content", CARD_URL);
    await expect(page.locator('head meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('head meta[name="author"]')).toHaveAttribute("content", SITE_AUTHOR);
  });
}

test("a written day's page says its own sunrise and sunset in its HTML, never a placeholder", async ({
  request,
}) => {
  // What a reader without the page's script or styles sees: the header held its room with
  // "00:00" until the stream had placed the first stop.
  for (const written of WRITTEN_REQUESTS) {
    const html = await (await request.get(dayAddressOf(written))).text();
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    expect(text, dayAddressOf(written)).toMatch(/sunrise (?!00:00)\d\d:\d\d/);
    expect(text, dayAddressOf(written)).not.toMatch(/(sunrise|sunset) 00:00/);
  }
});

test("the card is one image, 1200 by 630, drawn at build time", async ({ request }) => {
  const response = await request.get(SITE_CARD.url);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  // A PNG's header gives its width and height as the first two numbers after its signature.
  const png = await response.body();
  expect([png.readUInt32BE(PNG_WIDTH_AT), png.readUInt32BE(PNG_WIDTH_AT + 4)]).toEqual([
    SITE_CARD.width,
    SITE_CARD.height,
  ]);
});

test("/favicon.ico is the mark at 16, 32 and 48 px, for whatever asks for it by name", async ({
  request,
}) => {
  const response = await request.get("/favicon.ico");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/x-icon");
  expect(icoSidesOf(await response.body())).toEqual([16, 32, 48]);
});

test("a tab takes the SVG in the visitor's theme, the ICO named by its sizes beside it", async ({
  page,
}) => {
  await page.goto("/");

  // An ICO said to be "any" size is the one Chrome picks over an SVG; one of 48 px is not.
  await expect(page.locator('head link[rel="icon"][href^="/favicon.ico"]')).toHaveAttribute(
    "sizes",
    "48x48",
  );
  await expect(page.locator('head link[rel="icon"][href^="/icon.svg"]')).toHaveAttribute(
    "sizes",
    "any",
  );
});

test("the studio and the lab open with the owner's password, kept out of search", async ({
  page,
}) => {
  for (const address of ["/studio", "/lab", "/lab/tokens"]) {
    await page.goto(address);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  }
});

test("a visitor's day previews where it is sent, with no address to be found at", async ({
  page,
}) => {
  await page.goto(`/day/${UNKNOWN_DAY_ID}`);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    STILL_WRITING_TITLE,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", CARD_URL);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});
