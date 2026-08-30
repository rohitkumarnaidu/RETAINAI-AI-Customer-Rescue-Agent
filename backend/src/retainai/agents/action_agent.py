"""Action Strategy Agent — Matches Root Causes & Validated Experience Memories to Formulate Next-Best Retention Plans."""

import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from retainai.agents.llm_client import LLMClient


class RetentionPlanOutputSchema(BaseModel):
    action_type: str
    title: str
    description: str
    objective: str
    priority: str = "HIGH"
    plan_steps: List[Dict[str, Any]] = Field(default_factory=list)
    draft_email: Dict[str, str] = Field(default_factory=dict)
    matched_memory_ids: List[str] = Field(default_factory=list)


DEFAULT_SYSTEM_PROMPT = """You are RETAINAI Action Strategy Agent.
Formulate a personalized, actionable retention intervention plan based on the investigation report and historical Experience Memories.

RULES:
1. Target root causes directly (e.g. if bug causes export friction, recommend engineering escalation + executive check-in).
2. Reference validated Experience Memories if matching strategies exist.
3. Provide step-by-step execution plan items with owner and target timeline.
4. Provide a professional, empathetic email draft for the CSM to review.
"""

def _resolve_system_prompt() -> str:
    from retainai.config import settings
    override = (settings.ACTION_SYSTEM_PROMPT or "").strip()
    return override if override else DEFAULT_SYSTEM_PROMPT

SYSTEM_PROMPT = _resolve_system_prompt()


class ActionStrategyAgent:
    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.client = llm_client or LLMClient()

    async def generate_plan(
        self,
        customer_name: str,
        csm_name: str,
        investigation_summary: str,
        root_cause: str,
        matched_memories: List[Dict[str, Any]],
        system_prompt_override: Optional[str] = None,
        llm_client: Optional[LLMClient] = None,
    ) -> RetentionPlanOutputSchema:
        memory_ids = [m["id"] for m in matched_memories if "id" in m]
        # Dynamic ticket reference from root cause / investigation summary
        import re
        ticket_match = re.search(r"(TICK[-\s]?\w+|tck_\w+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4})", root_cause + " " + investigation_summary, re.I)
        primary_ticket_ref = ticket_match.group(1) if ticket_match else "reported support ticket"

        # LIVE BRANCH (hybrid-live-dynamic): fallback_data is last-resort only — used only when live LLM call fails (HTTP non-200 / exception / parse failure). No mock fallback for successful path.
        fallback_steps = [
            {
                "step": 1,
                "title": "Engineering Escalation",
                "owner": "Engineering Lead",
                "action": f"Escalate {primary_ticket_ref} to Sprint Priority 1 patch release.",
                "target_date": "Within 48 hours",
            },
            {
                "step": 2,
                "title": "CSM Executive Outreach",
                "owner": csm_name,
                "action": "Schedule 15-minute sync with VP of Operations to review export patch and report delivery.",
                "target_date": "Day 3",
            },
            {
                "step": 3,
                "title": "Product Onboarding Sync",
                "owner": "Head of Product",
                "action": "Conduct 1-on-1 technical walkthrough for large dataset exports.",
                "target_date": "Day 7",
            },
        ]

        fallback_email = {
            "recipient_role": "Platform Administrator / Executive Lead",
            "subject": f"Priority Fix & Technical Sync — {customer_name} Account Support",
            "body": f"Hi team,\n\nI wanted to personally reach out regarding the issue reported under {primary_ticket_ref}. Our engineering team has escalated this to Sprint Priority 1 and dispatched a patch.\n\nCould we schedule a brief 10-minute sync this week to confirm the fix meets your month-end reporting needs?\n\nBest regards,\n{csm_name}\nCustomer Success Lead",
        }

        # LIVE BRANCH: this fallback is last-resort only — passed to LLMClient.generate_structured_json fallback_data; live call is attempted first
        fallback = RetentionPlanOutputSchema(
            action_type="ENGINEERING_ESCALATION_AND_EXECUTIVE_CHECKIN",
            title=f"Emergency Export Bug Patch & Executive Check-in for {customer_name}",
            description="Escalate report export bug to Sprint 1, schedule technical check-in, and conduct product walkthrough.",
            objective="Restore product trust, resolve critical support friction, and recover DAU metrics before renewal.",
            priority="CRITICAL",
            plan_steps=fallback_steps,
            draft_email=fallback_email,
            matched_memory_ids=memory_ids,
        )

        user_prompt = json.dumps({
            "customer_name": customer_name,
            "csm_name": csm_name,
            "investigation_summary": investigation_summary,
            "root_cause": root_cause,
            "matched_memories": matched_memories,
        })

        effective_prompt = system_prompt_override or _resolve_system_prompt()
        client = llm_client or self.client
        return await client.generate_structured_json(
            system_prompt=effective_prompt,
            user_prompt=user_prompt,
            response_schema=RetentionPlanOutputSchema,
            fallback_data=fallback.model_dump(),
        )
