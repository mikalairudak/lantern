import { afterEach, describe, expect, it, vi } from "vitest";
import { writtenDayAt } from "@/lib/days/written/days";
import { browserStorage, keepYourDay, type YourDay } from "./your-days";
import { WRITTEN_VERSION_PATTERN, writtenVersionOf } from "@/lib/days/written/version";
import {
  SEEN_ATTRIBUTE,
  SEEN_DAYS_LIMIT,
  SEEN_DAYS_STORAGE_KEY,
  clearSeenNote,
  forgetKeptSeen,
  isKeptSeen,
  isRenderingCrawler,
  isSeen,
  keptSeenKeyOf,
  markSeen,
  seenKeyAt,
  seenKeyOf,
  seenScriptOf,
  subscribeSeen,
} from "./seen-days";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(SEEN_ATTRIBUTE);
  vi.restoreAllMocks();
});

describe("forgetting the kept days seen", () => {
  it("forgets every kept day's mark, and keeps Lantern's own written days seen", () => {
    const onChange = vi.fn();
    const stop = subscribeSeen(onChange);
    const kyoto = seenKeyOf("kyoto", "0123456789abcdef");
    markSeen(keptSeenKeyOf("mine"));
    markSeen(kyoto);
    markSeen(keptSeenKeyOf("from-a-link"));
    onChange.mockClear();

    forgetKeptSeen();

    expect(isKeptSeen("mine")).toBe(false);
    expect(isKeptSeen("from-a-link")).toBe(false);
    expect(isSeen(kyoto)).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("lets the key go once nothing is left, and breaks nothing without storage", () => {
    markSeen(keptSeenKeyOf("mine"));
    forgetKeptSeen();
    expect(localStorage.getItem(SEEN_DAYS_STORAGE_KEY)).toBeNull();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => forgetKeptSeen()).not.toThrow();
  });
});

describe("the days this device has seen", () => {
  it("keeps a day once it has played to its end, for this page and the next visit", () => {
    const onChange = vi.fn();
    const stop = subscribeSeen(onChange);
    const kyoto = seenKeyOf("kyoto", "0123456789abcdef");

    expect(isSeen(kyoto)).toBe(false);
    markSeen(kyoto);
    expect(isSeen(kyoto)).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    // A day rewritten in a later build is another day.
    expect(isSeen(seenKeyOf("kyoto", "fedcba9876543210"))).toBe(false);
    stop();
  });

  it("lets the oldest go past its limit, and holds a day seen again as the latest", () => {
    for (let day = 0; day < SEEN_DAYS_LIMIT + 5; day += 1) markSeen(`day-${day}:v`);
    expect(isSeen("day-0:v")).toBe(false);
    expect(isSeen(`day-${SEEN_DAYS_LIMIT + 4}:v`)).toBe(true);

    markSeen("day-10:v");
    const kept = JSON.parse(localStorage.getItem(SEEN_DAYS_STORAGE_KEY) ?? "[]") as string[];
    expect(kept.at(-1)).toBe("day-10:v");
    expect(kept.filter((key) => key === "day-10:v")).toHaveLength(1);
  });

  it("plays every day where storage cannot be read or holds something else", () => {
    localStorage.setItem(SEEN_DAYS_STORAGE_KEY, "not a list");
    expect(isSeen("kyoto:v")).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(isSeen("kyoto:v")).toBe(false);
  });

  it("notes on <html>, before the day's markup, whether this page's day was seen", () => {
    const kyoto = seenKeyOf("kyoto", "0123456789abcdef");
    new Function(seenScriptOf(kyoto))();
    expect(document.documentElement.getAttribute(SEEN_ATTRIBUTE)).toBe("no");

    markSeen(kyoto);
    new Function(seenScriptOf(kyoto))();
    expect(document.documentElement.getAttribute(SEEN_ATTRIBUTE)).toBe("yes");

    clearSeenNote();
    expect(document.documentElement.hasAttribute(SEEN_ATTRIBUTE)).toBe(false);
  });

  it("follows a day marked seen in another tab", () => {
    const onChange = vi.fn();
    const stop = subscribeSeen(onChange);
    window.dispatchEvent(new StorageEvent("storage", { key: "lantern-day-view" }));
    expect(onChange).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: SEEN_DAYS_STORAGE_KEY }));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });
});

/** User agents as their makers publish them, each with whether it is a search engine's renderer. */
const AGENTS = [
  {
    name: "Googlebot, as a phone",
    agent:
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.116 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    isCrawler: true,
  },
  {
    name: "Googlebot, as a desktop",
    agent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0.6723.116 Safari/537.36",
    isCrawler: true,
  },
  {
    name: "Search Console's live test",
    agent:
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.116 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0;)",
    isCrawler: true,
  },
  {
    name: "Bingbot",
    agent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/130.0.6723.117 Safari/537.36",
    isCrawler: true,
  },
  {
    name: "Safari on an iPhone",
    agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    isCrawler: false,
  },
  {
    name: "Chrome on a laptop",
    agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    isCrawler: false,
  },
  {
    name: "LinkedIn's link preview, which runs no script",
    agent: "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    isCrawler: false,
  },
];

function browseAs(agent: string): void {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(agent);
}

describe("a search engine's renderer", () => {
  it.each(AGENTS)("is told by its user agent: $name", ({ agent, isCrawler }) => {
    expect(isRenderingCrawler(agent)).toBe(isCrawler);
  });

  it.each(AGENTS)(
    "has the page's script and the page agree whether the day was seen: $name",
    ({ agent, isCrawler }) => {
      browseAs(agent);
      const kanazawa = seenKeyOf("kanazawa", "0123456789abcdef");
      new Function(seenScriptOf(kanazawa))();

      expect(isSeen(kanazawa)).toBe(isCrawler);
      expect(document.documentElement.getAttribute(SEEN_ATTRIBUTE)).toBe(isCrawler ? "yes" : "no");
    },
  );

  it("takes every day as seen, a kept one too, with nothing in storage and nothing kept", () => {
    browseAs(AGENTS[0]!.agent);
    expect(isSeen(seenKeyOf("bologna", "fedcba9876543210"))).toBe(true);
    expect(isKeptSeen("any-id")).toBe(true);
    expect(localStorage.getItem(SEEN_DAYS_STORAGE_KEY)).toBeNull();
  });
});

const KEPT_ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
const REPLANNED_ID = "2c7a1d3f-5e4b-4a6c-8d9f-3b2e4f5a6c7d";

/** This browser's record of a day it asked, as it stood when last told. */
function yourDay(id: string, ending: YourDay["ending"]): YourDay {
  return {
    id,
    request: writtenDayAt("kanazawa")!.request,
    startedAt: "2026-11-03T19:59:00.000Z",
    energies: [],
    ending,
    seconds: ending === "writing" ? null : 46,
  };
}

describe("the kept days this device has seen", () => {
  it("are kept by their id, never taken for a written day's key", () => {
    markSeen(keptSeenKeyOf(KEPT_ID));
    expect(isSeen(keptSeenKeyOf(KEPT_ID))).toBe(true);
    expect(seenKeyAt("kyoto")).toBeNull();
    expect(keptSeenKeyOf(KEPT_ID)).not.toMatch(/^[a-z0-9-]+:[0-9a-f]{16}$/);
  });

  it("are those watched to their end here, never the list's word for how they ended", () => {
    // The list says how a day ended as the log told it, watched or not.
    keepYourDay(browserStorage(), yourDay(KEPT_ID, "written"));
    expect(isKeptSeen(KEPT_ID)).toBe(false);

    markSeen(keptSeenKeyOf(KEPT_ID));
    expect(isKeptSeen(KEPT_ID)).toBe(true);
  });

  it("are kept to a limit of their own, so links never push out a written day's version", () => {
    const kyoto = seenKeyOf("kyoto", "0123456789abcdef");
    markSeen(kyoto);
    for (let link = 0; link <= SEEN_DAYS_LIMIT; link += 1) {
      markSeen(keptSeenKeyOf(`${REPLANNED_ID.slice(0, -4)}${String(link).padStart(4, "0")}`));
    }

    expect(isSeen(kyoto)).toBe(true);
    expect(isKeptSeen(`${REPLANNED_ID.slice(0, -4)}0000`)).toBe(false);
    expect(
      isKeptSeen(`${REPLANNED_ID.slice(0, -4)}${String(SEEN_DAYS_LIMIT).padStart(4, "0")}`),
    ).toBe(true);
  });

  it("are none where storage cannot be read, or holds something else", () => {
    localStorage.setItem(SEEN_DAYS_STORAGE_KEY, "{not json");
    expect(isKeptSeen(KEPT_ID)).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(isKeptSeen(KEPT_ID)).toBe(false);
  });
});

describe("a written day's version", () => {
  it("is sixteen hex digits, the same for the same day, another once a word changes", () => {
    const kanazawa = writtenDayAt("kanazawa")!.itinerary;
    const version = writtenVersionOf(kanazawa);
    expect(version).toMatch(WRITTEN_VERSION_PATTERN);
    expect(writtenVersionOf(structuredClone(kanazawa))).toBe(version);

    const rewritten = { ...kanazawa, dek: `${kanazawa.dek} Again.` };
    expect(writtenVersionOf(rewritten)).not.toBe(version);
    expect(writtenVersionOf(writtenDayAt("bologna")!.itinerary)).not.toBe(version);
  });
});
