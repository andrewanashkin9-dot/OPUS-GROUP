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

## 5. Implementation notes

- Fonts: Unbounded 500/800 and Manrope 400/500/700, Cyrillic + Latin
  subsets, self-hosted as `.woff2` under `public/fonts/`, declared in
  `src/app/fonts.css` with `font-display: swap`. No Google Fonts CDN link.
- 3D: `@react-three/fiber` + `@react-three/drei`, driven by a
  `Model3DProvider` interface (`src/lib/3d/provider.ts`) so the mock
  (`src/lib/3d/mock-provider.ts`) and the future Neural4D adapter are
  interchangeable behind one factory (`src/lib/3d/index.ts`).
- State: `zustand` store for the editor/cart (`src/lib/store.ts`) so price
  and BOM stay in sync as materials are swapped.
