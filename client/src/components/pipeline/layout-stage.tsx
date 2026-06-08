import React from "react";
import { CheckCircle2, Grid, Loader2, Check } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function LayoutStage({ stage }: { stage: PipelineStage }) {
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  return (
    <div className="relative pl-14">
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="animate-spin" /> : <Grid size={18} />}
      </div>

      <div className="space-y-4 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-zinc-600 text-xs font-mono animate-pulse">Binding layout logic to design system primitives...</p>
        )}

        {isCompleted && stage.data && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 max-w-sm animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="space-y-2">
              {stage.data.components.map((component: string, i: number) => (
                <div key={i} className="flex items-start gap-3 group">
                  <div className="mt-0.5 w-4 h-4 rounded border border-zinc-700 flex items-center justify-center bg-zinc-800 text-zinc-400 shrink-0">
                    <Check size={10} />
                  </div>
                  <span className="font-mono text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
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
