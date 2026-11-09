import { describe, expect, it } from "vitest";
import {
  listedPageMetadata,
  openGraphOf,
  SITE_CARD,
  SITE_DESCRIPTION,
  SITE_NAME,
  siteUrlOf,
} from "./site";

/**
 * The code points `assets/fonts/` keeps of Fira Sans, as its README's `pyftsubset` command
 * lists them: the card draws its words in these fonts alone.
 */
const CARD_FONT_CUT: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa0, 0xa0],
  [0xb7, 0xb7],
  [0x2013, 0x2014],
  [0x2018, 0x201d],
  [0x2026, 0x2026],
];

const KYOTO = {
  title: "A calm Saturday in Kyoto",
  description: "Honen-in before eight, the canal path down to Nanzen-ji.",
};

describe("openGraphOf", () => {
  it("says the page's title and line under the site's name", () => {
    expect(openGraphOf(KYOTO, "/day/kyoto")).toEqual({
      siteName: SITE_NAME,
      type: "website",
      images: [SITE_CARD],
      title: KYOTO.title,
      description: KYOTO.description,
      url: "/day/kyoto",
    });
  });

  it("leaves out a line the page does not have yet, rather than an empty one", () => {
    expect(openGraphOf({ title: "A day being written" })).not.toHaveProperty("description");
  });

  it("gives no address to a page that is not meant to be found", () => {
    expect(openGraphOf(KYOTO)).not.toHaveProperty("url");
  });
});

describe("SITE_CARD", () => {
  it("says only letters its font was cut to (assets/fonts/README.md)", () => {
    for (const letter of SITE_NAME + SITE_DESCRIPTION) {
      const code = letter.codePointAt(0) ?? 0;
      expect(
        CARD_FONT_CUT.some(([first, last]) => code >= first && code <= last),
        `"${letter}" is outside the card's cut of Fira Sans; cut the fonts again with it`,
      ).toBe(true);
    }
  });

  it("says in words what it draws, the site's line among them", () => {
    expect(SITE_CARD.alt).toContain(SITE_NAME);
    expect(SITE_CARD.alt).toContain(SITE_DESCRIPTION);
  });
});

describe("listedPageMetadata", () => {
  it("names the page's own address as canonical and as its preview's", () => {
    const metadata = listedPageMetadata("/day/kyoto", KYOTO);

    expect(metadata.alternates).toEqual({ canonical: "/day/kyoto" });
    expect(metadata.openGraph).toMatchObject({ url: "/day/kyoto", title: KYOTO.title });
  });

  it("leaves the page's robots to the layout, so a listed page is indexable", () => {
    expect(listedPageMetadata("/", { title: SITE_NAME })).not.toHaveProperty("robots");
  });
});

describe("siteUrlOf", () => {
  it.each([
    ["/", "https://www.lanternday.com/"],
    ["/day/kyoto", "https://www.lanternday.com/day/kyoto"],
    ["/sitemap.xml", "https://www.lanternday.com/sitemap.xml"],
  ])("makes %s whole on the www host", (address, url) => {
    expect(siteUrlOf(address)).toBe(url);
  });
});
