import React from "react";
import { CheckCircle2, FileText, Loader2, Target, User, Route, Layers, XCircle, Paintbrush } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-blue-400 shrink-0" />
      <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400">{title}</h4>
    </div>
  );
}

function Badge({ label, variant = "default" }: { label: string; variant?: "p0" | "p1" | "default" }) {
  return (
    <span className={cn(
      "inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
      variant === "p0" && "bg-blue-500/20 text-blue-300 border border-blue-500/30",
      variant === "p1" && "bg-slate-700/60 text-slate-400 border border-slate-600/40",
      variant === "default" && "bg-slate-700/60 text-slate-400",
    )}>
      {label}
    </span>
  );
}

export function PRDStage({ stage }: { stage: PipelineStage }) {
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";
  const d = stage.data;

  return (
    <div className="relative pl-16">
      <div className={cn(
        "absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 bg-slate-950 transition-all duration-500",
        isActive ? "border-blue-500 text-blue-500" :
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
          <p className="text-slate-400 animate-pulse text-sm">Analyzing concept and compiling PRD (Google + Microsoft methodology)...</p>
        )}

        {isCompleted && d && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">

            {/* Section 1 — Executive Summary */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <SectionHeader icon={Target} title="Executive Summary" />
              <p className="text-slate-300 text-sm leading-relaxed mb-2">{d.executive_summary?.north_star}</p>
              <p className="text-slate-500 text-xs italic">{d.executive_summary?.primary_value_proposition}</p>
            </div>

            {/* Section 2 — Target Persona */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <SectionHeader icon={User} title="Target Persona" />
              <p className="text-slate-200 text-sm font-semibold mb-1">{d.target_persona?.name}</p>
              <p className="text-slate-400 text-sm mb-3">{d.target_persona?.behavioral_constraint}</p>
              <ul className="space-y-1">
                {d.target_persona?.core_pain_points?.map((pain: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-slate-400 text-sm">
                    <span className="text-red-400 mt-0.5 shrink-0">•</span>
                    {pain}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 3 — Happy Path */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <SectionHeader icon={Route} title="Happy Path Scenario" />
              <p className="text-slate-300 text-sm font-medium mb-3">{d.happy_path_scenario?.title}</p>
              <ol className="space-y-2">
                {d.happy_path_scenario?.steps?.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-slate-400 text-sm">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Section 4 — Functional Requirements */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <SectionHeader icon={Layers} title="Functional Requirements" />

              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">P0 — Must Have</p>
              <div className="space-y-2 mb-4">
                {d.functional_requirements?.p0_features?.map((f: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-slate-200 text-sm font-medium">{f.feature}</p>
                      <p className="text-slate-500 text-xs">{f.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge label={f.component_type} variant="p0" />
                      <span className="text-[10px] text-slate-600 font-mono">{f.action}</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">P1 — Future State</p>
              <div className="space-y-2">
                {d.functional_requirements?.p1_features?.map((f: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 bg-slate-800/20 rounded-lg px-3 py-2 opacity-60">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">{f.feature}</p>
                      <p className="text-slate-500 text-xs">{f.description}</p>
                    </div>
                    <Badge label="deferred" variant="p1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5 — Non-Goals */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <SectionHeader icon={XCircle} title="Non-Goals (Scope Shield)" />
              <ul className="space-y-2">
                {d.non_goals?.map((goal: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-slate-400 text-sm">
                    <XCircle size={14} className="text-red-500/60 shrink-0 mt-0.5" />
                    {goal}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 6 — UX Anchor Directives */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <SectionHeader icon={Paintbrush} title="UX Anchor Directives" />
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/40 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Posture</p>
                  <p className="text-slate-300 text-xs font-mono">{d.ux_anchor_directives?.visual_posture}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Tone</p>
                  <p className="text-slate-300 text-xs font-mono">{d.ux_anchor_directives?.tone}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-3 col-span-1">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Layout Hint</p>
                  <p className="text-slate-300 text-xs">{d.ux_anchor_directives?.layout_hint}</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
