# Figma MCP Write Integration — Research & Setup Guide

Complete reference for wiring the LangGraph `render_node` to write actual wireframes into a Figma canvas.

---

## The Core Reality (Read This First)

The **Figma REST API cannot write frames, shapes, or text to the canvas.** It only supports writing comments, webhooks, and design variables. Every tool that actually puts content on the canvas goes through the **Figma Plugin API** (JavaScript running inside Figma desktop). The only architectural question is how you bridge from your Python LangGraph backend to that Plugin API.

---

## Options Compared

| Option | Writes to Canvas | Output Quality | Backend Integration | Cost | Status |
|---|---|---|---|---|---|
| Figma REST API (nodes) | ❌ No | — | Easy (HTTP + PAT) | Free | Frozen on writes |
| Figma REST API (variables only) | ✅ Variables only | Design tokens | Easy (HTTP + PAT) | Free | Active |
| **southleft/figma-console-mcp** | ✅ Full canvas | Excellent (full Plugin API) | Medium (Node.js local + Desktop Bridge) | Free/OSS | Actively developed ✅ |
| Official figma-developer-mcp | ✅ Full canvas | Good (beta) | Medium (approved clients only, OAuth) | Free beta → paid | Active beta |
| Custom Plugin + WebSocket bridge | ✅ Full canvas | Full control | Hard (DIY everything) | Free | Active (DIY) |
| GLips/Figma-Context-MCP | ❌ Read-only | — | — | Free/OSS | Active (wrong tool) |
| Builder.io / Anima / Locofy | ❌ Wrong direction | — | None (Figma→Code only) | Freemium | Active |
| UX Pilot / Figma Make | ✅ Via plugin UI | Good wireframes | None (no backend API) | Freemium | Active |
| `.fig` file import via API | ❌ Not possible | — | — | — | Not available |

**Winner for this project: `southleft/figma-console-mcp`**

---

## Chosen Approach: southleft/figma-console-mcp

### Why

- **106 tools** including `figma_execute` — runs arbitrary Plugin API JavaScript from your backend
- Exposes a cloud HTTP endpoint callable with a PAT Bearer token (no OAuth, Python-friendly)
- Actively maintained, more mature than alternatives
- Free and open source
- `figma_execute` lets your render_node generate Plugin API JS dynamically from structured pipeline data

### Architecture

```
render_node (Python / LangGraph)
    │
    │  HTTP POST  (PAT Bearer token)
    ▼
figma-console-mcp cloud relay
(figma-console-mcp.southleft.com/mcp)
    │
    │  WebSocket
    ▼
Desktop Bridge plugin
(running inside Figma desktop app)
    │
    │  figma.createFrame()
    │  figma.createText()
    │  figma.createComponent()
    │  etc.
    ▼
Your Figma canvas ✅
```

---

## Setup Steps

### Step 1 — Install the MCP server globally

```bash
npm install -g figma-console-mcp
```

Verify:
```bash
figma-console-mcp --version
```

Expected output includes:
```
INFO: MCP server started successfully on stdio transport
INFO: WebSocket bridge server started on port 9223
```

### Step 2 — Get a Figma Personal Access Token

1. Figma desktop → avatar (top-left) → **Settings**
2. Scroll to **Security → Personal access tokens**
3. **Generate new token** → name it `concept-to-ui`
4. Set expiration: No expiration
5. Enable scopes: `File content: Read & Write`, `Variables: Read & Write`
6. Copy the token (shown only once)

Add to `server/.env`:
```
FIGMA_ACCESS_TOKEN=figd_your_token_here
```

### Step 3 — Load the Desktop Bridge plugin in Figma

The plugin files are auto-copied when the MCP server first runs:
```
/Users/choudhary.harsh/.figma-console-mcp/plugin/
```

In **Figma desktop app**:
1. **Main Menu (Figma logo) → Plugins → Development → Import plugin from manifest...**
2. Navigate to `/Users/choudhary.harsh/.figma-console-mcp/plugin/manifest.json`
3. Click **Open**

The plugin now appears under `Plugins → Development → Figma Desktop Bridge`.

### Step 4 — Activate the plugin on your target file

1. Open your Figma file: `https://www.figma.com/file/123456789/Concept-To-UI-Test`
2. **Plugins → Development → Figma Desktop Bridge** → click to run
3. A panel appears: bridge is active and waiting for WebSocket connection
4. In your other terminal running `figma-console-mcp`, the WARN about WebSocket should change to a connection INFO log

> ⚠️ The plugin must be running every time you want `render_node` to write to canvas. This is the one manual step.

### Step 5 — Test the connection end-to-end

With the MCP server running AND the plugin active in Figma, test with:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"figma_get_local_file_info","arguments":{}}}' | figma-console-mcp
```

Or via HTTP to the cloud relay:
```bash
curl -X POST https://figma-console-mcp.southleft.com/mcp \
  -H "Authorization: Bearer YOUR_FIGMA_PAT_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "figma_execute",
    "input": {
      "code": "return figma.currentPage.name"
    }
  }'
```

Expected: `{"result": "Page 1"}` (or your page name).

---

## How render_node Will Work (Post-Setup)

Once the bridge is confirmed working, `render_node` will:

1. Pull `ia_data` (screens), `copy_data` (UI text), `layout_data` (components) from pipeline state
2. Generate Plugin API JavaScript that creates one frame per screen with proper layout
3. POST to the `figma_execute` tool via the MCP cloud relay
4. Each screen gets: a named Frame, auto-layout, text layers from copy_data, component slots from layout_data

Example Plugin API JS the node will generate:

```javascript
const page = figma.currentPage;

// Create Dashboard screen frame
const frame = figma.createFrame();
frame.name = "01. Dashboard";
frame.resize(1440, 1024);
frame.x = 0;
frame.y = 0;

// Auto layout
frame.layoutMode = "VERTICAL";
frame.itemSpacing = 24;
frame.paddingTop = 48;
frame.paddingLeft = 48;
frame.paddingRight = 48;

// Load font and add hero header copy
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const heroText = figma.createText();
heroText.characters = "Good Boy deserves a Good Day!";
heroText.fontSize = 48;
frame.appendChild(heroText);

page.appendChild(frame);
```

---

## Key Constraints to Know

- **20 KB response limit** per `figma_execute` call — complex screens need to be split into multiple calls
- **Full Figma seat required** (Dev seat = read-only, cannot run plugins)
- Custom fonts not supported — use Inter (already available in Figma by default)
- No image/video import via MCP
- The Desktop Bridge plugin must be actively running in Figma desktop for writes to work
- The cloud relay at `figma-console-mcp.southleft.com` is run by southleft — for production, consider running the local MCP server instead

---

## Running Everything Together

```bash
# Terminal 1 — MCP bridge server (keep running)
figma-console-mcp

# Terminal 2 — FastAPI backend
cd server && python3 -m uvicorn server:server --reload --port 8000

# Terminal 3 — Next.js frontend
cd client && npm run dev

# In Figma desktop — keep the Desktop Bridge plugin running
```

---

## References

- [southleft/figma-console-mcp GitHub](https://github.com/southleft/figma-console-mcp)
- [figma-console-mcp Docs](https://docs.figma-console-mcp.southleft.com/)
- [Official Figma MCP Server](https://developers.figma.com/docs/figma-mcp-server/)
- [Figma MCP Write to Canvas](https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/)
- [Figma REST API — what's actually writable](https://developers.figma.com/docs/rest-api/)
- [Figma REST API Rate Limits](https://developers.figma.com/docs/rest-api/rate-limits/)
- [Figma Blog: Agents, Meet the Figma Canvas](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/)
- [mattdesl/figma-plugin-websockets](https://github.com/mattdesl/figma-plugin-websockets) — DIY WebSocket bridge pattern
- [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) — Read-only, useful for code gen context
