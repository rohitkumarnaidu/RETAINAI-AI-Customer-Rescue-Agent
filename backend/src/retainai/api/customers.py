"""Customer endpoints for RETAINAI."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from retainai.db.session import get_db
from retainai.db.models import Customer, RiskAssessment, Intervention
from retainai.models.schemas import CustomerSchema, RiskAssessmentSchema, InterventionSchema

router = APIRouter(prefix="/api/v1/customers", tags=["Customers"])


@router.get("/", response_model=List[CustomerSchema])
async def list_customers(db: AsyncSession = Depends(get_db)):
    """List all customers in the portfolio."""
    result = await db.execute(select(Customer))
    return result.scalars().all()


@router.get("/{customer_id}", response_model=CustomerSchema)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific customer by ID."""
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/{customer_id}/risk", response_model=List[RiskAssessmentSchema])
async def get_customer_risk(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get risk assessments for a customer."""
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.customer_id == customer_id)
        .order_by(RiskAssessment.timestamp.desc())
    )
    return result.scalars().all()


@router.get("/{customer_id}/interventions", response_model=List[InterventionSchema])
async def get_customer_interventions(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Get interventions for a customer."""
    result = await db.execute(
        select(Intervention)
        .where(Intervention.customer_id == customer_id)
        .order_by(Intervention.created_at.desc())
    )
    return result.scalars().all()
