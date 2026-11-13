import { INDEX_PICTURES } from "./index-picture-files";
import type { IndexPicture } from "./index-pictures";

/**
 * Plates at the edges of what the module can hold, for the lab and the tests. No picture the site
 * ships has no lamps, and every file it names is served, but a plate draws both.
 */

const BARCELONA = INDEX_PICTURES.barcelona!;

/** Barcelona's scene with its lamp left out: unlit at rest, and lit whole from its middle. */
export const NO_LAMPS_PICTURE: IndexPicture = { ...BARCELONA, lamps: [] };

/** A plate's scene with files that are not served, so its plate is never drawn. */
export function withMissingFilesOf(picture: IndexPicture): IndexPicture {
  return {
    ...picture,
    scene: { ...picture.scene, files: { narrow: "missing.avif", wide: "missing.avif" } },
  };
}

/**
 * The plates the lab draws a plate's states on, each for what it tests: where its lamps stand, how
 * tall or wide its scene is, and a plate with none.
 */
export const PLATE_EXAMPLES = {
  "new-york": { label: "one lamp near the foot: New York", picture: INDEX_PICTURES["new-york"]! },
  madrid: { label: "one lamp near a side: Madrid", picture: INDEX_PICTURES.madrid! },
  rome: { label: "one lamp, the tallest scene but one: Rome", picture: INDEX_PICTURES.rome! },
  amsterdam: {
    label: "two lamps as near as the rule lets them, the tallest scene: Amsterdam",
    picture: INDEX_PICTURES.amsterdam!,
  },
  tokyo: { label: "two lamps far apart: Tokyo", picture: INDEX_PICTURES.tokyo! },
  seoul: { label: "the widest scene: Seoul", picture: INDEX_PICTURES.seoul! },
  "no-lamps": { label: "no lamps: Barcelona's scene without its lamp", picture: NO_LAMPS_PICTURE },
} as const satisfies Record<string, { label: string; picture: IndexPicture }>;

export type PlateExample = keyof typeof PLATE_EXAMPLES;

/** Barcelona's plate on files that are not served. */
export const MISSING_FILES_PICTURE: IndexPicture = withMissingFilesOf(BARCELONA);
