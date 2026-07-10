"use client";

import React, { useState } from "react";
import { MessageSquare, Lightbulb, ChevronRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewQuestion { id: string; question: string; why: string; }
interface ReviewSuggestion { id: string; area: string; suggestion: string; impact: string; }
interface ReviewPayload {
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
}

interface ReviewPanelProps {
  stage: PipelineStage | undefined;
  onSubmitFeedback: (feedback: {
    answered_questions: Record<string, string>;
    accepted_suggestion_ids: string[];
    human_notes: string;
    confirmed_proceed: boolean;
  }) => void;
}

// ─── Score pill ───────────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const cls =
    score >= 8 ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" :
    score >= 5 ? "bg-amber-950/60  text-amber-400  border-amber-800"  :
                 "bg-red-950/60    text-red-400    border-red-800";
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full border font-mono text-xs font-semibold", cls)}>
      {score}/10
    </span>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ReviewPanel({ stage, onSubmitFeedback }: ReviewPanelProps) {
  const [answers,     setAnswers]     = useState<Record<string, string>>({});
  const [accepted,    setAccepted]    = useState<Set<string>>(new Set());
  const [notes,       setNotes]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const isAwaiting = stage?.data?.awaiting_human === true;
  const isApplying = stage?.data?.applying === true;
  const reviewData = stage?.data?.review as ReviewPayload | undefined;
  const review     = reviewData?.review;
  const isApproved = stage?.data?.approved === true;

  const toggle = (id: string) =>
    setAccepted(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async (confirmed: boolean) => {
    setSubmitting(true);
    await onSubmitFeedback({
      answered_questions:      answers,
      accepted_suggestion_ids: Array.from(accepted),
      human_notes:             notes,
      confirmed_proceed:       confirmed,
    });
    setSubmitting(false);
    if (!confirmed) {
      // reset for next round
      setAnswers({});
      setAccepted(new Set());
      setNotes("");
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────

  // Stage not started yet
  if (!stage || stage.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <div className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center">
          <MessageSquare size={16} className="text-zinc-700" />
        </div>
        <p className="text-sm text-zinc-600 font-mono">Design Head will review this stage's output</p>
      </div>
    );
  }

  // Human submitted feedback — applying changes and re-reviewing
  if (isApplying) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <Loader2 size={20} className="text-violet-400 animate-spin" />
        <p className="text-sm text-zinc-400 font-mono">Applying your feedback…</p>
        <p className="text-xs text-zinc-600 font-mono">Rewriting the PRD and re-reviewing it</p>
      </div>
    );
  }

  // Stage is running, no review yet
  if (stage.status === "active" && !isAwaiting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <Loader2 size={20} className="text-zinc-600 animate-spin" />
        <p className="text-sm text-zinc-600 font-mono">Waiting for stage to complete…</p>
      </div>
    );
  }

  // Stage completed and approved
  if (isApproved || (stage.status === "completed" && !isAwaiting)) {
    return (
      <div className="flex flex-col items-start gap-4 h-full">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono">
          <CheckCircle2 size={14} />
          Stage reviewed and approved
        </div>
        {review && (
          <p className="text-zinc-500 text-sm leading-relaxed">{review.overall_assessment}</p>
        )}
      </div>
    );
  }

  // No review data yet (stage complete but review hasn't fired)
  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <Loader2 size={16} className="text-zinc-600 animate-spin" />
        <p className="text-sm text-zinc-600 font-mono">Design Head is evaluating…</p>
      </div>
    );
  }

  // ── Main review UI ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 pb-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Design Head · Round {reviewData?.round || 1}
          </p>
          <p className="text-sm text-zinc-200 leading-relaxed">{review.overall_assessment}</p>
        </div>
        <ScorePill score={review.quality_score} />
      </div>

      {review.is_ready ? (
        <div className="flex items-start gap-2 bg-emerald-950/30 border border-emerald-800/50 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-300">{review.ready_summary}</p>
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-amber-950/20 border border-amber-800/40 rounded-lg px-3 py-2.5">
          <p className="text-xs text-amber-400/80">{review.ready_summary}</p>
        </div>
      )}

      {/* Questions */}
      {review.questions.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
            <MessageSquare size={10} />
            Open Questions
          </p>
          {review.questions.map(q => (
            <div key={q.id} className="space-y-2 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-200 font-medium leading-snug">{q.question}</p>
              <p className="text-[11px] text-zinc-600 italic leading-snug">{q.why}</p>
              {isAwaiting && (
                <textarea
                  rows={2}
                  placeholder="Your answer…"
                  value={answers[q.id] || ""}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                  className="w-full mt-1 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-600 transition-colors"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {review.suggestions.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
            <Lightbulb size={10} />
            Suggestions — tap to accept
          </p>
          {review.suggestions.map(s => (
            <button
              key={s.id}
              onClick={() => isAwaiting && toggle(s.id)}
              disabled={!isAwaiting}
              className={cn(
                "w-full text-left rounded-xl p-4 border transition-all",
                isAwaiting ? "cursor-pointer" : "cursor-default",
                accepted.has(s.id)
                  ? "border-violet-600 bg-violet-950/30"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-violet-400">{s.area}</span>
                  <p className="text-sm text-zinc-200 leading-snug">{s.suggestion}</p>
                  <p className="text-[11px] text-zinc-500 leading-snug">{s.impact}</p>
                </div>
                {isAwaiting && (
                  <div className={cn(
                    "shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5 transition-colors",
                    accepted.has(s.id) ? "bg-violet-600 border-violet-600" : "border-zinc-600 bg-zinc-800"
                  )}>
                    {accepted.has(s.id) && <Check size={11} className="text-white" />}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Notes */}
      {isAwaiting && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Any other suggestions from you
          </p>
          <textarea
            rows={3}
            placeholder="Free-form notes, changes, or context for the Design Head…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-600 transition-colors"
          />
        </div>
      )}

      {/* Apply & Re-do — submit the feedback above to rewrite the PRD and start a
          fresh review round. This always loops back to review (never proceeds). */}
      {isAwaiting && (
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className="w-full px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? "Applying…" : "Apply changes & re-do PRD"}
        </button>
      )}

      {/* Human override — accept the current PRD as-is and move on. Independent of
          the feedback form above; this is the only way to leave the review loop.
          Placed at the bottom, below "Apply changes & re-do PRD". */}
      {isAwaiting && (
        <button
          onClick={() => submit(true)}
          disabled={submitting}
          className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <CheckCircle2 size={15} />
          {submitting ? "Proceeding…" : "This PRD is perfect — proceed to IA"}
          <ChevronRight size={14} />
        </button>
      )}

    </div>
  );
}
