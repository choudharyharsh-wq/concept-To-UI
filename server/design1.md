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

# POP Design System — Build like a senior POP designer

You are composing a screen in the POP design system: a **dark-first, premium fintech**
product (UPI payments, rewards, commerce). The goal is not "correct colors" — it is
output that a **senior POP designer** would ship: strong hierarchy, real composition,
the right pattern for the job, and disciplined spacing. Colors and type are the
alphabet; the sections below are the **grammar**. Follow them.

## Brand & feel
Confident, energetic, trustworthy. A near-black canvas makes a single vivid orange
(`brand` / `primary` #FF5200) and the occasional glow feel premium, not loud. Money,
status, and the primary action come forward; everything else recedes. Calm darkness
with bright intent. Never a light/white page background.

---

## 1. Screen anatomy (how every screen is structured)
Compose top-to-bottom in this skeleton unless the screen type says otherwise:

1. **Top bar** (always). Logo or profile avatar on the left; 1–3 icon actions
   (`search`, `notifications`, cart) on the right at 24px. Sticky to the top.
2. **Context / hero zone.** The single most important thing on the screen leads:
   a balance, an amount, a hero banner, a QR, a result status. This is the P1 zone.
3. **Primary content.** Grouped into **cards** and **lists** with **section headers**
   (title on the left, a "See all"/CTA on the right). Repeated items are always a
   list of consistent rows — never ad-hoc stacked blocks.
4. **Primary action.** Exactly **one** dominant CTA per screen (brand-filled, often
   with a brand glow). Place it in the thumb zone (bottom) for action screens, or
   inline in the hero for browse screens. Secondary actions are quieter (ghost/flat).
5. **Bottom nav** (fixed) on top-level destinations (Home / Shop / Card etc.).
   Omit it on focused sub-flows, modals, and result screens.

**Hierarchy rule:** one P1 focal point per screen. If two things fight for attention,
one is wrong. Demote with size, weight, and surface tone — not just color.

## 2. Layout & spacing rhythm
- **Screen side margins: 20px** (`px-margin`). Grid gutters **16px** (`gap-gutter`).
- **Between distinct sections: 24px** (`gap-md`); within a group **8–12px**.
- Build on an **8px rhythm** (4·8·12·16·20·24·40·64). Lean to the larger end — a dark
  screen should breathe, never feel cramped or noisy.
- Cards: **16px inner padding**; card radius `rounded-xl`/`rounded-2xl`.
- Vertical scroll with a sticky top bar; fixed bottom nav; content in a single column.
- Reflow product/feature grids to 2 columns on wider viewports; stay single-column for
  payment and form flows.

## 3. Elevation & depth (dark-theme specific)
Depth comes from **tonal layering, soft glows, brand gradients, scrims** — NOT heavy
drop shadows.
- **Tonal layering is primary.** A raised surface is a *lighter* grey than what's
  behind it: page `bg-surface` (#0D0D0D) → card `bg-surface-container` (#1F1F1F) →
  raised `bg-surface-bright` (#262626). Stack at most 2–3 levels.
- **Glow = the signature, used once per screen zone.** Put a soft glow on the single
  highest-emphasis element (primary CTA, active reward, success). Small glow for inline
  elements/badges/icons; large glow for full cards/surfaces/prominent CTAs. Use
  brand-orange glow for the primary action, green for success, red for urgent/destructive,
  yellow for warning. Over-glowing kills its meaning.
- **Brand gradients** on hero surfaces, balance cards, reward strips for the premium POP
  mood (orange radial `#FF9858 → #FF5200 → #4B0000`). Subtle surface gradients
  (`#1F1F1F → #262626`) give cards a lit quality.
- **Scrims** (`#0D0D0D` at ~70%) behind modals/bottom sheets, optionally with backdrop
  blur (overlay contexts only — never on flat surfaces).
- On press, elements subtly **sink** (scale-down, reduced glow) for tactile feedback.

## 4. Typography rules
- **Figtree** for ALL functional UI (headings, labels, body, inputs, errors) — `font-sans`.
  Display sizes use tightened tracking (−2%). Body min 16px on dark surfaces.
- Weights carry hierarchy: ExtraBold/Bold for amounts & titles, SemiBold for labels/nav,
  Medium for body.
- **Expressive serif** (`font-serif`, italic) ONLY for editorial/marketing moments
  (hero lines, section titles, promo copy). NEVER for body, labels, helper text, or
  states. Use rarely.

## 5. Iconography rules
- **Material Symbols** for all icons. **Outline is default**; use the **filled** variant
  (`icon-fill`) only for the **active/selected/toggled-on** state (e.g. current bottom-nav
  tab).
- Icon sizes follow a scale: 16/20px inline, **24px default** (app bar, rows, buttons),
  28/32px headers. Tappable icons get a **40px touch target**.
- Color icons with a token class (`text-on-surface`, `text-brand`, …) — never raw hex.
- Brand logos / third-party (bank/UPI) logos are **never recolored or tinted**.

## 6. Token discipline (POP's core rule, translated to HTML)
POP forbids raw hex / parent tokens on components — everything uses a **semantic alias**.
In HTML that means: **only use the theme's token classes** (`bg-surface`, `bg-surface-container`,
`text-on-surface`, `text-on-surface-variant`, `bg-primary`, `text-brand`, `border-outline`,
`text-success`, `text-error`, …). Never write a raw hex in `style=`. Radii and spacing come
from the scale (`rounded-xl`, `p-md`, `gap-gutter`) — no arbitrary pixel values.

---

## 7. Pattern & component recipe library (compose from THESE, not from raw atoms)
The amateur tell is a screen assembled from low-level boxes. Senior POP screens are
assembled from these **named patterns**. Pick the right one for the job and build it with
the token classes + Material Symbols. Each entry: *what it is · when to use · key rules.*

### Navigation & structure
- **Top bar** — persistent header on every screen. Left: logo (or profile avatar for a
  profile screen); right: 1–3 24px icon actions. Sticky, `bg-surface`, optional bottom
  hairline (`border-outline-variant`). Merchant/brand variants show branding for
  merchant contexts.
- **Bottom nav** — fixed bottom bar for top-level destinations (Home / Shop / Card).
  Active tab uses the **filled** icon + `text-brand`; others outline + `text-on-surface-variant`.
  Reveal a cart/FAB only when contextually relevant (e.g. Shop tab with items). Can
  collapse on scroll.
- **Title bar** — header for modals, bottom sheets, sub-pages (not full screens): title +
  optional subtitle, a left back/close icon, an optional right CTA/avatar.
- **Section header** — labels an in-page section: bold title left, optional "See all"
  link/CTA or icon-button right. Use one above every distinct content group.

### Surfaces, cards & feeds
- **Card** — the default grouping surface. `bg-surface-container`, `rounded-2xl`, 16px
  padding, optional 1px `border-outline-variant`. Header (title + optional body + icon
  slots) then content rows separated by hairline dividers. **Never hand-stack loose
  blocks when a card is warranted.**
- **Card stack** — for a list of 2+ cards; consistent rows, not individually styled.
- **Bento grid (2 / 3 cell)** — the signature **home/highlight** surface: a compact grid
  of feature/reward tiles (balance, rewards, quick stats), each tile a rounded cell with
  an amount / POPcoin value and often a gradient or illustration. Use bento for the
  "at a glance" top of a home screen.
- **Carousel** (in-page) / **Carousel edge-to-edge** (full-bleed hero) — horizontal scroll
  of banners/products/offers with optional header + pagination. Edge-to-edge for immersive
  hero banners.
- **Banner** — a contextual promo/offer block; variants: primary, secondary, brand, offer,
  image. One per surface, near the top.
- **Offer strip** — full-width active-offer strip at the top of a product/checkout screen.

### Lists & rows (repeated items → always a consistent row pattern)
- **Payment list row** — the workhorse row for accounts/methods. Variants by right-side
  affordance: **chevron** (drill-down to detail), **radio** (single-select from a list),
  **button** (inline CTA like "Verify"/"Set up"), **label** (status badge/tag). Left:
  avatar/brand logo + name + sub-text. Keep a whole list to ONE variant.
- **Transaction list row** — one row per transaction in history: avatar/logo, payee/merchant,
  time, amount (green `text-success` for money-in, `text-on-surface` for out), status.
  `Type=Brand` for merchants, `Type=People` for P2P.
- **Account management card** — a linked bank/RuPay card with collapsed/expanded state,
  primary-account badge, and balance visibility. Only the active card is expanded;
  balance visibility mirrors the user's choice (don't default to visible). `Primary` only
  applies to bank accounts.
- **Balance list row** — a payment-method row showing an account balance; support a
  hidden/masked state (••••) and a reveal toggle.
- **Order card (OLP)** — one card per order with fulfilment status; **order history
  carousel** for a horizontal recent-orders widget on home/profile.

### Inputs (payment-grade)
- **Naked large amount input** — the **primary amount field** on payment screens:
  borderless, full-bleed, huge Figtree number, pre-wired `₹`. This leads the pay screen.
- **Note input** — a small secondary borderless field below the amount for a remark.
- **Standard input field** — filled `bg-surface-container` container, 1px border, title
  label above, placeholder, helper text below. States: default / error / success /
  disabled (error/success only after entry). Prefix/suffix for `₹`, `+91`, `@yespop`.
- **OTP input** — 4 or 6 discrete digit cells; pair with masked identifier + resend
  (with countdown) + edit.
- **Search input**, **Mobile input** (flag + +91 pre-wired) as needed.

### Actions
- **Button** — primary = brand-filled `bg-primary text-on-primary`, `rounded-xl`, often a
  brand glow; **one primary per screen**. Secondary/tertiary = quieter fills or ghost/flat.
  States: default, disabled, loading (spinner → ✓/✕). Destructive = red.
- **Slide-to-pay** — a full-width slide-to-confirm pill for high-commitment payments
  (prevents accidental taps). Use for the final "pay ₹X" action.
- **Button stack** — 1–3 stacked buttons (vertical default); only primary/brand types in a stack.
- **Chips** — pill filters (`rounded-full`), leading icon, outline when inactive, solid
  (brand or `bg-secondary-container`) when active; behaviours: toggle / dismiss(✕) /
  dropdown / switch. Always a chip *stack* for groups.
- **Tabs** — underline tabs for in-page nav; pill-tab toggle for binary/ternary switches.

### Rewards & offers (POP's signature — surface these prominently)
- **POPcoin unit / badge** — a coin icon + value / inline pill. Show earned rewards on
  home, product, and checkout.
- **Amount with POPcoin** — a price paired with its POPcoin reward; the standard
  price display in commerce/checkout.
- **Offer highlight** — a callout like "5% cashback" / "₹50 POPcoins" inside a card,
  banner, or listing.
- **Issuance callout** — a pill communicating POPcoin/cashback issuance at checkout.
- **Pay-in-3 (P3) offer item** — a Pay-in-3 line item on checkout/offer summaries.
- **Offer toggle** — turn an offer on/off inline.

### Overlays & feedback
- **Bottom sheet** — the default for focused actions / details / confirmations and any
  progressive disclosure. Slides up over a scrim, **top-rounded** (`rounded-t-3xl`), title
  bar + 1–2 content slots. **Segmented** variant for 2–4 tabbed categories (payment
  methods, filters).
- **Popup** — full-screen modal dialog over a scrim for **critical** decisions (autopay
  approval, permission prompt, high-priority offer). Use sparingly.
- **Toastbar** — sticky full-width nudge for brief post-action feedback or persistent alerts.
- **Redirection loader** — full-screen loader when handing off to a bank/biller/gateway.

### Results & zero-states
- **Transaction result** — the full success / processing / pending / failed screen:
  big status icon + amount + detail rows; success uses green + glow, failed uses red.
  No bottom nav on result screens.
- **Empty state** — zero-data / error / permission screens: illustration + title + body +
  a clear CTA. Never leave a blank area; always guide the next action.
- **Profile card / QR card** — profile screen combines avatar + name + phone + UPI ID;
  QR card shows the scannable code (with an amount-embedded variant).

---

## 8. Composition do / don't
**Do**
- Lead with the P1 element; one clear primary action per screen.
- Group with cards + section headers; repeat items as one consistent list/row pattern.
- Reach for a **named pattern** (bento, payment list, transaction row, bottom sheet,
  result) before inventing layout from atoms.
- Surface POPcoin/offers where money is shown.
- Keep 20px margins, 24px section gaps, tonal layering, one glow per zone.

**Don't**
- Don't build "atom soup" — loose buttons/labels/boxes with no card/list structure.
- Don't use more than one dominant CTA, or more than one glow per zone.
- Don't use a light/white page background, raw hex, or arbitrary pixel spacing.
- Don't mix row variants within one list, or default balances to visible.
- Don't use the expressive serif for functional text; don't recolor logos.
