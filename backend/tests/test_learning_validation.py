"""Learning validation gate tests per S48."""
import pytest, uuid, json
from datetime import date, timedelta, datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from retainai.db.models import Base, Customer, Intervention, InvestigationReport, LearningCandidate, ExperienceMemory
from retainai.engine.learning_engine import LearningEngine
from sqlalchemy import select

URL="sqlite+aiosqlite:///:memory:"
import pytest_asyncio
@pytest_asyncio.fixture
async def db():
    engine=create_async_engine(URL,echo=False)
    async with engine.begin() as c: await c.run_sync(Base.metadata.create_all)
    S=async_sessionmaker(bind=engine,class_=AsyncSession,expire_on_commit=False)
    async with S() as s: yield s
    await engine.dispose()

async def _make_intervention(db, cid, action="ENG_ESCALATION"):
    inv_id=f"inv_{uuid.uuid4().hex[:6]}"
    db.add(InvestigationReport(id=inv_id,customer_id=cid,risk_assessment_id="r1",created_at=datetime.now(timezone.utc),summary="s",root_cause="r",confidence="HIGH_CONFIDENCE",evidence_ids=[],recommended_action="a",missing_evidence=[]))
    await db.commit()
    int_id=f"int_{uuid.uuid4().hex[:6]}"
    inter=Intervention(id=int_id,customer_id=cid,investigation_id=inv_id,action_type=action,title="T",description="d",plan="[]")
    db.add(inter); await db.commit()
    return int_id

@pytest.mark.asyncio
async def test_single_success_not_validated(db):
    cid="cust-learn-1"
    db.add(Customer(id=cid,name="L",domain="l.com",segment="Enterprise",industry="Tech",plan="P",arr=10000,csm_name="C",csm_email="c@x.com",start_date=date.today()-timedelta(days=100),renewal_date=date.today()+timedelta(days=60)))
    await db.commit()
    int_id=await _make_intervention(db,cid)
    eng=LearningEngine(db)
    await eng.evaluate_intervention_outcome(intervention_id=int_id,health_before=40,health_after=70)
    cands=(await db.execute(select(LearningCandidate))).scalars().all()
    assert cands[0].status=="PENDING_VALIDATION"
    mems=(await db.execute(select(ExperienceMemory))).scalars().all()
    assert len(mems)==0

@pytest.mark.asyncio
async def test_repeated_success_validates(db):
    cid="cust-learn-2"
    db.add(Customer(id=cid,name="L2",domain="l2.com",segment="Enterprise",industry="Tech",plan="P",arr=10000,csm_name="C",csm_email="c@x.com",start_date=date.today()-timedelta(days=100),renewal_date=date.today()+timedelta(days=60)))
    await db.commit()
    eng=LearningEngine(db)
    for i in range(2):
        int_id=await _make_intervention(db,cid,action="SAME_ACTION")
        await eng.evaluate_intervention_outcome(intervention_id=int_id,health_before=40,health_after=70)
    cands=(await db.execute(select(LearningCandidate))).scalars().all()
    assert any(c.status=="VALIDATED" for c in cands)
    mems=(await db.execute(select(ExperienceMemory))).scalars().all()
    assert len(mems)>=1

@pytest.mark.asyncio
async def test_contradictory_low_confidence(db):
    cid="cust-learn-3"
    db.add(Customer(id=cid,name="L3",domain="l3.com",segment="Enterprise",industry="Tech",plan="P",arr=10000,csm_name="C",csm_email="c@x.com",start_date=date.today()-timedelta(days=100),renewal_date=date.today()+timedelta(days=60)))
    await db.commit()
    eng=LearningEngine(db)
    int1=await _make_intervention(db,cid,action="ACTION_X")
    await eng.evaluate_intervention_outcome(intervention_id=int1,health_before=40,health_after=70)
    int2=await _make_intervention(db,cid,action="ACTION_X")
    await eng.evaluate_intervention_outcome(intervention_id=int2,health_before=70,health_after=50) # failure
    cands=(await db.execute(select(LearningCandidate))).scalars().all()
    failed=[c for c in cands if c.observed_outcome.lower().startswith("health change") and "failed" in c.observed_outcome.lower()]
    # confidence penalized
    assert len(cands)==2
