"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, GripVertical, CheckCircle2, Loader2, Circle } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { PRDStage } from "./prd-stage";
import { IAStage } from "./ia-stage";
import { UserFlowStage } from "./user-flow-stage";
import { UXLayoutStage } from "./ux-layout-stage";
import { WireframeCompilerStage } from "./wireframe-compiler-stage";
import { RenderStage } from "./render-stage";
import { ReviewPanel } from "./review-panel";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineWorkspaceProps {
  stages: PipelineStage[];
  isGenerating: boolean;
  error?: string | null;
  onSubmitReviewFeedback: (feedback: {
    answered_questions: Record<string, string>;
    accepted_suggestion_ids: string[];
    human_notes: string;
    confirmed_proceed: boolean;
  }) => void;
}

// ─── Stage nav dot ────────────────────────────────────────────────────────────

function StageDot({
  stage, index, isActive, onClick,
}: {
  stage: PipelineStage; index: number; isActive: boolean; onClick: () => void;
}) {
  const isAwaiting = stage.data?.awaiting_human;
  return (
    <button
      onClick={onClick}
      disabled={stage.status === "pending"}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all duration-200 select-none",
        isActive
          ? "bg-zinc-800 text-zinc-100 border border-zinc-600"
          : stage.status === "completed"
            ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 cursor-pointer"
            : stage.status === "active"
              ? isAwaiting
                ? "text-violet-400 cursor-pointer"
                : "text-zinc-400 cursor-pointer"
              : "text-zinc-700 cursor-default"
      )}
    >
      {/* Status indicator */}
      {stage.status === "completed" ? (
        <CheckCircle2 size={11} className="text-zinc-500 shrink-0" />
      ) : stage.status === "active" ? (
        isAwaiting
          ? <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 animate-pulse" />
          : <Loader2 size={11} className="animate-spin shrink-0" />
      ) : (
        <Circle size={11} className="shrink-0" />
      )}
      {stage.name}
      {isAwaiting && isActive && (
        <span className="text-[9px] bg-violet-900/60 text-violet-400 border border-violet-700 px-1.5 py-0.5 rounded-full">
          Review
        </span>
      )}
    </button>
  );
}

// ─── Stage output renderer (left panel) ──────────────────────────────────────

function StageOutput({ stage, allStages }: { stage: PipelineStage; allStages: PipelineStage[] }) {
  if (stage.status === "pending") {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-700 font-mono text-sm">
        Waiting for previous stages…
      </div>
    );
  }

  switch (stage.id) {
    case "prd_node":                return <PRDStage stage={stage} />;
    case "prd_review_node": {
      // Show the PRD content in the left panel while review happens on the right
      const prdStage = allStages.find(s => s.id === "prd_node");
      return prdStage ? <PRDStage stage={prdStage} /> : null;
    }
    case "ia_node":                 return <IAStage stage={stage} />;
    case "user_flow_node":          return <UserFlowStage stage={stage} />;
    case "ux_layout_node":          return <UXLayoutStage stage={stage} />;
    case "wireframe_compiler_node": return <WireframeCompilerStage stage={stage} />;
    case "render_node":             return <RenderStage stage={stage} allStages={allStages} />;
    default:                        return null;
  }
}

// ─── Main workspace ───────────────────────────────────────────────────────────

export function PipelineWorkspace({ stages, isGenerating, error, onSubmitReviewFeedback }: PipelineWorkspaceProps) {
  const [activeIdx, setActiveIdx]       = useState(0);
  const [leftPct, setLeftPct]           = useState(55); // left column width %
  const isDragging                       = useRef(false);
  const containerRef                     = useRef<HTMLDivElement>(null);
  const leftPanelRef                     = useRef<HTMLDivElement>(null);

  const visibleStages = stages; // all stages visible in nav

  const activeStage = visibleStages[activeIdx];
  const hasReview   = activeStage?.data?.awaiting_human === true && activeStage?.data?.review;

  // ── Auto-advance to newly active stage ────────────────────────────────────
  useEffect(() => {
    const activeI = visibleStages.findIndex(s => s.status === "active");
    if (activeI !== -1 && activeI !== activeIdx) {
      setActiveIdx(activeI);
    }
  }, [stages]);

  // ── Resizable divider ──────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect  = containerRef.current.getBoundingClientRect();
      const pct   = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(75, Math.max(25, pct)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const canGoPrev  = activeIdx > 0;
  const canGoNext  = activeIdx < visibleStages.length - 1;
  const nextUnlocked = canGoNext && (visibleStages[activeIdx]?.status === "completed");

  return (
    <div className="flex flex-col bg-zinc-950 text-zinc-100" style={{ height: "100dvh" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-950">

        {/* Logo */}
        <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-600 mr-3 shrink-0">
          Concept → UI
        </span>

        {/* Stage nav */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
          {visibleStages.map((stage, i) => (
            <StageDot
              key={stage.id}
              stage={stage}
              index={i}
              isActive={i === activeIdx}
              onClick={() => stage.status !== "pending" && setActiveIdx(i)}
            />
          ))}
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={() => canGoPrev && setActiveIdx(i => i - 1)}
            disabled={!canGoPrev}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-widest border transition-all",
              canGoPrev
                ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                : "border-zinc-800 text-zinc-700 cursor-not-allowed"
            )}
          >
            <ChevronLeft size={13} />
            Prev
          </button>
          <span className="font-mono text-[10px] text-zinc-700">{activeIdx + 1}/{visibleStages.length}</span>
          <button
            onClick={() => nextUnlocked && setActiveIdx(i => i + 1)}
            disabled={!nextUnlocked}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-widest border transition-all",
              nextUnlocked
                ? "border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                : "border-zinc-800 text-zinc-700 cursor-not-allowed"
            )}
          >
            Next
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="shrink-0 px-4 py-2 border-b border-red-900/60 bg-red-950/40">
          <span className="font-mono text-[11px] text-red-400">⚠ {error}</span>
        </div>
      )}

      {/* ── Split pane body ──────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">

        {/* Left — stage output */}
        <div
          ref={leftPanelRef}
          className="flex flex-col overflow-hidden border-r border-zinc-800"
          style={{ width: `${leftPct}%` }}
        >
          {/* Left header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Output</span>
              <span className="font-mono text-[11px] text-zinc-400">— {activeStage?.name}</span>
            </div>
            {activeStage?.status === "active" && !activeStage?.data?.awaiting_human && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                <Loader2 size={10} className="animate-spin" />
                Generating…
              </div>
            )}
            {activeStage?.status === "completed" && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600">
                <CheckCircle2 size={10} />
                Complete
              </div>
            )}
          </div>

          {/* Left content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
            {activeStage && (
              <StageOutput stage={activeStage} allStages={stages} />
            )}
          </div>
        </div>

        {/* ── Drag handle ──────────────────────────────────────────────── */}
        <div
          onMouseDown={onMouseDown}
          className="shrink-0 w-1 relative group cursor-col-resize bg-zinc-800 hover:bg-violet-600 transition-colors duration-150"
        >
          <div className="absolute inset-y-0 -left-2 -right-2" /> {/* wider hit area */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={14} className="text-violet-400" />
          </div>
        </div>

        {/* Right — reviewer / Design Head */}
        <div className="flex flex-col overflow-hidden bg-zinc-900/20" style={{ width: `${100 - leftPct}%` }}>

          {/* Right header */}
          <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/40">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Design Head</span>
            {hasReview && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-violet-400 border border-violet-800 bg-violet-950/40 px-2 py-0.5 rounded-full animate-pulse">
                Awaiting your input
              </span>
            )}
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
            <ReviewPanel
              stage={activeStage}
              onSubmitFeedback={onSubmitReviewFeedback}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
