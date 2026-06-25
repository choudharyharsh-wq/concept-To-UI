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
  { id: "prd_node",                name: "PRD",             status: "pending", data: null },
  { id: "prd_review_node",         name: "PRD Review",      status: "pending", data: null },
  { id: "ia_node",                 name: "IA Map",          status: "pending", data: null },
  { id: "user_flow_node",          name: "User Journey",    status: "pending", data: null },
  { id: "ux_layout_node",          name: "UX Layout",       status: "pending", data: null },
  { id: "wireframe_compiler_node", name: "Compiler",        status: "pending", data: null },
  { id: "render_node",             name: "Render to Figma", status: "pending", data: null },
];

const BACKEND_URL = "http://localhost:8000";

// Maps each node name to the key inside the backend payload that holds its content.
const NODE_DATA_KEY: Record<string, string> = {
  prd_node:                "prd_data",
  ia_node:                 "ia_data",
  user_flow_node:          "user_flow_data",
  ux_layout_node:          "ux_layout_data",
  wireframe_compiler_node: "wireframe_payload",
  render_node:             "render_data",
  // prd_review_node and prd_apply_feedback_node are handled separately below.
};

const STAGE_ORDER = INITIAL_STAGES.map((s) => s.id);

export function useGenerationStream() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef   = useRef<string>("default");
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

      // Activate the next stage in the pipeline.
      const nextIdx = STAGE_ORDER.indexOf(phase) + 1;
      if (nextIdx < STAGE_ORDER.length) {
        setStageStatus(STAGE_ORDER[nextIdx], "active");
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
    (concept: string, figmaUrl: string) => {
      if (eventSourceRef.current) eventSourceRef.current.close();

      setError(null);
      expectingCloseRef.current = false;
      setIsGenerating(true);
      setStages(INITIAL_STAGES);

      // Activate the first stage immediately so the UI shows progress right away.
      setStageStatus(STAGE_ORDER[0], "active");

      const sessionId = `session_${Date.now()}`;
      sessionIdRef.current = sessionId;
      const url = `${BACKEND_URL}/api/generate?concept=${encodeURIComponent(concept)}&figma_url=${encodeURIComponent(figmaUrl)}&session_id=${sessionId}`;
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

  return { isGenerating, stages, error, startGeneration, submitReviewFeedback };
}
