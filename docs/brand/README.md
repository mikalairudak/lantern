# Lantern's mark

A lit bead on a wire: a lantern strung over a street, drawn in the chart's own language. Chosen on 2026-10-27 (`docs/design-direction.md`, "The mark"), in the version called "stepped light".

## Files

| File                     | What it is                                               | Use it                                                                      |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `lantern-mark-16.svg`    | The small drawing, on a 16 grid, stroke 1                | 16 to 19 px: the favicon (`src/app/icon.svg`)                               |
| `lantern-mark.svg`       | The master, on the app's 24 icon grid, stroke 1.5        | 20 to 63 px: the header, beside the wordmark                                |
| `lantern-mark-large.svg` | The master with the wire thinned to 1, so the bead leads | 64 px and up                                                                |
| `lantern-apple-icon.svg` | The large drawing on the dark ground, 180 × 180          | The source of the home-screen icon                                          |
| `lantern-apple-icon.png` | That tile rendered at 180 px                             | `src/app/apple-icon.png`; iOS rounds its corners itself, so it stays square |

`src/app/favicon.ico` is drawn from these by `scripts/favicon.mts`: the 16 drawing at 16 px and the master at 32 and 48, each on a square tile of the night's ground, corners square, as the home-screen icon is. An ICO cannot follow a theme, and what asks for `/favicon.ico` by name (an older Safari, a bookmark, a crawler's results page) sets it on a light or a dark bar, where the mark without its ground loses its wire; a browser that reads `icon.svg` takes that, in the visitor's theme. Run `node scripts/favicon.mts` when a drawing changes.

Each SVG but the tile carries both themes: a `prefers-color-scheme: dark` rule swaps its ink and its light, so a browser tab draws it in the browser's own theme. Inside the app, draw the mark inline instead, so its colours come from the tokens and follow `data-theme` as everything else does (below).

## Geometry

On the 24 grid, every value a multiple of a quarter unit or set by the wire's curve:

- **The wire** is a quadratic sag from (1, 10.5) to (23, 10.5), lowest at the bead, (12, 12), and level there. It stops one stroke short of the bead on each side, as the chart's shown bead does with its ground halo, so the bead reads in front of its wire: `M1 10.5 Q3.75 11.25 6.5 11.63` and `M17.5 11.63 Q20.25 11.25 23 10.5`. Stroke 1.5 (`ICON_STROKE_WIDTH`), round caps. The large drawing ends it half a unit nearer the bead, for its thinner stroke: `M1 10.5 Q4 11.32 7 11.69`, `M17 11.69 Q20 11.32 23 10.5`, stroke 1.
- **The bead** is an ellipse 6.5 × 7 at (12, 12): 8% taller than wide, a paper lantern's proportion. A circle this small reads as a dot.
- **The light** is two flat steps, drawn under the wire and the bead: the glow at r 5.75 and the haze at r 8. It is round, not cast downward: on the light ground a downward light reads as a shadow.
- **The 16 drawing** is its own, not the master shrunk: a sag of 1 from (0.5, 7) to the bead at (8, 8), stroke 1, a bead 4.5 × 4.9, the glow at r 4.5 and the haze at r 6.5.

## Colour

Ink and light, all tokens in the product (palette Night market, `docs/decisions.md`, "Tokens are enforced, not documented"): the wire is `ink`; the bead is `lamp`, the token that draws light everywhere in Lantern; its two steps are `lamp-glow` and `lamp-haze`, the lamp's light at two strengths: lamplight and its haze by day, an ember and its haze by night. The steps are solid, not the lamp at 20% and 10%: over a ground of another hue an alpha step mixes towards grey.

| Token       | Light, in the product | Light, in the drawings | Dark      |
| ----------- | --------------------- | ---------------------- | --------- |
| `ink`       | `#001924`             | `#001924`              | `#f7eddf` |
| `lamp`      | `#bb660a`             | `#bb660a`              | `#ffba4d` |
| `lamp-glow` | `#ffdaa3`             | `#ffe2b3`              | `#543109` |
| `lamp-haze` | `#ffe5be`             | `#fff1d0`              | `#3b220e` |

The lamp stands 3.6:1 on the day ground (`#f8ebd7`) and 10.3:1 on the night (`#011d27`). In the product the two steps are the tokens: by day lamplight, `#ffdaa3`, and its haze, `#ffe5be`, 1.13:1 and 1.04:1 under the page, with the lamp 3.2:1 on the glow; by night the ember and its haze. The standalone files keep a lighter pair by day, `#ffe2b3` and `#fff1d0`: the same lamplight for a browser's white bar, where it stands 1.25:1 and 1.12:1 from the ground. At 16 px the two pairs are 3 and 5 ΔE2000 apart and read as one mark. Inline, that is `stroke-ink` on the wire, `fill-lamp` on the bead, and `fill-lamp-glow` and `fill-lamp-haze` on the two steps of light.

## Beside the wordmark

The wordmark is the word itself, "Lantern", set as the masthead sets it: Literata italic, regular, at the body's size (`text-body`, 15 px). The mark stands before it in ems of the word (`LanternMark`'s `isSetInEms`), 1.75 em tall, about 26 px, with its gap of about 6 px after it, and the bead's centre on the middle of the word's x-height: aligned to the word's baseline, then sunk 0.62 em, about 9 px. Keep clear space of the bead's width around the pair.

## Don't

- Add rays, a flame, a handle, sparkle or any outline: a burst of amber rays would read as Claude's mark.
- Recolour it, add a colour beyond ink and the lamp's light, a gradient, a blur or a shadow.
- Use the master below 20 px or the 16 drawing above 19 px.
- Set it on a photograph, or on any ground but Lantern's two.
