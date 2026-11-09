import { expect, test } from "./fixtures";

test.use({ reducedMotion: "reduce" });

/** The stop row's matrix has every state of every example to read and draw. */
const MATRIX_TIMEOUT_MS = 20_000;

test("sets the stop row in every state at the schema's extremes", async ({ page }) => {
  await page.goto("/lab/matrix/stop-row");
  for (const state of [
    "placed in time",
    "its words streamed, waiting unseen for its light",
    "weighed, its words coming in with its bead",
    "open",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name: state, exact: true })).toBeVisible();
  }
  // An open stop says what its place is on a sheet grown from its words, and a press
  // elsewhere on the matrix's page leaves it open. The matrix reads 252 frames of real
  // streams before its open cells draw, which a full run's load can stretch past 5 s.
  const sheet = page.getByRole("region", { name: /^About / }).first();
  await expect(sheet).toBeVisible({ timeout: MATRIX_TIMEOUT_MS });
  await page.getByRole("heading", { level: 2, name: "open", exact: true }).click();
  await expect(sheet).toBeVisible();
});

test("holds every row at the density chosen", async ({ page }) => {
  await page.goto("/lab/matrix/stop-row");
  await page.getByRole("combobox", { name: "Rows" }).selectOption({ label: "data" });
  await page.getByRole("combobox", { name: "Columns" }).selectOption({ label: "density" });
  await page.getByRole("combobox", { name: "state" }).selectOption({ label: "complete" });

  // The calm beach opens with its texture only where its density is open. Each row also
  // sets its words unseen, as they will rest, to hold their room: only what shows counts.
  const texture = page.getByText("Small waves, a beach rake, gulls.").filter({ visible: true });
  await expect(texture.first()).toBeVisible();
  await expect(texture).toHaveCount(4);
});
