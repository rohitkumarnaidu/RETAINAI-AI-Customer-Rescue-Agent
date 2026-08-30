"""Experience Memory Repository."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import ExperienceMemory, ValidationStatus


class MemoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_memory(self, memory: ExperienceMemory) -> ExperienceMemory:
        self.db.add(memory)
        await self.db.commit()
        await self.db.refresh(memory)
        return memory

    async def get_validated_memories(self, customer_segment: Optional[str] = None) -> List[ExperienceMemory]:
        query = select(ExperienceMemory).where(ExperienceMemory.validation_status == ValidationStatus.VALIDATED)
        if customer_segment:
            query = query.where(ExperienceMemory.customer_segment == customer_segment)
        query = query.order_by(ExperienceMemory.confidence.desc())
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def list_all(self) -> List[ExperienceMemory]:
        res = await self.db.execute(select(ExperienceMemory).order_by(ExperienceMemory.updated_at.desc()))
        return list(res.scalars().all())

    async def get_by_pattern(self, pattern: str) -> Optional[ExperienceMemory]:
        res = await self.db.execute(select(ExperienceMemory).where(ExperienceMemory.pattern == pattern).limit(1))
        return res.scalar_one_or_none()

    async def get_candidates(self, status: str = "PENDING_VALIDATION") -> List[ExperienceMemory]:
        # For ExperienceMemory candidates, query by validation_status CANDIDATE
        res = await self.db.execute(select(ExperienceMemory).where(ExperienceMemory.validation_status == ValidationStatus.CANDIDATE).order_by(ExperienceMemory.created_at.desc()))
        return list(res.scalars().all())

    async def get_by_id(self, memory_id: str) -> Optional[ExperienceMemory]:
        res = await self.db.execute(select(ExperienceMemory).where(ExperienceMemory.id == memory_id))
        return res.scalar_one_or_none()

    async def decay_stale_memories(self, days_threshold: int = 90):
        """Mark stale memories where last_observed older than threshold."""
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_threshold)
        res = await self.db.execute(select(ExperienceMemory).where(ExperienceMemory.last_observed < cutoff, ExperienceMemory.validation_status == ValidationStatus.VALIDATED))
        stale = list(res.scalars().all())
        for m in stale:
            m.validation_status = ValidationStatus.STALE
            m.status = "STALE"
        if stale:
            await self.db.commit()
        return stale
