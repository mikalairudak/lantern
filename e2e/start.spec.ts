import { daySlugOf } from "../src/lib/days/slug";
import { INDEX_REQUESTS } from "../src/lib/days/written/city-days";
import { normalizedDayOf, WRITTEN_DAYS } from "../src/lib/days/written/days";
import { expect, test } from "./fixtures";

/** The start screen: the question and the index as two ways in, and no day until a press. */

/** Every place a written day can show, in every season, as its row names it. */
const WRITTEN_PLACE_NAMES = WRITTEN_DAYS.flatMap((written) =>
  normalizedDayOf(written).itinerary.stops.flatMap((stop) =>
    [stop.primary, ...stop.alternatives].map((place) => place.name),
  ),
);

/** A page's HTML as words: its text's entities and its data's string escapes read back. */
function wordsOf(html: string): string {
  return html
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll('\\"', '"');
}

test.use({ reducedMotion: "reduce" });

test("the start screen offers the question and an index of written days, and holds no stop of any day", async ({
  page,
}) => {
  await page.goto("/");
  const index = page.getByRole("list", { name: "No city in mind? Start from one of these" });
  await expect(index.getByRole("listitem")).toHaveCount(INDEX_REQUESTS.length);

  // Both ways in on a phone's first screen: the field and two lines of the index.
  const second = await index.getByRole("listitem").nth(1).boundingBox();
  if ((page.viewportSize()?.width ?? 0) < 500) expect(second!.y + second!.height).toBeLessThan(664);

  // No day is drawn until a press: the page, its data included, names none of a day's places.
  const words = wordsOf(await (await page.request.get("/")).text());
  expect(WRITTEN_PLACE_NAMES.filter((name) => words.includes(name))).toEqual([]);

  // A line of the index opens its day where the question was.
  await index.getByRole("button").first().click();
  await expect(page).toHaveURL(/\/day\//);
});

test("a cell pointed at is lit whole, for a pointer and the keyboard alike, and its city ruled where a pointer can hover", async ({
  page,
}) => {
  await page.goto("/");
  const index = page.getByRole("list", { name: "No city in mind? Start from one of these" });
  const cells = index.getByRole("button");
  const lights = () =>
    index.evaluate((list) =>
      [...list.querySelectorAll("svg[data-picture]")].map((svg) => svg.getAttribute("data-light")),
    );
  const ruled = () =>
    index.evaluate((list) =>
      [...list.querySelectorAll("button")].map(
        (cell) =>
          getComputedStyle(cell.querySelector("span > span:first-child")!).textDecorationLine,
      ),
    );
  const litAt = (at: number | null) =>
    INDEX_REQUESTS.map((_, cell) => (cell === at ? "lit" : "rest"));
  // Every plate rests, its lamps low; the one pointed at is lit whole.
  await expect.poll(lights).toEqual(litAt(null));
  const canHover = await page.evaluate(() => window.matchMedia("(hover: hover)").matches);

  await cells.nth(1).hover();
  await expect.poll(lights).toEqual(litAt(1));
  expect((await ruled())[1]).toBe(canHover ? "underline" : "none");

  // The keyboard shows the same, wherever the pointer is.
  await page.mouse.move(0, 0);
  await expect.poll(lights).toEqual(litAt(null));
  await cells.nth(1).focus();
  await page.keyboard.press("Tab");
  await expect(cells.nth(2)).toBeFocused();
  await expect.poll(lights).toEqual(litAt(2));
  expect((await ruled())[2]).toBe("underline");
});

test("a city's cell draws its plate from three files in either theme, its scene and its two bounds, kept forever", async ({
  page,
}) => {
  const asked: { url: string; status: number; cache: string | null }[] = [];
  page.on("response", (response) => {
    if (!response.url().includes("/pictures/")) return;
    asked.push({
      url: response.url(),
      status: response.status(),
      cache: response.headers()["cache-control"] ?? null,
    });
  });
  await page.goto("/");
  const madrid = page.getByRole("button", { name: /^Madrid/ });
  await madrid.scrollIntoViewIfNeeded();
  // The picture is out of what is read: the cell is named by its city and its day.
  await expect(madrid).toHaveAccessibleName(/^Madrid Lively Sunday/);
  await expect(madrid.locator('rect[data-layer="scene"]')).toHaveAttribute("data-state", "drawn");
  // Every city the index offers is drawn: three files a cell, each kept forever.
  await expect.poll(() => asked.length).toBe(3 * INDEX_REQUESTS.length);
  const kinds = asked.map(({ url }) =>
    /\/pictures\/([a-z-]+)-(scene-\d+|footprint|sheet)\.[0-9a-f]{8}\.avif$/
      .exec(url)
      ?.slice(1, 3)
      .map((part) => part.replace(/-\d+$/, ""))
      .join(" "),
  );
  expect(new Set(kinds)).toEqual(
    new Set(
      INDEX_REQUESTS.flatMap((request) =>
        ["scene", "footprint", "sheet"].map((kind) => `${daySlugOf(request)} ${kind}`),
      ),
    ),
  );
  for (const each of asked) {
    expect(each).toMatchObject({ status: 200, cache: "public, max-age=31536000, immutable" });
  }
});
