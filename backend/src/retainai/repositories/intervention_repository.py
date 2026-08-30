"""Intervention & Outcome Repository — Tenant-Isolated Phase 1."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Intervention, InterventionOutcome, InterventionStatus


class InterventionRepository:
    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id

    async def create_intervention(self, intervention: Intervention) -> Intervention:
        if not intervention.tenant_id and self.tenant_id:
            intervention.tenant_id = self.tenant_id
        self.db.add(intervention)
        await self.db.commit()
        await self.db.refresh(intervention)
        return intervention

    async def get_by_id(self, intervention_id: str, tenant_id: Optional[str] = None) -> Optional[Intervention]:
        tid = tenant_id or self.tenant_id
        q = select(Intervention).where(Intervention.id == intervention_id)
        if tid:
            q = q.where((Intervention.tenant_id == tid) | (Intervention.tenant_id.is_(None)))
        res = await self.db.execute(q)
        return res.scalar_one_or_none()

    async def get_customer_interventions(self, customer_id: str, tenant_id: Optional[str] = None) -> List[Intervention]:
        tid = tenant_id or self.tenant_id
        q = select(Intervention).where(Intervention.customer_id == customer_id)
        if tid:
            q = q.where((Intervention.tenant_id == tid) | (Intervention.tenant_id.is_(None)))
        q = q.order_by(Intervention.created_at.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def update_status(self, intervention_id: str, status: InterventionStatus, tenant_id: Optional[str] = None) -> Optional[Intervention]:
        intervention = await self.get_by_id(intervention_id, tenant_id=tenant_id)
        if intervention:
            intervention.status = status
            await self.db.commit()
            await self.db.refresh(intervention)
        return intervention

    # Outcomes
    async def create_outcome(self, outcome: InterventionOutcome) -> InterventionOutcome:
        if not outcome.tenant_id and self.tenant_id:
            outcome.tenant_id = self.tenant_id
        self.db.add(outcome)
        await self.db.commit()
        await self.db.refresh(outcome)
        return outcome

    async def get_outcome_by_intervention(self, intervention_id: str, tenant_id: Optional[str] = None) -> Optional[InterventionOutcome]:
        tid = tenant_id or self.tenant_id
        q = select(InterventionOutcome).where(InterventionOutcome.intervention_id == intervention_id)
        if tid:
            q = q.where((InterventionOutcome.tenant_id == tid) | (InterventionOutcome.tenant_id.is_(None)))
        res = await self.db.execute(q)
        return res.scalar_one_or_none()
