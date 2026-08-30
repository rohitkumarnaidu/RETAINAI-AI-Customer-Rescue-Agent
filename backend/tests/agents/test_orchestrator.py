"""Integration tests for Master Agent Orchestrator & Audit Runs."""

import pytest
import pytest_asyncio
from datetime import datetime, date, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from retainai.db.session import Base
from retainai.db.models import Customer, UsageEvent, SupportTicket, CustomerFeedback
from retainai.repositories.customer_repository import CustomerRepository
from retainai.agents.orchestrator import AgentOrchestrator

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
async def test_orchestrator_full_rescue_workflow(test_db):
    c_repo = CustomerRepository(test_db)
    cust = Customer(
        id="cust-acme-agent-1",
        name="Acme Agent Test",
        domain="acmeagent.com",
        segment="Enterprise",
        industry="Tech",
        plan="Enterprise Plus",
        mrr=12500.0,
        arr=150000.0,
        csm_name="Sarah Jenkins",
        csm_email="sarah@retainai.io",
        start_date=date.today() - timedelta(days=200),
        renewal_date=date.today() + timedelta(days=60),
    )
    await c_repo.create(cust)

    # Ingest bug ticket
    ticket = SupportTicket(
        id="TICK-AGENT-1",
        customer_id="cust-acme-agent-1",
        created_at=datetime.now(timezone.utc),
        severity="HIGH",
        category="BUG",
        subject="CSV Export fails on reports with >10,000 rows",
        status="OPEN",
        description="Month end reporting export timeout.",
    )
    test_db.add(ticket)

    # Ingest usage event
    usage = UsageEvent(
        id="USG-AGENT-1",
        customer_id="cust-acme-agent-1",
        timestamp=datetime.now(timezone.utc),
        daily_active_users=42,
        license_utilization=0.35,
    )
    test_db.add(usage)

    # Ingest feedback
    fb = CustomerFeedback(
        id="FEED-AGENT-1",
        customer_id="cust-acme-agent-1",
        created_at=datetime.now(timezone.utc),
        source="CSAT",
        sentiment="NEGATIVE",
        score=2,
        text="Export timeouts are breaking our monthly reports.",
    )
    test_db.add(fb)
    await test_db.commit()

    orchestrator = AgentOrchestrator(test_db)
    res = await orchestrator.run_full_rescue_workflow("cust-acme-agent-1")

    assert res["run_id"].startswith("run_")
    assert res["customer_id"] == "cust-acme-agent-1"
    assert "investigation" in res
    assert "retention_plan" in res
    assert res["investigation"]["confidence"] in ("HIGH_CONFIDENCE", "MEDIUM_CONFIDENCE")
    assert res["retention_plan"]["priority"] in ("HIGH", "CRITICAL")
