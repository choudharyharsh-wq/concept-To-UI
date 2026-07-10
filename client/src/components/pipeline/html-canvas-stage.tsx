"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  ShapeUtil,
  Rectangle2d,
  HTMLContainer,
  createShapeId,
  T,
  type Editor,
  type TLBaseShape,
  type RecordProps,
  type TLComponents,
} from "tldraw";
import "tldraw/tldraw.css";
import { Loader2, LayoutTemplate, Figma, Check, AlertCircle, Download } from "lucide-react";
import type { HtmlScreen } from "@/hooks/use-generation-stream";
import { prepareFigmaClipboard, writeToClipboard, fetchBalance, measureScreenHeight } from "@/lib/to-design";
import { cn } from "@/lib/utils";

// ─── Custom tldraw shape: one rendered HTML screen ────────────────────────────

interface ScreenProps {
  w: number;
  h: number;
  html: string;
  name: string;
  screenId: string;
}

type ScreenShape = TLBaseShape<"screen", ScreenProps>;

// Register the custom shape into tldraw's global shape union so ScreenShape
// satisfies the `extends TLShape` constraint on ShapeUtil / editor methods.
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    screen: ScreenProps;
  }
}

class ScreenShapeUtil extends ShapeUtil<ScreenShape> {
  static override type = "screen" as const;
  static override props: RecordProps<ScreenShape> = {
    w: T.number,
    h: T.number,
    html: T.string,
    name: T.string,
    screenId: T.string,
  };

  getDefaultProps(): ScreenShape["props"] {
    return { w: 390, h: 844, html: "", name: "Screen", screenId: "" };
  }

  getGeometry(shape: ScreenShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  // Screens are fixed-size previews — pan/zoom the canvas, don't resize frames.
  override canResize = () => false;

  override component(shape: ScreenShape) {
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: 20,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)",
          position: "relative",
        }}
      >
        {/* Floating name chip above the frame (non-interactive) */}
        <div
          style={{
            position: "absolute",
            top: -28,
            left: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "#a1a1aa",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {shape.props.name}
        </div>
        <iframe
          srcDoc={shape.props.html}
          title={shape.props.name}
          // pointer-events: none → the whole canvas pans/zooms smoothly and the
          // iframe is a pure visual preview. Use "Open in new tab" for full interaction.
          style={{ width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
          sandbox="allow-scripts"
        />
      </HTMLContainer>
    );
  }

  getIndicatorPath(shape: ScreenShape) {
    const { w, h } = shape.props;
    const path = new Path2D();
    // roundRect is widely supported; guard for older engines.
    if (typeof path.roundRect === "function") {
      path.roundRect(0, 0, w, h, 20);
    } else {
      path.rect(0, 0, w, h);
    }
    return path;
  }
}

const SHAPE_UTILS = [ScreenShapeUtil];

// Hide all of tldraw's editing chrome — this is a read-only preview canvas, not a
// drawing app. Leaves just the dotted canvas + screens (Stitch-style). Pan (drag)
// and zoom (wheel/pinch) still work since those are interactions, not UI.
const HIDDEN_UI: TLComponents = {
  Toolbar: null,
  StylePanel: null,
  PageMenu: null,
  MainMenu: null,
  ActionsMenu: null,
  QuickActions: null,
  HelpMenu: null,
  ZoomMenu: null,
  NavigationPanel: null,
  MenuPanel: null,
  DebugMenu: null,
  DebugPanel: null,
  SharePanel: null,
  KeyboardShortcutsDialog: null,
};

// Horizontal gap between screen frames on the canvas.
const GAP = 90;

function shapeIdFor(screenId: string) {
  return createShapeId(`screen-${screenId}`);
}

// ─── Standalone HTML download ─────────────────────────────────────────────────
// Bundles every canvas screen into one self-contained .html gallery. Each screen
// is embedded as an isolated <iframe srcdoc> so it renders exactly as on the
// canvas (its own Tailwind CDN + fonts run per frame — no merge artifacts).
function attrEscape(html: string): string {
  return html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildGalleryHtml(screens: HtmlScreen[]): string {
  const frames = screens
    .map((s) => {
      const w = s.viewport_width || 390;
      const h = s.viewport_height || 844;
      const name = (s.screen_name || s.screen_id).replace(/</g, "&lt;");
      return (
        `<figure class="frame">` +
        `<figcaption>${name}</figcaption>` +
        `<iframe width="${w}" height="${h}" loading="lazy" ` +
        `sandbox="allow-scripts" srcdoc="${attrEscape(s.html)}"></iframe>` +
        `</figure>`
      );
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Generated screens (${screens.length})</title>
<style>
  body { margin:0; padding:48px; background:#0d0d0d; font-family: ui-sans-serif, system-ui, sans-serif; }
  .row { display:flex; gap:56px; align-items:flex-start; flex-wrap:wrap; }
  .frame { margin:0; }
  figcaption { color:#a1a1aa; font-size:13px; font-weight:600; margin:0 0 10px 2px; }
  iframe { border:0; border-radius:24px; background:#fff; box-shadow:0 16px 48px -8px rgba(0,0,0,.55); }
</style>
</head><body>
<div class="row">
${frames}
</div>
</body></html>`;
}

function downloadScreensHtml(screens: HtmlScreen[]) {
  if (!screens.length) return;
  const blob = new Blob([buildGalleryHtml(screens)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `screens-${screens.length}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Arrow scaffolding (Phase 2 — user-flow connectors) ───────────────────────
// Intentionally defined but NOT called yet. When we wire flow arrows, pass
// `userFlowData` into this component and uncomment the drawFlowArrows() call in
// the sync effect. No structural change required.
//
// function drawFlowArrows(editor: Editor, userFlowData: any, screens: HtmlScreen[]) {
//   const exists = (id: string) => screens.some(s => s.screen_id === id);
//   for (const flow of userFlowData?.flows ?? []) {
//     for (const step of flow.steps ?? []) {
//       const from = step.source_page_id, to = step.destination_page_id;
//       if (!exists(from) || !exists(to) || from === to) continue;
//       // editor.createShape({ type: "arrow", ... binding from shapeIdFor(from) → shapeIdFor(to) })
//     }
//   }
// }

// ─── Component ────────────────────────────────────────────────────────────────

interface HtmlCanvasStageProps {
  screens: HtmlScreen[];
  isGenerating: boolean;
  // Reserved for Phase 2 flow arrows — read but not yet rendered.
  userFlowData?: any;
}

type FigmaExportState = "idle" | "preparing" | "ready" | "copied" | "error";

export function HtmlCanvasStage({ screens, isGenerating }: HtmlCanvasStageProps) {
  const editorRef = useRef<Editor | null>(null);
  const screensRef = useRef<HtmlScreen[]>(screens);
  screensRef.current = screens;
  // Measured natural height per screen_id → tall screens keep full length.
  const heightsRef = useRef<Record<string, number>>({});

  // ── Figma export (code.to.design clipboard mode) ──────────────────────────
  const [figmaState, setFigmaState] = useState<FigmaExportState>("idle");
  const [figmaErr, setFigmaErr]     = useState<string | null>(null);
  const [balance, setBalance]       = useState<number | null>(null);
  const clipboardRef    = useRef<string | null>(null);  // prepared text/html blob
  const preparedCountRef = useRef<number>(0);           // #screens the blob covers

  // Show remaining to.design credits (refreshed on mount + after each export).
  const refreshBalance = useCallback(() => { fetchBalance().then(setBalance); }, []);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // Build the clipboard blob for ALL current screens (the slow network step).
  const prepareExport = useCallback(async () => {
    const list = screensRef.current;
    if (!list.length) return;
    setFigmaState("preparing");
    setFigmaErr(null);
    try {
      const blob = await prepareFigmaClipboard(list);
      clipboardRef.current = blob;
      preparedCountRef.current = list.length;
      setFigmaState("ready");
    } catch (e: any) {
      setFigmaErr(e?.message || "Export failed");
      setFigmaState("error");
    } finally {
      refreshBalance();  // credits were just consumed (or attempted)
    }
  }, [refreshBalance]);

  // IMPORTANT: never call the (paid) to.design API automatically — it must only
  // ever run on an explicit user click. Auto-preparing here previously fired on
  // simply *viewing* a past generation and, on failure, retried in a loop,
  // burning API credits. So: reset to idle whenever the screen set changes
  // (new run or opening a different past generation) and wait for a click.
  const screenSig = screens.map((s) => s.screen_id).join("|");
  useEffect(() => {
    clipboardRef.current = null;
    preparedCountRef.current = 0;
    heightsRef.current = {};   // stale heights (screen ids repeat across runs)
    setFigmaState("idle");
    setFigmaErr(null);
  }, [screenSig]);

  // Single button, two clicks: 1st click prepares (one API call), 2nd copies.
  const onSendToFigma = useCallback(async () => {
    if (figmaState === "preparing") return;            // in flight — ignore
    if (figmaState === "ready" && clipboardRef.current) {
      try {
        await writeToClipboard(clipboardRef.current);  // 2nd click → copy
        setFigmaState("copied");
        setTimeout(() => setFigmaState("ready"), 3000);
      } catch (e: any) {
        setFigmaErr(e?.message || "Clipboard write blocked");
        setFigmaState("error");
      }
      return;
    }
    // idle or error → prepare exactly once (no auto-retry loop).
    await prepareExport();
  }, [figmaState, prepareExport]);

  // Create/update a tldraw shape for every screen we have. Idempotent — keyed by
  // a deterministic shape id, so re-runs only add missing frames.
  const syncShapes = useCallback((editor: Editor) => {
    const list = screensRef.current;
    if (!list.length) return;

    let added = false;
    let xCursor = 0;
    list.forEach((s) => {
      const id = shapeIdFor(s.screen_id);
      const w = s.viewport_width || 390;
      const h = heightsRef.current[s.screen_id] || s.viewport_height || 844;
      const existing = editor.getShape(id);
      if (existing) {
        editor.updateShape({ id, type: "screen", x: xCursor, props: { html: s.html, h } } as any);
      } else {
        editor.createShape({
          id,
          type: "screen",
          x: xCursor,
          y: 0,
          props: { w, h, html: s.html, name: s.screen_name, screenId: s.screen_id },
        } as any);
        added = true;
      }
      xCursor += w + GAP;
    });

    if (added) {
      editor.zoomToFit({ animation: { duration: 300 } });
    }
  }, []);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      // Dark gray theme + dotted grid (Stitch-style). NOTE: do NOT use
      // isReadonly — tldraw blocks programmatic createShape in readonly mode, so
      // the screens would never appear. The clean look comes from hiding all the
      // editing chrome (HIDDEN_UI) instead; that already removes drawing tools.
      editor.user.updateUserPreferences({ colorScheme: "dark" });
      editor.updateInstanceState({ isGridMode: true });
      syncShapes(editor);
    },
    [syncShapes]
  );

  // Re-sync whenever new screens stream in.
  useEffect(() => {
    if (editorRef.current) syncShapes(editorRef.current);
  }, [screens, syncShapes]);

  // Measure each screen's natural height, then re-sync so tall screens grow to
  // full length instead of being clamped to the base mobile viewport.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const s of screensRef.current) {
        if (heightsRef.current[s.screen_id]) continue;
        const hgt = await measureScreenHeight(s.html, s.viewport_width || 390, s.viewport_height || 844);
        if (cancelled) return;
        heightsRef.current[s.screen_id] = hgt;
        if (editorRef.current) syncShapes(editorRef.current);
      }
    })();
    return () => { cancelled = true; };
  }, [screenSig, syncShapes]);

  return (
    <div className="relative w-full h-full">
      {/* Empty / loading state before the first screen lands */}
      {screens.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-500">
          {isGenerating ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              <p className="font-mono text-xs uppercase tracking-widest">Compiling HTML screens…</p>
            </>
          ) : (
            <>
              <LayoutTemplate size={22} />
              <p className="font-mono text-xs uppercase tracking-widest">No screens yet</p>
            </>
          )}
        </div>
      )}

      {/* Count badge */}
      {screens.length > 0 && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 font-mono text-[11px] text-zinc-300 backdrop-blur">
          <LayoutTemplate size={12} className="text-violet-400" />
          {screens.length} screen{screens.length === 1 ? "" : "s"}
          {isGenerating && <Loader2 size={11} className="animate-spin text-zinc-500" />}
        </div>
      )}

      {/* Send all to Figma (code.to.design clipboard mode) */}
      {screens.length > 0 && (
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
          {/* Download all screens as a standalone .html (free, no API) */}
          <button
            onClick={() => downloadScreensHtml(screens)}
            title="Download all screens as one standalone HTML file"
            className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition-all active:scale-[0.98] backdrop-blur hover:bg-zinc-800"
          >
            <Download size={12} /> Download HTML
          </button>
          <button
            onClick={onSendToFigma}
            disabled={figmaState === "preparing"}
            title="Copy all screens, then paste (⌘V) into Figma"
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-all active:scale-[0.98] backdrop-blur",
              figmaState === "copied"
                ? "border-emerald-700 bg-emerald-950/70 text-emerald-300"
                : figmaState === "error"
                  ? "border-red-800 bg-red-950/60 text-red-300 hover:bg-red-950/80"
                  : figmaState === "preparing"
                    ? "border-zinc-700 bg-zinc-900/90 text-zinc-500 cursor-wait"
                    : "border-zinc-600 bg-zinc-900/90 text-zinc-200 hover:bg-zinc-800"
            )}
          >
            {figmaState === "preparing" ? (
              <><Loader2 size={12} className="animate-spin" /> Preparing…</>
            ) : figmaState === "copied" ? (
              <><Check size={12} /> Copied — ⌘V in Figma</>
            ) : figmaState === "error" ? (
              <><AlertCircle size={12} /> Retry export</>
            ) : figmaState === "ready" ? (
              <><Figma size={12} /> Copy to clipboard (⌘V)</>
            ) : (
              <><Figma size={12} /> Send all to Figma</>
            )}
          </button>
          {/* Credit balance + estimated cost (1 credit per 4 screens) */}
          <span className="rounded-md bg-zinc-900/90 px-2 py-0.5 font-mono text-[10px] text-zinc-500 backdrop-blur">
            {balance === null ? "credits: —" : `${balance} credits`}
            {screens.length > 0 && ` · ~${Math.ceil(screens.length / 4)} to export`}
          </span>
          {figmaState === "copied" && (
            <span className="rounded-md bg-zinc-900/90 px-2 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur">
              Switch to Figma and paste — no time limit
            </span>
          )}
          {figmaState === "error" && figmaErr && (
            <span className="max-w-[260px] rounded-md bg-red-950/70 px-2 py-1 text-right font-mono text-[10px] text-red-300 backdrop-blur">
              {figmaErr}
            </span>
          )}
        </div>
      )}

      <Tldraw shapeUtils={SHAPE_UTILS} components={HIDDEN_UI} onMount={handleMount} />
    </div>
  );
}
