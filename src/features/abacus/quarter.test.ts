import { describe, expect, it } from "vitest";
import { isQuarterNamed } from "./quarter";

describe("isQuarterNamed", () => {
  it.each([
    ["Gion Shirakawa", "Gion"],
    ["Obanzai along Pontocho", "Pontocho"],
    // Inside a long name, with words on either side.
    ["Mosteiro de São Vicente de Fora", "São Vicente"],
    // Whatever the case and the accents: the model may write either.
    ["Petiscos in the CHIADO", "Chiado"],
    ["Mosteiro de Sao Vicente de Fora", "São Vicente"],
    // A hyphen, a comma or an apostrophe parts words and is not one.
    ["Simmered tofu by Nanzen-ji", "Nanzen-ji"],
    ["Simmered tofu by Nanzen ji", "Nanzen-ji"],
    ["Alfama's tascas", "Alfama"],
  ])("says %j names its quarter %j", (name, quarter) => {
    expect(isQuarterNamed(name, quarter)).toBe(true);
  });

  it.each([
    // A short quarter inside another word is not said.
    ["Soba at Gionji", "Gion"],
    ["Rice dishes at Racó del Plà", "El Pla"],
    // Part of a long quarter is not the quarter.
    ["Espresso in Sant Pere", "Sant Pere, Santa Caterina i la Ribera"],
    // Its words out of order are not it either.
    ["Wine on Vicente São", "São Vicente"],
    ["Paella on the marina", "Puerto"],
  ])("says %j does not name its quarter %j", (name, quarter) => {
    expect(isQuarterNamed(name, quarter)).toBe(false);
  });

  it("says nothing is named by a name not written yet, or a quarter of no words", () => {
    expect(isQuarterNamed(undefined, "Gion")).toBe(false);
    expect(isQuarterNamed("Gion Shirakawa", "")).toBe(false);
    expect(isQuarterNamed("Gion Shirakawa", " · ")).toBe(false);
  });

  it("holds back a quarter being written while its letters could still be the name's", () => {
    const name = "Mosteiro de São Vicente de Fora";
    const written = ["S", "Sã", "São", "São ", "São V", "São Vice", "São Vicente"];

    for (const quarter of written) expect(isQuarterNamed(name, quarter, true)).toBe(true);
    expect(isQuarterNamed(name, "São Vicente")).toBe(true);
  });

  it("lets a quarter being written show from the letter it leaves the name, never taking it back", () => {
    const name = "Paella on the marina";
    // "P" could still be "paella"; "Pu" no longer can, and nothing it grows into can.
    const said = ["P", "Pu", "Pue", "Puerto"].map(
      (quarter, at, all) => !isQuarterNamed(name, quarter, at < all.length - 1),
    );

    expect(said).toEqual([false, true, true, true]);
  });
});
