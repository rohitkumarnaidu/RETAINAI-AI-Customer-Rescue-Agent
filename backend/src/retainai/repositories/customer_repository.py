"""Customer Repository for CRUD operations — Tenant-Isolated Phase 1."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Customer, RiskLevel


class CustomerRepository:
    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id

    def _tenant_filter(self, query):
        if self.tenant_id:
            return query.where(Customer.tenant_id == self.tenant_id)
        return query

    async def get_by_id(self, customer_id: str, tenant_id: Optional[str] = None) -> Optional[Customer]:
        tid = tenant_id or self.tenant_id
        q = select(Customer).where(Customer.id == customer_id)
        if tid:
            q = q.where(Customer.tenant_id == tid)
        res = await self.db.execute(q)
        obj = res.scalar_one_or_none()
        # Fallback: if not found with tenant filter, try without to support legacy rows (nullable)
        if obj is None and tid:
            # Check if customer exists but has null tenant (pre-migration) — allow fallback for backfill period
            res2 = await self.db.execute(select(Customer).where(Customer.id == customer_id))
            fallback = res2.scalar_one_or_none()
            if fallback and fallback.tenant_id is None:
                return fallback
        return obj

    async def list_all(self, tenant_id: Optional[str] = None) -> List[Customer]:
        tid = tenant_id or self.tenant_id
        q = select(Customer).order_by(Customer.name)
        if tid:
            q = q.where(Customer.tenant_id == tid)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def list_all_paginated(
        self,
        limit: int = 100,
        offset: int = 0,
        risk_level: Optional[str] = None,
        segment: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        tenant_id: Optional[str] = None,
    ) -> List[Customer]:
        # Validate sort fields (S19 deterministic sorting)
        allowed_sorts = {"name": Customer.name, "health_score": Customer.health_score, "arr": Customer.arr, "risk_level": Customer.risk_level}
        sort_col = allowed_sorts.get(sort_by, Customer.name)
        order = sort_col.asc() if sort_order.lower() == "asc" else sort_col.desc()
        tid = tenant_id or self.tenant_id
        query = select(Customer)
        if tid:
            query = query.where(Customer.tenant_id == tid)
        if risk_level:
            try:
                query = query.where(Customer.risk_level == RiskLevel(risk_level))
            except Exception:
                pass
        if segment:
            query = query.where(Customer.segment == segment)
        if search:
            like = f"%{search}%"
            from sqlalchemy import or_
            query = query.where(or_(Customer.name.ilike(like), Customer.domain.ilike(like), Customer.id.ilike(like)))
        query = query.order_by(order).limit(limit).offset(offset)
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def list_by_risk(self, risk_level: RiskLevel, tenant_id: Optional[str] = None) -> List[Customer]:
        tid = tenant_id or self.tenant_id
        q = select(Customer).where(Customer.risk_level == risk_level).order_by(Customer.health_score.asc())
        if tid:
            q = q.where(Customer.tenant_id == tid)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def create(self, customer: Customer) -> Customer:
        # Ensure tenant_id is set
        if not customer.tenant_id and self.tenant_id:
            customer.tenant_id = self.tenant_id
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def update_health_and_risk(
        self, customer_id: str, health_score: float, risk_level: RiskLevel, tenant_id: Optional[str] = None
    ) -> Optional[Customer]:
        customer = await self.get_by_id(customer_id, tenant_id=tenant_id or self.tenant_id)
        if customer:
            customer.health_score = round(health_score, 1)
            customer.risk_level = risk_level
            await self.db.commit()
            await self.db.refresh(customer)
        return customer
