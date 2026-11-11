import { INDEX_REQUESTS } from "../../src/lib/days/written/city-days";
import { expect, test } from "../fixtures";

/**
 * The start screen under the first impression (`src/lib/first-impression.ts`), against its own
 * server with the flag on: the question and the index as two ways in, and a written day's first
 * stops, still, under them.
 */

test.use({ reducedMotion: "reduce" });

test("the start screen offers the question and an index of written days, with a day still under them", async ({
  page,
}) => {
  await page.goto("/");
  const index = page.getByRole("list", { name: "No city in mind? Start from one of these" });
  await expect(index.getByRole("listitem")).toHaveCount(INDEX_REQUESTS.length);

  // Both ways in on a phone's first screen: the field and two lines of the index.
  const second = await index.getByRole("listitem").nth(1).boundingBox();
  if ((page.viewportSize()?.width ?? 0) < 500) expect(second!.y + second!.height).toBeLessThan(664);

  const excerpt = page.getByRole("region", { name: "What a day looks like" });
  // The day's first three stops, each named, in its list.
  await expect(excerpt.getByRole("list").getByRole("heading")).toHaveCount(3);
  const whole = excerpt.getByRole("link", { name: /^The whole day, \d+ stops$/ });
  await expect(whole).toHaveAttribute("href", /^\/day\//);

  // A line of the index opens its day where the question was.
  await index.getByRole("button").first().click();
  await expect(page).toHaveURL(/\/day\//);
});

test("a city's cell draws its engraving from one file, its theme's, kept forever", async ({
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
  await expect(madrid).toHaveAccessibleName(/^Madrid Lively Saturday/);
  await expect(madrid.locator('rect[data-layer="scene"]')).toHaveAttribute("data-state", "drawn");
  await expect(madrid.locator('rect[data-layer="subject"]')).toHaveAttribute(
    "data-state",
    "unasked",
  );
  expect(asked).toHaveLength(1);
  expect(asked[0]).toMatchObject({ status: 200, cache: "public, max-age=31536000, immutable" });
  expect(asked[0]!.url).toMatch(/\/pictures\/madrid-scene-\d+\.[0-9a-f]{8}\.avif$/);
});
