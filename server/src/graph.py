from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from .state import GraphState
from .nodes import (
    prd_node, prd_review_node, prd_apply_feedback_node,
    ia_node, user_flow_node, ux_layout_node,
    wireframe_compiler_node, render_node,
)


# ── Routers ───────────────────────────────────────────────────────────────────

def _after_prd_review(state: GraphState) -> str:
    """
    Runs after prd_review_node (and after the interrupt fires + resumes).
    - approved         → ia_node (pipeline continues with refined PRD)
    - anything else    → prd_apply_feedback_node (apply human feedback, redo PRD)
    """
    status = state.get("review_status", "")
    if status == "approved":
        return "ia_node"
    return "prd_apply_feedback_node"


def _after_prd_apply(state: GraphState) -> str:
    """
    Runs after prd_apply_feedback_node.
    - approved         → ia_node
    - awaiting_human   → prd_review_node (another round, interrupt will fire again)
    """
    status = state.get("review_status", "")
    if status == "approved":
        return "ia_node"
    return "prd_review_node"


# ── Graph factory ─────────────────────────────────────────────────────────────

def create_graph():
    workflow = StateGraph(GraphState)

    workflow.add_node("prd_node",                  prd_node)
    workflow.add_node("prd_review_node",           prd_review_node)
    workflow.add_node("prd_apply_feedback_node",   prd_apply_feedback_node)
    workflow.add_node("ia_node",                   ia_node)
    workflow.add_node("user_flow_node",            user_flow_node)
    workflow.add_node("ux_layout_node",            ux_layout_node)
    workflow.add_node("wireframe_compiler_node",   wireframe_compiler_node)
    workflow.add_node("render_node",               render_node)

    workflow.set_entry_point("prd_node")

    workflow.add_edge("prd_node", "prd_review_node")

    # After prd_review_node: route based on review_status
    workflow.add_conditional_edges("prd_review_node", _after_prd_review, {
        "ia_node":                 "ia_node",
        "prd_apply_feedback_node": "prd_apply_feedback_node",
    })

    # After prd_apply_feedback_node: approved → ia_node, else → re-review
    workflow.add_conditional_edges("prd_apply_feedback_node", _after_prd_apply, {
        "ia_node":         "ia_node",
        "prd_review_node": "prd_review_node",
    })

    workflow.add_edge("ia_node",             "user_flow_node")
    workflow.add_edge("user_flow_node",          "ux_layout_node")
    workflow.add_edge("ux_layout_node",          "wireframe_compiler_node")
    workflow.add_edge("wireframe_compiler_node", "render_node")
    workflow.add_edge("render_node",             END)

    checkpointer = MemorySaver()

    return workflow.compile(
        checkpointer=checkpointer,
        # Graph pauses after prd_review_node so the server can
        # emit the review data to frontend and wait for human feedback.
        interrupt_after=["prd_review_node"],
    )


app = create_graph()
