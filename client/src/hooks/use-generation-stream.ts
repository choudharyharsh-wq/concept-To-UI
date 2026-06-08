"use client";

import { useState, useCallback, useRef } from "react";

export type PipelineStageStatus = "pending" | "active" | "completed";

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  data: any;
}

const INITIAL_STAGES: PipelineStage[] = [
  { id: "prd_node", name: "Product Requirements Document", status: "pending", data: null },
  { id: "ia_node", name: "Information Architecture Map", status: "pending", data: null },
  { id: "copy_node", name: "UX Copywriting Engine", status: "pending", data: null },
  { id: "layout_node", name: "Layout Logic Selector", status: "pending", data: null },
  { id: "render_node", name: "Figma Canvas Renderer", status: "pending", data: null },
];

const MOCK_DATA = {
  prd_node: {
    target_audience: "Dog owners who value consistency and health for their pets.",
    core_features: [
      "Daily habit tracking (walking, feeding, meds)",
      "Reward system with pet store discounts",
      "Progress streaks and visualizations",
      "Social sharing of pet achievements"
    ],
    success_metrics: "15% increase in pet care consistency within 30 days."
  },
  ia_node: {
    screens: [
      { name: "01. Dashboard", description: "Main overview of pet health and daily tasks." },
      { name: "02. Habit Tracker", description: "Checklist for daily activities with quick-log." },
      { name: "03. Rewards Hub", description: "Visual gallery of unlocked coupons and points." },
      { name: "04. Pet Profile", description: "Basic info and health history of the dog." }
    ]
  },
  copy_node: {
    copy_map: [
      { key: "Hero Header", value: "Good Boy deserves a Good Day!" },
      { key: "Primary Button", value: "Log Today's Walk" },
      { key: "Success Message", value: "You're on a 5-day streak! 🐾" }
    ]
  },
  layout_node: {
    components: [
      "Global Navigation Bar (sticky-top, variant: absolute-dark)",
      "Metric Dashboard Card Component (3x Grid Layout)",
      "Floating Action Input Button (bottom-right positioning)",
      "Progress Radial Chart (Pet Health Overlay)"
    ]
  },
  render_node: {
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
};

const BACKEND_URL = "http://localhost:8000";

// Maps each node name to the key inside the backend payload that holds its content.
const NODE_DATA_KEY: Record<string, string> = {
  prd_node: "prd_data",
  ia_node: "ia_data",
  copy_node: "copy_data",
  layout_node: "layout_data",
  render_node: "render_data",
};

const STAGE_ORDER = INITIAL_STAGES.map((s) => s.id);

export function useGenerationStream() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const eventSourceRef = useRef<EventSource | null>(null);

  const setStageStatus = useCallback(
    (id: string, status: PipelineStageStatus, data?: any) =>
      setStages((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status, ...(data !== undefined && { data }) } : s))
      ),
    []
  );

  const runSimulation = useCallback(async () => {
    setIsGenerating(true);
    setStages(INITIAL_STAGES);
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const id = STAGE_ORDER[i];
      setStageStatus(id, "active");
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
      setStageStatus(id, "completed", MOCK_DATA[id as keyof typeof MOCK_DATA]);
    }
    setIsGenerating(false);
  }, [setStageStatus]);

  const startGeneration = useCallback(
    (concept: string, figmaUrl: string) => {
      if (eventSourceRef.current) eventSourceRef.current.close();

      setIsGenerating(true);
      setStages(INITIAL_STAGES);

      // Activate the first stage immediately so the UI shows progress right away.
      setStageStatus(STAGE_ORDER[0], "active");

      const url = `${BACKEND_URL}/api/generate?concept=${encodeURIComponent(concept)}&figma_url=${encodeURIComponent(figmaUrl)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const { phase, data } = JSON.parse(event.data) as {
          phase: string;
          status: string;
          data: Record<string, any>;
        };

        if (phase === "done") {
          es.close();
          setIsGenerating(false);
          return;
        }

        if (phase === "error") {
          console.error("Backend error:", data?.message);
          es.close();
          setIsGenerating(false);
          return;
        }

        // Extract the stage-specific content from the wrapper key (e.g. data.prd_data).
        // For render_node the logs live at the top level of data, so merge them in.
        const innerKey = NODE_DATA_KEY[phase];
        const stageData = innerKey
          ? { ...data[innerKey], ...(data.logs ? { logs: data.logs } : {}) }
          : data;

        setStageStatus(phase, "completed", stageData);

        // Activate the next stage in the pipeline.
        const nextIdx = STAGE_ORDER.indexOf(phase) + 1;
        if (nextIdx < STAGE_ORDER.length) {
          setStageStatus(STAGE_ORDER[nextIdx], "active");
        }
      };

      es.onerror = () => {
        console.warn("Backend unreachable — falling back to simulation.");
        es.close();
        setIsGenerating(false);
        runSimulation();
      };
    },
    [setStageStatus, runSimulation]
  );

  return { isGenerating, stages, startGeneration };
}
