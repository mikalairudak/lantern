import { screen } from "@testing-library/react";

/**
 * For the tests of a day's page: whether the line about the day is led "As first planned:" on
 * screen, not in a reserve, and a watch that catches the lead in any frame it is drawn in.
 */

/** Whether the line about the day is led "As first planned:" on screen, not in a reserve. */
export const isLeadSeen = (): boolean =>
  screen.queryAllByText("As first planned:").some((lead) => lead.closest("[aria-hidden]") === null);

/** Watches for the lead on screen from now; tells whether it was ever seen, and stops. */
export function watchLead(): () => boolean {
  let isSeen = isLeadSeen();
  const observer = new MutationObserver(() => {
    isSeen ||= isLeadSeen();
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  return () => {
    observer.disconnect();
    return isSeen || isLeadSeen();
  };
}

/** Long enough for a lead that is due to come in, as the pen's beat brings it. */
export const LEAD_DUE_MS = 800;
