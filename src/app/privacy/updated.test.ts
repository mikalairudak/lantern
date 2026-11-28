import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL } from "@/features/day/foot-line";
import { browserStorageLine } from "@/lib/browser-storage";
import { DAY_LINK_DAYS } from "@/lib/days/stored-day";
import { VISITOR_DAILY_LIMITS } from "@/lib/live/limits";
import { VISITOR_TEXT_RETENTION_DAYS } from "@/lib/live/retention";
import { SITE_AUTHOR, SITE_AUTHOR_PROFILE } from "@/lib/site";

/**
 * The privacy page says when it last changed what it says, and a date nothing checks falls
 * behind the text. So the page's source and each value it reads from the code are held here as
 * one digest: a change to either fails this test until the date has been looked at
 * (`docs/decisions.md`, "What Lantern keeps is said on one page").
 */

/**
 * The page's source and the values it reads, as they stood when its date was last looked at;
 * the date itself is left out.
 */
const RECORDED = "ebd0ef8069c04bd3e3feba725435f583597c07fafc223c5fb5b11f7e7fec36a1";

const CHANGED =
  "The privacy page or a value it reads has changed. If what it says to a visitor changed, set " +
  "UPDATED in src/app/privacy/page.tsx to the day of the change. If the page reads a new value " +
  "from the code, add it to VALUES_READ. Then record this digest here.";

/** The line that holds the page's date, such as `const UPDATED = "9 November 2026";`. */
const UPDATED_LINE = /^const UPDATED = "\d{1,2} [A-Z][a-z]+ \d{4}";$/m;

/** What the page reads from the code and says to a visitor: a new one is added here by hand. */
const VALUES_READ = [
  CONTACT_EMAIL,
  DAY_LINK_DAYS,
  VISITOR_DAILY_LIMITS,
  VISITOR_TEXT_RETENTION_DAYS,
  SITE_AUTHOR,
  SITE_AUTHOR_PROFILE,
  browserStorageLine(),
];

const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("the privacy page's date", () => {
  it("is written as a day, a month and a year on a line of its own", () => {
    expect(source).toMatch(UPDATED_LINE);
  });

  it("has been looked at since the page, or a value it reads, last changed", () => {
    const dateless = source.replace(UPDATED_LINE, "");
    const digest = createHash("sha256")
      .update(dateless)
      .update(JSON.stringify(VALUES_READ))
      .digest("hex");

    expect(digest, CHANGED).toBe(RECORDED);
  });
});
