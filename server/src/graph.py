from langgraph.graph import StateGraph, END
from .state import GraphState
from .nodes import prd_node, ia_node, user_flow_node, copy_node, layout_node, render_node

def create_graph():
    workflow = StateGraph(GraphState)

    workflow.add_node("prd_node",       prd_node)
    workflow.add_node("ia_node",        ia_node)
    workflow.add_node("user_flow_node", user_flow_node)
    workflow.add_node("copy_node",      copy_node)
    workflow.add_node("layout_node",    layout_node)
    workflow.add_node("render_node",    render_node)

    workflow.set_entry_point("prd_node")
    workflow.add_edge("prd_node",       "ia_node")
    workflow.add_edge("ia_node",        "user_flow_node")
    workflow.add_edge("user_flow_node", "copy_node")
    workflow.add_edge("copy_node",      "layout_node")
    workflow.add_edge("layout_node",    "render_node")
    workflow.add_edge("render_node",    END)

    return workflow.compile()

app = create_graph()
