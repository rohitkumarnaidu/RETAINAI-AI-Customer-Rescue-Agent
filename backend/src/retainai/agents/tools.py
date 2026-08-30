"""Agent Tools & Service Contracts — Connects Agent Reasoning to Deterministic Repositories."""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.repositories.customer_repository import CustomerRepository
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.repositories.memory_repository import MemoryRepository
from retainai.services.signal_service import SignalService


class AgentTools:
    """Deterministic Tool Contracts exposed to Agent Orchestrator."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.customer_repo = CustomerRepository(session)
        self.telemetry_repo = TelemetryRepository(session)
        self.memory_repo = MemoryRepository(session)
        self.signal_service = SignalService(session)

    async def get_customer_profile(self, customer_id: str) -> Dict[str, Any]:
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer:
            return {"error": f"Customer {customer_id} not found."}
        return {
            "id": customer.id,
            "name": customer.name,
            "domain": customer.domain,
            "segment": customer.segment,
            "industry": customer.industry,
            "mrr": customer.mrr,
            "arr": customer.arr,
            "csm": customer.csm_name,
            "csm_email": customer.csm_email,
            "health_score": customer.health_score,
            "risk_level": customer.risk_level.value if hasattr(customer.risk_level, "value") else str(customer.risk_level),
            "is_false_positive_candidate": customer.is_false_positive_candidate,
        }

    async def search_customer_evidence(self, customer_id: str, days: int = 30) -> Dict[str, Any]:
        """Queries telemetry across all sources for evidence synthesis."""
        usage = await self.telemetry_repo.get_usage_events(customer_id, days=days)
        tickets = await self.telemetry_repo.get_support_tickets(customer_id, days=days)
        feedback = await self.telemetry_repo.get_feedback_entries(customer_id, days=days)
        events = await self.telemetry_repo.get_account_events(customer_id, days=days)

        return {
            "usage_events": [
                {
                    "id": u.id,
                    "date": str(u.timestamp.date()),
                    "dau": u.daily_active_users,
                    "license_utilization": u.license_utilization,
                }
                for u in usage
            ],
            "support_tickets": [
                {
                    "id": t.id,
                    "severity": t.severity,
                    "category": t.category,
                    "subject": t.subject,
                    "status": t.status,
                    "description": t.description,
                }
                for t in tickets
            ],
            "feedback_entries": [
                {
                    "id": f.id,
                    "source": f.source,
                    "sentiment": f.sentiment,
                    "score": f.score,
                    "text": f.text,
                }
                for f in feedback
            ],
            "account_events": [
                {
                    "id": e.id,
                    "event_type": e.event_type,
                    "description": e.description,
                }
                for e in events
            ],
        }

    async def calculate_customer_signals(self, customer_id: str) -> List[Dict[str, Any]]:
        return await self.signal_service.get_customer_signals(customer_id)

    async def query_experience_memory(self, segment: str, risk_pattern: str) -> List[Dict[str, Any]]:
        memories = await self.memory_repo.get_validated_memories(customer_segment=segment)
        return [
            {
                "id": m.id,
                "customer_segment": m.customer_segment,
                "risk_pattern": m.risk_pattern,
                "signals": m.signals,
                "recommended_strategy": m.recommended_strategy,
                "confidence": m.confidence,
                "observed_outcome": m.observed_outcome,
            }
            for m in memories
        ]
