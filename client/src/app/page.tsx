"use client";

import React, { useState } from "react";
import { Sparkles, Figma, Send, Loader2 } from "lucide-react";
import { useGenerationStream } from "@/hooks/use-generation-stream";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [concept, setConcept] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("https://www.figma.com/file/123456789/Concept-To-UI-Test");
  const { isGenerating, stages, startGeneration } = useGenerationStream();
  const [hasStarted, setHasStarted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept || !figmaUrl) return;
    setHasStarted(true);
    startGeneration(concept, figmaUrl);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-700/50">
      <div className="container mx-auto px-6 pt-24 pb-16">

        {/* Header */}
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

        {/* Input Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-widest text-zinc-500">Your Concept</label>
                <textarea
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g., A minimalist habit tracker for dog owners that rewards consistency with pet store discounts."
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-4 focus:border-zinc-600 outline-none transition-colors resize-none text-zinc-200 placeholder:text-zinc-700 text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-widest text-zinc-500">Figma File URL</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                    <Figma size={16} />
                  </div>
                  <input
                    type="url"
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    placeholder="https://www.figma.com/file/..."
                    pattern="https:\/\/www\.figma\.com\/file\/.*"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 pl-11 pr-4 focus:border-zinc-600 outline-none transition-colors text-zinc-200 placeholder:text-zinc-700 text-sm"
                    required
                  />
                </div>
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
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Generate Wireframes</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Pipeline Visualization */}
        {(hasStarted || isGenerating) && (
          <div className="mt-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-16">
              <p className="font-mono text-xs uppercase tracking-widest text-zinc-600 mb-3">Pipeline</p>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-200">Live Generation</h2>
            </div>
            <PipelineContainer stages={stages} />
          </div>
        )}

      </div>
    </main>
  );
}
