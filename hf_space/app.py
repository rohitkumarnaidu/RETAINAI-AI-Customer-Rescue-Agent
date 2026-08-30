"""
HF Space app.py stub — RETAINAI Mirror (deploy/hybrid-live-dynamic)

Hugging Face Docker SDK expects an app on port 7860.
This stub re-exports the canonical FastAPI app from backend/src/retainai/main.py
so the HF Space and Render service run identical code with zero drift.

Usage:
  - Local:  uv run uvicorn app:app --host 0.0.0.0 --port 7860 --reload
  - HF:     CMD in Dockerfile runs this automatically.
  - Direct: uv run uvicorn retainai.main:app --host 0.0.0.0 --port 7860  (equivalent, no stub needed)

Env:
  - GROQ_API_KEY / LLM_API_KEY / OPENAI_API_KEY (set as HF Space Secrets, sync:false)
  - LLM_PROVIDER=groq, LLM_MODEL=openai/gpt-oss-120b
  - DATABASE_URL=sqlite+aiosqlite:///./retainai.db (ephemeral on HF)
  - CORS_ORIGINS=https://retainai-rescue-agent.vercel.app,http://localhost:5173,https://<user>-retainai-live-mirror.hf.space
  - DEMO_MODE=true, AUTH_ENABLED=false (mirror demo defaults)
  - PORT=7860 (HF requires 7860; Render uses 8000)
"""

# Re-export canonical app — do not fork logic here.
try:
    from retainai.main import app  # type: ignore
except Exception as e:  # pragma: no cover - import-time diagnostics for HF logs
    import logging

    logging.getLogger("retainai.hf").warning(f"Failed to import retainai.main:app: {e}")

    # Fallback minimal app so HF healthcheck still surfaces the error
    from fastapi import FastAPI

    app = FastAPI(title="RETAINAI HF Mirror (import failed)")
    _import_error = str(e)

    @app.get("/health")
    async def health():
        return {"status": "error", "service": "RETAINAI HF Mirror", "detail": _import_error}

    @app.get("/readiness")
    async def readiness():
        return {"status": "not_ready", "detail": _import_error}
