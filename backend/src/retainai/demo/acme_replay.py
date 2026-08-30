"""Acme Scenario Replay Engine supporting deterministic story steps."""

from typing import Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.db.models import UsageEvent, SupportTicket, Customer
from retainai.services.customer_service import CustomerService
from retainai.services.event_ingestion_service import EventIngestionService
from retainai.engine.learning_engine import LearningEngine


class AcmeReplayEngine:
    def __init__(self, db: AsyncSession, customer_id: str | None = None):
        self.db = db
        self._requested_id = customer_id
        self.service = CustomerService(db)
        self.ingestion = EventIngestionService(db)
        self.learning = LearningEngine(db)

    async def resolve_acme_id(self) -> str:
        if self._requested_id is not None:
            return self._requested_id
        try:
            result = await self.db.execute(select(Customer.id).where(Customer.name.ilike("%acme%")).limit(1))
            acme_id = result.scalars().first()
            if acme_id is not None:
                return str(acme_id)
        except Exception:
            pass
        return "b2a88551-82e5-43d7-b620-ba1640900c71"

    async def step_healthy_baseline(self) -> Dict[str, Any]:
        """Phase 1: Healthy Baseline (DAU: 120+, 0 tickets, positive sentiment)."""
        cid = await self.resolve_acme_id()
        now = datetime.now(timezone.utc)
        for i in range(25):
            ts = now - timedelta(days=30 - i)
            usage = UsageEvent(
                id=f"acme_usg_base_{i}",
                customer_id=cid,
                timestamp=ts,
                daily_active_users=125 + (i % 5),
                license_utilization=0.88,
                feature_clicks=450,
                sessions=320,
            )
            self.db.add(usage)

        await self.db.commit()
        return await self.service.reassess_customer_risk(cid)

    async def step_inject_friction(self) -> Dict[str, Any]:
        """Phase 2: Emerging Friction (CSV Export bug, CSAT score 2, DAU drops to 42)."""
        cid = await self.resolve_acme_id()
        now = datetime.now(timezone.utc)

        # Add unresolved ticket
        await self.ingestion.ingest_event(
            customer_id=cid,
            event_type="SUPPORT_TICKET",
            payload={
                "id": "TICK-101",
                "severity": "HIGH",
                "category": "BUG",
                "subject": "CSV Export fails for datasets > 10,000 rows",
                "description": "Export feature times out during month-end executive reporting.",
                "status": "OPEN",
            },
            timestamp=now - timedelta(days=5),
        )

        # Add negative feedback
        await self.ingestion.ingest_event(
            customer_id=cid,
            event_type="CUSTOMER_FEEDBACK",
            payload={
                "id": "FEED-201",
                "source": "CSAT_SURVEY",
                "sentiment": "NEGATIVE",
                "sentiment_score": -0.85,
                "score": 2,
                "text": "Reporting export failure prevented our team from generating end-of-month executive decks.",
            },
            timestamp=now - timedelta(days=3),
        )

        # Ingest dropped usage
        for i in range(5):
            ts = now - timedelta(days=5 - i)
            await self.ingestion.ingest_event(
                customer_id=cid,
                event_type="USAGE_EVENT",
                payload={
                    "daily_active_users": 42,
                    "license_utilization": 0.32,
                    "feature_clicks": 80,
                    "sessions": 50,
                },
                timestamp=ts,
            )

        return await self.service.reassess_customer_risk(cid)

    async def step_post_intervention_recovery(self, intervention_id: str) -> Dict[str, Any]:
        """Phase 5: Post-Intervention Recovery (Usage rebounds to 118, health score recovers)."""
        cid = await self.resolve_acme_id()
        now = datetime.now(timezone.utc)

        # Ingest recovered usage
        for i in range(7):
            ts = now + timedelta(days=i + 1)
            await self.ingestion.ingest_event(
                customer_id=cid,
                event_type="USAGE_EVENT",
                payload={
                    "daily_active_users": 118 + (i % 3),
                    "license_utilization": 0.86,
                    "feature_clicks": 420,
                    "sessions": 300,
                },
                timestamp=ts,
            )

        # Resolve ticket
        ticket_res = await self.db.get(SupportTicket, "TICK-101") if hasattr(self.db, "get") else None
        if ticket_res:
            ticket_res.status = "RESOLVED"
            ticket_res.resolved_at = now
            await self.db.commit()

        reassessment = await self.service.reassess_customer_risk(cid)

        # Record intervention outcome
        outcome = await self.learning.evaluate_intervention_outcome(
            intervention_id=intervention_id,
            health_before=38.0,
            health_after=reassessment["health_score"],
            usage_before=42.0,
            usage_after=118.0,
            customer_response="Engineering patch deployed. Acme team confirmed CSV export fix.",
            notes="Successful rescue story completed.",
        )

        return {
            "reassessment": reassessment,
            "outcome_status": outcome.status.value,
            "health_delta": outcome.health_delta,
        }
