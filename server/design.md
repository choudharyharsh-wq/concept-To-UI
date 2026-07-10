---
name: POP — Dark Premium Fintech
colors:
  surface: '#0d0d0d'
  surface-dim: '#0d0d0d'
  surface-bright: '#262626'
  surface-container-lowest: '#0d0d0d'
  surface-container-low: '#1f1f1f'
  surface-container: '#1f1f1f'
  surface-container-high: '#262626'
  surface-container-highest: '#333333'
  on-surface: '#e6e6e6'
  on-surface-variant: '#b3b3b3'
  inverse-surface: '#ffffff'
  inverse-on-surface: '#0d0d0d'
  outline: '#4d4d4d'
  outline-variant: '#333333'
  surface-tint: '#ff5200'
  primary: '#ff5200'
  on-primary: '#ffffff'
  primary-container: '#6b2200'
  on-primary-container: '#ffeee6'
  inverse-primary: '#ff8b54'
  secondary: '#0db651'
  on-secondary: '#ffffff'
  secondary-container: '#07642d'
  on-secondary-container: '#e7f8ee'
  tertiary: '#fbbc09'
  on-tertiary: '#0d0d0d'
  tertiary-container: '#694f04'
  on-tertiary-container: '#fff8e6'
  error: '#ee4d37'
  on-error: '#ffffff'
  error-container: '#642017'
  on-error-container: '#fdedeb'
  warning: '#fbbc09'
  on-warning: '#0d0d0d'
  success: '#0db651'
  on-success: '#ffffff'
  brand: '#ff5200'
  brand-strong: '#e84b00'
  brand-soft: '#ff8b54'
  background: '#0d0d0d'
  on-background: '#e6e6e6'
  surface-variant: '#262626'
typography:
  display-lg:
    fontFamily: Figtree
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Figtree
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  display-sm:
    fontFamily: Figtree
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Figtree
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
  headline-sm:
    fontFamily: Figtree
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Figtree
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Figtree
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-sm:
    fontFamily: Figtree
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
  label-md:
    fontFamily: Figtree
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Figtree
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  expressive:
    fontFamily: Awesome Serif Italic
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    fontStyle: italic
rounded:
  sm: 0.5rem
  DEFAULT: 0.75rem
  md: 1rem
  lg: 1.25rem
  xl: 1.5rem
  2xl: 2rem
  full: 9999px
spacing:
  xs: 4px
  base: 8px
  sm: 12px
  gutter: 16px
  margin: 20px
  md: 24px
  lg: 40px
  xl: 64px
strokes:
  hairline: 0.5px
  DEFAULT: 1px
  emphasis: 2px
---

## Brand & Style
POP is a **dark-first, premium fintech** design system built for fast payments, clear money, and visible rewards. The personality is **confident, energetic, and trustworthy** — a near-black canvas that makes a single vivid orange (`#FF5200`) and the occasional glow feel premium rather than loud.

The aesthetic is **calm darkness with bright intent**. Deep neutral surfaces (`#0D0D0D` → `#262626`) recede so that money, status, and the primary action come forward. Interest is created not with decoration but with **tonal layering, soft glows, and brand gradients** reserved for the moments that matter (a balance, a CTA, a reward). Every screen should feel like a focused, high-contrast control surface: one obvious next action, generous breathing room, and zero visual clutter. Semantics are strict and consistent — green means success, red means destructive, yellow means caution, orange means brand.

## Colors
The palette is rooted in **neutral darkness + a single hot brand orange**, with disciplined semantic accents.

- **Surfaces (Greys):** A near-black page (`#0D0D0D`) with elevated containers stepping up through `#1F1F1F` → `#262626` → `#333333`. Elevation is communicated by getting **lighter**, not by drop shadows. Never use a light/white page background.
- **Primary (Brand Orange `#FF5200`):** The single most important colour — primary CTAs, active states, brand moments, key amounts, and reward highlights. Use it sparingly so it always reads as "the action."
- **Text:** Primary text is soft white (`#E6E6E6`), secondary is grey (`#B3B3B3`), tertiary/disabled darker still. Avoid pure `#FFFFFF` for body text (reserved for inverted surfaces and high-emphasis numerals).
- **Secondary (Success Green `#0DB651`):** Trust, verification, success, and "money in" moments.
- **Tertiary (Warning Yellow `#FBBC09`):** Used sparingly for caution, pending states, and reward/offer badges.
- **Error (Destructive Red `#EE4D37`):** Failures, destructive actions, "money out" warnings.
- **Borders:** Hairline-to-1px strokes in `#262626`/`#333333` separate surfaces of similar tone where a tonal step alone isn't enough.

> Token rule: always paint with semantic tokens (surface / on-surface / primary / outline …), never raw greys or raw hex.

## Typography
The system uses **Figtree** for all functional UI — headings, labels, body, inputs, errors — chosen for its clean, legible, slightly geometric character on dark backgrounds. **Awesome Serif Italic** is the expressive companion, used **only** for editorial/marketing moments (hero lines, section titles, promotional callouts) — never for body, labels, helper text, or any functional UI.

- **Display / Headlines:** Figtree Bold (700) and ExtraBold (800) with tightened tracking (`-2%`) at display sizes for a confident brand voice. Used for amounts, screen titles, and hero numerals.
- **Body:** Figtree Medium (500) at 16px minimum for comfortable reading on dark surfaces. Regular (400) only for long passages.
- **Labels:** Figtree SemiBold (600) for navigation, metadata, chips, and buttons — provides contrast against body text without shouting.
- **Expressive:** Awesome Serif Italic (always italic by nature) for editorial highlights only, reserved and rare.

## Layout & Spacing
Mobile-first, built on an **8px base rhythm** (scale: 4 · 8 · 12 · 16 · 20 · 24 · 40 · 64).

- **Margins:** A 20px screen side-margin gives content a premium, uncrowded frame; 16px gutters between grid items.
- **Vertical rhythm:** Lean to the larger end of the scale — ~24px between distinct sections, 12–16px within a group — so a dark screen never feels cramped or noisy.
- **The grid:** Single-column mobile flow with a fixed top app bar and a fixed bottom nav. Card lists stack vertically; product/feature grids reflow to 2 columns on wider viewports.
- **Focus:** One dominant action per screen, placed in the thumb zone; supporting content recedes via tone and size. Generous whitespace is a feature, not wasted space.

## Elevation & Depth
Depth is created through **tonal layering, soft glows, brand gradients, and scrims** — not heavy drop shadows.

- **Tonal layering:** The primary way to show elevation. A raised surface is a *lighter* grey than what's behind it (`#0D0D0D` page → `#1F1F1F` card → `#262626` raised). Stack at most 2–3 tonal levels.
- **Glows (the signature):** A soft coloured glow announces the single highest-emphasis element on a screen — typically the primary CTA, an active state, or a reward. Use **brand-orange glow** for the primary action, **green glow** for success confirmations, **red glow** for urgent/destructive, **yellow glow** for warnings. Glow requires a filled background and is used **once per screen zone** — over-glowing kills its meaning. Reference: large glow ≈ 32px blur, small ≈ 9px.
- **Brand gradients:** Radial/linear brand gradients (`#FF9858 → #FF5200 → #4B0000`) on hero surfaces, balance cards, and reward strips for the premium POP mood. Surface gradients (`#1F1F1F → #262626`) give cards a subtle lit quality.
- **Scrims & blur:** Dark scrims (`#0D0D0D` at 70%) behind modals and bottom sheets, with optional frosted background blur for overlays. Top/bottom fade gradients keep content legible under fixed bars.
- **Interactive depth:** On press, elements should subtly "sink" (slight scale-down, reduced glow spread) for a tactile, responsive feel.

## Shapes
The shape language is **consistently soft, never sharp** — corners are always rounded to keep a dark UI feeling friendly and modern.

- **Pill (fully rounded, `9999px`):** Chips, tabs (pill variant), toggles, badges, and POPcoin/reward pills.
- **Buttons:** Rounded `10–12px` for standard buttons; full-width primary CTAs and slide-to-pay use a pill/large radius.
- **Inputs:** Rounded `8–10px`, matching small cards; borderless "naked" inputs for large amount-entry screens.
- **Cards & containers:** `12–16px` (small → medium); modals `16px`; bottom sheets use a **top-only** large radius (`20–24px`) as they rise from the bottom edge.
- **Large containers / hero surfaces:** `20–32px` for a soft, premium feel.
- **Icons & illustration:** Rounded caps and corners; avoid sharp 90° angles anywhere in custom art.

## Components
- **Buttons:** Primary = solid orange (`#FF5200`) with white text and optional brand glow — max one per screen. Secondary/tertiary = subdued fills or ghost/outlined for supporting actions. States include disabled, loading (spinner → ✓/✕), and destructive (red). High-commitment payments use a **slide-to-pay** pill button.
- **Inputs:** Dark filled containers with a 1px border; title label above, placeholder hint, semantic helper text below (info/success/error/warning, each with a leading icon). Prefixes/suffixes for `₹`, `+91`, `@yespop`. Large screens use **borderless amount inputs** with a pre-wired `₹`.
- **Cards:** Dark surface (`#1F1F1F`) with optional gradient fill and optional 1px enclosure; header (title + body + icon/right slots), 0–5 content rows or scrollable "plenty," with hairline dividers. Always group multiples in a card stack.
- **Chips & tabs:** Pill chips with a leading icon — outlined when inactive, solid-filled (brand or surface) when active; support toggle / dismiss (✕) / dropdown / switch behaviours. Underline tabs for in-page nav; pill-tab toggles for binary/ternary switches.
- **Navigation:** A top **App/Top bar** (logo or profile avatar on the left, 24px icon actions on the right, optional bottom stroke) and a fixed **bottom nav** (Home / Shop / Card). The bottom nav reveals a **Cart FAB** only on the Shop tab when items are pending, and can collapse on scroll to reclaim space.
- **Badges & rewards:** Pill badges in orange / green / red / yellow, optionally glowing. The **POPcoin** reward system (coin unit + value, "amount with POPcoin", offer highlights) is a signature POP element — surface it in checkout, product, and home contexts.
- **Signature surfaces:** **Bento grids** of feature/reward tiles on the home screen, **balance cards** with brand gradients and hidden/visible toggles, **offer strips** for active promotions, and **transaction-result** screens (success / processing / pending / failed) with a status icon, amount, and detail rows.
- **Iconography:** Outline icons by default (24px standard, 16/20px inline, 28/32px headers); filled icons **only** for active/selected states; tappable icons use a 40px Icon Button touch target. Colour icons via the `icon/primary` token, never raw hex.
- **Empty & loading states:** Full-page or bottom-sheet empty states with an illustration, title, body, and CTA; skeleton-loader gradients for content loading; full-screen redirection loaders for hand-offs.
