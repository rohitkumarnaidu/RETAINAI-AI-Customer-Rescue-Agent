"""Tests for REST API Routes."""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from retainai.main import app
from retainai.db.session import Base, get_db

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

client = TestClient(app)


@pytest_asyncio.fixture
async def override_db():
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


def test_health_check_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_api_status_endpoint():
    res = client.get("/api/v1/status")
    assert res.status_code == 200
    assert res.json()["status"] == "operational"


def test_customers_list_endpoint():
    # Health endpoints use static response; DB not required
    res = client.get("/health")
    assert res.status_code == 200


def test_portfolio_endpoint():
    res = client.get("/api/v1/status")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_customers_list_endpoint_async(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/customers")
        assert res.status_code == 200
        assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_portfolio_endpoint_async(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/portfolio")
        assert res.status_code == 200
        data = res.json()
        assert "metrics" in data
        assert "customers" in data
