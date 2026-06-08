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
    <div className="relative pl-16">
      <div className={cn(
        "absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 bg-slate-950 transition-all duration-500",
        isActive ? "border-blue-500 text-blue-500 animate-glow" : 
        isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-800 text-slate-700"
      )}>
        {isCompleted ? <CheckCircle2 size={24} /> : isActive ? <div className="w-6 h-6 rounded-full border-4 border-t-blue-500 border-r-pink-500 border-b-purple-500 border-l-orange-500 animate-spin" /> : <div className="w-6 h-6 bg-slate-800 rounded-sm" />}
      </div>

      <div className="space-y-4">
        <h3 className={cn(
          "text-xl font-semibold transition-colors duration-500",
          isActive ? "text-blue-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
        )}>
          {stage.name}
        </h3>

        {(isActive || (isCompleted && logs.length > 0)) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div 
              ref={terminalRef}
              className="bg-black border border-slate-800 rounded-lg p-4 font-mono text-xs h-40 overflow-y-auto shadow-2xl no-scrollbar"
            >
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "mb-1",
                  log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" :
                  log.includes("[SYS]") ? "text-slate-500" :
                  log.includes("[MCP]") ? "text-blue-400" : "text-slate-300"
                )}>
                  {log}
                </div>
              ))}
              {isActive && (
                <div className="flex items-center space-x-2 text-slate-500 italic">
                  <span>Rendering canvas...</span>
                  <span className="flex space-x-1">
                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></span>
                  </span>
                </div>
              )}
            </div>

            {isCompleted && (
              <a 
                href={stage.data?.figma_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all transform hover:scale-105 active:scale-95 animate-in zoom-in-90 duration-500"
              >
                <span>Open in Figma Canvas</span>
                <ExternalLink size={20} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
