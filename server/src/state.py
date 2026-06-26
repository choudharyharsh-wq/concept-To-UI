from typing import Annotated, TypedDict, List, Dict, Any, Optional
import operator

class GraphState(TypedDict):
    """
    Represents the state of our graph.
    """
    concept: str
    figma_url: str
    use_ds: bool                     # toggle: compile against the POP Design System vs generic primitives
    prd_data: Dict[str, Any]
    ia_data: Dict[str, Any]
    user_flow_data: Dict[str, Any]
    ux_layout_data: Dict[str, Any]
    wireframe_payload: Dict[str, Any]
    render_data: Dict[str, Any]
    logs: Annotated[List[str], operator.add]
    errors: List[str]

    # ── Design Head review fields ─────────────────────────────────────────────
    # Populated by review nodes; cleared between stages.
    review_data: Dict[str, Any]      # questions + suggestions from Design Head
    human_feedback: Dict[str, Any]   # answers + accepted suggestions from human
    review_status: str               # "awaiting_human" | "feedback_received" | "approved"
