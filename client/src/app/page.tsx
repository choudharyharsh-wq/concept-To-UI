"use client";

import React, { useState } from "react";
import { Sparkles, Figma, Send, Loader2 } from "lucide-react";
import { useGenerationStream } from "@/hooks/use-generation-stream";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [concept, setConcept] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const { isGenerating, stages, startGeneration } = useGenerationStream();
  const [hasStarted, setHasStarted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept || !figmaUrl) return;
    setHasStarted(true);
    startGeneration(concept, figmaUrl);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[25%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-20 pb-12">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-blue-400 text-sm font-medium">
            <Sparkles size={14} />
            <span>AI-Powered Wireframing</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
            Concept to UI
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Transform your wildest product ideas into production-ready Figma wireframes in seconds using our multi-stage AI pipeline.
          </p>
        </div>

        {/* Input Card */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl ring-1 ring-white/5">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 ml-1">Your Concept</label>
                <textarea
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g., A minimalist habit tracker for dog owners that rewards consistency with pet store discounts."
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-slate-200 placeholder:text-slate-600"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 ml-1">Figma File URL</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Figma size={18} />
                  </div>
                  <input
                    type="url"
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    placeholder="https://www.figma.com/file/..."
                    pattern="https:\/\/www\.figma\.com\/file\/.*"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-200 placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 transition-all shadow-lg",
                  isGenerating 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-white text-slate-950 hover:bg-slate-200 active:scale-[0.98] shadow-white/10"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Generating Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Generate Wireframes</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Pipeline Visualization */}
        {(hasStarted || isGenerating) && (
          <div className="mt-24 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-slate-200">Live Generation Pipeline</h2>
              <div className="w-12 h-1 bg-blue-500 mx-auto mt-2 rounded-full" />
            </div>
            <PipelineContainer stages={stages} />
          </div>
        )}
      </div>
    </main>
  );
}
