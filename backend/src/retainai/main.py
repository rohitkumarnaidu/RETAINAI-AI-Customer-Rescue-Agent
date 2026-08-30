"""FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from retainai.config import settings
from retainai.db.session import init_db
from retainai.api.routes import router as api_router
from retainai.api.agent_routes import router as agent_router


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(agent_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "RETAINAI API", "version": "0.1.0", "env": settings.APP_ENV}


@app.get("/api/v1/status")
async def api_status():
    return {
        "status": "operational",
        "mode": "demo",
        "loop": "SENSE -> THINK -> ACT -> MEASURE -> LEARN",
    }
