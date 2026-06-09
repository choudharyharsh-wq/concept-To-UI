"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ExternalLink, Monitor, MousePointer, Type, Square } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

// ─── Types mirroring backend output shapes ───────────────────────────────────

interface Screen { name: string; description: string; }
interface CopyItem { key: string; value: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function screenLabel(name: string) {
  const parts = name.split(".");
  return { num: parts[0]?.trim(), title: parts.slice(1).join(".").trim() || name };
}

function copyForScreen(title: string, copyMap: CopyItem[]): CopyItem[] {
  const lower = title.toLowerCase();
  return copyMap.filter(c =>
    c.key.toLowerCase().includes(lower) ||
    lower.includes(c.key.toLowerCase().split(" ")[0])
  );
}

// Map a component description to a simple icon + colour tag
function componentChip(comp: string, i: number) {
  const lower = comp.toLowerCase();
  const variants = [
    { match: ["nav", "header", "menu"], icon: Monitor, color: "text-blue-400 border-blue-800 bg-blue-950/40" },
    { match: ["button", "cta", "action", "floating"], icon: MousePointer, color: "text-emerald-400 border-emerald-800 bg-emerald-950/40" },
    { match: ["card", "dashboard", "metric", "chart"], icon: Square, color: "text-violet-400 border-violet-800 bg-violet-950/40" },
    { match: ["text", "copy", "label", "input", "form"], icon: Type, color: "text-amber-400 border-amber-800 bg-amber-950/40" },
  ];
  const v = variants.find(v => v.match.some(m => lower.includes(m))) ?? variants[i % variants.length];
  return { icon: v.icon, color: v.color };
}

// ─── Single screen wireframe card ────────────────────────────────────────────

function ScreenWireframe({
  screen,
  index,
  copyMap,
  components,
}: {
  screen: Screen;
  index: number;
  copyMap: CopyItem[];
  components: string[];
}) {
  const { num, title } = screenLabel(screen.name);
  const relevantCopy = copyForScreen(title, copyMap);
  // Show at most 2 copy items inline, fall back to first 2 from the map
  const displayCopy = relevantCopy.length ? relevantCopy.slice(0, 2) : copyMap.slice(0, 2);

  return (
    <div className="shrink-0 w-64 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">

      {/* Screen chrome — browser-like top bar */}
      <div className="bg-zinc-800/80 px-3 py-2 flex items-center gap-2 border-b border-zinc-700/60">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-zinc-600" />
          <span className="w-2 h-2 rounded-full bg-zinc-600" />
          <span className="w-2 h-2 rounded-full bg-zinc-600" />
        </div>
        <div className="flex-1 bg-zinc-700/50 rounded text-[9px] font-mono text-zinc-500 px-2 py-0.5 truncate">
          /{title.toLowerCase().replace(/\s+/g, "-")}
        </div>
      </div>

      {/* Screen body */}
      <div className="flex-1 p-3 space-y-2">

        {/* Screen number + title */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-mono text-[10px] text-zinc-600">{num}</span>
          <span className="text-xs font-semibold text-zinc-200 truncate">{title}</span>
        </div>

        {/* Nav bar wireframe */}
        <div className="h-5 bg-zinc-800 rounded flex items-center px-2 gap-1.5">
          <div className="w-8 h-1.5 bg-zinc-600 rounded-full" />
          <div className="flex-1" />
          <div className="w-4 h-1.5 bg-zinc-700 rounded-full" />
          <div className="w-4 h-1.5 bg-zinc-700 rounded-full" />
        </div>

        {/* Hero / main content area */}
        <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-lg p-2.5 space-y-1.5">
          {/* Hero text from copy */}
          {displayCopy[0] && (
            <div className="space-y-0.5">
              <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">{displayCopy[0].key}</p>
              <p className="text-[10px] text-zinc-300 font-medium leading-tight line-clamp-2">{displayCopy[0].value}</p>
            </div>
          )}

          {/* Second copy item */}
          {displayCopy[1] && (
            <div className="space-y-0.5">
              <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">{displayCopy[1].key}</p>
              <p className="text-[10px] text-zinc-400 leading-tight line-clamp-1">{displayCopy[1].value}</p>
            </div>
          )}

          {/* Placeholder content blocks */}
          <div className="space-y-1 pt-1">
            <div className="h-1 bg-zinc-700 rounded-full w-full" />
            <div className="h-1 bg-zinc-700 rounded-full w-4/5" />
            <div className="h-1 bg-zinc-700 rounded-full w-3/5" />
          </div>
        </div>

        {/* Component chips */}
        <div className="space-y-1">
          {components.slice(0, 3).map((comp, i) => {
            const { icon: Icon, color } = componentChip(comp, i);
            const label = comp.split("(")[0].trim();
            return (
              <div
                key={i}
                className={cn("flex items-center gap-1.5 border rounded px-2 py-1 text-[9px] font-mono", color)}
              >
                <Icon size={9} />
                <span className="truncate">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Screen description */}
        <p className="text-[9px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-1.5 mt-1">
          {screen.description}
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
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  // Pull data from sibling stages
  const iaStage    = allStages.find(s => s.id === "ia_node");
  const copyStage  = allStages.find(s => s.id === "copy_node");
  const layoutStage = allStages.find(s => s.id === "layout_node");

  const screens: Screen[]      = iaStage?.data?.screens ?? [];
  const copyMap: CopyItem[]    = copyStage?.data?.copy_map ?? [];
  const components: string[]   = layoutStage?.data?.components ?? [];

  // Stream logs while active
  useEffect(() => {
    if (isActive) {
      const fullLogs = [
        "[SYS] Connecting to Remote Figma MCP Server...",
        "[MCP] use_figma tool active: creating canvas viewport 'Draft-Run-01'",
        `[MCP] use_figma node created: ${screens.length} screens queued [w:1440, h:1024]`,
        "[MCP] Injecting layout token: var(--color-brand-primary)",
        "[MCP] Instantiating native component: Button/Primary",
        "[SUCCESS] Render Completed.",
      ];
      let idx = 0;
      const interval = setInterval(() => {
        if (idx < fullLogs.length) { setLogs(prev => [...prev, fullLogs[idx++]]); }
        else { clearInterval(interval); }
      }, 700);
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
      {/* Stage node icon */}
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive    ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="animate-spin" /> : <div className="w-4 h-4 bg-zinc-800 rounded-sm" />}
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

            {/* Terminal log */}
            <div
              ref={terminalRef}
              className="bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs h-32 overflow-y-auto no-scrollbar"
            >
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "mb-1 leading-relaxed",
                  log.includes("[SUCCESS]") ? "text-zinc-200 font-semibold" :
                  log.includes("[SYS]")     ? "text-zinc-600" :
                  log.includes("[MCP]")     ? "text-zinc-400" : "text-zinc-500"
                )}>
                  {log}
                </div>
              ))}
              {isActive && (
                <div className="flex items-center gap-2 text-zinc-700 text-[10px]">
                  <span>Rendering canvas</span>
                  <span className="flex gap-0.5">
                    {["-0.3s", "-0.15s", "0s"].map((d, i) => (
                      <span key={i} className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: d }} />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Wireframe preview — only when completed and we have screen data */}
            {isCompleted && screens.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor size={12} className="text-zinc-500" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    User Journey Wireframe — {screens.length} screens
                  </p>
                </div>

                {/* Horizontal scroll of screen cards */}
                <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
                  {screens.map((screen, i) => (
                    <React.Fragment key={i}>
                      <ScreenWireframe
                        screen={screen}
                        index={i}
                        copyMap={copyMap}
                        components={components}
                      />
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

                {/* Legend */}
                <div className="flex flex-wrap gap-3 pt-1 border-t border-zinc-800/60">
                  {[
                    { color: "bg-blue-500/60", label: "Navigation" },
                    { color: "bg-violet-500/60", label: "Dashboard Cards" },
                    { color: "bg-emerald-500/60", label: "CTAs / Buttons" },
                    { color: "bg-amber-500/60", label: "Text / Forms" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                      <span className={cn("w-2 h-2 rounded-sm", color)} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open in Figma CTA */}
            {isCompleted && (
              <a
                href={stage.data?.figma_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98]"
              >
                <span>Open in Figma Canvas</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
