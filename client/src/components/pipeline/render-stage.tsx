"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ExternalLink, Monitor, MousePointer, Type, Square } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

// ─── Types mirroring wireframe_payload schema ─────────────────────────────────

interface ElementSpec {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill_color: string;
  text_color: string;
  corner_radius?: number;
  font_size?: number;
  children?: string[];
  zone_id?: string;
}

interface ScreenWireframe {
  screen_id: string;
  screen_name: string;
  width: number;
  height: number;
  background_color: string;
  elements: ElementSpec[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elementChip(type: string, i: number) {
  const variants = [
    { match: ["NAV_BAR", "BOTTOM_TAB_BAR"], icon: Monitor,      color: "text-blue-400 border-blue-800 bg-blue-950/40" },
    { match: ["BUTTON", "FAB", "ICON_BUTTON"], icon: MousePointer, color: "text-emerald-400 border-emerald-800 bg-emerald-950/40" },
    { match: ["CARD", "FRAME", "MODAL_OVERLAY"], icon: Square,   color: "text-violet-400 border-violet-800 bg-violet-950/40" },
    { match: ["TEXT_HEADING", "TEXT_BODY", "INPUT_FIELD", "BADGE", "DIVIDER", "LIST_ITEM", "IMAGE_PLACEHOLDER"], icon: Type, color: "text-amber-400 border-amber-800 bg-amber-950/40" },
  ];
  const v = variants.find(v => v.match.includes(type)) ?? variants[i % variants.length];
  return { icon: v.icon, color: v.color };
}

// ─── Mini pixel-preview of a screen ──────────────────────────────────────────

function ScreenPreview({ screen }: { screen: ScreenWireframe }) {
  const PREVIEW_W = 120;
  const PREVIEW_H = 220;
  const scaleX = PREVIEW_W / (screen.width || 390);
  const scaleY = PREVIEW_H / (screen.height || 844);

  // Only render top-level elements (not children of other elements)
  const childIds = new Set(screen.elements.flatMap(e => e.children ?? []));
  const topLevel = screen.elements.filter(e => !childIds.has(e.id));

  return (
    <div
      className="shrink-0 rounded-lg overflow-hidden border border-zinc-700/50"
      style={{ width: PREVIEW_W, height: PREVIEW_H, background: screen.background_color || "#fff", position: "relative" }}
    >
      {topLevel.map((el) => {
        const { color } = elementChip(el.type, 0);
        const bgClass =
          el.type.includes("NAV") || el.type.includes("TAB") ? "bg-blue-900/60" :
          el.type.includes("BUTTON") || el.type.includes("FAB") ? "bg-emerald-900/60" :
          el.type.includes("CARD") || el.type.includes("FRAME") ? "bg-violet-900/40" :
          "bg-zinc-700/40";
        return (
          <div
            key={el.id}
            title={`${el.type}: ${el.label}`}
            className={cn("absolute border border-white/10 overflow-hidden", bgClass)}
            style={{
              left:   el.x * scaleX,
              top:    el.y * scaleY,
              width:  Math.max(4, el.width * scaleX),
              height: Math.max(3, el.height * scaleY),
              borderRadius: (el.corner_radius ?? 0) * Math.min(scaleX, scaleY),
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Single screen card ───────────────────────────────────────────────────────

function ScreenCard({ screen, index }: { screen: ScreenWireframe; index: number }) {
  // Group elements by type for the chip list
  const typeGroups = Array.from(new Set(screen.elements.map(e => e.type))).slice(0, 4);

  return (
    <div className="shrink-0 w-52 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">

      {/* Screen chrome */}
      <div className="bg-zinc-800/80 px-3 py-2 flex items-center gap-2 border-b border-zinc-700/60">
        <div className="flex gap-1">
          {[0,1,2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-zinc-600" />)}
        </div>
        <div className="flex-1 bg-zinc-700/50 rounded text-[9px] font-mono text-zinc-500 px-2 py-0.5 truncate">
          /{screen.screen_id}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-3 space-y-2.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[9px] text-zinc-600">{index + 1}</span>
          <span className="text-xs font-semibold text-zinc-200 truncate">{screen.screen_name}</span>
        </div>

        {/* Pixel preview */}
        <ScreenPreview screen={screen} />

        {/* Element type chips */}
        <div className="space-y-1 pt-0.5">
          {typeGroups.map((type, i) => {
            const { icon: Icon, color } = elementChip(type, i);
            const count = screen.elements.filter(e => e.type === type).length;
            return (
              <div key={type} className={cn("flex items-center gap-1.5 border rounded px-2 py-0.5 text-[9px] font-mono", color)}>
                <Icon size={9} />
                <span className="truncate">{type}</span>
                <span className="ml-auto opacity-60">×{count}</span>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-zinc-600 font-mono">
          {screen.elements.length} elements · {screen.width}×{screen.height}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RenderStageProps {
  stage: PipelineStage;
  allStages: PipelineStage[];
}

export function RenderStage({ stage, allStages }: RenderStageProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const isActive    = stage.status === "active";
  const isCompleted = stage.status === "completed";

  // Pull compiled wireframe screens from the compiler stage
  const compilerStage = allStages.find(s => s.id === "wireframe_compiler_node");
  const screens: ScreenWireframe[] = compilerStage?.data?.screens ?? [];

  const renderStatus: string  = stage.data?.status ?? "";
  const figmaUrl:     string  = stage.data?.figma_url ?? "";
  const bridgeOffline: boolean = renderStatus === "bridge_offline";

  // Stream logs while active, show real logs when completed
  useEffect(() => {
    if (isActive) {
      const fullLogs = [
        "[SYS] Render node starting…",
        `[SYS] ${screens.length} compiled screen(s) queued.`,
        "[BRIDGE] Connecting to bridge server on port 5001…",
        "[BRIDGE] Delivering wireframe payload…",
        "[SYS] Open the Figma plugin and click 'Fetch & Render'.",
      ];
      let idx = 0;
      const interval = setInterval(() => {
        if (idx < fullLogs.length) setLogs(prev => [...prev, fullLogs[idx++]]);
        else clearInterval(interval);
      }, 600);
      return () => clearInterval(interval);
    } else if (isCompleted && stage.data?.logs) {
      setLogs(stage.data.logs);
    } else {
      setLogs([]);
    }
  }, [isActive, isCompleted, stage.data, screens.length]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

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
            : <div className="w-4 h-4 bg-zinc-800 rounded-sm" />}
      </div>

      <div className="space-y-4 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {(isActive || isCompleted) && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Terminal */}
            <div
              ref={terminalRef}
              className="bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs h-32 overflow-y-auto no-scrollbar"
            >
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "mb-1 leading-relaxed",
                  log.includes("[SUCCESS]") ? "text-zinc-200 font-semibold" :
                  log.includes("[WARN]")    ? "text-amber-400" :
                  log.includes("[SYS]")     ? "text-zinc-600" :
                  log.includes("[BRIDGE]")  ? "text-blue-400" :
                  log.includes("[ERR]")     ? "text-red-400" : "text-zinc-500"
                )}>
                  {log}
                </div>
              ))}
              {isActive && (
                <div className="flex items-center gap-2 text-zinc-700 text-[10px]">
                  <span>Pushing to bridge</span>
                  <span className="flex gap-0.5">
                    {["-0.3s", "-0.15s", "0s"].map((d, i) => (
                      <span key={i} className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: d }} />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Bridge offline warning */}
            {isCompleted && bridgeOffline && (
              <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-[11px] text-amber-300 font-mono space-y-1">
                <p className="font-semibold">Bridge server offline</p>
                <p className="text-amber-400/70">Start it with: <code className="bg-amber-950/60 px-1 rounded">python server/bridge.py</code></p>
                <p className="text-amber-400/70">Then re-run the pipeline or POST the payload manually.</p>
              </div>
            )}

            {/* Compiled screen previews */}
            {isCompleted && screens.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor size={12} className="text-zinc-500" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    Compiled Wireframes — {screens.length} screens
                  </p>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
                  {screens.map((screen, i) => (
                    <React.Fragment key={screen.screen_id}>
                      <ScreenCard screen={screen} index={i} />
                      {i < screens.length - 1 && (
                        <div className="flex items-center text-zinc-700 shrink-0 self-center">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-1 border-t border-zinc-800/60">
                  {[
                    { color: "bg-blue-500/60",    label: "Nav / Tab Bars" },
                    { color: "bg-violet-500/60",  label: "Cards / Frames" },
                    { color: "bg-emerald-500/60", label: "Buttons / FABs" },
                    { color: "bg-amber-500/60",   label: "Text / Inputs" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                      <span className={cn("w-2 h-2 rounded-sm", color)} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open in Figma CTA — only shown when bridge delivered successfully */}
            {isCompleted && !bridgeOffline && figmaUrl && (
              <a
                href={figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98]"
              >
                <span>Open in Figma Canvas</span>
                <ExternalLink size={13} />
              </a>
            )}

            {/* Plugin instructions when bridge delivered */}
            {isCompleted && !bridgeOffline && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-400 space-y-1.5 font-mono">
                <p className="text-zinc-300 font-semibold">Next: render in Figma</p>
                <p>1. Open Figma → Plugins → <span className="text-zinc-200">Concept-to-UI Renderer</span></p>
                <p>2. Click <span className="text-zinc-200">Fetch &amp; Render Wireframes</span></p>
                <p>3. Frames will appear on your canvas automatically.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
