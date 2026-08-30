"""Experience Memory Repository — Tenant-Isolated Phase 1."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import ExperienceMemory, ValidationStatus


class MemoryRepository:
    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id

    async def add_memory(self, memory: ExperienceMemory) -> ExperienceMemory:
        if not memory.tenant_id and self.tenant_id:
            memory.tenant_id = self.tenant_id
        self.db.add(memory)
        await self.db.commit()
        await self.db.refresh(memory)
        return memory

    async def get_validated_memories(self, customer_segment: Optional[str] = None, tenant_id: Optional[str] = None) -> List[ExperienceMemory]:
        tid = tenant_id or self.tenant_id
        query = select(ExperienceMemory).where(ExperienceMemory.validation_status == ValidationStatus.VALIDATED)
        if tid:
            query = query.where(ExperienceMemory.tenant_id == tid)
        if customer_segment:
            query = query.where(ExperienceMemory.customer_segment == customer_segment)
        query = query.order_by(ExperienceMemory.confidence.desc())
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def list_all(self, tenant_id: Optional[str] = None) -> List[ExperienceMemory]:
        tid = tenant_id or self.tenant_id
        q = select(ExperienceMemory).order_by(ExperienceMemory.updated_at.desc())
        if tid:
            q = q.where(ExperienceMemory.tenant_id == tid)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def get_by_pattern(self, pattern: str, tenant_id: Optional[str] = None) -> Optional[ExperienceMemory]:
        tid = tenant_id or self.tenant_id
        q = select(ExperienceMemory).where(ExperienceMemory.pattern == pattern)
        if tid:
            q = q.where(ExperienceMemory.tenant_id == tid)
        q = q.limit(1)
        res = await self.db.execute(q)
        return res.scalar_one_or_none()

    async def get_candidates(self, status: str = "PENDING_VALIDATION", tenant_id: Optional[str] = None) -> List[ExperienceMemory]:
        tid = tenant_id or self.tenant_id
        q = select(ExperienceMemory).where(ExperienceMemory.validation_status == ValidationStatus.CANDIDATE)
        if tid:
            q = q.where(ExperienceMemory.tenant_id == tid)
        q = q.order_by(ExperienceMemory.created_at.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def get_by_id(self, memory_id: str, tenant_id: Optional[str] = None) -> Optional[ExperienceMemory]:
        tid = tenant_id or self.tenant_id
        q = select(ExperienceMemory).where(ExperienceMemory.id == memory_id)
        if tid:
            q = q.where(ExperienceMemory.tenant_id == tid)
        res = await self.db.execute(q)
        return res.scalar_one_or_none()

    async def decay_stale_memories(self, days_threshold: int = 90, tenant_id: Optional[str] = None):
        """Mark stale memories where last_observed older than threshold."""
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_threshold)
        tid = tenant_id or self.tenant_id
        q = select(ExperienceMemory).where(ExperienceMemory.last_observed < cutoff, ExperienceMemory.validation_status == ValidationStatus.VALIDATED)
        if tid:
            q = q.where(ExperienceMemory.tenant_id == tid)
        res = await self.db.execute(q)
        stale = list(res.scalars().all())
        for m in stale:
            m.validation_status = ValidationStatus.STALE
            m.status = "STALE"
        if stale:
            await self.db.commit()
        return stale
