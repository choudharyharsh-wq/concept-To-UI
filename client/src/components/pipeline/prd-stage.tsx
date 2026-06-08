import React from "react";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";
import Markdown from "markdown-to-jsx";

export function PRDStage({ stage }: { stage: PipelineStage }) {
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";

  return (
    <div className="relative pl-16">
      {/* Icon */}
      <div className={cn(
        "absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 bg-slate-950 transition-all duration-500",
        isActive ? "border-blue-500 text-blue-500 animate-glow" : 
        isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-800 text-slate-700"
      )}>
        {isCompleted ? <CheckCircle2 size={24} /> : isActive ? <Loader2 size={24} className="animate-spin" /> : <FileText size={24} />}
      </div>

      <div className="space-y-4">
        <h3 className={cn(
          "text-xl font-semibold transition-colors duration-500",
          isActive ? "text-blue-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-slate-400 animate-pulse">Analyzing concept and compiling PRD via ChatPRD...</p>
        )}

        {isCompleted && stage.data && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="prose prose-invert max-w-none">
              <h4 className="text-slate-200 font-bold mb-2">Target Audience</h4>
              <p className="text-slate-400 mb-4">{stage.data.target_audience}</p>
              
              <h4 className="text-slate-200 font-bold mb-2">Core Features</h4>
              <ul className="list-disc pl-5 text-slate-400 mb-4">
                {stage.data.core_features.map((feature: string, i: number) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
              
              <h4 className="text-slate-200 font-bold mb-2">Success Metrics</h4>
              <p className="text-slate-400">{stage.data.success_metrics}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
