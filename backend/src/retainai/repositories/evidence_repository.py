"""Evidence Repository."""

from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Evidence


class EvidenceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_evidence(self, evidence: Evidence) -> Evidence:
        self.db.add(evidence)
        await self.db.commit()
        await self.db.refresh(evidence)
        return evidence

    async def get_customer_evidences(self, customer_id: str) -> List[Evidence]:
        res = await self.db.execute(
            select(Evidence).where(Evidence.customer_id == customer_id).order_by(Evidence.timestamp.desc())
        )
        return list(res.scalars().all())

    async def get_by_ids(self, evidence_ids: List[str]) -> List[Evidence]:
        if not evidence_ids:
            return []
        res = await self.db.execute(select(Evidence).where(Evidence.id.in_(evidence_ids)))
        return list(res.scalars().all())
