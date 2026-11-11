/**
 * `pnpm days:fresh`: how long each written day still holds (`src/lib/days/written/freshness.ts`).
 * For each city it prints the date its page shows now, the season that date picks, the last
 * date the day holds on, and the days left until then, and flags a city with fewer than 21. It
 * reads the clock and the files only: no service, no key, nothing written. It runs under Vitest,
 * which resolves the app's `@/` imports, with its own config (`vitest.days-fresh.config.mts`),
 * so `pnpm test` never collects it, and it fails while any city is flagged.
 */
import { expect, test } from "vitest";
import { freshnessAt, freshnessReportOf } from "@/lib/days/written/freshness";

test("every written day holds for three weeks or more", () => {
  const cities = freshnessAt(new Date());
  process.stdout.write(`${freshnessReportOf(cities).join("\n")}\n`);
  expect(cities.filter(({ isFlagged }) => isFlagged).map(({ city }) => city)).toEqual([]);
});
