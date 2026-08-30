"""Unit tests for Action Strategy Agent."""

import pytest
from retainai.agents.action_agent import ActionStrategyAgent


@pytest.mark.asyncio
async def test_action_agent_plan_generation():
    agent = ActionStrategyAgent()
    matched_memories = [{"id": "mem-101", "recommended_strategy": "ENGINEERING_ESCALATION"}]

    plan = await agent.generate_plan(
        customer_name="Acme Corp",
        csm_name="Sarah Jenkins",
        investigation_summary="Health dropped to 38 driven by export bug.",
        root_cause="CSV Export failure under TICK-101.",
        matched_memories=matched_memories,
    )

    assert plan.action_type != ""
    assert plan.priority in ("HIGH", "CRITICAL")
    assert len(plan.plan_steps) >= 2
    assert "body" in plan.draft_email
    assert "mem-101" in plan.matched_memory_ids
