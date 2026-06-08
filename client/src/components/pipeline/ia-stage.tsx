import React from "react";
import { CheckCircle2, Network, Loader2, ArrowRight } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function IAStage({ stage }: { stage: PipelineStage }) {
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  return (
    <div className="relative pl-14">
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="animate-spin" /> : <Network size={18} />}
      </div>

      <div className="space-y-4 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-zinc-600 text-xs font-mono animate-pulse">Structuring screen architectures...</p>
        )}

        {isCompleted && stage.data && (
          <div className="flex overflow-x-auto pb-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-500 no-scrollbar">
            {stage.data.screens.map((screen: any, i: number) => (
              <React.Fragment key={i}>
                <div className="min-w-[176px] bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 shrink-0">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{screen.name.split('.')[0]}</div>
                  <div className="text-zinc-200 text-sm font-semibold mb-2">{screen.name.split('.')[1]?.trim()}</div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{screen.description}</p>
                </div>
                {i < stage.data.screens.length - 1 && (
                  <div className="flex items-center text-zinc-800 shrink-0">
                    <ArrowRight size={16} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
