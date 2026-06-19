from langgraph.graph import StateGraph, END
from .state import GraphState
from .nodes import (
    prd_node,
    prd_review_node,
    prd_apply_feedback_node,
    ia_node,
    user_flow_node,
    ux_layout_node,
    wireframe_compiler_node,
    render_node,
)


def _prd_review_router(state: GraphState) -> str:
    """
    After prd_review_node emits review data:
    - "awaiting_human" → stay at review (graph idles; frontend sends feedback via API)
    - "approved"       → proceed to ia_node
    """
    status = state.get("review_status", "awaiting_human")
    if status == "approved":
        return "ia_node"
    return "prd_review_node"   # loop back — will be interrupted by human feedback


def _prd_feedback_router(state: GraphState) -> str:
    """
    After prd_apply_feedback_node re-evaluates:
    - "approved"       → proceed to ia_node
    - "awaiting_human" → back to review node for another round
    """
    status = state.get("review_status", "awaiting_human")
    if status == "approved":
        return "ia_node"
    return "prd_review_node"


def create_graph():
    workflow = StateGraph(GraphState)

    # ── Register nodes ────────────────────────────────────────────────────────
    workflow.add_node("prd_node",                  prd_node)
    workflow.add_node("prd_review_node",           prd_review_node)
    workflow.add_node("prd_apply_feedback_node",   prd_apply_feedback_node)
    workflow.add_node("ia_node",                   ia_node)
    workflow.add_node("user_flow_node",            user_flow_node)
    workflow.add_node("ux_layout_node",            ux_layout_node)
    workflow.add_node("wireframe_compiler_node",   wireframe_compiler_node)
    workflow.add_node("render_node",               render_node)

    # ── Wire edges ────────────────────────────────────────────────────────────
    workflow.set_entry_point("prd_node")

    # PRD → review gate
    workflow.add_edge("prd_node", "prd_review_node")

    # Review → conditional: approved goes to IA, otherwise stays at review
    workflow.add_conditional_edges(
        "prd_review_node",
        _prd_review_router,
        {
            "ia_node":        "ia_node",
            "prd_review_node": "prd_review_node",
        }
    )

    # Apply feedback → conditional: approved goes to IA, else back to review
    workflow.add_conditional_edges(
        "prd_apply_feedback_node",
        _prd_feedback_router,
        {
            "ia_node":        "ia_node",
            "prd_review_node": "prd_review_node",
        }
    )

    # Remaining pipeline — linear
    workflow.add_edge("ia_node",                 "user_flow_node")
    workflow.add_edge("user_flow_node",          "ux_layout_node")
    workflow.add_edge("ux_layout_node",          "wireframe_compiler_node")
    workflow.add_edge("wireframe_compiler_node", "render_node")
    workflow.add_edge("render_node",             END)

    return workflow.compile()


app = create_graph()
