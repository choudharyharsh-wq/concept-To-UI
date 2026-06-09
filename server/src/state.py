from typing import Annotated, TypedDict, List, Dict, Any
import operator

class GraphState(TypedDict):
    """
    Represents the state of our graph.
    """
    concept: str
    figma_url: str
    prd_data: Dict[str, Any]
    ia_data: Dict[str, Any]
    user_flow_data: Dict[str, Any]
    ux_layout_data: Dict[str, Any]
    copy_data: Dict[str, Any]
    layout_data: Dict[str, Any]
    render_data: Dict[str, Any]
    logs: Annotated[List[str], operator.add]
    errors: List[str]
