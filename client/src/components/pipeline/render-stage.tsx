import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function RenderStage({ stage }: { stage: PipelineStage }) {
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  useEffect(() => {
    if (isActive) {
      // Simulate streaming logs
      const fullLogs = [
        "[SYS] Connecting to Remote Figma MCP Server...",
        "[MCP] use_figma tool active: creating canvas viewport 'Draft-Run-01'",
        "[MCP] use_figma node created: Frame \"Dashboard\" [w:1440, h:1024]",
        "[MCP] Injecting layout token: var(--color-brand-primary)",
        "[MCP] Instantiating native component: Button/Primary",
        "[SUCCESS] Render Completed."
      ];
      
      let currentIdx = 0;
      const interval = setInterval(() => {
        if (currentIdx < fullLogs.length) {
          setLogs(prev => [...prev, fullLogs[currentIdx]]);
          currentIdx++;
        } else {
          clearInterval(interval);
        }
      }, 800);
      
      return () => clearInterval(interval);
    } else if (isCompleted && stage.data?.logs) {
      setLogs(stage.data.logs);
    } else {
      setLogs([]);
    }
  }, [isActive, isCompleted, stage.data]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="relative pl-14">
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted
          ? <CheckCircle2 size={18} />
          : isActive
            ? <Loader2 size={18} className="animate-spin" />
            : <div className="w-4 h-4 bg-zinc-800 rounded-sm" />
        }
      </div>

      <div className="space-y-4 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {(isActive || (isCompleted && logs.length > 0)) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
            {/* Terminal */}
            <div
              ref={terminalRef}
              className="bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs h-36 overflow-y-auto no-scrollbar"
            >
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "mb-1 leading-relaxed",
                  log.includes("[SUCCESS]") ? "text-zinc-300 font-semibold" :
                  log.includes("[SYS]") ? "text-zinc-700" :
                  log.includes("[MCP]") ? "text-zinc-400" : "text-zinc-500"
                )}>
                  {log}
                </div>
              ))}
              {isActive && (
                <div className="flex items-center gap-2 text-zinc-700">
                  <span>Rendering canvas</span>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce" />
                  </span>
                </div>
              )}
            </div>

            {isCompleted && (
              <a
                href={stage.data?.figma_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] animate-in fade-in duration-300"
              >
                <span>Open in Figma Canvas</span>
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
