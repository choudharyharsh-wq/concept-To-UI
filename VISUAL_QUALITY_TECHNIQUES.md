# Improving Visual Quality: A History of What We've Tried

*Concept-to-UI pipeline — techniques attempted to close the gap between generated screens and designer-crafted output.*

This document reconstructs every approach we've taken to improve the visual quality of generated screens, based on the full commit history (36 commits, June 8 – July 10) plus pre-repo design-system work. It's organized chronologically so the reasoning behind each pivot is visible — most of these approaches were direct reactions to specific failures in the one before it.

---

## Executive summary

The work falls into three broad phases:

1. **Teach the model our design system's vocabulary** (extract Figma components, curate the DS into a single reference file) — this got the model using the *right* colors, fonts, and component names, but not the *right way*.
2. **Teach the model our design system's grammar** (screen anatomy, hierarchy rules, do/don't lists, named pattern recipes) — this closed the "nuance" gap the vocabulary-only approach couldn't.
3. **Change the rendering path itself** (Figma-plugin wireframes → deterministic HTML/CSS) — because a large share of visual defects turned out to be caused by *how* we were rendering, not just *what* the model was told to render.

Two review/critique mechanisms were built (a human-in-the-loop PRD reviewer, and planned-but-never-built IA/Layout reviewers), and one design system swap (POP → Razorpay Blade as the default theme) is now live.

---

## Phase 1 — Teaching vocabulary

### 1.1 Extracting the design system from Figma (~4,000 → 40 components per screen)

We pulled every component and variant out of our Figma library via the API — **4,171 raw entries**, one per variant (e.g. every size/state combination of a single button counted separately). That's far too much for a model to reason about in one prompt, so we built a filter: for each screen, score components by keyword overlap with what that screen needs, keep the **top ~40**, and always force-include a small "essential" set (button, nav, tab, card, text, input, header) so every screen has baseline building blocks regardless of what the scorer picked.

*Why:* an LLM can't hold 4,000 variant strings in context and pick sensibly.
*Outcome:* worked as a filtering mechanism, but at this stage each component was just a name and a Figma key — no description, no usage guidance. The model could reference "PaymentCard" correctly by name but had no information about when or how to use it.

### 1.2 From raw DS files to a single structured reference

Before this even reached the pipeline, we'd already broken multiple design-system documents down to atomic/molecular/organism level by hand (colors, type scale, spacing, atoms, molecules, organisms, patterns — roughly 7,600 lines across 11 files). We then used an LLM (deliberately the strongest model available, not the cheap/fast one we use for the actual pipeline — this was a one-time, quality-first build) to extract structured specs from those files — descriptions, variant options, semantic use cases, do/don't rules — and joined them against the Figma component list by ID and name.

*Why:* the raw Figma extraction had names but no meaning; the hand-broken-down DS docs had meaning but no live Figma keys. Joining them gives both.
*Outcome:* produced a **189-component index**, 156 of them matched to a real importable Figma component. This became the live reference the pipeline draws from, and later fed directly into the richer spec described in Phase 2.

### 1.3 Testing the DS file on other platforms

We took the resulting DS reference file and ran it through Claude Design, our own platform, and Google Stitch to compare outputs.

*Finding, and the key insight that shaped everything after it:* the **vocabulary** was correct — colors and fonts were being picked correctly — but the **language** was wrong. The model knew *what* a component or token was called but not *how and where* to use it. This is the gap Phase 2 exists to close.

---

## Phase 2 — Teaching grammar, not just vocabulary

### 2.1 First single-file design spec (`design.md`), modeled on Google Stitch

We studied how Google Stitch generates its own condensed design-spec file and used that as a template to consolidate our scattered DS files into one short, crisp `design.md` — a token block (colors, type, spacing, radius) plus prose sections on brand, layout, and components. Critically, we made **token resolution deterministic**: the token block is parsed directly into real CSS/Tailwind classes by our own code, not re-interpreted by the LLM every time. The LLM only handles composition guidance, not color math.

*Outcome:* a working, reusable single-file spec — the first real "popds.md" equivalent — but still thin on the nuance/grammar side.

### 2.2 Improving the spec via Claude Design → `design1.md`

We used Claude Design to critique and heavily improve on `design.md`, and folded those learnings into a new file, `design1.md`. The improvement wasn't more tokens — it was **structure and rules**: an explicit screen anatomy (top bar → hero/focal element → content → one clear call-to-action → bottom nav), an explicit hierarchy rule ("one dominant focal point per screen — if two things fight for attention, one is wrong"), and — the biggest addition — a **named pattern/recipe library** (bento grids, edge-to-edge carousels, payment-list rows, OTP inputs, slide-to-pay, offer cards, zero-states, etc.), each with what it is, when to use it, and rules for using it correctly. This recipe library was mined directly from the 189-component index built in 1.2.

*Outcome:* this is the file the pipeline actually uses today when our own DS is enabled. It's a direct, working answer to the "vocabulary vs. language" gap identified in 1.3 — rules like "don't use more than one dominant CTA" are exactly the nuance that was previously missing.

### 2.3 Trying Razorpay's Blade DS via Claude Design's "create your own DS"

We separately analyzed how Razorpay structured their own "Blade" design system and uploaded it to Claude Design, using its "create your own DS" feature to iterate on a version of Blade for our use.

*Outcome at the time:* the generated result wasn't good enough to use as-is.
*What actually happened next, worth flagging explicitly:* we later went back and built a **hand-authored** Blade spec ourselves — extracted directly and verbatim from Razorpay's published Blade package (colors, type, spacing, motion, plus content/copy rules) rather than from Claude Design's auto-generated version — and **this is now the default theme for any concept that doesn't specify our own DS.** So the Blade attempt didn't dead-end; it was salvaged by doing the extraction manually instead of through the auto-DS-builder.

---

## Phase 3 — Changing how screens get rendered, not just what they're told

This phase is the largest source of visual-quality gains and isn't in the list of techniques from memory — it's a full pivot in the rendering architecture, triggered by a detailed audit of failure modes in the original approach.

### 3.1 Diagnosing the Figma-plugin rendering path

Screens were originally generated as structured wireframes and written directly into Figma via a custom plugin (after evaluating and discarding a third-party MCP relay, which couldn't actually draw shapes — only comments/variables). Once this was running end-to-end, we ran a hard audit of what was actually going wrong, independent of the DS content itself:

- Text properties on components were sometimes targeted incorrectly (writing to a placeholder field instead of the title field)
- Button labels were getting clipped ("Browse All Products" rendering as "vse All Prod") because resizing fought against Figma's auto-layout
- Components were placed with flat absolute positioning instead of nested, responsive auto-layout — identified as the single biggest visual-polish gap, but never built out on this path
- A run occasionally rendered light-themed screens against a design system that's dark by default
- Components were being composed as isolated "atoms" rather than as higher-level patterns

*Why this matters:* DS adoption itself was healthy (roughly 107 component instances across a 21-screen test run) — the system was *using* the design system correctly. The visual quality problem was in the *plumbing* between "model decides to use component X" and "component X actually renders correctly," not in the model's decisions.

### 3.2 Pivot: deterministic HTML/CSS rendering instead of Figma-plugin wireframes

Off the back of that audit, we switched the entire rendering approach: instead of the model outputting a structured wireframe that a plugin translates into Figma properties, the model now generates the inner HTML of each screen directly, using our design tokens as real Tailwind CSS classes. The page shell — fonts, token definitions, base styles — is assembled by our own code and injected outside the model's control, specifically so every screen stays visually consistent regardless of what the model does with the body content.

*Why:* this removes an entire category of failure (property mis-mapping, resize/auto-layout fights, variant-value rejections) because the browser itself is now doing the rendering, not a property-translation layer.
*Outcome:* this became — and remains — the primary rendering path. Screens are shown live on an interactive canvas, then exported to Figma by rendering each screen offscreen (so styles actually materialize) and sending the result through a Figma import API, rather than writing shapes via the plugin.

### 3.3 Fidelity fixes on the new path

Once HTML rendering was live, two more targeted fixes followed:
- **Long-screen handling:** screens with more content than a standard mobile viewport were being cropped; we now measure each screen's real rendered height and let it extend past the default frame in both the live canvas and the Figma export.
- **Export cost optimization:** switched from exporting screens one at a time to batching multiple screens per export call, since the Figma import API bills per batch rather than per screen.

### 3.4 Model quality experiments

Alongside the DS and rendering work, we ran two model-tier experiments, both explicitly framed as quality tests rather than cost/speed changes:
- Early on, switched the whole pipeline from Gemini to Claude, with the commit itself noting the goal was visibly less "AI slop" output.
- Later, switched every pipeline stage from a fast/cheap Claude tier to the top-tier model, specifically to compare output quality — this remains the live configuration.

---

## A mechanism that exists but was never finished: the review/critique loop

We built a "Design Head" reviewer — a PRD-stage critique step that scores the product brief, asks clarifying questions, and won't let the pipeline proceed until the brief is genuinely ready — with a human-in-the-loop pause built into the pipeline graph for it. The reviewer prompt explicitly names IA, user-flow, and layout evaluators as additional verticals ("coming soon"), but **none of those were ever built.** As a result, we have a working content/scope quality gate, but no equivalent critique pass on the actual visual output — every screen is currently one-shot, with no review or refinement step after generation. This is a real gap and a natural next step if we want to keep improving visual quality rather than DS content quality.

---

## Other quality levers worth knowing about (not major initiatives, but active safeguards)

- **Category-gating:** design-system components tied to a specific domain (e.g. payments/fintech terms) are automatically excluded from screens whose brief doesn't mention that domain, so the DS can't "leak" mismatched components into an unrelated concept.
- **Placeholder imagery convention:** rather than broken image links or generic stock-photo placeholders, screens use an on-theme placeholder block with an icon and a label describing the ideal photography — so mockups read as intentional rather than unfinished.
- **Structured output everywhere:** every pipeline stage forces the model into a validated schema rather than free text, which indirectly protects visual output (e.g., all coordinates are guaranteed to be valid integers before anything downstream tries to render them).
- **Primitives-plus-DS composition rule:** the model is explicitly told a typical screen should be mostly basic elements with DS components used only where they genuinely fit — to avoid forcing awkward component matches just because a component exists.

---

## Known gaps, in our own words (from the project's internal architecture notes)

- Pattern/recipe guidance is currently prose — the model reconstructs each named pattern from a description every time; it never sees actual working markup for our own components.
- There's no retrieval or targeting of which DS content matters for a given screen — the full spec is sent on every batch regardless of screen type.
- There is no critique-and-refine pass on visual output — one shot per batch, as noted above.
- The model has never been shown a real, finished example screen (image or code) from our own product — only written rules describing what one should look like.

---

## Suggested next steps

1. Extend the existing review-loop mechanism (already built for PRD) to the layout/visual stage — the infrastructure and prompt shape already exist, only the evaluator itself is missing.
2. Give the model real component markup instead of prose recipes, at least for the highest-traffic patterns (payment rows, OTP input, CTA cards).
3. Add one or two real finished screens as visual exemplars in the prompt for the highest-stakes screen types.
