import os
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from .state import GraphState

load_dotenv(override=True)

# Initialize Gemini LLM
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)

def prd_node(state: GraphState):
    """
    Analyzes concept and compiles a structured PRD (Google + Microsoft methodology).
    """
    print("--- Executing PRD Node ---")
    concept = state["concept"]

    system_prompt = """You are a senior Product Manager trained on Google and Microsoft's product development frameworks.
Your sole job is to output a valid JSON object. Do not write any text, explanation, or markdown outside of the JSON block.

GUARDRAILS YOU MUST FOLLOW:
1. DATA ENFORCER: Populate every key listed in the schema below. Never omit a key or use free-form text where structured data is required.
2. SCOPE CUTTER: For every 3 P0 features you identify, you MUST list at least 2 explicit Non-Goals. This keeps the wireframe footprint lean.
3. UX HAND-OFF: Every item in p0_features and p1_features must include a "component_type" and "action" field so the downstream layout node can parse it without ambiguity."""

    user_prompt = f"""Concept: {concept}

Return ONLY a JSON object matching this exact schema — no markdown fences, no prose:

{{
  "executive_summary": {{
    "north_star": "<max 3 sentences: why we build this and the single most important user action>",
    "primary_value_proposition": "<one sentence>"
  }},
  "target_persona": {{
    "name": "<persona name, e.g. 'The Busy Pet Parent'>",
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
        "component_type": "<e.g. form | button | dashboard_card | list | modal>",
        "action": "<e.g. submit_form | navigate | display_data | trigger_reward>"
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
    "visual_posture": "<e.g. utilitarian-dashboard | minimalist-form-first | content-rich-feed>",
    "tone": "<e.g. warm-encouraging | professional-neutral | playful-rewarding>",
    "layout_hint": "<structural guidance for the wireframe, e.g. sticky nav + card grid>"
  }}
}}"""

    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    try:
        content = response.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        prd_data = json.loads(content)

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
    Structures screen architectures based on PRD.
    """
    print("--- Executing IA Node ---")
    prd_data = state["prd_data"]
    
    prompt = f"""
    Based on the following PRD, create an Information Architecture (IA) Map showing the core screens.
    PRD: {json.dumps(prd_data)}
    
    Return the response in EXACTLY this JSON format:
    {{
        "screens": [
            {{ "name": "01. Screen Name", "description": "Brief purpose" }},
            ...
        ]
    }}
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        
        ia_data = json.loads(content)
        return {
            "ia_data": ia_data,
            "logs": ["[SYS] IA Map structured."]
        }
    except Exception as e:
        return {
            "errors": [f"Error in IA node: {str(e)}"],
            "logs": [f"[ERR] IA mapping failed: {str(e)}"]
        }

def copy_node(state: GraphState):
    """
    Drafts user interface copy.
    """
    print("--- Executing Copy Node ---")
    ia_data = state["ia_data"]
    
    prompt = f"""
    Based on the following screen map, generate key UI copy (headers, buttons, etc.).
    Screens: {json.dumps(ia_data)}
    
    Return the response in EXACTLY this JSON format:
    {{
        "copy_map": [
            {{ "key": "Element Name", "value": "Exact UI Text" }},
            ...
        ]
    }}
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
            
        copy_data = json.loads(content)
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
    """
    Binds layout logic to design system primitives.
    """
    print("--- Executing Layout Node ---")
    # This node simulates complex layout selection logic
    prompt = f"""
    Suggest design system components for these screens: {json.dumps(state['ia_data'])}
    Return 4 key components in a JSON list: {{"components": ["comp1", "comp2", ...]}}
    """
    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        layout_data = json.loads(content)
        return {
            "layout_data": layout_data,
            "logs": ["[SYS] Layout logic bound."]
        }
    except:
        return {
            "layout_data": {"components": ["Global Nav", "Main Hero", "Action Button", "Footer"]},
            "logs": ["[SYS] Layout logic bound (using defaults)."]
        }

def render_node(state: GraphState):
    """
    Simulates Figma Canvas rendering.
    """
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
