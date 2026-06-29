import os
import json
from pathlib import Path
from typing import List, Literal, Optional, Dict
from dotenv import load_dotenv
from pydantic import BaseModel, Field, model_validator
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from .state import GraphState
from .design_head import run_prd_evaluator, apply_prd_feedback
from . import html_templates as ht

try:
    # Injected into a node by name/annotation; lets a node emit incremental
    # events (one per screen) to the SSE layer via stream_mode="custom".
    from langgraph.types import StreamWriter
except Exception:  # pragma: no cover — older langgraph
    StreamWriter = None  # type: ignore

try:
    # Fallback path for incremental emit when the injected writer isn't usable.
    from langgraph.config import get_stream_writer
except Exception:  # pragma: no cover
    get_stream_writer = None  # type: ignore

load_dotenv(override=True)

# ── Design-System index (Figma DS) ────────────────────────────────────────────
# Loaded once at import time from the enriched ds_index.json (built by the DS
# extraction step: registry key + node_id + description + properties + rules).
# When the user enables DS mode, the compiler uses these as a PREFERRED-WHEN-FITS
# vocabulary alongside generic primitives — never an exclusive one.

_DS_INDEX_PATH = Path(__file__).parent.parent / "figma-DS-extracts" / "ds_index.json"

def _load_ds_index() -> list:
    """Return the list of USABLE DS components: has an importable key and is not
    an internal ('.'/'_' prefixed) component. Each item keeps its full spec
    (description, properties, variants, use_cases, rules) for the compiler."""
    if not _DS_INDEX_PATH.exists():
        print(f"[DS] {_DS_INDEX_PATH.name} not found — DS mode unavailable, using invented vocabulary.")
        return []
    with open(_DS_INDEX_PATH) as f:
        data = json.load(f)
    comps = data.get("components", []) if isinstance(data, dict) else data
    usable = [
        c for c in comps
        if c.get("key") and not c.get("name", "").lstrip().startswith((".", "_"))
    ]
    print(f"[DS] Loaded {len(usable)} usable components from {_DS_INDEX_PATH.name} "
          f"(of {len(comps)} documented).")
    return usable

DS_REGISTRY: list = _load_ds_index()

# name → key lookup for the Figma plugin, name → full spec, and the set of valid keys
DS_REGISTRY_MAP: dict = {c["name"]: c["key"] for c in DS_REGISTRY}
DS_SPEC_BY_NAME:  dict = {c["name"]: c for c in DS_REGISTRY}
DS_VALID_KEYS:    set  = {c["key"] for c in DS_REGISTRY}


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
    # ── TODO: revert to Haiku ────────────────────────────────────────────────
    # This is the original Haiku implementation. To switch back: comment out the
    # Opus block below and uncomment this one.
    # return ChatAnthropic(
    #     model="claude-haiku-4-5",
    #     temperature=0.2,                      # Haiku supports temperature
    #     max_tokens=max_tokens,
    #     anthropic_api_key=os.environ["ANTHROPIC_API_KEY"],
    # )

    # ── EXPERIMENT: Opus 4.8 (output-quality comparison) ─────────────────────
    # NOTE: Opus 4.8 deprecated `temperature` — must NOT be passed or the API 400s.
    return ChatAnthropic(
        model="claude-opus-4-8",
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

        # ── Dev cap: shrink the IA for fast test runs ─────────────────────────
        # max_screens > 0 truncates to the first N pages so every downstream
        # stage (flows, layout, compiler/render) only processes N screens.
        # Keeps exactly one root and re-points any orphaned parent_id at it.
        max_screens = int(state.get("max_screens", 0) or 0)
        all_pages   = ia_data.get("pages", [])
        if max_screens > 0 and len(all_pages) > max_screens:
            root = next((p for p in all_pages if not p.get("parent_id")), all_pages[0])
            kept = [root] + [p for p in all_pages if p is not root][: max_screens - 1]
            kept_ids = {p["id"] for p in kept}
            for p in kept:
                if p is root:
                    p["parent_id"] = None
                elif p.get("parent_id") not in kept_ids:
                    p["parent_id"] = root["id"]          # repair dangling parent
            ia_data["pages"] = kept
            print(f"    [DEV CAP] Truncated IA {len(all_pages)} → {len(kept)} screens (max_screens={max_screens}).")

        page_names = [p["name"] for p in ia_data.get("pages", [])]
        print(f"    IA complete — {len(ia_data.get('pages', []))} screens: {page_names}")
        return {
            "ia_data": ia_data,
            "logs": [
                f"[SYS] IA Blueprint generated — {len(ia_data.get('pages', []))} screens, "
                f"{sum(1 for p in ia_data.get('pages', []) if p.get('parent_id') is None)} root node(s)."
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
    props: Dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Component property name -> value, applied to the instance via Figma's "
            "setProperties(). Use the EXACT property name from the component's listed "
            "properties. Include BOTH (a) concrete text for every text property "
            "(e.g. \"Title text\": \"Biller Name\") and (b) chosen variant/boolean "
            "values from the listed options (e.g. \"Type\": \"Profile\", \"R-icon\": \"True\"). "
            "Leave empty for primitives (ds_key is empty)."
        ),
    )
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

    @model_validator(mode="before")
    @classmethod
    def _flatten_nested_children(cls, data):
        """
        The render expects a FLAT element list with `children` holding only id
        strings (coordinates are absolute). Haiku sometimes nests full element
        dicts inside `children` instead of ids. Hoist any such nested dicts up
        into `elements` and replace them with their id strings — recursively —
        so a flaky model response never crashes the compiler and nothing is lost.
        """
        if not isinstance(data, dict):
            return data
        elements = data.get("elements")
        if not isinstance(elements, list):
            return data

        flat: list = []
        seen: set = set()

        def visit(el):
            if not isinstance(el, dict) or not el.get("id"):
                return
            children = el.get("children")
            ids: list = []
            nested: list = []
            if isinstance(children, list):
                for c in children:
                    if isinstance(c, dict) and c.get("id"):
                        ids.append(c["id"])
                        nested.append(c)
                    elif isinstance(c, str):
                        ids.append(c)
            el["children"] = ids
            if el["id"] not in seen:
                seen.add(el["id"])
                flat.append(el)
            for n in nested:
                visit(n)

        for el in elements:
            visit(el)

        data["elements"] = flat
        return data

    def model_post_init(self, __context) -> None:
        object.__setattr__(self, "width",  max(1, round(self.width)))
        object.__setattr__(self, "height", max(1, round(self.height)))

class WireframePayloadCollection(BaseModel):
    screens: List[ScreenWireframe] = Field(description="One ScreenWireframe per screen from the IA")


def _filter_registry_for_batch(batch_pages: list, top_n: int = 40) -> list:
    """
    Returns the top_n most relevant DS components for a batch of pages, scored
    against each component's name + description + use-case contexts (richer than
    name-only). Components unrelated to the screens score zero and are excluded —
    this is what keeps domain-irrelevant components (e.g. payment/bank components
    in a dating app) OUT of the vocabulary the model ever sees.
    """
    # Weighted keyword tokens from this batch
    keywords: dict = {}
    def add(tok: str, w: int = 1):
        tok = tok.strip()
        if len(tok) > 2:
            keywords[tok] = max(keywords.get(tok, 0), w)

    for page in batch_pages:
        for tok in page.get("layout_pattern", "").lower().replace("_", " ").split():
            add(tok, 2)
        for item in page.get("component_inventory", []):
            for tok in item.lower().replace("-", " ").replace("_", " ").split():
                add(tok, 3)
        for tok in page.get("name", "").lower().replace("-", " ").split():
            add(tok, 2)
        for tok in (page.get("description", "") or "").lower().split():
            add(tok, 1)

    scored = []
    for comp in DS_REGISTRY:
        name_l = comp["name"].lower()
        desc_l = (comp.get("description") or "").lower()
        uc_l   = " ".join(
            f"{u.get('context','')} {u.get('variant','')}"
            for u in comp.get("use_cases", []) if isinstance(u, dict)
        ).lower()
        score = 0
        for kw, w in keywords.items():
            if kw in name_l:                       score += 3 * w   # name match = strongest signal
            elif kw in desc_l or kw in uc_l:       score += 1 * w   # semantic match
        if score > 0:
            scored.append((score, comp))

    scored.sort(key=lambda x: x[0], reverse=True)
    filtered = [c for _, c in scored[:top_n]]

    # Always include a few DOMAIN-NEUTRAL structural components so every screen has
    # navigation + button + text + input available regardless of domain.
    essential     = ["button", "tab bar", "app bar", "input field", "list item", "divider", "section header"]
    finance_words = ("payment", "upi", "bank", "rupee", "balance", "transaction",
                     "popcoin", "coin", "rcbp", "biller", "amount", "kyc", "payee", "offer")
    have = {c["name"].lower() for c in filtered}
    for comp in DS_REGISTRY:
        nl = comp["name"].lower()
        # never let the structural fallback pull finance-specific components into a
        # non-fintech screen — the domain comes through scoring, not this safety net.
        if nl in have or any(f in nl for f in finance_words):
            continue
        if any(e in nl for e in essential) and len(filtered) < top_n + 15:
            filtered.append(comp)
            have.add(nl)

    # Domain gate (the hard guarantee): if the batch shows NO finance/commerce
    # intent, drop finance-specific components entirely so a dating/social/utility
    # app can never even be OFFERED payment/bank/UPI components — keyword scoring
    # alone leaks them via generic tokens like "button"/"card".
    blob = " ".join(
        f"{p.get('name','')} {p.get('layout_pattern','')} {p.get('description','')} "
        f"{' '.join(p.get('component_inventory', []))}"
        for p in batch_pages
    ).lower()
    intent_words = finance_words + ("pay", "money", "wallet", "bill", "checkout",
                                    "price", "cart", "order", "subscription",
                                    "fintech", "finance", "invoice", "merchant")
    if not any(w in blob for w in intent_words):
        filtered = [c for c in filtered if not any(f in c["name"].lower() for f in finance_words)]

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

    # DS mode is driven by the user's toggle (state['use_ds']) and only enabled
    # when usable DS components are actually loaded. When on, DS components are a
    # preferred-when-fits palette offered ALONGSIDE primitives — never exclusive.
    use_ds     = bool(state.get("use_ds", False))
    is_ds_mode = use_ds and bool(DS_REGISTRY)
    mode_label = ("DS mode (POP Design System, preferred-when-fits + primitives)"
                  if is_ds_mode else "primitive mode (generic element types)")
    print(f"    Total screens to compile: {len(pages)} | use_ds={use_ds} | {mode_label}")

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
9. Leaf elements have empty children[].
9b. `label` is the VISIBLE text for content elements — TEXT_HEADING, TEXT_BODY, BUTTON,
    ICON_BUTTON, BADGE, INPUT_FIELD (its placeholder/label), LIST_ITEM (its row text), and
    NAV_BAR (its title). Always give these a real, specific label — never leave it generic
    like "Title" or "Label". Pure containers (FRAME, CARD, MODAL_OVERLAY) are backgrounds:
    their on-screen text comes from separate child TEXT_HEADING/TEXT_BODY elements positioned
    on top, NOT from the container's own label."""

    DS_RULES = """10. DS components are a PREFERRED palette, NOT a requirement. Use one ONLY when it
    genuinely matches the element's purpose. If nothing fits, use a PRIMITIVE type
    (section B) and leave `ds_key` empty — mixing DS components and primitives on the
    same screen is expected and correct. A typical screen is mostly primitives with a
    few DS components in the meaningful slots.
11. DOMAIN GUARDRAIL: never place payment, currency (₹ / UPI), bank, KYC, or other
    finance-specific components in an app that is not clearly a payments/fintech product.
    When unsure whether a component fits the domain, use a primitive instead.
12. When you DO use a DS component: `type` must be the exact component name (capitalisation
    matters), `ds_key` must be its key from the name→ds_key lookup, and any variant choices
    must be drawn from that component's listed options — never invent option values.
13. ALWAYS populate `props` for a DS component. The component renders its OWN text from its
    text properties — `label` becomes the layer name only and is NOT shown on screen. So:
    (a) put the real, screen-specific text into the listed "text props" using their exact names
        (e.g. {"Title text": "Biller Name"}); and
    (b) set the chosen variant/boolean values from the listed options
        (e.g. {"Type": "Profile", "R-icon": "True"}).
    Use exact property names and exact option values — never invent either. Combine both into
    one `props` object, e.g. {"Title text": "Recent Transactions", "Body": "False"}.
13b. The "text props" hint shows each slot's CURRENT default in quotes, e.g.
    `text props → Title text="Title", Placeholder text="Placeholder"`. The slot whose default
    is the generic placeholder you'd see on the empty component (usually the Title/Label slot)
    is the one that RENDERS on screen — fill THAT one with the element's visible text. Do not
    put the visible label only into "Placeholder text" if a "Title text"/"Label" slot exists;
    fill the Title/Label slot (you may set both)."""

    FALLBACK_RULES = "10. Leave `ds_key` as an empty string for every element."

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
                batch_components = _filter_registry_for_batch(batch_pages, top_n=40)
                batch_key_map    = {c["name"]: c["key"] for c in batch_components}

                catalog_lines = []
                for c in batch_components:
                    desc  = (c.get("description") or "").strip().replace("\n", " ")[:140]
                    props = c.get("properties", []) or []
                    # Variant / boolean props the model picks an OPTION for.
                    variant_hint = "; ".join(
                        f"{p['name']}=" + "|".join((p.get("options") or [])[:6])
                        for p in props if p.get("options")
                    )[:280]
                    # Free-text props the model must FILL with real screen content.
                    # (type == "Text", or an option-less prop whose name implies text.)
                    # Show each prop's DEFAULT value so the model can tell which slot
                    # actually renders the on-screen text (e.g. Title text="Title")
                    # and target it — not a look-alike like "Placeholder text".
                    def _tp(p):
                        dv = (p.get("default") or "").strip()
                        return f'{p["name"]}="{dv}"' if dv else p["name"]
                    text_props = [
                        _tp(p) for p in props
                        if (p.get("type") or "").strip().lower() == "text"
                        or (not p.get("options") and "text" in (p.get("name") or "").lower())
                    ]
                    text_hint = ", ".join(text_props[:8])[:300]
                    line = f"- {c['name']} [{c.get('category','')}]: {desc}"
                    if variant_hint:
                        line += f"  (variants → {variant_hint})"
                    if text_hint:
                        line += f"  (text props → {text_hint})"
                    catalog_lines.append(line)

                vocab_section = (
                    "Choose each element's `type` from TWO sources:\n\n"
                    "A) DS COMPONENTS — PREFERRED when one fits the element's purpose AND the app domain.\n"
                    "   Use the name verbatim as `type`, set `ds_key`, and pick variants from the options shown:\n"
                    + "\n".join(catalog_lines)
                    + "\n\n   name → ds_key lookup:\n   " + json.dumps(batch_key_map)
                    + "\n\nB) PRIMITIVES — use when NO DS component fits (leave ds_key empty):\n   "
                    + json.dumps(FALLBACK_ELEMENT_TYPES)
                )
                extra_rules = DS_RULES
                print(f"    Batch {batch_num}: {len(batch_components)} DS components offered (+primitives) for {batch_ids}")
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

            # ── Validate & repair DS usage (Stage C) ──────────────────────────
            # Guarantee every DS-typed element carries the CORRECT key, strip any
            # hallucinated keys (→ render as primitive), and keep primitives keyless.
            for screen in collection.screens:
                for el in screen.elements:
                    if is_ds_mode and el.type in DS_REGISTRY_MAP:
                        el.ds_key = DS_REGISTRY_MAP[el.type]   # correct / backfill
                    elif el.ds_key and el.ds_key not in DS_VALID_KEYS:
                        el.ds_key = ""                         # invalid key → primitive
                    elif not is_ds_mode:
                        el.ds_key = ""

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

    bridge_url = os.getenv("BRIDGE_URL", "http://localhost:5001/payload")

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

    print(f"    Applying feedback (round {round_number})…")

    try:
        # Apply the human's requested changes to the PRD.
        updated_prd = apply_prd_feedback(
            prd_data=prd_data,
            concept=concept,
            feedback=human_feedback,
            review=prev_review,
        )

        # Re-evaluate the updated PRD to produce a fresh review for the next round.
        new_review = run_prd_evaluator(
            prd_data=updated_prd,
            concept=concept,
            previous_feedback=human_feedback,
            round_number=round_number + 1,
        )

        print(f"    Updated PRD score: {new_review.quality_score}/10 | is_ready: {new_review.is_ready}")

        # Filling the feedback form always means "I want changes" — so we always
        # return to review. The ONLY way out of the review loop is the human's
        # explicit "this PRD is perfect" override, which approves before this node
        # ever runs (handled in /api/review/respond).
        return {
            "prd_data":      updated_prd,
            "review_data": {
                "stage":  "prd",
                "round":  round_number + 1,
                "review": new_review.model_dump(),
            },
            "review_status": "awaiting_human",
            "human_feedback": {
                **human_feedback,
                "round_number": round_number + 1,
                "confirmed_proceed": False,   # reset for next round
            },
            "logs": [
                f"[DESIGN HEAD] PRD updated (round {round_number + 1}) — score {new_review.quality_score}/10.",
                "[DESIGN HEAD] Revised PRD ready for another review round.",
            ],
        }
    except Exception as e:
        print(f"    [ERR] Apply feedback failed: {e}")
        # Do NOT silently approve and advance — route back to review so the
        # human stays in control and the failure is visible.
        return {
            "review_status": "awaiting_human",
            "human_feedback": {
                **human_feedback,
                "round_number": round_number,
                "confirmed_proceed": False,
            },
            "errors": [f"Apply feedback error: {str(e)}"],
            "logs":   [f"[ERR] Feedback apply failed — returning to review: {str(e)}"],
        }


# ── HTML Compiler schemas ─────────────────────────────────────────────────────

class ThemeSpec(BaseModel):
    """A cohesive, app-wide visual theme the LLM designs once (non-DS mode)."""
    font_family: str = Field(
        description="Primary Google Font family name, e.g. 'Quicksand' or 'Inter'."
    )
    google_fonts_url: str = Field(
        description="Full https://fonts.googleapis.com/css2?... URL importing the font, "
                    "weights 300..800, with &display=swap."
    )
    tailwind_extend: str = Field(
        description=(
            "A VALID JavaScript object literal (NOT JSON, keys may be unquoted) for "
            "tailwind.config theme.extend. MUST define `colors` (M3-style semantic names "
            "like 'primary','surface','surface-alt','on-surface','muted','border', plus "
            "any accents), `fontFamily` (with a `sans` entry using the chosen font), "
            "`borderRadius`, and may add `fontSize`/`spacing`. Example: "
            "{ colors: { \"primary\": \"#9b4500\", \"surface\": \"#fdf9f0\" }, "
            "fontFamily: { sans: [\"Quicksand\",\"sans-serif\"] }, "
            "borderRadius: { \"DEFAULT\": \"1rem\", \"lg\": \"2rem\", \"full\": \"9999px\" } }"
        )
    )
    base_css: str = Field(
        description=(
            "Raw CSS for a <style> block. MUST set the body background-color and "
            "font-family. Define any custom utility classes the screens will use "
            "(e.g. .ambient-shadow, .squishy, .scrollbar-hide) and the "
            ".material-symbols-outlined font-variation-settings rule."
        )
    )
    body_bg: str = Field(description="Hex background colour for the body/iframe, e.g. '#fdf9f0'.")
    design_language: str = Field(
        description=(
            "2-4 sentences describing the visual vibe AND naming the exact token "
            "class names available (e.g. 'use bg-surface, text-on-surface, "
            "bg-primary, rounded-lg') so every screen stays consistent."
        )
    )


class HtmlScreenSpec(BaseModel):
    screen_id: str = Field(description="Must match the page id from the IA")
    screen_name: str = Field(description="Human-readable screen name")
    viewport_width: int = Field(default=390, description="390 for mobile, 1440 for desktop layouts")
    viewport_height: int = Field(default=844, description="Suggested viewport height in px")
    body_html: str = Field(
        description=(
            "The INNER HTML of <body> — everything between <body> and </body>, and "
            "nothing else. No <html>, <head>, <body>, <script src> or <style> config "
            "tags. Use ONLY the theme's Tailwind token classes + standard Tailwind "
            "utilities + Material Symbols (<span class=\"material-symbols-outlined\">icon</span>). "
            "Every image is an <img> with a descriptive data-img-prompt attribute and a "
            "neutral bg-* placeholder. A small <script> for local interactions is allowed."
        )
    )


class HtmlScreenCollection(BaseModel):
    screens: List[HtmlScreenSpec] = Field(description="One HtmlScreenSpec per requested screen")


_HTML_SYSTEM_BASE = """You are a senior product designer-engineer. You translate a screen's
UX layout blueprint into a polished, production-grade mobile UI as a single block of
HTML using Tailwind CSS utility classes.

NON-NEGOTIABLE OUTPUT RULES:
- Output ONLY the inner HTML of <body> for each screen — no <!DOCTYPE>, <html>, <head>,
  <body>, no tailwind config <script>, no font <link>. Those are injected for you.
- Mobile-first: design for a 390px-wide viewport (h≈844). Use a sticky top app bar and,
  when the app has multiple top-level destinations, a fixed bottom nav bar.
- Use the provided THEME token classes for all colour/typography — never hardcode hex
  values in `style=` and never invent token names that aren't in the theme.
- Icons: Material Symbols, e.g. <span class="material-symbols-outlined">search</span>.
  Add the `icon-fill`/FILL variation for active states where it reads better.
- Images: every <img> MUST have (a) a vivid, specific `data-img-prompt="..."` describing
  ideal studio/lifestyle photography for that slot, (b) a sensible aspect/size via Tailwind
  classes, and (c) object-cover. Use a real placeholder src of
  "https://placehold.co/600x600" sized appropriately.
- Content realism: write believable, domain-specific copy, names, prices, and numbers —
  never lorem ipsum or "Title"/"Label" placeholders.
- Fidelity: rounded cards, real spacing, hover/active states, subtle shadows/glows. Aim for
  the quality of a top-tier dribbble shot, not a wireframe. 8-16 meaningful elements/zones.
- Respect the screen's spatial zones and rendering_sequence: the P1_Dominant zone is the
  visual focal point; render components in the given order top-to-bottom.

Return a HtmlScreenCollection with one entry per requested screen."""


async def _theme_for_html(prd_data: dict, concept: str, is_ds_mode: bool):
    """
    Resolve the app-wide theme. DS mode → deterministic POP theme head.
    Otherwise → ask the LLM to design one ThemeSpec for the whole app.
    Returns (head_inner_html, design_language, body_bg).
    """
    if is_ds_mode:
        return ht.pop_theme_head(), ht.POP_DESIGN_LANGUAGE, "#0D0D0D"

    directives = prd_data.get("ux_anchor_directives", {})
    summary    = prd_data.get("executive_summary", {})
    sys = (
        "You are an award-winning brand & UI designer. Design ONE cohesive Tailwind theme "
        "for the whole app — a bespoke palette and type system that matches the product's "
        "tone. Think Material 3 semantic tokens (surface, on-surface, primary, etc.). The "
        "theme must feel intentional and premium, like a real design system, not generic."
    )
    usr = (
        f"Product summary:\n{json.dumps(summary, indent=2)}\n\n"
        f"UX anchor directives (visual posture / tone / layout):\n{json.dumps(directives, indent=2)}\n\n"
        f"Concept:\n{concept[:1200]}\n\n"
        "Return a ThemeSpec. Pick a Google Font that fits the tone. Define semantic color "
        "tokens (surface, surface-alt/container, on-surface, primary, on-primary, muted, "
        "border, plus accents). Include custom utility classes in base_css for shadows and "
        "micro-interactions you reference (e.g. .ambient-shadow, .squishy)."
    )
    try:
        llm = get_llm(max_tokens=4096).with_structured_output(ThemeSpec)
        spec: ThemeSpec = await llm.ainvoke([SystemMessage(content=sys), HumanMessage(content=usr)])
        spec_dict = spec.model_dump()
        print(f"    [HTML] Theme designed — font={spec_dict.get('font_family')}, bg={spec_dict.get('body_bg')}")
        return ht.build_theme_head_from_spec(spec_dict), spec.design_language, spec.body_bg
    except Exception as e:
        print(f"    [HTML] Theme generation failed ({e}); using fallback theme.")
        head = ht.build_theme_head_from_spec({})
        return head, "Clean neutral theme: indigo primary, light surfaces, rounded cards.", "#F4F4F5"


async def html_compiler_node(state: GraphState, writer: "StreamWriter" = None):
    """
    HTML render branch — produces one self-contained HTML document per screen and
    streams each to the frontend (which renders them as floating frames on a
    tldraw canvas). Mirrors the wireframe compiler's batching (2 screens/call).

    Phase 1: resolve ONE app-wide theme (POP if DS mode, else LLM-designed).
    Phase 2: per batch, generate each screen's <body> inner HTML using that theme;
             wrap in the shared document shell and emit via the custom stream writer.
    """
    print("--- Executing HTML Compiler Node ---")

    ia_data        = state["ia_data"]
    ux_layout_data = state["ux_layout_data"]
    prd_data       = state["prd_data"]
    concept        = state.get("concept", "")
    user_flow_data = state.get("user_flow_data", {})

    pages          = ia_data.get("pages", [])
    screen_layouts = ux_layout_data.get("screen_layouts", [])
    use_ds         = bool(state.get("use_ds", False))
    is_ds_mode     = use_ds and bool(DS_REGISTRY)

    # ── Phase 1: theme ────────────────────────────────────────────────────────
    head_inner, design_language, body_bg = await _theme_for_html(prd_data, concept, is_ds_mode)

    layout_by_id = {sl.get("page_id"): sl for sl in screen_layouts}
    total        = len(pages)
    BATCH_SIZE   = 2
    total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"    Screens to build: {total} | ds_mode={is_ds_mode} | batches={total_batches}")

    system_prompt = (
        f"{_HTML_SYSTEM_BASE}\n\nTHEME — design language and available token classes:\n"
        f"{design_language}"
    )

    def hlog(msg: str):
        print(f"    [HTML] {msg}", flush=True)

    # Resolve a usable stream writer: prefer the injected one, fall back to
    # get_stream_writer() (works inside async nodes on langgraph ≥0.2).
    active_writer = writer
    if active_writer is None and get_stream_writer is not None:
        try:
            active_writer = get_stream_writer()
            hlog("acquired writer via get_stream_writer() fallback")
        except Exception as gwe:  # noqa: BLE001
            hlog(f"get_stream_writer() unavailable: {type(gwe).__name__}: {gwe}")

    hlog(f"theme ready (bg={body_bg}); design_language {len(design_language)} chars")
    hlog(f"writer resolved: {active_writer is not None} "
         f"(injected={writer is not None}, type={type(active_writer).__name__})")

    # Defensive, NON-FATAL emit. Per-screen streaming is a nice-to-have; if the
    # stream writer is unavailable or raises (e.g. context issues), we log and
    # keep going — the screens are still returned in bulk at the end as a fallback.
    emit_disabled = {"flag": False}
    def emit(screen_obj: dict, idx: int):
        if active_writer is None or emit_disabled["flag"]:
            return
        try:
            active_writer({"html_screen": {**screen_obj, "index": idx, "total": total}})
            hlog(f"  → streamed screen idx={idx} via writer")
        except Exception as we:  # noqa: BLE001
            emit_disabled["flag"] = True  # stop trying after the first failure
            hlog(f"  ! writer emit failed (non-fatal, will bulk-return): "
                 f"{type(we).__name__}: {we}")

    html_screens: List[dict] = []
    batch_errors: List[str] = []
    emitted = 0

    structured_llm = get_llm(max_tokens=16000).with_structured_output(HtmlScreenCollection)
    hlog(f"structured LLM ready; starting {total_batches} batch(es)")

    for i in range(0, total, BATCH_SIZE):
        batch_pages = pages[i:i + BATCH_SIZE]
        batch_ids   = [p["id"] for p in batch_pages]
        batch_num   = i // BATCH_SIZE + 1

        try:
            batch_layouts = []
            for pid in batch_ids:
                sl = layout_by_id.get(pid, {})
                batch_layouts.append({
                    "page_id":       pid,
                    "grid_system":   sl.get("grid_system"),
                    "scroll_behavior": sl.get("scroll_behavior"),
                    "spatial_zones": [
                        {
                            "zone_id":            z.get("zone_id"),
                            "visual_weight":      z.get("visual_weight"),
                            "rendering_sequence": z.get("rendering_sequence", []),
                        }
                        for z in sl.get("spatial_zones", [])
                    ],
                    "empty_state_guidance": sl.get("empty_state_guidance", ""),
                })

            batch_prompt = f"""Build the <body> inner HTML for each of these screens (batch {batch_num}/{total_batches}):
{json.dumps(batch_ids)}

IA pages (names + component_inventory):
{json.dumps(batch_pages, indent=2)}

UX layout zones (focal point + rendering order per screen):
{json.dumps(batch_layouts, indent=2)}

Brand / UX directives (tone, posture):
{json.dumps(prd_data.get("ux_anchor_directives", {}), indent=2)}

User flows (for cross-screen navigation cues):
{json.dumps(user_flow_data, indent=2)}"""

            hlog(f"batch {batch_num}/{total_batches} {batch_ids} — invoking LLM "
                 f"(prompt {len(batch_prompt)} chars)…")
            collection: HtmlScreenCollection = await structured_llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=batch_prompt),
            ])
            hlog(f"batch {batch_num} LLM returned {len(collection.screens)} screen(s): "
                 f"{[s.screen_id for s in collection.screens]}")

            for spec in collection.screens:
                hlog(f"  building doc for '{spec.screen_id}' "
                     f"(body {len(spec.body_html or '')} chars, "
                     f"{spec.viewport_width}x{spec.viewport_height})")
                document = ht.build_document(
                    title=spec.screen_name,
                    head_inner=head_inner,
                    body_inner=spec.body_html,
                    body_class="",
                )
                screen_obj = {
                    "screen_id":       spec.screen_id,
                    "screen_name":     spec.screen_name,
                    "viewport_width":  spec.viewport_width or 390,
                    "viewport_height": spec.viewport_height or 844,
                    "html":            document,
                }
                html_screens.append(screen_obj)
                emit(screen_obj, emitted)
                emitted += 1
                hlog(f"screen ready ({emitted}/{total}): {spec.screen_id} "
                     f"(doc {len(document)} chars)")

        except Exception as be:  # noqa: BLE001 — one bad batch must not kill the rest
            import traceback
            hlog(f"! batch {batch_num} FAILED: {type(be).__name__}: {be}")
            traceback.print_exc()
            batch_errors.append(f"batch {batch_num} ({batch_ids}): {type(be).__name__}: {be}")
            continue

    hlog(f"HTML Compiler complete — {len(html_screens)}/{total} screen(s), "
         f"{len(batch_errors)} batch error(s).")
    logs = [f"[SYS] HTML Compiler complete — {len(html_screens)}/{total} screen(s) generated."]
    if batch_errors:
        logs += [f"[WARN] {e}" for e in batch_errors]
    out = {"html_screens": html_screens, "logs": logs}
    if batch_errors:
        out["errors"] = [f"HTML Compiler batch errors: {'; '.join(batch_errors)}"]
    return out
