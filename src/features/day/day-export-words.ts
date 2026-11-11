/** The ways a day is taken along, and what the link's control says, for server and client alike. */

/** The ways a day is taken along, as its events name them. */
export type DayExport = "link" | "calendar" | "route";

export const COPY_LINK = "Copy link";
export const LINK_COPIED = "Copied";
export const LINK_NOT_COPIED = "Not copied";

export type CopyLabel = typeof COPY_LINK | typeof LINK_COPIED | typeof LINK_NOT_COPIED;

/** How long "Copied" or "Not copied" stands before the link's words come back. */
export const COPIED_FOR_MS = 2500;
