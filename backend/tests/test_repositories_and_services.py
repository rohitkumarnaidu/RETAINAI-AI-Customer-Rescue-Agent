"""Tests for Repositories and Services with Async Database."""

import pytest
import pytest_asyncio
from datetime import datetime, date, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from retainai.db.session import Base
from retainai.db.models import Customer, RiskLevel, UsageEvent, SupportTicket
from retainai.repositories.customer_repository import CustomerRepository
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.services.customer_service import CustomerService
from retainai.services.timeline_service import TimelineService

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_db():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_customer_repository_crud(test_db):
    repo = CustomerRepository(test_db)
    cust = Customer(
        id="c1",
        name="Test Account",
        domain="test.com",
        segment="Enterprise",
        industry="Tech",
        plan="Pro",
        mrr=5000.0,
        arr=60000.0,
        csm_name="Jane Doe",
        csm_email="jane@test.com",
        start_date=date.today(),
        renewal_date=date.today() + timedelta(days=90),
        health_score=90.0,
        risk_level=RiskLevel.HEALTHY,
    )
    await repo.create(cust)

    fetched = await repo.get_by_id("c1")
    assert fetched is not None
    assert fetched.name == "Test Account"

    updated = await repo.update_health_and_risk("c1", 35.0, RiskLevel.HIGH_RISK)
    assert updated.health_score == 35.0
    assert updated.risk_level == RiskLevel.HIGH_RISK


@pytest.mark.asyncio
async def test_timeline_service(test_db):
    c_repo = CustomerRepository(test_db)
    t_repo = TelemetryRepository(test_db)

    cust = Customer(
        id="c2",
        name="Timeline Account",
        domain="time.com",
        segment="SMB",
        industry="Tech",
        plan="Pro",
        mrr=1000.0,
        csm_name="Jane",
        csm_email="j@test.com",
        start_date=date.today(),
        renewal_date=date.today() + timedelta(days=90),
    )
    await c_repo.create(cust)

    now = datetime.now(timezone.utc)
    await t_repo.add_usage_event(
        UsageEvent(id="u1", customer_id="c2", timestamp=now, daily_active_users=50, license_utilization=0.8)
    )
    await t_repo.add_support_ticket(
        SupportTicket(id="t1", customer_id="c2", created_at=now, severity="HIGH", category="BUG", subject="Error 500")
    )

    t_service = TimelineService(test_db)
    timeline = await t_service.get_unified_timeline("c2")

    assert len(timeline) == 2
    assert timeline[0]["id"] in ("u1", "t1")
