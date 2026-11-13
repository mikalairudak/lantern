# Fonts

Lantern's one face is Literata, regular and italic (`docs/decisions.md`, "One serif in one weight: Literata"). This folder holds it twice: as the pages load it, and as the link card draws it.

- **Source:** the variable files `ofl/literata/Literata[opsz,wght].ttf` and `Literata-Italic[opsz,wght].ttf` in https://github.com/google/fonts, and the static files `fonts/ttf/Literata36pt-Regular.ttf` and `Literata72pt-Italic.ttf` in Literata's own repository, https://github.com/googlefonts/literata, both 2026-11-13.
- **Licence:** SIL Open Font License 1.1, Copyright 2017 The Literata Project Authors, in `OFL.txt` beside them, which the licence asks to travel with the fonts. It reserves no font name.
- **Tool:** fonttools 4.68.0, with brotli for WOFF2.

## The pages' face

`src/app/root-document.ts` serves `Literata-Regular.woff2` and `Literata-Italic.woff2` through `next/font/local`, from the site itself. Each is the variable file held at weight 400 with its optical size axis (7 to 72) kept, so the browser picks the cut for each size, and cut to the Latin, Latin Extended and Cyrillic ranges Google Fonts serves, with the arrows ← ↑ → ↓ the page draws, in one file a style: 86.7 and 88.8 KB, against about 530 KB for the two styles with every weight.

```sh
fonttools varLib.instancer 'Literata[opsz,wght].ttf' wght=400 -o Literata-Regular.opsz.ttf
pyftsubset Literata-Regular.opsz.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD,U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF,U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" \
  --layout-features+=tnum,lnum --name-IDs='*' --no-hinting \
  --drop-tables+=DSIG,vhea,vmtx,VVAR --flavor=woff2 --output-file=Literata-Regular.woff2
```

The italic is made the same way from `Literata-Italic[opsz,wght].ttf`. The features kept are the subsetter's defaults with tabular figures added, which the plan's times use, and every name is kept, the licence's text and address (name IDs 13 and 14) among them, so the licence travels inside each file too.

## The vertical metrics

Every file here, the pages' two and the card's two, carries an ascent of 950 units and a descent of −250, with no line gap, where the font as drawn carries 1177 and −308: the scale's leadings are tight, and a descender must not hang out of a row that clips. With the drawn values the baseline sits about a tenth of an em low in its line box, and at the title's leading a descender passes its line by 3.5 to 4 px. At 950 and −250 the face stands in the middle of its line box, and the box holds the descenders of g, j, p, q and y (−216 to −230 units) and the accented capitals a day's words use most, Á, É and Ś and the Cyrillic Yo and Yi (U+0401, U+0407) among them (913 to 935). A few letters pass it: Å by 17 units and the Cyrillic Short I (U+0419) by 9, the letters with a comma below (ș, ț, ķ, ļ, ņ, ŗ, Ģ) by 12 to 24, and the capitals with two marks over them, such as Ǚ and Ḗ, by up to 179; a box that hides what overflows it gives such a line room of its own, as the start screen's field does. The numbers are in `hhea` and in `OS/2`'s typographic metrics, with `USE_TYPO_METRICS` set, so an engine that reads either table places a line alike; `OS/2`'s Windows ascent and descent keep the drawn 1177 and 308, which cover every glyph at every optical size. The optical size axis varies no ascent or descent, so the one pair holds at every size. `next/font` derives the fallback's sizing from these files.

```sh
python -c '
import sys
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
font["hhea"].ascent, font["hhea"].descent, font["hhea"].lineGap = 950, -250, 0
os2 = font["OS/2"]
os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = 950, -250, 0
os2.fsSelection |= 1 << 7
font.save(sys.argv[1])
' Literata-Regular.woff2
```

Each of the four files is rewritten the same way, after it is cut.

## The link card's face

`src/app/opengraph-image.tsx` draws the card every link to Lantern shows, at build time, with Satori, which reads only TTF, OTF or WOFF, has no optical sizing, and none of the WOFF2 files the pages load. So the card takes Literata's static cuts drawn for its sizes, the 72 pt italic for the name and the 36 pt roman for the line, cut to Latin, from about 300 KB each to 23.1 and 24.0 KB, since the card says only the name and the site's line, with the same ascent and descent set, so the name stands where the card's layout places it:

```sh
pyftsubset Literata36pt-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+2013-2014,U+2018-201D,U+2026" \
  --layout-features='kern,liga' --name-IDs='*' --no-hinting --drop-tables+=DSIG \
  --output-file=Literata36pt-Regular.latin.ttf
```

The italic is cut the same way from `Literata72pt-Italic.ttf`. A card that says a letter outside this set needs the fonts cut again with it.
