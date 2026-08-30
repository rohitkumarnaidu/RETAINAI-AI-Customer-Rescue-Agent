"""Agentic REST API Routes for RETAINAI Autonomous Customer Rescue Agent."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from retainai.db.session import get_db
from retainai.auth.auth import get_current_user, require_tenant
from retainai.db.models import AgentRun
from retainai.agents.orchestrator import AgentOrchestrator
from retainai.demo.acme_replay import AcmeReplayEngine

router = APIRouter(prefix="/api/v1/agent", tags=["Agent Operations"])


@router.post("/investigate/{customer_id}")
async def trigger_agent_investigation(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user), tenant_id: str = Depends(require_tenant)):
    """Triggers the Agent Orchestrator to investigate customer telemetry and generate next-best action."""
    orchestrator = AgentOrchestrator(db, tenant_id=tenant_id)
    try:
        return await orchestrator.run_full_rescue_workflow(customer_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent investigation failed: {str(e)}")


@router.post("/{customer_id}/investigate")
async def trigger_agent_investigation_alias(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user), tenant_id: str = Depends(require_tenant)):
    orchestrator = AgentOrchestrator(db, tenant_id=tenant_id)
    try:
        return await orchestrator.run_full_rescue_workflow(customer_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent investigation failed: {str(e)}")


@router.get("/runs/{customer_id}")
async def list_agent_runs(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user), tenant_id: str = Depends(require_tenant)):
    """Retrieves audit run history for an agent workflow on a customer."""
    # Tenant filter
    q = select(AgentRun).where(AgentRun.customer_id == customer_id)
    if tenant_id:
        q = q.where((AgentRun.tenant_id == tenant_id) | (AgentRun.tenant_id.is_(None)))
    q = q.order_by(AgentRun.started_at.desc())
    res = await db.execute(q)
    runs = res.scalars().all()
    return [
        {
            "id": r.id,
            "started_at": r.started_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "workflow_type": r.workflow_type,
            "model": r.model,
            "input_summary": r.input_summary,
            "output_summary": r.output_summary,
            "tool_calls": r.tool_calls,
            "error": r.error,
        }
        for r in runs
    ]


@router.post("/demo/replay_acme_step")
async def replay_acme_scenario_step(
    step: str = "friction", intervention_id: str = "inv_acme_001", db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user), tenant_id: str = Depends(require_tenant)
):
    """Demo Helper Endpoint: Replays Acme scenario story steps ('healthy', 'friction', 'recovery')."""
    engine = AcmeReplayEngine(db)
    if step == "healthy":
        return await engine.step_healthy_baseline()
    elif step == "friction":
        return await engine.step_inject_friction()
    elif step == "recovery":
        return await engine.step_post_intervention_recovery(intervention_id=intervention_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid step name. Choose 'healthy', 'friction', or 'recovery'.")
