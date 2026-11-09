import { describe, expect, it } from "vitest";
import { BANNED_PHRASES, findBannedPhrases } from "./banned-phrases";
import { formatPath } from "./path";

describe("findBannedPhrases", () => {
  it("finds a phrase in any case, with the path to it", () => {
    const day = { stops: [{ place: { summary: "An Iconic view over the bay." } }] };
    expect(findBannedPhrases(day)).toEqual([{ path: "stops[0].place.summary", phrase: "iconic" }]);
  });

  it("counts a plural as the phrase", () => {
    expect(findBannedPhrases({ dek: "Three hidden gems before lunch." })).toEqual([
      { path: "dek", phrase: "hidden gem" },
    ]);
  });

  it("matches whole words only", () => {
    expect(findBannedPhrases({ dek: "Charmingly odd, and a delver's delight." })).toEqual([]);
  });

  it("matches a phrase written with a typographic apostrophe", () => {
    expect(findBannedPhrases({ dek: "Whether you’re early or late." })).toEqual([
      { path: "dek", phrase: "whether you're" },
    ]);
  });

  it("counts any exclamation mark", () => {
    expect(findBannedPhrases({ title: "Sunrise!" })).toEqual([{ path: "title", phrase: "!" }]);
  });

  it("leaves place names and neighbourhoods alone", () => {
    const place = { name: "Oasis", neighborhood: "Paradise Hill", aesthetic: ["oasis"] };
    expect(findBannedPhrases(place)).toEqual([{ path: "aesthetic[0]", phrase: "oasis" }]);
  });

  it("reports every phrase in a line", () => {
    const hits = findBannedPhrases({ summary: "A vibrant, bustling must-see!" });
    expect(hits.map((hit) => hit.phrase)).toEqual(["vibrant", "bustling", "must-see", "!"]);
  });

  it("finds every phrase on the list", () => {
    const hits = BANNED_PHRASES.flatMap((phrase) => findBannedPhrases({ line: phrase }));
    expect(hits.map((hit) => hit.phrase)).toEqual([...BANNED_PHRASES]);
  });

  it("ignores values that are not text", () => {
    expect(findBannedPhrases({ durationMinutes: 45, light: null })).toEqual([]);
  });
});

describe("formatPath", () => {
  it("writes keys with dots and indexes in brackets", () => {
    expect(formatPath(["alternatives", 3, "options", 0, "reason"])).toBe(
      "alternatives[3].options[0].reason",
    );
  });

  it("starts an index path with the index", () => {
    expect(formatPath([2, "summary"])).toBe("[2].summary");
  });
});
