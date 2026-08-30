"""Intervention & Outcome Repository."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Intervention, InterventionOutcome, InterventionStatus


class InterventionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_intervention(self, intervention: Intervention) -> Intervention:
        self.db.add(intervention)
        await self.db.commit()
        await self.db.refresh(intervention)
        return intervention

    async def get_by_id(self, intervention_id: str) -> Optional[Intervention]:
        res = await self.db.execute(select(Intervention).where(Intervention.id == intervention_id))
        return res.scalar_one_or_none()

    async def get_customer_interventions(self, customer_id: str) -> List[Intervention]:
        res = await self.db.execute(
            select(Intervention)
            .where(Intervention.customer_id == customer_id)
            .order_by(Intervention.created_at.desc())
        )
        return list(res.scalars().all())

    async def update_status(self, intervention_id: str, status: InterventionStatus) -> Optional[Intervention]:
        intervention = await self.get_by_id(intervention_id)
        if intervention:
            intervention.status = status
            await self.db.commit()
            await self.db.refresh(intervention)
        return intervention

    # Outcomes
    async def create_outcome(self, outcome: InterventionOutcome) -> InterventionOutcome:
        self.db.add(outcome)
        await self.db.commit()
        await self.db.refresh(outcome)
        return outcome

    async def get_outcome_by_intervention(self, intervention_id: str) -> Optional[InterventionOutcome]:
        res = await self.db.execute(
            select(InterventionOutcome).where(InterventionOutcome.intervention_id == intervention_id)
        )
        return res.scalar_one_or_none()
