/**
 * Hands the visitor a file the page made, as a download: built in the browser and saved from
 * it, so nothing about it is sent anywhere.
 */

/**
 * How long the file's address stays good after the press: long enough for the browser to have
 * taken the file, which some take a moment after the click.
 */
export const REVOKE_AFTER_MS = 1000;

/** Saves `text` as a file of this type and name, from the page. */
export function saveFile(text: string, type: string, fileName: string): void {
  const address = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = address;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(address), REVOKE_AFTER_MS);
}
