import type { IndexPicture } from "./index-pictures";

/**
 * Each city's engraving, by its day's slug: its two layers' boxes on the field and their files in
 * `public/pictures/`. Written from the pictures' recipe, outside the repository, with the files.
 */
export const INDEX_PICTURES: Readonly<Record<string, IndexPicture>> = {
  paris: {
    scene: {
      box: [147.1, 109.2, 185.8, 206.8],
      files: { narrow: "paris-scene-14.c533caf3.avif", wide: "paris-scene-20.01183c65.avif" },
    },
    subject: {
      box: [118.3, 158.1, 243.3, 157.9],
      files: { narrow: "paris-subject-14.b870ea48.avif", wide: "paris-subject-20.6726ae8d.avif" },
    },
  },
  tokyo: {
    scene: {
      box: [142.3, 119.5, 195.5, 196.5],
      files: { narrow: "tokyo-scene-14.e446a6f1.avif", wide: "tokyo-scene-20.0cc7b9e8.avif" },
    },
    subject: {
      box: [147.5, 119.5, 184.9, 196.5],
      files: { narrow: "tokyo-subject-14.dbb56cdf.avif", wide: "tokyo-subject-20.53e3d292.avif" },
    },
  },
  rome: {
    scene: {
      box: [149.1, 104.7, 181.8, 211.3],
      files: { narrow: "rome-scene-14.ea71ccf6.avif", wide: "rome-scene-20.2e48f385.avif" },
    },
    subject: {
      box: [198.3, 104.7, 83.3, 211.3],
      files: { narrow: "rome-subject-14.172080ec.avif", wide: "rome-subject-20.dbcd7239.avif" },
    },
  },
  "new-york": {
    scene: {
      box: [134.4, 134.2, 211.3, 181.8],
      files: { narrow: "new-york-scene-14.831a5a20.avif", wide: "new-york-scene-20.8691ee27.avif" },
    },
    subject: {
      box: [150.4, 134.2, 179.1, 181.8],
      files: {
        narrow: "new-york-subject-14.6207c06a.avif",
        wide: "new-york-subject-20.e56a5152.avif",
      },
    },
  },
  amsterdam: {
    scene: {
      box: [155.7, 88.1, 168.5, 227.9],
      files: {
        narrow: "amsterdam-scene-14.eafc16d8.avif",
        wide: "amsterdam-scene-20.7ca1bd3e.avif",
      },
    },
    subject: {
      box: [159.5, 88.1, 161.0, 227.9],
      files: {
        narrow: "amsterdam-subject-14.8cfcc42e.avif",
        wide: "amsterdam-subject-20.2b37a89b.avif",
      },
    },
  },
  barcelona: {
    scene: {
      box: [147.1, 109.3, 185.8, 206.7],
      files: {
        narrow: "barcelona-scene-14.b43ea930.avif",
        wide: "barcelona-scene-20.72f6ee53.avif",
      },
    },
    subject: {
      box: [159.9, 109.3, 160.3, 206.7],
      files: {
        narrow: "barcelona-subject-14.8d559319.avif",
        wide: "barcelona-subject-20.fbc70cbe.avif",
      },
    },
  },
  seoul: {
    scene: {
      box: [117.1, 159.8, 245.9, 156.2],
      files: { narrow: "seoul-scene-14.6b2482d9.avif", wide: "seoul-scene-20.7bb1fe0c.avif" },
    },
    subject: {
      box: [118.9, 159.8, 242.2, 156.2],
      files: { narrow: "seoul-subject-14.7f197276.avif", wide: "seoul-subject-20.c99164b7.avif" },
    },
  },
  madrid: {
    scene: {
      box: [145.1, 113.7, 189.9, 202.3],
      files: { narrow: "madrid-scene-14.2be0b119.avif", wide: "madrid-scene-20.0b65b82a.avif" },
    },
    subject: {
      box: [139.3, 125.2, 201.3, 190.8],
      files: { narrow: "madrid-subject-14.7d68c9c3.avif", wide: "madrid-subject-20.de6d7112.avif" },
    },
  },
};
