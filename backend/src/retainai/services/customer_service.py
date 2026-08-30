"""Customer Service coordinating account retrieval, health assessment, and risk updates."""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.db.models import Customer, RiskAssessment
from retainai.repositories.customer_repository import CustomerRepository
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.repositories.risk_repository import RiskRepository
from retainai.engine.signal_engine import SignalEngine
from retainai.engine.health_engine import HealthEngine
from retainai.engine.risk_engine import RiskEngine


class CustomerService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.customer_repo = CustomerRepository(db)
        self.telemetry_repo = TelemetryRepository(db)
        self.risk_repo = RiskRepository(db)

    async def list_customers() -> List[Customer]:
        return await self.customer_repo.list_all()

    async def get_customer(self, customer_id: str) -> Optional[Customer]:
        return await self.customer_repo.get_by_id(customer_id)

    async def reassess_customer_risk(self, customer_id: str) -> Dict[str, Any]:
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer:
            raise ValueError(f"Customer {customer_id} not found")

        usage = await self.telemetry_repo.get_usage_events(customer_id, days=30)
        tickets = await self.telemetry_repo.get_support_tickets(customer_id, days=30)
        feedback = await self.telemetry_repo.get_feedback_entries(customer_id, days=30)
        events = await self.telemetry_repo.get_account_events(customer_id, days=30)

        total_points = len(usage) + len(tickets) + len(feedback) + len(events)

        signals = SignalEngine.evaluate_all_signals(usage, tickets, feedback, events)
        health = HealthEngine.compute_health_components(signals)
        risk_res = RiskEngine.evaluate_risk(health, signals, total_points)

        # Update customer state in database
        await self.customer_repo.update_health_and_risk(customer_id, health.overall_health, risk_res.risk_level)

        import uuid
        # Store historical risk assessment
        assessment = RiskAssessment(
            id=f"risk_{customer_id[:5]}_{uuid.uuid4().hex[:8]}",
            customer_id=customer_id,
            health_score=health.overall_health,
            risk_level=risk_res.risk_level,
            usage_health=health.usage_health,
            support_health=health.support_health,
            sentiment_health=health.sentiment_health,
            engagement_health=health.engagement_health,
            detected_signals=risk_res.detected_signals,
            confidence=risk_res.confidence,
        )
        await self.risk_repo.create_assessment(assessment)

        return {
            "customer_id": customer_id,
            "health_score": health.overall_health,
            "risk_level": risk_res.risk_level.value,
            "risk_score": risk_res.risk_score,
            "confidence": risk_res.confidence,
            "signals": risk_res.detected_signals,
            "health_components": {
                "usage": health.usage_health,
                "support": health.support_health,
                "sentiment": health.sentiment_health,
                "engagement": health.engagement_health,
            },
            "is_insufficient_data": risk_res.is_insufficient_data,
            "evidence_ids": risk_res.evidence_ids,
        }
