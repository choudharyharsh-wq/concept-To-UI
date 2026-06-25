"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Send, Loader2, Lightbulb } from "lucide-react";
import { useGenerationStream } from "@/hooks/use-generation-stream";
import { PipelineWorkspace } from "@/components/pipeline/pipeline-workspace";
import { cn } from "@/lib/utils";

// ── Idea starters — one-click concept one-pagers ──────────────────────────────
const IDEA_STARTERS: { label: string; concept: string }[] = [
  {
    label: "E-com app for pet parents",
    concept: `Product: A mobile-first e-commerce app for pet parents to shop for their pets.

Target user: Busy urban dog and cat owners (25–40) who care deeply about their pets but have little time to research products. They currently buy across scattered marketplaces and struggle to find trustworthy, pet-appropriate items.

Core problem: Generic shopping apps don't understand pets — no size/breed guidance, no recurring-need reminders, no curation, so owners overbuy or buy the wrong thing.

Goals:
- Let a user create a pet profile (species, breed, age, weight) and get a personalized store.
- Browse curated categories (food, treats, toys, grooming, health) with breed/size-aware recommendations.
- One-tap reorder and subscriptions for recurring essentials like food and litter.
- Frictionless checkout with saved addresses and payment.

Key features:
- Personalized home feed driven by the pet profile.
- Product detail pages with suitability ("good for puppies", "grain-free") and reviews from similar pets.
- Cart, subscriptions, order tracking, and reorder history.
- Wishlist and price-drop alerts.

Non-goals: vet appointment booking, social networking, marketplace for third-party sellers.

Tone: warm, trustworthy, playful.`,
  },
  {
    label: "Habit tracker with rewards",
    concept: `Product: A minimalist daily habit tracker that rewards consistency with real-world perks.

Target user: People (20–35) who repeatedly start habits and quit within two weeks because they get no tangible payoff and the apps feel like chores.

Core problem: Existing trackers are cluttered and rely only on streaks for motivation, which break and demoralize users.

Goals:
- Log a habit in under 10 seconds with one tap.
- Visualize streaks and progress in a calm, glanceable dashboard.
- Convert consistency into unlockable rewards (discount coupons, badges).

Key features:
- Daily checklist with one-tap completion.
- Streak counter and a weekly progress chart.
- Reward unlock screen when milestones are hit.
- Gentle reminders and an empty/first-run onboarding state.

Non-goals: social feed, in-app purchases, multi-user/team habits.

Tone: encouraging, focused, rewarding.`,
  },
  {
    label: "Personal finance dashboard",
    concept: `Product: A personal finance dashboard that gives individuals a clear, single view of their money.

Target user: Salaried professionals (25–45) who have multiple accounts and cards and feel anxious because they never know where their money actually goes.

Core problem: Money is fragmented across banks and apps; people lack a simple, trustworthy overview and actionable insight without spreadsheets.

Goals:
- Aggregate balances, spending, and upcoming bills into one dashboard.
- Categorize transactions automatically and surface monthly trends.
- Set budgets per category and get nudged before overspending.

Key features:
- Net-worth and cash-flow summary cards.
- Spending breakdown by category with trend charts.
- Budget setup and progress tracking.
- Bills/subscriptions tracker and alerts.

Non-goals: investment trading, tax filing, lending products.

Tone: professional, calm, trustworthy.`,
  },
];

export default function Dashboard() {
  const [concept, setConcept]   = useState("");
  const [figmaUrl, setFigmaUrl] = useState("https://www.figma.com/file/123456789/Concept-To-UI-Test");
  const { isGenerating, stages, error, startGeneration, submitReviewFeedback } = useGenerationStream();
  const [hasStarted, setHasStarted] = useState(false);

  // ── Navigation guards ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGenerating) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) return;
    window.history.pushState(null, "", window.location.href);
    const handler = () => {
      if (!window.confirm("Pipeline is still running. Going back will stop generation. Are you sure?"))
        window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept) return;
    setHasStarted(true);
    startGeneration(concept, figmaUrl);
  };

  // ── Full-screen workspace ─────────────────────────────────────────────────
  if (hasStarted || isGenerating) {
    return (
      <PipelineWorkspace
        stages={stages}
        isGenerating={isGenerating}
        error={error}
        onSubmitReviewFeedback={submitReviewFeedback}
      />
    );
  }

  // ── Landing page ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-700/50">
      <div className="container mx-auto px-6 pt-24 pb-16">

        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono text-xs uppercase tracking-widest mb-8">
            <Sparkles size={12} />
            <span>AI-Powered Wireframing</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-100">
            Concept to UI
          </h1>
          <p className="text-zinc-500 text-lg max-w-xl mx-auto mt-5 leading-relaxed">
            Transform product ideas into production-ready Figma wireframes using a multi-stage AI pipeline.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-widest text-zinc-500">Your Concept</label>

                {/* Idea starters — click to drop in a full concept one-pager */}
                <div className="flex flex-wrap gap-2 pb-1">
                  {IDEA_STARTERS.map((idea) => (
                    <button
                      key={idea.label}
                      type="button"
                      onClick={() => setConcept(idea.concept)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700/70 hover:border-zinc-600 active:scale-[0.98] transition-all"
                    >
                      <Lightbulb size={12} className="text-amber-400/80" />
                      {idea.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={concept}
                  onChange={e => setConcept(e.target.value)}
                  placeholder="e.g., A minimalist habit tracker for dog owners that rewards consistency with pet store discounts."
                  className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-lg p-4 focus:border-zinc-600 outline-none transition-colors resize-none text-zinc-200 placeholder:text-zinc-700 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors",
                  isGenerating
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-zinc-100 text-black hover:bg-zinc-200 active:scale-[0.99]"
                )}
              >
                {isGenerating ? <><Loader2 size={16} className="animate-spin" /><span>Generating…</span></>
                              : <><Send size={16} /><span>Generate Wireframes</span></>}
              </button>
            </form>
          </div>
        </div>

      </div>
    </main>
  );
}
