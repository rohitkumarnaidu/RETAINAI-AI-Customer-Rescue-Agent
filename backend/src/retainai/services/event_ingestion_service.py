"""Event Ingestion Service for telemetry event processing and signal triggers."""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.db.models import UsageEvent, SupportTicket, CustomerFeedback, AccountEvent, SystemEventLog
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.services.customer_service import CustomerService


class EventIngestionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.telemetry_repo = TelemetryRepository(db)
        self.customer_service = CustomerService(db)

    async def ingest_event(
        self,
        customer_id: str,
        event_type: str,
        payload: Dict[str, Any],
        timestamp: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        ts = timestamp or datetime.now(timezone.utc)

        if event_type == "USAGE_EVENT":
            usage = UsageEvent(
                id=f"usg_{customer_id[:5]}_{int(ts.timestamp())}",
                customer_id=customer_id,
                timestamp=ts,
                daily_active_users=payload.get("daily_active_users", 0),
                license_utilization=payload.get("license_utilization", 0.0),
                feature_clicks=payload.get("feature_clicks", 0),
                sessions=payload.get("sessions", 0),
                usage_minutes=payload.get("usage_minutes", 0.0),
            )
            await self.telemetry_repo.add_usage_event(usage)

        elif event_type == "SUPPORT_TICKET":
            ticket = SupportTicket(
                id=payload.get("id") or f"tck_{customer_id[:5]}_{int(ts.timestamp())}",
                customer_id=customer_id,
                created_at=ts,
                severity=payload.get("severity", "MEDIUM"),
                category=payload.get("category", "BUG"),
                subject=payload.get("subject", "Support Ticket"),
                description=payload.get("description", ""),
                status=payload.get("status", "OPEN"),
                csat=payload.get("csat"),
            )
            await self.telemetry_repo.add_support_ticket(ticket)

        elif event_type == "CUSTOMER_FEEDBACK":
            fb = CustomerFeedback(
                id=payload.get("id") or f"fb_{customer_id[:5]}_{int(ts.timestamp())}",
                customer_id=customer_id,
                created_at=ts,
                source=payload.get("source", "CSAT_SURVEY"),
                sentiment=payload.get("sentiment", "NEUTRAL"),
                sentiment_score=payload.get("sentiment_score", 0.0),
                text=payload.get("text", ""),
                category=payload.get("category", "GENERAL"),
            )
            await self.telemetry_repo.add_feedback(fb)

        elif event_type == "ACCOUNT_EVENT":
            evt = AccountEvent(
                id=f"acct_{customer_id[:5]}_{int(ts.timestamp())}",
                customer_id=customer_id,
                timestamp=ts,
                event_type=payload.get("event_type", "GENERIC_EVENT"),
                description=payload.get("description", "Account Event"),
                metadata_json=payload.get("metadata", {}),
            )
            await self.telemetry_repo.add_account_event(evt)

        import uuid
        # Log system event
        sys_log = SystemEventLog(
            id=f"log_{uuid.uuid4().hex[:10]}",
            timestamp=ts,
            customer_id=customer_id,
            event_type="EVENT_INGESTED",
            description=f"Ingested {event_type} for customer {customer_id}",
            details={"payload": payload},
        )
        self.db.add(sys_log)
        await self.db.commit()

        # Deterministic Re-assessment Trigger Hook
        reassessment = await self.customer_service.reassess_customer_risk(customer_id)

        return {
            "status": "processed",
            "customer_id": customer_id,
            "event_type": event_type,
            "reassessment": reassessment,
        }
