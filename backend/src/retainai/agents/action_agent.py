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
        rc_lower = (root_cause + " " + investigation_summary).lower()
        has_support = any(k in rc_lower for k in ["ticket","support","bug","escalation","unresolved","severity","critical"])
        has_usage = any(k in rc_lower for k in ["usage","dau","active","adoption","engagement","decline","drop"," inactive"])
        has_sentiment = any(k in rc_lower for k in ["sentiment","feedback","nps","csat","negative","dissatisfact"])
        has_activity = any(k in rc_lower for k in ["admin","activity","login","session"])
        # Build dynamic fallback steps based on root cause signals
        fallback_steps = []
        step_n = 1
        if has_support and primary_ticket_ref != "reported support ticket":
            fallback_steps.append({
                "step": step_n,
                "title": "Support Escalation",
                "owner": "Engineering Lead",
                "action": f"Escalate {primary_ticket_ref} to Priority 1 and dispatch fix — root cause cites {root_cause[:80]}.",
                "target_date": "Within 48 hours",
            })
            step_n+=1
        elif has_support:
            fallback_steps.append({
                "step": step_n,
                "title": "Support Review",
                "owner": "Support Lead",
                "action": f"Review open tickets and unblock friction cited: {root_cause[:90]}",
                "target_date": "Within 48 hours",
            })
            step_n+=1
        if has_sentiment or has_activity:
            fallback_steps.append({
                "step": step_n,
                "title": "Executive Outreach",
                "owner": csm_name,
                "action": f"Schedule 15-min exec sync to address sentiment/activity gap — {root_cause[:80]}.",
                "target_date": f"Day {step_n+1}",
            })
            step_n+=1
        else:
            fallback_steps.append({
                "step": step_n,
                "title": "CSM Check-in",
                "owner": csm_name,
                "action": f"Proactive outreach to align on value realization — {root_cause[:80]}.",
                "target_date": f"Day {step_n+1}",
            })
            step_n+=1
        if has_usage:
            fallback_steps.append({
                "step": step_n,
                "title": "Adoption / Re-engagement Sync",
                "owner": "Head of Product",
                "action": f"1-on-1 walkthrough to recover usage decline ({root_cause[:70]}) and unblock workflows.",
                "target_date": f"Day {step_n+3}",
            })
        else:
            # Generic third step if not usage
            fallback_steps.append({
                "step": step_n,
                "title": "Value Realization Review",
                "owner": "Customer Success",
                "action": f"Review success plan & health metrics for {customer_name} — {investigation_summary[:70]}.",
                "target_date": f"Day {step_n+3}",
            })
        # Ensure 3 steps
        while len(fallback_steps)<3:
            fallback_steps.append({
                "step": len(fallback_steps)+1,
                "title": "Follow-up & Measure",
                "owner": csm_name,
                "action": f"Track outcome and measure health delta for {customer_name}.",
                "target_date": "Day 7-14",
            })
        # Dynamic email
        email_subject = f"Support + Success Sync — {customer_name} · {root_cause[:45]}"
        if has_support:
            email_body = f"Hi team,\n\nI wanted to personally reach out regarding {primary_ticket_ref}. We've prioritized this per our investigation: {root_cause[:120]}.\n\nCould we schedule a brief 10-min sync this week to confirm the fix and next steps?\n\nBest regards,\n{csm_name}\nCustomer Success Lead"
        elif has_sentiment:
            email_body = f"Hi team,\n\nNoticed some feedback friction — {root_cause[:120]}. I'd love to sync to ensure you're getting full value from {customer_name}.\n\nAre you free for 15 mins this week?\n\nBest regards,\n{csm_name}"
        else:
            email_body = f"Hi team,\n\nOur health monitoring flagged: {root_cause[:120]}. Let's connect to get {customer_name} back on track.\n\nBest regards,\n{csm_name}"
        fallback_email = {
            "recipient_role": "Customer Stakeholder",
            "subject": email_subject[:120],
            "body": email_body,
        }
        # Dynamic title/action_type
        if has_support and has_usage:
            action_type = "SUPPORT_ESCALATION_AND_ADOPTION_SYNC"
            title = f"Support Escalation + Adoption Recovery for {customer_name}"
            desc = f"Address compound risk: {root_cause[:100]}"
            objective = f"Resolve friction and recover usage for {customer_name} before renewal."
        elif has_support:
            action_type = "SUPPORT_ESCALATION_AND_EXECUTIVE_CHECKIN"
            title = f"Support Escalation & Executive Check-in for {customer_name}"
            desc = f"Escalate friction: {root_cause[:100]}"
            objective = f"Restore trust and unblock {customer_name} workflows."
        elif has_sentiment:
            action_type = "EXECUTIVE_OUTREACH_AND_VALUE_REVIEW"
            title = f"Executive Outreach & Value Review for {customer_name}"
            desc = f"Address sentiment gap: {root_cause[:100]}"
            objective = f"Recover satisfaction and engagement for {customer_name}."
        elif has_usage:
            action_type = "ADOPTION_RECOVERY_AND_TRAINING"
            title = f"Adoption Recovery for {customer_name}"
            desc = f"Recover usage decline: {root_cause[:100]}"
            objective = f"Re-engage and drive adoption for {customer_name}."
        else:
            action_type = "PROACTIVE_CHECKIN_AND_MONITORING"
            title = f"Proactive Success Check-in for {customer_name}"
            desc = f"Proactive risk review: {root_cause[:100]}"
            objective = f"Mitigate emerging risk for {customer_name}."
        # LIVE BRANCH: this fallback is last-resort only — passed to LLMClient.generate_structured_json fallback_data; live call is attempted first
        fallback = RetentionPlanOutputSchema(
            action_type=action_type,
            title=title,
            description=desc,
            objective=objective,
            priority="CRITICAL" if has_support and has_usage else ("HIGH" if (has_support or has_usage) else "MEDIUM"),
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
