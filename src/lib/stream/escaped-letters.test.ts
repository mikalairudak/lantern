import { describe, expect, it } from "vitest";
import { escapedLettersIn, unescapeLetters, withLettersUnescaped } from "./escaped-letters";

// Strings as the parser gives them back from Sonnet's recorded days (`fixtures/live`): the
// JSON held `\\u00e1`, so the string holds a backslash, "u" and four digits.
const SIGHT = "Castillo de Santa B\\u00e1rbara";
const WALK = "Rambla de M\\u00e9ndez N\\u00fa\\u00f1ez";
const LINE = "small wine bars pour vinho verde with plates of cheese and chouri\\u00e7o.";

describe("unescapeLetters", () => {
  it("writes a letter spelled as its escape as the letter, the recordings' cases", () => {
    expect(unescapeLetters(SIGHT)).toBe("Castillo de Santa Bárbara");
    expect(unescapeLetters(WALK)).toBe("Rambla de Méndez Núñez");
    expect(unescapeLetters(LINE)).toBe(
      "small wine bars pour vinho verde with plates of cheese and chouriço.",
    );
  });

  it("joins a character spelled as two escapes, a surrogate pair", () => {
    expect(unescapeLetters("Wine \\ud83c\\udf77 at the bar")).toBe("Wine 🍷 at the bar");
  });

  it("reads uppercase digits and an escape written with more backslashes", () => {
    expect(unescapeLetters("Pra\\u00E7a")).toBe("Praça");
    expect(unescapeLetters("Pra\\\\u00e7a")).toBe("Praça");
  });

  it.each(["Pra\\", "Pra\\u", "Pra\\u0", "Pra\\u00", "Pra\\u00e", "Pra\\\\u00"])(
    "drops an escape the stream cut at the end of %s, so the letter appears whole",
    (cut) => {
      expect(unescapeLetters(cut)).toBe("Pra");
    },
  );

  it("drops half a surrogate pair, as a stream cut between the two leaves", () => {
    expect(unescapeLetters("Wine \\ud83c")).toBe("Wine ");
    expect(unescapeLetters("Wine \ud83c")).toBe("Wine ");
    expect(unescapeLetters("\udf77 at the bar")).toBe(" at the bar");
  });

  it("leaves a string alone that spells no letter, letters and backslashes mid-string too", () => {
    for (const text of ["Praça da Estrela", "Rua de São Bento", "a \\ mid-line", "\\unit"]) {
      expect(unescapeLetters(text)).toBe(text);
    }
  });
});

describe("withLettersUnescaped", () => {
  it("unescapes every string at any depth and keeps everything else where it was", () => {
    const written = {
      dek: SIGHT,
      stops: [{ startTime: "10:00", durationMinutes: 90, place: { name: WALK, tags: [LINE] } }],
      assumptions: { dinner: null, isLate: false },
    };

    expect(withLettersUnescaped(written)).toEqual({
      dek: "Castillo de Santa Bárbara",
      stops: [
        {
          startTime: "10:00",
          durationMinutes: 90,
          place: {
            name: "Rambla de Méndez Núñez",
            tags: ["small wine bars pour vinho verde with plates of cheese and chouriço."],
          },
        },
      ],
      assumptions: { dinner: null, isLate: false },
    });
  });

  it("leaves the value it was given as it was", () => {
    const written = { name: SIGHT };
    withLettersUnescaped(written);
    expect(written.name).toBe(SIGHT);
  });

  it("passes a value that is no object or string through", () => {
    expect(withLettersUnescaped(undefined)).toBeUndefined();
    expect(withLettersUnescaped(42)).toBe(42);
  });
});

describe("escapedLettersIn", () => {
  it("lists each escape a string spells out, as written", () => {
    expect(escapedLettersIn(WALK)).toEqual(["\\u00e9", "\\u00fa", "\\u00f1"]);
    expect(escapedLettersIn("Rambla de Méndez Núñez")).toEqual([]);
  });
});
