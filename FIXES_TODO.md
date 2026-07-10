# Concept-to-UI — Fixes & Improvement Backlog

Goal: close the gap between current generated output and a designer-crafted,
on-brand, dark-theme POP DS flow (the "POPchop" target).

Work bottom-up: **Correctness → Fidelity foundation → Design intelligence.**
Polishing theme before correctness is painting a cracked wall.

Realistic ceiling: a competent designer's clean first draft using the DS (~80% of
the target feel). The bespoke ~20% (3D illustrations, the mini-game, custom motion)
is craft, not generation — template it or hand-finish.

---

## ✅ Already done (this session)

- **A — Schema:** added `props: Dict[str, str]` to `ElementSpec` (`server/src/nodes.py`)
  so an element can carry component property values (text + variants/booleans).
- **B — Prompt:** catalog hint now surfaces text props *with their defaults*
  (`Title text="Title", …`); added rules 13 / 13b telling the model to fill the
  visible Title/Label slot, not just `Placeholder text`.
- **C — Plugin DS apply** (`figma-plugin/code.js` `applyInstanceContent`):
  loads instance fonts, maps `props` → real `Name#id` keys, applies via
  `setProperties` by type, per-key retry on rejection, and a safety net that fills a
  title/label-named text slot from `label` when the model didn't.
- **Non-DS primitives:** `createElement` now renders visible text for `INPUT_FIELD`
  (bordered + placeholder), `LIST_ITEM` (row label), and top-bar/`NAV_BAR` titles.

---

## 🔴🔴 P0 — HTML Canvas: true per-screen live streaming

- [ ] **0. Replace LangGraph `custom` stream with a per-session `asyncio.Queue`.**
  **Status:** HTML canvas works, but only via the **bulk fallback** — all screens
  appear together when `html_compiler_node` finishes, not one-by-one as built.

  **Why the live path fails:** the node pushes each screen with LangGraph's injected
  stream `writer(...)` (`stream_mode="custom"`). That writer needs LangGraph's
  per-run config, stored in a **context variable** that is only valid while LangGraph
  is actively driving the node. We call the writer *right after* `await ...ainvoke()`
  on the LLM — control left our function for LangChain's call, and on resume the
  context var is gone, so `get_config()` raises
  `RuntimeError: Called get_config outside of a runnable context`.
  (Sync-node variant fails for the sibling reason: the context var isn't copied to
  the executor thread.)

  **What's in place now (do NOT remove until the fix lands):**
  - Fallback A: try injected `writer`, else `get_stream_writer()`.
  - Fallback B (the one actually working): node returns the full `html_screens`
    list on the normal `updates` channel; the frontend merges them onto the canvas
    on the node's `completed` event.
  - The `writer(...)` emit is wrapped non-fatal (disables after first failure, logs,
    keeps building) so a broken writer can never crash the run.

  **The fix:** own the channel instead of borrowing LangGraph's.
  - `server.py`: a module-level `dict[session_id] → asyncio.Queue`. In `_run_graph`,
    drain this queue concurrently with `astream` and emit each item as a
    `screen_ready` SSE event (same shape the frontend already handles).
  - `html_compiler_node`: instead of `writer(...)`, `queue.put_nowait(screen_obj)`
    keyed by `session_id` (thread `session_id` into state). No context var needed →
    works in sync or async, before or after awaits.
  - Keep bulk return as the final reconciliation (idempotent merge already exists
    frontend-side).
  - ~30–40 lines. Removes the only reason screens don't trickle in live; matters most
    at full scale (24+ screens) where bulk = one long wait vs. progressive reveal.

## 🔴 Layer 1 — Correctness (table stakes: components show real content)

- [ ] **1. Hide unfilled optional secondary text.** Components have optional text
  (e.g. `Checkbox with Text` → `Body` boolean default **True** + `Body text`) that
  fall back to live boilerplate ("To continue, please accept this"). When the model
  provides no secondary text, the plugin should turn the gating boolean **off**.
  Heuristic: pair boolean `X` with text `X text` / `X`; if text not provided → set `X=False`.
- [ ] **2. Fill the primary text slot regardless of prop name.** `Link button`'s text
  prop isn't title/label-named, so the safety net misses it and it shows its default
  ("Activate" + ○ from R-Icon). Fix: if the model set **no** text-type prop, fill the
  best text slot (title/label-named → "text"-named → first TEXT prop) from `label`.
- [ ] **3. Button text overflow / clipping.** "Browse All Products" → "vse All Prod",
  "Proceed to Checkout" → "eed to Che". Buttons not sizing to their label. Suspect
  `instance.resize()` fighting the component's auto-layout (hug) and/or `Title:True`.
  Needs a live-node inspection to root-cause, then fix (don't force-resize hug
  components; let them hug, only set width when fixed-size).
- [ ] **4. Out-of-range variant values.** Model emits option values not in the list
  (e.g. `Digit count` rejected — only `4`/`6` allowed). Plugin already isolates the
  bad key; tighten the prompt: "only emit a variant value that exactly matches a
  listed option, else omit it."

## 🟠 Layer 2 — Fidelity foundation (data + layout engine)

- [ ] **5. Live component schema (source of truth).** The doc-derived `ds_index` ≠ the
  real Figma components (Link button missing its text prop; Checkbox body default
  wrong). Read each key's real `componentPropertyDefinitions` (name, type, default,
  variantOptions) via the plugin once, dump to JSON, and use THAT as the rendering
  contract for both the model and the plugin. Permanently kills the wrong-prop /
  boilerplate class of bugs.
- [ ] **6. Auto-layout renderer.** Replace flat absolute positioning (`children` =
  metadata only) with **nested auto-layout frames** (layoutMode + padding + gap).
  Biggest single visual-polish jump: consistent spacing, no overlaps, no clipping.
  Requires the wireframe schema to become a tree and the plugin to build nested frames.

## 🟡 Layer 3 — Design intelligence (the "feel")

- [ ] **7. Commit a dark theme + enforce tokens.** Current e-commerce run rendered
  *light*; DS is dark. Force screen backgrounds + primitive fills to surface/text/
  border tokens (no raw white). Add a global theme directive.
- [ ] **8. Apply gradients + glow effects.** We extracted the gradient paint styles &
  glow effects — use them on hero surfaces for the purple POPchop mood (currently unused).
- [ ] **9. Pattern/organism-level composition.** Model assembles low-level atoms. Bias
  IA/UX/selection stages toward richer DS patterns & organisms (already indexed);
  fewer, better-composed blocks per screen.
- [ ] **10. Content realism / copy.** Better prompting for realistic, domain-specific
  copy and data. (Bespoke art / mini-game are out of scope — template or hand-finish.)

## 🔵 Other observed issues (lower priority)

- [ ] **11. Near-empty screens.** Compiler sometimes emits screens with only 1–3 bare
  `FRAME`s and no content (e.g. bills run: "Upcoming Bills List", "Saved Billers",
  "Edit Saved Biller"). IA/compiler issue.
- [ ] **12. Repeated identical placeholder image** across all product cards (cosmetic).
- [ ] **13. Empty placeholder boxes** for sliders / image galleries (DS slider not
  rendering; image placeholders show nothing useful).
- [ ] **14. ds_index unmatched components.** 33 of 189 documented components have no
  importable key (internal `.`/`_` parts, "New"/variant names). Revisit if any should
  map to a registry entry (see merge report). Partly subsumed by #5 (live schema).

---

## Notes / how to verify
- Figma MCP is connected (auth OK as Harsh). Read tools: `get_metadata` (structure),
  `get_screenshot` (visual), `get_design_context` (props/code), `get_variable_defs`.
  All require `fileKey` (+ `nodeId` for screenshot/context).
- Live render payload is fetchable at `http://localhost:5001/payload` (the bridge) —
  useful for inspecting exactly what `props` the model emitted per element.
- Test file: `https://www.figma.com/design/Vw1D3YC8XG3uokEHMlhl4T/Testing-the-outputs`
- Key finding from MCP inspection: DS adoption is actually HEALTHY (~107 instances in a
  21-screen run); the logs only print *fallbacks*, so successful DS instances look
  invisible. Don't trust the log volume of `[FALLBACK]` lines as a DS-usage signal.
