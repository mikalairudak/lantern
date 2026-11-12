import { expect, test, type Page } from "./fixtures";

/** The choice the theme's button shows: the one of its three icons a reader can see. */
async function shownIconOf(page: Page): Promise<string[]> {
  return page
    .getByRole("button", { name: /^Theme: / })
    .locator("[data-theme-icon]")
    .evaluateAll((icons) =>
      icons
        .filter((icon) => getComputedStyle(icon).display !== "none")
        .map((icon) => icon.getAttribute("data-theme-icon") ?? ""),
    );
}

/** A theme kept from an earlier visit, in place before the page's first script runs. */
async function keepTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((kept) => localStorage.setItem("lantern-theme", kept), theme);
}

test("the server's page holds every choice's icon, for the head script to pick one", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  for (const choice of ["system", "light", "dark"]) {
    expect(html).toContain(`data-theme-icon="${choice}"`);
  }
  expect(html).toContain('aria-label="Theme: System"');
});

test("shows a kept theme's icon from the first frame, before the page is live", async ({
  page,
}) => {
  await keepTheme(page, "dark");
  // Without its scripts the page is the server's HTML and the head script alone: what the
  // first frame shows, before React hydrates.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.dataset.themeChoice)).toBe("dark");
  expect(await shownIconOf(page)).toEqual(["dark"]);
});

test("shows the system's icon on a dark device, the choice rather than the theme it resolves to", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await shownIconOf(page)).toEqual(["system"]);
  await expect(page.getByRole("button", { name: "Theme: System" })).toBeVisible();
});

test("a theme chosen changes the icon and its name at once, and on the next visit", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Theme: System" }).click();
  await page.getByRole("option", { name: "Dark" }).click();

  await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeFocused();
  expect(await shownIconOf(page)).toEqual(["dark"]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
  expect(await shownIconOf(page)).toEqual(["dark"]);
});

test("names the setting and the choice under the keyboard's focus, and moves nothing", async ({
  page,
}) => {
  await keepTheme(page, "light");
  await page.goto("/");
  const icon = page.getByRole("button", { name: "Theme: Light" });
  const hint = page.locator("[data-theme-hint]");
  const header = page.locator("header").first();
  await expect(hint).toBeHidden();
  // The header holds the index, drawn once the visitor's days are read.
  await expect(
    page.getByRole("list", { name: "No city in mind? Start from one of these" }),
  ).toBeVisible();
  const before = await header.boundingBox();

  // On the start screen the wordmark is only the name, so the icon is the keyboard's first stop.
  await page.keyboard.press("Tab");

  await expect(icon).toBeFocused();
  await expect(hint).toBeVisible();
  // Only the choice's own name shows, as only its icon does.
  expect(await hint.evaluate((element) => (element as HTMLElement).innerText)).toBe(
    "Theme · Light",
  );
  expect(await header.boundingBox()).toEqual(before);
  // Gone while its list hangs where it would be.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "Theme" })).toBeFocused();
  await expect(hint).toBeHidden();
});

// A city with no day is answered by Lantern's page for no day, which React can draw in the
// browser, where the head script it writes never runs: on the first visit, and on the next.
for (const visit of ["first", "next"]) {
  test(`the page for a day Lantern has not written takes a kept theme on the ${visit} visit`, async ({
    page,
  }) => {
    await keepTheme(page, "dark");
    await page.emulateMedia({ colorScheme: "light" });
    if (visit === "next") await page.goto("/day/porto-nowhere");
    await page.goto("/day/porto-nowhere");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveAttribute("data-theme-choice", "dark");
    await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
    expect(await shownIconOf(page)).toEqual(["dark"]);
  });
}
