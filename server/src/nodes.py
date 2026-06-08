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
    Analyzes concept and compiles PRD.
    """
    print("--- Executing PRD Node ---")
    concept = state["concept"]
    
    prompt = f"""
    You are an expert Product Manager. Based on the following concept, generate a structured Product Requirements Document (PRD).
    Concept: {concept}
    
    Return the response in EXACTLY this JSON format:
    {{
        "target_audience": "string",
        "core_features": ["feature 1", "feature 2", ...],
        "success_metrics": "string"
    }}
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        # Extract JSON from response (handling potential markdown formatting)
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        prd_data = json.loads(content)
        return {
            "prd_data": prd_data,
            "logs": ["[SYS] PRD generation completed."]
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
