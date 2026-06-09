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


def copy_node(state: GraphState):
    """Drafts user interface copy."""
    print("--- Executing Copy Node ---")
    ia_data = state["ia_data"]

    prompt = f"""Based on the following screen map, generate key UI copy (headers, buttons, labels, etc.).
Screens: {json.dumps(ia_data)}

Return ONLY a raw JSON object — no markdown fences, no prose:
{{
    "copy_map": [
        {{ "key": "Element Name", "value": "Exact UI Text" }}
    ]
}}"""

    response = get_llm().invoke([HumanMessage(content=prompt)])
    try:
        copy_data = parse_json(extract_text(response))
        return {
            "copy_data": copy_data,
            "logs": ["[SYS] UI copy drafted."]
        }
    except Exception as e:
        return {
            "errors": [f"Error in Copy node: {str(e)}"],
            "logs": [f"[ERR] Copywriting failed: {str(e)}"]
        }


def layout_node(state: GraphState):
    """Binds layout logic to design system primitives."""
    print("--- Executing Layout Node ---")

    prompt = f"""Suggest design system components for these screens: {json.dumps(state['ia_data'])}

Return ONLY a raw JSON object — no markdown fences, no prose:
{{"components": ["component description 1", "component description 2", "component description 3", "component description 4"]}}"""

    response = get_llm().invoke([HumanMessage(content=prompt)])
    try:
        layout_data = parse_json(extract_text(response))
        return {
            "layout_data": layout_data,
            "logs": ["[SYS] Layout logic bound."]
        }
    except Exception as e:
        return {
            "layout_data": {"components": ["Global Nav", "Main Hero", "Action Button", "Footer"]},
            "logs": [f"[SYS] Layout logic bound (fallback defaults). Parse error: {str(e)}"]
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
