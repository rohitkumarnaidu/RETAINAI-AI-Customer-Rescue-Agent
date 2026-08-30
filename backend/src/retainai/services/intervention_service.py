"""Intervention Service for lifecycle action management."""

from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.db.models import Intervention, InterventionStatus
from retainai.repositories.intervention_repository import InterventionRepository


class InterventionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.intervention_repo = InterventionRepository(db)

    async def get_customer_interventions(self, customer_id: str) -> List[Intervention]:
        return await self.intervention_repo.get_customer_interventions(customer_id)

    async def create_intervention(self, intervention: Intervention) -> Intervention:
        return await self.intervention_repo.create_intervention(intervention)

    async def approve_intervention(self, intervention_id: str, approved_by: str = "CSM") -> Optional[Intervention]:
        intervention = await self.intervention_repo.get_by_id(intervention_id)
        if intervention:
            intervention.status = InterventionStatus.APPROVED
            intervention.approved_at = datetime.now(timezone.utc)
            intervention.approved_by = approved_by
            await self.db.commit()
            await self.db.refresh(intervention)
        return intervention

    async def reject_intervention(self, intervention_id: str, reason: Optional[str] = None) -> Optional[Intervention]:
        intervention = await self.intervention_repo.get_by_id(intervention_id)
        if intervention:
            intervention.status = InterventionStatus.REJECTED
            await self.db.commit()
            await self.db.refresh(intervention)
        return intervention
