"""Tests for Health and Risk Engines."""

from retainai.db.models import RiskLevel
from retainai.engine.signal_engine import DetectedSignal
from retainai.engine.health_engine import HealthEngine
from retainai.engine.risk_engine import RiskEngine


def test_health_calculation_weighted_composite():
    signals = [
        DetectedSignal(
            signal_type="USAGE_DECLINE",
            category="USAGE",
            severity="HIGH",
            value=40,
            baseline=100,
            delta_pct=-60,
            summary="Usage dropped",
            impact_score=40.0,
        )
    ]
    health = HealthEngine.compute_health_components(signals)

    # Usage health = 100 - 40 = 60.0
    # Composite = 60 * 0.4 + 100 * 0.3 + 100 * 0.2 + 100 * 0.1 = 24 + 30 + 20 + 10 = 84.0
    assert health.usage_health == 60.0
    assert health.overall_health == 84.0


def test_risk_level_mapping():
    assert RiskEngine.map_health_to_risk_level(15.0) == RiskLevel.CRITICAL
    assert RiskEngine.map_health_to_risk_level(35.0) == RiskLevel.HIGH_RISK
    assert RiskEngine.map_health_to_risk_level(55.0) == RiskLevel.AT_RISK
    assert RiskEngine.map_health_to_risk_level(75.0) == RiskLevel.WATCH
    assert RiskEngine.map_health_to_risk_level(85.0) == RiskLevel.STABLE
    assert RiskEngine.map_health_to_risk_level(95.0) == RiskLevel.HEALTHY


def test_insufficient_data_risk_evaluation():
    signals = []
    health = HealthEngine.compute_health_components(signals)
    risk_res = RiskEngine.evaluate_risk(health, signals, total_data_points=1)

    assert risk_res.is_insufficient_data is True
    assert risk_res.risk_level == RiskLevel.WATCH
    assert risk_res.confidence == 0.40
