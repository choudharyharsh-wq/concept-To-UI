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
  type TLComponents,
} from "tldraw";
import "tldraw/tldraw.css";
import {
  Network, Loader2, Globe, Lock, LayoutDashboard, FormInput,
  List, Maximize2, Layers, GitBranch,
} from "lucide-react";
import type { PipelineStage } from "@/hooks/use-generation-stream";

// ─── Page data (mirrors ia-stage.tsx) ─────────────────────────────────────────

interface PageNode {
  id: string;
  name: string;
  parent_id: string | null;
  access_level: "public" | "private";
  layout_pattern: string;
  component_inventory: string[];
}

const LAYOUT_ICON: Record<string, React.ElementType> = {
  landing_page:   Globe,
  dashboard_grid: LayoutDashboard,
  split_form:     FormInput,
  list_feed:      List,
  detail_view:    Maximize2,
  modal_popup:    Layers,
  wizard_step:    GitBranch,
};
const LAYOUT_LABEL: Record<string, string> = {
  landing_page:   "Landing Page",
  dashboard_grid: "Dashboard Grid",
  split_form:     "Split Form",
  list_feed:      "List Feed",
  detail_view:    "Detail View",
  modal_popup:    "Modal Popup",
  wizard_step:    "Wizard Step",
};

const ACCESS = {
  public:  { border: "#047857", text: "#34d399", dot: "#34d399", badgeBg: "rgba(6,78,59,0.55)"  },
  private: { border: "#4338ca", text: "#818cf8", dot: "#818cf8", badgeBg: "rgba(30,27,75,0.55)" },
} as const;

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 240;
const H_GAP  = 48;   // horizontal gap between sibling subtrees
const V_GAP  = 80;   // vertical gap between depth levels

// Height derived from content so cards never clip their inventory list.
function nodeHeight(itemCount: number): number {
  return 100 + Math.max(itemCount, 0) * 18;
}

function safeParse(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ─── Custom tldraw shape: one IA page node ────────────────────────────────────

interface IANodeProps {
  w: number;
  h: number;
  name: string;
  pageId: string;
  accessLevel: string;
  layoutPattern: string;
  componentsJson: string;
}

type IANodeShape = TLBaseShape<"ia-node", IANodeProps>;

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    "ia-node": IANodeProps;
  }
}

class IANodeShapeUtil extends ShapeUtil<IANodeShape> {
  static override type = "ia-node" as const;
  static override props: RecordProps<IANodeShape> = {
    w: T.number,
    h: T.number,
    name: T.string,
    pageId: T.string,
    accessLevel: T.string,
    layoutPattern: T.string,
    componentsJson: T.string,
  };

  getDefaultProps(): IANodeShape["props"] {
    return {
      w: NODE_W, h: nodeHeight(0),
      name: "Page", pageId: "",
      accessLevel: "public", layoutPattern: "landing_page",
      componentsJson: "[]",
    };
  }

  getGeometry(shape: IANodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  // Read-only flowchart — pan/zoom the canvas, don't drag/resize nodes.
  override canResize = () => false;
  override canEdit = () => false;

  override component(shape: IANodeShape) {
    const p = shape.props;
    const access = ACCESS[p.accessLevel as keyof typeof ACCESS] ?? ACCESS.public;
    const items = safeParse(p.componentsJson);
    const LayoutIcon = LAYOUT_ICON[p.layoutPattern] ?? Layers;
    const layoutLabel = LAYOUT_LABEL[p.layoutPattern] ?? p.layoutPattern;

    return (
      <HTMLContainer style={{ width: p.w, height: p.h, pointerEvents: "none" }}>
        <div
          style={{
            width: "100%", height: "100%", boxSizing: "border-box",
            borderRadius: 12, border: `1px solid ${access.border}99`,
            background: "#18181b",
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.55)",
            padding: 14, display: "flex", flexDirection: "column", gap: 10,
            overflow: "hidden",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                color: "#e4e4e7", fontSize: 14, fontWeight: 600, lineHeight: 1.2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {p.name}
              </div>
              <div style={{
                color: "#71717a", fontFamily: "ui-monospace, monospace", fontSize: 9,
                marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {p.pageId}
              </div>
            </div>
            {/* Access badge */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, height: "fit-content",
              padding: "2px 8px", borderRadius: 999, border: `1px solid ${access.border}80`,
              background: access.badgeBg, color: access.text,
              fontFamily: "ui-monospace, monospace", fontSize: 9,
              textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: access.dot }} />
              {p.accessLevel}
            </span>
          </div>

          {/* Layout pattern */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#71717a" }}>
            <LayoutIcon size={12} />
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#52525b" }}>
              {layoutLabel}
            </span>
          </div>

          {/* Component inventory */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <span style={{
                  width: 4, height: 4, borderRadius: 999, background: "#52525b",
                  marginTop: 6, flexShrink: 0,
                }} />
                <span style={{ color: "#a1a1aa", fontSize: 10, lineHeight: 1.3 }}>{it}</span>
              </div>
            ))}
          </div>
        </div>
      </HTMLContainer>
    );
  }

  getIndicatorPath(shape: IANodeShape) {
    const { w, h } = shape.props;
    const path = new Path2D();
    if (typeof path.roundRect === "function") path.roundRect(0, 0, w, h, 12);
    else path.rect(0, 0, w, h);
    return path;
  }
}

const SHAPE_UTILS = [IANodeShapeUtil];

// Read-only preview canvas — hide all editing chrome (same as html-canvas-stage).
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

function nodeIdFor(pageId: string) {
  return createShapeId(`ia-node-${pageId}`);
}

// ─── Tidy top-down tree layout ────────────────────────────────────────────────

interface TNode {
  page: PageNode;
  children: TNode[];
  depth: number;
  x: number;
  y: number;
  h: number;
}

function buildLayout(pages: PageNode[]): TNode[] {
  const map = new Map<string, TNode>();
  pages.forEach(p =>
    map.set(p.id, {
      page: p, children: [], depth: 0, x: 0, y: 0,
      h: nodeHeight(p.component_inventory?.length ?? 0),
    })
  );

  const roots: TNode[] = [];
  pages.forEach(p => {
    const n = map.get(p.id)!;
    if (!p.parent_id || !map.has(p.parent_id)) roots.push(n);
    else map.get(p.parent_id)!.children.push(n);
  });

  // Assign depth from each root.
  const setDepth = (n: TNode, d: number) => {
    n.depth = d;
    n.children.forEach(c => setDepth(c, d + 1));
  };
  roots.forEach(r => setDepth(r, 0));

  // Uniform row per depth: y = cumulative max height of shallower rows.
  const rowMaxH: number[] = [];
  map.forEach(n => { rowMaxH[n.depth] = Math.max(rowMaxH[n.depth] ?? 0, n.h); });
  const rowTop: number[] = [0];
  for (let d = 1; d < rowMaxH.length; d++) {
    rowTop[d] = rowTop[d - 1] + (rowMaxH[d - 1] ?? 0) + V_GAP;
  }

  // Tidy x: leaves get sequential slots, parents center over their children.
  let cursor = 0;
  const assignX = (n: TNode) => {
    if (!n.children.length) {
      n.x = cursor;
      cursor += NODE_W + H_GAP;
    } else {
      n.children.forEach(assignX);
      n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
    }
    n.y = rowTop[n.depth] ?? 0;
  };
  roots.forEach(assignX);

  return Array.from(map.values());
}

// ─── Component ────────────────────────────────────────────────────────────────

interface IACanvasStageProps {
  stage: PipelineStage;
}

export function IACanvasStage({ stage }: IACanvasStageProps) {
  const editorRef = useRef<Editor | null>(null);
  const pages: PageNode[] = stage.data?.pages ?? [];
  const pagesRef = useRef<PageNode[]>(pages);
  pagesRef.current = pages;

  const isActive = stage.status === "active" && !stage.data?.awaiting_human;

  const publicCount  = pages.filter(p => p.access_level === "public").length;
  const privateCount = pages.filter(p => p.access_level === "private").length;

  // Full rebuild — IA data arrives whole (not streamed), so wipe + redraw.
  const rebuild = useCallback((editor: Editor) => {
    const list = pagesRef.current;

    editor.run(() => {
      const existing = editor.getCurrentPageShapeIds();
      if (existing.size) editor.deleteShapes(Array.from(existing));
      if (!list.length) return;

      const nodes = buildLayout(list);

      // 1) Nodes
      editor.createShapes(
        nodes.map(n => ({
          id: nodeIdFor(n.page.id),
          type: "ia-node",
          x: n.x,
          y: n.y,
          props: {
            w: NODE_W,
            h: n.h,
            name: n.page.name,
            pageId: n.page.id,
            accessLevel: n.page.access_level,
            layoutPattern: n.page.layout_pattern,
            componentsJson: JSON.stringify(n.page.component_inventory ?? []),
          },
        })) as any
      );

      // 2) Elbow arrows parent → child, bound to both nodes so they stay attached.
      const arrows: any[] = [];
      const bindings: any[] = [];
      const has = (id: string) => list.some(p => p.id === id);
      nodes.forEach(n => {
        const parentId = n.page.parent_id;
        if (!parentId || !has(parentId)) return;
        const aid = createShapeId(`ia-edge-${n.page.id}`);
        arrows.push({
          id: aid,
          type: "arrow",
          props: {
            kind: "elbow",
            color: "grey",
            size: "s",
            arrowheadStart: "none",
            arrowheadEnd: "arrow",
          },
        });
        bindings.push(
          {
            fromId: aid, toId: nodeIdFor(parentId), type: "arrow",
            props: { terminal: "start", normalizedAnchor: { x: 0.5, y: 1 }, isExact: false, isPrecise: true, snap: "none" },
          },
          {
            fromId: aid, toId: nodeIdFor(n.page.id), type: "arrow",
            props: { terminal: "end", normalizedAnchor: { x: 0.5, y: 0 }, isExact: false, isPrecise: true, snap: "none" },
          }
        );
      });
      if (arrows.length) {
        editor.createShapes(arrows);
        editor.createBindings(bindings);
      }
    });

    editor.zoomToFit({ animation: { duration: 300 } });
  }, []);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      editor.user.updateUserPreferences({ colorScheme: "dark" });
      editor.updateInstanceState({ isGridMode: true });
      rebuild(editor);
    },
    [rebuild]
  );

  // Redraw whenever the page set changes.
  const sig = pages.map(p => p.id).join("|");
  useEffect(() => {
    if (editorRef.current) rebuild(editorRef.current);
  }, [sig, rebuild]);

  return (
    <div className="relative w-full h-full">
      {/* Empty / loading state before pages land */}
      {pages.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-500">
          {isActive ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              <p className="font-mono text-xs uppercase tracking-widest">Building screen graph…</p>
            </>
          ) : (
            <>
              <Network size={22} />
              <p className="font-mono text-xs uppercase tracking-widest">No screens yet</p>
            </>
          )}
        </div>
      )}

      {/* Stats overlay */}
      {pages.length > 0 && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 font-mono text-[11px] text-zinc-300 backdrop-blur">
            <Network size={12} className="text-violet-400" />
            {pages.length} screen{pages.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-800/40 bg-emerald-950/40 px-3 py-1.5 font-mono text-[10px] text-emerald-400 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {publicCount} public
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-indigo-800/40 bg-indigo-950/40 px-3 py-1.5 font-mono text-[10px] text-indigo-400 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            {privateCount} private
          </div>
        </div>
      )}

      <Tldraw shapeUtils={SHAPE_UTILS} components={HIDDEN_UI} onMount={handleMount} />
    </div>
  );
}
