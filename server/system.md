---
# ═══════════════════════════════════════════════════════════════════════════
# POP DESIGN SYSTEM — GLOBAL GRAMMAR  (system.md)
# ───────────────────────────────────────────────────────────────────────────
# ROLE IN PIPELINE: this is the STABLE, CACHEABLE half of the design brief.
# Inject it into the SYSTEM prompt of every html_compiler batch UNCHANGED so
# Anthropic prompt-caching hits. It holds the token vocabulary + the design
# grammar that applies to ALL screens. It deliberately DOES NOT contain the
# per-pattern HTML skeletons — those live in recipes.json and are RETRIEVED
# per screen by component_inventory / archetype (keeps the injected tail small
# and relevant). The critique rubric lives in critique_rubric.json.
#
#   system.md          → always injected (this file)          ~6k
#   recipes.json       → retrieved subset per screen           ~2–4k
#   critique_rubric    → used only by the critic node
# ═══════════════════════════════════════════════════════════════════════════
name: POP — Dark Premium Fintech

# ── CANONICAL GENERATION PALETTE ──────────────────────────────
# The `colors` map below has many aliases resolving to the SAME hex (kept for
# Tailwind-class compatibility). When GENERATING, pick from this short
# canonical set — it prevents choice-paralysis and keeps screens consistent:
#   page bg        → surface            #0d0d0d
#   raised card    → surface-container  #1f1f1f
#   raised-most    → surface-bright     #262626
#   hairline       → outline-variant    #333333
#   divider/stroke → outline            #4d4d4d
#   text primary   → on-surface         #e6e6e6
#   text secondary → on-surface-variant #b3b3b3
#   text muted     → on-surface-muted   #8a8a8a
#   brand/action   → primary / brand    #ff5200
#   brand light    → brand-soft         #ff8b54   (glow tint, serif accents)
#   success/money  → success            #0db651
#   reward/POPcoin → tertiary / warning #fbbc09
#   danger         → error              #ee4d37
# ──────────────────────────────────────────────────────────────
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
  on-surface-muted: '#8a8a8a'
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

# ── SIGNATURE EFFECT RECIPES (constants — never let the model compute these) ──
# Emit these verbatim. In class-mode expose as utilities (shadow-glow-brand-lg …);
# in inline-mode paste the value. This is what makes every screen glow identically.
effects:
  glow-brand-lg: '0 16px 40px -14px rgba(255,82,0,.55)'   # hero CTA, balance/hero card
  glow-brand-sm: '0 6px 18px -6px rgba(255,82,0,.70)'     # active chip, badge, pill
  glow-success:  '0 14px 34px -10px rgba(13,182,81,.45)'  # positive result
  glow-danger:   '0 14px 34px -10px rgba(238,77,55,.45)'  # destructive / failed result
  elev-card:     '0 20px 40px -18px rgba(0,0,0,.7)'       # floating / overlapping card
  elev-screen:   '0 50px 90px -30px rgba(0,0,0,.7)'       # device artboard (canvas only)
  gradient-brand:   'radial-gradient(130% 130% at 0% 0%,#ff8b54 0%,#ff5200 42%,#4b0000 100%)'
  gradient-surface: 'linear-gradient(135deg,#1f1f1f,#262626)'  # subtly-lit ordinary card
  scrim:            'rgba(13,13,13,.70)'                   # behind sheets / modals only

# ── TYPE SCALE + ELEMENT→STYLE MAP ──────────────────────────
# Don't free-size text. Map every text element to one of these styles:
#   screen title            → display-sm      (24/700)
#   hero amount / balance    → display-lg      (36/800); ONE focal number may go 44–48 inline
#   section header           → headline-lg     (20/700)
#   card title               → headline-sm     (18/600)
#   row title / body         → body-md         (16/500)
#   sub-text / meta           → body-sm         (14/500) at on-surface-variant
#   chip / nav / button       → label-md        (14/600)
#   overline / caption        → label-sm        (12/600) UPPERCASE +0.06em
#   editorial hero line ONLY  → expressive      (serif italic) — rare
typography:
  display-lg:   { fontFamily: Figtree, fontSize: 36px, fontWeight: '800', lineHeight: 40px, letterSpacing: -0.02em }
  display-md:   { fontFamily: Figtree, fontSize: 32px, fontWeight: '700', lineHeight: 38px, letterSpacing: -0.02em }
  display-sm:   { fontFamily: Figtree, fontSize: 24px, fontWeight: '700', lineHeight: 30px, letterSpacing: -0.02em }
  headline-lg:  { fontFamily: Figtree, fontSize: 20px, fontWeight: '700', lineHeight: 26px }
  headline-sm:  { fontFamily: Figtree, fontSize: 18px, fontWeight: '600', lineHeight: 24px }
  body-lg:      { fontFamily: Figtree, fontSize: 18px, fontWeight: '500', lineHeight: 24px }
  body-md:      { fontFamily: Figtree, fontSize: 16px, fontWeight: '500', lineHeight: 24px }
  body-sm:      { fontFamily: Figtree, fontSize: 14px, fontWeight: '500', lineHeight: 22px }
  label-md:     { fontFamily: Figtree, fontSize: 14px, fontWeight: '600', lineHeight: 20px }
  label-sm:     { fontFamily: Figtree, fontSize: 12px, fontWeight: '600', lineHeight: 16px }
  expressive:   { fontFamily: 'Instrument Serif', fontSize: 24px, fontWeight: '700', lineHeight: 32px, fontStyle: italic }
  # 'Awesome Serif Italic' is not web-available → ship 'Instrument Serif' italic (Google Fonts).
  # Figtree is on Google Fonts.

rounded:
  sm: 0.5rem       # 8px  — chips, small badges
  DEFAULT: 0.75rem # 12px — inputs, small buttons
  md: 1rem         # 16px — inner thumbnails, search
  lg: 1.25rem      # 20px — cards
  xl: 1.5rem       # 24px — prominent cards, primary buttons
  2xl: 2rem        # 32px — hero surfaces, bottom sheets (top only)
  full: 9999px     # pills, avatars, chips

spacing:
  xs: 4px
  base: 8px
  sm: 12px
  gutter: 16px     # grid gutters, card inner padding
  margin: 20px     # screen side margins
  md: 24px         # between distinct sections
  lg: 40px
  xl: 64px

strokes:
  hairline: 0.5px
  DEFAULT: 1px
  emphasis: 2px

device:
  artboard: '390 × 844'   # design at this size; content min font 14px
  touch-target: 44px
---

# POP Design System — Build like a senior POP designer

You are composing a screen in the POP design system: a **dark-first, premium fintech**
product (UPI payments, rewards, commerce). The goal is not "correct colors" — it is
output a **senior POP designer** would ship: strong hierarchy, real composition, the
right pattern for the job, disciplined spacing. Tokens are the alphabet; the grammar
below is how you speak it. The concrete **HTML skeletons** for each named pattern arrive
separately (retrieved per screen) — this file governs how you assemble them.

---

## 0. Process — plan before you build (MANDATORY)
The difference between amateur and senior output is planning first. A separate
composition-brief step should already have decided the items below; honour it exactly.
If it is absent, derive it in ≤5 lines before writing any markup:

1. **Screen archetype** — browse / detail / form / result / dashboard / overlay.
2. **Zone → pattern map** — for each zone (top bar, hero/P1, content, primary action,
   nav) name the exact pattern you'll use. If you can't name one, you're about to build
   atom soup — pick a pattern.
3. **The one P1 focal point** and **where the single glow goes**.
4. **Real data** — plausible content, never lorem, never "Item 1".
5. Build → then self-check against §9.

## 1. Brand & feel
Confident, energetic, trustworthy. A near-black canvas makes a single vivid orange
(`primary` #FF5200) and the occasional glow feel premium, not loud. Money, status, and
the primary action come forward; everything else recedes. Calm darkness, bright intent.
**Never** a light/white page background.

## 2. Screen anatomy
Compose top-to-bottom unless the archetype says otherwise:
1. **Top bar** (always) — logo / avatar / location-context left; 1–3 icon actions (24px)
   right. Sticky, `bg-surface`.
2. **Context / hero zone (P1)** — the single most important thing leads: a balance, an
   amount, a hero banner, a QR, a result status, a savings total.
3. **Primary content** — grouped into **cards** and **lists** under **section headers**
   (title left, "See all"/CTA right). Repeated items are ALWAYS one consistent row
   pattern — never ad-hoc stacked blocks.
4. **Primary action** — exactly **one** dominant CTA (brand-filled, usually glowing).
   Thumb zone for action screens; inline in hero for browse. Secondary actions are quieter.
5. **Bottom nav** (fixed) on top-level destinations; omit on sub-flows, modals, results.

**Hierarchy rule:** one P1 per screen. If two things fight for attention, one is wrong.
Demote with size, weight, and surface tone — not just color.

## 3. Layout & spacing rhythm
- Screen side margins **20px**; grid gutters **16px**.
- Between sections **24px**; within a group **8–12px**.
- Build on an 8px rhythm (4·8·12·16·20·24·40·64). Lean large — dark screens should breathe.
- Cards: 16px inner padding, radius `lg`/`xl`.
- Single column; sticky top bar; fixed bottom nav. Reflow feature/product grids to 2
  columns on wider viewports; stay single-column for payment & form flows.

## 4. Color usage & the glow system
- **Dominance ≈ 70 / 20 / 10** — ~70% near-black surfaces, ~20% greys + text, ~10% brand
  orange. Orange is a scalpel: the eye should land on it instantly because it's rare.
- **Semantics are fixed:** brand = primary action / active state; success green = money
  saved/earned/positive results; tertiary yellow = rewards & POPcoins; error red =
  destructive/failed only. Never swap these meanings.
- **Glow is the signature. Exactly ONE glow per screen zone**, on the highest-emphasis
  element, using the `effects` recipes verbatim. Over-glowing destroys its meaning.
- **Brand gradient** on hero surfaces / balance cards / reward strips; **surface gradient**
  gives ordinary cards a subtly-lit quality.

## 5. Elevation & depth (dark-theme specific)
Depth = **tonal layering + glows + gradients + scrims**, NOT heavy drop shadows.
- Raised = *lighter* grey: page `#0d0d0d` → card `#1f1f1f` → raised `#262626`. Max 2–3 levels.
- Shadows only for genuinely floating things (overlapping cards, sheets). A flat card on a
  flat page gets a **hairline border**, not a shadow.
- **Scrims** behind modals/sheets only. On press, elements subtly sink (scale-down + less glow).

## 6. Typography, iconography & token discipline
- **Figtree** for all functional UI; use the element→style map in frontmatter (don't free-size).
  Weights carry hierarchy (ExtraBold/Bold amounts & titles, SemiBold labels/nav, Medium body).
- **Expressive serif** (Instrument Serif italic) ONLY for a hero tagline / promo line —
  never body, labels, helpers, numbers, states. Rare.
- **Material Symbols (Rounded)** for all icons. Outline default; **filled only** for
  active/selected/toggled-on. Sizes 16/20 inline · 24 default · 28/32 headers; 44px touch
  target. Color icons with a token. **Never recolor brand / bank / UPI logos.**
- **Token discipline (both output modes):** every value traces back to a token.
  In **class mode** use only token classes (`bg-surface`, `text-on-surface`, `bg-primary`,
  `text-success`, `border-outline-variant`, `rounded-xl`, `p-gutter`). In **inline-style
  mode** you may write the hex, but ONLY the exact value the token resolves to (from the
  canonical palette / effect recipes) — never an eyeballed color, off-palette shade, or
  arbitrary px radius/spacing.

## 7. Imagery & placeholders
Real product/food/merchant photos carry much of the premium feel. Without real assets:
- **Never** hand-draw illustrative SVGs; **never** leave a blank grey box.
- Use the **branded placeholder**: dark tonal fill + faint brand-tinted radial + subtle
  diagonal stripe + small monospace caption of what belongs there:
  ```
  background:
    radial-gradient(circle at 35% 30%, rgba(255,82,0,.16), transparent 55%),
    repeating-linear-gradient(135deg,#242424 0,#242424 11px,#1b1b1b 11px,#1b1b1b 22px);
  ```
  caption: 11px ui-monospace, uppercase, #6f6f6f, e.g. `▢ food shot`.
- Vary the radial hue per card (brand / success / tertiary) so a feed of placeholders still
  reads as composed. Photo cards still get every real overlay (discount badge, favourite,
  rating, scrim) so layout is final the moment real images drop in.

## 8. Pattern catalog (names you compose from — skeletons retrieved separately)
Pick the right pattern for each zone; its HTML skeleton is supplied per screen. Never
invent layout from raw atoms when a pattern exists.
- **Navigation/structure:** top-bar · bottom-nav · title-bar · section-header
- **Surfaces/feeds:** card · card-stack · bento-grid · carousel · carousel-edge · banner · offer-strip
- **Lists/rows:** payment-list-row · transaction-list-row · account-card · balance-list-row · order-card
- **Inputs:** amount-input-naked · note-input · input-field · otp-input · search-input · mobile-input
- **Actions:** button · slide-to-pay · button-stack · chip-stack · tabs
- **Rewards/offers (POP signature — surface prominently):** popcoin-badge · amount-with-popcoin · offer-highlight · issuance-callout · pay-in-3 · offer-toggle
- **Overlays/feedback:** bottom-sheet · popup · toastbar · redirection-loader
- **Results/zero:** transaction-result · empty-state · profile-card · qr-card

## 9. Self-check before finishing (the amateur tells)
Do: lead with the P1; one primary action; one glow per zone; group with cards + section
headers; repeat items as ONE row pattern; surface POPcoin/offers wherever money appears;
real content; 20px margins, 24px section gaps, tonal layering, 70/20/10 color.
Don't: atom soup (loose boxes, no card/list structure) · >1 dominant CTA or >1 glow per
zone · light/white background · off-palette color or arbitrary radius/spacing · mixed row
variants in one list · balances defaulting to visible · serif for functional text ·
recolored logos · blank grey image boxes · lorem · flat even weights/sizes (no hierarchy).
The full machine-readable version of this list is `critique_rubric.json`.
