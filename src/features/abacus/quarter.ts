/**
 * A text's words as a quarter is compared with a name: accents and marks gone, lower case,
 * each run of letters or digits one word, so "São Vicente" reads "sao vicente" and
 * "Nanzen-ji" reads "nanzen ji".
 */
function wordsOf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(" ");
}

/**
 * Whether a place's name already says its quarter: every word of the quarter, in order, among
 * the name's words, whatever their case and accents. "Gion Shirakawa" says Gion and "Mosteiro
 * de São Vicente de Fora" says São Vicente; "Gionji" does not say Gion, nor "Racó del Plà"
 * El Pla.
 *
 * A quarter still being written counts as said while its words so far could still be the
 * name's: "Gio" under "Gion Shirakawa". So a row never sets down a quarter it takes back a
 * letter later, and the room it holds for one only ever grows.
 */
export function isQuarterNamed(
  name: string | undefined,
  quarter: string,
  isWriting = false,
): boolean {
  if (name === undefined) return false;
  const said = wordsOf(quarter);
  if (said === "") return false;
  const named = ` ${wordsOf(name)} `;
  return named.includes(isWriting ? ` ${said}` : ` ${said} `);
}
