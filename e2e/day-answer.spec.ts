import { expect, test, waitMs } from "./fixtures";

/**
 * The day's end answer: asked under the finished day, answered in one tap, thanked in place.
 */

const DAY_TIMEOUT_MS = waitMs(30_000);

test.use({ reducedMotion: "reduce" });

test("a finished day asks one question, answered in one tap and thanked in place", async ({
  page,
}) => {
  const sent: unknown[] = [];
  await page.route("**/api/events", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "null"));
    await route.fulfill({ status: 204 });
  });
  await page.goto("/day/kanazawa");
  const question = page.getByText("Would you follow this day?");
  await expect(question).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  const line = question.locator("xpath=../..");
  const before = await line.boundingBox();

  await page.getByRole("button", { name: "Not quite" }).click();
  await expect(page.getByText("Thank you.")).toBeVisible();
  // The thanks stands in the question's room: the line keeps its height.
  const after = await line.boundingBox();
  expect(after?.height).toBe(before?.height);
  await expect
    .poll(() => sent.some((event) => (event as { kind?: string })?.kind === "day-answered"))
    .toBe(true);
});
