# Concept → POP UI: How the pipeline generates design-system screens

> Deep-dive on the concept→POP-screen path, focused on how `design.md` is read and used
> to produce POP-design-system-like screens. Self-contained (no code reading required).

## 1. Stack & shape
- Backend: Python + FastAPI, orchestrated with LangGraph (a state-graph of nodes). Each node reads/writes a shared `GraphState` dict.
- LLM: Anthropic Claude Opus 4.8 for every node (via langchain_anthropic), mostly with structured output (Pydantic schemas -> forced valid JSON).
- Frontend: Next.js. Screens stream over SSE and render on a tldraw canvas (each screen = isolated <iframe srcdoc>).
- Two output modes: `figma` and `html`. This doc covers `html` mode with the POP design system on.

## 2. Stage flow (concept -> screens)
1. PRD node — concept -> structured PRD JSON (summary, persona, happy path, P0/P1 features, non-goals, ux_anchor_directives = {visual_posture, tone, layout_hint}).
2. PRD Review node — LLM "Design Head" scores the PRD; can pause for human feedback (graph interrupt), then resumes.
3. IA node — PRD -> InformationArchitectureBlueprint: pages[] each {id, name, parent_id, access_level, layout_pattern, component_inventory[]}. (dev max_screens cap can truncate here.)
4. User Flow node — 3 golden happy-path flows across page ids.
5. UX Layout node — per page: ScreenLayoutPlan {grid_system, scroll_behavior, spatial_zones[] {zone_id, visual_weight(P1_Dominant/P2/P3), width%, height%, rendering_sequence[]}, ux_principles, empty_state_guidance}. Batched 4/call.
6. Fork on output_mode: html -> html_compiler_node; figma -> wireframe_compiler_node -> render_node.

By the HTML compiler we have PRD + IA + flows + per-screen UX zones (structural brief). The design system supplies the visual/compositional brief.

## 3. HTML compiler (html_compiler_node)
Inputs: ia_data, ux_layout_data, prd_data, concept, user_flow_data, use_ds.
is_ds_mode = use_ds AND (POP registry loaded).

Phase 1 — resolve ONE app-wide theme:
- DS mode: theme from design.md (currently design1.md) via design_md_theme_head() (the <head>), design_md_design_language() (prose brief), design_md_body_bg().
- Non-DS: an LLM ThemeSpec designed per concept.
Theme resolved once, shared by all screens.

Phase 2 — generate each screen's <body>:
- Batches of 2, Opus structured output (HtmlScreenCollection: {screen_id, screen_name, viewport_width, viewport_height, body_html}), max_tokens=16000.
- System prompt = fixed base (_HTML_SYSTEM_BASE: output only <body> inner HTML, mobile-first, use theme token classes only, Material Symbols, img-ph placeholder rule, content realism, respect zones) + design-language brief from design.md.
- User prompt (per batch) = IA pages (name + component_inventory) + UX zones (grid, scroll, visual_weight, rendering_sequence, empty_state_guidance) + PRD ux_anchor_directives + user flows.
- Each body_html wrapped by build_document() into a full doc: <head>(theme) + shared .img-ph stylesheet + <body>.
- Screens stream one-by-one and return in html_screens.

## 4. How design.md is read and used (DS core)
design.md (currently design1.md) = one file, two layers:

(A) YAML frontmatter -> machine/token layer. Keys: colors, typography, rounded, spacing, strokes.
- load_design_md() parses frontmatter (PyYAML) + keeps prose body. Cached.
- _build_tailwind_extend(meta) -> tailwind.config theme.extend:
  - colors (surface, on-surface, primary, brand, success...) -> Tailwind color names -> bg-surface, text-on-surface, border-outline...
  - typography -> fontSize scale (text-display-lg...) + fontFamily.sans (Figtree) + serif for expressive.
  - rounded -> borderRadius; spacing -> spacing scale.
- design_md_theme_head() emits <head>: Tailwind CDN, Google Fonts (Figtree; Awesome Serif Italic substituted by a Google serif), generated tailwind.config, base CSS.
- Net effect: frontmatter becomes the token vocabulary as real Tailwind classes.

(B) Markdown prose -> "design grammar" layer (the richer part).
- design_md_design_language() returns the full prose body + an auto "AVAILABLE TOKEN CLASSES" hint.
- Prose contains: brand & feel; screen anatomy (top bar -> hero/P1 -> cards+lists+section headers -> one CTA -> bottom nav); layout & spacing rhythm; elevation grammar (tonal layering, glow-once-per-zone, gradients, scrims); typography/iconography/token-discipline rules; a pattern & component recipe catalog (navigation, cards/bento/carousel, payment-list & transaction rows, inputs, buttons/chips, POPcoin/offers, bottom sheets/popups, results/empty states) each as what/when/rules, mined from ds_index.json (189 components) + DS docs; and a do/don't checklist.
- How it reaches the model: the whole prose brief (~14k chars) is concatenated into the SYSTEM prompt every batch. The screen's IA/UX structure goes in the USER prompt. Model writes body_html using token classes; the tailwind.config in head renders them.

## 5. What the model receives per screen
- System: output rules + full POP design brief + exact token-class names.
- User: this screen's name + component_inventory + spatial zones (visual weights, order) + brand tone + flows.
- Returns: body_html using theme classes + Material Symbols + img-ph placeholders.

## 6. Known limitations (for improvement)
1. Recipes are PROSE, not real component markup — model reconstructs each component from a description; never sees actual POP component HTML.
2. No retrieval/targeting — whole ~14k brief injected every batch regardless of screen type.
3. ds_index.json not used in HTML mode beyond the on/off flag; its rich per-component data only feeds the Figma path.
4. No critique/refine pass — one-shot per batch.
5. Abstract UX layout — zones are weight + width/height% + inventory order; coarse.
6. Batch of 2 limits app-level coherence.
7. Placeholders, not real images (elegant img-ph stripes now).
8. No exemplars — model never saw a real senior POP screen (image or code), only rules.

## 7. Questions for improvement
- Would real POP component HTML snippets (copy-paste recipes) beat prose descriptions? How to structure them?
- Is retrieval (inject only patterns relevant to each screen archetype) worth it vs dumping the whole brief?
- Where would a critique->revise pass help most, and what rubric?
- Should there be an explicit per-screen "design brief" step (decide composition in POP terms before HTML)?
- How to best use a small set of real designer exemplars (few-shot vs distilled rules vs recipes)?

## Appendix — key files
- server/src/nodes.py — LangGraph nodes incl. html_compiler_node, _theme_for_html, _HTML_SYSTEM_BASE, HtmlScreenCollection.
- server/src/html_templates.py — load_design_md, _build_tailwind_extend, design_md_theme_head, design_md_design_language, build_document, shared .img-ph CSS.
- server/design1.md — enriched POP spec (frontmatter tokens + prose playbook + recipe catalog). design.md is fallback.
- server/figma-DS-extracts/ds_index.json — 189 POP components + foundations (tokens, effects, 28 global_rules).
- server/src/graph.py — node wiring and output_mode fork.
