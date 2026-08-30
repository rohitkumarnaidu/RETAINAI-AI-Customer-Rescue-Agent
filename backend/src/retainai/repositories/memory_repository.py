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
