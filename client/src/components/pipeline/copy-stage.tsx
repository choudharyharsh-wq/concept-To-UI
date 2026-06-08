import React, { useState } from "react";
import { CheckCircle2, PenTool, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function CopyStage({ stage }: { stage: PipelineStage }) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  return (
    <div className="relative pl-14">
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="animate-spin" /> : <PenTool size={18} />}
      </div>

      <div className="space-y-4 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-zinc-600 text-xs font-mono animate-pulse">Drafting user interface copy and button text...</p>
        )}

        {isCompleted && stage.data && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center justify-between w-full max-w-sm bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 hover:bg-zinc-900 transition-colors"
            >
              <span className="text-zinc-300 text-sm font-medium">View Interface Copy Map</span>
              {isOpen ? <ChevronUp size={16} className="text-zinc-600" /> : <ChevronDown size={16} className="text-zinc-600" />}
            </button>

            {isOpen && (
              <div className="mt-1 w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2.5 animate-in fade-in duration-150">
                {stage.data.copy_map.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-baseline border-b border-zinc-800/60 pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-[10px] text-zinc-600">{item.key}</span>
                    <span className="text-xs text-zinc-300 font-medium">"{item.value}"</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
