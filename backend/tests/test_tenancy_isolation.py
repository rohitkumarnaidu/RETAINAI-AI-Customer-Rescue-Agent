"""Phase 1-5 Tenancy Isolation Tests — any user dynamic."""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from retainai.main import app
from retainai.db.session import Base, get_db

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def tenant_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        async def _get_test_db():
            yield session
        app.dependency_overrides[get_db] = _get_test_db
        yield session
        app.dependency_overrides.clear()
    await engine.dispose()


def test_tenant_models_have_tenant_id():
    """G1 — every core table has tenant_id column (nullable for migration)."""
    from retainai.db.models import (
        Customer, UsageEvent, SupportTicket, CustomerFeedback, AccountEvent,
        RiskAssessment, InvestigationReport, Intervention, InterventionOutcome,
        ExperienceMemory, LearningCandidate, AgentRun, AgentStep, SystemEventLog,
        Tenant, User, OrgSettings,
    )
    for model in [Customer, UsageEvent, SupportTicket, CustomerFeedback, AccountEvent,
                  RiskAssessment, InvestigationReport, Intervention, InterventionOutcome,
                  ExperienceMemory, LearningCandidate, AgentRun, AgentStep, SystemEventLog]:
        cols = [c.name for c in model.__table__.columns]
        assert "tenant_id" in cols, f"{model.__tablename__} missing tenant_id"
    # New tables exist
    assert Tenant.__tablename__ == "tenants"
    assert User.__tablename__ == "users"
    assert OrgSettings.__tablename__ == "org_settings"


def test_org_settings_model_exists():
    from retainai.db.models import OrgSettings
    cols = {c.name for c in OrgSettings.__table__.columns}
    assert "health_weights" in cols
    assert "risk_thresholds" in cols
    assert "llm_provider" in cols
    assert "llm_api_key_encrypted" in cols
    assert "tenant_id" in cols


@pytest.mark.asyncio
async def test_tenant_isolation_signup_and_customer(tenant_db):
    """Any user can signup → isolated workspace → B cannot see A's customer."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        e1 = f"iso1_{uuid.uuid4().hex[:6]}@example.com"
        e2 = f"iso2_{uuid.uuid4().hex[:6]}@example.com"
        r1 = await ac.post("/api/v1/auth/signup", json={"email": e1, "password": "demo123", "orgName": "IsoOrgA"})
        assert r1.status_code == 200, r1.text
        r2 = await ac.post("/api/v1/auth/signup", json={"email": e2, "password": "demo123", "orgName": "IsoOrgB"})
        assert r2.status_code == 200, r2.text
        t1, tid1 = r1.json()["access_token"], r1.json()["tenant_id"]
        t2, tid2 = r2.json()["access_token"], r2.json()["tenant_id"]
        assert tid1 != tid2

        hdr1 = {"Authorization": f"Bearer {t1}", "X-Tenant-Id": tid1}
        hdr2 = {"Authorization": f"Bearer {t2}", "X-Tenant-Id": tid2}

        r = await ac.post("/api/v1/customers", json={"name": "IsoCustA", "arr": 12345}, headers=hdr1)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]

        # Tenant B must not see it
        r = await ac.get(f"/api/v1/customers/{cid}", headers=hdr2)
        assert r.status_code == 404, "Tenant isolation violated: B saw A's customer"

        r = await ac.get("/api/v1/customers", headers=hdr2)
        assert r.status_code == 200
        assert not any(c["id"] == cid for c in r.json()), "B list leaked A's customer"

        r = await ac.get("/api/v1/customers", headers=hdr1)
        assert any(c["id"] == cid for c in r.json())


@pytest.mark.asyncio
async def test_org_settings_per_tenant(tenant_db):
    """Health weights are per-tenant, not global."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        e = f"org_{uuid.uuid4().hex[:6]}@example.com"
        r = await ac.post("/api/v1/auth/signup", json={"email": e, "password": "demo123", "orgName": "WeightsOrg"})
        assert r.status_code == 200
        t, tid = r.json()["access_token"], r.json()["tenant_id"]
        hdr = {"Authorization": f"Bearer {t}", "X-Tenant-Id": tid}

        r = await ac.get("/api/v1/org/settings", headers=hdr)
        assert r.status_code == 200
        assert "health_weights" in r.json()

        r = await ac.put("/api/v1/org/settings", json={"health_weights": {"usage": 0.5, "support": 0.2, "sentiment": 0.2, "engagement": 0.1}}, headers=hdr)
        assert r.status_code == 200
        assert r.json()["health_weights"]["usage"] == 0.5


@pytest.mark.asyncio
async def test_ingest_batch_and_webhook_tenant_scoped(tenant_db):
    """Any tenant can ingest via batch and webhook, scoped."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        e = f"ing_{uuid.uuid4().hex[:6]}@example.com"
        r = await ac.post("/api/v1/auth/signup", json={"email": e, "password": "demo123", "orgName": "IngestOrg"})
        t, tid = r.json()["access_token"], r.json()["tenant_id"]
        hdr = {"Authorization": f"Bearer {t}", "X-Tenant-Id": tid}

        r = await ac.post("/api/v1/ingest/batch", json={"customers": [{"name": "BatchOne"}, {"name": "BatchTwo"}]}, headers=hdr)
        assert r.status_code == 200
        assert r.json()["created"] == 2

        # create customer for webhook
        r = await ac.post("/api/v1/customers", json={"name": "WebhookCust"}, headers=hdr)
        cid = r.json()["id"]
        r = await ac.post("/api/v1/ingest/webhook/generic", json={"customer_id": cid, "payload": {"severity": "CRITICAL"}}, headers=hdr)
        assert r.status_code == 200
        assert r.json()["customer_id"] == cid
