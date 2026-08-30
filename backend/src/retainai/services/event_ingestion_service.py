"""Event Ingestion Service for telemetry event processing and signal triggers."""

import hashlib
import logging
from typing import Dict, Any, Optional, Set
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import UsageEvent, SupportTicket, CustomerFeedback, AccountEvent, SystemEventLog, Customer
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.services.customer_service import CustomerService

logger = logging.getLogger("retainai.events")

# In-memory idempotency dedup cache (for single-process demo; in prod use Redis)
_seen_event_hashes: Set[str] = set()
# Event significance threshold: at least 10% usage delta or critical support etc triggers reassessment heavy
SIGNIFICANT_EVENT_TYPES = {"SUPPORT_TICKET", "CUSTOMER_FEEDBACK", "USAGE_EVENT", "ACCOUNT_EVENT"}


class EventIngestionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.telemetry_repo = TelemetryRepository(db)
        self.customer_service = CustomerService(db)

    def _compute_event_hash(self, customer_id: str, event_type: str, payload: Dict[str, Any], ts: datetime) -> str:
        """Deterministic hash for idempotency."""
        base = f"{customer_id}:{event_type}:{payload.get('id','')}:{int(ts.timestamp())}"
        # Include payload hash for content dedup
        payload_hash = hashlib.sha256(str(sorted(payload.items())).encode()).hexdigest()[:8]
        return hashlib.sha256(f"{base}:{payload_hash}".encode()).hexdigest()[:16]

    def _is_significant(self, event_type: str, payload: Dict[str, Any], before_health: float, after_health: float) -> bool:
        """Significance check per S32: don't run expensive agent for every insignificant event."""
        delta = abs(after_health - before_health)
        if delta >= 3.0:
            return True
        if event_type == "SUPPORT_TICKET" and payload.get("severity") in ("HIGH","CRITICAL","URGENT"):
            return True
        if event_type == "CUSTOMER_FEEDBACK" and payload.get("sentiment") == "NEGATIVE":
            return True
        if event_type == "USAGE_EVENT" and payload.get("daily_active_users", 9999) < 50:
            return True
        return False

    async def ingest_event(
        self,
        customer_id: str,
        event_type: str,
        payload: Dict[str, Any],
        timestamp: Optional[datetime] = None,
        dedup_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        ts = timestamp or datetime.now(timezone.utc)
        
        # Authorization validation (S39)
        if not customer_id or len(customer_id) > 80:
            raise ValueError(f"Invalid customer_id: {customer_id}")
        if event_type not in SIGNIFICANT_EVENT_TYPES and event_type not in ("INTERVENTION_COMPLETED", "OUTCOME_AVAILABLE", "USAGE_CHANGED", "FEATURE_ADOPTION_CHANGED", "SUPPORT_TICKET_CREATED", "FEEDBACK_RECEIVED", "SENTIMENT_CHANGED", "ACCOUNT_ACTIVITY_CHANGED"):
            logger.warning(f"Unknown event_type {event_type}, treating as generic")

        # Idempotency check (S21 hardened: in-memory + DB persistent via SystemEventLog)
        event_hash = dedup_id or self._compute_event_hash(customer_id, event_type, payload, ts)
        if event_hash in _seen_event_hashes:
            logger.info(f"Duplicate event hash {event_hash} for customer {customer_id} - returning idempotent response (memory)")
            reassessment = await self.customer_service.reassess_customer_risk(customer_id)
            return {
                "status": "duplicate_ignored",
                "customer_id": customer_id,
                "event_type": event_type,
                "event_hash": event_hash,
                "reassessment": reassessment,
            }
        # DB persistent check: event_hash already logged
        try:
            existing = await self.db.execute(select(SystemEventLog.id).where(SystemEventLog.details["event_hash"].as_string() == event_hash).limit(1))  # type: ignore
            if existing.scalar_one_or_none() is not None:
                logger.info(f"Duplicate event hash {event_hash} found in DB - idempotent")
                _seen_event_hashes.add(event_hash)
                reassessment = await self.customer_service.reassess_customer_risk(customer_id)
                return {
                    "status": "duplicate_ignored",
                    "customer_id": customer_id,
                    "event_type": event_type,
                    "event_hash": event_hash,
                    "reassessment": reassessment,
                }
        except Exception:
            pass  # JSON query may not be supported on SQLite, fallback to id field check
        # Also check DB for payload.id duplicates to prevent double-insert of same support/usage record
        if payload.get("id"):
            existing_id = payload["id"]
            try:
                for _model in (UsageEvent, SupportTicket, CustomerFeedback):
                    res = await self.db.execute(select(_model.id).where(_model.id == existing_id).limit(1))
                    if res.scalar_one_or_none() is not None:
                        logger.info(f"Duplicate payload.id {existing_id} already exists - idempotent")
                        _seen_event_hashes.add(event_hash)
                        reassessment = await self.customer_service.reassess_customer_risk(customer_id)
                        return {
                            "status": "duplicate_ignored",
                            "customer_id": customer_id,
                            "event_type": event_type,
                            "event_hash": event_hash,
                            "reassessment": reassessment,
                        }
            except Exception:
                pass

        # Capture pre-reassessment health for significance
        # Fetch current customer health before insertion
        pre_health = 85.0
        try:
            res = await self.db.execute(select(Customer.health_score).where(Customer.id == customer_id))
            val = res.scalar_one_or_none()
            if val is not None:
                pre_health = float(val)
        except Exception:
            pass

        if event_type == "USAGE_EVENT":
            usage = UsageEvent(
                id=payload.get("id") or f"usg_{customer_id[:5]}_{int(ts.timestamp())}",
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

        elif event_type in ("USAGE_CHANGED", "FEATURE_ADOPTION_CHANGED", "SUPPORT_TICKET_CREATED", "FEEDBACK_RECEIVED", "SENTIMENT_CHANGED", "ACCOUNT_ACTIVITY_CHANGED", "INTERVENTION_COMPLETED", "OUTCOME_AVAILABLE"):
            # Generic handler for new spec event types -> treat as underlying telemetry
            # Store as SystemEventLog only, with details
            logger.info(f"Handling generic workflow event {event_type} for {customer_id}")

        import uuid
        # Log system event with deduplication hash
        sys_log = SystemEventLog(
            id=f"log_{uuid.uuid4().hex[:10]}",
            timestamp=ts,
            customer_id=customer_id,
            event_type="EVENT_INGESTED",
            description=f"Ingested {event_type} for customer {customer_id}",
            details={"payload": payload, "event_hash": event_hash},
        )
        self.db.add(sys_log)
        await self.db.commit()
        _seen_event_hashes.add(event_hash)

        # Deterministic Re-assessment Trigger Hook with debouncing via significance check
        reassessment = await self.customer_service.reassess_customer_risk(customer_id)
        is_significant = self._is_significant(event_type, payload, pre_health, reassessment["health_score"])
        # Log whether agent trigger would occur
        trigger_decision = "AGENT_TRIGGER" if is_significant else "DEBOUNCED_MINOR"
        logger.info(f"Event {event_hash} significance={is_significant} pre_health={pre_health} post={reassessment['health_score']} decision={trigger_decision}")

        return {
            "status": "processed",
            "customer_id": customer_id,
            "event_type": event_type,
            "event_hash": event_hash,
            "is_significant": is_significant,
            "trigger_decision": trigger_decision,
            "reassessment": reassessment,
        }
