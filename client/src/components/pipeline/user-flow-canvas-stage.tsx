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
import { toRichText } from "@tldraw/tlschema";
import { GitBranch, Loader2 } from "lucide-react";
import type { PipelineStage } from "@/hooks/use-generation-stream";

// ─── Data (mirrors user-flow-stage.tsx) ───────────────────────────────────────

interface FlowStep {
  step_number: number;
  source_page_id: string;
  trigger_element: string;
  action_type: "click" | "submit_form" | "swipe" | "hover";
  destination_page_id: string;
}

interface UserFlow {
  flow_id: string;
  flow_name: string;
  description: string;
  ui_color_theme: string; // hex
  steps: FlowStep[];
}

// ─── Layout constants ─────────────────────────────────────────────────────────
// Generous spacing is deliberate: arrows carry text labels, and short arrows
// force tldraw to wrap the label into a cramped vertical column. Long arrows =
// roomy, single-line labels.

const NODE_MIN_W = 160;
const NODE_MAX_W = 250;
const NODE_MIN_H = 66;
const CHAR_W = 7;          // ~px per character at the node font size
const PAD_X = 28;          // horizontal padding inside a node
const H_GAP = 230;         // horizontal gap between nodes (room for arrow + label)
const HEADER_W = 250;
const HEADER_GAP = 70;     // gap between lane header and first node
const LANE_TOP = 60;       // top margin before the first lane
const LANE_GAP = 110;      // vertical gap between lanes
const ARC_SPACE = 120;     // vertical room reserved above each row for arcs/labels

// Native tldraw arrow palette — one distinct colour per flow (arrows can't take
// arbitrary hex, so we map each flow index to a palette colour; the node cards
// still use the flow's exact hex accent).
const ARROW_PALETTE = [
  "green", "blue", "violet", "orange",
  "light-blue", "red", "yellow", "light-green",
] as const;

// ─── Sizing helpers ───────────────────────────────────────────────────────────

function estimateLines(text: string, innerW: number): number {
  const perLine = Math.max(6, Math.floor(innerW / CHAR_W));
  return Math.max(1, Math.ceil((text?.length ?? 0) / perLine));
}

function measurePageNode(label: string, sub: string) {
  const raw = label.length * CHAR_W + PAD_X;
  const w = Math.max(NODE_MIN_W, Math.min(NODE_MAX_W, raw));
  const lines = Math.min(3, estimateLines(label, w - PAD_X));
  const h = 20 + lines * 18 + (sub ? 16 : 0);
  return { w, h: Math.max(NODE_MIN_H, h) };
}

function measureHeader(name: string, desc: string) {
  const innerW = HEADER_W - 30;
  const nameLines = Math.min(2, estimateLines(name, innerW - 18));
  const descLines = Math.min(4, estimateLines(desc, innerW));
  const h = 16 + nameLines * 19 + (desc ? 8 + descLines * 15 : 0) + 20;
  return { w: HEADER_W, h: Math.max(NODE_MIN_H, h) };
}

// ─── Custom shape: a flow node (page card) or a lane header chip ───────────────

interface FlowNodeProps {
  w: number;
  h: number;
  label: string;    // page name / id, or flow name for a header
  sublabel: string; // page id (nodes) or flow description (header)
  meta: string;     // step count (header only)
  color: string;    // flow hex accent
  kind: string;     // "page" | "header"
}

type FlowNodeShape = TLBaseShape<"flow-node", FlowNodeProps>;

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    "flow-node": FlowNodeProps;
  }
}

function hexRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(113,113,122,${a})`;
  return `rgba(${r},${g},${b},${a})`;
}

const clamp2Lines: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
const clamp3Lines: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
const clamp4Lines: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 4,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

class FlowNodeShapeUtil extends ShapeUtil<FlowNodeShape> {
  static override type = "flow-node" as const;
  static override props: RecordProps<FlowNodeShape> = {
    w: T.number,
    h: T.number,
    label: T.string,
    sublabel: T.string,
    meta: T.string,
    color: T.string,
    kind: T.string,
  };

  getDefaultProps(): FlowNodeShape["props"] {
    return { w: NODE_MIN_W, h: NODE_MIN_H, label: "", sublabel: "", meta: "", color: "#8b5cf6", kind: "page" };
  }

  getGeometry(shape: FlowNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override canResize = () => false;
  override canEdit = () => false;

  override component(shape: FlowNodeShape) {
    const p = shape.props;

    if (p.kind === "header") {
      return (
        <HTMLContainer style={{ width: p.w, height: p.h, pointerEvents: "none" }}>
          <div
            style={{
              width: "100%", height: "100%", boxSizing: "border-box",
              borderRadius: 12, border: `1px solid ${hexRgba(p.color, 0.55)}`,
              background: hexRgba(p.color, 0.15),
              padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
              overflow: "hidden", fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: p.color, flexShrink: 0 }} />
              <span style={{ ...clamp2Lines, color: "#f4f4f5", fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>
                {p.label}
              </span>
            </div>
            {p.sublabel && (
              <p style={{ ...clamp4Lines, margin: 0, color: "#d4d4d8", fontSize: 11, lineHeight: 1.35 }}>
                {p.sublabel}
              </p>
            )}
            {p.meta && (
              <span style={{
                color: hexRgba(p.color, 0.95), fontFamily: "ui-monospace, monospace",
                fontSize: 10, letterSpacing: 0.5, marginTop: "auto",
              }}>
                {p.meta}
              </span>
            )}
          </div>
        </HTMLContainer>
      );
    }

    // Page node card — centred, colour-accented, text wraps instead of truncating.
    return (
      <HTMLContainer style={{ width: p.w, height: p.h, pointerEvents: "none" }}>
        <div
          style={{
            width: "100%", height: "100%", boxSizing: "border-box",
            borderRadius: 10, border: `1.5px solid ${hexRgba(p.color, 0.65)}`,
            background: hexRgba(p.color, 0.1),
            boxShadow: "0 6px 18px -8px rgba(0,0,0,0.55)",
            padding: "10px 14px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center",
            overflow: "hidden", fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          <span style={{ ...clamp3Lines, color: "#f4f4f5", fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>
            {p.label}
          </span>
          {p.sublabel && (
            <span style={{
              color: "#a1a1aa", fontFamily: "ui-monospace, monospace", fontSize: 9,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
            }}>
              {p.sublabel}
            </span>
          )}
        </div>
      </HTMLContainer>
    );
  }

  getIndicatorPath(shape: FlowNodeShape) {
    const { w, h } = shape.props;
    const path = new Path2D();
    if (typeof path.roundRect === "function") path.roundRect(0, 0, w, h, 10);
    else path.rect(0, 0, w, h);
    return path;
  }
}

const SHAPE_UTILS = [FlowNodeShapeUtil];

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

function nodeIdFor(flowId: string, pageId: string) {
  return createShapeId(`flow-node-${flowId}-${pageId}`);
}
function headerIdFor(flowId: string) {
  return createShapeId(`flow-header-${flowId}`);
}

// Unique pages of a flow, in the order first encountered.
function orderedPages(flow: UserFlow): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const add = (id: string) => {
    if (id && !seen.has(id)) { seen.add(id); order.push(id); }
  };
  (flow.steps ?? []).forEach(s => { add(s.source_page_id); add(s.destination_page_id); });
  return order;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface UserFlowCanvasStageProps {
  stage: PipelineStage;
  allStages?: PipelineStage[];
}

export function UserFlowCanvasStage({ stage, allStages = [] }: UserFlowCanvasStageProps) {
  const editorRef = useRef<Editor | null>(null);
  const flows: UserFlow[] = stage.data?.flows ?? [];
  const flowsRef = useRef<UserFlow[]>(flows);
  flowsRef.current = flows;

  const isActive = stage.status === "active" && !stage.data?.awaiting_human;

  // Nice labels: map page_id → page name from the IA stage, if present.
  const nameMapRef = useRef<Record<string, string>>({});
  const iaPages = allStages.find(s => s.id === "ia_node")?.data?.pages as
    | Array<{ id: string; name: string }>
    | undefined;
  nameMapRef.current = {};
  (iaPages ?? []).forEach(p => { nameMapRef.current[p.id] = p.name; });

  const totalSteps = flows.reduce((acc, f) => acc + (f.steps?.length ?? 0), 0);

  const rebuild = useCallback((editor: Editor) => {
    const list = flowsRef.current;
    const nameMap = nameMapRef.current;

    editor.run(() => {
      const existing = editor.getCurrentPageShapeIds();
      if (existing.size) editor.deleteShapes(Array.from(existing));
      if (!list.length) return;

      const nodes: any[] = [];
      const arrows: any[] = [];
      const bindings: any[] = [];

      let cursorY = LANE_TOP;

      list.forEach((flow, fIdx) => {
        const order = orderedPages(flow);
        const arrowColor = ARROW_PALETTE[fIdx % ARROW_PALETTE.length];

        // Measure every node, then use a uniform row height for a clean lane.
        const measured = order.map(id => {
          const label = nameMap[id] ?? id;
          const sub = nameMap[id] ? id : "";
          return { id, label, sub, ...measurePageNode(label, sub) };
        });
        const rowH = measured.reduce((m, n) => Math.max(m, n.h), NODE_MIN_H);
        const laneTop = cursorY + ARC_SPACE;

        // Cumulative x positions (variable widths + fixed gap).
        const xs: number[] = [];
        let cx = 0;
        measured.forEach((n) => { xs.push(cx); cx += n.w + H_GAP; });

        // Lane header chip, left of the lane.
        const hdr = measureHeader(flow.flow_name, flow.description ?? "");
        nodes.push({
          id: headerIdFor(flow.flow_id),
          type: "flow-node",
          x: -(hdr.w + HEADER_GAP),
          y: laneTop + rowH / 2 - hdr.h / 2,
          props: {
            w: hdr.w, h: hdr.h,
            label: flow.flow_name,
            sublabel: flow.description ?? "",
            meta: `${flow.steps?.length ?? 0} steps`,
            color: flow.ui_color_theme,
            kind: "header",
          },
        });

        // Page nodes (uniform height).
        measured.forEach((n, i) => {
          nodes.push({
            id: nodeIdFor(flow.flow_id, n.id),
            type: "flow-node",
            x: xs[i],
            y: laneTop,
            props: {
              w: n.w, h: rowH,
              label: n.label,
              sublabel: n.sub,
              meta: "",
              color: flow.ui_color_theme,
              kind: "page",
            },
          });
        });

        // Step arrows, labelled with the trigger element. Straight for adjacent
        // forward steps; arced for skips / back-edges; parallel edges staggered.
        const pairSeen = new Map<string, number>();
        (flow.steps ?? []).forEach((step) => {
          const srcIdx = order.indexOf(step.source_page_id);
          const dstIdx = order.indexOf(step.destination_page_id);
          if (srcIdx === -1 || dstIdx === -1 || srcIdx === dstIdx) return;

          const gap = dstIdx - srcIdx;
          const key = `${srcIdx}_${dstIdx}`;
          const k = pairSeen.get(key) ?? 0;
          pairSeen.set(key, k + 1);
          const stagger = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 60;

          let bend = 0;
          let startA = { x: 1, y: 0.5 };
          let endA = { x: 0, y: 0.5 };
          if (gap === 1) {
            bend = stagger; // straight unless a parallel duplicate needs offset
          } else if (gap > 1) {
            bend = -(70 + (gap - 1) * 24) + stagger; // arc above intermediate nodes
            startA = { x: 0.5, y: 0 };
            endA = { x: 0.5, y: 0 };
          } else {
            bend = 90 + (Math.abs(gap) - 1) * 24 + stagger; // loop back, arc under
            startA = { x: 0.5, y: 1 };
            endA = { x: 0.5, y: 1 };
          }

          const aid = createShapeId(`flow-edge-${flow.flow_id}-${step.step_number}`);
          const label = step.trigger_element || step.action_type || "";

          arrows.push({
            id: aid,
            type: "arrow",
            props: {
              kind: "arc",
              bend,
              color: arrowColor,
              labelColor: arrowColor,
              size: "s",
              font: "sans",
              arrowheadStart: "none",
              arrowheadEnd: "arrow",
              richText: toRichText(label),
            },
          });
          bindings.push(
            {
              fromId: aid, toId: nodeIdFor(flow.flow_id, step.source_page_id), type: "arrow",
              props: { terminal: "start", normalizedAnchor: startA, isExact: false, isPrecise: true, snap: "none" },
            },
            {
              fromId: aid, toId: nodeIdFor(flow.flow_id, step.destination_page_id), type: "arrow",
              props: { terminal: "end", normalizedAnchor: endA, isExact: false, isPrecise: true, snap: "none" },
            }
          );
        });

        cursorY = laneTop + rowH + LANE_GAP;
      });

      editor.createShapes(nodes);
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

  // Redraw whenever the flow set changes.
  const sig = flows.map(f => `${f.flow_id}:${f.steps?.length ?? 0}`).join("|");
  useEffect(() => {
    if (editorRef.current) rebuild(editorRef.current);
  }, [sig, rebuild]);

  return (
    <div className="relative w-full h-full">
      {/* Empty / loading state */}
      {flows.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-500">
          {isActive ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              <p className="font-mono text-xs uppercase tracking-widest">Mapping user journeys…</p>
            </>
          ) : (
            <>
              <GitBranch size={22} />
              <p className="font-mono text-xs uppercase tracking-widest">No flows yet</p>
            </>
          )}
        </div>
      )}

      {/* Stats + legend overlay */}
      {flows.length > 0 && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 font-mono text-[11px] text-zinc-300 backdrop-blur">
            <GitBranch size={12} className="text-violet-400" />
            {flows.length} flow{flows.length === 1 ? "" : "s"} · {totalSteps} steps
          </div>
          {flows.map(f => (
            <div
              key={f.flow_id}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] backdrop-blur"
              style={{ backgroundColor: `${f.ui_color_theme}18`, borderColor: `${f.ui_color_theme}40`, color: f.ui_color_theme }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: f.ui_color_theme }} />
              {f.flow_name}
            </div>
          ))}
        </div>
      )}

      <Tldraw shapeUtils={SHAPE_UTILS} components={HIDDEN_UI} onMount={handleMount} />
    </div>
  );
}
