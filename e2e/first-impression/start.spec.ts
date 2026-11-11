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
