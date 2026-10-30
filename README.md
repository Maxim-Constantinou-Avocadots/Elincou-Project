# Elincou Design System

A living design-system website for **Elincou Diagnostics**, built from the
Elincou Brand Guidelines v1.0 (Avocadots Design Studio, 2026).

**Design direction:** sharp-edged editorial. No rounded corners anywhere
(`--el-radius-*: 0`), flat surfaces with hairline rules instead of shadows,
oversized display type, numbered sections, mono-spaced meta labels.

## Run it

Open `index.html` directly in a browser, or serve the folder:

```
python -m http.server 4173
```

then visit http://localhost:4173.

## Structure

| File | Purpose |
|---|---|
| `index.html` | The design-system site — foundation, logo, colour, typography, voice, tokens, components |
| `css/tokens.css` | All design tokens as CSS custom properties (colour, type, spacing, radii, elevation, motion) |
| `css/styles.css` | Site chrome + the reusable component library (`.el-btn`, `.el-tag`, `.el-input`, `.el-alert`, `.el-table`, …) |
| `js/main.js` | Palette rendering, copy-to-clipboard, scroll-spy navigation |

## Using the system in a product

1. Load Gothic A1 (weights 300 / 400 / 600) from Google Fonts.
2. Import `css/tokens.css` and build with the `--el-*` variables — never hard-code brand values.
3. Reuse the component classes from `css/styles.css` or port them to your framework.

## Brand quick reference

- **Primary palette:** White `#FFFFFF` · Ghost White `#F4F4F9` · Alabaster Grey `#E8E7E4` · Grey Olive `#999999` · Onyx `#0E0E0E`
- **Extended palette:** Crayola Blue `#3777FF` · Emerald `#57BB78` · Mustard `#FFE156`
- **Typeface:** Gothic A1 — Light (body), Regular (headings), SemiBold (emphasis/UI)
- **Logo:** never below 20px height; clear space = symbol height; black or white only outside the palette
- **Promise:** *Advancing diagnostics together.*

## Product portfolio

Open `products.html` over HTTP to explore the 34-product XML snapshot. Features include category and installation filters, search, sorting, URL-persisted filtering, product detail dialogs and a comparison of two or three instruments. Data provenance and the Wix CMS handoff are documented in `data/README.md`.
