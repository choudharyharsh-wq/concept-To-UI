from langgraph.graph import StateGraph, END
from .state import GraphState
from .nodes import prd_node, ia_node, copy_node, layout_node, render_node

def create_graph():
    # Initialize the graph with our state definition
    workflow = StateGraph(GraphState)

    # Define the nodes
    workflow.add_node("prd_node", prd_node)
    workflow.add_node("ia_node", ia_node)
    workflow.add_node("copy_node", copy_node)
    workflow.add_node("layout_node", layout_node)
    workflow.add_node("render_node", render_node)

    # Define the edges
    workflow.set_entry_point("prd_node")
    workflow.add_edge("prd_node", "ia_node")
    workflow.add_edge("ia_node", "copy_node")
    workflow.add_edge("copy_node", "layout_node")
    workflow.add_edge("layout_node", "render_node")
    workflow.add_edge("render_node", END)

    # Compile the graph
    return workflow.compile()

# Instance of the compiled graph
app = create_graph()
