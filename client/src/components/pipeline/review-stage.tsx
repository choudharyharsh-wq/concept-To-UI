"use client";

import React, { useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, Lightbulb, ChevronRight, Check } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewQuestion {
  id: string;
  question: string;
  why: string;
}

interface ReviewSuggestion {
  id: string;
  area: string;
  suggestion: string;
  impact: string;
}

interface ReviewData {
  stage: string;
  round: number;
  review: {
    overall_assessment: string;
    quality_score: number;
    questions: ReviewQuestion[];
    suggestions: ReviewSuggestion[];
    is_ready: boolean;
    ready_summary: string;
  };
  awaiting_human?: boolean;
  logs?: string[];
}

interface ReviewStageProps {
  stage: PipelineStage;
  onSubmitFeedback: (feedback: {
    answered_questions: Record<string, string>;
    accepted_suggestion_ids: string[];
    human_notes: string;
    confirmed_proceed: boolean;
  }) => void;
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" :
    score >= 5 ? "bg-amber-950/60 text-amber-400 border-amber-800" :
                 "bg-red-950/60 text-red-400 border-red-800";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-semibold", color)}>
      {score}/10
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewStage({ stage, onSubmitFeedback }: ReviewStageProps) {
  const isActive    = stage.status === "active";
  const isCompleted = stage.status === "completed";
  const data        = stage.data as ReviewData | null;
  const review      = data?.review;
  const isAwaiting  = data?.awaiting_human === true;

  const [answers, setAnswers]       = useState<Record<string, string>>({});
  const [accepted, setAccepted]     = useState<Set<string>>(new Set());
  const [notes, setNotes]           = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleSuggestion = (id: string) => {
    setAccepted(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async (confirmed: boolean) => {
    setSubmitting(true);
    await onSubmitFeedback({
      answered_questions:      answers,
      accepted_suggestion_ids: Array.from(accepted),
      human_notes:             notes,
      confirmed_proceed:       confirmed,
    });
    setSubmitting(false);
    setConfirming(false);
    setAnswers({});
    setAccepted(new Set());
    setNotes("");
  };

  return (
    <div className="relative pl-14">
      {/* Stage icon */}
      <div className={cn(
        "absolute left-0 top-0 w-11 h-11 rounded-md flex items-center justify-center border z-10 bg-zinc-950 transition-all duration-500",
        isAwaiting  ? "border-violet-500 text-violet-400" :
        isActive    ? "border-zinc-400 text-zinc-300" :
        isCompleted ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-700"
      )}>
        {isCompleted
          ? <CheckCircle2 size={18} />
          : isAwaiting
            ? <MessageSquare size={18} className="animate-pulse" />
            : isActive
              ? <Loader2 size={18} className="animate-spin" />
              : <div className="w-4 h-4 bg-zinc-800 rounded-sm" />}
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <h3 className={cn(
            "text-sm font-semibold tracking-tight transition-colors duration-500",
            isAwaiting ? "text-violet-300" :
            isActive ? "text-zinc-200" : isCompleted ? "text-zinc-300" : "text-zinc-600"
          )}>
            {stage.name}
          </h3>
          {review && <ScoreBadge score={review.quality_score} />}
          {isAwaiting && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-violet-500 border border-violet-800 bg-violet-950/40 px-2 py-0.5 rounded-full">
              Awaiting your input
            </span>
          )}
        </div>

        {/* Loading state */}
        {isActive && !isAwaiting && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-500">
            Design Head is reviewing the PRD…
          </div>
        )}

        {/* Review content — shown when awaiting human or completed */}
        {review && (isAwaiting || isCompleted) && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Overall assessment */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Design Head Assessment — Round {data?.round}
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {review.overall_assessment}
              </p>
              {review.is_ready && (
                <div className="flex items-center gap-2 mt-2 text-emerald-400 text-xs font-mono">
                  <CheckCircle2 size={12} />
                  {review.ready_summary}
                </div>
              )}
              {!review.is_ready && (
                <p className="text-xs text-amber-400/80 font-mono mt-1">
                  {review.ready_summary}
                </p>
              )}
            </div>

            {/* Questions */}
            {review.questions.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <MessageSquare size={10} />
                  Clarifying Questions
                </p>
                {review.questions.map((q) => (
                  <div key={q.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
                    <p className="text-sm text-zinc-200 font-medium">{q.question}</p>
                    <p className="text-[11px] text-zinc-600 italic">{q.why}</p>
                    {isAwaiting && (
                      <textarea
                        className="w-full mt-2 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-600"
                        rows={2}
                        placeholder="Your answer…"
                        value={answers[q.id] || ""}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      />
                    )}
                    {isCompleted && answers[q.id] && (
                      <p className="text-xs text-zinc-400 italic mt-1">"{answers[q.id]}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {review.suggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <Lightbulb size={10} />
                  Suggestions — click to accept
                </p>
                {review.suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => isAwaiting && toggleSuggestion(s.id)}
                    disabled={!isAwaiting}
                    className={cn(
                      "w-full text-left bg-zinc-900/60 border rounded-xl p-4 space-y-1.5 transition-all",
                      isAwaiting ? "cursor-pointer hover:border-violet-700" : "cursor-default",
                      accepted.has(s.id)
                        ? "border-violet-600 bg-violet-950/30"
                        : "border-zinc-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-violet-400">
                          {s.area}
                        </span>
                        <p className="text-sm text-zinc-200">{s.suggestion}</p>
                        <p className="text-[11px] text-zinc-500">{s.impact}</p>
                      </div>
                      {isAwaiting && (
                        <div className={cn(
                          "shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5",
                          accepted.has(s.id)
                            ? "bg-violet-600 border-violet-600"
                            : "border-zinc-600 bg-zinc-800"
                        )}>
                          {accepted.has(s.id) && <Check size={11} className="text-white" />}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Additional notes */}
            {isAwaiting && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  Additional notes (optional)
                </p>
                <textarea
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-600"
                  rows={2}
                  placeholder="Any other changes or context for the Design Head…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Action buttons */}
            {isAwaiting && (
              <div className="flex gap-3 pt-1">
                {/* Apply feedback + another round */}
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Applying…" : "Apply & Review Again"}
                </button>

                {/* Approve + proceed */}
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50",
                    review.is_ready
                      ? "bg-violet-600 hover:bg-violet-500 text-white"
                      : "bg-zinc-700 text-zinc-400 border border-zinc-600"
                  )}
                >
                  {submitting ? "Sending…" : (
                    <>
                      {review.is_ready ? "Looks good — proceed to IA" : "Override & proceed anyway"}
                      <ChevronRight size={13} />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Completed state summary */}
            {isCompleted && (
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <CheckCircle2 size={12} className="text-zinc-600" />
                PRD approved — proceeding to Information Architecture
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
