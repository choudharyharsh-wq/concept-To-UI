"use client";

import React, { useMemo } from "react";
import { CheckCircle2, Network, Loader2, Lock, Globe, LayoutDashboard, FormInput, List, Maximize2, Layers, GitBranch } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface PageNode {
  id: string;
  name: string;
  parent_id: string | null;
  access_level: "public" | "private";
  layout_pattern:
    | "landing_page" | "dashboard_grid" | "split_form"
    | "list_feed" | "detail_view" | "modal_popup" | "wizard_step";
  component_inventory: string[];
}

// ── Layout pattern config ─────────────────────────────────────────────────

const LAYOUT_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  landing_page:   { icon: Globe,           label: "Landing Page"   },
  dashboard_grid: { icon: LayoutDashboard, label: "Dashboard Grid" },
  split_form:     { icon: FormInput,       label: "Split Form"     },
  list_feed:      { icon: List,            label: "List Feed"      },
  detail_view:    { icon: Maximize2,       label: "Detail View"    },
  modal_popup:    { icon: Layers,          label: "Modal Popup"    },
  wizard_step:    { icon: GitBranch,       label: "Wizard Step"    },
};

// access_level colours
const ACCESS_STYLES = {
  public:  "border-emerald-700/60 bg-emerald-950/30",
  private: "border-indigo-700/60  bg-indigo-950/30",
};
const ACCESS_BADGE = {
  public:  "bg-emerald-900/60 text-emerald-400 border-emerald-700/50",
  private: "bg-indigo-900/60  text-indigo-400  border-indigo-700/50",
};
const ACCESS_DOT = {
  public:  "bg-emerald-400",
  private: "bg-indigo-400",
};

// ── Single page card ──────────────────────────────────────────────────────

function PageCard({ page, depth }: { page: PageNode; depth: number }) {
  const layoutCfg = LAYOUT_CONFIG[page.layout_pattern] ?? { icon: Layers, label: page.layout_pattern };
  const LayoutIcon = layoutCfg.icon;
  const AccessIcon = page.access_level === "public" ? Globe : Lock;

  return (
    <div className={cn(
      "rounded-xl border p-4 w-64 shrink-0 space-y-3 transition-all duration-300",
      ACCESS_STYLES[page.access_level]
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-zinc-200 text-sm font-semibold leading-tight truncate">{page.name}</p>
          <p className="font-mono text-[9px] text-zinc-500 mt-0.5 truncate">{page.id}</p>
        </div>
        {/* Access badge */}
        <span className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full border font-mono text-[9px] uppercase tracking-wider shrink-0",
          ACCESS_BADGE[page.access_level]
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", ACCESS_DOT[page.access_level])} />
          {page.access_level}
        </span>
      </div>

      {/* Layout pattern */}
      <div className="flex items-center gap-1.5 text-zinc-500">
        <LayoutIcon size={11} />
        <span className="font-mono text-[10px] text-zinc-600">{layoutCfg.label}</span>
      </div>

      {/* Component inventory */}
      <div className="space-y-1">
        {page.component_inventory.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0 mt-1.5" />
            <span className="text-[10px] text-zinc-400 leading-tight">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Connector arrow SVG ──────────────────────────────────────────────────────

function Arrow({ type = "horizontal" }: { type?: "horizontal" | "vertical" }) {
  if (type === "vertical") {
    return (
      <div className="flex justify-center my-1">
        <svg width="16" height="28" viewBox="0 0 16 28">
          <line x1="8" y1="0" x2="8" y2="20" stroke="#3f3f46" strokeWidth="1.5" />
          <polygon points="8,28 4,18 12,18" fill="#3f3f46" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex items-center self-start mt-8 mx-1 shrink-0">
      <svg width="28" height="16" viewBox="0 0 28 16">
        <line x1="0" y1="8" x2="20" y2="8" stroke="#3f3f46" strokeWidth="1.5" />
        <polygon points="28,8 18,4 18,12" fill="#3f3f46" />
      </svg>
    </div>
  );
}

// ── Tree builder ─────────────────────────────────────────────────────────────

interface TreeNode {
  page: PageNode;
  children: TreeNode[];
  depth: number;
}

function buildTree(pages: PageNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  pages.forEach(p => map.set(p.id, { page: p, children: [], depth: 0 }));

  const roots: TreeNode[] = [];
  pages.forEach(p => {
    const node = map.get(p.id)!;
    if (!p.parent_id || !map.has(p.parent_id)) {
      roots.push(node);
    } else {
      const parent = map.get(p.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    }
  });
  return roots;
}

// ── Recursive tree renderer ───────────────────────────────────────────────────

function TreeLevel({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  if (!nodes.length) return null;

  return (
    <div className={cn(
      "flex gap-0",
      depth === 0 ? "flex-col gap-4" : "flex-col gap-0"
    )}>
      {nodes.map((node, i) => (
        <div key={node.page.id}>
          {/* The page card itself */}
          <div className="flex items-start gap-0">
            {/* Indent lines for depth > 0 */}
            {depth > 0 && (
              <div className="flex items-start shrink-0">
                {Array.from({ length: depth }).map((_, d) => (
                  <div key={d} className="w-6 border-l border-zinc-800 self-stretch" />
                ))}
                <div className="w-6 flex items-center">
                  <div className="w-full border-t border-zinc-800 mt-8" />
                </div>
              </div>
            )}
            <PageCard page={node.page} depth={depth} />
          </div>

          {/* Children */}
          {node.children.length > 0 && (
            <div className="ml-6 mt-2 pl-6 border-l border-zinc-800 space-y-3">
              {node.children.map(child => (
                <div key={child.page.id} className="relative">
                  {/* Horizontal connector to child */}
                  <div className="absolute -left-6 top-8 w-6 border-t border-zinc-800" />
                  <TreeLevel nodes={[child]} depth={depth + 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main stage component ──────────────────────────────────────────────────────

export function IAStage({ stage }: { stage: PipelineStage }) {
  const isActive    = stage.status === "active";
  const isCompleted = stage.status === "completed";

  const pages: PageNode[] = stage.data?.pages ?? [];
  const roots = useMemo(() => buildTree(pages), [pages]);

  const publicCount  = pages.filter(p => p.access_level === "public").length;
  const privateCount = pages.filter(p => p.access_level === "private").length;

  return (
    <div className="relative pl-14">
      {/* Stage icon */}
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive    ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="animate-spin" /> : <Network size={18} />}
      </div>

      <div className="space-y-5 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive    ? "text-zinc-200" :
          isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-zinc-600 text-xs font-mono animate-pulse">
            Building adjacency-list graph of all application screens...
          </p>
        )}

        {isCompleted && pages.length > 0 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Stats bar */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <Network size={12} className="text-zinc-500" />
                <span className="font-mono text-[10px] text-zinc-400">{pages.length} screens</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-mono text-[10px] text-emerald-400">{publicCount} public</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="font-mono text-[10px] text-indigo-400">{privateCount} private</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 flex-wrap">
              {Object.entries(LAYOUT_CONFIG).map(([key, { icon: Icon, label }]) => (
                <div key={key} className="flex items-center gap-1.5 text-zinc-600">
                  <Icon size={10} />
                  <span className="font-mono text-[9px]">{label}</span>
                </div>
              ))}
            </div>

            {/* Flowchart tree */}
            <div className="overflow-x-auto pb-4 no-scrollbar">
              <div className="inline-block min-w-full">
                {roots.map((root, i) => (
                  <div key={root.page.id} className={cn(i > 0 && "mt-8 pt-8 border-t border-zinc-800/50")}>
                    <TreeLevel nodes={[root]} depth={0} />
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
