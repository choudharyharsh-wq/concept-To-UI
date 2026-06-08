"use client";

import React from "react";
import { Copy, ExternalLink, Calendar, ChevronLeft } from "lucide-react";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";
import Link from "next/link";
import { PipelineStage } from "@/hooks/use-generation-stream";

// Mock completed stages for the snapshot view
const COMPLETED_STAGES: PipelineStage[] = [
  {
    id: "prd_node",
    name: "Product Requirements Document",
    status: "completed",
    data: {
      target_audience: "Dog owners who value consistency and health for their pets.",
      core_features: [
        "Daily habit tracking (walking, feeding, meds)",
        "Reward system with pet store discounts",
        "Progress streaks and visualizations",
        "Social sharing of pet achievements"
      ],
      success_metrics: "15% increase in pet care consistency within 30 days."
    }
  },
  {
    id: "ia_node",
    name: "Information Architecture Map",
    status: "completed",
    data: {
      screens: [
        { name: "01. Dashboard", description: "Main overview of pet health and daily tasks." },
        { name: "02. Habit Tracker", description: "Checklist for daily activities with quick-log." },
        { name: "03. Rewards Hub", description: "Visual gallery of unlocked coupons and points." },
        { name: "04. Pet Profile", description: "Basic info and health history of the dog." }
      ]
    }
  },
  {
    id: "copy_node",
    name: "UX Copywriting Engine",
    status: "completed",
    data: {
      copy_map: [
        { key: "Hero Header", value: "Good Boy deserves a Good Day!" },
        { key: "Primary Button", value: "Log Today's Walk" },
        { key: "Success Message", value: "You're on a 5-day streak! 🐾" }
      ]
    }
  },
  {
    id: "layout_node",
    name: "Layout Logic Selector",
    status: "completed",
    data: {
      components: [
        "Global Navigation Bar (sticky-top, variant: absolute-dark)",
        "Metric Dashboard Card Component (3x Grid Layout)",
        "Floating Action Input Button (bottom-right positioning)",
        "Progress Radial Chart (Pet Health Overlay)"
      ]
    }
  },
  {
    id: "render_node",
    name: "Figma Canvas Renderer",
    status: "completed",
    data: {
      logs: [
        "[SYS] Connecting to Remote Figma MCP Server...",
        "[MCP] use_figma tool active: creating canvas viewport 'Draft-Run-01'",
        "[MCP] use_figma node created: Frame \"Dashboard\" [w:1440, h:1024]",
        "[MCP] Injecting layout token: var(--color-brand-primary)",
        "[MCP] Instantiating native component: Button/Primary",
        "[SUCCESS] Render Completed."
      ],
      figma_url: "https://www.figma.com/file/mock-id"
    }
  }
];

export default function SharePage({ params }: { params: { id: string } }) {
  const timestamp = new Date().toLocaleString();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="p-2 hover:bg-slate-900 rounded-lg transition-colors text-slate-400 hover:text-white">
              <ChevronLeft size={20} />
            </Link>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Project Archive Review</span>
              <div className="flex items-center space-x-2 text-slate-400 text-[10px] md:text-xs">
                <Calendar size={12} />
                <span>Generated {timestamp}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium hover:bg-slate-800 transition-colors">
              <Copy size={16} />
              <span>Copy Figma Link</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">
              <ExternalLink size={16} />
              <span>Open in Figma</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="space-y-4">
            <h1 className="text-3xl font-black tracking-tight">Dog Habit Tracker Concept</h1>
            <p className="text-slate-400 leading-relaxed">
              A minimalist habit tracker for dog owners that rewards consistency with pet store discounts.
              This snapshot captures the full AI architectural breakdown and the final Figma render state.
            </p>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

          <PipelineContainer stages={COMPLETED_STAGES} />
        </div>
      </div>
    </main>
  );
}
