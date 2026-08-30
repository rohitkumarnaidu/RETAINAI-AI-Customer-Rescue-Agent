"""Risk Assessment & Investigation Repository."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import RiskAssessment, InvestigationReport


class RiskRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_assessment(self, assessment: RiskAssessment) -> RiskAssessment:
        self.db.add(assessment)
        await self.db.commit()
        await self.db.refresh(assessment)
        return assessment

    async def get_latest_assessment(self, customer_id: str) -> Optional[RiskAssessment]:
        res = await self.db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.customer_id == customer_id)
            .order_by(RiskAssessment.created_at.desc())
            .limit(1)
        )
        return res.scalar_one_or_none()

    async def get_assessment_history(self, customer_id: str, limit: int = 10) -> List[RiskAssessment]:
        res = await self.db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.customer_id == customer_id)
            .order_by(RiskAssessment.created_at.desc())
            .limit(limit)
        )
        return list(res.scalars().all())

    # Investigation Reports
    async def create_investigation(self, report: InvestigationReport) -> InvestigationReport:
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        return report

    async def get_latest_investigation(self, customer_id: str) -> Optional[InvestigationReport]:
        res = await self.db.execute(
            select(InvestigationReport)
            .where(InvestigationReport.customer_id == customer_id)
            .order_by(InvestigationReport.created_at.desc())
            .limit(1)
        )
        return res.scalar_one_or_none()
