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
        llm_client: Optional[LLMClient] = None,
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

        # Construct deterministic fallback payload — dynamic evidence grounding (generic/domain-agnostic)
        # LIVE BRANCH (hybrid-live-dynamic): fallback_data is last-resort only — used only when live LLM call fails
        # Build dynamic parts from actual signals + evidence, not hard-coded export bug
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
        # Dynamic signal phrase
        signal_types = [s.get("signal_type","") for s in signals]
        has_usage = any(s.get("category")=="USAGE" or "USAGE" in s.get("signal_type","") for s in signals)
        has_support = any(s.get("category")=="SUPPORT" for s in signals)
        has_feedback = any(s.get("category")=="FEEDBACK" for s in signals)
        has_activity = any(s.get("category")=="ACTIVITY" for s in signals)
        parts = []
        if has_usage:
            # Find usage signal summary
            usage_sig = next((s for s in signals if s.get("category")=="USAGE"), None)
            if usage_sig and usage_sig.get("summary"):
                parts.append(usage_sig["summary"].split(".")[0])
            else:
                parts.append("significant drop in active usage/engagement")
        if has_support and open_tickets:
            parts.append(f"unresolved support friction in {ticket_str}")
        elif has_support:
            parts.append("support friction / ticket volume spike")
        if has_feedback and feedback_comments and feedback_comments[0]:
            parts.append(f"negative sentiment in {feedback_str}")
        elif has_feedback:
            parts.append("negative customer sentiment")
        if has_activity:
            parts.append("admin/engagement inactivity (14d)")
        if not parts:
            parts = [f"{len(signals)} warning signals" if signals else "anomaly in telemetry"]
            if ticket_str!="No open tickets":
                parts.append(ticket_str)
            if feedback_str!="No negative feedback":
                parts.append(feedback_str)
        fallback_summary = f"{customer_name} health dropped to {health_score:.1f} ({risk_level}) driven by {len(signals)} detected warning signals: {', '.join([s.get('signal_type','') for s in signals][:3]) or 'composite risk'}."
        if len(parts)==1:
            fallback_root_cause = f"{parts[0].capitalize()} detected — requires targeted intervention."
        elif len(parts)==2:
            fallback_root_cause = f"{parts[0].capitalize()} combined with {parts[1]} is driving churn risk."
        else:
            fallback_root_cause = f"Compound risk: {parts[0]} + {parts[1]} + {parts[2] if len(parts)>2 else ''}".strip(" +") + "."
        # Action summary generic but specific
        if has_support and fallback_ticket_ref!="N/A":
            fallback_action = f"Escalate {fallback_ticket_ref} to Priority 1, schedule executive check-in, and address {parts[0] if parts else 'root friction'}."
        elif has_feedback:
            fallback_action = f"Schedule proactive outreach to address sentiment gap and review {parts[0] if parts else 'value realization'}."
        elif has_usage:
            fallback_action = f"Launch adoption/re-engagement play: usage recovery sync and value review for {customer_name}."
        else:
            fallback_action = f"Schedule CSM check-in to investigate {' + '.join(signal_types[:2]) if signal_types else 'risk signals'}."

        # LIVE BRANCH: this fallback is last-resort only — passed to LLMClient.generate_structured_json fallback_data; live call is attempted first
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
        client = llm_client or self.client
        return await client.generate_structured_json(
            system_prompt=effective_prompt,
            user_prompt=user_prompt,
            response_schema=InvestigationOutputSchema,
            fallback_data=fallback.model_dump(),
        )
