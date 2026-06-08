import React, { useState } from "react";
import { CheckCircle2, PenTool, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function CopyStage({ stage }: { stage: PipelineStage }) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  return (
    <div className="relative pl-16">
      <div className={cn(
        "absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 bg-slate-950 transition-all duration-500",
        isActive ? "border-blue-500 text-blue-500 animate-glow" : 
        isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-800 text-slate-700"
      )}>
        {isCompleted ? <CheckCircle2 size={24} /> : isActive ? <Loader2 size={24} className="animate-spin" /> : <PenTool size={24} />}
      </div>

      <div className="space-y-4">
        <h3 className={cn(
          "text-xl font-semibold transition-colors duration-500",
          isActive ? "text-blue-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-slate-400 animate-pulse">Drafting user interface copy and button text...</p>
        )}

        {isCompleted && stage.data && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-700">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center justify-between w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:bg-slate-900 transition-colors"
            >
              <span className="text-slate-200 font-medium">View Interface Copy Map</span>
              {isOpen ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
            </button>
            
            {isOpen && (
              <div className="mt-2 w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 animate-in zoom-in-95 duration-200">
                {stage.data.copy_map.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                    <span className="text-xs font-mono text-slate-500">{item.key}:</span>
                    <span className="text-sm text-slate-300 font-medium">"{item.value}"</span>
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
