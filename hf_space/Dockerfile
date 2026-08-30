# HF Space Dockerfile — RETAINAI Mirror (Docker SDK)
# Mirrors backend/Dockerfile 1:1, adapted for Hugging Face Spaces (expects port 7860).
# Keep in sync with backend/Dockerfile; only PORT/EXPOSE and HEALTHCHECK differ.
# ── Render uses backend/Dockerfile directly (port 8000, rootDir: backend).
# ── HF Space expects ./Dockerfile at Space repo root. To use this file on HF:
#    Option A (recommended): copy backend/ contents into Space repo root before push:
#      cp backend/pyproject.toml backend/uv.lock* backend/README.md .   # at Space root
#      cp -r backend/src ./src
#      cp hf_space/app.py ./app.py          # or retain hf_space/app.py and use COPY hf_space/app.py
#      cp hf_space/Dockerfile ./Dockerfile  # this file
#    Option B: use backend/ as subdirectory at Space root and keep COPY backend/... form (see docs/HF_SPACE_MIRROR.md §2.2 fallback).
# This self-contained form (COPY pyproject.toml ...) works for Option A (Space root = HF repo root).
FROM python:3.12-slim

# curl for healthcheck (HF & Render both use curl -f http://localhost:$PORT/health)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir uv

# Copy manifest first for layer caching (self-contained: expects pyproject.toml at context root after `cp backend/* .`)
COPY pyproject.toml uv.lock* README.md ./

# Copy source — expects src/ at context root (i.e. backend/src → ./src on HF)
COPY src ./src

# HF stub — re-exports retainai.main:app for HF port mapping
COPY app.py ./app.py
# If your Space retains hf_space/ subdir, use instead:
# COPY hf_space/app.py ./app.py
# COPY backend/src ./src
# COPY backend/pyproject.toml backend/uv.lock* backend/README.md ./

RUN uv sync --frozen || uv sync

# HF Spaces requires 7860; Render uses 8000 — respect PORT env with fallback
ENV PORT=7860
EXPOSE 7860

# Healthcheck mirrors Render's: /health on $PORT
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "uv run uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
# Alternative direct (no stub): uv run uvicorn retainai.main:app --host 0.0.0.0 --port ${PORT}
