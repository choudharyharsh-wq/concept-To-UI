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
    """Return the full <head> inner markup for POP (DS) mode."""
    return (
        f'{_TAILWIND_CDN}\n{_POP_FONT_LINK}\n{_MATERIAL_SYMBOLS}\n'
        f'{_POP_TAILWIND_CONFIG}\n{_POP_BASE_CSS}'
    )


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
        '</head>\n'
        f'<body{cls}>\n{body_inner}\n</body>\n</html>'
    )
