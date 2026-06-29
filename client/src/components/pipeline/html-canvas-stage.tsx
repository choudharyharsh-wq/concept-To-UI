"use client";

import React, { useCallback, useEffect, useRef } from "react";
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
} from "tldraw";
import "tldraw/tldraw.css";
import { Loader2, LayoutTemplate } from "lucide-react";
import type { HtmlScreen } from "@/hooks/use-generation-stream";

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

// Horizontal gap between screen frames on the canvas.
const GAP = 90;

function shapeIdFor(screenId: string) {
  return createShapeId(`screen-${screenId}`);
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

export function HtmlCanvasStage({ screens, isGenerating }: HtmlCanvasStageProps) {
  const editorRef = useRef<Editor | null>(null);
  const screensRef = useRef<HtmlScreen[]>(screens);
  screensRef.current = screens;

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
      const h = s.viewport_height || 844;
      const existing = editor.getShape(id);
      if (existing) {
        editor.updateShape({ id, type: "screen", x: xCursor, props: { html: s.html } } as any);
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
      editor.user.updateUserPreferences({ colorScheme: "dark" });
      syncShapes(editor);
    },
    [syncShapes]
  );

  // Re-sync whenever new screens stream in.
  useEffect(() => {
    if (editorRef.current) syncShapes(editorRef.current);
  }, [screens, syncShapes]);

  return (
    <div className="relative w-full h-full">
      {/* Empty / loading state before the first screen lands */}
      {screens.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-500">
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

      <Tldraw shapeUtils={SHAPE_UTILS} onMount={handleMount} />
    </div>
  );
}
