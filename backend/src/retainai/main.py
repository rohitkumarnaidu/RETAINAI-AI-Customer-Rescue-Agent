"""FastAPI Application Entrypoint."""

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
    from retainai.auth.auth import router as auth_router
except Exception as _auth_e:
    import logging as _lg
    _lg.getLogger("retainai.api").warning(f"Auth router not loaded: {_auth_e}")
    auth_router = None  # type: ignore

logger = logging.getLogger("retainai.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="RETAINAI - The Autonomous Customer Rescue Agent API",
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

# Request ID + observability middleware (S48/S49)
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:8]}"
    start = time.time()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    latency = int((time.time() - start) * 1000)
    logger.info(f"{request.method} {request.url.path} request_id={request_id} status={response.status_code} latency={latency}ms")
    return response


# Centralized structured error handling (S47/S97)
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
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
