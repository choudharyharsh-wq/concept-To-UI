"""
html_templates.py — Static scaffolding for the HTML render branch.

The HTML compiler produces ONE self-contained HTML document per screen. To keep
every screen visually consistent (same fonts, tokens, utilities) and to save
tokens, the *shell* (doctype, Tailwind CDN, fonts, base CSS, the tailwind.config
token block) is assembled here — NOT by the LLM. The LLM only generates each
screen's <body> inner HTML using the token class names this shell defines.

Two theme sources:
  • DS mode  → POP_THEME below (pre-baked from the POP Design System docs:
               dark surfaces, orange brand, Figtree). Deterministic, no LLM.
  • non-DS   → a ThemeSpec the LLM designs once per app (bespoke palette/vibe,
               à la a fresh M3 theme), assembled via build_theme_head_from_spec.
"""

from __future__ import annotations  # PEP 604 unions (X | None) on Python 3.9

import json
import re
from pathlib import Path

# Shared CDN / font tags injected into every document head.
_TAILWIND_CDN = (
    '<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>'
)
_MATERIAL_SYMBOLS = (
    '<link rel="stylesheet" '
    'href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:'
    'wght,FILL@100..700,0..1&display=swap"/>'
)


# ─────────────────────────────────────────────────────────────────────────────
# POP Design System theme (DS mode) — resolved from the DS token docs.
# Alias tokens are flattened to their parent hex values for Tailwind.
# ─────────────────────────────────────────────────────────────────────────────

_POP_FONT_LINK = (
    '<link rel="stylesheet" '
    'href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap"/>'
)

_POP_TAILWIND_CONFIG = """
<script id="tailwind-config">
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          "surface-primary":   "#0D0D0D",
          "surface-secondary": "#1F1F1F",
          "surface-tertiary":  "#4D4D4D",
          "surface-invert":    "#FFFFFF",
          "surface-brand":     "#FF7533",
          "text-primary":      "#E6E6E6",
          "text-secondary":    "#B3B3B3",
          "text-tertiary":     "#808080",
          "text-invert":       "#0D0D0D",
          "text-brand":        "#FF7533",
          "text-success":      "#3DC574",
          "text-destructive":  "#EE4D37",
          "border-primary":    "#262626",
          "border-secondary":  "#333333",
          "border-brand":      "#FF5200",
          "icon-primary":      "#E6E6E6",
          "brand":             "#FF5200",
          "brand-strong":      "#E84B00",
          "success":           "#0DB651",
          "destructive":       "#EE4D37",
          "warning":           "#FBBC09"
        },
        fontFamily: { sans: ["Figtree", "sans-serif"] },
        borderRadius: {
          "sm": "8px", "DEFAULT": "12px", "lg": "16px",
          "xl": "20px", "2xl": "24px", "3xl": "32px", "full": "999px"
        },
        fontSize: {
          "display-lg": ["36px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "800" }],
          "display":    ["32px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "700" }],
          "display-sm": ["24px", { lineHeight: "30px", letterSpacing: "-0.02em", fontWeight: "700" }],
          "heading":    ["20px", { lineHeight: "26px", fontWeight: "700" }],
          "heading-sm": ["16px", { lineHeight: "24px", fontWeight: "500" }],
          "body":       ["16px", { lineHeight: "24px", fontWeight: "500" }],
          "body-sm":    ["14px", { lineHeight: "22px", fontWeight: "500" }],
          "label":      ["14px", { lineHeight: "20px", fontWeight: "600" }],
          "label-sm":   ["12px", { lineHeight: "16px", fontWeight: "600" }]
        }
      }
    }
  };
</script>
"""

_POP_BASE_CSS = """
<style>
  body {
    font-family: 'Figtree', sans-serif;
    background-color: #0D0D0D;
    background-image: radial-gradient(120% 80% at 50% 0%, #1D1D1D 0%, #0D0D0D 60%);
    color: #E6E6E6;
    min-height: max(844px, 100dvh);
  }
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .icon-fill { font-variation-settings: 'FILL' 1; }
  /* Brand glow for primary CTAs / active elements */
  .glow-brand { box-shadow: 0 8px 32px -4px rgba(217, 65, 0, 0.30); }
  .glow-success { box-shadow: 0 8px 32px -4px rgba(33, 195, 33, 0.25); }
  .squishy:active { transform: scale(0.96); }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
"""

# A short prose brief handed to the screen-builder LLM so it uses the token
# classes correctly and stays on-brand.
POP_DESIGN_LANGUAGE = """POP UPI design system — a premium DARK fintech theme.
Surfaces are near-black (bg-surface-primary #0D0D0D page, bg-surface-secondary #1F1F1F cards),
text is light (text-text-primary / text-text-secondary), and the brand is a vivid orange
(bg-brand / text-text-brand #FF5200). Use rounded-2xl/3xl cards, the `glow-brand` utility on
primary CTAs, `font-sans` (Figtree) everywhere, and Material Symbols icons. Success is green
(#0DB651), destructive red (#EE4D37). Never use a light/white page background."""


def pop_theme_head() -> str:
    """Return the full <head> inner markup for POP (DS) mode (hardcoded fallback)."""
    return (
        f'{_TAILWIND_CDN}\n{_POP_FONT_LINK}\n{_MATERIAL_SYMBOLS}\n'
        f'{_POP_TAILWIND_CONFIG}\n{_POP_BASE_CSS}'
    )


# ─────────────────────────────────────────────────────────────────────────────
# DS theme from design.md (single source of truth for DS mode)
#
# server/design.md holds a Stitch-style spec: YAML frontmatter (name, colors,
# typography, rounded, spacing, strokes) + prose design language. When the user
# enables DS mode, the HTML compiler builds its Tailwind theme + design-language
# brief from THIS file instead of the hardcoded POP block above.
# ─────────────────────────────────────────────────────────────────────────────

# design1.md = the enriched POP spec (tokens + composition playbook + component/
# pattern recipe library, mined from ds_index.json). Falls back to design.md.
_DESIGN_MD_PATH = Path(__file__).parent.parent / "design1.md"
if not _DESIGN_MD_PATH.exists():
    _DESIGN_MD_PATH = Path(__file__).parent.parent / "design.md"
_design_cache: dict | None = None

# Google-Fonts-available substitutes. design.md may name a non-Google or
# commercial face (e.g. "Awesome Serif Italic"); we load a close web font and
# map it onto the same Tailwind family key so classes still resolve.
_FONT_FALLBACK = {
    "awesome serif italic": ("Playfair Display", "ital,wght@1,600;1,700"),
    "awesome serif":        ("Playfair Display", "wght@600;700"),
}
_DEFAULT_WEIGHTS = "wght@300;400;500;600;700;800"


def _google_font_link(family: str, axis: str | None = None) -> str:
    fam = family.strip()
    key = fam.lower()
    if key in _FONT_FALLBACK:
        fam, axis = _FONT_FALLBACK[key]
    spec = axis or _DEFAULT_WEIGHTS
    fam_q = fam.replace(" ", "+")
    return (f'<link rel="stylesheet" '
            f'href="https://fonts.googleapis.com/css2?family={fam_q}:{spec}&display=swap"/>')


def _resolve_font(family: str) -> str:
    """Return the actual (Google-available) family name for a spec'd font."""
    return _FONT_FALLBACK.get(family.strip().lower(), (family, None))[0]


def load_design_md() -> dict | None:
    """
    Parse server/design.md → {"meta": <frontmatter dict>, "body": <prose str>}.
    Cached. Returns None if the file is missing or has no valid frontmatter.
    """
    global _design_cache
    if _design_cache is not None:
        return _design_cache or None
    if not _DESIGN_MD_PATH.exists():
        print(f"[DS] {_DESIGN_MD_PATH.name} not found — falling back to hardcoded POP theme.")
        _design_cache = {}
        return None
    try:
        import yaml
        raw = _DESIGN_MD_PATH.read_text()
        if not raw.lstrip().startswith("---"):
            raise ValueError("no frontmatter delimiter")
        _, fm, body = raw.split("---", 2)
        meta = yaml.safe_load(fm) or {}
        _design_cache = {"meta": meta, "body": body.strip()}
        print(f"[DS] Loaded {_DESIGN_MD_PATH.name} theme '{meta.get('name','?')}' "
              f"({len(meta.get('colors',{}))} colors, "
              f"{len(meta.get('typography',{}))} type styles).")
        return _design_cache
    except Exception as e:  # noqa: BLE001
        print(f"[DS] Failed to parse design.md ({e}); falling back to hardcoded POP theme.")
        _design_cache = {}
        return None


def _build_tailwind_extend(meta: dict) -> str:
    """Turn design.md frontmatter into a tailwind.config theme.extend JS object."""
    colors = meta.get("colors", {}) or {}

    # fontSize map: { "display-lg": ["36px", { lineHeight, fontWeight, letterSpacing }], ... }
    typ = meta.get("typography", {}) or {}
    font_size: dict = {}
    primary_font = "Figtree"
    serif_font = None
    for name, t in typ.items():
        if not isinstance(t, dict):
            continue
        opts = {}
        if t.get("lineHeight"):    opts["lineHeight"] = str(t["lineHeight"])
        if t.get("fontWeight"):    opts["fontWeight"] = str(t["fontWeight"])
        if t.get("letterSpacing"): opts["letterSpacing"] = str(t["letterSpacing"])
        font_size[name] = [str(t.get("fontSize", "16px")), opts]
        fam = (t.get("fontFamily") or "").strip()
        if fam:
            if "serif" in fam.lower() or "italic" in fam.lower():
                serif_font = serif_font or _resolve_font(fam)
            elif name in ("body-md", "body-lg") or primary_font == "Figtree":
                primary_font = _resolve_font(fam)

    font_family = {"sans": [primary_font, "sans-serif"]}
    if serif_font:
        font_family["serif"] = [serif_font, "serif"]

    extend = {
        "colors": colors,
        "fontFamily": font_family,
        "fontSize": font_size,
        "borderRadius": meta.get("rounded", {}) or {},
        "spacing": meta.get("spacing", {}) or {},
    }
    # JSON is a valid JS-object subset; Tailwind config accepts it verbatim.
    return json.dumps(extend, indent=2)


def _build_base_css(meta: dict) -> str:
    colors = meta.get("colors", {}) or {}
    bg   = colors.get("background") or colors.get("surface") or "#0d0d0d"
    text = colors.get("on-background") or colors.get("on-surface") or "#e6e6e6"
    primary_font = "Figtree"
    for name in ("body-md", "body-lg"):
        t = (meta.get("typography", {}) or {}).get(name)
        if isinstance(t, dict) and t.get("fontFamily"):
            primary_font = _resolve_font(t["fontFamily"]); break
    return f"""<style>
  body {{
    font-family: '{primary_font}', sans-serif;
    background-color: {bg};
    color: {text};
    min-height: max(844px, 100dvh);
  }}
  .material-symbols-outlined {{ font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }}
  .icon-fill {{ font-variation-settings: 'FILL' 1; }}
  .glow-brand {{ box-shadow: 0 8px 32px -4px rgba(217, 65, 0, 0.30); }}
  .glow-success {{ box-shadow: 0 8px 32px -4px rgba(33, 195, 33, 0.25); }}
  .squishy:active {{ transform: scale(0.96); }}
  .scrollbar-hide::-webkit-scrollbar {{ display: none; }}
  .scrollbar-hide {{ -ms-overflow-style: none; scrollbar-width: none; }}
</style>"""


def design_md_theme_head() -> str:
    """<head> inner markup for DS mode, built from design.md (falls back to POP)."""
    data = load_design_md()
    if not data:
        return pop_theme_head()
    meta = data["meta"]
    typ  = meta.get("typography", {}) or {}

    # Collect the fonts we need: the primary sans + any serif/expressive face.
    font_links, seen = [], set()
    def add_font(fam: str, axis: str | None = None):
        resolved = _resolve_font(fam)
        if resolved.lower() in seen:
            return
        seen.add(resolved.lower())
        font_links.append(_google_font_link(fam, axis))
    primary = "Figtree"
    for name in ("body-md", "body-lg", "display-lg"):
        t = typ.get(name)
        if isinstance(t, dict) and t.get("fontFamily"):
            primary = t["fontFamily"]; break
    add_font(primary)
    for t in typ.values():
        if isinstance(t, dict) and t.get("fontFamily"):
            fam = t["fontFamily"]
            if "serif" in fam.lower() or "italic" in fam.lower():
                add_font(fam, "ital,wght@1,600;1,700")

    config_block = (
        '<script id="tailwind-config">\n'
        '  tailwind.config = { darkMode: "class", theme: { extend: '
        f'{_build_tailwind_extend(meta)}'
        ' } };\n'
        '</script>'
    )
    return (
        f'{_TAILWIND_CDN}\n' + "\n".join(font_links) + f'\n{_MATERIAL_SYMBOLS}\n'
        f'{config_block}\n{_build_base_css(meta)}'
    )


def design_md_design_language() -> str:
    """Design-language brief for the screen builder, from design.md prose + tokens."""
    data = load_design_md()
    if not data:
        return POP_DESIGN_LANGUAGE
    meta   = data["meta"]
    colors = list((meta.get("colors", {}) or {}).keys())
    sizes  = list((meta.get("typography", {}) or {}).keys())
    radii  = list((meta.get("rounded", {}) or {}).keys())
    token_hint = (
        "\n\nAVAILABLE TOKEN CLASSES (use these exact names, never raw hex):\n"
        f"- Colors → bg-/text-/border-: {', '.join(colors)}\n"
        f"- Type   → text-: {', '.join(sizes)} (plus font-sans / font-serif)\n"
        f"- Radius → rounded-: {', '.join(radii)}\n"
        "Use the Material Symbols icon font for icons; never use raw white page backgrounds."
    )
    return f"{meta.get('name','Design System')} — design language:\n\n{data['body']}{token_hint}"


def design_md_body_bg() -> str:
    data = load_design_md()
    if not data:
        return "#0D0D0D"
    colors = data["meta"].get("colors", {}) or {}
    return colors.get("background") or colors.get("surface") or "#0D0D0D"


# ─────────────────────────────────────────────────────────────────────────────
# Blade design system (non-DS mode default)
#
# When the "Use POP Design System" toggle is OFF, screens are themed from
# server/design-blade.md — the Razorpay Blade spec (light theme, azure brand,
# Inter). Like POP, the visual head (Tailwind token config + fonts + base CSS) is
# translated deterministically from Blade's tokens here, while the *design
# language* brief is read live from the md prose so editing the file changes the
# output. Falls back to the LLM-designed bespoke theme only if the file is gone.
# ─────────────────────────────────────────────────────────────────────────────

_DESIGN_BLADE_PATH = Path(__file__).parent.parent / "design-blade.md"
_blade_cache: str | None = None  # None = not yet loaded; "" = missing/failed

_BLADE_FONT_LINK = (
    '<link rel="stylesheet" '
    'href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"/>'
)

_BLADE_TAILWIND_CONFIG = """
<script id="tailwind-config">
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          "surface-page":         "hsla(0,0%,97%,1)",
          "surface-cloud":        "hsla(200,10%,94%,1)",
          "surface-card":         "hsla(0,0%,100%,1)",
          "surface-brand-subtle": "hsla(217,100%,98%,1)",
          "brand":                "hsla(218,89%,51%,1)",
          "brand-hover":          "hsla(218,87%,43%,1)",
          "brand-active":         "hsla(218,89%,35%,1)",
          "text-normal":          "hsla(200,11%,11%,1)",
          "text-subtle":          "hsla(200,10%,18%,1)",
          "text-muted":           "hsla(206,9%,34%,1)",
          "text-placeholder":     "hsla(202,8%,52%,1)",
          "text-onbrand":         "hsla(0,0%,100%,1)",
          "text-link":            "hsla(218,87%,43%,1)",
          "border-subtle":        "hsla(200,10%,94%,1)",
          "border-muted":         "hsla(204,8%,88%,1)",
          "border-normal":        "hsla(203,8%,80%,1)",
          "positive":             "hsla(150,100%,28%,1)",
          "positive-subtle":      "hsla(150,39%,93%,1)",
          "positive-text":        "hsla(150,100%,23%,1)",
          "negative":             "hsla(5,73%,53%,1)",
          "negative-subtle":      "hsla(5,75%,97%,1)",
          "negative-text":        "hsla(4,85%,44%,1)",
          "notice":               "hsla(25,100%,44%,1)",
          "notice-subtle":        "hsla(23,100%,97%,1)",
          "notice-text":          "hsla(25,100%,39%,1)",
          "information":          "hsla(200,100%,41%,1)",
          "information-subtle":   "hsla(198,85%,95%,1)",
          "information-text":     "hsla(200,100%,33%,1)"
        },
        fontFamily: {
          sans:    ["Inter", "system-ui", "sans-serif"],
          heading: ["TASA Orbiter", "Inter", "system-ui", "sans-serif"]
        },
        borderRadius: {
          "none":"0px", "xs":"4px", "sm":"8px", "DEFAULT":"12px", "md":"12px",
          "lg":"16px", "xl":"20px", "2xl":"24px", "full":"9999px"
        },
        fontSize: {
          "helper":     ["12px", { lineHeight: "16px" }],
          "body":       ["14px", { lineHeight: "20px" }],
          "body-lg":    ["16px", { lineHeight: "24px" }],
          "h3":         ["18px", { lineHeight: "24px", fontWeight: "600" }],
          "h2":         ["20px", { lineHeight: "26px", fontWeight: "600" }],
          "h1":         ["24px", { lineHeight: "32px", fontWeight: "600" }],
          "display":    ["32px", { lineHeight: "38px", fontWeight: "700", letterSpacing: "-0.02em" }],
          "display-lg": ["40px", { lineHeight: "46px", fontWeight: "700", letterSpacing: "-0.03em" }]
        }
      }
    }
  };
</script>
"""

_BLADE_BASE_CSS = """
<style>
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background-color: hsla(0,0%,97%,1);
    color: hsla(200,11%,11%,1);
    min-height: max(844px, 100dvh);
  }
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .icon-fill { font-variation-settings: 'FILL' 1; }
  /* Blade elevation — cool, low-spread blue-gray shadows */
  .elevation-low  { box-shadow: 0px 1px 2px hsla(206,10%,29%,0.09), 0px 0px 1px hsla(206,10%,29%,0.12); }
  .elevation-mid  { box-shadow: 0px 4px 8px hsla(206,10%,29%,0.09), 0px 0px 1px hsla(206,10%,29%,0.18); }
  .elevation-high { box-shadow: 0px 6px 32px 4px hsla(205,8%,71%,0.06), 0px 0px 1px hsla(206,10%,29%,0.18); }
  /* Inputs: brand focus ring */
  .focus-ring:focus, .focus-ring:focus-visible { outline: none; border-color: hsla(218,89%,51%,1); box-shadow: 0 0 0 3px hsla(217,100%,98%,1); }
  .squishy:active { transform: scale(0.98); }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
"""

# Concise fallback used only if design-blade.md is missing.
BLADE_DESIGN_LANGUAGE = (
    "Razorpay Blade — a clean, business-like LIGHT design system. Page canvas is a light "
    "gray (bg-surface-page); cards are pure white (bg-surface-card) with a 1px border-muted "
    "hairline + `elevation-low` shadow. The single primary action per view is azure "
    "(bg-brand #1364F1, text-text-onbrand); secondary actions are outlined (border-brand, "
    "text-brand). Body text is text-text-normal on Inter; headings use font-heading. Sentence "
    "case everywhere; verb-first CTAs. Feedback colors are fixed: positive=emerald, "
    "negative=crimson, notice=cider/orange, information=sapphire. Flat surfaces — NO "
    "gradients, textures, or background images. Never a dark page background."
)

_BLADE_TOKEN_HINT = (
    "\n\nAVAILABLE TOKEN CLASSES (use these exact names, never raw hex):\n"
    "- Surfaces  → bg-: surface-page, surface-cloud, surface-card, surface-brand-subtle\n"
    "- Brand     → bg-/text-/border-: brand, brand-hover, brand-active\n"
    "- Text      → text-: text-normal, text-subtle, text-muted, text-placeholder, "
    "text-onbrand, text-link\n"
    "- Borders   → border-: border-subtle, border-muted, border-normal\n"
    "- Feedback  → bg-/text-/border-: positive(+-subtle,-text), negative(+-subtle,-text), "
    "notice(+-subtle,-text), information(+-subtle,-text)\n"
    "- Type      → text-: helper, body, body-lg, h3, h2, h1, display, display-lg "
    "(plus font-sans / font-heading)\n"
    "- Radius    → rounded-: xs, sm, DEFAULT(12px), md, lg, xl, 2xl, full\n"
    "- Elevation → elevation-low (cards), elevation-mid (menus), elevation-high (modals); "
    "focus-ring on inputs.\n"
    "Use the Material Symbols icon font for icons. This is a LIGHT theme — cards are white on "
    "a light-gray page; never use a dark/near-black page background."
)


def load_design_blade() -> str | None:
    """Return the raw design-blade.md text (cached). None if missing/unreadable."""
    global _blade_cache
    if _blade_cache is not None:
        return _blade_cache or None
    if not _DESIGN_BLADE_PATH.exists():
        print(f"[Blade] {_DESIGN_BLADE_PATH.name} not found — non-DS mode uses bespoke theme.")
        _blade_cache = ""
        return None
    try:
        _blade_cache = _DESIGN_BLADE_PATH.read_text()
        print(f"[Blade] Loaded {_DESIGN_BLADE_PATH.name} ({len(_blade_cache)} chars) "
              "for non-DS (toggle-off) theme.")
        return _blade_cache
    except Exception as e:  # noqa: BLE001
        print(f"[Blade] Failed to read {_DESIGN_BLADE_PATH.name} ({e}); using bespoke theme.")
        _blade_cache = ""
        return None


def blade_theme_head() -> str:
    """<head> inner markup for the Blade (toggle-off) theme."""
    return (
        f'{_TAILWIND_CDN}\n{_BLADE_FONT_LINK}\n{_MATERIAL_SYMBOLS}\n'
        f'{_BLADE_TAILWIND_CONFIG}\n{_BLADE_BASE_CSS}'
    )


def blade_design_language() -> str:
    """
    Design-language brief for the screen builder, read live from the md prose.
    Code fences (the CSS-var/recipe mechanism, which we replace with Tailwind
    token classes) are stripped so the LLM gets the *guidance*, not conflicting
    CSS. Appends the concrete Tailwind token-class list.
    """
    raw = load_design_blade()
    if not raw:
        return BLADE_DESIGN_LANGUAGE + _BLADE_TOKEN_HINT
    prose = re.sub(r"```.*?```", "", raw, flags=re.DOTALL)   # drop fenced code
    prose = re.sub(r"\n{3,}", "\n\n", prose).strip()
    return f"{prose}{_BLADE_TOKEN_HINT}"


def blade_body_bg() -> str:
    return "hsla(0,0%,97%,1)"  # Blade page canvas (gray.50)


# ─────────────────────────────────────────────────────────────────────────────
# Bespoke theme (non-DS mode) — assembled from an LLM-designed ThemeSpec.
# ─────────────────────────────────────────────────────────────────────────────

# Neutral fallback used only if theme generation fails — keeps the page valid.
_FALLBACK_THEME = {
    "font_family": "Inter",
    "google_fonts_url": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    "tailwind_extend": (
        '{ colors: { "primary": "#4F46E5", "surface": "#FFFFFF", '
        '"surface-alt": "#F4F4F5", "on-surface": "#18181B", "muted": "#71717A", '
        '"border": "#E4E4E7" }, fontFamily: { sans: ["Inter","sans-serif"] }, '
        'borderRadius: { "DEFAULT": "12px", "lg": "16px", "xl": "24px", "full": "999px" } }'
    ),
    "base_css": "body { font-family: 'Inter', sans-serif; background:#F4F4F5; color:#18181B; }",
    "body_bg": "#F4F4F5",
    "design_language": "Clean neutral theme: indigo primary, light surfaces, rounded cards.",
}


def build_theme_head_from_spec(spec: dict) -> str:
    """
    Assemble the <head> inner markup from an LLM-authored ThemeSpec dict.
    Falls back to safe defaults for any missing field so a partial/failed
    generation never produces an invalid document.
    """
    s = {**_FALLBACK_THEME, **{k: v for k, v in (spec or {}).items() if v}}

    font_link = f'<link rel="stylesheet" href="{s["google_fonts_url"]}"/>'
    config_block = (
        '<script id="tailwind-config">\n'
        '  tailwind.config = { darkMode: "class", theme: { extend: '
        f'{s["tailwind_extend"]}'
        ' } };\n'
        '</script>'
    )
    # Ensure the body has a background even if the model's base_css omits it.
    base_css = f'<style>\n{s["base_css"]}\nbody {{ min-height: max(844px, 100dvh); }}\n</style>'

    return (
        f'{_TAILWIND_CDN}\n{font_link}\n{_MATERIAL_SYMBOLS}\n'
        f'{config_block}\n{base_css}'
    )


# ─────────────────────────────────────────────────────────────────────────────
# Document assembler
# ─────────────────────────────────────────────────────────────────────────────

# Shipped in every document. `.img-ph` is an elegant, on-theme image placeholder
# (diagonal-stripe surface + centered icon + label) — used instead of gray boxes
# / external placeholder services, so mockups read as intentional design, not
# missing assets. The element also carries theme bg/text classes + a data-img-prompt.
_SHARED_UTIL_CSS = """<style id="c2d-utils">
  .img-ph {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    background-image: repeating-linear-gradient(45deg,
      rgba(150,150,150,0.10) 0, rgba(150,150,150,0.10) 1px,
      transparent 1px, transparent 13px);
    overflow: hidden; text-align: center;
  }
  .img-ph .material-symbols-outlined { font-size: 22px; opacity: 0.55; }
  .img-ph__label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; opacity: 0.6;
  }
</style>"""


def build_document(title: str, head_inner: str, body_inner: str, body_class: str = "") -> str:
    """
    Wrap an LLM-generated <body> inner HTML in a complete, self-contained
    document using the given head markup (POP or bespoke). The result renders
    standalone inside a sandboxed iframe with no external dependencies beyond
    the Tailwind/fonts CDNs.
    """
    cls = f' class="{body_class}"' if body_class else ""
    safe_title = (title or "Screen").replace("<", "").replace(">", "")
    return (
        '<!DOCTYPE html>\n'
        '<html lang="en">\n<head>\n'
        '<meta charset="utf-8"/>\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>\n'
        f'<title>{safe_title}</title>\n'
        f'{head_inner}\n'
        f'{_SHARED_UTIL_CSS}\n'
        '</head>\n'
        f'<body{cls}>\n{body_inner}\n</body>\n</html>'
    )
