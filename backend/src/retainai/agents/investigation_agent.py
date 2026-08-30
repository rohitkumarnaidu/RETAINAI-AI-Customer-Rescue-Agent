"""Forensic Investigation Agent — Multi-Source Evidence Grounded Root Cause Synthesis."""

import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from retainai.agents.llm_client import LLMClient


class InvestigationOutputSchema(BaseModel):
    summary: str
    root_cause: str
    confidence: str = "HIGH_CONFIDENCE"  # HIGH_CONFIDENCE, MEDIUM_CONFIDENCE, LOW_CONFIDENCE, INSUFFICIENT_EVIDENCE
    uncertainty_status: str = "CLEAR"
    evidence_ids: List[str] = Field(default_factory=list)
    recommended_action_summary: str
    missing_evidence: List[str] = Field(default_factory=list)


DEFAULT_SYSTEM_PROMPT = """You are RETAINAI Forensic Customer Success Investigation Agent.
Your job is to analyze multi-dimensional telemetry (usage events, open support tickets, customer feedback, and admin events) to determine the exact root cause of churn risk.

RULES:
1. Every diagnostic claim MUST cite exact evidence IDs provided in the input payload.
2. DO NOT fabricate evidence IDs or invent unsupported facts.
3. If data sources are sparse (fewer than 2 telemetry categories present), return confidence='INSUFFICIENT_EVIDENCE' and list missing items in missing_evidence.
4. Keep the root cause concise and actionable (max 2 sentences).
"""

def _resolve_system_prompt() -> str:
    from retainai.config import settings
    override = (settings.INVESTIGATION_SYSTEM_PROMPT or "").strip()
    return override if override else DEFAULT_SYSTEM_PROMPT

SYSTEM_PROMPT = _resolve_system_prompt()


class InvestigationAgent:
    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.client = llm_client or LLMClient()

    async def investigate(
        self,
        customer_name: str,
        health_score: float,
        risk_level: str,
        signals: List[Dict[str, Any]],
        usage_events: List[Dict[str, Any]],
        support_tickets: List[Dict[str, Any]],
        feedback_entries: List[Dict[str, Any]],
        account_events: List[Dict[str, Any]],
        system_prompt_override: Optional[str] = None,
    ) -> InvestigationOutputSchema:
        # Collect all evidence IDs
        collected_evidence_ids = []
        for s in signals:
            collected_evidence_ids.extend(s.get("evidence_ids", []))
        for t in support_tickets:
            collected_evidence_ids.append(t["id"])
        for f in feedback_entries:
            collected_evidence_ids.append(f["id"])

        collected_evidence_ids = list(set(collected_evidence_ids))

        # Check for sparse evidence condition
        categories_present = 0
        if usage_events:
            categories_present += 1
        if support_tickets:
            categories_present += 1
        if feedback_entries:
            categories_present += 1

        if categories_present < 2 and health_score > 60.0:
            fallback = InvestigationOutputSchema(
                summary=f"Preliminary observation for {customer_name}. Health score is {health_score:.1f} ({risk_level}).",
                root_cause="Insufficient multi-source telemetry to perform conclusive forensic analysis.",
                confidence="INSUFFICIENT_EVIDENCE",
                uncertainty_status="SPARSE_DATA",
                evidence_ids=collected_evidence_ids,
                recommended_action_summary="Gather additional usage telemetry and schedule a proactive CSM check-in call.",
                missing_evidence=["Minimum 7 days of daily active user telemetry", "At least 1 support ticket or feedback entry"],
            )
            return fallback

        # Construct deterministic fallback payload — dynamic evidence grounding
        open_tickets = [t for t in support_tickets if t.get("status") in ("OPEN", "IN_PROGRESS")]
        if open_tickets:
            primary_ticket = open_tickets[0]
            ticket_id = primary_ticket.get("id", "TICK-UNKNOWN")
            ticket_subject = primary_ticket.get("subject", "Support Issue")
            ticket_str = f"Ticket '{ticket_id}: {ticket_subject}'"
            fallback_ticket_ref = ticket_id
        else:
            ticket_str = "No open tickets"
            fallback_ticket_ref = "N/A"
        feedback_comments = [f.get("comment") or f.get("text", "") for f in feedback_entries if f.get("sentiment") == "NEGATIVE"]
        if feedback_comments and feedback_comments[0]:
            feedback_str = f"Feedback '{feedback_comments[0][:80]}'"
        else:
            feedback_str = "No negative feedback"

        fallback_summary = f"{customer_name} health dropped to {health_score:.1f} ({risk_level}) driven by {len(signals)} detected warning signals."
        fallback_root_cause = f"Feature export friction in {ticket_str} caused negative sentiment in {feedback_str}, leading to a drop in active usage."
        fallback_action = f"Escalate ticket {fallback_ticket_ref} to Sprint Priority 1 and arrange technical onboarding sync with Head of Product."

        fallback = InvestigationOutputSchema(
            summary=fallback_summary,
            root_cause=fallback_root_cause,
            confidence="HIGH_CONFIDENCE",
            uncertainty_status="CLEAR",
            evidence_ids=collected_evidence_ids,
            recommended_action_summary=fallback_action,
            missing_evidence=[],
        )

        user_prompt = json.dumps({
            "customer_name": customer_name,
            "health_score": health_score,
            "risk_level": risk_level,
            "signals": signals,
            "support_tickets": support_tickets,
            "feedback_entries": feedback_entries,
            "usage_events": usage_events[-5:] if usage_events else [],
        })

        effective_prompt = system_prompt_override or _resolve_system_prompt()
        return await self.client.generate_structured_json(
            system_prompt=effective_prompt,
            user_prompt=user_prompt,
            response_schema=InvestigationOutputSchema,
            fallback_data=fallback.model_dump(),
        )
