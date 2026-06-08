import React from "react";
import { CheckCircle2, Network, Loader2, ArrowRight } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function IAStage({ stage }: { stage: PipelineStage }) {
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  return (
    <div className="relative pl-16">
      <div className={cn(
        "absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 bg-slate-950 transition-all duration-500",
        isActive ? "border-blue-500 text-blue-500 animate-glow" : 
        isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-800 text-slate-700"
      )}>
        {isCompleted ? <CheckCircle2 size={24} /> : isActive ? <Loader2 size={24} className="animate-spin" /> : <Network size={24} />}
      </div>

      <div className="space-y-4">
        <h3 className={cn(
          "text-xl font-semibold transition-colors duration-500",
          isActive ? "text-blue-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-slate-400 animate-pulse">Structuring screen architectures...</p>
        )}

        {isCompleted && stage.data && (
          <div className="flex overflow-x-auto pb-4 space-x-4 animate-in fade-in slide-in-from-top-4 duration-700 no-scrollbar">
            {stage.data.screens.map((screen: any, i: number) => (
              <React.Fragment key={i}>
                <div className="min-w-[200px] bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-lg">
                  <div className="text-sm font-mono text-blue-400 mb-1">{screen.name.split('.')[0]}</div>
                  <div className="text-slate-200 font-bold mb-2">{screen.name.split('.')[1].trim()}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">• {screen.description}</p>
                </div>
                {i < stage.data.screens.length - 1 && (
                  <div className="flex items-center text-slate-700">
                    <ArrowRight size={20} />
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
