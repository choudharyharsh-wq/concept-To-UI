You are an expert Frontend Engineer. Your task is to build a complete, highly interactive, production-ready frontend for a project named "Concept to UI" using Next.js (App Router), Tailwind CSS, TypeScript, and Lucide React icons. 

The application must support two core pages: 
1. The Generation Dashboard (`/`): Where users submit concepts and see them generate in real-time.
2. The Async Sharing & Review Hub (`/share/[id]`): A view-only snapshot page that allows teammates to review historical or complete runs asynchronously without requiring meetings.

### Core Tech Stack Constraints
- Framework: Next.js (App Router preferred, using 'use client' where interactive state is required).
- Styling: Tailwind CSS (Sleek, modern, dark-mode first or dark-slate professional developer aesthetic).
- Icons: Lucide React.
- Extra Packages: Use standard browser native APIs (like EventSource) for streaming data or basic packages like `markdown-to-jsx` or `react-markdown` if needed for rendering text components.

---

### Part 1: Page Layouts & Routes

#### Route 1: Main Dashboard (`/`)
- A clean, centered layout with a hero header: "Concept to UI".
- Two prominent input fields in a floating card container:
  1. Concept Textarea: A rich text input field with a placeholder like: "e.g., A minimalist habit tracker for dog owners that rewards consistency with pet store discounts."
  2. Figma File URL Input: A text input field validated for real Figma links (`figma.com/file/...`).
- A prominent submit button: "Generate Wireframes" with an active loading state.
- Underneath the inputs, show the "Live Generation Pipeline Container" (detailed below) which only displays once a generation run begins.

#### Route 2: Async Sharing Hub (`/share/[id]`)
- Fully responsive sharing view that renders the absolute identical 5-stage visualization component as the main page, but in a "completed" static snapshot view. 
- At the top of this page, display a clean top bar stating: "Project Archive Review • Generated [Date Timestamp]". Include a "Copy Figma Link" and an "Open in Figma" primary button.

---

### Part 2: The 5-Stage Live Pipeline Visualization (The Core Component)

This component must render as a continuous, vertical timeline or stepper. Every stage should have three distinct visual states: `pending` (grayed out text/borders), `active` (glow effects, animated spinners, pulsing icons), and `completed` (green checkmarks, slide-down content reveals).

Implement the following precise UI blueprints for each of the 5 async stages:

#### Stage 1: Product Requirements Document (`prd_node`)
- **Active State Animation:** Pulsing document icon with text "Analyzing concept and compiling PRD via ChatPRD..."
- **Completed State Visualization:** Slide-down smoothly opens a card component. Inside, render the incoming text data beautifully using a Markdown component or structured layout with section headings: "Target Audience", "Core Features", and "Success Metrics". Use a crisp, light-gray text on a dark slate surface background.

#### Stage 2: Information Architecture Map (`ia_node`)
- **Active State Animation:** Network/flow chart icon spinning slowly with text "Structuring screen architectures..."
- **Completed State Visualization:** Render a visual grid of the screen sequences mapped by the AI. Each screen should appear as a card inside a horizontal flex layout connected by right-arrows (`→`). Show the Screen Name (e.g., "01. Authentication") and a bulleted list of metadata/purpose (e.g., "• Simple Email/OAuth login, • Error recovery links").

#### Stage 3: UX Copywriting Engine (`copy_node`)
- **Active State Animation:** Typing indicator or pen icon tracing a path with text "Drafting user interface copy and button text..."
- **Completed State Visualization:** A compact, interactive accordion block titled "View Interface Copy Map". Clicking it expands to reveal key-value pairs separated by screen tabs, mapping structural sections to exact strings (e.g., `Hero Header: "Welcome Back, Human!"`, `Primary Button: "Start Tracking Daily Habits"`).

#### Stage 4: Layout Logic Selector (`layout_node`)
- **Active State Animation:** Grid icon pulsing with a scaling box frame animation and text "Binding layout logic to design system primitives..."
- **Completed State Visualization:** Renders a clean structural checklist of design system components chosen by the AI model. For example:
  - `[✓] Global Navigation Bar (sticky-top, variant: absolute-dark)`
  - `[✓] Metric Dashboard Card Component (3x Grid Layout)`
  - `[✓] Floating Action Input Button (bottom-right positioning)`

#### Stage 5: Figma Canvas Renderer (`render_node`)
- **Active State Animation:** Figma logomark pulsing in brand colors with a streaming terminal log block directly underneath it.
- **The Terminal Output Block:** A developer-focused terminal emulator window (pitch black background, monospace font like `font-mono`, green/amber text outputs). It must automatically scroll to the bottom as fake or streamed logs write to it line-by-line simulating the Remote Figma MCP Server executing canvas mutations:
  - `[SYS] Connecting to Remote Figma MCP Server...`
  - `[MCP] use_figma tool active: creating canvas viewport 'Draft-Run-01'`
  - `[MCP] use_figma node created: Frame "Dashboard" [w:1440, h:1024]`
  - `[MCP] Injecting layout token: var(--color-brand-primary)`
  - `[MCP] Instantiating native component: Button/Primary`
- **Completed State Grand Finale:** The terminal flashes green at the bottom with `[SUCCESS] Render Completed.` The panel unlocks a large, glowing Call-To-Action button with an animated gradient border: **"Open in Figma Canvas"** linking directly to the original file provided by the user.

---

### Part 3: State Management & SSE Logic

Provide a robust React Hook or state structure to stream the server-sent events (SSE). The hook must hit an internal or external backend endpoint using a Server-Sent Event connection (`EventSource`).
- Parse structured JSON messages coming from the backend stream chunk-by-chunk.
- Expected data format incoming from stream looks like:
  `{ "phase": "prd_node", "status": "active" | "completed", "data": {...} }`
- Ensure data updates append smoothly to the state without causing the entire layout to flicker or unmount.
- Include mock data fallbacks in the client file so that if the user clicks "Generate" without a running backend stream, it cleanly simulates the full 5-stage workflow timeline from end-to-end with realistic delays (e.g., 2-3 seconds per node) for flawless standalone demonstration.

Please generate clean, highly commented, componentized code splitting the dashboard, step elements, and icons cleanly.