"""Customer Repository for CRUD operations."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Customer, RiskLevel


class CustomerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, customer_id: str) -> Optional[Customer]:
        res = await self.db.execute(select(Customer).where(Customer.id == customer_id))
        return res.scalar_one_or_none()

    async def list_all(self) -> List[Customer]:
        res = await self.db.execute(select(Customer).order_by(Customer.name))
        return list(res.scalars().all())

    async def list_by_risk(self, risk_level: RiskLevel) -> List[Customer]:
        res = await self.db.execute(
            select(Customer).where(Customer.risk_level == risk_level).order_by(Customer.health_score.asc())
        )
        return list(res.scalars().all())

    async def create(self, customer: Customer) -> Customer:
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def update_health_and_risk(
        self, customer_id: str, health_score: float, risk_level: RiskLevel
    ) -> Optional[Customer]:
        customer = await self.get_by_id(customer_id)
        if customer:
            customer.health_score = round(health_score, 1)
            customer.risk_level = risk_level
            await self.db.commit()
            await self.db.refresh(customer)
        return customer
