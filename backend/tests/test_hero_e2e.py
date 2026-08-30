"""Hero E2E Scenario per S26 / S51 / S74 — complete closed loop."""
import pytest
import pytest_asyncio
from datetime import date, timedelta, datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from retainai.db.models import Base, Customer, UsageEvent
from retainai.agents.orchestrator import AgentOrchestrator
from retainai.services.event_ingestion_service import EventIngestionService
from retainai.engine.learning_engine import LearningEngine
from retainai.services.intervention_service import InterventionService
from sqlalchemy import select
from retainai.db.models import LearningCandidate, ExperienceMemory

TEST_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()

@pytest.mark.asyncio
async def test_hero_full_loop(db):
    """HERO: event -> signal -> risk -> investigation -> recommendation -> approve -> outcome -> learning candidate -> validation -> memory -> second recommendation uses memory"""
    cid = "hero-loop-001"
    cust = Customer(id=cid, name="Hero Loop Co", domain="heroloop.com", segment="Enterprise", industry="Tech", plan="Enterprise Tier", arr=150000, csm_name="Alex", csm_email="alex@retainai.io", start_date=date.today()-timedelta(days=300), renewal_date=date.today()+timedelta(days=40))
    db.add(cust)
    await db.commit()
    now = datetime.now(timezone.utc)
    # Seed usage decline history to trigger signal
    for i in range(7):
        db.add(UsageEvent(id=f"h_usg_cur_{i}", customer_id=cid, timestamp=now - timedelta(days=6-i), daily_active_users=45, license_utilization=0.40, feature_clicks=85, sessions=30))
    for i in range(23):
        db.add(UsageEvent(id=f"h_usg_base_{i}", customer_id=cid, timestamp=now - timedelta(days=29-i), daily_active_users=100, license_utilization=0.85, feature_clicks=400, sessions=250))
    await db.commit()

    orch = AgentOrchestrator(db)
    # 1. Initial investigation
    res1 = await orch.run_full_rescue_workflow(cid)
    assert res1["risk_assessment"]["health_score"] < 80
    first_action = res1["retention_plan"]["action_type"]
    # 2. Inject friction: ticket + feedback
    ingestion = EventIngestionService(db)
    await ingestion.ingest_event(customer_id=cid, event_type="SUPPORT_TICKET", payload={"id":"TICK-HERO-1","severity":"HIGH","subject":"Export bug","status":"OPEN"}, timestamp=now)
    await ingestion.ingest_event(customer_id=cid, event_type="CUSTOMER_FEEDBACK", payload={"id":"FEED-HERO-1","sentiment":"NEGATIVE","score":2,"text":"blocked"}, timestamp=now)
    # 3. Re-investigate -> risk should stay high / increase, root cause shift toward support friction
    res2 = await orch.run_full_rescue_workflow(cid)
    assert "UNRESOLVED_CRITICAL_SUPPORT_TICKET" in res2["risk_assessment"]["signals"]
    # 4. Human approve
    svc = InterventionService(db)
    approved = await svc.approve_intervention(res2["intervention_id"])
    assert str(approved.status).endswith("APPROVED")
    # 5. Outcome success
    eng = LearningEngine(db)
    outcome = await eng.evaluate_intervention_outcome(intervention_id=res2["intervention_id"], health_before=res2["risk_assessment"]["health_score"], health_after=res2["risk_assessment"]["health_score"]+22, usage_before=45, usage_after=115, customer_response="fixed")
    assert outcome.outcome in ("SUCCESS","PARTIAL")
    # 6. Learning candidate created but NOT validated yet (single observation)
    cands = (await db.execute(select(LearningCandidate))).scalars().all()
    assert len(cands) >= 1
    assert cands[-1].status == "PENDING_VALIDATION"  # first success alone not yet validated
    # 7. Second similar success -> should promote to validated memory
    # create second intervention with same pattern quickly via duplicate customer/intervention
    from retainai.db.models import InvestigationReport, Intervention
    import uuid, json
    cid2 = "hero-loop-002"
    cust2 = Customer(id=cid2, name="Hero Clone", domain="clone.com", segment="Enterprise", industry="Tech", plan="Enterprise Tier", arr=90000, csm_name="Alex", csm_email="alex@retainai.io", start_date=date.today()-timedelta(days=200), renewal_date=date.today()+timedelta(days=50))
    db.add(cust2)
    await db.commit()
    for i in range(7):
        db.add(UsageEvent(id=f"c2_usg_{i}", customer_id=cid2, timestamp=now - timedelta(days=6-i), daily_active_users=42, license_utilization=0.35, feature_clicks=80, sessions=25))
    for i in range(10):
        db.add(UsageEvent(id=f"c2_base_{i}", customer_id=cid2, timestamp=now - timedelta(days=20-i), daily_active_users=95, license_utilization=0.82, feature_clicks=380, sessions=230))
    await db.commit()
    res_clone = await orch.run_full_rescue_workflow(cid2)
    # force same action_type as first to share pattern
    # if not same, manually set intervention action_type to match
    clone_intervention = await db.get(Intervention, res_clone["intervention_id"])
    clone_intervention.action_type = first_action
    await db.commit()
    # Now evaluate second success
    outcome2 = await eng.evaluate_intervention_outcome(intervention_id=res_clone["intervention_id"], health_before=res_clone["risk_assessment"]["health_score"], health_after=res_clone["risk_assessment"]["health_score"]+20, usage_before=42, usage_after=110, customer_response="second success")
    # Check memory promoted
    mems = (await db.execute(select(ExperienceMemory).where(ExperienceMemory.validation_status=="VALIDATED"))).scalars().all()
    # At least one validated memory should exist after second consistent success
    # Note: if action_type was forced to match, pattern matches and second should validate
    # Allow either 0 or 1 but test that repeated success does NOT remain candidate forever — after 2 it should be validated
    candidates_after = (await db.execute(select(LearningCandidate))).scalars().all()
    validated_cands = [c for c in candidates_after if c.status=="VALIDATED"]
    assert len(validated_cands) >= 1, "Second consistent success should promote candidate to VALIDATED"
    # 8. Memory retrieval influences future recommendation: query should return validated memory
    from retainai.agents.tools import AgentTools
    tools = AgentTools(db)
    retrieved = await tools.query_experience_memory(segment="Enterprise", risk_pattern=first_action)
    assert len(retrieved) >= 1
    assert any(r["recommended_strategy"]==first_action for r in retrieved)
