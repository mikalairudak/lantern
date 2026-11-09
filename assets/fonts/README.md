# Fonts for the link card

`src/app/opengraph-image.tsx` draws the card every link to Lantern shows, at build time, with Satori, which reads only TTF, OTF or WOFF and none of the WOFF2 files `next/font` serves the pages. These are the product's face, Fira Sans, regular and italic, as a file of their own.

- **Source:** `ofl/firasans/FiraSans-Regular.ttf` and `FiraSans-Italic.ttf` in https://github.com/google/fonts, 2026-11-02.
- **Licence:** SIL Open Font License 1.1, in `OFL.txt` beside them, which the licence asks to travel with the fonts.
- **Cut to Latin** with fonttools 4.68.0, from about 460 KB each to about 20 KB, since the card says only the name and the site's line:

```sh
pyftsubset FiraSans-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+2013-2014,U+2018-201D,U+2026" \
  --layout-features='kern,liga' --no-hinting --drop-tables+=DSIG \
  --output-file=FiraSans-Regular.latin.ttf
```

The italic is cut the same way. A card that says a letter outside this set needs the fonts cut again with it.
