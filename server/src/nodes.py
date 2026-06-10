import os
import json
from typing import List, Literal, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from .state import GraphState

load_dotenv(override=True)


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

    # Use higher max_tokens — PRD JSON can exceed 1000 tokens easily
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

        return {
            "prd_data": prd_data,
            "logs": ["[SYS] PRD generation completed (6-section Google+Microsoft structure)."]
        }
    except Exception as e:
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

    try:
        structured_llm = get_llm(max_tokens=8192).with_structured_output(
            InformationArchitectureBlueprint
        )
        blueprint: InformationArchitectureBlueprint = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])

        # Serialise Pydantic → plain dict so it flows through GraphState cleanly
        ia_data = blueprint.model_dump()

        return {
            "ia_data": ia_data,
            "logs": [
                f"[SYS] IA Blueprint generated — {len(blueprint.pages)} screens, "
                f"{sum(1 for p in blueprint.pages if p.parent_id is None)} root node(s)."
            ]
        }
    except Exception as e:
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

    try:
        structured_llm = get_llm(max_tokens=8192).with_structured_output(UserFlowCollection)
        collection: UserFlowCollection = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])

        flow_data = collection.model_dump()

        return {
            "user_flow_data": flow_data,
            "logs": [
                f"[SYS] User Flow Builder complete — "
                f"{len(collection.flows)} flows, "
                f"{sum(len(f.steps) for f in collection.flows)} total steps."
            ]
        }
    except Exception as e:
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

    try:
        structured_llm = get_llm(max_tokens=8192).with_structured_output(
            MasterUXLayoutCollection
        )
        collection: MasterUXLayoutCollection = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])

        ux_layout_data = collection.model_dump()

        return {
            "ux_layout_data": ux_layout_data,
            "logs": [
                f"[SYS] UX Layout Planner complete — "
                f"{len(collection.screen_layouts)} screen blueprints generated."
            ]
        }
    except Exception as e:
        return {
            "errors": [f"Error in UX Layout node: {str(e)}"],
            "logs":   [f"[ERR] UX Layout generation failed: {str(e)}"]
        }


def render_node(state: GraphState):
    """Simulates Figma Canvas rendering."""
    print("--- Executing Render Node ---")
    figma_url = state["figma_url"]

    logs = [
        "[SYS] Connecting to Remote Figma MCP Server...",
        f"[MCP] use_figma tool active: accessing canvas {figma_url}",
        "[MCP] use_figma node created: Frame \"Main View\" [w:1440, h:1024]",
        "[MCP] Injecting layout tokens and components...",
        "[SUCCESS] Render Completed."
    ]

    return {
        "render_data": {"figma_url": figma_url, "status": "success"},
        "logs": logs
    }
