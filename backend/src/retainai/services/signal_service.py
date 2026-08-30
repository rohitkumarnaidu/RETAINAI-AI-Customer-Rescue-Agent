"""Signal Service for signal detection API endpoints."""

from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.engine.signal_engine import SignalEngine


class SignalService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.telemetry_repo = TelemetryRepository(db)

    async def get_customer_signals(self, customer_id: str) -> List[Dict[str, Any]]:
        usage = await self.telemetry_repo.get_usage_events(customer_id, days=30)
        tickets = await self.telemetry_repo.get_support_tickets(customer_id, days=30)
        feedback = await self.telemetry_repo.get_feedback_entries(customer_id, days=30)
        events = await self.telemetry_repo.get_account_events(customer_id, days=30)

        signals = SignalEngine.evaluate_all_signals(usage, tickets, feedback, events)
        return [
            {
                "signal_type": s.signal_type,
                "category": s.category,
                "severity": s.severity,
                "value": s.value,
                "baseline": s.baseline,
                "delta_pct": s.delta_pct,
                "summary": s.summary,
                "evidence_ids": s.evidence_ids,
                "impact_score": s.impact_score,
            }
            for s in signals
        ]
