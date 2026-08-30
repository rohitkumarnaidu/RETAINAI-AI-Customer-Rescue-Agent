"""FastAPI REST API Routes for RETAINAI Customer Retention Platform."""

import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from retainai.db.session import get_db
from retainai.db.models import Customer, Intervention, InterventionStatus, InterventionOutcome
from retainai.repositories.customer_repository import CustomerRepository
from retainai.repositories.evidence_repository import EvidenceRepository
from retainai.repositories.memory_repository import MemoryRepository
from retainai.services.customer_service import CustomerService
from retainai.services.signal_service import SignalService
from retainai.services.timeline_service import TimelineService
from retainai.services.intervention_service import InterventionService
from retainai.services.event_ingestion_service import EventIngestionService
from retainai.engine.learning_engine import LearningEngine
from retainai.models.schemas import (
    CustomerSchema,
    EventIngestRequest,
    InterventionCreateRequest,
    InterventionSchema,
    OutcomeCreateRequest,
    OutcomeSchema,
    ExperienceMemorySchema,
)

from retainai.scripts.seed_database import seed_demo_data

router = APIRouter(prefix="/api/v1")


@router.post("/system/reset")
async def reset_demo_database():
    """Reset and re-seed database with all 101 dataset benchmark accounts."""
    try:
        await seed_demo_data()
        return {"status": "success", "message": "Database reset and re-seeded with 101 customers successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database reset failed: {str(e)}")


@router.get("/customers", response_model=List[CustomerSchema])
async def list_customers(db: AsyncSession = Depends(get_db)):
    """List all customers sorted by name."""
    repo = CustomerRepository(db)
    return await repo.list_all()


@router.get("/customers/{customer_id}", response_model=CustomerSchema)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get customer by ID."""
    repo = CustomerRepository(db)
    customer = await repo.get_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/customers/{customer_id}/timeline")
async def get_customer_timeline(customer_id: str, days: int = 60, db: AsyncSession = Depends(get_db)):
    """Get unified chronological customer timeline."""
    service = TimelineService(db)
    return await service.get_unified_timeline(customer_id, days=days)


@router.get("/customers/{customer_id}/signals")
async def get_customer_signals(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get current detected churn signals for customer."""
    service = SignalService(db)
    return await service.get_customer_signals(customer_id)


@router.get("/customers/{customer_id}/risk")
async def get_customer_risk(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get deterministic risk assessment for customer."""
    service = CustomerService(db)
    return await service.reassess_customer_risk(customer_id)


@router.post("/customers/{customer_id}/reassess")
async def reassess_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger deterministic health score & risk re-assessment."""
    service = CustomerService(db)
    try:
        return await service.reassess_customer_risk(customer_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/customers/{customer_id}/evidence")
async def get_customer_evidence(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get supporting evidence records for customer."""
    repo = EvidenceRepository(db)
    return await repo.get_customer_evidences(customer_id)


@router.post("/events")
async def ingest_event(req: EventIngestRequest, db: AsyncSession = Depends(get_db)):
    """Event Ingestion Endpoint: Ingests event, calculates signals, and triggers reassessment."""
    service = EventIngestionService(db)
    return await service.ingest_event(
        customer_id=req.customer_id,
        event_type=req.event_type,
        payload=req.payload,
        timestamp=req.timestamp,
    )


@router.get("/customers/{customer_id}/interventions", response_model=List[InterventionSchema])
async def get_interventions(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get interventions for customer."""
    service = InterventionService(db)
    return await service.get_customer_interventions(customer_id)


@router.post("/interventions", response_model=InterventionSchema)
async def create_intervention(req: InterventionCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create new intervention proposed plan."""
    service = InterventionService(db)
    inv = Intervention(
        id=f"inv_{req.customer_id[:8]}_{uuid.uuid4().hex[:8]}",
        customer_id=req.customer_id,
        investigation_id=req.investigation_id,
        action_type=req.action_type,
        title=req.title,
        description=req.description,
        plan=req.plan,
        status=InterventionStatus.PROPOSED,
    )
    return await service.create_intervention(inv)


@router.post("/interventions/{intervention_id}/approve", response_model=InterventionSchema)
async def approve_intervention(intervention_id: str, approved_by: str = "CSM", db: AsyncSession = Depends(get_db)):
    """Approve an intervention plan."""
    service = InterventionService(db)
    inv = await service.approve_intervention(intervention_id, approved_by=approved_by)
    if not inv:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return inv


@router.post("/interventions/{intervention_id}/outcome", response_model=OutcomeSchema)
async def record_outcome(intervention_id: str, req: OutcomeCreateRequest, db: AsyncSession = Depends(get_db)):
    """Record intervention outcome and trigger learning validation gate."""
    engine = LearningEngine(db)
    # Support both path param and body field; body field is now optional
    effective_id = req.intervention_id or intervention_id
    return await engine.evaluate_intervention_outcome(
        intervention_id=effective_id,
        health_before=req.health_before,
        health_after=req.health_after,
        usage_before=req.usage_before,
        usage_after=req.usage_after,
        customer_response=req.customer_response,
        notes=req.notes,
    )


@router.get("/portfolio")
async def get_portfolio_summary(db: AsyncSession = Depends(get_db)):
    """Portfolio Summary View."""
    customer_repo = CustomerRepository(db)
    customers = await customer_repo.list_all()

    arr_at_risk = sum(c.arr for c in customers if c.risk_level in ("CRITICAL", "HIGH_RISK", "AT_RISK"))
    risk_distribution = {}
    for c in customers:
        risk_distribution[c.risk_level.value] = risk_distribution.get(c.risk_level.value, 0) + 1

    return {
        "metrics": {
            "total_customers": len(customers),
            "arr_at_risk": arr_at_risk,
            "risk_distribution": risk_distribution,
        },
        "customers": customers,
    }


@router.get("/learning/memories", response_model=List[ExperienceMemorySchema])
async def list_experience_memories(db: AsyncSession = Depends(get_db)):
    """List Experience Memory bank."""
    repo = MemoryRepository(db)
    return await repo.list_all()


@router.get("/experience-memory", response_model=List[ExperienceMemorySchema])
async def list_experience_memories_alias(db: AsyncSession = Depends(get_db)):
    repo = MemoryRepository(db)
    return await repo.list_all()


@router.get("/interventions", response_model=List[InterventionSchema])
async def list_all_interventions(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Intervention).order_by(Intervention.created_at.desc()))
    return list(res.scalars().all())


@router.get("/outcomes", response_model=List[OutcomeSchema])
async def list_all_outcomes(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InterventionOutcome).order_by(InterventionOutcome.created_at.desc()))
    return list(res.scalars().all())
