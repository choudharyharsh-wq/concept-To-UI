"use client";

import React, { useState } from "react";
import {
  CheckCircle2, Loader2, Layout, ChevronDown, ChevronUp, Info,
  Columns, AlignLeft, SplitSquareHorizontal, Maximize2, Monitor
} from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface UXPrinciple  { principle_name: string; rationale: string; }
interface SpatialZone  {
  zone_id: string;
  visual_weight: "P1_Dominant" | "P2_Supporting" | "P3_Subdued";
  width_percentage: number;
  height_percentage: number;
  rendering_sequence: string[];
}
interface ScreenLayoutPlan {
  page_id: string;
  grid_system: string;
  scroll_behavior: string;
  spatial_zones: SpatialZone[];
  ux_principles: UXPrinciple[];
  empty_state_guidance: string;
}

// ── Config maps ───────────────────────────────────────────────────────────────

const WEIGHT_STYLE: Record<string, string> = {
  P1_Dominant:  "bg-zinc-200/10 border-zinc-400/40 text-zinc-200",
  P2_Supporting:"bg-zinc-600/10 border-zinc-600/40 text-zinc-400",
  P3_Subdued:   "bg-zinc-800/30 border-zinc-700/30 text-zinc-600",
};

const WEIGHT_DOT: Record<string, string> = {
  P1_Dominant:  "bg-zinc-200",
  P2_Supporting:"bg-zinc-500",
  P3_Subdued:   "bg-zinc-700",
};

const GRID_ICON: Record<string, React.ElementType> = {
  fixed_left_sidebar:      Columns,
  twelve_column_fluid:     Layout,
  split_screen_50_50:      SplitSquareHorizontal,
  single_column_centered:  AlignLeft,
  canvas_viewport_locked:  Maximize2,
};

// ── UX Principle tooltip ──────────────────────────────────────────────────────

function PrincipleChip({ principle }: { principle: UXPrinciple }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 hover:border-zinc-600 transition-colors"
      >
        <span className="font-mono text-[10px] text-zinc-300">{principle.principle_name}</span>
        <Info size={10} className="text-zinc-500 shrink-0" />
      </button>

      {show && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <p className="font-mono text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
            {principle.principle_name}
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">{principle.rationale}</p>
          {/* Arrow */}
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-zinc-900 border-r border-b border-zinc-700 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ── Spatial zone block ────────────────────────────────────────────────────────

function ZoneBlock({ zone }: { zone: SpatialZone }) {
  const [open, setOpen] = useState(false);

  // Clamp displayed width for visual balance (min 15%, max 85%)
  const displayW = Math.max(15, Math.min(85, zone.width_percentage));

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all duration-200",
        WEIGHT_STYLE[zone.visual_weight]
      )}
      style={{ width: `${displayW}%` }}
    >
      {/* Zone header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 gap-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", WEIGHT_DOT[zone.visual_weight])} />
          <span className="font-mono text-[10px] truncate">{zone.zone_id}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[9px] text-zinc-600">
            {zone.width_percentage}w × {zone.height_percentage}h
          </span>
          <span className={cn(
            "font-mono text-[8px] px-1.5 py-0.5 rounded border",
            zone.visual_weight === "P1_Dominant"   && "text-zinc-200 border-zinc-500 bg-zinc-700/50",
            zone.visual_weight === "P2_Supporting" && "text-zinc-500 border-zinc-700 bg-zinc-800/50",
            zone.visual_weight === "P3_Subdued"    && "text-zinc-700 border-zinc-800 bg-zinc-900/50",
          )}>
            {zone.visual_weight.replace("_", " ")}
          </span>
          {open ? <ChevronUp size={10} className="text-zinc-600" /> : <ChevronDown size={10} className="text-zinc-600" />}
        </div>
      </button>

      {/* Rendering sequence */}
      {open && (
        <div className="px-3 pb-2.5 space-y-1 border-t border-white/5 pt-2 animate-in fade-in duration-150">
          <p className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">Render Order</p>
          {zone.rendering_sequence.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono text-[9px] text-zinc-700 shrink-0 mt-0.5">{i + 1}.</span>
              <span className="text-[10px] text-zinc-400 leading-tight">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single screen layout card ─────────────────────────────────────────────────

function ScreenCard({ layout }: { layout: ScreenLayoutPlan }) {
  const [open, setOpen] = useState(false);
  const GridIcon = GRID_ICON[layout.grid_system] ?? Monitor;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-900/80 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <GridIcon size={14} className="text-zinc-500 shrink-0" />
          <span className="font-mono text-xs text-zinc-300 font-semibold truncate">{layout.page_id}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-[10px] text-zinc-600 hidden sm:block">
            {layout.grid_system.replace(/_/g, " ")}
          </span>
          <span className="font-mono text-[10px] text-zinc-700 hidden sm:block">
            {layout.scroll_behavior.replace(/_/g, " ")}
          </span>
          <span className="font-mono text-[10px] text-zinc-600">
            {layout.spatial_zones.length} zones
          </span>
          {open ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-5 py-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">

          {/* Grid metadata */}
          <div className="flex flex-wrap gap-2">
            <span className="font-mono text-[10px] px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300">
              {layout.grid_system.replace(/_/g, " ")}
            </span>
            <span className="font-mono text-[10px] px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400">
              scroll: {layout.scroll_behavior.replace(/_/g, " ")}
            </span>
          </div>

          {/* Spatial zone canvas */}
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-2">Spatial Zones</p>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2">
              {layout.spatial_zones.map((zone, i) => (
                <ZoneBlock key={i} zone={zone} />
              ))}
            </div>
          </div>

          {/* UX Principle chips */}
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-2">
              UX Principles <span className="text-zinc-700">(hover for rationale)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {layout.ux_principles.map((p, i) => (
                <PrincipleChip key={i} principle={p} />
              ))}
            </div>
          </div>

          {/* Empty state guidance */}
          <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Empty State Strategy</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{layout.empty_state_guidance}</p>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Main stage component ──────────────────────────────────────────────────────

export function UXLayoutStage({ stage }: { stage: PipelineStage }) {
  const isActive    = stage.status === "active";
  const isCompleted = stage.status === "completed";
  const layouts: ScreenLayoutPlan[] = stage.data?.screen_layouts ?? [];

  const dominant   = layouts.filter(l => l.spatial_zones.some(z => z.visual_weight === "P1_Dominant")).length;
  const totalZones = layouts.reduce((a, l) => a + l.spatial_zones.length, 0);

  return (
    <div className="relative pl-14">
      {/* Stage icon */}
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive    ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="animate-spin" /> : <Layout size={18} />}
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
            Computing spatial zoning blueprints and UX principle mappings...
          </p>
        )}

        {isCompleted && layouts.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Stats bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <Layout size={12} className="text-zinc-500" />
                <span className="font-mono text-[10px] text-zinc-400">
                  {layouts.length} screens · {totalZones} zones
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-200/5 border border-zinc-200/10">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                <span className="font-mono text-[10px] text-zinc-300">{dominant} flow-critical</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
                <Info size={10} className="text-zinc-500" />
                <span className="font-mono text-[10px] text-zinc-500">hover chips for UX rationale</span>
              </div>
            </div>

            {/* Screen cards */}
            <div className="space-y-2">
              {layouts.map((layout, i) => (
                <ScreenCard key={layout.page_id ?? i} layout={layout} />
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
