import { expect, test, type Page, waitMs } from "./fixtures";
import type { StoredDay } from "../src/lib/days/stored-day";
import { KYOTO_REQUEST } from "../src/lib/fixtures/curated/requests";
import { KYOTO_ITINERARY } from "../src/lib/fixtures/replan/kyoto-morning";

// The view a visitor chose holds on this device wherever a day is shown (`docs/decisions.md`,
// "A day can be read as a list, written as the chart is"): after a reload, on another city's
// day, on a re-planned day and on a kept day's page.

const DAY_TIMEOUT_MS = waitMs(30_000);
const ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
/** A visitor's Kyoto day, kept in the log: no day the site has written. */
const WRITTEN: StoredDay = {
  status: "written",
  request: KYOTO_REQUEST,
  itinerary: KYOTO_ITINERARY,
  checks: {},
  writtenAt: "2026-10-31T20:00:00.000Z",
  seconds: 46,
  round: 0,
};

test.use({ reducedMotion: "reduce" });

type View = "Chart" | "Read";

/** What shows the day in a view: the chart, or the list to read; the styles show one. */
function viewOf(page: Page, view: View) {
  return view === "Read"
    ? page.getByRole("list", { name: "The day, to read" })
    : page.getByRole("group", { name: /The day's energy/ });
}

/** The day on screen is written whole: its chart, seen or not, is still. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/**
 * The page has played its day for a visitor who has not seen it: its first HTML holds the
 * day whole, list and all, until the page's script plays it from its empty frame.
 */
async function waitForThePlaying(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-day-seen"), null, {
    timeout: DAY_TIMEOUT_MS,
  });
}

/** The day is shown in this view, and the other is not on the page's face. */
async function expectTheView(page: Page, view: View): Promise<void> {
  const other: View = view === "Read" ? "Chart" : "Read";
  await expect(viewOf(page, view)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await expect(viewOf(page, other)).toBeHidden();
  await expect(
    page.getByRole("group", { name: "View" }).getByRole("button", { name: view }),
  ).toHaveAttribute("aria-pressed", "true");
}

for (const view of ["Read", "Chart"] as const) {
  test(`${view}, once chosen, holds after a reload, on another city, a re-planned day and a kept day's page`, async ({
    page,
  }) => {
    // Five days played, Kanazawa's twice, each at the landing's pace.
    test.setTimeout(5 * DAY_TIMEOUT_MS);
    // The other view was the visitor's before, so choosing this one changes something.
    const before = view === "Read" ? "chart" : "read";
    await page.addInitScript(
      ([key, value]) => {
        if (sessionStorage.getItem("chosen") === null) localStorage.setItem(key!, value!);
        sessionStorage.setItem("chosen", "yes");
      },
      ["lantern-day-view", before],
    );
    await page.goto("/day/kanazawa");
    await waitForTheDay(page);
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: view }).click();
    await expectTheView(page, view);

    await page.reload();
    await waitForTheDay(page);
    await expectTheView(page, view);

    // Another city's day, from the city word.
    const headline = page.getByRole("heading", { level: 1 });
    await headline.getByRole("button", { name: "Kanazawa", exact: true }).click();
    await page.getByRole("button", { name: /^Bologna/ }).click();
    await expect(headline).toContainText("Bologna");
    await waitForTheDay(page);
    await expectTheView(page, view);

    // A day's proposal for a word, taken, on the re-plan's lab: Elche's late dinner.
    await page.goto("/lab/concepts/replan");
    await waitForTheDay(page);
    await expectTheView(page, view);
    await headline.getByRole("button", { name: "early dinner", exact: true }).click();
    await page.getByRole("option", { name: /eating late/ }).click();
    const take = page
      .getByRole("radio", { name: "eating late, proposed", exact: true })
      .filter({ visible: true })
      .first();
    await expect(take).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await take.click();
    await expect(headline).not.toContainText("early dinner", { timeout: DAY_TIMEOUT_MS });
    await waitForTheDay(page);
    // The proposal's new lunch, taken, in the view on show.
    await expect(
      page
        .getByText("Arròs on Passeig de l'Estació", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expectTheView(page, view);

    // A kept day's own page, which the log answers here: the e2e server keeps no day.
    await page.route(`**/api/day/${ID}`, (route) => route.fulfill({ json: WRITTEN }));
    await page.goto(`/day/${ID}`);
    await expect(headline).toContainText("A calm Saturday in Kyoto", { timeout: DAY_TIMEOUT_MS });
    await waitForTheDay(page);
    await expectTheView(page, view);
  });
}

test.describe("with motion", { tag: "@frame" }, () => {
  test.use({ reducedMotion: "no-preference" });

  test("the chart shown first after the list stands in place from its first frame", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
    await page.goto("/day/kanazawa");
    await waitForTheDay(page);
    await expectTheView(page, "Read");

    // Every frame's row tops from the press on: drawn first behind the list under
    // display: none, they slid 1.4 s to their places over one another.
    await page.evaluate(() => {
      const tops: number[][] = [];
      (window as unknown as { tops: number[][] }).tops = tops;
      const sample = () => {
        const rows = [...document.querySelectorAll('[aria-label="The day"] > li')];
        tops.push(rows.map((row) => row.getBoundingClientRect().top + scrollY));
        if (tops.length < 60) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Chart" }).click();
    await expectTheView(page, "Chart");
    await page.waitForFunction(() => (window as unknown as { tops: number[][] }).tops.length >= 60);
    const tops = await page.evaluate(() => (window as unknown as { tops: number[][] }).tops);
    const steps = tops
      .slice(1)
      .flatMap((frame, at) => frame.map((top, row) => Math.abs(top - (tops[at]?.[row] ?? top))));
    expect(Math.max(0, ...steps)).toBeLessThan(1);
  });

  test("the line under the list counts the stops and versions the list shows, never more", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lantern-day-view", "read");
      // Every frame from the first: how many rows and versions' lines the list shows, and
      // what the line under it says.
      const said: { rows: number; versions: number; line: string }[] = [];
      (window as unknown as { said: typeof said }).said = said;
      const sample = () => {
        const rows = [...document.querySelectorAll('ol[aria-label="The day, to read"] > li')];
        const line = [...document.querySelectorAll("p")].find((element) =>
          /^Writing (the day ·|quieter)/.test(element.textContent ?? ""),
        );
        said.push({
          rows: rows.length,
          versions: rows.filter((row) =>
            [...row.querySelectorAll("p")].some((line) => line.textContent?.startsWith("or ")),
          ).length,
          line: line?.textContent ?? "",
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto("/day/kanazawa");
    await waitForThePlaying(page);
    await expect(page.getByRole("list", { name: "The day, to read" })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const said = await page.evaluate(
      () =>
        (window as unknown as { said: { rows: number; versions: number; line: string }[] }).said,
    );
    // Counted from the chart, it said a stop so far over an empty list, and a set ahead.
    const ahead = said.filter(({ rows, versions, line }) => {
      // A count is tied to its unit by a no-break space (`TIED`), which \s matches.
      const stops = /· (\d+)\sstops? so far/.exec(line);
      const sets = /· (\d+)\sof\s\d+/.exec(line);
      return (
        (stops !== null && Number(stops[1]) > rows) || (sets !== null && Number(sets[1]) > versions)
      );
    });
    expect(said.some(({ line }) => line.includes("so far"))).toBe(true);
    expect(ahead).toEqual([]);
  });

  test("a new energy reshapes the list in about 1.5 s, the rows on screen gliding under 3 px a frame", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
    // Kyoto's, written by hand, on the lab's bench, where the bar was measured. On a phone the
    // calm starts take longer, Kanazawa's 1.8 s and Porto's 2.0 (2026-11-04): a cost to weigh
    // against the bar where the bar is set, not this test's to loosen.
    await page.goto("/lab/concepts/day");
    const list = page.getByRole("list", { name: "The day, to read" });
    await expect(list).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });

    // The rows on screen as the word is changed, and every frame's row tops from then on.
    const onScreen = await list.evaluate((element) =>
      [...element.querySelectorAll(":scope > li")]
        .map((row, at) => (row.getBoundingClientRect().top < innerHeight ? at : -1))
        .filter((at) => at >= 0),
    );
    await list.evaluate((element) => {
      const frames: { t: number; tops: number[] }[] = [];
      (window as unknown as { frames: typeof frames }).frames = frames;
      const sample = () => {
        const rows = [...element.querySelectorAll(":scope > li")];
        frames.push({
          t: performance.now(),
          tops: rows.map((row) => row.getBoundingClientRect().top),
        });
        if (frames.length < 240) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const headline = page.getByRole("heading", { level: 1 });
    await headline.getByRole("button", { name: "calm", exact: true }).click();
    await page.getByRole("option", { name: "lively" }).click();
    await page.waitForFunction(
      () => (window as unknown as { frames: unknown[] }).frames.length >= 240,
    );
    const frames = await page.evaluate(
      () => (window as unknown as { frames: { t: number; tops: number[] }[] }).frames,
    );

    // How far each row on screen moves in a 60 Hz frame's time, over a tenth of a second,
    // so a frame a busy machine drops is not counted as a step.
    const FRAME_MS = 1000 / 60;
    let fastest = 0;
    let first: number | null = null;
    let last: number | null = null;
    frames.forEach((frame, index) => {
      const before = frames[index - 1];
      if (
        before &&
        frame.tops.some((top, row) => Math.abs(top - (before.tops[row] ?? top)) > 0.5)
      ) {
        first ??= before.t;
        last = frame.t;
      }
      let back = index;
      while (back > 0 && frame.t - frames[back - 1]!.t <= 100) back -= 1;
      const from = frames[back]!;
      if (frame.t - from.t < 80) return;
      for (const row of onScreen) {
        const moved = Math.abs((frame.tops[row] ?? 0) - (from.tops[row] ?? 0));
        fastest = Math.max(fastest, (moved * FRAME_MS) / (frame.t - from.t));
      }
    });
    expect(first, "the rows moved").not.toBeNull();
    expect(fastest).toBeLessThanOrEqual(3);
    expect(last! - first!).toBeLessThanOrEqual(1600);
  });
});
