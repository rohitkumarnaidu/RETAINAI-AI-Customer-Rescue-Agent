"""Unified Customer Timeline Service aggregating chronological events across all sources."""

from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.repositories.risk_repository import RiskRepository
from retainai.repositories.intervention_repository import InterventionRepository


class TimelineService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.telemetry_repo = TelemetryRepository(db)
        self.risk_repo = RiskRepository(db)
        self.intervention_repo = InterventionRepository(db)

    async def get_unified_timeline(self, customer_id: str, days: int = 60) -> List[Dict[str, Any]]:
        timeline_items: List[Dict[str, Any]] = []

        # 1. Usage Events
        usage = await self.telemetry_repo.get_usage_events(customer_id, days=days)
        for u in usage:
            timeline_items.append(
                {
                    "id": u.id,
                    "timestamp": u.timestamp.isoformat(),
                    "source": "USAGE",
                    "event_type": u.event_type,
                    "title": f"DAU: {u.daily_active_users} (License Util: {u.license_utilization * 100:.0f}%)",
                    "details": {
                        "daily_active_users": u.daily_active_users,
                        "license_utilization": u.license_utilization,
                        "feature_clicks": u.feature_clicks,
                    },
                    "severity": "NORMAL" if u.daily_active_users > 50 else "WARNING",
                }
            )

        # 2. Support Tickets
        tickets = await self.telemetry_repo.get_support_tickets(customer_id, days=days)
        for t in tickets:
            timeline_items.append(
                {
                    "id": t.id,
                    "timestamp": t.created_at.isoformat(),
                    "source": "SUPPORT_TICKET",
                    "event_type": f"TICKET_{t.status}",
                    "title": f"[{t.severity}] Support Ticket: {t.subject}",
                    "details": {
                        "status": t.status,
                        "severity": t.severity,
                        "category": t.category,
                        "csat": t.csat,
                        "description": t.description,
                    },
                    "severity": "CRITICAL" if t.severity in ("HIGH", "CRITICAL", "URGENT") else "INFO",
                }
            )

        # 3. Customer Feedback
        feedback = await self.telemetry_repo.get_feedback_entries(customer_id, days=days)
        for f in feedback:
            timeline_items.append(
                {
                    "id": f.id,
                    "timestamp": f.created_at.isoformat(),
                    "source": "FEEDBACK",
                    "event_type": f"FEEDBACK_{f.sentiment}",
                    "title": f"{f.source} ({f.sentiment}): {f.text[:60]}...",
                    "details": {
                        "score": f.score,
                        "sentiment": f.sentiment,
                        "text": f.text,
                    },
                    "severity": "WARNING" if f.sentiment == "NEGATIVE" else "INFO",
                }
            )

        # 4. Account Events
        events = await self.telemetry_repo.get_account_events(customer_id, days=days)
        for e in events:
            timeline_items.append(
                {
                    "id": e.id,
                    "timestamp": e.timestamp.isoformat(),
                    "source": "ACCOUNT_EVENT",
                    "event_type": e.event_type,
                    "title": f"Account Event: {e.description}",
                    "details": e.metadata_json or {},
                    "severity": "INFO",
                }
            )

        # 5. Risk Assessments
        risks = await self.risk_repo.get_assessment_history(customer_id, limit=20)
        for r in risks:
            timeline_items.append(
                {
                    "id": r.id,
                    "timestamp": r.created_at.isoformat(),
                    "source": "RISK_ASSESSMENT",
                    "event_type": f"RISK_{r.risk_level.value}",
                    "title": f"Health Score Re-assessment: {r.health_score:.1f} ({r.risk_level.value})",
                    "details": {
                        "health_score": r.health_score,
                        "risk_level": r.risk_level.value,
                        "signals": r.detected_signals,
                    },
                    "severity": "CRITICAL" if r.risk_level.value in ("CRITICAL", "HIGH_RISK") else "INFO",
                }
            )

        # Sort chronologically descending (newest first)
        timeline_items.sort(key=lambda x: x["timestamp"], reverse=True)
        return timeline_items
