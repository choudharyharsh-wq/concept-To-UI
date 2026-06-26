import sys
import os
import json
import warnings
warnings.filterwarnings("ignore")

# Add the current directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.graph import app

def run_workflow(concept: str, figma_url: str, use_ds: bool = False):
    print(f"\n🚀 Starting 'Concept to UI' Pipeline")
    print(f"Concept: {concept}")
    print(f"Figma URL: {figma_url}")
    print(f"Use DS: {use_ds}\n")

    # Initial state
    initial_state = {
        "concept": concept,
        "figma_url": figma_url,
        "use_ds": use_ds,
        "prd_data": {},
        "ia_data": {},
        "copy_data": {},
        "layout_data": {},
        "render_data": {},
        "logs": [],
        "errors": []
    }
    
    # Run the graph
    # We use stream to see the progress
    for event in app.stream(initial_state):
        for node_name, output in event.items():
            print(f"✅ Completed Stage: {node_name}")
            if "logs" in output:
                for log in output["logs"]:
                    print(f"   {log}")
    
    # Final result
    final_state = app.invoke(initial_state)
    
    print("\n--- Final Pipeline Output ---")
    if final_state["errors"]:
        print(f"❌ Errors: {final_state['errors']}")
    else:
        print("PRD Output:", json.dumps(final_state["prd_data"], indent=2))
        print("\nSUCCESS: All stages completed.")

if __name__ == "__main__":
    concept = "A minimalist habit tracker for dog owners that rewards consistency with pet store discounts."
    figma_url = "https://www.figma.com/file/mock-id"
    run_workflow(concept, figma_url)
