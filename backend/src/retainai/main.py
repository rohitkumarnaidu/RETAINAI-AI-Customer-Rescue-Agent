"""FastAPI Application Entrypoint — Phase 1 Tenancy."""

import logging
import uuid
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from retainai.config import settings
from retainai.db.session import init_db, engine
from retainai.api.routes import router as api_router
from retainai.api.agent_routes import router as agent_router
try:
    from retainai.api.ingest import router as ingest_router
except Exception as _ing_e:
    import logging as _lg2
    _lg2.getLogger("retainai.api").warning(f"Ingest router not loaded: {_ing_e}")
    ingest_router = None  # type: ignore
try:
    from retainai.auth.auth import router as auth_router
except Exception as _auth_e:
    import logging as _lg
    _lg.getLogger("retainai.api").warning(f"Auth router not loaded: {_auth_e}")
    auth_router = None  # type: ignore

logger = logging.getLogger("retainai.api")

# ── Tenancy helpers ──────────────────────────────────────────────────────────

async def ensure_demo_tenant():
    """Ensure demo-tenant-001 + admin user + org_settings exist (idempotent)."""
    try:
        from retainai.db.session import AsyncSessionLocal
        from retainai.db.models import Tenant, User, OrgSettings, UserRole
        from sqlalchemy import select
        import hashlib
        demo_tenant_id = getattr(settings, "DEMO_TENANT_ID", "demo-tenant-001")
        # fallback to env
        import os
        demo_tenant_id = os.getenv("DEMO_TENANT_ID", demo_tenant_id) or "demo-tenant-001"
        async with AsyncSessionLocal() as session:
            # Tenant
            res = await session.execute(select(Tenant).where(Tenant.id == demo_tenant_id))
            tenant = res.scalar_one_or_none()
            if not tenant:
                tenant = Tenant(id=demo_tenant_id, name="Demo Org")
                session.add(tenant)
                await session.commit()
                logger.info(f"Created demo tenant {demo_tenant_id}")
            # OrgSettings
            res2 = await session.execute(select(OrgSettings).where(OrgSettings.tenant_id == demo_tenant_id))
            if not res2.scalar_one_or_none():
                session.add(OrgSettings(tenant_id=demo_tenant_id))
                await session.commit()
                logger.info(f"Created OrgSettings for {demo_tenant_id}")
            # Demo users (admin@retainai.io) if not exist
            res3 = await session.execute(select(User).where(User.email == "admin@retainai.io"))
            if not res3.scalar_one_or_none():
                # hash demo123 if possible
                try:
                    from retainai.auth.auth import hash_password
                    ph = hash_password("demo123")
                except Exception:
                    ph = hashlib.sha256(b"demo123").hexdigest()
                demo_user = User(id=f"user_{uuid.uuid4().hex[:8]}", tenant_id=demo_tenant_id, email="admin@retainai.io", password_hash=ph, role=UserRole.ADMIN)
                session.add(demo_user)
                await session.commit()
                logger.info("Created demo admin user")
    except Exception as e:
        logger.warning(f"ensure_demo_tenant skipped: {e}")

async def ensure_tenancy_columns():
    """Migrate existing SQLite/Postgres DB: add tenant_id column nullable where missing → backfill demo-tenant-001."""
    # Only for SQLite; Postgres would use alembic. We implement generic ALTER ADD COLUMN if missing.
    tenant_tables = [
        "customers","usage_events","support_tickets","customer_feedbacks","account_events",
        "risk_assessments","investigation_reports","interventions","intervention_outcomes",
        "experience_memories","learning_candidates","agent_runs","agent_steps","system_event_logs","evidences","feature_adoptions"
    ]
    demo_tenant_id = getattr(settings, "DEMO_TENANT_ID", "demo-tenant-001")
    import os
    demo_tenant_id = os.getenv("DEMO_TENANT_ID", demo_tenant_id) or "demo-tenant-001"
    try:
        async with engine.begin() as conn:
            # Ensure tenants table exists (create_all already did, but double-check)
            await conn.run_sync(lambda sync_conn: None)
            for tbl in tenant_tables:
                try:
                    # Check if column exists via PRAGMA (SQLite) or information_schema (Postgres)
                    # Use SQLAlchemy inspector via raw SQL
                    if "sqlite" in str(engine.url):
                        res = await conn.execute(text(f"PRAGMA table_info('{tbl}')"))
                        cols = [row[1] for row in res.fetchall()]  # row[1] is name
                        if "tenant_id" not in cols:
                            logger.info(f"Migrating {tbl}: adding tenant_id nullable")
                            await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN tenant_id VARCHAR(50)"))
                            # Create index
                            try:
                                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_tenant ON {tbl}(tenant_id)"))
                            except Exception:
                                pass
                            # Backfill
                            await conn.execute(text(f"UPDATE {tbl} SET tenant_id = :tid WHERE tenant_id IS NULL"), {"tid": demo_tenant_id})
                    else:
                        # Postgres: check information_schema
                        res = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{tbl}' AND column_name='tenant_id'"))
                        if res.fetchone() is None:
                            logger.info(f"Migrating Postgres {tbl}: adding tenant_id")
                            await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50) REFERENCES tenants(id)"))
                            await conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_tenant ON {tbl}(tenant_id)"))
                            await conn.execute(text(f"UPDATE {tbl} SET tenant_id = :tid WHERE tenant_id IS NULL"), {"tid": demo_tenant_id})
                except Exception as e:
                    logger.debug(f"Migration skip for {tbl}: {e}")
                    continue
    except Exception as e:
        logger.warning(f"ensure_tenancy_columns failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    # Run tenancy migration (nullable → backfill)
    try:
        await ensure_tenancy_columns()
    except Exception as e:
        logger.warning(f"tenancy migration warning: {e}")
    # Ensure demo tenant exists
    await ensure_demo_tenant()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="RETAINAI - The Autonomous Customer Rescue Agent API (SENSE→THINK→ACT→MEASURE→LEARN) — LLM: gemini/groq (Groq LPU) via `LLM_PROVIDER` + `LLM_API_KEY`/`GROQ_API_KEY`; pagination via ?limit/offset, filtering via ?risk_level/segment/search, sorting via ?sort_by/sort_order",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS hardening: use configured origins, never wildcard with credentials (S43)
cors_origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["http://localhost:5173"]
# Sanitize: if wildcard present, strip credentials
allow_credentials = True
if "*" in cors_origins:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Phase 5 Prod Hardening: in-memory rate limiting per-tenant (primary) + per-IP fallback ──
# Prod: AUTH_ENABLED=true DEMO_MODE=false → bucket key = tenant_id when JWT present (tenant isolation, not IP)
# Demo: disabled when DEMO_MODE=true for hackathon reliability (no 429 during live demo)
# DATABASE_URL postgresql+asyncpg recommended for concurrent tenants (see docker-compose.yml sqlite fallback is dev-only)
from collections import defaultdict
_rate_bucket: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 600  # req per 60s per tenant (or per IP fallback)
_RATE_WINDOW = 60

# Request ID + TenantMiddleware + tenant observability + rate limiting (S48/S49 + Phase 1 tenant + Phase 5 prod hardening)
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    # ── TenantMiddleware: resolve tenant_id from X-Tenant-Id header or JWT tid (tenant observability) ──
    tid = request.headers.get("X-Tenant-Id") or request.headers.get("x-tenant-id")
    # Try to extract from Authorization Bearer JWT if header not present — prefer tenant_id from JWT
    if not tid:
        auth = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth[7:].strip()
            try:
                import jwt
                secret = getattr(settings, "JWT_SECRET", getattr(settings, "AUTH_SECRET", ""))
                # Decode without verify exp for middleware (auth will verify); capture tid for observability
                payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_exp": False})
                tid = payload.get("tid") or payload.get("tenant_id")
            except Exception:
                pass
    # Fallback to DEMO_TENANT_ID when DEMO_MODE (keeps demo tenant isolated but still tagged)
    if not tid and settings.DEMO_MODE:
        import os
        tid = os.getenv("DEMO_TENANT_ID", getattr(settings, "DEMO_TENANT_ID", "demo-tenant-001")) or "demo-tenant-001"
    if tid:
        request.state.tenant_id = tid  # TenantMiddleware contract: request.state.tenant_id (used by repos + observability)
    else:
        request.state.tenant_id = None

    # ── Rate limit: Phase 5 — bucket key prefers tenant_id when JWT present, else IP ──
    if request.url.path.startswith("/api/") and not settings.DEMO_MODE:
        # Prod hardening: per-tenant bucket when tenant known (JWT tid) else per-IP fallback
        tenant_key = getattr(request.state, "tenant_id", None)
        if tenant_key:
            key = f"tenant:{tenant_key}"  # per-tenant isolation when JWT present
        else:
            ip = request.client.host if request.client else "unknown"
            key = f"ip:{ip}"  # fallback per-IP when no tenant (anon)
        now = time.time()
        bucket = _rate_bucket[str(key)]
        bucket[:] = [t for t in bucket if now - t < _RATE_WINDOW]
        if len(bucket) >= _RATE_LIMIT:
            logger.warning(f"RATE_LIMITED tenant_id={tenant_key} key={key} path={request.url.path}")
            return JSONResponse(status_code=429, content={"error": {"code": "RATE_LIMITED", "message": "Too many requests, retry in 60s", "request_id": request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:8]}", "tenant_id": tenant_key}})
        bucket.append(now)

    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:8]}"
    start = time.time()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    # Phase 1/5: echo tenant for observability (X-Tenant-Id) — required for tenant-aware frontend cache key
    if getattr(request.state, "tenant_id", None):
        response.headers["X-Tenant-Id"] = str(request.state.tenant_id)
    latency = int((time.time() - start) * 1000)
    # Tenant observability: structured log with tenant_id for by_tenant breakdown (see GET /metrics/observability)
    logger.info(f"{request.method} {request.url.path} request_id={request_id} tenant_id={getattr(request.state, 'tenant_id', None)} status={response.status_code} latency={latency}ms")
    return response


# Centralized structured error handling (S47/S97) — preserve HTTPException status codes
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Preserve intentional HTTP errors (404/401/422 etc.) — must not be masked as 500
    if isinstance(exc, (FastAPIHTTPException, StarletteHTTPException)):
        raise exc
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:8]}"
    logger.error(f"Unhandled error request_id={request_id} path={request.url.path} error={exc}", exc_info=True)
    if settings.DEBUG:
        detail = str(exc)
    else:
        detail = "Internal server error"
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": detail, "request_id": request_id}},
    )

app.include_router(api_router)
app.include_router(agent_router)
if ingest_router is not None:
    app.include_router(ingest_router)
if auth_router is not None:
    app.include_router(auth_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "RETAINAI API", "version": "0.1.0", "env": settings.APP_ENV}


@app.get("/readiness")
async def readiness_check():
    """Readiness probe verifies DB connectivity (S60)."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "not_ready", "database": "unavailable", "detail": str(e)[:200]})


@app.get("/api/v1/status")
async def api_status():
    return {
        "status": "operational",
        "mode": "demo",
        "loop": "SENSE -> THINK -> ACT -> MEASURE -> LEARN",
    }
