import React from "react";
import { CheckCircle2, Grid, Loader2, Check } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function LayoutStage({ stage }: { stage: PipelineStage }) {
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  return (
    <div className="relative pl-16">
      <div className={cn(
        "absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 bg-slate-950 transition-all duration-500",
        isActive ? "border-blue-500 text-blue-500 animate-glow" : 
        isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-800 text-slate-700"
      )}>
        {isCompleted ? <CheckCircle2 size={24} /> : isActive ? <Loader2 size={24} className="animate-spin" /> : <Grid size={24} />}
      </div>

      <div className="space-y-4">
        <h3 className={cn(
          "text-xl font-semibold transition-colors duration-500",
          isActive ? "text-blue-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-slate-400 animate-pulse">Binding layout logic to design system primitives...</p>
        )}

        {isCompleted && stage.data && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 max-w-lg shadow-lg animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="space-y-3">
              {stage.data.components.map((component: string, i: number) => (
                <div key={i} className="flex items-start space-x-3 group">
                  <div className="mt-1 w-5 h-5 rounded border border-emerald-500/50 flex items-center justify-center bg-emerald-500/10 text-emerald-500 shrink-0">
                    <Check size={14} />
                  </div>
                  <span className="text-sm font-mono text-slate-400 group-hover:text-slate-200 transition-colors">
                    {component}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
