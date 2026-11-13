import {
  Brygada_1918,
  Finlandica_Text,
  Fira_Sans,
  Geist,
  Mulish,
  Nunito_Sans,
  Old_Standard_TT,
  Overpass,
  Piazzolla,
  Pliant,
  SN_Pro,
  Sofia_Sans,
  Source_Sans_3,
  Source_Serif_4,
  Ubuntu_Sans,
  Wix_Madefor_Text,
  Ysabeau_Office,
} from "next/font/google";

/**
 * The faces measured for the one face that sets every role, loaded only by the type lab. Each
 * passes the hard bars first: latin-ext (Hōnen-in, Dársena) and Cyrillic, a true italic, and
 * tabular figures. The faces most seen on generated or stock sites (Inter, IBM Plex, Roboto,
 * Open Sans, Montserrat, Noto Sans, Rubik, Instrument Serif, Fraunces, Playfair and the like)
 * are left out. Literata, the page's own, is the one chosen (`docs/decisions.md`, "One serif in
 * one weight: Literata"); the serifs set aside beside it, then the sans faces measured before
 * it, Fira Sans the face it replaced and Geist the app's first.
 */
// next/font reads its options at build time, so each call spells them out.
const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const piazzolla = Piazzolla({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const brygada = Brygada_1918({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const oldStandard = Old_Standard_TT({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: "400",
  style: ["normal", "italic"],
});
const firaSans = Fira_Sans({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: "400",
  style: ["normal", "italic"],
});
const sofiaSans = Sofia_Sans({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const ysabeauOffice = Ysabeau_Office({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const finlandica = Finlandica_Text({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const overpass = Overpass({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const ubuntuSans = Ubuntu_Sans({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const wixMadefor = Wix_Madefor_Text({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const mulish = Mulish({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const nunitoSans = Nunito_Sans({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const snPro = SN_Pro({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const pliant = Pliant({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const sourceSans = Source_Sans_3({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});
const geist = Geist({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
});

export interface Candidate {
  name: string;
  /** The face's own family and fallback, as next/font names it. */
  style: { fontFamily: string };
  /** The face the app sets every role in. */
  isInUse: boolean;
}

function candidate(
  name: string,
  font: { style: { fontFamily: string } },
  isInUse = false,
): Candidate {
  return { name, style: { fontFamily: font.style.fontFamily }, isInUse };
}

export const CANDIDATES: readonly Candidate[] = [
  // The page's own face, read from the variable the root layout sets, so the lab loads no copy.
  candidate("Literata", { style: { fontFamily: "var(--family-serif)" } }, true),
  candidate("Source Serif 4", sourceSerif),
  candidate("Piazzolla", piazzolla),
  candidate("Brygada 1918", brygada),
  candidate("Old Standard TT", oldStandard),
  candidate("Fira Sans", firaSans),
  candidate("Sofia Sans", sofiaSans),
  candidate("Ysabeau Office", ysabeauOffice),
  candidate("Finlandica Text", finlandica),
  candidate("Overpass", overpass),
  candidate("Ubuntu Sans", ubuntuSans),
  candidate("Wix Madefor Text", wixMadefor),
  candidate("Mulish", mulish),
  candidate("Nunito Sans", nunitoSans),
  candidate("SN Pro", snPro),
  candidate("Pliant", pliant),
  candidate("Source Sans 3", sourceSans),
  candidate("Geist", geist),
];
