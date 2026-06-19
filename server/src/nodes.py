import os
import json
from pathlib import Path
from typing import List, Literal, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from .state import GraphState
from .design_head import run_prd_evaluator, apply_prd_feedback

load_dotenv(override=True)

# ── Component registry (Figma DS) ─────────────────────────────────────────────
# Loaded once at import time. If registry.json exists (built by
# scripts/build_registry.py) the pipeline uses real DS component names.
# Otherwise it falls back to the generic invented vocabulary.

_REGISTRY_PATH = Path(__file__).parent.parent / "registry.json"

def _load_registry() -> list:
    if _REGISTRY_PATH.exists():
        with open(_REGISTRY_PATH) as f:
            reg = json.load(f)
        print(f"[REGISTRY] Loaded {len(reg)} components from registry.json")
        return reg
    print("[REGISTRY] registry.json not found — using invented component vocabulary.")
    return []

DS_REGISTRY: list = _load_registry()

# Build a name→key lookup for the Figma plugin
DS_REGISTRY_MAP: dict = {c["name"]: c["key"] for c in DS_REGISTRY}


# ── IA Blueprint Pydantic schemas ────────────────────────────────────────────

class PageNode(BaseModel):
    id: str = Field(
        description="Unique URL slug / machine-readable identifier, e.g. 'settings-billing'"
    )
    name: str = Field(
        description="Clean human-readable UI name shown on the card, e.g. 'Billing Settings'"
    )
    parent_id: Optional[str] = Field(
        default=None,
        description="ID of the parent screen. Must be null for the primary entry-point / home page only."
    )
    access_level: Literal["public", "private"] = Field(
        description="'public' = pre-login, 'private' = requires authentication"
    )
    layout_pattern: Literal[
        "landing_page", "dashboard_grid", "split_form",
        "list_feed", "detail_view", "modal_popup", "wizard_step"
    ] = Field(
        description="The dominant UI layout pattern that best describes this screen's function"
    )
    component_inventory: List[str] = Field(
        description="Atomic, quantified list of every element required on this screen, "
                    "e.g. ['1x Email Input Field', '1x Sign-In Button', '1x OAuth Google Button']"
    )


class InformationArchitectureBlueprint(BaseModel):
    pages: List[PageNode] = Field(
        description="Complete adjacency-list of all screens in the application"
    )


# ── User Flow schemas ─────────────────────────────────────────────────────────

class FlowStep(BaseModel):
    step_number: int = Field(description="1-based sequential step index")
    source_page_id: str = Field(
        description="The page_id the user is currently on — MUST match an id in the IA pages list"
    )
    trigger_element: str = Field(
        description="The exact UI element the user interacts with, e.g. \"1x 'Book Now' Button\""
    )
    action_type: Literal["click", "submit_form", "swipe", "hover"] = Field(
        description="The interaction type that triggers the transition"
    )
    destination_page_id: str = Field(
        description="The page_id the user lands on after the action — MUST match an id in the IA pages list"
    )


class UserFlow(BaseModel):
    flow_id: str = Field(description="URL-slug identifier, e.g. 'core-booking-flow'")
    flow_name: str = Field(description="Clean human-readable title for the accordion, e.g. 'Book a Flight'")
    description: str = Field(description="One sentence describing what this flow accomplishes")
    ui_color_theme: str = Field(description="Hex colour string for frontend path colouring, e.g. '#10B981'")
    steps: List[FlowStep] = Field(description="Chronological happy-path steps, nothing goes wrong")


class UserFlowCollection(BaseModel):
    flows: List[UserFlow] = Field(
        description="Exactly 3 golden happy-path flows covering the app's most critical user goals"
    )


# ── UX Layout Planner schemas ─────────────────────────────────────────────────

class UXPrincipleExplanation(BaseModel):
    principle_name: str = Field(
        description="Name of the UX/design principle, e.g. \"Fitts's Law\", \"Hick's Law\", \"Progressive Disclosure\""
    )
    rationale: str = Field(
        description="One detailed sentence explaining exactly how this layout applies the principle to optimise the interface. Powers the frontend info-tooltip."
    )


class SpatialZone(BaseModel):
    zone_id: str = Field(
        description="Machine-readable zone identifier, e.g. 'left_rail_nav', 'main_focal_grid', 'top_actions', 'bottom_sticky_footer'"
    )
    visual_weight: Literal["P1_Dominant", "P2_Supporting", "P3_Subdued"] = Field(
        description="P1 = primary focal point, P2 = supporting element, P3 = background/utility"
    )
    width_percentage: int = Field(
        description="Zone's relative width as a percentage of total screen width (all zones in a row should sum to ~100)"
    )
    height_percentage: int = Field(
        description="Zone's relative height as a percentage of total screen height"
    )
    rendering_sequence: List[str] = Field(
        description="Ordered list mapping component names from the IA component_inventory into this zone, top-to-bottom"
    )


class ScreenLayoutPlan(BaseModel):
    page_id: str = Field(
        description="Must exactly match the 'id' of the corresponding page from the IA blueprint"
    )
    grid_system: Literal[
        "fixed_left_sidebar", "twelve_column_fluid", "split_screen_50_50",
        "single_column_centered", "canvas_viewport_locked"
    ] = Field(description="The macro grid structure governing this screen's layout")
    scroll_behavior: Literal[
        "infinite_vertical", "viewport_locked", "sticky_header_fluid_body"
    ] = Field(description="How the screen scrolls and whether the header is sticky")
    spatial_zones: List[SpatialZone] = Field(
        description="Abstract bounding blocks that divide the screen canvas into distinct layout areas"
    )
    ux_principles: List[UXPrincipleExplanation] = Field(
        description="Exactly 2-3 UX principles justifying the spatial decisions on this screen"
    )
    empty_state_guidance: str = Field(
        description="Clear strategy for what to display when this screen has no user data"
    )


class MasterUXLayoutCollection(BaseModel):
    screen_layouts: List[ScreenLayoutPlan] = Field(
        description="One ScreenLayoutPlan per screen from the IA node — no screens omitted"
    )


# ─────────────────────────────────────────────────────────────────────────────


def get_llm(max_tokens: int = 8192):
    """
    Lazily build the LLM so it reads ANTHROPIC_API_KEY after load_dotenv() has run.
    max_tokens is explicit — Claude Haiku's default is too low for large JSON outputs.
    """
    return ChatAnthropic(
        model="claude-haiku-4-5",
        temperature=0.2,
        max_tokens=max_tokens,
        anthropic_api_key=os.environ["ANTHROPIC_API_KEY"],
    )


def extract_text(response) -> str:
    """
    Anthropic responses return content as either:
      - a plain string  (older SDK / some langchain versions)
      - a list of content blocks: [{"type": "text", "text": "..."}]
    This helper always returns a clean string regardless.
    """
    content = response.content
    if isinstance(content, list):
        return "".join(
            block["text"] if isinstance(block, dict) else block.text
            for block in content
            if (isinstance(block, dict) and block.get("type") == "text")
            or (hasattr(block, "type") and block.type == "text")
        )
    return content


def parse_json(raw: str) -> dict:
    """Strip optional markdown fences and parse JSON."""
    text = raw.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def prd_node(state: GraphState):
    """Analyzes concept and compiles a structured PRD (Google + Microsoft methodology)."""
    print("--- Executing PRD Node ---")
    concept = state["concept"]

    system_prompt = """You are a senior Product Manager trained on Google and Microsoft's product development frameworks.
Your sole job is to output a valid JSON object. Do not write any text, explanation, or markdown outside of the JSON block.

GUARDRAILS YOU MUST FOLLOW:
1. DATA ENFORCER: Populate every key listed in the schema below. Never omit a key or use free-form text where structured data is required.
2. SCOPE CUTTER: For every 3 P0 features you identify, you MUST list at least 2 explicit Non-Goals.
3. UX HAND-OFF: Every item in p0_features and p1_features must include a "component_type" and "action" field."""

    user_prompt = f"""Concept: {concept}

Return ONLY a raw JSON object — no markdown fences, no prose, no explanation:

{{
  "executive_summary": {{
    "north_star": "<max 3 sentences: why we build this and the single most important user action>",
    "primary_value_proposition": "<one sentence>"
  }},
  "target_persona": {{
    "name": "<persona name>",
    "behavioral_constraint": "<define by behavioral friction, not demographics>",
    "core_pain_points": ["<pain 1>", "<pain 2>", "<pain 3>"]
  }},
  "happy_path_scenario": {{
    "title": "<scenario title>",
    "steps": ["<step 1>", "<step 2>", "<step 3>", "<step 4>", "<step 5>"]
  }},
  "functional_requirements": {{
    "p0_features": [
      {{
        "feature": "<feature name>",
        "description": "<what it does>",
        "component_type": "<form | button | dashboard_card | list | modal>",
        "action": "<submit_form | navigate | display_data | trigger_reward>"
      }}
    ],
    "p1_features": [
      {{
        "feature": "<feature name>",
        "description": "<what it does>",
        "component_type": "<component type>",
        "action": "<action>",
        "state": "future"
      }}
    ]
  }},
  "non_goals": ["<explicit exclusion 1>", "<explicit exclusion 2>"],
  "ux_anchor_directives": {{
    "visual_posture": "<utilitarian-dashboard | minimalist-form-first | content-rich-feed>",
    "tone": "<warm-encouraging | professional-neutral | playful-rewarding>",
    "layout_hint": "<structural guidance for the wireframe>"
  }}
}}"""

    print("    Calling LLM for PRD…")
    response = get_llm(max_tokens=4096).invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    try:
        prd_data = parse_json(extract_text(response))

        required_keys = {
            "executive_summary", "target_persona", "happy_path_scenario",
            "functional_requirements", "non_goals", "ux_anchor_directives",
        }
        missing = required_keys - set(prd_data.keys())
        if missing:
            raise ValueError(f"LLM response missing required PRD sections: {missing}")

        print(f"    PRD complete — north star: {prd_data.get('executive_summary', {}).get('north_star', '')[:80]}…")
        return {
            "prd_data": prd_data,
            "logs": ["[SYS] PRD generation completed (6-section Google+Microsoft structure)."]
        }
    except Exception as e:
        print(f"    [ERR] PRD failed: {e}")
        return {
            "errors": [f"Error in PRD node: {str(e)}"],
            "logs": [f"[ERR] PRD generation failed: {str(e)}"]
        }


def ia_node(state: GraphState):
    """
    Generates a production-grade Information Architecture Blueprint.

    Uses .with_structured_output(InformationArchitectureBlueprint) so the LLM
    is forced to return a fully-typed adjacency-list graph — no raw text, no
    markdown, no missing fields. The result is serialised to dict for the
    frontend canvas renderer.
    """
    print("--- Executing IA Node ---")
    prd_data = state["prd_data"]

    system_prompt = """You are a Principal UX Architect. Analyse the PRD and produce a complete InformationArchitectureBlueprint.

Rules:
- Enumerate every distinct screen/view-state (full viewport OR focused modal).
- Exactly ONE page has parent_id=null (the primary entry point). All others reference a valid id.
- Modal popups use the screen they float above as parent_id.
- Choose the most accurate layout_pattern per screen:
    landing_page | dashboard_grid | split_form | list_feed | detail_view | modal_popup | wizard_step
- component_inventory: quantified atomic elements, e.g. "1x Email Input Field", "1x Sign-In Button".
- Keep component_inventory concise: max 6 items per screen."""

    user_prompt = f"""Generate the full InformationArchitectureBlueprint for this product.
No orphan pages. Every page must have a valid parent_id (except the root).

PRD (JSON):
{json.dumps(prd_data, indent=2)}"""

    print("    Calling LLM for IA blueprint…")
    try:
        structured_llm = get_llm(max_tokens=8192).with_structured_output(
            InformationArchitectureBlueprint
        )
        blueprint: InformationArchitectureBlueprint = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])

        ia_data = blueprint.model_dump()
        page_names = [p.name for p in blueprint.pages]
        print(f"    IA complete — {len(blueprint.pages)} screens: {page_names}")
        return {
            "ia_data": ia_data,
            "logs": [
                f"[SYS] IA Blueprint generated — {len(blueprint.pages)} screens, "
                f"{sum(1 for p in blueprint.pages if p.parent_id is None)} root node(s)."
            ]
        }
    except Exception as e:
        print(f"    [ERR] IA failed: {e}")
        return {
            "errors": [f"Error in IA node: {str(e)}"],
            "logs": [f"[ERR] IA Blueprint generation failed: {str(e)}"]
        }


def user_flow_node(state: GraphState):
    """
    Generates exactly 3 Golden Happy Path user flows.

    Cross-references the PRD + IA blueprint to produce strictly relational
    FlowStep objects — every source_page_id and destination_page_id is
    validated against the actual page IDs that exist in ia_data.
    """
    print("--- Executing User Flow Node ---")
    prd_data  = state["prd_data"]
    ia_data   = state["ia_data"]

    # Extract valid page IDs so we can include them explicitly in the prompt
    valid_page_ids = [p["id"] for p in ia_data.get("pages", [])]

    system_prompt = """You are a Senior UX Strategist specialising in user journey mapping.
Your job is to analyse a PRD and an Information Architecture and produce exactly 3 UserFlow objects.

RULES — read carefully, do not break any:
1. EXACTLY 3 FLOWS — no more, no fewer. Cover these 3 archetypes:
   - Flow 1: Onboarding / Sign-up (how a brand-new user discovers and joins)
   - Flow 2: Core Value Action (the single most important thing the app does for the user)
   - Flow 3: Primary Account / Settings Action (profile, preferences, or a secondary key task)

2. STRICT RELATIONAL INTEGRITY — every source_page_id and destination_page_id
   MUST be an id taken verbatim from the IA page list provided. Never invent or hallucinate a page id.

3. LINEAR HAPPY PATH — no branching, no error states, nothing goes wrong.
   Each step flows directly into the next.

4. TRIGGER ELEMENT must reference a real component from the source page's component_inventory.

5. COLOUR THEMES — assign visually distinct hex colours:
   Flow 1: a green family  (#10B981 or similar)
   Flow 2: a blue family   (#3B82F6 or similar)
   Flow 3: a purple family (#8B5CF6 or similar)"""

    user_prompt = f"""Analyse the PRD and IA below. Generate exactly 3 user flows.

Valid page IDs you MUST use (do not use any other id):
{json.dumps(valid_page_ids, indent=2)}

PRD:
{json.dumps(prd_data, indent=2)}

Information Architecture:
{json.dumps(ia_data, indent=2)}"""

    print("    Calling LLM for user flows…")
    try:
        structured_llm = get_llm(max_tokens=8192).with_structured_output(UserFlowCollection)
        collection: UserFlowCollection = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])

        flow_data = collection.model_dump()
        for f in collection.flows:
            print(f"    Flow: '{f.flow_name}' — {len(f.steps)} steps")

        return {
            "user_flow_data": flow_data,
            "logs": [
                f"[SYS] User Flow Builder complete — "
                f"{len(collection.flows)} flows, "
                f"{sum(len(f.steps) for f in collection.flows)} total steps."
            ]
        }
    except Exception as e:
        print(f"    [ERR] User Flow failed: {e}")
        return {
            "errors": [f"Error in User Flow node: {str(e)}"],
            "logs":   [f"[ERR] User Flow generation failed: {str(e)}"]
        }


def ux_layout_node(state: GraphState):
    """
    UX Layout Planner — generates a spatial zoning blueprint for every screen.

    For flow-critical screens it pushes the primary action into P1_Dominant.
    For utility/static screens it applies efficient template-driven grids.
    Every screen gets 2-3 UX principle explanations that power frontend tooltips.
    """
    print("--- Executing UX Layout Node ---")
    ia_data        = state["ia_data"]
    user_flow_data = state["user_flow_data"]
    prd_data       = state["prd_data"]

    pages      = ia_data.get("pages", [])
    page_ids   = [p["id"] for p in pages]

    # Collect page IDs that appear in any flow step so the LLM knows which
    # screens are "flow-critical" vs. utility
    flow_critical_ids: set = set()
    for flow in user_flow_data.get("flows", []):
        for step in flow.get("steps", []):
            flow_critical_ids.add(step.get("source_page_id", ""))
            flow_critical_ids.add(step.get("destination_page_id", ""))

    system_prompt = """You are a Senior UX Architect and Spatial Layout Designer.
Your task: produce one ScreenLayoutPlan for EVERY page in the IA, no exceptions.

TWO EVALUATION STRATEGIES — apply the correct one per screen:

STRATEGY A — FLOW-CRITICAL SCREENS (pages whose id appears in the user flows):
- Study which flow step lands on or departs from this screen and what action it requires.
- Design spatial_zones so the primary action component sits in a P1_Dominant zone.
- Choose grid_system and scroll_behavior to minimise interaction cost for that primary action.
- Reference Fitts's Law, Visual Hierarchy, or Affordance Theory in ux_principles.

STRATEGY B — UTILITY / STATIC SCREENS (pages not in any user flow):
- Apply a standard efficient grid (single_column_centered or twelve_column_fluid).
- Keep spatial_zones minimal (2 zones max).
- Use Hick's Law or Progressive Disclosure in ux_principles to justify simplicity.

RULES FOR ALL SCREENS:
- page_id must exactly match the IA page id string.
- rendering_sequence inside each SpatialZone must use component names verbatim from that page's component_inventory.
- width_percentage values across sibling zones in the same row must sum to approximately 100.
- Provide exactly 2 or 3 ux_principles per screen — no more, no less.
- empty_state_guidance: write a concrete strategy (not just "show empty state").
- Do not invent page_ids or component names not present in the IA data."""

    user_prompt = f"""Generate a ScreenLayoutPlan for every one of these pages:
{json.dumps(page_ids, indent=2)}

Flow-critical page IDs (STRATEGY A):
{json.dumps(sorted(flow_critical_ids), indent=2)}

Full IA (pages with component_inventory):
{json.dumps(pages, indent=2)}

User Flows (for cross-referencing primary actions):
{json.dumps(user_flow_data, indent=2)}

PRD UX Directives (visual posture and tone):
{json.dumps(prd_data.get("ux_anchor_directives", {}), indent=2)}"""

    BATCH_SIZE = 4
    all_screen_layouts: List[ScreenLayoutPlan] = []
    total_batches = (len(pages) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"    Total screens: {len(pages)}, batches: {total_batches}")

    try:
        structured_llm = get_llm(max_tokens=8192).with_structured_output(
            MasterUXLayoutCollection
        )

        for i in range(0, len(pages), BATCH_SIZE):
            batch_pages    = pages[i:i + BATCH_SIZE]
            batch_page_ids = [p["id"] for p in batch_pages]
            batch_num      = i // BATCH_SIZE + 1
            batch_flow_critical = [pid for pid in batch_page_ids if pid in flow_critical_ids]

            print(f"    UX Layout batch {batch_num}/{total_batches}: {batch_page_ids}")

            batch_user_prompt = f"""Generate a ScreenLayoutPlan for each of these pages (batch {batch_num}/{total_batches}):
{json.dumps(batch_page_ids, indent=2)}

Flow-critical page IDs (STRATEGY A):
{json.dumps(batch_flow_critical, indent=2)}

Full IA for this batch (pages with component_inventory):
{json.dumps(batch_pages, indent=2)}

User Flows (for cross-referencing primary actions):
{json.dumps(user_flow_data, indent=2)}

PRD UX Directives (visual posture and tone):
{json.dumps(prd_data.get("ux_anchor_directives", {}), indent=2)}"""

            collection: MasterUXLayoutCollection = structured_llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=batch_user_prompt),
            ])
            print(f"    Batch {batch_num} done — {len(collection.screen_layouts)} layout(s).")
            all_screen_layouts.extend(collection.screen_layouts)

        master         = MasterUXLayoutCollection(screen_layouts=all_screen_layouts)
        ux_layout_data = master.model_dump()

        print(f"    UX Layout complete — {len(all_screen_layouts)} layouts total.")
        return {
            "ux_layout_data": ux_layout_data,
            "logs": [
                f"[SYS] UX Layout Planner complete — "
                f"{len(all_screen_layouts)} screen blueprints generated."
            ]
        }
    except Exception as e:
        print(f"    [ERR] UX Layout failed: {e}")
        return {
            "errors": [f"Error in UX Layout node: {str(e)}"],
            "logs":   [f"[ERR] UX Layout generation failed: {str(e)}"]
        }


# ── Wireframe Compiler schemas ────────────────────────────────────────────────

# Fallback generic vocabulary used when no registry.json is present.
FALLBACK_ELEMENT_TYPES = [
    "FRAME", "NAV_BAR", "BOTTOM_TAB_BAR", "BUTTON", "FAB",
    "INPUT_FIELD", "CARD", "LIST_ITEM", "TEXT_HEADING", "TEXT_BODY",
    "IMAGE_PLACEHOLDER", "DIVIDER", "ICON_BUTTON", "BADGE", "MODAL_OVERLAY",
]

def _get_vocabulary() -> tuple[list[str], bool]:
    """Returns (vocabulary_list, is_ds_mode).
    DS mode  → vocabulary is real DS component names from registry.json.
    Fallback → vocabulary is the generic invented type list.
    """
    if DS_REGISTRY:
        return [c["name"] for c in DS_REGISTRY], True
    return FALLBACK_ELEMENT_TYPES, False


class ElementSpec(BaseModel):
    id: str = Field(description="Unique element id within the screen, e.g. 'btn_login'")
    type: str = Field(description="Component name — must be taken verbatim from the allowed vocabulary list")
    ds_key: str = Field(default="", description="Figma component key from the DS registry (leave empty in fallback mode)")
    label: str = Field(description="Visible text or aria-label for the element")
    x: float = Field(description="Left offset in pixels from screen origin")
    y: float = Field(description="Top offset in pixels from screen origin")
    width: float = Field(description="Width in pixels")
    height: float = Field(description="Height in pixels")
    fill_color: str = Field(description="Hex fill colour, e.g. '#1A1A2E'")
    text_color: str = Field(description="Hex text colour, e.g. '#FFFFFF'")
    corner_radius: float = Field(default=0, description="Corner radius in pixels")
    font_size: float = Field(default=14, description="Font size in pixels")
    font_weight: Literal["Regular", "Medium", "SemiBold", "Bold"] = Field(default="Regular")
    children: List[str] = Field(default_factory=list, description="ids of direct child elements nested inside this element")
    zone_id: str = Field(default="", description="The spatial_zone this element belongs to")

    def model_post_init(self, __context) -> None:
        # Round all pixel values to integers after parsing — prevents the LLM
        # from outputting fractional coords (e.g. 97.5) that break Figma's API.
        object.__setattr__(self, "x",             round(self.x))
        object.__setattr__(self, "y",             round(self.y))
        object.__setattr__(self, "width",         max(1, round(self.width)))
        object.__setattr__(self, "height",        max(1, round(self.height)))
        object.__setattr__(self, "corner_radius", round(self.corner_radius))
        object.__setattr__(self, "font_size",     max(1, round(self.font_size)))

class ScreenWireframe(BaseModel):
    screen_id: str = Field(description="Must match the page id from the IA")
    screen_name: str = Field(description="Human-readable screen name")
    width: float = Field(default=390, description="Canvas width in pixels (390 = mobile, 1440 = desktop)")
    height: float = Field(default=844, description="Canvas height in pixels")
    background_color: str = Field(default="#FFFFFF")
    elements: List[ElementSpec] = Field(description="All UI elements on this screen, ordered back-to-front")

    def model_post_init(self, __context) -> None:
        object.__setattr__(self, "width",  max(1, round(self.width)))
        object.__setattr__(self, "height", max(1, round(self.height)))

class WireframePayloadCollection(BaseModel):
    screens: List[ScreenWireframe] = Field(description="One ScreenWireframe per screen from the IA")


def _filter_registry_for_batch(batch_pages: list, top_n: int = 40) -> list:
    """
    Returns the top_n most relevant DS components for a batch of pages.
    Scores each DS component by counting how many keywords from the pages'
    component_inventory and layout_pattern appear in the component name.
    Falls back to a broad structural set if nothing scores.
    """
    # Collect all keyword tokens from this batch
    keywords: set = set()
    for page in batch_pages:
        # from layout pattern e.g. "list_feed" → ["list", "feed"]
        for tok in page.get("layout_pattern", "").lower().replace("_", " ").split():
            keywords.add(tok)
        # from component_inventory e.g. "1x Sign-In Button" → ["sign", "in", "button"]
        for item in page.get("component_inventory", []):
            for tok in item.lower().replace("-", " ").replace("_", " ").split():
                if len(tok) > 2:
                    keywords.add(tok)
        # page name tokens
        for tok in page.get("name", "").lower().replace("-", " ").split():
            if len(tok) > 2:
                keywords.add(tok)

    # Score every DS component
    scored = []
    for comp in DS_REGISTRY:
        name_lower = comp["name"].lower()
        score = sum(1 for kw in keywords if kw in name_lower)
        if score > 0:
            scored.append((score, comp))

    scored.sort(key=lambda x: x[0], reverse=True)
    filtered = [c for _, c in scored[:top_n]]

    # Always include a few essential structural components so every screen
    # has at least navigation + button + text options available
    essential_keywords = ["button", "nav", "tab", "card", "text", "input", "header"]
    already_names = {c["name"].lower() for c in filtered}
    for comp in DS_REGISTRY:
        name_lower = comp["name"].lower()
        if any(kw in name_lower for kw in essential_keywords):
            if name_lower not in already_names and len(filtered) < top_n + 20:
                filtered.append(comp)
                already_names.add(name_lower)

    return filtered


def wireframe_compiler_node(state: GraphState):
    """
    Converts ux_layout_data spatial zones into a concrete pixel-positioned
    element tree for every screen. Output is the render payload consumed by
    the Figma plugin via the bridge server.
    Batches 2 screens at a time. In DS mode, injects only the ~40 most
    relevant components per batch to stay well within the token limit.
    """
    print("--- Executing Wireframe Compiler Node ---")

    ia_data        = state["ia_data"]
    ux_layout_data = state["ux_layout_data"]
    prd_data       = state["prd_data"]

    pages          = ia_data.get("pages", [])
    screen_layouts = ux_layout_data.get("screen_layouts", [])
    ux_directives  = prd_data.get("ux_anchor_directives", {})

    # Force fallback mode until the DS library is accessible from the
    # logged-in Figma account. Set to True once library access is confirmed.
    _, _ds_available = _get_vocabulary()
    is_ds_mode = False  # flip to _ds_available when library access is ready
    mode_label = "DS mode (real components)" if is_ds_mode else "fallback mode (invented types)"
    print(f"    Total screens to compile: {len(pages)} | {mode_label}")

    SYSTEM_PROMPT_BASE = """You are a Wireframe Compiler. Translate a spatial layout blueprint into a
pixel-precise UI element tree that a Figma plugin renders directly.

COORDINATE SYSTEM — read this carefully:
- The canvas origin (0, 0) is the TOP-LEFT corner of the screen frame.
- ALL x and y values are ABSOLUTE distances from that origin — not relative to any parent.
- Example: if a CARD sits at y:400 height:160, and you want text 12px from the card's top,
  the text element's y must be 412 (400 + 12), NOT 12.
- There is NO nesting in the final render — every element is a direct child of the screen frame
  at its absolute position. `children[]` is metadata only; it does not change coordinate origin.

OVERLAP PREVENTION:
- Before finalising coordinates, mentally stack all elements top-to-bottom.
- No two sibling elements should share the same y range unless they are intentionally side-by-side (same row).
- Minimum 8px gap between the bottom edge of one element and the top of the next.
- Bottom-most element y + height must be ≤ screen height (844 for mobile).

RULES:
1. Every element id is unique within its screen (snake_case).
2. `type` must be exactly one value from the allowed vocabulary below — no custom types.
3. Canvas size: 390×844 (mobile). Use 1440×900 only if layout_pattern is desktop.
4. No element may exceed canvas bounds (x+width ≤ 390, y+height ≤ 844 for mobile).
5. Fill colors: primary actions = brand color, backgrounds = neutral dark/light.
6. Every screen needs a navigation element unless it is modal/onboarding.
7. Keep element count to 8-14 per screen — quality over quantity.
8. `children` is a metadata hint only — coordinates are always absolute.
9. Leaf elements have empty children[]."""

    DS_RULES = """10. `type` must be the exact DS component name string — capitalisation matters.
11. `ds_key` must be the matching Figma component key from the vocabulary table."""

    FALLBACK_RULES = "10. Leave `ds_key` as an empty string."

    BATCH_SIZE = 2
    all_screens: List[ScreenWireframe] = []

    try:
        structured_llm = get_llm(max_tokens=16000).with_structured_output(WireframePayloadCollection)

        total_batches = (len(pages) + BATCH_SIZE - 1) // BATCH_SIZE

        for i in range(0, len(pages), BATCH_SIZE):
            batch_pages   = pages[i:i + BATCH_SIZE]
            batch_ids     = [p["id"] for p in batch_pages]
            batch_num     = i // BATCH_SIZE + 1

            # ── Build per-batch vocabulary ────────────────────────────────────
            if is_ds_mode:
                batch_registry = _filter_registry_for_batch(batch_pages, top_n=40)
                batch_names    = [c["name"] for c in batch_registry]
                batch_key_map  = {c["name"]: c["key"] for c in batch_registry}
                vocab_section  = (
                    f"ALLOWED COMPONENT NAMES (your Figma DS — use ONLY these as `type`):\n"
                    f"{json.dumps(batch_names)}\n\n"
                    f"name → ds_key lookup:\n{json.dumps(batch_key_map)}"
                )
                extra_rules = DS_RULES
                print(f"    Batch {batch_num}: {len(batch_names)} DS components injected for {batch_ids}")
            else:
                vocab_section = f"ALLOWED ELEMENT TYPES:\n{json.dumps(FALLBACK_ELEMENT_TYPES)}"
                extra_rules   = FALLBACK_RULES
                print(f"    Compiling batch {batch_num}/{total_batches}: {batch_ids}")

            system_prompt = f"{SYSTEM_PROMPT_BASE}\n\n{vocab_section}\n\n{extra_rules}"

            batch_layouts = []
            for sl in screen_layouts:
                if sl.get("page_id") not in batch_ids:
                    continue
                batch_layouts.append({
                    "page_id":     sl.get("page_id"),
                    "grid_system": sl.get("grid_system"),
                    "spatial_zones": [
                        {
                            "zone_id":            z.get("zone_id"),
                            "visual_weight":      z.get("visual_weight"),
                            "width_percentage":   z.get("width_percentage"),
                            "height_percentage":  z.get("height_percentage"),
                            "rendering_sequence": z.get("rendering_sequence", []),
                        }
                        for z in sl.get("spatial_zones", [])
                    ],
                })

            batch_prompt = f"""Compile a ScreenWireframe for each of these screens (batch {batch_num}/{total_batches}):
{json.dumps(batch_ids)}

IA Pages:
{json.dumps(batch_pages, indent=2)}

UX Layout zones:
{json.dumps(batch_layouts, indent=2)}

Brand/UX directives:
{json.dumps(ux_directives, indent=2)}"""

            collection: WireframePayloadCollection = structured_llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=batch_prompt),
            ])

            # Backfill any ds_key the LLM missed
            if is_ds_mode:
                for screen in collection.screens:
                    for el in screen.elements:
                        if not el.ds_key:
                            el.ds_key = DS_REGISTRY_MAP.get(el.type, "")

            print(f"    Batch {batch_num} done — {len(collection.screens)} screen(s) compiled.")
            all_screens.extend(collection.screens)

        payload      = WireframePayloadCollection(screens=all_screens)
        payload_dict = payload.model_dump()
        # Attach mode flag so the plugin knows which render path to use
        payload_dict["ds_mode"] = is_ds_mode

        print(f"    Wireframe Compiler complete — {len(all_screens)} total screens.")
        return {
            "wireframe_payload": payload_dict,
            "logs": [f"[SYS] Wireframe Compiler complete — {len(all_screens)} screens compiled."]
        }
    except Exception as e:
        print(f"    [ERR] Wireframe Compiler failed: {e}")
        return {
            "errors": [f"Error in Wireframe Compiler node: {str(e)}"],
            "logs":   [f"[ERR] Wireframe compilation failed: {str(e)}"]
        }


def render_node(state: GraphState):
    """
    Pushes the compiled wireframe payload to the bridge server so the
    Figma plugin can pick it up and render it onto the canvas.
    """
    import requests as req
    print("--- Executing Render Node ---")

    wireframe_payload = state.get("wireframe_payload", {})
    figma_url         = state.get("figma_url", "")
    screen_count      = len(wireframe_payload.get("screens", []))
    errors            = state.get("errors", [])

    bridge_url = "http://localhost:5001/payload"

    print(f"    Screens in payload: {screen_count}")

    if screen_count == 0:
        compiler_errors = [e for e in errors if "Wireframe" in e or "compiler" in e.lower()]
        reason = compiler_errors[0] if compiler_errors else "Wireframe Compiler produced no screens."
        print(f"    [WARN] Nothing to push — {reason}")
        logs = [
            "[WARN] Wireframe Compiler produced 0 screens — nothing sent to bridge.",
            f"[WARN] Reason: {reason}",
            "[INFO] Check server logs for the compiler error and re-run the pipeline.",
        ]
        return {
            "render_data": {"figma_url": figma_url, "status": "empty_payload", "screen_count": 0},
            "logs": logs,
        }

    logs = [f"[SYS] Render node starting — pushing {screen_count} screen(s) to bridge."]
    print(f"    Connecting to bridge at {bridge_url} …")

    try:
        response = req.post(bridge_url, json=wireframe_payload, timeout=10)
        response.raise_for_status()
        bridge_response = response.json()
        print(f"    Bridge responded: {bridge_response}")
        logs += [
            f"[BRIDGE] Connected — HTTP {response.status_code}.",
            f"[BRIDGE] {screen_count} screen(s) delivered and queued.",
            "[SYS] Pipeline complete. Open the Figma plugin → 'Fetch & Render Wireframes'.",
            "[SUCCESS] All done.",
        ]
        print("    [SUCCESS] Payload delivered to bridge.")
        return {
            "render_data": {
                "figma_url":    figma_url,
                "status":       "payload_delivered",
                "screen_count": screen_count,
                "bridge_url":   bridge_url,
            },
            "logs": logs,
        }
    except Exception as e:
        print(f"    [WARN] Bridge unreachable: {e}")
        logs += [
            f"[WARN] Bridge server unreachable: {str(e)}",
            "[WARN] Is bridge.py running on port 5001? Start it with: python bridge.py",
            f"[INFO] Payload has {screen_count} screens ready — restart bridge and re-run.",
        ]
        return {
            "render_data": {
                "figma_url":    figma_url,
                "status":       "bridge_offline",
                "screen_count": screen_count,
            },
            "logs": logs,
        }


# ── Design Head: PRD Review Node ──────────────────────────────────────────────

def prd_review_node(state: GraphState):
    """
    Runs the Design Head's PRD Evaluator vertical.
    Evaluates the PRD, generates questions + suggestions, then pauses
    the pipeline by emitting review_status = 'awaiting_human'.
    The graph will re-enter prd_apply_feedback_node once the human responds.
    """
    print("--- Executing PRD Review Node ---")

    prd_data       = state.get("prd_data", {})
    concept        = state.get("concept", "")
    human_feedback = state.get("human_feedback", {})
    round_number   = human_feedback.get("round_number", 1)

    print(f"    Running PRD Evaluator (round {round_number})…")

    try:
        review = run_prd_evaluator(
            prd_data=prd_data,
            concept=concept,
            previous_feedback=human_feedback if round_number > 1 else None,
            round_number=round_number,
        )

        review_dict = review.model_dump()
        print(f"    PRD quality score: {review.quality_score}/10 | is_ready: {review.is_ready}")
        print(f"    Questions: {len(review.questions)} | Suggestions: {len(review.suggestions)}")

        return {
            "review_data": {
                "stage":          "prd",
                "round":          round_number,
                "review":         review_dict,
            },
            "review_status": "awaiting_human",
            "logs": [
                f"[DESIGN HEAD] PRD Evaluator complete — score {review.quality_score}/10.",
                f"[DESIGN HEAD] {len(review.questions)} question(s), {len(review.suggestions)} suggestion(s).",
                "[DESIGN HEAD] Waiting for human feedback before proceeding…",
            ],
        }
    except Exception as e:
        print(f"    [ERR] PRD Review failed: {e}")
        return {
            "review_data":   {"stage": "prd", "error": str(e)},
            "review_status": "approved",   # skip review on error, don't block pipeline
            "errors":        [f"PRD Review error: {str(e)}"],
            "logs":          [f"[ERR] PRD Review failed — proceeding without review: {str(e)}"],
        }


def prd_apply_feedback_node(state: GraphState):
    """
    Called after the human submits feedback on the PRD review.
    Applies accepted suggestions + question answers to the PRD,
    then re-runs the evaluator to get a fresh score.
    If the evaluator marks is_ready=True AND human confirmed, sets review_status='approved'.
    """
    print("--- Executing PRD Apply Feedback Node ---")

    prd_data       = state.get("prd_data", {})
    concept        = state.get("concept", "")
    human_feedback = state.get("human_feedback", {})
    review_data    = state.get("review_data", {})

    prev_review_dict = review_data.get("review", {})
    round_number     = human_feedback.get("round_number", 1)

    # Reconstruct the previous PRDReviewOutput for suggestion lookup
    from .design_head import PRDReviewOutput, ReviewSuggestion, ReviewQuestion
    try:
        prev_review = PRDReviewOutput(**prev_review_dict)
    except Exception:
        prev_review = None

    human_confirmed = human_feedback.get("confirmed_proceed", False)

    print(f"    Applying feedback (round {round_number}) — confirmed_proceed: {human_confirmed}")

    try:
        # Apply changes to PRD
        updated_prd = apply_prd_feedback(
            prd_data=prd_data,
            concept=concept,
            feedback=human_feedback,
            review=prev_review,
        )

        # Re-evaluate with updated PRD
        new_review = run_prd_evaluator(
            prd_data=updated_prd,
            concept=concept,
            previous_feedback=human_feedback,
            round_number=round_number + 1,
        )

        print(f"    Updated PRD score: {new_review.quality_score}/10 | is_ready: {new_review.is_ready}")

        # Determine if we're done with review
        if human_confirmed and new_review.is_ready:
            review_status = "approved"
            print("    PRD review approved — proceeding to IA node.")
        else:
            review_status = "awaiting_human"

        return {
            "prd_data":      updated_prd,
            "review_data": {
                "stage":  "prd",
                "round":  round_number + 1,
                "review": new_review.model_dump(),
            },
            "review_status": review_status,
            "human_feedback": {
                **human_feedback,
                "round_number": round_number + 1,
                "confirmed_proceed": False,   # reset for next round
            },
            "logs": [
                f"[DESIGN HEAD] PRD updated (round {round_number + 1}) — score {new_review.quality_score}/10.",
                "[DESIGN HEAD] PRD review approved — proceeding to IA." if review_status == "approved"
                else "[DESIGN HEAD] Another round of review needed.",
            ],
        }
    except Exception as e:
        print(f"    [ERR] Apply feedback failed: {e}")
        return {
            "review_status": "approved",   # don't block forever on error
            "errors":        [f"Apply feedback error: {str(e)}"],
            "logs":          [f"[ERR] Feedback apply failed — proceeding: {str(e)}"],
        }
