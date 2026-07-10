# Blade Design System — Agent Design Guide

A portable, self-contained spec for recreating **Blade**, the open-source design system
behind **Razorpay**'s products (Payments Dashboard, RazorpayX banking, marketing).
Hand this file to any agent (Claude Code, etc.) to build interfaces that look and feel
like Razorpay.

> **Source of truth:** `@razorpay/blade@12.107.1` (GitHub `razorpay/blade`, Storybook
> `blade.razorpay.com`). All tokens below are extracted verbatim from that package.
> Fonts: **Inter** (body) + **TASA Orbiter Display** (headings) + **Menlo** (code) —
> self-hosted from real brand binaries in `assets/fonts/`.
> Icons: Blade ships a proprietary ~340-icon set; use **Lucide/Feather** as the closest
> free substitute (2px stroke, rounded caps, 24px grid).

---

## 0 · Quick start

Paste this into a page's `<head>` to get the whole token system + fonts. Fonts are
**self-hosted** — ship the `assets/fonts/` folder and this `@font-face` block (adjust
the relative paths to wherever the binaries live):

```html
<style>
/* Inter — body (variable 400–700) */
@font-face { font-family:"Inter"; src:url("assets/fonts/Inter-VariableFont.ttf") format("truetype-variations"); font-weight:400 700; font-style:normal; font-display:swap; }
@font-face { font-family:"Inter"; src:url("assets/fonts/Inter-Italic-VariableFont.ttf") format("truetype-variations"); font-weight:400 700; font-style:italic; font-display:swap; }
/* TASA Orbiter Display — headings (400/500/600/700/900) */
@font-face { font-family:"TASA Orbiter"; src:url("assets/fonts/TASAOrbiterDisplay-Regular.otf") format("opentype"); font-weight:400; font-display:swap; }
@font-face { font-family:"TASA Orbiter"; src:url("assets/fonts/TASAOrbiterDisplay-Medium.otf") format("opentype"); font-weight:500; font-display:swap; }
@font-face { font-family:"TASA Orbiter"; src:url("assets/fonts/TASAOrbiterDisplay-SemiBold.otf") format("opentype"); font-weight:600; font-display:swap; }
@font-face { font-family:"TASA Orbiter"; src:url("assets/fonts/TASAOrbiterDisplay-Bold.otf") format("opentype"); font-weight:700; font-display:swap; }
@font-face { font-family:"TASA Orbiter"; src:url("assets/fonts/TASAOrbiterDisplay-Black.otf") format("opentype"); font-weight:900; font-display:swap; }
/* Menlo — code (400/700 + italics) */
@font-face { font-family:"Menlo"; src:url("assets/fonts/Menlo-Regular.ttf") format("truetype"); font-weight:400; font-display:swap; }
@font-face { font-family:"Menlo"; src:url("assets/fonts/Menlo-Bold.ttf") format("truetype"); font-weight:700; font-display:swap; }
</style>
<!-- then paste the :root token block from §1 -->
```

Then style everything with the CSS custom properties. **Never hardcode a hex** — use a
token. Base body is `14px Inter`, brand action is `--interactive-primary-default`
(azure 500, ~`#1364F1`).

---

## 1 · Design tokens (paste verbatim)

Drop this entire block in a global `<style>` / stylesheet. It is the complete Blade
foundation: color ramps → semantic aliases → type → spacing → radius → border → motion →
elevation.

```css
:root {
  /* ============ CHROMATIC RAMPS (HSLA) ============ */
  /* Azure — brand / primary */
  --blade-azure-50: hsla(217,100%,98%,1);  --blade-azure-100: hsla(218,100%,92%,1);
  --blade-azure-200: hsla(218,100%,83%,1); --blade-azure-300: hsla(217,100%,73%,1);
  --blade-azure-400: hsla(218,100%,63%,1); --blade-azure-500: hsla(218,89%,51%,1); /* brand blue #1364F1 */
  --blade-azure-600: hsla(218,87%,43%,1);  --blade-azure-700: hsla(218,89%,35%,1);
  --blade-azure-800: hsla(218,90%,28%,1);  --blade-azure-900: hsla(218,90%,20%,1);
  --blade-azure-1000: hsla(218,93%,10%,1); /* ink / navy — dark surfaces */

  /* Emerald — positive */
  --blade-emerald-50: hsla(150,39%,93%,1); --blade-emerald-100: hsla(149,38%,86%,1);
  --blade-emerald-200: hsla(150,38%,72%,1);--blade-emerald-300: hsla(150,38%,58%,1);
  --blade-emerald-400: hsla(150,48%,44%,1);--blade-emerald-500: hsla(153,100%,30%,1);
  --blade-emerald-600: hsla(150,100%,28%,1);--blade-emerald-700: hsla(150,100%,23%,1);
  --blade-emerald-800: hsla(150,100%,18%,1);--blade-emerald-900: hsla(150,100%,14%,1);
  --blade-emerald-1000: hsla(150,100%,11%,1);

  /* Crimson — negative */
  --blade-crimson-50: hsla(5,75%,97%,1);   --blade-crimson-100: hsla(5,75%,94%,1);
  --blade-crimson-200: hsla(5,76%,85%,1);  --blade-crimson-300: hsla(5,77%,75%,1);
  --blade-crimson-400: hsla(5,76%,63%,1);  --blade-crimson-500: hsla(5,73%,53%,1);
  --blade-crimson-600: hsla(4,85%,44%,1);  --blade-crimson-700: hsla(4,85%,36%,1);
  --blade-crimson-800: hsla(4,84%,30%,1);  --blade-crimson-900: hsla(3,84%,26%,1);
  --blade-crimson-1000: hsla(4,83%,21%,1);

  /* Cider — notice / warning (orange) */
  --blade-cider-50: hsla(23,100%,97%,1);   --blade-cider-100: hsla(24,100%,92%,1);
  --blade-cider-200: hsla(25,100%,82%,1);  --blade-cider-300: hsla(24,100%,71%,1);
  --blade-cider-400: hsla(22,100%,63%,1);  --blade-cider-500: hsla(23,92%,53%,1);
  --blade-cider-600: hsla(25,100%,44%,1);  --blade-cider-700: hsla(25,100%,39%,1);
  --blade-cider-800: hsla(25,100%,34%,1);  --blade-cider-900: hsla(25,100%,28%,1);
  --blade-cider-1000: hsla(25,100%,21%,1);

  /* Sapphire — information */
  --blade-sapphire-50: hsla(198,85%,95%,1);--blade-sapphire-100: hsla(199,82%,89%,1);
  --blade-sapphire-200: hsla(200,83%,79%,1);--blade-sapphire-300: hsla(199,83%,68%,1);
  --blade-sapphire-400: hsla(199,83%,58%,1);--blade-sapphire-500: hsla(198,100%,45%,1);
  --blade-sapphire-600: hsla(200,100%,41%,1);--blade-sapphire-700: hsla(200,100%,33%,1);
  --blade-sapphire-800: hsla(199,100%,26%,1);--blade-sapphire-900: hsla(200,100%,19%,1);
  --blade-sapphire-1000: hsla(199,100%,13%,1);

  /* Accents — Orchid / Topaz + data-viz (Sea/Cloud/Forest/Magenta) */
  --blade-orchid-50: hsla(267,100%,95%,1); --blade-orchid-100: hsla(264,100%,89%,1);
  --blade-orchid-300: hsla(261,100%,79%,1);--blade-orchid-500: hsla(258,93%,68%,1);
  --blade-orchid-600: hsla(257,69%,58%,1); --blade-orchid-700: hsla(258,54%,48%,1);
  --blade-orchid-900: hsla(257,62%,26%,1);
  --blade-topaz-100: hsla(46,80%,68%,1);   --blade-topaz-300: hsla(46,93%,43%,1);
  --blade-topaz-500: hsla(41,100%,33%,1);  --blade-topaz-700: hsla(38,100%,24%,1);
  --blade-topaz-900: hsla(35,100%,13%,1);
  --blade-sea-500: hsla(180,45%,40%,1);    --blade-sea-700: hsla(180,55%,25%,1);
  --blade-cloud-500: hsla(200,45%,40%,1);
  --blade-forest-500: hsla(155,100%,37%,1);--blade-forest-700: hsla(155,100%,27%,1);
  --blade-magenta-500: hsla(317,60%,55%,1);--blade-magenta-700: hsla(316,63%,36%,1);

  /* Neutral — cool blue-gray ramp */
  --blade-gray-0: hsla(0,0%,100%,1);       --blade-gray-50: hsla(0,0%,97%,1);
  --blade-gray-100: hsla(200,10%,94%,1);   --blade-gray-200: hsla(204,8%,88%,1);
  --blade-gray-300: hsla(203,8%,80%,1);    --blade-gray-400: hsla(205,8%,71%,1);
  --blade-gray-500: hsla(203,8%,62%,1);    --blade-gray-600: hsla(202,8%,52%,1);
  --blade-gray-700: hsla(204,9%,42%,1);    --blade-gray-800: hsla(206,9%,34%,1);
  --blade-gray-900: hsla(206,10%,29%,1);   --blade-gray-1000: hsla(205,10%,24%,1);
  --blade-gray-1100: hsla(200,10%,18%,1);  --blade-gray-1200: hsla(200,11%,11%,1);
  --blade-gray-1300: hsla(0,0%,2%,1);
  --blade-white: hsla(0,0%,100%,1);        --blade-black: hsla(0,0%,0%,1);
  --blade-black-a05: hsla(0,0%,0%,0.06);   --blade-black-a10: hsla(0,0%,0%,0.09);
  --blade-black-a50: hsla(0,0%,0%,0.18);   --blade-transparent: hsla(0,0%,100%,0);

  /* ============ SEMANTIC ALIASES (use THESE in product code) ============ */
  /* Surfaces */
  --surface-bg-page: var(--blade-gray-50);            /* app canvas */
  --surface-bg-cloud: var(--blade-gray-100);          /* sunken / subtle fill */
  --surface-bg-card: var(--blade-gray-0);             /* raised card = pure white */
  --surface-bg-primary-subtle: var(--blade-azure-50);
  --surface-bg-primary-intense: var(--blade-azure-500);
  /* Text */
  --text-normal: var(--blade-gray-1200);              /* body */
  --text-subtle: var(--blade-gray-1100);
  --text-muted: var(--blade-gray-800);                /* helper text */
  --text-placeholder: var(--blade-gray-600);
  --text-disabled: var(--blade-gray-500);
  --text-static-white: var(--blade-white);
  --text-primary: var(--blade-azure-600);             /* links */
  /* Borders */
  --border-subtle: var(--blade-gray-100);
  --border-muted: var(--blade-gray-200);              /* workhorse hairline */
  --border-normal: var(--blade-gray-300);
  /* Interactive — primary */
  --interactive-primary-default: var(--blade-azure-500);
  --interactive-primary-hover: var(--blade-azure-600);
  --interactive-primary-active: var(--blade-azure-700);
  --interactive-primary-faded: var(--blade-azure-50);
  --interactive-primary-disabled: var(--blade-azure-100);
  --interactive-gray-faded: var(--blade-gray-100);
  --interactive-gray-fadedHighlighted: var(--blade-gray-200);
  /* Feedback — Positive / Negative / Notice / Information / Neutral */
  --feedback-positive-bg-subtle: var(--blade-emerald-50);
  --feedback-positive-bg-intense: var(--blade-emerald-600);
  --feedback-positive-border: var(--blade-emerald-300);
  --feedback-positive-text: var(--blade-emerald-700);
  --feedback-positive-icon: var(--blade-emerald-600);
  --feedback-negative-bg-subtle: var(--blade-crimson-50);
  --feedback-negative-bg-intense: var(--blade-crimson-500);
  --feedback-negative-border: var(--blade-crimson-300);
  --feedback-negative-text: var(--blade-crimson-600);
  --feedback-negative-icon: var(--blade-crimson-500);
  --feedback-notice-bg-subtle: var(--blade-cider-50);
  --feedback-notice-bg-intense: var(--blade-cider-600);
  --feedback-notice-border: var(--blade-cider-300);
  --feedback-notice-text: var(--blade-cider-700);
  --feedback-notice-icon: var(--blade-cider-600);
  --feedback-information-bg-subtle: var(--blade-sapphire-50);
  --feedback-information-bg-intense: var(--blade-sapphire-600);
  --feedback-information-border: var(--blade-sapphire-300);
  --feedback-information-text: var(--blade-sapphire-700);
  --feedback-information-icon: var(--blade-sapphire-600);
  --feedback-neutral-bg-subtle: var(--blade-gray-100);
  --feedback-neutral-text: var(--blade-gray-900);

  /* ============ TYPOGRAPHY ============ */
  --font-text: "Inter", Arial, sans-serif;
  --font-heading: "TASA Orbiter", "Inter", Arial, sans-serif;
  --font-code: "Menlo", "SF Mono", "Courier New", monospace;
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;
  /* Size ramp (px) — 14 is base body */
  --fs-25:10px; --fs-50:11px; --fs-75:12px; --fs-100:14px; --fs-200:16px;
  --fs-300:18px; --fs-400:20px; --fs-500:24px; --fs-600:32px; --fs-700:40px;
  --fs-800:48px; --fs-900:56px; --fs-1000:64px; --fs-1100:72px;
  /* Line heights (px) */
  --lh-25:13px; --lh-50:16px; --lh-75:17px; --lh-100:20px; --lh-200:24px;
  --lh-300:24px; --lh-400:26px; --lh-500:32px; --lh-600:38px; --lh-700:46px;
  --lh-800:56px; --lh-900:64px; --lh-1000:70px; --lh-1100:78px;
  /* Letter spacing — display tightening */
  --ls-tightest:-3.3px; --ls-tight:-1.3px; --ls-normal:0px;

  /* ============ SPACING (4px base, 2px micro-step) ============ */
  --space-0:0px; --space-1:2px; --space-2:4px; --space-3:8px; --space-4:12px;
  --space-5:16px; --space-6:20px; --space-7:24px; --space-8:32px; --space-9:40px;
  --space-10:48px; --space-11:56px;

  /* ============ RADIUS ============ */
  --radius-none:0px; --radius-2xsmall:2px; --radius-xsmall:4px; --radius-small:8px;
  --radius-medium:12px;   /* DEFAULT for cards & buttons */
  --radius-large:16px; --radius-xlarge:20px; --radius-2xlarge:24px;
  --radius-max:9999px;    /* pills / switches */
  --radius-round:50%;     /* avatars */

  /* ============ BORDER WIDTH ============ */
  --border-width-none:0px; --border-width-thinner:0.5px; --border-width-thin:1px;
  --border-width-thick:1.5px; --border-width-thicker:2px;

  /* ============ BACKDROP BLUR ============ */
  --blur-low:4px; --blur-medium:8px; --blur-high:12px;

  /* ============ BREAKPOINTS ============ */
  --bp-xs:320px; --bp-s:480px; --bp-m:768px; --bp-l:1024px; --bp-xl:1200px;

  /* ============ MOTION ============ */
  --motion-duration-2xquick:80ms; --motion-duration-xquick:160ms;   /* hovers */
  --motion-duration-quick:200ms;  --motion-duration-moderate:280ms; /* toggles */
  --motion-duration-xmoderate:360ms; --motion-duration-gentle:480ms;
  --motion-duration-xgentle:640ms; --motion-duration-2xgentle:960ms;
  --motion-easing-linear:cubic-bezier(0,0,0,0);
  --motion-easing-entrance:cubic-bezier(0,0,0.2,1);
  --motion-easing-exit:cubic-bezier(0.17,0,1,1);
  --motion-easing-standard:cubic-bezier(0.3,0,0.2,1);   /* default */
  --motion-easing-emphasized:cubic-bezier(0.5,0,0,1);
  --motion-easing-overshoot:cubic-bezier(0.5,0,0.3,1.5);/* switch knob */
  --motion-easing-shake:cubic-bezier(1,0.5,0,0.5);

  /* ============ ELEVATION (cool, low-spread blue-gray shadows) ============ */
  --elevation-none:none;
  --elevation-lowRaised:                 /* cards */
    0px 1px 2px hsla(206,10%,29%,0.09), 0px 0px 1px hsla(206,10%,29%,0.12);
  --elevation-midRaised:                 /* menus / overlays */
    0px 4px 8px hsla(206,10%,29%,0.09), 0px 0px 1px hsla(206,10%,29%,0.18);
  --elevation-highRaised:                /* modals */
    0px 6px 32px 4px hsla(205,8%,71%,0.06), 0px 0px 1px hsla(206,10%,29%,0.18);
}
```

---

## 2 · Content fundamentals (voice & copy)

- **Voice:** clear, confident, business-like but warm. Speaks to merchants and finance
  teams — competent and reassuring, never playful or jokey.
- **Person:** second person for user actions ("Complete your KYC", "Add money");
  first-person-plural sparingly for the platform ("We'll settle this by 7 PM"). Avoid "I".
- **Casing:** **sentence case everywhere** — buttons, headings, nav, table headers.
  ("Create payment link", not "Create Payment Link".) Product names keep casing:
  Razorpay, RazorpayX, Payment Links, Magic Checkout, UPI AutoPay.
- **CTAs:** verb-first and specific — "Create payment link", "Add money", "Complete KYC",
  "Download report". Never bare "Submit / OK".
- **Numbers & money:** Indian numbering with ₹ and lakh/crore grouping (`₹12,84,500`).
  IDs are monospace (`pay_NfQ2x9`). Deltas terse (`+12.4%`, `94.2%`).
- **Status words:** short, factual — Captured, Pending, Failed, Processed, Processing,
  Queued, Reversed, Settled, Refunded.
- **Errors:** plain and actionable — "Insufficient balance in your account.", "Enter a
  valid amount." No blame, no exclamation marks.
- **Emoji:** none in product UI. Iconography carries all visual signalling.
- **Density:** information-dense but calm — bold primary values with small muted helper
  text beneath; generous whitespace around cards.

---

## 3 · Visual foundations

- **Color.** Signature is **Azure 500** (~`#1364F1`) for every primary action, link and
  active state; **Azure 1000** navy anchors dark surfaces (RazorpayX sidebar, balance
  hero). Feedback is fixed: emerald = positive, crimson = negative, cider = notice,
  sapphire = information. Neutrals are a cool blue-gray: page = `gray.50`, cards = pure
  white (`gray.0`), borders = `gray.200/300`, body text = `gray.1200`.
- **Type.** **TASA Orbiter** for headings/display (geometric, warm, tight tracking) +
  **Inter** for body/UI. Code = **Menlo**. Fixed ramp; 14px base. Negative letter-spacing
  on display sizes. Weights 400/500/600/700.
- **Spacing.** 4px base, 2px micro-step. Card padding 20–24px; section gaps 16–20px.
- **Radius.** **12px (medium)** default for cards & buttons; 8px inputs/menus; `max`
  pills/switches; 50% avatars.
- **Borders.** Hairline `1px gray.200` is the workhorse separator. Inputs get a 1px
  border that turns brand-blue on focus with a 3px `azure.50` ring.
- **Shadows.** Subtle, cool, low-spread blue-gray alphas: `lowRaised` (cards),
  `midRaised` (menus), `highRaised` (modals). No heavy/warm drop shadows.
- **Backgrounds.** Flat. Light-gray canvas, white cards. Only expressive surface is the
  solid navy hero/sidebar. **No gradients, no textures, no background imagery** in product.
- **Motion.** Quick, purposeful. 80–960ms; `xquick` 160ms hovers, `quick` 200ms toggles.
  Easing `standard (0.3,0,0.2,1)` default; `overshoot` for the switch knob. Fades & small
  slides — never bouncy decorative loops.
- **States.** Hover darkens brand one step (500→600); press one more (→700) + tiny
  `scale(0.98)`. Ghost/tertiary buttons fill with a faint tint on hover. Disabled = 50%
  opacity. Focus = brand-blue ring.
- **Layout.** Fixed left sidebar (248px) + sticky 64px top bar + scrolling content. Metric
  cards in 3–4 col grids; main content + a narrow right rail for summary widgets.

---

## 4 · Iconography

- Blade ships a proprietary **~340-icon set**: 24×24 viewBox, **2px stroke, rounded
  caps/joins, `fill="none"`**, colored via `currentColor`. Visually Feather/Lucide-derived.
- Icons are React components named `<Thing>Icon` (`SearchIcon`, `CreditCardIcon`,
  `SettlementsIcon`) plus Razorpay glyphs (`RazorpayIcon`, `RazorpayXIcon`,
  `MagicCheckoutIcon`, `UpiIcon`).
- **No emoji, no unicode glyphs** as icons anywhere.
- **Substitute for agents:** use **[Lucide](https://lucide.dev)** (or Feather) — identical
  2px-stroke rounded 24px language. Flag it as a stand-in; for production, pull the real
  icons from `@razorpay/blade`.

---

## 5 · Component recipes

Ready-to-use CSS built from the tokens above. Match these exactly.

### Button
```css
.btn { font: var(--fw-semibold) var(--fs-100)/1 var(--font-text);
  padding: 10px 16px; border-radius: var(--radius-medium); border: none;
  cursor: pointer; transition: background var(--motion-duration-xquick) var(--motion-easing-standard),
  transform var(--motion-duration-2xquick) var(--motion-easing-standard); }
.btn--primary { background: var(--interactive-primary-default); color: #fff; }
.btn--primary:hover { background: var(--interactive-primary-hover); }
.btn--primary:active { background: var(--interactive-primary-active); transform: scale(0.98); }
.btn--secondary { background: transparent; color: var(--interactive-primary-default);
  box-shadow: inset 0 0 0 1px var(--interactive-primary-default); }
.btn--tertiary { background: transparent; color: var(--text-normal);
  box-shadow: inset 0 0 0 1px var(--border-normal); }
.btn--tertiary:hover, .btn--secondary:hover { background: var(--interactive-primary-faded); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

### Card
```css
.card { background: var(--surface-bg-card); border: 1px solid var(--border-muted);
  border-radius: var(--radius-medium); box-shadow: var(--elevation-lowRaised);
  padding: var(--space-7); } /* 24px */
```

### Text input
```css
.input { font: var(--fs-100)/1.4 var(--font-text); color: var(--text-normal);
  background: var(--surface-bg-card); border: 1px solid var(--border-normal);
  border-radius: var(--radius-small); padding: 10px 12px;
  transition: border var(--motion-duration-xquick), box-shadow var(--motion-duration-xquick); }
.input::placeholder { color: var(--text-placeholder); }
.input:focus { outline: none; border-color: var(--interactive-primary-default);
  box-shadow: 0 0 0 3px var(--surface-bg-primary-subtle); }
```

### Badge / status pill
```css
.badge { display: inline-flex; align-items: center; gap: 6px;
  font: var(--fw-medium) var(--fs-75)/1 var(--font-text); padding: 4px 10px;
  border-radius: var(--radius-max); }
.badge--positive { background: var(--feedback-positive-bg-subtle); color: var(--feedback-positive-text); }
.badge--negative { background: var(--feedback-negative-bg-subtle); color: var(--feedback-negative-text); }
.badge--notice   { background: var(--feedback-notice-bg-subtle);   color: var(--feedback-notice-text); }
.badge--info     { background: var(--feedback-information-bg-subtle); color: var(--feedback-information-text); }
.badge--neutral  { background: var(--feedback-neutral-bg-subtle); color: var(--feedback-neutral-text); }
```

### Money amount
Bold primary value + small muted helper. Indian grouping + ₹.
```css
.amount { font: var(--fw-bold) var(--fs-600)/1 var(--font-heading); color: var(--text-normal);
  font-feature-settings: "tnum" 1; letter-spacing: var(--ls-tight); }
.amount__sub { font: var(--fs-75)/1 var(--font-text); color: var(--text-muted); }
```
```html
<div class="amount">₹12,84,500<span class="amount__sub"> · +12.4% vs last week</span></div>
```

### App shell (dashboard layout)
```css
.shell { display: grid; grid-template-columns: 248px 1fr; height: 100vh; }
.sidebar { background: var(--surface-bg-card); border-right: 1px solid var(--border-muted); }
.topbar { height: 64px; position: sticky; top: 0; display: flex; align-items: center;
  padding: 0 var(--space-7); background: var(--surface-bg-card);
  border-bottom: 1px solid var(--border-muted); }
.content { background: var(--surface-bg-page); padding: var(--space-7); overflow: auto; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-5); }
```
Dark RazorpayX variant: sidebar/hero `background: var(--blade-azure-1000)`, text
`--text-static-white`, borders `hsla(0,0%,100%,0.12)`.

### Heading scale (typical usage)
- Display: `--fs-700/800` TASA Orbiter, `--fw-bold`, `--ls-tight`.
- Page title (H1): `--fs-500` (24px), `--fw-semibold`.
- Section (H2/H3): `--fs-300/400`, `--fw-semibold`.
- Body: `--fs-100` (14px) Inter, `--fw-regular`, color `--text-normal`.
- Helper/caption: `--fs-75` (12px), color `--text-muted`.

---

## 6 · Do / Don't

**Do**
- Use azure 500 for the single primary action per view; secondary actions are outlined.
- Keep surfaces flat and white on a gray canvas; reserve navy for one hero/sidebar.
- Sentence-case all copy; verb-first CTAs; ₹ + Indian grouping for money.
- Use the fixed feedback colors for status — never a random red/green.
- Hairline `gray.200` borders + `lowRaised` shadow for cards.

**Don't**
- No gradients, textures, or background images in product UI.
- No emoji or unicode-as-icon. Use Lucide/Feather (2px, rounded).
- No title-case. No heavy/warm shadows. No bouncy decorative animation.
- Don't invent colors — every value comes from a token.

---

*Generated from the Blade Design System project. Tokens are verbatim from
`@razorpay/blade@12.107.1`. Fonts (Inter, TASA Orbiter Display, Menlo) are self-hosted
from real brand binaries in `assets/fonts/`. Lucide substitutes for the proprietary icon
set — flag it if exact production fidelity is required.*
