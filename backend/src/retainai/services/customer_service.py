"""Customer Service coordinating account retrieval, health assessment, and risk updates — Tenant-Isolated Phase 1."""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Customer, RiskAssessment, OrgSettings
from retainai.repositories.customer_repository import CustomerRepository
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.repositories.risk_repository import RiskRepository
from retainai.engine.signal_engine import SignalEngine
from retainai.engine.health_engine import HealthEngine
from retainai.engine.risk_engine import RiskEngine
from retainai.config.settings import settings, HealthWeights


class CustomerService:
    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.customer_repo = CustomerRepository(db, tenant_id=tenant_id)
        self.telemetry_repo = TelemetryRepository(db, tenant_id=tenant_id)
        self.risk_repo = RiskRepository(db, tenant_id=tenant_id)

    async def _get_health_weights(self) -> HealthWeights:
        """Per-tenant health weights from OrgSettings, fallback to global settings."""
        if not self.tenant_id:
            return settings.health_weights
        try:
            res = await self.db.execute(select(OrgSettings).where(OrgSettings.tenant_id == self.tenant_id))
            org = res.scalar_one_or_none()
            if org and org.health_weights:
                hw = org.health_weights
                return HealthWeights(
                    usage=float(hw.get("usage", 0.4)),
                    support=float(hw.get("support", 0.3)),
                    sentiment=float(hw.get("sentiment", 0.2)),
                    engagement=float(hw.get("engagement", 0.1)),
                )
        except Exception:
            pass
        return settings.health_weights

    async def _get_risk_thresholds(self) -> Optional[Dict[str, Any]]:
        """Per-tenant risk thresholds from OrgSettings, fallback to None (global)."""
        if not self.tenant_id:
            return None
        try:
            res = await self.db.execute(select(OrgSettings).where(OrgSettings.tenant_id == self.tenant_id))
            org = res.scalar_one_or_none()
            if org and org.risk_thresholds:
                rt = org.risk_thresholds
                return {
                    "critical": float(rt.get("critical", settings.RISK_CRITICAL_THRESHOLD)),
                    "high": float(rt.get("high", settings.RISK_HIGH_THRESHOLD)),
                    "at_risk": float(rt.get("at_risk", settings.RISK_AT_RISK_THRESHOLD)),
                    "watch": float(rt.get("watch", settings.RISK_WATCH_THRESHOLD)),
                    "healthy": float(rt.get("healthy", settings.RISK_HEALTHY_THRESHOLD)),
                }
        except Exception:
            pass
        return None

    async def list_customers(self) -> List[Customer]:
        return await self.customer_repo.list_all(tenant_id=self.tenant_id)

    async def get_customer(self, customer_id: str) -> Optional[Customer]:
        return await self.customer_repo.get_by_id(customer_id, tenant_id=self.tenant_id)

    async def reassess_customer_risk(self, customer_id: str) -> Dict[str, Any]:
        customer = await self.customer_repo.get_by_id(customer_id, tenant_id=self.tenant_id)
        if not customer:
            raise ValueError(f"Customer {customer_id} not found")
        # Enforce tenant isolation: if customer has tenant_id, ensure matches service tenant
        if self.tenant_id and customer.tenant_id and customer.tenant_id != self.tenant_id:
            raise PermissionError(f"Tenant mismatch: customer {customer_id} belongs to {customer.tenant_id}, not {self.tenant_id}")

        usage = await self.telemetry_repo.get_usage_events(customer_id, days=30, tenant_id=self.tenant_id)
        tickets = await self.telemetry_repo.get_support_tickets(customer_id, days=30, tenant_id=self.tenant_id)
        feedback = await self.telemetry_repo.get_feedback_entries(customer_id, days=30, tenant_id=self.tenant_id)
        events = await self.telemetry_repo.get_account_events(customer_id, days=30, tenant_id=self.tenant_id)

        total_points = len(usage) + len(tickets) + len(feedback) + len(events)

        signals = SignalEngine.evaluate_all_signals(usage, tickets, feedback, events, customer_id=customer_id)
        weights = await self._get_health_weights()
        health = HealthEngine.compute_health_components(signals, weights=weights)
        # Fetch previous health for delta calculation (risk_change)
        prev_health = float(customer.health_score) if customer.health_score is not None else None
        prev_risk = None
        # Per-tenant risk thresholds
        thresholds = await self._get_risk_thresholds()
        risk_res = RiskEngine.evaluate_risk(health, signals, total_points, customer_id=customer_id, previous_health=prev_health, previous_risk_score=prev_risk, thresholds=thresholds)

        # Update customer state in database
        await self.customer_repo.update_health_and_risk(customer_id, health.overall_health, risk_res.risk_level, tenant_id=self.tenant_id)

        import uuid
        # Store historical risk assessment
        assessment = RiskAssessment(
            id=f"risk_{customer_id[:5]}_{uuid.uuid4().hex[:8]}",
            tenant_id=self.tenant_id or customer.tenant_id,
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
