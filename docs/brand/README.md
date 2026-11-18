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

The lamp stands 3.6:1 on the day ground (`#f8ebd7`) and 10.3:1 on the night (`#011d27`). In the product the two steps are the tokens: by day lamplight, `#ffdaa3`, and its haze, `#ffe5be`, 1.13:1 and 1.04:1 under the page, with the lamp 3.15:1 on the glow; by night the ember and its haze. The standalone files keep a lighter pair by day, `#ffe2b3` and `#fff1d0`: the same lamplight for a browser's white bar, where it stands 1.25:1 and 1.12:1 from the ground. At 16 px the two pairs are 3 and 5 ΔE2000 apart and read as one mark. Inline, that is `stroke-ink` on the wire, `fill-lamp` on the bead, and `fill-lamp-glow` and `fill-lamp-haze` on the two steps of light.

## Beside the wordmark

The wordmark is the word itself, "Lantern", set as the masthead sets it: Literata italic, regular, at the body's size (`text-body`, 15 px). The mark stands before it in ems of the word (`LanternMark`'s `isSetInEms`), 1.75 em tall, about 26 px, with its gap of about 6 px after it, and the bead's centre on the middle of the word's x-height: aligned to the word's baseline, then sunk 0.62 em, about 9 px. Keep clear space of the bead's width around the pair.

## The sign of work

While Lantern works, it shows a second drawing of a lantern, not the mark: a paper lantern on the mark's wire, cut in one stroke of the pen, lit from its wick and put out (`SignOfWork`, `src/components/ui/sign-of-work.tsx`; `docs/design-direction.md`, "A pen and its lantern, not a spinner"). It is drawn inline on the 24 grid, at 24 px, in the mark's tokens and the ground's: `ink`, `lamp`, `lamp-glow`, `lamp-haze` and `ground`.

- **The lantern** is an ellipse 10.5 × 11.5 at (12, 12), its outline 1.25 in `ink`, and the wire ends at x 4.5 and 19.5: `M1 10.5 Q2.75 10.98 4.5 11.3` and `M19.5 11.3 Q21.25 10.98 23 10.5`, stroke 1.5, round caps.
- **The ribs** are four, at y 8.4, 10.8, 13.2 and 15.6, each a quadratic whose control stands 0.55 below its ends, cut as one stroke of 1 in `ink`, round caps and joins: each rib in turn, left to right and back, joined by the arc of the outline between their ends, under the outline's own ink. `M7.906 8.4 Q12 8.95 16.094 8.4 A5.25 5.75 0 0 1 17.134 10.8 Q12 11.35 6.866 10.8 A5.25 5.75 0 0 0 6.866 13.2 Q12 13.75 17.134 13.2 A5.25 5.75 0 0 1 16.094 15.6 Q12 16.15 7.906 15.6`, 44.7 units long, a rib ending at 0.184, 0.473, 0.757 and 1 of it.
- **Lit,** the ellipse is `lamp`, and the same stroke is drawn over it in `ground`, stroke 0.9, cut by the ellipse's shape; each rib runs on a unit past the edge and turns outside it: `M6.906 8.249 Q12 9.101 17.094 8.249 L18.134 10.682 Q12 11.468 5.866 10.682 L5.866 13.082 Q12 13.868 18.134 13.082 L17.094 15.449 Q12 16.301 6.906 15.449`. Over lit paper a rib is never `ink`: ink lines over the lamp read as a dark disc by day.
- **The wick** is the lit paper at a quarter of its size; there is no other.
- **The light** is two flat steps round the middle, as the mark's: the glow at r 8.2 and the haze at r 10.8, inside the box, over the outline and under the wire. As the glow passes the outline it covers it, so the lit lantern has no ink round it.
- **Bottom to top:** the outline, the pen's stroke, the haze, the glow, the wire, the lit paper.

**Its loop** is 3.6 s, three passes of the steady light (`--animate-sign-*` in `src/app/globals.css`): the pen cuts the ribs at one pace to 1.44 s; the wick grows as it ends its last rib; the paper swells to its whole size from 1.66 to 2.27 s, on the gentle spring's path, and the ribs come through it in the ground's colour to 2.81 s; glow and haze grow out from under it; it rests, lit whole, to 2.95 s; the light falls back to its wick in half its coming's time, the outline there again, and the wick goes out at 3.58 s as the pen sets off. Nothing fades in place: a line grows along its path, and a light grows from its source and falls back to it. Under reduced motion no loop runs and the sign keeps a tally with the same drawing: the outline alone, a rib for each count, ribs and wick, and the lantern lit whole.

The mark's "Don't" below stands for the mark: the sign is its own drawing, with its outline, and never stands in the mark's place.

## Don't

- Add rays, a flame, a handle, sparkle or any outline: a burst of amber rays would read as Claude's mark.
- Recolour it, add a colour beyond ink and the lamp's light, a gradient, a blur or a shadow.
- Use the master below 20 px or the 16 drawing above 19 px.
- Set it on a photograph, or on any ground but Lantern's two.
