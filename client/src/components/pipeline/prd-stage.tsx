import React from "react";
import { CheckCircle2, FileText, Loader2, Target, User, Route, Layers, XCircle, Paintbrush } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={12} className="text-zinc-500 shrink-0" />
      <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</h4>
    </div>
  );
}

function Badge({ label, variant = "default" }: { label: string; variant?: "p0" | "p1" | "default" }) {
  return (
    <span className={cn(
      "inline-block font-mono text-[10px] px-2 py-0.5 rounded uppercase tracking-wider",
      variant === "p0" && "bg-zinc-800 text-zinc-300 border border-zinc-700",
      variant === "p1" && "bg-zinc-900 text-zinc-600 border border-zinc-800",
      variant === "default" && "bg-zinc-800 text-zinc-500",
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
    <div className="relative pl-14">
      {/* Stage node */}
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
      </div>

      <div className="space-y-4 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-zinc-600 text-xs font-mono animate-pulse">Analyzing concept and compiling PRD (Google + Microsoft methodology)...</p>
        )}

        {isCompleted && d && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Section 1 — Executive Summary */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <SectionHeader icon={Target} title="Executive Summary" />
              <p className="text-zinc-300 text-sm leading-relaxed mb-2">{d.executive_summary?.north_star}</p>
              <p className="text-zinc-600 text-xs">{d.executive_summary?.primary_value_proposition}</p>
            </div>

            {/* Section 2 — Target Persona */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <SectionHeader icon={User} title="Target Persona" />
              <p className="text-zinc-200 text-sm font-medium mb-1">{d.target_persona?.name}</p>
              <p className="text-zinc-500 text-sm mb-3">{d.target_persona?.behavioral_constraint}</p>
              <ul className="space-y-1">
                {d.target_persona?.core_pain_points?.map((pain: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-zinc-500 text-sm">
                    <span className="text-zinc-600 mt-0.5 shrink-0">—</span>
                    {pain}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 3 — Happy Path */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <SectionHeader icon={Route} title="Happy Path Scenario" />
              <p className="text-zinc-300 text-sm font-medium mb-3">{d.happy_path_scenario?.title}</p>
              <ol className="space-y-2">
                {d.happy_path_scenario?.steps?.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-zinc-500 text-sm">
                    <span className="w-4 h-4 rounded border border-zinc-800 bg-zinc-900 font-mono text-[10px] text-zinc-500 flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Section 4 — Functional Requirements */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <SectionHeader icon={Layers} title="Functional Requirements" />

              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">P0 — Must Have</p>
              <div className="space-y-1.5 mb-4">
                {d.functional_requirements?.p0_features?.map((f: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 bg-zinc-800/40 rounded-md px-3 py-2">
                    <div>
                      <p className="text-zinc-200 text-sm font-medium">{f.feature}</p>
                      <p className="text-zinc-600 text-xs mt-0.5">{f.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge label={f.component_type} variant="p0" />
                      <span className="font-mono text-[10px] text-zinc-700">{f.action}</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">P1 — Future State</p>
              <div className="space-y-1.5">
                {d.functional_requirements?.p1_features?.map((f: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 bg-zinc-900 border border-zinc-800/50 rounded-md px-3 py-2 opacity-50">
                    <div>
                      <p className="text-zinc-400 text-sm font-medium">{f.feature}</p>
                      <p className="text-zinc-600 text-xs mt-0.5">{f.description}</p>
                    </div>
                    <Badge label="deferred" variant="p1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5 — Non-Goals */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <SectionHeader icon={XCircle} title="Non-Goals (Scope Shield)" />
              <ul className="space-y-2">
                {d.non_goals?.map((goal: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-zinc-500 text-sm">
                    <XCircle size={12} className="text-zinc-700 shrink-0 mt-0.5" />
                    {goal}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 6 — UX Anchor Directives */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <SectionHeader icon={Paintbrush} title="UX Anchor Directives" />
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-800/40 rounded-md p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Posture</p>
                  <p className="text-zinc-300 text-xs font-mono">{d.ux_anchor_directives?.visual_posture}</p>
                </div>
                <div className="bg-zinc-800/40 rounded-md p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Tone</p>
                  <p className="text-zinc-300 text-xs font-mono">{d.ux_anchor_directives?.tone}</p>
                </div>
                <div className="bg-zinc-800/40 rounded-md p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Layout Hint</p>
                  <p className="text-zinc-300 text-xs">{d.ux_anchor_directives?.layout_hint}</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
