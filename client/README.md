# Concept to UI - Frontend

This is the Next.js frontend for the Concept to UI project.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Animations:** Tailwind CSS Animate, CSS Keyframes
- **State Management:** React Hooks (with SSE simulation)

## Getting Started

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- **Live Generation Pipeline:** A 5-stage visualization of the AI process.
- **Mock Simulation:** Automatically simulates the full 5-stage workflow for demonstration purposes.
- **Sharing Hub:** A dedicated route (`/share/[id]`) for reviewing completed runs asynchronously.
- **Developer-First UI:** Monospace terminal outputs, glowing effects, and a sleek dark aesthetic.
