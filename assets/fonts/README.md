# Fonts

Lantern's one face is Literata, regular and italic (`docs/decisions.md`, "One serif in one weight: Literata"). This folder holds it twice: as the pages load it, and as the link card draws it.

- **Source:** the variable files `ofl/literata/Literata[opsz,wght].ttf` and `Literata-Italic[opsz,wght].ttf` in https://github.com/google/fonts, and the static files `fonts/ttf/Literata36pt-Regular.ttf` and `Literata72pt-Italic.ttf` in Literata's own repository, https://github.com/googlefonts/literata, both 2026-11-13.
- **Licence:** SIL Open Font License 1.1, Copyright 2017 The Literata Project Authors, in `OFL.txt` beside them, which the licence asks to travel with the fonts. It reserves no font name.
- **Tool:** fonttools 4.68.0, with brotli for WOFF2.

## The pages' face

`src/app/root-document.ts` serves `Literata-Regular.woff2` and `Literata-Italic.woff2` through `next/font/local`, from the site itself. Each is the variable file held at weight 400 with its optical size axis (7 to 72) kept, so the browser picks the cut for each size, and cut to the Latin, Latin Extended and Cyrillic ranges Google Fonts serves, in one file a style: about 87 KB each, against about 530 KB for the two styles with every weight.

```sh
fonttools varLib.instancer 'Literata[opsz,wght].ttf' wght=400 -o Literata-Regular.opsz.ttf
pyftsubset Literata-Regular.opsz.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF,U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" \
  --layout-features+=tnum,lnum --no-hinting --drop-tables+=DSIG,vhea,vmtx,VVAR \
  --flavor=woff2 --output-file=Literata-Regular.woff2
```

The italic is made the same way from `Literata-Italic[opsz,wght].ttf`. The features kept are the subsetter's defaults with tabular figures added, which the plan's times use.

## The link card's face

`src/app/opengraph-image.tsx` draws the card every link to Lantern shows, at build time, with Satori, which reads only TTF, OTF or WOFF, has no optical sizing, and none of the WOFF2 files the pages load. So the card takes Literata's static cuts drawn for its sizes, the 72 pt italic for the name and the 36 pt roman for the line, cut to Latin, from about 300 KB each to about 23 KB, since the card says only the name and the site's line:

```sh
pyftsubset Literata36pt-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+2013-2014,U+2018-201D,U+2026" \
  --layout-features='kern,liga' --no-hinting --drop-tables+=DSIG \
  --output-file=Literata36pt-Regular.latin.ttf
```

The italic is cut the same way from `Literata72pt-Italic.ttf`. A card that says a letter outside this set needs the fonts cut again with it.
