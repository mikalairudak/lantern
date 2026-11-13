import type { IndexPicture } from "./index-pictures";

/**
 * Each city's engraving, by its day's slug: its scene's box on the field, its files in
 * `public/pictures/`, and its lamps, each the centre of a source drawn in the scene as a share of
 * the scene's box, across and down. Written from the pictures' recipe, outside the repository,
 * with the files: each box is measured from its drawing, each lamp from where its source is drawn,
 * and a file's name ends in a hash of its bytes.
 */
export const INDEX_PICTURES: Readonly<Record<string, IndexPicture>> = {
  paris: {
    scene: {
      box: [147.1, 109.2, 185.8, 206.8],
      files: { narrow: "paris-scene-14.c533caf3.avif", wide: "paris-scene-20.01183c65.avif" },
    },
    lamps: [
      // The café lamp's shade.
      [0.638, 0.218],
      // The street lamp's head.
      [0.292, 0.328],
    ],
  },
  tokyo: {
    scene: {
      box: [142.3, 119.5, 195.5, 196.5],
      files: { narrow: "tokyo-scene-14.e446a6f1.avif", wide: "tokyo-scene-20.0cc7b9e8.avif" },
    },
    lamps: [
      // The left lantern.
      [0.266, 0.442],
      // The right lantern.
      [0.797, 0.425],
    ],
  },
  rome: {
    scene: {
      box: [155.2, 89.4, 169.6, 226.6],
      files: { narrow: "rome-scene-14.c927d4c5.avif", wide: "rome-scene-20.a4ef3f8e.avif" },
    },
    lamps: [
      // The wall lantern.
      [0.661, 0.237],
    ],
  },
  "new-york": {
    scene: {
      box: [134.4, 134.2, 211.3, 181.8],
      files: { narrow: "new-york-scene-14.831a5a20.avif", wide: "new-york-scene-20.8691ee27.avif" },
    },
    lamps: [
      // The larger skylight's glass.
      [0.77, 0.86],
    ],
  },
  amsterdam: {
    scene: {
      box: [155.7, 88.1, 168.5, 227.9],
      files: {
        narrow: "amsterdam-scene-14.eafc16d8.avif",
        wide: "amsterdam-scene-20.7ca1bd3e.avif",
      },
    },
    lamps: [
      // The middle-left window.
      [0.485, 0.53],
      // The top-right window.
      [0.633, 0.354],
    ],
  },
  barcelona: {
    scene: {
      box: [147.1, 109.3, 185.8, 206.7],
      files: {
        narrow: "barcelona-scene-14.c75ce638.avif",
        wide: "barcelona-scene-20.73a79f1c.avif",
      },
    },
    lamps: [
      // The balcony's glazed door.
      [0.496, 0.321],
    ],
  },
  seoul: {
    scene: {
      box: [117.1, 159.8, 245.9, 156.2],
      files: { narrow: "seoul-scene-14.6b2482d9.avif", wide: "seoul-scene-20.7bb1fe0c.avif" },
    },
    lamps: [
      // The left lattice window.
      [0.383, 0.484],
      // The right lattice window.
      [0.784, 0.492],
    ],
  },
  madrid: {
    scene: {
      box: [145.1, 113.7, 189.9, 202.3],
      files: { narrow: "madrid-scene-14.8aa01f16.avif", wide: "madrid-scene-20.5b5b9f48.avif" },
    },
    lamps: [
      // The right doorway.
      [0.858, 0.811],
    ],
  },
};
