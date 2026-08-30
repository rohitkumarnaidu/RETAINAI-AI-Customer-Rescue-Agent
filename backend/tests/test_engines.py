"""Unit & Integration Tests for RETAINAI Core Engines."""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta, date, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from retainai.db.session import Base
from retainai.db.models import (
    Customer,
    UsageEvent,
    SupportTicket,
    FeedbackEntry,
    AccountActivity,
)
from retainai.engine.signal_engine import SignalEngine
from retainai.engine.health_engine import HealthEngine
from retainai.agents.orchestrator import AgentOrchestrator


@pytest_asyncio.fixture
async def async_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        yield session


@pytest.mark.asyncio
async def test_signal_engine_detects_severe_usage_drop(async_session):
    now = datetime.now(timezone.utc)
    cust = Customer(
        id="TEST_CUST_1",
        name="Test Corp",
        domain="test.com",
        segment="Enterprise",
        industry="SaaS",
        plan="Pro",
        arr=100000.0,
        csm_name="Jane",
        csm_email="jane@test.com",
        start_date=date.today() - timedelta(days=100),
        renewal_date=date.today() + timedelta(days=60),
    )
    async_session.add(cust)

    # Prior usage (high)
    async_session.add(
        UsageEvent(
            id="U1",
            customer_id="TEST_CUST_1",
            timestamp=now - timedelta(days=20),
            active_users=20,
            wau=100,
            mau=200,
            total_sessions=300,
            feature_adoption_rates={},
            job_completion_rate=0.85,
        )
    )
    # Recent usage (severe drop)
    async_session.add(
        UsageEvent(
            id="U2",
            customer_id="TEST_CUST_1",
            timestamp=now - timedelta(days=5),
            active_users=5,
            wau=20,
            mau=200,
            total_sessions=50,
            feature_adoption_rates={},
            job_completion_rate=0.60,
        )
    )
    await async_session.commit()

    signals = SignalEngine.evaluate_signals(
        cust,
        [
            UsageEvent(
                id="U1", customer_id="TEST_CUST_1", timestamp=now - timedelta(days=20), active_users=20, wau=100, mau=200, total_sessions=300, feature_adoption_rates={}, job_completion_rate=0.85
            ),
            UsageEvent(
                id="U2", customer_id="TEST_CUST_1", timestamp=now - timedelta(days=5), active_users=5, wau=20, mau=200, total_sessions=50, feature_adoption_rates={}, job_completion_rate=0.60
            ),
        ],
        [],
        [],
        [],
        reference_date=now,
    )

    usage_signal = next((s for s in signals if s.category == "USAGE"), None)
    assert usage_signal is not None
    assert usage_signal.direction == "DECLINING"
    assert usage_signal.magnitude <= -50.0


@pytest.mark.asyncio
async def test_false_positive_safeguard_signal(async_session):
    now = datetime.now(timezone.utc)
    cust = Customer(
        id="TEST_FP",
        name="False Positive Inc",
        domain="fp.com",
        segment="Mid-Market",
        industry="Logistics",
        plan="Pro",
        arr=50000.0,
        csm_name="Bob",
        csm_email="bob@test.com",
        start_date=date.today() - timedelta(days=100),
        renewal_date=date.today() + timedelta(days=60),
        is_false_positive_candidate=True,
    )

    signals = SignalEngine.evaluate_signals(
        cust,
        [
            UsageEvent(
                id="U1", customer_id="TEST_FP", timestamp=now - timedelta(days=20), active_users=20, wau=100, mau=200, total_sessions=300, feature_adoption_rates={}, job_completion_rate=0.95
            ),
            UsageEvent(
                id="U2", customer_id="TEST_FP", timestamp=now - timedelta(days=5), active_users=5, wau=40, mau=200, total_sessions=50, feature_adoption_rates={}, job_completion_rate=0.96
            ),
        ],
        [],
        [],
        [],
        reference_date=now,
    )

    safeguard_signal = next((s for s in signals if s.category == "USAGE_CONTEXT"), None)
    assert safeguard_signal is not None
    assert safeguard_signal.impact_score < 0  # Reduces risk penalty
