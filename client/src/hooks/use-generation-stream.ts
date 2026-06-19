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
  { id: "prd_node",                name: "Product Requirements Document", status: "pending", data: null },
  { id: "prd_review_node",         name: "Design Head — PRD Review",      status: "pending", data: null },
  { id: "ia_node",                 name: "Information Architecture Map",  status: "pending", data: null },
  { id: "user_flow_node",          name: "User Flow Builder",             status: "pending", data: null },
  { id: "ux_layout_node",          name: "UX Layout Planner",             status: "pending", data: null },
  { id: "wireframe_compiler_node", name: "Wireframe Compiler",            status: "pending", data: null },
  { id: "render_node",             name: "Figma Canvas Renderer",         status: "pending", data: null },
];

const MOCK_DATA = {
  prd_node: {
    executive_summary: {
      north_star: "Help dog owners build consistent daily care habits through a minimalist tracker that makes good behavior feel rewarded. The single most important action is logging today's pet care routine in under 10 seconds.",
      primary_value_proposition: "Turn daily dog care into a rewarding streak that earns real pet store discounts.",
    },
    target_persona: {
      name: "The Busy Pet Parent",
      behavioral_constraint: "A dog owner who genuinely cares but forgets non-urgent tasks (meds, grooming) under daily work pressure and needs asynchronous reminders with zero-friction logging.",
      core_pain_points: [
        "Forgets recurring pet care tasks without a centralized tracker",
        "Existing apps are overloaded with features that slow down a 10-second daily check-in",
        "No tangible reward for consistency, so habit loops break within weeks",
      ],
    },
    happy_path_scenario: {
      title: "The Perfect Day — First-Time User Completes a Full Habit Loop",
      steps: [
        "User opens the app and sees today's empty habit checklist on the Dashboard",
        "User taps 'Log Walk' and marks the morning walk as done in one tap",
        "User logs feeding and medication, completing the daily checklist",
        "App shows a 5-day streak badge and unlocks a 10% PetSmart discount coupon",
        "User taps 'View Reward' and copies the coupon code to their clipboard",
      ],
    },
    functional_requirements: {
      p0_features: [
        { feature: "Daily Habit Checklist", description: "List of today's tasks with one-tap completion", component_type: "list", action: "toggle_complete" },
        { feature: "Streak Counter", description: "Displays current consecutive days of full completion", component_type: "dashboard_card", action: "display_data" },
        { feature: "Reward Unlock Banner", description: "Shows discount coupon when streak milestone is hit", component_type: "modal", action: "trigger_reward" },
        { feature: "Log Habit Button", description: "Primary CTA to mark a habit done", component_type: "button", action: "submit_form" },
      ],
      p1_features: [
        { feature: "Social Share Card", description: "Share streak milestone image to Instagram/WhatsApp", component_type: "button", action: "share", state: "future" },
        { feature: "Pet Health History", description: "Calendar view of past habit completion rates", component_type: "dashboard_card", action: "navigate", state: "future" },
      ],
    },
    non_goals: [
      "No payment processing or in-app purchases — coupon codes link to third-party retailer",
      "No vet appointment booking or health records management",
      "No multi-pet household management in this iteration",
    ],
    ux_anchor_directives: {
      visual_posture: "minimalist-form-first",
      tone: "warm-encouraging",
      layout_hint: "Sticky top nav + large checklist cards + floating action button bottom-right",
    },
  },
  ia_node: {
    pages: [
      {
        id: "landing-page",
        name: "Public Landing Page",
        parent_id: null,
        access_level: "public",
        layout_pattern: "landing_page",
        component_inventory: ["1x Hero Section with Title", "1x 'Get Started' CTA Button", "1x Features Grid"],
      },
      {
        id: "login-auth",
        name: "User Authentication",
        parent_id: "landing-page",
        access_level: "public",
        layout_pattern: "split_form",
        component_inventory: ["1x Brand Illustration", "1x Email Input Field", "1x Password Input Field", "1x Sign-In Button"],
      },
      {
        id: "user-dashboard",
        name: "Habits Dashboard",
        parent_id: "login-auth",
        access_level: "private",
        layout_pattern: "dashboard_grid",
        component_inventory: ["1x Sidebar Nav", "1x Habit Checklist Grid", "1x Progress Chart", "1x Add Habit FAB"],
      },
      {
        id: "habit-detail",
        name: "Habit Detail View",
        parent_id: "user-dashboard",
        access_level: "private",
        layout_pattern: "modal_popup",
        component_inventory: ["1x Habit Name Header", "1x 30-day Line Graph", "1x Archive Button", "1x Close Button"],
      },
      {
        id: "rewards-hub",
        name: "Rewards Hub",
        parent_id: "user-dashboard",
        access_level: "private",
        layout_pattern: "list_feed",
        component_inventory: ["1x Streak Counter Badge", "1x Coupon Gallery Grid", "1x Redeem Button"],
      },
      {
        id: "account-settings",
        name: "Account Settings",
        parent_id: "user-dashboard",
        access_level: "private",
        layout_pattern: "detail_view",
        component_inventory: ["1x Profile Picture Upload", "3x Profile Form Fields", "1x Save Changes Button"],
      },
    ],
  },
  user_flow_node: {
    flows: [
      {
        flow_id: "onboarding-flow",
        flow_name: "New User Onboarding",
        description: "A brand-new user discovers the app, signs up, and completes their first habit log.",
        ui_color_theme: "#10B981",
        steps: [
          { step_number: 1, source_page_id: "landing-page",  trigger_element: "1x 'Get Started' CTA Button", action_type: "click",       destination_page_id: "login-auth"      },
          { step_number: 2, source_page_id: "login-auth",    trigger_element: "1x Sign-In Button",           action_type: "submit_form", destination_page_id: "user-dashboard"  },
          { step_number: 3, source_page_id: "user-dashboard",trigger_element: "1x Add Habit FAB",            action_type: "click",       destination_page_id: "habit-detail"    },
        ],
      },
      {
        flow_id: "core-habit-logging",
        flow_name: "Daily Habit Check-In",
        description: "An existing user opens the app, logs today's habits, and earns a streak reward.",
        ui_color_theme: "#3B82F6",
        steps: [
          { step_number: 1, source_page_id: "user-dashboard", trigger_element: "1x Habit Checklist Grid item",  action_type: "click",       destination_page_id: "habit-detail"   },
          { step_number: 2, source_page_id: "habit-detail",   trigger_element: "1x Log Today Button",           action_type: "click",       destination_page_id: "user-dashboard" },
          { step_number: 3, source_page_id: "user-dashboard", trigger_element: "1x Streak Counter Badge",       action_type: "click",       destination_page_id: "rewards-hub"    },
        ],
      },
      {
        flow_id: "rewards-redemption",
        flow_name: "Redeem Streak Reward",
        description: "User navigates to the Rewards Hub and copies a discount coupon after hitting a milestone.",
        ui_color_theme: "#8B5CF6",
        steps: [
          { step_number: 1, source_page_id: "user-dashboard", trigger_element: "1x Sidebar Nav — Rewards link", action_type: "click",       destination_page_id: "rewards-hub"        },
          { step_number: 2, source_page_id: "rewards-hub",    trigger_element: "1x Redeem Button",              action_type: "click",       destination_page_id: "account-settings"   },
          { step_number: 3, source_page_id: "account-settings", trigger_element: "1x Save Changes Button",      action_type: "submit_form", destination_page_id: "user-dashboard"     },
        ],
      },
    ],
  },
  ux_layout_node: {
    screen_layouts: [
      {
        page_id: "user-dashboard",
        grid_system: "fixed_left_sidebar",
        scroll_behavior: "sticky_header_fluid_body",
        spatial_zones: [
          { zone_id: "left_rail_nav",    visual_weight: "P2_Supporting", width_percentage: 20, height_percentage: 100, rendering_sequence: ["1x Sidebar Nav"] },
          { zone_id: "main_focal_grid",  visual_weight: "P1_Dominant",   width_percentage: 80, height_percentage: 70,  rendering_sequence: ["1x Habit Checklist Grid", "1x Progress Chart"] },
          { zone_id: "bottom_fab",       visual_weight: "P1_Dominant",   width_percentage: 80, height_percentage: 10,  rendering_sequence: ["1x Add Habit FAB"] },
        ],
        ux_principles: [
          { principle_name: "Fitts's Law",         rationale: "The Add Habit FAB is placed in the bottom-right corner — the largest, most reachable target zone for thumb interaction on mobile, minimising motor effort for the app's primary action." },
          { principle_name: "Visual Hierarchy",    rationale: "The checklist grid occupies 80% of the dominant zone, ensuring the user's primary task (logging habits) receives maximum visual attention before supporting elements." },
          { principle_name: "Progressive Disclosure", rationale: "The sidebar nav collapses to icons on smaller viewports, surfacing only the current-context actions and reducing cognitive load from irrelevant navigation options." },
        ],
        empty_state_guidance: "Display an illustrated onboarding prompt with a single 'Add Your First Habit' CTA button centered in the main grid; suppress the progress chart section entirely until at least one habit is logged.",
      },
      {
        page_id: "landing-page",
        grid_system: "single_column_centered",
        scroll_behavior: "infinite_vertical",
        spatial_zones: [
          { zone_id: "hero_section",   visual_weight: "P1_Dominant",   width_percentage: 100, height_percentage: 60, rendering_sequence: ["1x Hero Section with Title", "1x 'Get Started' CTA Button"] },
          { zone_id: "features_grid",  visual_weight: "P2_Supporting", width_percentage: 100, height_percentage: 40, rendering_sequence: ["1x Features Grid"] },
        ],
        ux_principles: [
          { principle_name: "Visual Hierarchy",    rationale: "The hero section commands 60% of viewport height to anchor brand messaging before the user scrolls, ensuring the value proposition lands before feature details." },
          { principle_name: "Hick's Law",          rationale: "A single CTA ('Get Started') in the hero eliminates decision paralysis — the user has exactly one primary action, minimising choice-reaction time." },
        ],
        empty_state_guidance: "Landing page has no user-data dependency — always render full content; no empty state required.",
      },
    ],
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
  prd_node:                "prd_data",
  prd_review_node:         "review_data",
  ia_node:                 "ia_data",
  user_flow_node:          "user_flow_data",
  ux_layout_node:          "ux_layout_data",
  wireframe_compiler_node: "wireframe_payload",
  render_node:             "render_data",
};

const STAGE_ORDER = INITIAL_STAGES.map((s) => s.id);

export function useGenerationStream() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef   = useRef<string>("default");

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

      const sessionId = `session_${Date.now()}`;
      sessionIdRef.current = sessionId;
      const url = `${BACKEND_URL}/api/generate?concept=${encodeURIComponent(concept)}&figma_url=${encodeURIComponent(figmaUrl)}&session_id=${sessionId}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const { phase, status, data } = JSON.parse(event.data) as {
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

        // Human-in-the-loop pause: Design Head is waiting for feedback
        if (status === "awaiting_human") {
          const innerKey = NODE_DATA_KEY[phase];
          const stageData = innerKey
            ? { ...data[innerKey], ...(data.logs ? { logs: data.logs } : {}), awaiting_human: true }
            : { ...data, awaiting_human: true };
          setStageStatus(phase, "active", stageData);
          return; // don't advance — wait for human
        }

        // Backend re-ran apply_feedback, just update review stage silently
        if (phase === "prd_feedback_received") {
          return;
        }

        // Extract the stage-specific content from the wrapper key (e.g. data.prd_data).
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

  const submitReviewFeedback = useCallback(async (feedback: {
    answered_questions: Record<string, string>;
    accepted_suggestion_ids: string[];
    human_notes: string;
    confirmed_proceed: boolean;
  }) => {
    await fetch(`${BACKEND_URL}/api/review/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionIdRef.current, ...feedback }),
    });
  }, []);

  return { isGenerating, stages, startGeneration, submitReviewFeedback };
}
