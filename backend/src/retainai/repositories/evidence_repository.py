"""Evidence Repository — Tenant-Isolated Phase 1."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Evidence


class EvidenceRepository:
    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id

    async def add_evidence(self, evidence: Evidence) -> Evidence:
        if not evidence.tenant_id and self.tenant_id:
            evidence.tenant_id = self.tenant_id
        self.db.add(evidence)
        await self.db.commit()
        await self.db.refresh(evidence)
        return evidence

    async def get_customer_evidences(self, customer_id: str, tenant_id: Optional[str] = None) -> List[Evidence]:
        tid = tenant_id or self.tenant_id
        q = select(Evidence).where(Evidence.customer_id == customer_id).order_by(Evidence.timestamp.desc())
        if tid:
            q = q.where((Evidence.tenant_id == tid) | (Evidence.tenant_id.is_(None)))
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def get_by_ids(self, evidence_ids: List[str], tenant_id: Optional[str] = None) -> List[Evidence]:
        if not evidence_ids:
            return []
        tid = tenant_id or self.tenant_id
        q = select(Evidence).where(Evidence.id.in_(evidence_ids))
        if tid:
            q = q.where((Evidence.tenant_id == tid) | (Evidence.tenant_id.is_(None)))
        res = await self.db.execute(q)
        return list(res.scalars().all())
