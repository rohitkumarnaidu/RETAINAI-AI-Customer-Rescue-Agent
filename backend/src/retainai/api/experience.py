"""Experience Memory & Action Center API Endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from retainai.db.session import get_db
from retainai.db.models import ExperienceMemory, Intervention, InterventionOutcome
from retainai.models.schemas import ExperienceMemorySchema, InterventionSchema, OutcomeSchema as InterventionOutcomeSchema

router = APIRouter(prefix="/api/v1", tags=["Experience & Actions"])


@router.get("/experience-memory", response_model=List[ExperienceMemorySchema])
async def list_experience_memory(db: AsyncSession = Depends(get_db)):
    """List all experience memories (learned insights)."""
    # Orphaned route legacy: last_updated is actually updated_at; use updated_at for ordering
    result = await db.execute(select(ExperienceMemory).order_by(ExperienceMemory.updated_at.desc()))
    return result.scalars().all()


@router.get("/interventions", response_model=List[InterventionSchema])
async def list_all_interventions(db: AsyncSession = Depends(get_db)):
    """List all interventions across all customers."""
    result = await db.execute(select(Intervention).order_by(Intervention.created_at.desc()))
    return result.scalars().all()


@router.get("/outcomes", response_model=List[InterventionOutcomeSchema])
async def list_all_outcomes(db: AsyncSession = Depends(get_db)):
    """List all intervention outcomes."""
    result = await db.execute(select(InterventionOutcome).order_by(InterventionOutcome.evaluated_at.desc()))
    return result.scalars().all()
