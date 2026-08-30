"""Tests for Acme Replay Scenario Engine."""

import pytest
import pytest_asyncio
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from retainai.db.session import Base
from retainai.db.models import Customer, RiskLevel
from retainai.repositories.customer_repository import CustomerRepository
from retainai.demo.acme_replay import AcmeReplayEngine

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
async def test_acme_replay_flow(test_db):
    c_repo = CustomerRepository(test_db)
    today = date.today()
    acme = Customer(
        id="cust-acme-101",
        name="Acme Corp",
        domain="acme.com",
        segment="Enterprise",
        industry="Tech",
        plan="Enterprise Plus",
        mrr=12500.0,
        arr=150000.0,
        csm_name="Sarah",
        csm_email="sarah@retainai.io",
        start_date=today - timedelta(days=365),
        renewal_date=today + timedelta(days=60),
    )
    await c_repo.create(acme)

    engine = AcmeReplayEngine(test_db)

    # Step 1: Healthy
    res_healthy = await engine.step_healthy_baseline()
    assert res_healthy["health_score"] >= 80.0

    # Step 2: Inject Friction
    res_friction = await engine.step_inject_friction()
    assert res_friction["health_score"] < 70.0
    assert res_friction["risk_level"] in ("WATCH", "AT_RISK", "HIGH_RISK", "CRITICAL")
    assert "UNRESOLVED_CRITICAL_SUPPORT_TICKET" in res_friction["signals"]

    # Step 3: Post Intervention Recovery
    res_recovery = await engine.step_post_intervention_recovery(intervention_id="inv-acme-001")
    assert res_recovery["reassessment"]["health_score"] > 70.0
    assert res_recovery["outcome_status"] == "SUCCESS"
    assert res_recovery["health_delta"] > 15.0
