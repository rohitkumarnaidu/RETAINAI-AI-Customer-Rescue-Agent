"""Tests for Signal Engine."""

from datetime import datetime, timedelta, timezone
from retainai.db.models import UsageEvent, SupportTicket, CustomerFeedback, AccountEvent
from retainai.engine.signal_engine import SignalEngine


def test_detect_severe_usage_decline():
    now = datetime.now(timezone.utc)
    events = []
    # 30 days ago baseline: 100 DAU
    for i in range(20):
        events.append(
            UsageEvent(
                id=f"u_{i}",
                customer_id="c1",
                timestamp=now - timedelta(days=30 - i),
                daily_active_users=100,
                license_utilization=0.8,
            )
        )
    # Last 7 days: 30 DAU (-70% drop)
    for i in range(7):
        events.append(
            UsageEvent(
                id=f"u_recent_{i}",
                customer_id="c1",
                timestamp=now - timedelta(days=7 - i),
                daily_active_users=30,
                license_utilization=0.3,
            )
        )

    signals = SignalEngine.detect_usage_decline_signals(events)
    assert len(signals) == 1
    assert signals[0].signal_type == "SEVERE_USAGE_DECLINE"
    assert signals[0].severity == "CRITICAL"


def test_detect_unresolved_critical_ticket():
    ticket = SupportTicket(
        id="tck-1",
        customer_id="c1",
        created_at=datetime.now(timezone.utc) - timedelta(days=3),
        severity="HIGH",
        status="OPEN",
        category="BUG",
        subject="Database connection failure",
    )
    signals = SignalEngine.detect_support_friction_signals([ticket])
    assert len(signals) == 1
    assert signals[0].signal_type == "UNRESOLVED_CRITICAL_SUPPORT_TICKET"
    assert signals[0].severity == "CRITICAL"


def test_detect_negative_sentiment():
    fb = CustomerFeedback(
        id="fb-1",
        customer_id="c1",
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
        source="CSAT",
        sentiment="NEGATIVE",
        score=1,
        text="Worst experience ever",
    )
    signals = SignalEngine.detect_sentiment_signals([fb])
    assert len(signals) == 1
    assert signals[0].signal_type == "NEGATIVE_CUSTOMER_FEEDBACK"
    assert signals[0].severity == "HIGH"
