"""Deterministic Risk Engine for Risk Level mapping & Insufficient Data detection."""

from dataclasses import dataclass, field
from typing import List, Tuple
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
        elif health_score < 90.0:
            return RiskLevel.STABLE
        else:
            return RiskLevel.HEALTHY

    @classmethod
    def evaluate_risk(
        cls,
        health: HealthComponents,
        signals: List[DetectedSignal],
        total_data_points: int,
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

        return RiskResult(
            health_score=health.overall_health,
            risk_level=risk_lvl,
            risk_score=round(raw_risk_score, 2),
            confidence=round(confidence, 2),
            detected_signals=signal_names,
            is_insufficient_data=False,
            evidence_ids=list(set(evidence_ids)),
        )
