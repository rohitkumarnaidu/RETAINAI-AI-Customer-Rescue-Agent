"""Deterministic Health Scoring Engine using configurable HealthWeights."""

from dataclasses import dataclass
from typing import List
from retainai.config.settings import settings, HealthWeights
from retainai.engine.signal_engine import DetectedSignal


@dataclass
class HealthComponents:
    usage_health: float
    support_health: float
    sentiment_health: float
    engagement_health: float
    overall_health: float


class HealthEngine:
    """Calculates deterministic composite health score (0-100)."""

    @staticmethod
    def compute_health_components(
        signals: List[DetectedSignal],
        weights: HealthWeights = settings.health_weights,
    ) -> HealthComponents:
        usage_h = 100.0
        support_h = 100.0
        sentiment_h = 100.0
        engagement_h = 100.0

        for s in signals:
            if s.category == "USAGE":
                usage_h -= s.impact_score
            elif s.category == "SUPPORT":
                support_h -= s.impact_score
            elif s.category == "FEEDBACK":
                sentiment_h -= s.impact_score
            elif s.category == "ACTIVITY":
                engagement_h -= s.impact_score
            elif s.category == "USAGE_CONTEXT":
                usage_h -= s.impact_score

        # Clamp individual health scores to [0.0, 100.0]
        usage_h = max(0.0, min(100.0, usage_h))
        support_h = max(0.0, min(100.0, support_h))
        sentiment_h = max(0.0, min(100.0, sentiment_h))
        engagement_h = max(0.0, min(100.0, engagement_h))

        # Weighted composite score
        composite = (
            (usage_h * weights.usage)
            + (support_h * weights.support)
            + (sentiment_h * weights.sentiment)
            + (engagement_h * weights.engagement)
        )

        return HealthComponents(
            usage_health=round(usage_h, 1),
            support_health=round(support_h, 1),
            sentiment_health=round(sentiment_h, 1),
            engagement_health=round(engagement_h, 1),
            overall_health=round(composite, 1),
        )
