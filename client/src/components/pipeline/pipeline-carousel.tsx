"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { PRDStage } from "./prd-stage";
import { IAStage } from "./ia-stage";
import { CopyStage } from "./copy-stage";
import { LayoutStage } from "./layout-stage";
import { RenderStage } from "./render-stage";
import { cn } from "@/lib/utils";

interface PipelineCarouselProps {
  stages: PipelineStage[];
}

const STAGE_LABELS: Record<string, string> = {
  prd_node:    "PRD",
  ia_node:     "IA Map",
  copy_node:   "Copy",
  layout_node: "Layout",
  render_node: "Render",
};

export function PipelineCarousel({ stages }: PipelineCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sliding, setSliding] = useState(false);
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Scroll the active slide to top when it changes ────────────────────────
  useEffect(() => {
    slideRefs.current[activeIndex]?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeIndex]);

  function goTo(index: number, dir: "left" | "right") {
    if (sliding || index === activeIndex) return;
    setSlideDir(dir);
    setSliding(true);
    setTimeout(() => {
      setActiveIndex(index);
      setSliding(false);
    }, 380); // matches CSS transition duration
  }

  function prev() {
    if (activeIndex > 0) goTo(activeIndex - 1, "right");
  }

  function next() {
    if (activeIndex < stages.length - 1) goTo(activeIndex + 1, "left");
  }

  const canGoNext = activeIndex < stages.length - 1;
  const canGoPrev = activeIndex > 0;

  // Next unlocks as soon as the current stage is completed
  const nextEnabled = canGoNext && stages[activeIndex]?.status === "completed";

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 320px)", minHeight: 520 }}>

      {/* ── Stage breadcrumb dots ─────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {stages.map((stage, i) => (
          <button
            key={stage.id}
            onClick={() => {
              // Only allow clicking stages that have started
              if (stage.status !== "pending") goTo(i, i > activeIndex ? "left" : "right");
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-widest transition-all duration-300",
              i === activeIndex
                ? "bg-zinc-800 text-zinc-200 border border-zinc-700"
                : stage.status === "completed"
                  ? "text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  : stage.status === "active"
                    ? "text-zinc-500 cursor-pointer"
                    : "text-zinc-700 cursor-default"
            )}
          >
            {/* Tiny status dot */}
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              stage.status === "completed" ? "bg-zinc-400" :
              stage.status === "active"    ? "bg-zinc-400 animate-pulse" :
              i === activeIndex            ? "bg-zinc-500" : "bg-zinc-700"
            )} />
            {STAGE_LABELS[stage.id]}
          </button>
        ))}
      </div>

      {/* ── Slide viewport ───────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
        {stages.map((stage, i) => {
          const isVisible = i === activeIndex;
          const translateClass = !isVisible
            ? (slideDir === "left" ? "translate-x-full" : "-translate-x-full")
            : sliding
              ? (slideDir === "left" ? "-translate-x-full" : "translate-x-full")
              : "translate-x-0";

          return (
            <div
              key={stage.id}
              ref={el => { slideRefs.current[i] = el; }}
              className={cn(
                "absolute inset-0 overflow-y-auto p-8 transition-transform duration-[380ms] ease-in-out no-scrollbar",
                isVisible ? "translate-x-0 z-10" : cn("z-0", translateClass)
              )}
            >
              {/* Render the correct stage component */}
              {stage.id === "prd_node"    && <PRDStage stage={stage} />}
              {stage.id === "ia_node"     && <IAStage stage={stage} />}
              {stage.id === "copy_node"   && <CopyStage stage={stage} />}
              {stage.id === "layout_node" && <LayoutStage stage={stage} />}
              {stage.id === "render_node" && <RenderStage stage={stage} allStages={stages} />}

              {/* Bottom padding so content clears the nav buttons */}
              <div className="h-20" />
            </div>
          );
        })}
      </div>

      {/* ── Prev / Next navigation ───────────────────────────────────── */}
      <div className="flex items-center justify-between mt-4 px-1">

        {/* Prev */}
        <button
          onClick={prev}
          disabled={!canGoPrev}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all",
            canGoPrev
              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 active:scale-[0.97]"
              : "bg-zinc-900 text-zinc-700 border border-zinc-800/50 cursor-not-allowed"
          )}
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>

        {/* Stage counter */}
        <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
          {activeIndex + 1} / {stages.length}
        </span>

        {/* Next */}
        <button
          onClick={next}
          disabled={!nextEnabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all",
            nextEnabled
              ? "bg-zinc-100 text-black hover:bg-zinc-200 active:scale-[0.97]"
              : "bg-zinc-900 text-zinc-700 border border-zinc-800/50 cursor-not-allowed"
          )}
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>

      </div>
    </div>
  );
}
