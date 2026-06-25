"""
design_head.py — Design Head orchestrator and per-stage evaluator verticals.

The Design Head is a senior AI design expert that reviews the output of each
pipeline stage before the next one begins. For each stage it uses a specialist
"vertical" prompt tuned to that stage's quality criteria.

Current verticals:
  - PRD Evaluator  (prd_review_node)

Each evaluator follows this interaction model:
  Round 1: Read output → ask clarifying questions (grouped) → present suggestions
  Round N: Incorporate feedback → re-evaluate → signal ready → ask human to confirm
"""

import os
import json
from typing import Any
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator
from typing import List

load_dotenv(override=True)


# ── Shared LLM ────────────────────────────────────────────────────────────────

def get_design_head_llm(max_tokens: int = 4096):
    return ChatAnthropic(
        model="claude-haiku-4-5",
        temperature=0.3,
        max_tokens=max_tokens,
        anthropic_api_key=os.environ["ANTHROPIC_API_KEY"],
    )


# ── Pydantic output schema ─────────────────────────────────────────────────────

class ReviewSuggestion(BaseModel):
    id: str = Field(description="Short slug id, e.g. 'add_persona_2'")
    area: str = Field(description="Which PRD section this suggestion targets")
    suggestion: str = Field(description="Concrete, actionable improvement (1-2 sentences)")
    impact: str = Field(description="Why this matters — what it improves")

class ReviewQuestion(BaseModel):
    id: str = Field(description="Short slug id, e.g. 'clarify_scope'")
    question: str = Field(description="A focused clarifying question for the human")
    why: str = Field(description="Why this is important to answer before proceeding")

class PRDReviewOutput(BaseModel):
    overall_assessment: str = Field(
        description="2-3 sentence honest assessment of the PRD's current quality"
    )
    quality_score: int = Field(
        description="Quality score 1-10. 8+ means ready to proceed."
    )
    questions: List[ReviewQuestion] = Field(
        default_factory=list,
        description="Up to 3 focused clarifying questions. Empty list if none needed."
    )
    suggestions: List[ReviewSuggestion] = Field(
        default_factory=list,
        description="3-5 concrete improvement suggestions the human can accept or skip."
    )
    is_ready: bool = Field(
        description="True if quality_score >= 8 AND no blocking questions remain."
    )
    ready_summary: str = Field(
        description="If is_ready=True: brief statement of what makes this PRD solid. "
                    "If is_ready=False: what still needs to be addressed."
    )

    @field_validator("questions", "suggestions", mode="before")
    @classmethod
    def _coerce_list(cls, v):
        """
        Haiku's structured output occasionally returns these fields as a
        JSON-encoded string instead of a list, or omits them entirely.
        Coerce gracefully so a flaky model response never crashes the pipeline.
        """
        if v is None:
            return []
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return v


# ── Design Head master prompt ─────────────────────────────────────────────────

DESIGN_HEAD_SYSTEM = """You are the Design Head — a principal product designer and UX strategist \
with 12 years of experience shipping consumer apps at scale.

You oversee a multi-stage AI design pipeline. Your role is to review the output of \
each pipeline stage before the next one begins, using specialist evaluation verticals:

  PRD stage       → PRD Evaluator vertical
  IA stage        → IA Evaluator vertical  (coming soon)
  User Flow stage → Flow Evaluator vertical (coming soon)
  UX Layout stage → Layout Evaluator vertical (coming soon)

You are rigorous but constructive. You surface real problems, not pedantic nitpicks. \
You respect the human's decisions — they decide which suggestions to accept. \
You never proceed to the next stage without explicit human confirmation.

Your quality bar:
- PRD: clear north star, specific persona, scoped features, explicit non-goals
- The product concept should be fully understood from the PRD alone
- Nothing important is ambiguous or missing"""


# ── PRD Evaluator vertical ─────────────────────────────────────────────────────

PRD_EVALUATOR_SYSTEM = DESIGN_HEAD_SYSTEM + """

You are currently running your PRD Evaluator vertical.

Evaluate the PRD against these criteria:
1. NORTH STAR — Is the single most important user action crystal clear?
2. PERSONA — Is the target user defined by behaviour, not just demographics?
3. HAPPY PATH — Does the 5-step scenario feel realistic and specific?
4. FEATURES — Are P0 features truly the minimum? Any scope creep?
5. NON-GOALS — Are non-goals explicit enough to prevent scope creep?
6. UX DIRECTIVES — Do the layout hints actually guide wireframe decisions?

When incorporating human feedback:
- If a question was answered: use the answer to improve the relevant PRD section
- If a suggestion was accepted: apply it concretely, not superficially
- Re-score honestly after changes — don't inflate the score to please the human

Output format: structured JSON matching PRDReviewOutput schema."""


def run_prd_evaluator(
    prd_data: dict,
    concept: str,
    previous_feedback: dict = None,
    round_number: int = 1,
) -> PRDReviewOutput:
    """
    Runs one round of PRD evaluation.
    Returns a structured PRDReviewOutput.
    """
    llm = get_design_head_llm(max_tokens=4096)
    structured_llm = llm.with_structured_output(PRDReviewOutput)

    feedback_section = ""
    if previous_feedback and round_number > 1:
        answered = previous_feedback.get("answered_questions", {})
        accepted = previous_feedback.get("accepted_suggestion_ids", [])
        human_notes = previous_feedback.get("human_notes", "")
        feedback_section = f"""
--- HUMAN FEEDBACK FROM PREVIOUS ROUND ---
Answered questions: {json.dumps(answered, indent=2)}
Accepted suggestion IDs: {json.dumps(accepted)}
Additional notes from human: {human_notes or "None"}
-------------------------------------------

The PRD has been updated to incorporate this feedback. Re-evaluate the updated PRD.
"""

    user_prompt = f"""Evaluate this PRD (Round {round_number}).

Original concept:
{concept}

Current PRD:
{json.dumps(prd_data, indent=2)}
{feedback_section}"""

    result: PRDReviewOutput = structured_llm.invoke([
        SystemMessage(content=PRD_EVALUATOR_SYSTEM),
        HumanMessage(content=user_prompt),
    ])

    return result


def apply_prd_feedback(
    prd_data: dict,
    concept: str,
    feedback: dict,
    review: PRDReviewOutput,
) -> dict:
    """
    Asks the LLM to rewrite the PRD incorporating accepted suggestions
    and answers to questions.
    Returns updated prd_data dict.
    """
    llm = get_design_head_llm(max_tokens=4096)

    answered   = feedback.get("answered_questions", {})
    accepted   = feedback.get("accepted_suggestion_ids", [])
    human_notes = feedback.get("human_notes", "")

    accepted_suggestions = [
        s for s in review.suggestions if s.id in accepted
    ]

    if not answered and not accepted_suggestions and not human_notes:
        # Nothing to apply
        return prd_data

    apply_prompt = f"""You are updating a PRD based on human feedback.

Original concept: {concept}

Current PRD:
{json.dumps(prd_data, indent=2)}

Changes to make:
1. Answered questions (use these answers to fill gaps):
{json.dumps(answered, indent=2)}

2. Accepted suggestions to apply:
{json.dumps([s.model_dump() for s in accepted_suggestions], indent=2)}

3. Additional human notes:
{human_notes or "None"}

Return ONLY the updated PRD as a valid JSON object with the exact same \
top-level keys as the input PRD. Do not add new keys. Do not wrap in markdown."""

    response = llm.invoke([
        SystemMessage(content="You are a PRD writer. Return only valid JSON."),
        HumanMessage(content=apply_prompt),
    ])

    content = response.content
    if isinstance(content, list):
        content = "".join(
            b["text"] if isinstance(b, dict) else b.text
            for b in content
            if (isinstance(b, dict) and b.get("type") == "text")
            or (hasattr(b, "type") and b.type == "text")
        )

    # Strip markdown fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    content = content.strip()

    try:
        updated = json.loads(content)
        return updated
    except Exception:
        # If parsing fails, return original unchanged
        print(f"    [WARN] PRD update parsing failed — keeping original PRD")
        return prd_data
