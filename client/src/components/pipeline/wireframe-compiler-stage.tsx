"use client";

import React from "react";
import { CheckCircle2, Loader2, Layers } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

interface ElementSpec {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill_color: string;
  children?: string[];
}

interface ScreenWireframe {
  screen_id: string;
  screen_name: string;
  width: number;
  height: number;
  background_color: string;
  elements: ElementSpec[];
}

const TYPE_COLOR: Record<string, string> = {
  NAV_BAR:        "bg-blue-500/20 text-blue-300 border-blue-700/40",
  BOTTOM_TAB_BAR: "bg-blue-500/20 text-blue-300 border-blue-700/40",
  BUTTON:         "bg-emerald-500/20 text-emerald-300 border-emerald-700/40",
  FAB:            "bg-emerald-500/20 text-emerald-300 border-emerald-700/40",
  ICON_BUTTON:    "bg-emerald-500/20 text-emerald-300 border-emerald-700/40",
  CARD:           "bg-violet-500/20 text-violet-300 border-violet-700/40",
  FRAME:          "bg-violet-500/20 text-violet-300 border-violet-700/40",
  MODAL_OVERLAY:  "bg-violet-500/20 text-violet-300 border-violet-700/40",
  TEXT_HEADING:   "bg-amber-500/20 text-amber-300 border-amber-700/40",
  TEXT_BODY:      "bg-amber-500/20 text-amber-300 border-amber-700/40",
  INPUT_FIELD:    "bg-amber-500/20 text-amber-300 border-amber-700/40",
  IMAGE_PLACEHOLDER: "bg-zinc-500/20 text-zinc-300 border-zinc-700/40",
  DIVIDER:        "bg-zinc-500/20 text-zinc-400 border-zinc-700/40",
  LIST_ITEM:      "bg-zinc-500/20 text-zinc-300 border-zinc-700/40",
  BADGE:          "bg-pink-500/20 text-pink-300 border-pink-700/40",
};

function ScreenSummaryCard({ screen }: { screen: ScreenWireframe }) {
  const typeCounts = screen.elements.reduce<Record<string, number>>((acc, el) => {
    acc[el.type] = (acc[el.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-zinc-200">{screen.screen_name}</p>
          <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{screen.screen_id}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-zinc-500">{screen.width}×{screen.height}</p>
          <p className="text-[10px] font-mono text-zinc-600">{screen.elements.length} elements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(typeCounts).map(([type, count]) => (
          <span
            key={type}
            className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border", TYPE_COLOR[type] ?? "bg-zinc-800 text-zinc-400 border-zinc-700")}
          >
            {type} ×{count}
          </span>
        ))}
      </div>
    </div>
  );
}

interface WireframeCompilerStageProps {
  stage: PipelineStage;
}

export function WireframeCompilerStage({ stage }: WireframeCompilerStageProps) {
  const isActive    = stage.status === "active";
  const isCompleted = stage.status === "completed";

  const screens: ScreenWireframe[] = stage.data?.screens ?? [];

  return (
    <div className="relative pl-14">
      {/* Stage icon */}
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive    ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted
          ? <CheckCircle2 size={18} />
          : isActive
            ? <Loader2 size={18} className="animate-spin" />
            : <Layers size={16} />}
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className={cn(
            "text-sm font-semibold tracking-tight transition-colors duration-500",
            isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
          )}>
            {stage.name}
          </h3>
          {isCompleted && screens.length > 0 && (
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 px-2 py-0.5 rounded-full">
              {screens.length} screens compiled
            </span>
          )}
        </div>

        {isActive && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-600 space-y-1">
              <p className="text-zinc-400">Translating spatial zones → pixel elements…</p>
              <p>Assigning coordinates, sizes, and fill colors…</p>
              <p>Building element tree per screen…</p>
              <div className="flex items-center gap-1.5 pt-1 text-zinc-700">
                <span>Compiling</span>
                {["-0.3s", "-0.15s", "0s"].map((d, i) => (
                  <span key={i} className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: d }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {isCompleted && screens.length > 0 && (
          <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-2 mb-1">
              <Layers size={12} className="text-zinc-500" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Render Payload — {screens.length} screens ready
              </p>
            </div>
            {screens.map(screen => (
              <ScreenSummaryCard key={screen.screen_id} screen={screen} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
