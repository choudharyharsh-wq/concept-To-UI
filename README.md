# LangGraph Gemini Setup

A robust boilerplate for building AI workflows using LangGraph and Gemini LLM.

## Setup

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment:**
   Edit the `.env` file and add your `GOOGLE_API_KEY`.

3. **Run the Project:**
   ```bash
   python src/main.py
   ```

## Structure

- `src/state.py`: Defines the data structure (State) passed between nodes.
- `src/nodes.py`: Contains the logic for each step in your workflow.
- `src/graph.py`: Orchestrates the nodes and defines the flow (edges).
- `src/main.py`: Entry point for running and testing the graph.
# concept-To-UI
