"""Agent Execution Endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from retainai.db.session import get_db
from retainai.agents.orchestrator import AgentOrchestrator
from retainai.models.schemas import RiskAssessmentSchema, RetentionPlanSchema

router = APIRouter(prefix="/api/v1/agent", tags=["Agent"])


@router.post("/{customer_id}/investigate", response_model=Dict[str, Any])
async def trigger_agent_investigation(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger the agent to investigate a customer and plan retention."""
    orchestrator = AgentOrchestrator(db)
    
    try:
        # Step 1: Think (Investigate)
        assessment = await orchestrator.investigate_customer(customer_id)
        
        # Step 2: Act (Plan)
        plan = await orchestrator.plan_retention(customer_id, assessment)
        
        return {
            "status": "success",
            "assessment": assessment.model_dump(mode='json'),
            "plan": plan.model_dump(mode='json')
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {str(e)}")
