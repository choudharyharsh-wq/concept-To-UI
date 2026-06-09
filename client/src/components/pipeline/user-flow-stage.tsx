"use client";

import React, { useState } from "react";
import { CheckCircle2, GitBranch, Loader2, ChevronDown, ChevronUp, ArrowRight, MousePointer, Send, MoveRight, Eye } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface FlowStep {
  step_number: number;
  source_page_id: string;
  trigger_element: string;
  action_type: "click" | "submit_form" | "swipe" | "hover";
  destination_page_id: string;
}

interface UserFlow {
  flow_id: string;
  flow_name: string;
  description: string;
  ui_color_theme: string;
  steps: FlowStep[];
}

// ── Action type icon ──────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, React.ElementType> = {
  click:       MousePointer,
  submit_form: Send,
  swipe:       MoveRight,
  hover:       Eye,
};

// ── Single flow accordion ─────────────────────────────────────────────────────

function FlowAccordion({ flow, index }: { flow: UserFlow; index: number }) {
  const [open, setOpen] = useState(false);
  const ActionIcon = ACTION_ICON[flow.steps[0]?.action_type] ?? MousePointer;

  // Derive a muted background tint from the hex colour
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };
  const { r, g, b } = hexToRgb(flow.ui_color_theme);

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header / trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Colour dot */}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: flow.ui_color_theme }}
          />
          {/* Flow number badge */}
          <span
            className="font-mono text-[10px] px-2 py-0.5 rounded-md shrink-0"
            style={{
              backgroundColor: `rgba(${r},${g},${b},0.15)`,
              color: flow.ui_color_theme,
              border: `1px solid rgba(${r},${g},${b},0.3)`,
            }}
          >
            Flow {index + 1}
          </span>
          {/* Name */}
          <span className="text-sm font-semibold text-zinc-200 truncate">{flow.flow_name}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-[10px] text-zinc-600">{flow.steps.length} steps</span>
          {open
            ? <ChevronUp size={14} className="text-zinc-500" />
            : <ChevronDown size={14} className="text-zinc-500" />
          }
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div
          className="border-t border-zinc-800 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ backgroundColor: `rgba(${r},${g},${b},0.04)` }}
        >
          {/* Description */}
          <p className="text-zinc-500 text-xs leading-relaxed">{flow.description}</p>

          {/* Steps */}
          <div className="space-y-0">
            {flow.steps.map((step, i) => {
              const StepIcon = ACTION_ICON[step.action_type] ?? MousePointer;
              const isLast = i === flow.steps.length - 1;

              return (
                <div key={step.step_number} className="flex gap-3">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0"
                      style={{
                        backgroundColor: `rgba(${r},${g},${b},0.2)`,
                        color: flow.ui_color_theme,
                        border: `1px solid rgba(${r},${g},${b},0.4)`,
                      }}
                    >
                      {step.step_number}
                    </div>
                    {!isLast && (
                      <div
                        className="w-px flex-1 my-1"
                        style={{ backgroundColor: `rgba(${r},${g},${b},0.2)` }}
                      />
                    )}
                  </div>

                  {/* Step content */}
                  <div className={cn("pb-4 min-w-0", isLast && "pb-0")}>
                    {/* Source page */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {step.source_page_id}
                      </span>
                    </div>

                    {/* Trigger element */}
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <StepIcon size={11} className="text-zinc-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-zinc-300">{step.trigger_element}</span>
                    </div>

                    {/* Action type + destination */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800 uppercase">
                        {step.action_type}
                      </span>
                      <ArrowRight size={10} className="text-zinc-700" />
                      <span
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded border"
                        style={{
                          backgroundColor: `rgba(${r},${g},${b},0.1)`,
                          color: flow.ui_color_theme,
                          borderColor: `rgba(${r},${g},${b},0.3)`,
                        }}
                      >
                        {step.destination_page_id}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main stage component ──────────────────────────────────────────────────────

export function UserFlowStage({ stage }: { stage: PipelineStage }) {
  const isActive    = stage.status === "active";
  const isCompleted = stage.status === "completed";
  const flows: UserFlow[] = stage.data?.flows ?? [];

  return (
    <div className="relative pl-14">
      {/* Stage icon */}
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isActive    ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted
          ? <CheckCircle2 size={18} />
          : isActive
            ? <Loader2 size={18} className="animate-spin" />
            : <GitBranch size={18} />
        }
      </div>

      <div className="space-y-5 pt-2">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight transition-colors duration-500",
          isActive    ? "text-zinc-200" :
          isCompleted ? "text-zinc-300" : "text-zinc-600"
        )}>
          {stage.name}
        </h3>

        {isActive && (
          <p className="text-zinc-600 text-xs font-mono animate-pulse">
            Mapping golden happy-path user journeys...
          </p>
        )}

        {isCompleted && flows.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Stats bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <GitBranch size={12} className="text-zinc-500" />
                <span className="font-mono text-[10px] text-zinc-400">
                  {flows.length} flows · {flows.reduce((acc, f) => acc + f.steps.length, 0)} total steps
                </span>
              </div>
              {flows.map(f => (
                <div
                  key={f.flow_id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor: `${f.ui_color_theme}18`,
                    borderColor: `${f.ui_color_theme}40`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.ui_color_theme }} />
                  <span className="font-mono text-[9px]" style={{ color: f.ui_color_theme }}>
                    {f.flow_name}
                  </span>
                </div>
              ))}
            </div>

            {/* Accordions */}
            <div className="space-y-2">
              {flows.map((flow, i) => (
                <FlowAccordion key={flow.flow_id} flow={flow} index={i} />
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
