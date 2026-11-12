import {
  DIRECTIONS_TO_THE_AREA,
  FOUND_BY_NAME,
  OPEN_IN_GOOGLE_MAPS,
  SEARCH_IN_GOOGLE_MAPS,
} from "../src/features/abacus/map-action";
import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/**
 * An open stop's "map" row on the written days a visitor opens: Bologna's places carry the
 * checks its run had, so one found by its name opens in Google Maps by its name and its
 * coffee leads to its area. A place never checked, as a day written by hand's, is searched
 * for and the sheet says nothing of the map: every day the site serves is checked, so the
 * place-check matrix's cell stands for it.
 */

const DAY_TIMEOUT_MS = waitMs(30_000);
/** Where every map link goes, which the tests answer themselves rather than ask Google. */
const GOOGLE_MAPS = "https://www.google.com/maps/**";

async function openStop(page: Page, address: string, name: string): Promise<Locator> {
  await page.goto(address);
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  const sheet = page.getByRole("region", { name: `About ${name}` });
  await expect(sheet).toBeFocused();
  return sheet;
}

/** What a map link asks the map for. */
async function askedOf(link: Locator): Promise<{ path: string; params: Record<string, string> }> {
  const url = new URL((await link.getAttribute("href")) ?? "");
  return { path: url.pathname, params: Object.fromEntries(url.searchParams) };
}

test("a place found by its name opens in Google Maps by its name, in a tab of its own", async ({
  page,
  context,
}) => {
  await context.route(GOOGLE_MAPS, (route) => route.fulfill({ body: "a map" }));
  const sheet = await openStop(page, "/day/bologna", "Basilica di San Petronio");

  const link = sheet.getByRole("link", { name: OPEN_IN_GOOGLE_MAPS });
  expect(await askedOf(link)).toEqual({
    path: "/maps/search/",
    params: { api: "1", query: "Basilica di San Petronio, Bologna" },
  });
  await expect(sheet).toContainText(FOUND_BY_NAME);

  const [tab] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  expect(tab.url()).toBe(await link.getAttribute("href"));
});

test("a place to eat or drink around leads to its area, to choose a place in", async ({ page }) => {
  const sheet = await openStop(page, "/day/bologna", "Coffee along Via Drapperie");

  const link = sheet.getByRole("link", { name: DIRECTIONS_TO_THE_AREA });
  const asked = await askedOf(link);
  expect(asked.path).toBe("/maps/dir/");
  expect(asked.params.destination).toMatch(/^44\.49\d*,11\.34\d*$/);
  await expect(sheet).toContainText("An area for coffee; choose a café when you arrive.");
  await expect(sheet).toContainText("Cafés found around it on OpenStreetMap.");
});

test("a place never checked is searched for by its name and city, and the sheet says nothing of the map", async ({
  page,
}) => {
  await page.goto("/lab/matrix/place-check");
  // Alicante's beach at its best light, its sheet open, never checked.
  const sheet = page
    .getByTestId("matrix-grid")
    .locator("section")
    .filter({
      has: page.getByRole("heading", { level: 2, name: "never checked, a day from its file" }),
    })
    .locator("figure")
    .filter({ has: page.locator("figcaption", { hasText: /^open$/ }) })
    .locator('[data-theme="light"]')
    .getByRole("region", { name: "About Playa del Postiguet" });

  const link = sheet.getByRole("link", { name: SEARCH_IN_GOOGLE_MAPS });
  expect(await askedOf(link)).toEqual({
    path: "/maps/search/",
    params: { api: "1", query: "Playa del Postiguet, Alicante" },
  });
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noreferrer");
  // The row holds the link alone: no line under it on how far the map knows the place.
  await expect(sheet.locator("dt", { hasText: /^map$/ }).locator("+ dd")).toHaveText(
    SEARCH_IN_GOOGLE_MAPS,
  );
});
