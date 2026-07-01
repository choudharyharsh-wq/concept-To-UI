"use client";

import { useState, useCallback, useRef } from "react";

export type PipelineStageStatus = "pending" | "active" | "completed";

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  data: any;
}

export type OutputMode = "figma" | "html";

// A single self-contained HTML screen emitted by the HTML compiler node.
export interface HtmlScreen {
  screen_id: string;
  screen_name: string;
  viewport_width: number;
  viewport_height: number;
  html: string;
  index?: number;
  total?: number;
}

// Stages shared by both branches, up to and including UX Layout.
const SHARED_STAGES: PipelineStage[] = [
  { id: "prd_node",        name: "PRD",          status: "pending", data: null },
  { id: "prd_review_node", name: "PRD Review",   status: "pending", data: null },
  { id: "ia_node",         name: "IA Map",       status: "pending", data: null },
  { id: "user_flow_node",  name: "User Journey", status: "pending", data: null },
  { id: "ux_layout_node",  name: "UX Layout",    status: "pending", data: null },
];

const FIGMA_TAIL: PipelineStage[] = [
  { id: "wireframe_compiler_node", name: "Compiler",        status: "pending", data: null },
  { id: "render_node",             name: "Render to Figma", status: "pending", data: null },
];

const HTML_TAIL: PipelineStage[] = [
  { id: "html_compiler_node", name: "HTML Canvas", status: "pending", data: null },
];

function stagesForMode(mode: OutputMode): PipelineStage[] {
  return [...SHARED_STAGES, ...(mode === "html" ? HTML_TAIL : FIGMA_TAIL)].map(s => ({ ...s }));
}

// Default to the Figma stage set until a generation starts.
const INITIAL_STAGES: PipelineStage[] = stagesForMode("figma");

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// Maps each node name to the key inside the backend payload that holds its content.
const NODE_DATA_KEY: Record<string, string> = {
  prd_node:                "prd_data",
  ia_node:                 "ia_data",
  user_flow_node:          "user_flow_data",
  ux_layout_node:          "ux_layout_data",
  wireframe_compiler_node: "wireframe_payload",
  render_node:             "render_data",
  html_compiler_node:      "html_screens",
  // prd_review_node and prd_apply_feedback_node are handled separately below.
};

export function useGenerationStream() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [htmlScreens, setHtmlScreens] = useState<HtmlScreen[]>([]);
  const [outputMode, setOutputMode] = useState<OutputMode>("figma");
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef   = useRef<string>("default");
  // Current stage id order — depends on the selected output mode, so the
  // "activate next stage" logic must read this rather than a fixed constant.
  const stageOrderRef  = useRef<string[]>(INITIAL_STAGES.map(s => s.id));
  // Set true when WE close the stream intentionally (awaiting_human / done) so
  // the EventSource onerror that follows a normal close is not treated as a failure.
  const expectingCloseRef = useRef<boolean>(false);

  const setStageStatus = useCallback(
    (id: string, status: PipelineStageStatus, data?: any) =>
      setStages((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status, ...(data !== undefined && { data }) } : s))
      ),
    []
  );

  // Shared SSE message handler used by both the initial generate stream and the
  // resume stream. Returns true if the stream was closed by this handler.
  const handleMessage = useCallback(
    (es: EventSource, event: MessageEvent) => {
      const { phase, status, data } = JSON.parse(event.data) as {
        phase: string;
        status: string;
        data: Record<string, any>;
      };

      if (phase === "done") {
        expectingCloseRef.current = true;
        es.close();
        setIsGenerating(false);
        return;
      }

      if (phase === "error") {
        expectingCloseRef.current = true;
        es.close();
        setIsGenerating(false);
        setError(data?.message || "The pipeline reported an error.");
        return;
      }

      // HTML compiler streams one screen at a time via the custom stream.
      if (phase === "html_compiler_node" && status === "screen_ready") {
        setHtmlScreens(prev =>
          prev.some(s => s.screen_id === data.screen_id)
            ? prev
            : [...prev, data as unknown as HtmlScreen]
        );
        setStageStatus("html_compiler_node", "active");
        return;
      }

      // Final completed event for the HTML node — bulk fallback in case the
      // per-screen stream was unavailable (merge any screens we don't have yet).
      if (phase === "html_compiler_node" && status === "completed") {
        const all = (data["html_screens"] as HtmlScreen[]) ?? [];
        if (all.length) {
          setHtmlScreens(prev => {
            const have = new Set(prev.map(s => s.screen_id));
            const merged = [...prev];
            all.forEach(s => { if (!have.has(s.screen_id)) merged.push(s); });
            return merged;
          });
        }
        setStageStatus("html_compiler_node", "completed", { logs: data.logs });
        return;
      }

      if (phase === "prd_review_node") {
        const reviewPayload = data["review_data"] || data;
        // The node's "completed" event already carries review_status in its payload;
        // the final dedicated event carries it as the SSE status. Check both so we
        // never briefly flash an "approved" state before the awaiting event lands.
        const isAwaiting =
          status === "awaiting_human" || data["review_status"] === "awaiting_human";
        setStageStatus("prd_review_node", "active", {
          review:         reviewPayload,
          awaiting_human: isAwaiting,
          approved:       !isAwaiting,
        });
        if (isAwaiting) {
          // Pipeline is paused server-side waiting for human input — the server
          // closes the stream here. Mark this as an expected close.
          expectingCloseRef.current = true;
          es.close();
        }
        return;
      }

      if (phase === "prd_apply_feedback_node") {
        const reviewPayload = data["review_data"] || {};
        const approved      = (data["review_status"] || "") === "approved";
        if (approved) {
          setStageStatus("prd_review_node", "completed", {
            review:         reviewPayload,
            awaiting_human: false,
            approved:       true,
          });
        } else {
          setStageStatus("prd_review_node", "active", {
            review:         reviewPayload,
            awaiting_human: true,
            approved:       false,
          });
        }
        if (data["prd_data"]) {
          setStages(prev => prev.map(s =>
            s.id === "prd_node"
              ? { ...s, data: { ...(s.data || {}), ...data["prd_data"] } }
              : s
          ));
        }
        return;
      }

      // Extract the stage-specific content from the wrapper key (e.g. data.prd_data).
      const innerKey  = NODE_DATA_KEY[phase];
      const stageData = innerKey
        ? { ...data[innerKey], ...(data.logs ? { logs: data.logs } : {}) }
        : data;

      // Safety net: once IA starts, the review phase is finished.
      if (phase === "ia_node") {
        setStageStatus("prd_review_node", "completed");
      }

      setStageStatus(phase, "completed", stageData);

      // Activate the next stage in the pipeline (order depends on output mode).
      const order   = stageOrderRef.current;
      const nextIdx = order.indexOf(phase) + 1;
      if (nextIdx > 0 && nextIdx < order.length) {
        setStageStatus(order[nextIdx], "active");
      }
    },
    [setStageStatus]
  );

  const attachHandlers = useCallback(
    (es: EventSource) => {
      es.onmessage = (event) => handleMessage(es, event);
      es.onerror = () => {
        es.close();
        if (expectingCloseRef.current) {
          // Normal end-of-stream close (awaiting_human / done) — not a failure.
          expectingCloseRef.current = false;
          return;
        }
        setIsGenerating(false);
        setError("Lost connection to the backend. Make sure the server is running on " + BACKEND_URL + ".");
      };
    },
    [handleMessage]
  );

  const startGeneration = useCallback(
    (concept: string, figmaUrl: string, useDs: boolean = false, mode: OutputMode = "figma", maxScreens: number = 0) => {
      if (eventSourceRef.current) eventSourceRef.current.close();

      setError(null);
      expectingCloseRef.current = false;
      setIsGenerating(true);
      setOutputMode(mode);
      setHtmlScreens([]);

      // Build the stage set for the chosen branch and record its order.
      const freshStages = stagesForMode(mode);
      stageOrderRef.current = freshStages.map(s => s.id);
      setStages(freshStages);

      // Activate the first stage immediately so the UI shows progress right away.
      setStageStatus(stageOrderRef.current[0], "active");

      const sessionId = `session_${Date.now()}`;
      sessionIdRef.current = sessionId;
      const url = `${BACKEND_URL}/api/generate?concept=${encodeURIComponent(concept)}&figma_url=${encodeURIComponent(figmaUrl)}&session_id=${sessionId}&use_ds=${useDs}&output_mode=${mode}&max_screens=${maxScreens}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;
      attachHandlers(es);
    },
    [setStageStatus, attachHandlers]
  );

  const submitReviewFeedback = useCallback(async (feedback: {
    answered_questions: Record<string, string>;
    accepted_suggestion_ids: string[];
    human_notes: string;
    confirmed_proceed: boolean;
  }) => {
    // Immediately reflect that we're working — replace the stale review UI with a
    // loader so the previous round's questions don't linger while round 2 runs.
    setStageStatus("prd_review_node", "active", {
      review:         undefined,
      awaiting_human: false,
      approved:       false,
      applying:       true,
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/review/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionIdRef.current, ...feedback }),
      });
      if (!res.ok) {
        setError(`Failed to submit review feedback (HTTP ${res.status}).`);
        return;
      }
    } catch (e: any) {
      setError("Could not reach the backend to submit feedback.");
      return;
    }

    // Open a new SSE connection to resume the graph from its checkpoint.
    if (eventSourceRef.current) eventSourceRef.current.close();
    setError(null);
    expectingCloseRef.current = false;
    setIsGenerating(true);

    const url = `${BACKEND_URL}/api/generate/resume?session_id=${encodeURIComponent(sessionIdRef.current)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    attachHandlers(es);
  }, [attachHandlers, setStageStatus]);

  // ── Rehydrate a stored run (history) — no SSE, all stages pre-filled ───────
  const loadGeneration = useCallback((rec: any) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const mode: OutputMode = rec?.output_mode === "html" ? "html" : "figma";

    setError(null);
    setIsGenerating(false);
    setOutputMode(mode);
    sessionIdRef.current = rec?.id ?? "default";

    const byId: Record<string, any> = {
      prd_node:                rec?.prd_data ?? null,
      prd_review_node:         { review: rec?.review?.review_data ?? null, awaiting_human: false, approved: true },
      ia_node:                 rec?.ia_data ?? null,
      user_flow_node:          rec?.user_flow_data ?? null,
      ux_layout_node:          rec?.ux_layout_data ?? null,
      wireframe_compiler_node: rec?.wireframe_payload ?? null,
      render_node:             rec?.render_data ?? null,
      html_compiler_node:      { count: (rec?.html_screens ?? []).length },
    };

    const filled = stagesForMode(mode).map((s) => ({
      ...s,
      status: "completed" as PipelineStageStatus,
      data: byId[s.id] ?? null,
    }));
    stageOrderRef.current = filled.map((s) => s.id);
    setStages(filled);
    setHtmlScreens(mode === "html" ? (rec?.html_screens ?? []) : []);
  }, []);

  return { isGenerating, stages, htmlScreens, outputMode, error, startGeneration, submitReviewFeedback, loadGeneration };
}
