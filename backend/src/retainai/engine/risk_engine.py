"""Deterministic Risk Engine for Risk Level mapping & Insufficient Data detection."""

from dataclasses import dataclass, field
from typing import List
from retainai.config.settings import settings
from retainai.db.models import RiskLevel
from retainai.engine.health_engine import HealthComponents
from retainai.engine.signal_engine import DetectedSignal


@dataclass
class RiskResult:
    health_score: float
    risk_level: RiskLevel
    risk_score: float  # Normalized 0.0 to 1.0 risk score
    confidence: float  # Confidence level 0.0 to 1.0
    detected_signals: List[str] = field(default_factory=list)
    is_insufficient_data: bool = False
    evidence_ids: List[str] = field(default_factory=list)
    # Spec-compliant enriched fields
    customer_id: str = ""
    risk_level_str: str = ""
    risk_change: float = 0.0
    previous_risk_score: float = 0.0
    top_signals: List[str] = field(default_factory=list)
    uncertainty: List[str] = field(default_factory=list)
    assessment_version: str = "v2.1-risk"
    created_at: str = field(default_factory=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat())

    def to_spec_dict(self) -> dict:
        return {
            "customer_id": self.customer_id,
            "risk_score": round(self.risk_score * 100, 1) if self.risk_score <= 1.0 else round(self.risk_score,1),
            "risk_level": self.risk_level.value if hasattr(self.risk_level, "value") else str(self.risk_level),
            "risk_change": self.risk_change,
            "previous_risk_score": self.previous_risk_score,
            "top_signals": self.top_signals or self.detected_signals[:3],
            "evidence_ids": self.evidence_ids,
            "confidence": self.confidence,
            "uncertainty": self.uncertainty,
            "assessment_version": self.assessment_version,
            "created_at": self.created_at,
            "health_score": self.health_score,
            "is_insufficient_data": self.is_insufficient_data,
        }


class RiskEngine:
    """Evaluates risk levels and checks for sparse data conditions."""

    @staticmethod
    def map_health_to_risk_level(health_score: float) -> RiskLevel:
        if health_score < settings.RISK_CRITICAL_THRESHOLD:
            return RiskLevel.CRITICAL
        elif health_score < settings.RISK_HIGH_THRESHOLD:
            return RiskLevel.HIGH_RISK
        elif health_score < settings.RISK_AT_RISK_THRESHOLD:
            return RiskLevel.AT_RISK
        elif health_score < settings.RISK_WATCH_THRESHOLD:
            return RiskLevel.WATCH
        elif health_score < settings.RISK_HEALTHY_THRESHOLD:
            return RiskLevel.STABLE
        else:
            return RiskLevel.HEALTHY

    @classmethod
    def evaluate_risk(
        cls,
        health: HealthComponents,
        signals: List[DetectedSignal],
        total_data_points: int,
        customer_id: str = "",
        previous_risk_score: float | None = None,
        previous_health: float | None = None,
    ) -> RiskResult:
        # Insufficient data safeguard: <3 total events
        if total_data_points < 3:
            return RiskResult(
                health_score=health.overall_health,
                risk_level=RiskLevel.WATCH,
                risk_score=0.30,
                confidence=0.40,
                detected_signals=["INSUFFICIENT_DATA_BASELINE"],
                is_insufficient_data=True,
                evidence_ids=[],
                customer_id=customer_id,
                risk_level_str=RiskLevel.WATCH.value,
                risk_change=0.0,
                previous_risk_score=previous_risk_score or 0.0,
                top_signals=["INSUFFICIENT_DATA_BASELINE"],
                uncertainty=["insufficient_evidence: fewer than 3 data points"],
                assessment_version="v2.1-risk",
            )

        risk_lvl = cls.map_health_to_risk_level(health.overall_health)
        raw_risk_score = min(1.0, max(0.0, (100.0 - health.overall_health) / 100.0))

        # Collect evidence IDs from detected signals
        evidence_ids = []
        signal_names = []
        for s in signals:
            signal_names.append(s.signal_type)
            evidence_ids.extend(s.evidence_ids)

        confidence = min(0.95, 0.65 + (len(signals) * 0.08))

        # Handle stale/missing data uncertainty
        uncertainty: List[str] = []
        if not signals:
            uncertainty.append("no_signals_detected: risk relies on baseline health only")
        if total_data_points < 5:
            uncertainty.append("sparse_data: confidence reduced due to limited telemetry")
        # Detect contradictory signals (improving usage but negative feedback)
        has_decline = any("DECLINE" in s for s in signal_names)
        has_admin_inactivity = any(s == "ADMIN_INACTIVITY" for s in signal_names)
        has_false_positive = any(s == "FALSE_POSITIVE_SAFEGUARD" for s in signal_names)
        if has_decline and has_false_positive:
            uncertainty.append("conflicting_evidence: usage decline vs high efficiency suggests false positive, manual review recommended")

        # Top signals by impact_score
        sorted_signals = sorted(signals, key=lambda s: s.impact_score, reverse=True)
        top_signals = [s.signal_type for s in sorted_signals[:3]]

        # Risk change vs previous
        risk_change = 0.0
        prev_score_val = previous_risk_score if previous_risk_score is not None else raw_risk_score
        if previous_risk_score is not None:
            risk_change = round((raw_risk_score - previous_risk_score) * 100, 1)
        elif previous_health is not None:
            prev_risk = min(1.0, max(0.0, (100.0 - previous_health) / 100.0))
            risk_change = round((raw_risk_score - prev_risk) * 100, 1)
            prev_score_val = prev_risk

        # Validate score ranges
        assert 0.0 <= raw_risk_score <= 1.0, "risk_score out of bounds"
        # Determine uncertainty -> low confidence if insufficient
        effective_confidence = round(confidence, 2)
        if uncertainty and "conflicting_evidence" in str(uncertainty):
            effective_confidence = min(effective_confidence, 0.65)

        return RiskResult(
            health_score=health.overall_health,
            risk_level=risk_lvl,
            risk_score=round(raw_risk_score, 2),
            confidence=effective_confidence,
            detected_signals=signal_names,
            is_insufficient_data=False,
            evidence_ids=list(set(evidence_ids)),
            customer_id=customer_id,
            risk_level_str=risk_lvl.value,
            risk_change=risk_change,
            previous_risk_score=round(prev_score_val, 2),
            top_signals=top_signals,
            uncertainty=uncertainty,
            assessment_version="v2.1-risk",
        )
