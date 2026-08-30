"""Tests for Core RETAINAI Engines (Sense, Think, Act, Measure, Learn)."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from retainai.db.models import Base, Customer, RiskLevel, Intervention, OutcomeStatus
from retainai.engine.signal_engine import SignalEngine
from retainai.agents.orchestrator import AgentOrchestrator
from retainai.engine.learning_engine import LearningEngine
import uuid
from datetime import datetime, timezone, date

# In-memory SQLite for testing
engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        yield session
        
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_end_to_end_pipeline(db_session: AsyncSession):
    # 1. Setup Customer
    cust_id = f"test_{uuid.uuid4().hex[:6]}"
    customer = Customer(
        id=cust_id, name="Test Corp", domain="test.com", segment="Enterprise", industry="Tech",
        plan="Pro", arr=10000.0, csm_name="Test", csm_email="test@test.com",
        start_date=date(2025,1,1), renewal_date=date(2026,1,1)
    )
    db_session.add(customer)
    await db_session.commit()

    # 2. Think: Orchestrator Investigation
    orchestrator = AgentOrchestrator(db_session)
    assessment = await orchestrator.investigate_customer(cust_id)
    
    # Orchestrator returns dict (new) or RiskAssessmentSchema (legacy) — handle both
    if isinstance(assessment, dict):
        assert assessment.get("customer_id") == cust_id
        # Normalize to object for plan_retention
        class _A: pass
        _a = _A()
        _a.risk_level = assessment.get("risk_level") or assessment.get("risk_assessment", {}).get("risk_level", "HEALTHY")
        _a.detected_signals = assessment.get("signals") or []
        assessment_obj = _a
    else:
        assert assessment.customer_id == cust_id
        assert assessment.risk_level in [RiskLevel.HEALTHY, RiskLevel.STABLE, RiskLevel.CRITICAL]
        assessment_obj = assessment

    # 3. Act: Plan Retention
    plan = await orchestrator.plan_retention(cust_id, assessment_obj)
    assert plan.objective is not None
    assert plan.priority is not None

    # 4. Execute (Mocking Intervention creation)
    intervention = Intervention(
        id=f"int_{uuid.uuid4().hex[:6]}",
        customer_id=cust_id,
        investigation_id="inv-test-1",
        action_type="Test_Action",
        title="Test Intervention",
        description=plan.objective,
        plan=str(plan.steps),
    )
    db_session.add(intervention)
    await db_session.commit()

    # 5. Measure & Learn
    outcome = await LearningEngine.record_outcome(db_session, intervention.id, success=True, delta_usage=15.0, delta_support=1)
    
    assert outcome.status in ("SUCCESS", OutcomeStatus.SUCCESS)
    assert outcome.health_delta == 15.0
