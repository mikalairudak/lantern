import {
  Finlandica_Text,
  Fira_Sans,
  Geist,
  Mulish,
  Nunito_Sans,
  Overpass,
  Pliant,
  SN_Pro,
  Sofia_Sans,
  Source_Sans_3,
  Ubuntu_Sans,
  Wix_Madefor_Text,
  Ysabeau_Office,
} from "next/font/google";

/**
 * Sans faces on trial for system A, where one face sets every role, loaded only by the
 * type lab. Each passes the hard bars first: on Google Fonts with latin-ext (Hōnen-in,
 * Dársena) and Cyrillic, a true italic, and the two weights the type tokens use. The faces
 * most seen on generated or stock sites (Inter, IBM Plex, Roboto, Open Sans, Montserrat,
 * Noto Sans, Rubik and the like) are left out. Geist, the app's first face, stays for
 * comparison; Fira Sans is the one chosen (`docs/decisions.md`, "One sans in one weight:
 * Fira Sans").
 */
// next/font reads its options at build time, so each call spells them out.
const firaSans = Fira_Sans({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
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
  candidate("Fira Sans", firaSans, true),
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
