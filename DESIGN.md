# OPUS GROUP — Design Plan

Read this before the component code in `src/`. It fixes the vocabulary the
rest of the app is built from: tokens, type scale, the landing/editor
wireframe, and the one moment the product should be remembered by.

## 1. Color tokens

Two colors carry the brand. Everything else is opacity and weight.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#000000` | Page background, canvas background |
| `--cream` | `#E4D2AC` | Primary text, line work, default icon/stroke color |
| `--cream-bright` | `#F4E4C2` | Hover, active, focus, selected state, price figures |
| `--cream-dim` | `#8A7F6A` | Secondary text, captions, placeholders, disabled controls |
| `--line` | `#2A2620` | Hairline borders, dividers, input outlines at rest |
| `--surface` | `#0D0C0A` | Cards, panels, the editor side rail, raised sheets |

Semantic exceptions (muted, desaturated, sparing):

| Token | Value | Use |
|---|---|---|
| `--success` | `#7FA37A` | Paid confirmation, in-stock, quote accepted |
| `--error` | `#B4685C` | Form errors, upload rejected |
| `--warning` | `#C2A05A` | Low stock, "требует уточнения" |

No third hue anywhere else. Emphasis is `--cream-bright` + weight, never a
new color. Implemented as CSS custom properties on `:root` in
`globals.css` and mirrored into Tailwind's `@theme` block so both
`bg-bg`/`text-cream` utilities and raw `var(--cream)` work.

## 2. Type scale

```
Display   Unbounded 800   clamp(2.5rem, 5vw, 4.5rem)   leading 1.05   tracking -0.02em
H1        Unbounded 800   clamp(2rem, 3.2vw, 3rem)     leading 1.08   tracking -0.02em
H2        Unbounded 500   clamp(1.5rem, 2.2vw, 2.25rem) leading 1.12  tracking -0.01em
H3        Unbounded 500   1.375rem (22px)              leading 1.15   tracking -0.01em
Body L    Manrope 400     1.125rem (18px)               leading 1.6
Body      Manrope 400     1rem (16px)                    leading 1.6
Body S    Manrope 500     0.875rem (14px)                leading 1.5
Caption   Manrope 500     0.75rem (12px)  uppercase, tracking 0.06em
UI/Button Manrope 700     0.9375rem (15px)               leading 1
Price     Manrope 700     1.25–2rem tabular-nums
```

Rules encoded as Tailwind utility classes (`text-display`, `text-h1` …):
- Unbounded never below 20px (enforced — smallest Unbounded step is H3 at 22px).
- Headings capped conceptually at 5–6 Russian words; longer explanatory
  copy always drops to a Manrope subheading (`text-body-l text-cream-dim`).
- Body measure capped at `65ch` via a `.prose-measure` utility.

## 3. Layout wireframe

**Landing**
```
┌─────────────────────────────────────────────┐
│ nav: logo · Как это работает · Тарифы · Услуги │  hairline bottom, sticky
├─────────────────────────────────────────────┤
│ HERO — full-bleed black                      │
│   left: H1 + subhead + CTA                   │
│   right: PhotoToModelReveal (signature elmt) │
├─────────────────────────────────────────────┤
│ 4-step flow — 4 cols → stack on mobile        │
│   Загрузите · Сгенерируйте · Настройте · Стройте │
├─────────────────────────────────────────────┤
│ Freemium comparison — 2 cards side by side    │
│   Бесплатно (Duplo)  |  Подписка 700₽ (Technic)│
├─────────────────────────────────────────────┤
│ Social proof — logo/quote placeholders        │
├─────────────────────────────────────────────┤
│ Footer — hairline top, 3 cols + legal line    │
└─────────────────────────────────────────────┘
```

**Editor**
```
┌───────────────────────────────────────────────────────────┐
│ top bar: back · house name · [Бесплатно/Подписка] pill · price │
├───────────────────────────────────┬─────────────────────────┤
│                                     │ right rail (scrolls)     │
│   3D CANVAS (dominant, ~65% width) │ ── Материалы              │
│   drag-orbit, hairline grid floor  │   swatch grid, locked     │
│   floating toolbar bottom-center:  │   swatches show a lock +  │
│   [Крыша][Фасад][Забор][Цвет]      │   "Технic" tag             │
│                                     │ ── Смета (live price)     │
│                                     │   line items, running total│
│                                     │ ── educational card        │
│                                     │   surfaces on selection,   │
│                                     │   dismissible, not modal   │
├───────────────────────────────────┴─────────────────────────┤
│ mobile (<768px): canvas full width, view+color only,          │
│ rail collapses to a bottom sheet drawer                        │
└───────────────────────────────────────────────────────────┘
```

Cart, Services, and Education hub follow the same shell (sticky nav,
hairline-divided sections, `--surface` cards on `--bg`) — documented
inline in each page's component, not repeated here.

## 4. The signature element

**`PhotoToModelReveal`** — the hero is a looping, `prefers-reduced-motion`-safe
sequence, not a photo of a house with type over it: four photo thumbnails
(front/back/left/right of a house) slide into a stack, a hairline
wireframe grid sweeps across them left-to-right, and the stack resolves
into a rotating cream-line 3D wireframe house — the same wireframe
language as the logo's shipping container. It's the product's entire
thesis (photos → model) compressed into four seconds, and it's the only
orchestrated motion moment in the app; every other transition is a plain
150–200ms fade/translate. Built with CSS transforms + `@react-three/fiber`
for the final wireframe rotation, gated behind a reduced-motion check that
swaps it for a static three-frame illustration.

## 5. The house model

The demo house is 9.5 × 8.2 m. `widthM`/`depthM` are the **outer** dimensions:
walls sit inside them, so the geometry measures what the estimate prices.

**Storeys.** Only 1, 2 or 3 — private houses are built in whole storeys, and
a free-form height slider invites nonsense. Wall height is always
`floors × FLOOR_HEIGHT_M` (3 m). Window rows are generated per storey and
line up vertically; the camera re-frames on height change so a three-storey
house isn't cut off.

**Styles** (`src/lib/3d/styles.ts`) are not skins. Each sets the roof form
and pitch, the starting material and colour of every surface, window
proportions, and which details the house carries:

| Style | Roof | Facade | Signature |
|---|---|---|---|
| Европейский | Вальмовая 35° | Кирпич | Ставни, карнизы |
| Скандинавский | Двускатная 42° | Планкен | Высокие окна |
| Хай-тек | Плоская | HPL-панели | Панорамный первый этаж |
| Классический | Двускатная 30° | Штукатурка | Рустованные углы |

Changing style replaces materials and colours (that *is* the choice);
changing storeys keeps the user's material picks. Both rebuild the model
through `Model3DProvider.reconfigure`, since they change the building rather
than its finishes.

High-tech's palette is graphite, not black: the canvas background is `#000`,
and a near-black facade on it reads as a silhouette rather than a building.
The scene lighting carries a hemisphere plus a rim light for the same reason.

**Details** (`HouseDetails.tsx`) are what make it read as built rather than
massed: eaves fascia and rake boards, ridge cap, gutters with downpipes
elbowed back to the wall, chimney, plinth band, entrance porch with steps and
canopy, shutters, string courses, and rusticated quoins. Quoins are a pair of
shallow plates wrapping each corner — a single block centred on the corner
reads as a tab bolted to the outside.

**The roof always overhangs the walls.** `MIN_ROOF_OVERHANG_M = 1` metre on
every side, so the roof footprint is 11.5 × 10.2 m. A facade that projects
past its eaves is the fastest way for the model to read as fake to anyone
who has built a house, and real eaves exist to throw rainwater clear of the
wall. Four roof forms are built from this rule in
`src/lib/3d/roof-geometry.ts`:

| Form | Notes |
|---|---|
| Двускатная (gable) | Ridge along the long axis; end walls close the ends |
| Вальмовая (hip) | Ridge inset by the short half-span, so hips run at 45° |
| Мансардная (mansard) | Steep lower pitch breaking to a shallow upper one |
| Плоская (flat) | Slab with the same overhang |

Ridged roofs are **open shells**, not solid prisms — a solid would occupy
the same space as the gable wall and the two would z-fight along every
slope. The gable wall is built from the roof's own underside curve
(`roofUndersideAt`) so it meets the roof exactly, held 5 cm clear to avoid
coplanar flicker. It cannot use the wall's own pitch: the roof starts
sloping out at the overhanging eaves, so by the time it crosses the wall it
is already higher.

Areas are derived from this geometry in `src/lib/3d/metrics.ts` and feed the
estimate directly, so changing the roof form changes the price
(gable/hip 138.3 m², mansard 172.9 m², flat 117.3 m²). Every plane of a
pitched roof sits at the same angle, so the surface is the footprint over
the cosine of the pitch — exact for gable and hip alike.

**Openings.** Nine windows and a front door, positioned in metres on named
facades (`Opening[]`). Window areas are deducted from the facade quantities,
so the estimate never charges for cladding behind glass.

**Textures** are drawn procedurally onto a canvas
(`src/lib/3d/textures.ts`) rather than shipped as images: every pattern has
to re-tint whenever the user picks a colour, and a bitmap per
colour-per-material would be hundreds of assets. Colour and texture compose
freely, and each pattern declares the real-world size of one tile so brick
courses stay brick-sized on a 9 m wall and on a 2 m one.

**Tier split** follows the brief: colour and roof form are free (Duplo);
exact pitch, and the premium brick/tile/facade materials, are Technic.

## 6. Implementation notes

- Fonts: Unbounded 500/800 and Manrope 400/500/700, Cyrillic + Latin
  subsets, self-hosted as `.woff2` under `public/fonts/`, declared in
  `src/app/fonts.css` with `font-display: swap`. No Google Fonts CDN link.
- 3D: `@react-three/fiber` + `@react-three/drei`, driven by a
  `Model3DProvider` interface (`src/lib/3d/provider.ts`) so the mock
  (`src/lib/3d/mock-provider.ts`) and the future Neural4D adapter are
  interchangeable behind one factory (`src/lib/3d/index.ts`).
- State: `zustand` store for the editor/cart (`src/lib/store.ts`) so price
  and BOM stay in sync as materials are swapped.

## 7. Material and depth

Nothing in the palette changes here — this is about how the two colours are
lit. A flat `#000` ground makes every panel read as a sticker on a void, and
solid hairlines turn into visible bars wherever the ground behind them moves.

- **Ground.** The page is a radial lifting toward `--surface` at the top,
  fixed to the viewport rather than the scroll, so the layout has one light
  source. Panels use `.surface-1` / `.surface-2` / `.surface-3`, each a small
  radial of its own.
- **Elevation.** Three stacked shadows per level — a contact shadow, a body
  shadow, a wide ambient one — plus an inset cream hairline along the top
  edge. On black the hairline is what actually reads as "lifted"; the drop
  shadows alone are invisible. `--shadow-1/2/3`, with `.card-lift` for
  surfaces that answer to the pointer.
- **Hairlines.** `--line` is `rgba(228,210,172,0.1)` and `--line-strong` is
  the same at `0.2`, never a solid line colour.
- **Grain.** 4% static monochrome noise over the whole viewport in `overlay`
  (`.grain`, mounted once in the root layout). It hides the banding those
  gradients would otherwise show on a dark screen. Static, not animated: an
  animated grain repaints the viewport every frame for an effect nobody
  consciously sees.
- **Motion.** One curve for the whole product: `--ease:
  cubic-bezier(0.16,1,0.3,1)`, wired into Tailwind's
  `--default-transition-timing-function` so every `transition-*` inherits it.
  Groups arrive staggered by `--stagger` (50 ms) via `<Reveal index>`, which
  toggles a class from an IntersectionObserver — with a `<noscript>` rule that
  cancels the hidden start state.
- **Photography.** Material samples are rendered offline by
  `tools/generate-material-photos.mjs` (painters in
  `tools/material-photo-painters.js`), one per product, at 2× and downsampled
  with Lanczos, shipped as WebP with a JPEG fallback at both densities. These
  are *photographs* — lit from one side, in focus at the top and falling off
  at the bottom, with surface tooth — not the seamless tiles in
  `src/lib/3d/textures.ts`, which exist to repeat across a 3D surface at any
  colour.

## 8. The materials market

`/market` is the shop next to the configurator; `/market/[id]` is one
product, prerendered from `src/lib/marketplace-catalog.json`. That JSON is
the single source of truth: the photo generator reads the same file, so a
product added in one place cannot go missing in the other.

It shares the configurator's cart rather than keeping its own — one basket,
one delivery charge, one total, because the reader is buying for one
building. Where a product covers a surface the model already measured, the
quantity is derived from the geometry and the rate quoted in that product's
own spec sheet (`suggestedQuantity`), so the arithmetic and the datasheet
cannot disagree. The price filter is logarithmic: the catalogue runs from a
24 ₽ brick to a 27 900 ₽ door.

## 9. Section transitions

Two pre-rendered shots carry the reader between stages: the drafting table on
opening a model, and the pan into the phone on the move from the model to the
estimate (`SectionTransition`, clips declared in `src/lib/transitions.ts`).

They play forward once and are never scrubbed, so they reuse none of the
hero's buffering and seek machinery — only its poster and reduced-motion
patterns. The second clip ends on a lit phone screen and carries a bloom out
of it as it leaves, so the last frame dissolves into the page's background
instead of cutting from white to black.

- At most once per session, per transition (`sessionStorage`).
- The clip into the estimate is armed by the control that navigates, so
  arriving at the cart any other way shows nothing.
- The next clip is warmed during idle time.
- Reduced motion sees the final frame for 200 ms instead, and the whole
  motion/no-motion difference is expressed in CSS rather than in a render
  branch.
- The decision runs through an external store, so the server and the
  hydrating client both render nothing and `sessionStorage` is never read
  during render.
