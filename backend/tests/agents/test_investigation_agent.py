"""Unit tests for Investigation Agent & Evidence Grounding."""

import pytest
from retainai.agents.investigation_agent import InvestigationAgent


@pytest.mark.asyncio
async def test_investigation_agent_evidence_grounding():
    agent = InvestigationAgent()
    signals = [
        {"signal_type": "UNRESOLVED_CRITICAL_TICKET", "evidence_ids": ["TICK-101"]}
    ]
    support_tickets = [{"id": "TICK-101", "subject": "CSV export failure", "status": "OPEN", "severity": "HIGH"}]
    feedback_entries = [{"id": "FEED-201", "text": "Reporting export failed", "sentiment": "NEGATIVE"}]
    usage_events = [{"id": "USG-1", "daily_active_users": 42}]

    report = await agent.investigate(
        customer_name="Acme Corp",
        health_score=38.0,
        risk_level="CRITICAL",
        signals=signals,
        usage_events=usage_events,
        support_tickets=support_tickets,
        feedback_entries=feedback_entries,
        account_events=[],
    )

    assert report.confidence in ("HIGH_CONFIDENCE", "MEDIUM_CONFIDENCE")
    assert "TICK-101" in report.evidence_ids
    assert "FEED-201" in report.evidence_ids
    assert report.root_cause != ""


@pytest.mark.asyncio
async def test_investigation_agent_insufficient_evidence_safeguard():
    agent = InvestigationAgent()
    report = await agent.investigate(
        customer_name="New Client Inc",
        health_score=85.0,
        risk_level="HEALTHY",
        signals=[],
        usage_events=[{"id": "USG-1", "daily_active_users": 10}],
        support_tickets=[],
        feedback_entries=[],
        account_events=[],
    )

    assert report.confidence == "INSUFFICIENT_EVIDENCE"
    assert "SPARSE_DATA" in report.uncertainty_status
    assert len(report.missing_evidence) > 0
