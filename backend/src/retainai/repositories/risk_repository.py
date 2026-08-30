"""Risk Assessment & Investigation Repository — Tenant-Isolated Phase 1."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import RiskAssessment, InvestigationReport


class RiskRepository:
    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id

    async def create_assessment(self, assessment: RiskAssessment) -> RiskAssessment:
        if not assessment.tenant_id and self.tenant_id:
            assessment.tenant_id = self.tenant_id
        self.db.add(assessment)
        await self.db.commit()
        await self.db.refresh(assessment)
        return assessment

    async def get_latest_assessment(self, customer_id: str, tenant_id: Optional[str] = None) -> Optional[RiskAssessment]:
        tid = tenant_id or self.tenant_id
        q = select(RiskAssessment).where(RiskAssessment.customer_id == customer_id)
        if tid:
            q = q.where((RiskAssessment.tenant_id == tid) | (RiskAssessment.tenant_id.is_(None)))
        q = q.order_by(RiskAssessment.created_at.desc()).limit(1)
        res = await self.db.execute(q)
        return res.scalar_one_or_none()

    async def get_assessment_history(self, customer_id: str, limit: int = 10, tenant_id: Optional[str] = None) -> List[RiskAssessment]:
        tid = tenant_id or self.tenant_id
        q = select(RiskAssessment).where(RiskAssessment.customer_id == customer_id)
        if tid:
            q = q.where((RiskAssessment.tenant_id == tid) | (RiskAssessment.tenant_id.is_(None)))
        q = q.order_by(RiskAssessment.created_at.desc()).limit(limit)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    # Investigation Reports
    async def create_investigation(self, report: InvestigationReport) -> InvestigationReport:
        if not report.tenant_id and self.tenant_id:
            report.tenant_id = self.tenant_id
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        return report

    async def get_latest_investigation(self, customer_id: str, tenant_id: Optional[str] = None) -> Optional[InvestigationReport]:
        tid = tenant_id or self.tenant_id
        q = select(InvestigationReport).where(InvestigationReport.customer_id == customer_id)
        if tid:
            q = q.where((InvestigationReport.tenant_id == tid) | (InvestigationReport.tenant_id.is_(None)))
        q = q.order_by(InvestigationReport.created_at.desc()).limit(1)
        res = await self.db.execute(q)
        return res.scalar_one_or_none()
