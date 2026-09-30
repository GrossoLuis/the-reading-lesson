# The Reading Lesson — design tokens

Everything here comes from `The-Reading-Lesson-Brand-Guidelines.pdf` and
`the-reading-lesson-styleboard.pdf`. Build sections on these tokens rather than on hex
values, so a change in theme settings reaches every section at once.

- Tokens are published by `snippets/brand-tokens.liquid`, rendered from
  `layout/theme.liquid` and `layout/password.liquid` after `color-palette`.
- The colours are editable in the theme editor under **Brand · design system**.

## Switches

| Setting | Default | What it does |
| --- | --- | --- |
| `brand_fonts_enabled` | on | Serves the self-hosted Besley, Public Sans and Andika and overrides the four font slots. Off falls back to the fonts picked under Typography. |
| `brand_type_scale_enabled` | on | Applies the guideline sizes, line heights and letter spacing, including the mobile hero (40px) and display (32px). |
| `brand_purchase_accent` | on | Turns Add to cart, buy buttons, quick add and checkout tomato. Every other primary button stays ink. |

## Colour

Ink does most of the work: text, main buttons, announcement bar. Tomato means purchase.
Ink text on sun, sky and leaf; white text on tomato, grape and ink.

| Token | Value | |
| --- | --- | --- |
| `--color-ink` | `#1D2340` | text, main buttons |
| `--color-ink-muted` | `#5B5F74` | secondary text |
| `--color-paper` | `#FAF6EF` | page background |
| `--color-paper-deep` | `#F2EADC` | alternating sections |
| `--color-card` | `#FFFFFF` | cards |
| `--color-line` | `#E5DCCD` | hairlines |
| `--color-line-strong` | `#8A8373` | |
| `--color-rule` | `#DDD2BF` | notebook lines, dividers |
| `--color-tomato` · `-soft` · `-deep` | `#C2412D` `#F8E4DC` `#A3321F` | purchase |
| `--color-sun` · `-soft` · `-deep` | `#E9B949` `#F8ECD0` `#7D5A0B` | |
| `--color-sky` · `-soft` · `-deep` | `#8FBCDB` `#E3EEF6` `#2F6690` | |
| `--color-grape` · `-soft` | `#5A4A8C` `#E9E4F2` | |
| `--color-leaf` · `-soft` · `-deep` | `#86AD90` `#E4EFE6` `#3C6B4A` | |
| `--color-on-tomato` · `--color-on-grape` | `#FFFFFF` | |
| `--color-link` | `#5A4A8C` | |

Every colour also has a `-rgb` triplet where it is needed for `rgb(… / alpha)`:
`--color-ink-rgb`, `--color-paper-rgb`, `--color-card-rgb`, `--color-line-rgb`,
`--color-tomato-rgb`, `--color-sun-rgb`, `--color-sky-rgb`, `--color-grape-rgb`,
`--color-leaf-rgb`, `--color-on-tomato-rgb`, `--color-on-grape-rgb`, `--color-link-rgb`.

### Learning path

Each step keeps its colour: sky for reading, sun for writing, leaf for math.

`--color-path-reading` · `--color-path-writing` · `--color-path-math`, each with a
`-soft` and a `-deep` variant.

### Age codes

`--color-age-0-2` sun · `--color-age-3-5` sky · `--color-age-6-8` leaf ·
`--color-age-9-12` grape, each paired with `--color-on-age-*` for the label.

### Surfaces

Put one class on a section or block and the background, text and border trio the theme
reads everywhere is swapped, contrast opacities included:

`.surface-paper` · `.surface-paper-deep` · `.surface-card` · `.surface-ink` ·
`.surface-tomato` · `.surface-grape` · `.surface-tomato-soft` · `.surface-sun-soft` ·
`.surface-sky-soft` · `.surface-grape-soft` · `.surface-leaf-soft`

The tint surfaces also expose `--color-surface-accent`, the matching deep tone for
coloured text on that tint.

## Typography

Besley to tell, Public Sans to guide, Andika only for what a child would read. The
italic marks the heartfelt word — wrap it in `.text-accent`.

The four theme slots map to: body → Public Sans 400, subheading → Public Sans 600,
heading → Besley 600, accent → Besley 600 italic.

### Heading presets

The theme has six heading presets, so the guideline roles sit one step down from h3:

| Preset | Role | Desktop → mobile |
| --- | --- | --- |
| `h1` | hero | 68 → 40px |
| `h2` | display | 46 → 32px |
| `h3` | h1 | 36 → 28px |
| `h4` | h2 | 28 → 24px |
| `h5` | h3 | 20px |
| `h6` | eyebrow | 12px, spaced caps |
| `paragraph` | body | 16px |

### Roles with no preset

Each has a `--font-<role>--family` / `--style` / `--weight` / `--size` /
`--line-height` / `--letter-spacing` set, and a matching class:

| Class | Role |
| --- | --- |
| `.text-hero` | Besley 600 · 68px |
| `.text-display` | Besley 600 · 46px |
| `.text-note` | Besley 400 · 21px |
| `.text-price` | Besley 600 · 20px |
| `.text-lead` | Public Sans 400 · 19px |
| `.text-small` | Public Sans 400 · 13.5px |
| `.text-eyebrow` | Public Sans 700 · 12px, spaced caps |
| `.text-reading` | Andika 400 · 24px |
| `.text-accent` | Besley 600 italic, for the heartfelt word |

Buttons are Public Sans 600 · 15px in sentence case (`--font-button--*`).

## Spacing, shape and shadow

```
--space-1  4px     --radius-sm    6px      --stroke-sm  1px
--space-2  8px     --radius-md   12px      --stroke-md  1.5px
--space-3 12px     --radius-lg   20px      --stroke-lg  10px  (colour bars)
--space-4 16px     --radius-xl   32px
--space-5 24px     --radius-full 9999px
--space-6 32px
--space-7 48px     --shadow-sm  --shadow-md  --shadow-lg  --shadow-book
--space-8 72px
--space-9 112px    --focus-ring  2px grape, 3px offset
```

`--colour-bar-thickness` and `--notebook-line-gap` are there for the signature elements:
the syllable headline, the colour-bar hero frame and the notebook-line divider.

## Notes

- The font files in `assets/brand-*.woff2` are the latin subsets from Google Fonts
  (open licence). Besley and Public Sans are variable faces covering weights 400–700.
- With `brand_fonts_enabled` on, the four font pickers under Typography are ignored, and
  the theme no longer downloads the fonts they name. They are left on Inter as a valid
  fallback. If Besley and Public Sans appear in your store's font picker, you can select
  them there and turn the switch off.
- The logo in both PDFs is a stand-in. Replace it with the official wordmark files when
  they arrive: clear space equal to the height of the "T", minimum width 120px on screen.
- Shadow blur and spread are derived from the styleboard, which ships them as raster
  previews rather than values; they are ink-tinted, never grey.
