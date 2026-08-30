# RETAINAI Development Guide

> **Audience:** Contributors, reviewers, hackathon teammates. **Stack:** Python 3.11 + `uv`, Node 20, FastAPI, Vite + React, SQLite (native) / Postgres 16 (Docker).  
> **Repo root:** `C:\Hackathons\Latent Code\RETAINAI - AI Customer Rescue Agent\`

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Native Development Path (SQLite)](#native-development-path-sqlite)
4. [Docker Path (Postgres)](#docker-path-postgres)
5. [Reset Demo -- 3 Ways](#reset-demo--3-ways)
6. [Running the Backend](#running-the-backend)
7. [Running the Frontend](#running-the-frontend)
8. [Testing & Linting](#testing--linting)
9. [Seeding -- Dataset & Idempotence](#seeding--dataset--idempotence)
10. [Project Structure](#project-structure)
11. [Common Commands Cheat Sheet](#common-commands-cheat-sheet)
12. [Troubleshooting FAQ](#troubleshooting-faq)
13. [Verification Checklist](#verification-checklist)

---

## Prerequisites

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Python** | `3.11` canonical (`backend/pyproject.toml:10` `requires-python >=3.11`, `backend/Dockerfile:1` `python:3.11-slim`). CI uses `3.12` -- see drift note | Backend, `uv`, `pytest` | `winget install Python.Python.3.11` or `pyenv` |
| **uv** | latest | Fast Python package manager (`backend/pyproject.toml` uses `uv.lock`) | `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh \| sh` (Windows: `powershell -c "irm https://astral.sh/uv/install.ps1 \| iex"`) |
| **Node.js** | `20` (`frontend/Dockerfile:1` `node:20-alpine`, `package.json` engines) | Frontend build & dev | `winget install OpenJS.NodeJS.LTS` or `nvm install 20` |
| **npm** | `10+` (ships with Node 20) | Frontend deps | Comes with Node |
| **Docker Desktop** | latest | Compose stack (Postgres + backend + nginx) | `winget install Docker.DockerDesktop` |
| **Make** | any | `Makefile:1` shortcuts | Git Bash ships `make`; or `winget install GnuWin32.Make`; or use `npm`/`uv` commands directly |
| **Git** | any | VCS | `winget install Git.Git` |
| **curl / jq** | any | Verification (`GET /health`, `/portfolio`) | Git Bash has `curl`; `winget install jqlang.jq` |

### Version Drift Warning

| Component | Declares | Actual in CI | Action |
|-----------|----------|--------------|--------|
| Python | `3.11` (`Dockerfile:1`, `pyproject.toml:10`) | `3.12` (`.github/workflows/ci.yml:19` `uv python install 3.12`) | Align before release -- either bump `Dockerfile`/`pyproject` to `3.12` or pin CI to `3.11` |

> `make` on Windows: `Makefile:36` `clean` uses `rm -rf` (Unix). Use **Git Bash** or **WSL** for `make`, or run the PowerShell equivalents in the [Cheat Sheet](#common-commands-cheat-sheet).

---

## Environment Setup

### 1. Clone & Enter

```bash
git clone <repo-url>
cd "RETAINAI - AI Customer Rescue Agent"
```

### 2. Create `.env` from Template

```bash
cp .env.example .env
# Windows (PowerShell):
Copy-Item .env.example .env
# Windows (cmd):
copy .env.example .env
```

### 3. Inspect `.env` -- What Matters

**File:** `.env.example:1` (24 lines) -- template; `.env:1` -- actual (checked in with `mock_key_for_dev`).

```ini
# Application
APP_NAME=RETAINAI
APP_ENV=development
DEBUG=true
PORT=8000

# Database -- SQLite for native dev (Postgres in compose overrides this)
DATABASE_URL=sqlite:///./retainai.db
# For PostgreSQL native: postgresql+asyncpg://postgres:postgres@localhost:5432/retainai

# LLM
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY=mock_key_for_dev

# API
API_V1_PREFIX=/api/v1
CORS_ORIGINS=["http://localhost:5173", "http://127.0.0.1:5173"]

# App Settings (currently IGNORED -- see INFRASTRUCTURE.md)
DEMO_MODE=true
LOG_LEVEL=INFO
```

| Variable | Effect in Development |
|----------|----------------------|
| `DATABASE_URL` | `sqlite:///./retainai.db` -> zero-setup native dev. Compose overrides to `postgresql+asyncpg://retainai:retainai@db:5432/retainaidb` (`docker-compose.yml:12`) |
| `LLM_API_KEY=mock_key_for_dev` | **Sentinel value** -- LLM client treats this as “no key” and returns **deterministic fallback** responses (rule-based health/risk + templated retention plan). No external API call, fully offline & reproducible. Set a real Gemini key to enable live LLM. |
| `PORT` | Declared but **not wired** -- server always `8000` via `Makefile:24` / `Dockerfile:8`. Changing `PORT` alone does nothing. |
| `CORS_ORIGINS` / `DEMO_MODE` / `LOG_LEVEL` | **Ignored** (`backend/src/retainai/config/settings.py:18` `extra="ignore"` + `backend/src/retainai/main.py:29` hardcodes `allow_origins=["*"]`) -- documented gap, safe for MVP |

> **Do not commit a real LLM key** to `.env` if `.env` is tracked. Prefer `set LLM_API_KEY=...` in your shell or a local `.env.local` (add to `.gitignore`).

### 4. Verify Env Loaded

```bash
# Native: settings reads .env via pydantic-settings (settings.py:19 env_file=".env")
cd backend && uv run python -c "from retainai.config.settings import settings; print(settings.model_dump())"

# Docker: compose reads .env via env_file + environment override
docker compose config | grep -A2 DATABASE_URL
```

---

## Native Development Path (SQLite)

Lowest friction -- no Docker. Uses SQLite (`aiosqlite`) with file `retainai.db` at repo root or `backend/` depending on CWD.

### Step-by-Step

```bash
# 1. Install backend deps (creates backend/.venv)
make setup-backend
# equivalent: cd backend && uv sync

# 2. Install frontend deps
make setup-frontend
# equivalent: cd frontend && npm install

# 3. Seed the database (creates tables + inserts 101 customers)
make seed
# equivalent: cd backend && uv run python -m retainai.scripts.seed_database
# expect: "Database seeding completed successfully: 101 customers, 3131 usage events, ..."

# 4. Run both servers concurrently (parallel make -j2)
make dev
# This runs:
#   backend:  uv run uvicorn retainai.main:app --reload --port 8000  (Makefile:24)
#   frontend: npm run dev                                           (Makefile:27)

# 5. Open
# Frontend: http://localhost:5173
# Backend docs: http://localhost:8000/docs
# Health: http://localhost:8000/health
```

### Verify Native Stack

```bash
# In a second terminal (while make dev is running):
curl -s http://localhost:8000/health | jq
# {"status":"ok","service":"RETAINAI API","version":"0.1.0","env":"development"}

curl -s http://localhost:8000/api/v1/status | jq
# {"status":"operational","mode":"demo","loop":"SENSE->THINK->ACT->MEASURE->LEARN"}

curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.total_customers'
# 101

# OpenAPI
curl -s http://localhost:8000/openapi.json | jq '.info.title'
# "RETAINAI"

# Run tests (no Docker needed -- SQLite)
make test
# or: cd backend && uv run pytest -v
```

### Running Servers Individually

```bash
# Terminal A -- backend only (with reload)
make backend
# -> cd backend && uv run uvicorn retainai.main:app --reload --port 8000
# Code changes auto-reload (watching backend/src)

# Terminal B -- frontend only (Vite HMR)
make frontend
# -> cd frontend && npm run dev
# Vite serves on :5173 with proxy /api -> http://localhost:8000 (vite.config.ts)

# Stop either with Ctrl+C. `make dev` runs both via `make -j 2` -- Ctrl+C stops both.
```

---

## Docker Path (Postgres)

Full parity stack: `backend` + `frontend` (nginx) + `db` (postgres:16-alpine). Postgres volume `postgres_data` persists until `down -v`.

### Step-by-Step

```bash
# 1. Ensure .env exists (compose reads it via env_file)
cp .env.example .env   # if not already present

# 2. Build & start detached (-d)
make docker-up
# equivalent: docker compose up --build -d

# 3. Wait for health (backend waits for db service_healthy)
docker compose ps
# backend should show (healthy) after ~15-20s (curl gap may delay -- see infra caveat)
docker compose logs -f backend   # follow startup logs
docker compose logs -f db

# 4. Seed (compose DB is empty until seeded)
# Option A -- via API (works inside & outside compose network):
curl -X POST http://localhost:8000/api/v1/system/reset | jq
# expect: {"status":"success","message":"Database reset and re-seeded with 101 customers successfully"}

# Option B -- via exec (runs inside backend container network, uses DATABASE_URL override):
docker compose exec backend uv run python -m retainai.scripts.seed_database

# 5. Verify
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics'
open http://localhost:5173       # frontend via nginx (frontend/nginx.conf:2 listen 5173)
open http://localhost:8000/docs  # Swagger

# 6. Stop
docker compose down              # safe -- keeps postgres_data volume
# DANGEROUS variant:
make docker-down                 # -> docker compose down -v -- DELETES volume (Makefile:42)
```

### Docker Logs & Exec

```bash
docker compose logs -f                # all services
docker compose logs -f backend
docker compose logs -f db
docker compose exec backend sh        # shell inside backend container
docker compose exec db psql -U retainai -d retainaidb -c "SELECT risk_level, count(*) FROM customers GROUP BY risk_level;"
```

### Rebuilding After Code Changes

```bash
docker compose up --build -d          # rebuilds changed images
docker compose build frontend          # frontend only (needed when VITE_API_BASE_URL changes -- baked at build)
docker compose restart backend
```

> Frontend `VITE_API_BASE_URL` is **baked at `npm run build`** (`frontend/Dockerfile:6`). If you change it in `docker-compose.yml:31`, you must `docker compose build frontend` then `up -d` -- a simple `restart` is not enough.

---

## Reset Demo -- 3 Ways

All three invoke `seed_demo_data()` (`backend/src/retainai/scripts/seed_database.py:73`) which does `drop_all -> create_all -> insert` -- **idempotent**, safe to run any number of times. Results are deterministic (same 101 customers, same seeded story for `acme-corp-001`).

### Way 1 -- API (works native + Docker, no shell needed)

```bash
curl -X POST http://localhost:8000/api/v1/system/reset
# -> {"status":"success","message":"Database reset and re-seeded with 101 customers successfully"}
# File: backend/src/retainai/api/routes.py:35
```

```python
import httpx
r = httpx.post("http://localhost:8000/api/v1/system/reset")
assert r.json()["status"] == "success"
```

### Way 2 -- Frontend Button

1. Open `http://localhost:5173`
2. Header -> **Reset Demo** button (`frontend/src/App.tsx:19`, calls `resetDemo()` from `frontend/src/services/api.ts:214`)
3. Button shows “Database reset successfully!” then reloads after 1s (`App.tsx:27-29`)
4. On failure: alert suggests `uv run python -m retainai.scripts.seed_database` (`App.tsx:31`)

### Way 3 -- CLI (native; or `docker compose exec` for compose)

```bash
# Native:
cd backend && uv run python -m retainai.scripts.seed_database
# or:
make seed   # Makefile:33
# or:
make smoke  # Makefile:45 -- duplicate of seed (should be curl sequence per IMPLEMENTATION_PLAN)

# Docker:
docker compose exec backend uv run python -m retainai.scripts.seed_database
```

> **When to use which:**  
> - **Demo / QA:** Way 1 or 2 (one-click, no terminal)  
> - **CI / scripts:** Way 1 (curl) or Way 3 (`make seed`)  
> - **Docker:** Way 1 is simplest (no exec needed)

---

## Running the Backend

### Option A -- `uv` (recommended)

```bash
cd backend

# Install / sync (creates .venv, respects uv.lock)
uv sync                        # or uv sync --frozen for strict lock

# Run dev server with auto-reload
uv run uvicorn retainai.main:app --reload --port 8000   # Makefile:24

# Run without reload (prod-like)
uv run uvicorn retainai.main:app --host 0.0.0.0 --port 8000  # Dockerfile:8

# One-off command (e.g., seed)
uv run python -m retainai.scripts.seed_database
uv run pytest -v
```

### Option B -- Classic `venv` + `pip` (fallback if `uv` unavailable)

```bash
cd backend
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Windows cmd:
.\.venv\Scripts\activate.bat
# macOS/Linux:
source .venv/bin/activate

pip install -e .                    # reads backend/pyproject.toml:11
# or:
pip install -e ".[dev]"             # includes pytest, ruff, mypy

python -m uvicorn retainai.main:app --reload --port 8000
python -m retainai.scripts.seed_database
pytest -v
```

### Env & DB Wiring

- `backend/src/retainai/db/session.py:9` -- `DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./retainai.db")`
- `backend/src/retainai/config/settings.py:29` -- `DATABASE_URL: str = "sqlite+aiosqlite:///./retainai.db"` via `pydantic-settings` (`env_file=".env"`)
- SQLite uses `connect_args={"check_same_thread": False}` (`session.py:14`); Postgres gets `{}`.
- Lifespan `init_db()` at `backend/src/retainai/main.py:14` calls `Base.metadata.create_all` -- no Alembic migrations. Schema is auto-created on first request if not seeded.

### Health-Weight & Risk Tuning (no restart needed for code, env needs restart)

Weights at `backend/src/retainai/config/settings.py:38-47` (defaults `0.4/0.3/0.2/0.1`) drive `HealthEngine` (`backend/src/retainai/engine/health_engine.py`). Risk thresholds `20/40/60/80` map to `CRITICAL/HIGH_RISK/AT_RISK/WATCH/STABLE/HEALTHY` (`backend/src/retainai/engine/risk_engine.py` + `settings.py:44-47`; note hardcoded `90` for `STABLE->HEALTHY` in risk engine).

---

## Running the Frontend

### Dev Server (Vite)

```bash
cd frontend
npm install          # or npm ci for clean install (CI uses npm ci -- .github/workflows/ci.yml:39)
npm run dev          # -> vite on http://localhost:5173 (Makefile:27)
# HMR enabled -- edits hot-reload
```

**Proxy config** -- `frontend/vite.config.ts:7`:

```ts
server: {
  port: 5173,
  proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } }
}
```

### API Base URL Resolution

| Context | Value | Source |
|---------|-------|--------|
| Vite dev (`npm run dev`) | `http://localhost:8000/api/v1` via proxy | `frontend/src/services/api.ts:3` fallback `import.meta.env.VITE_API_BASE_URL \|\| 'http://localhost:8000/api/v1'` |
| Vite build (`npm run build`) | Inlined at build time from `VITE_API_BASE_URL` env | `frontend/Dockerfile:6` -> `docker-compose.yml:31` hardcodes `http://localhost:8000/api/v1` |
| Docker nginx | Same inlined value -- **requires rebuild** to change | `docker compose build frontend` |

### Build & Preview

```bash
cd frontend
npm run build        # -> tsc && vite build -> dist/ (frontend/Dockerfile:6)
npm run preview      # preview dist/ locally
npm run lint         # -> tsc --noEmit (no eslint -- frontend/package.json:9)
```

### Nginx Serve (Docker)

Built frontend is copied to `nginx:alpine` at `/usr/share/nginx/html` with SPA fallback (`frontend/nginx.conf:5` `try_files $uri $uri/ /index.html`). No extra config needed.

---

## Testing & Linting

### Backend -- `pytest`

**Config:** `backend/pyproject.toml:36`:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
pythonpath = ["src"]
```

**Suite:** `backend/tests/` -- 11+3 modules, **~25 tests**:

| File | Covers |
|------|--------|
| `test_main.py` | `GET /health`, `GET /api/v1/status` smoke |
| `test_api_routes.py` | All `routes.py` endpoints (customers, timeline, events, interventions, portfolio, outcomes) |
| `test_acme_replay.py` | `AcmeReplayEngine` three-act steps |
| `test_core_engine.py` | Sense/Think/Act/Measure/Learn orchestration |
| `test_engines.py` | Engine unit + integration |
| `test_health_and_risk.py` | `HealthEngine` weights, `RiskEngine` thresholds |
| `test_signal_engine.py` | `SignalEngine` detection |
| `test_time_window.py` | `TimeWindowEngine` |
| `test_repositories_and_services.py` | Repos & services with async DB |
| `agents/test_investigation_agent.py` | Investigation agent |
| `agents/test_action_agent.py` | Action agent |
| `agents/test_orchestrator.py` | `AgentOrchestrator` full workflow |

```bash
# Run all
make test
# equivalent:
cd backend && uv run pytest -v

# Verbose with coverage (if installed)
cd backend && uv run pytest --cov=retainai --cov-report=term-missing

# Single file / test
cd backend && uv run pytest tests/test_main.py -v
cd backend && uv run pytest -k test_health -v

# Without uv (fallback venv):
pytest -v
python -m pytest -v
```

**CI runs:** `uv run pytest` on Python `3.12` after `uv sync` (`.github/workflows/ci.yml:19-25`).

### Frontend

```bash
cd frontend
npm run lint         # tsc --noEmit -- type-check only
npm run build        # tsc && vite build -- must pass for CI (ci.yml:41)
# No unit test runner configured -- CI is build-only for frontend
```

### Lint & Type (optional, not in CI)

```bash
cd backend && uv run ruff check src/          # ruff 0.3.0 (pyproject.toml:29)
cd backend && uv run ruff format src/         # format
cd backend && uv run mypy src/                # mypy 1.9.0
```

> CI does **not** run `ruff`/`mypy` yet -- tracked as future hardening. Run locally before PR.

---

## Seeding -- Dataset & Idempotence

### Dataset Source

| Property | Value |
|----------|-------|
| **File** | `data/seed/retainai_dataset_v2.json` (resolved via `backend/src/retainai/scripts/seed_database.py:get_dataset_path()` with 4 candidate paths) |
| **Customers** | `101` |
| **Usage events** | `~3131` |
| **Support tickets** | `~82` |
| **Customer feedbacks** | `~94` |
| **Experience memories** | `1` seeded (`mem-001` -- Enterprise CSV Export Friction, `VALIDATED`, `confidence 0.92`) |

### Archetype -> Risk & Health Mapping (`seed_database.py:ARCHETYPE_*`)

| Archetype | `RiskLevel` | Health |
|-----------|-------------|--------|
| `ACME_HERO` | `HEALTHY` | `88.0` |
| `HEALTHY` | `HEALTHY` | `92.5` |
| `RECOVERING` | `STABLE` | `78.0` |
| `EARLY_WARNING` | `WATCH` | `68.0` |
| `AT_RISK` | `AT_RISK` | `42.0` |
| `CRITICAL` | `CRITICAL` | `18.0` |

### Idempotence Guarantees

- `seed_demo_data()` (`seed_database.py:73`) always does `drop_all -> create_all` inside `engine.begin()` -- previous data is fully discarded.
- Primary keys from dataset (`id` fields) are reused -- re-seed produces identical IDs (important for `acme-corp-001` demo hero).
- Safe to call via any of the 3 reset ways; no duplicate-row risk.
- SQLite file `retainai.db` is recreated in place; for Docker, the volume `postgres_data` is truncated but not removed (unlike `down -v` which deletes the volume).

```bash
# Run twice -- same result:
make seed && curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.total_customers'
# 101 both times

make seed && curl -s http://localhost:8000/api/v1/customers/acme-corp-001 | jq '{id, health_score, risk_level}'
# identical both times
```

---

## Project Structure

```
backend/
├── pyproject.toml          # deps + pytest + ruff config
├── Dockerfile              # python:3.11-slim, uv
├── src/retainai/
│   ├── main.py             # FastAPI lifespan + CORS + router mount
│   ├── config/settings.py  # pydantic-settings (env_file .env, extra ignore)
│   ├── db/
│   │   ├── session.py      # engine, AsyncSessionLocal, Base, init_db, get_db
│   │   └── models.py       # SQLAlchemy ORM: Customer, UsageEvent, SupportTicket, …
│   ├── models/schemas.py   # Pydantic request/response schemas (186 lines)
│   ├── api/
│   │   ├── routes.py       # ← mounted primary router
│   │   ├── agent_routes.py # ← mounted agent router
│   │   ├── agent.py        # orphaned -- NOT MOUNTED (import bug)
│   │   ├── customers.py    # orphaned -- NOT MOUNTED (ordering bug)
│   │   └── experience.py   # orphaned -- NOT MOUNTED (ordering bug)
│   ├── engine/             # health_engine, risk_engine, signal_engine, time_window, learning_engine
│   ├── agents/             # orchestrator, investigation_agent, action_agent, llm_client
│   ├── services/           # customer_service, signal_service, timeline_service, …
│   ├── repositories/       # customer_repository, evidence_repository, memory_repository
│   ├── demo/acme_replay.py # three-act story engine
│   └── scripts/seed_database.py
└── tests/                  # 11+3 modules, ~25 tests

frontend/
├── package.json            # vite, react 18, axios, tailwind
├── vite.config.ts          # dev proxy /api -> :8000
├── nginx.conf              # SPA fallback
├── Dockerfile              # node:20-alpine build -> nginx:alpine
└── src/
    ├── App.tsx             # tab nav + Reset Demo
    ├── services/api.ts     # axios client + typed interfaces
    └── components/         # CommandCenter, Customer360, ActionCenter

data/seed/retainai_dataset_v2.json
docker-compose.yml
Makefile
.env / .env.example
infra/README.md
.github/workflows/ci.yml
docs/                        # this guide + API_REFERENCE + INFRASTRUCTURE + …
```

---

## Common Commands Cheat Sheet

| Task | `make` | Direct Command | Notes |
|------|--------|----------------|-------|
| **Setup backend** | `make setup-backend` | `cd backend && uv sync` | Creates `backend/.venv` |
| **Setup frontend** | `make setup-frontend` | `cd frontend && npm install` | CI uses `npm ci` |
| **Dev (both)** | `make dev` | `make -j 2 backend frontend` | Parallel; Ctrl-C stops both |
| **Backend only** | `make backend` | `cd backend && uv run uvicorn retainai.main:app --reload --port 8000` | Auto-reload |
| **Frontend only** | `make frontend` | `cd frontend && npm run dev` | Vite HMR `:5173` |
| **Test** | `make test` | `cd backend && uv run pytest -v` | ~25 tests; `asyncio_mode auto` |
| **Seed** | `make seed` | `cd backend && uv run python -m retainai.scripts.seed_database` | Idempotent; 101 customers |
| **Smoke** | `make smoke` | *(same as seed)* | Duplicate -- should be curl sequence per plan |
| **Clean** | `make clean` | `rm -rf backend/.venv frontend/node_modules frontend/dist backend/__pycache__` | **Windows:** use PowerShell `Remove-Item -Recurse -Force` |
| **Docker up** | `make docker-up` | `docker compose up --build -d` | Detached; rebuilds |
| **Docker down (safe)** | -- | `docker compose down` | Keeps `postgres_data` |
| **Docker down (destructive)** | `make docker-down` | `docker compose down -v` | **Deletes** volume |
| **Reset via API** | -- | `curl -X POST http://localhost:8000/api/v1/system/reset` | Works native & Docker |
| **Logs** | -- | `docker compose logs -f [backend\|db\|frontend]` | Follow mode |
| **PS** | -- | `docker compose ps` | Health status |
| **DB shell (compose)** | -- | `docker compose exec db psql -U retainai -d retainaidb` | Postgres CLI |
| **Frontend build** | -- | `cd frontend && npm run build` | `tsc && vite build` -> `dist/` |
| **Frontend lint** | -- | `cd frontend && npm run lint` | `tsc --noEmit` |

### Without `make` (Windows / minimal env)

```powershell
# PowerShell equivalents for make targets:
cd backend; uv sync                                    # setup-backend
cd frontend; npm install                               # setup-frontend
cd backend; uv run uvicorn retainai.main:app --reload --port 8000  # backend
cd frontend; npm run dev                               # frontend (second terminal)
cd backend; uv run pytest -v                           # test
cd backend; uv run python -m retainai.scripts.seed_database  # seed
Remove-Item -Recurse -Force backend\.venv, frontend\node_modules, frontend\dist -ErrorAction SilentlyContinue  # clean

# Docker (same as make):
docker compose up --build -d
docker compose down        # safe
docker compose down -v     # destructive
```

---

## Troubleshooting FAQ

| Symptom | Cause | Fix |
|---------|-------|-----|
| `uv: command not found` | `uv` not installed | `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh \| sh`; Windows: `powershell -c "irm https://astral.sh/uv/install.ps1 \| iex"` |
| `python: command not found` / wrong version | Python not on PATH or `<3.11` | `winget install Python.Python.3.11`; ensure `python --version` -> `3.11.x`; `uv python install 3.11` |
| `npm: command not found` | Node not installed | `winget install OpenJS.NodeJS.LTS`; `node --version` -> `v20.x` |
| `port 8000 already in use` | Another process or previous `make dev` still running | `netstat -ano \| findstr :8000` -> `taskkill /PID <pid> /F`; or change port in `Makefile:24` + `vite.config.ts` proxy |
| `port 5432 already in use` on `docker compose up` | Host Postgres running | `Get-Process postgres`; stop host service or remap compose: `"5433:5432"` in `docker-compose.yml:41` |
| `make: command not found` (Windows) | `make` not installed on Windows | Use Git Bash (ships `make`), or WSL, or run direct commands from cheat sheet |
| `make clean` fails on Windows | `rm -rf` is Unix | Run in Git Bash, or PowerShell: `Remove-Item -Recurse -Force backend\.venv, frontend\node_modules, frontend\dist` |
| `curl: not found` in `docker compose logs backend` healthcheck | `python:3.11-slim` lacks `curl` (`backend/Dockerfile:1` vs `docker-compose.yml:17`) | Add to `backend/Dockerfile:3`: `RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*` then rebuild |
| `VITE_API_BASE_URL` change has no effect | Baked at build (`frontend/Dockerfile:6`) | `docker compose build frontend && docker compose up -d` |
| `CORS` error in browser despite `CORS_ORIGINS` | Ignored (`main.py:29` hardcodes `["*"]`, `settings.py:18` `extra="ignore"`) | Keep permissive for MVP, or wire `settings.CORS_ORIGINS` into `CORSMiddleware` |
| `DATABASE_URL` env ignored in compose | Compose `environment` override wins (`docker-compose.yml:12`) | Edit `docker-compose.yml:12` directly or remove override to use `.env` |
| `docker compose down -v` deleted data | `-v` removes `postgres_data` (`Makefile:42`) | Use `docker compose down` (no `-v`); re-seed via `POST /system/reset` or `make seed` |
| `No module named 'retainai'` when running `pytest` | `pythonpath` not set or wrong CWD | Run from `backend/` dir: `cd backend && uv run pytest`; config `pythonpath = ["src"]` (`pyproject.toml:39`) handles it |
| `asyncio` test warnings / failures | `pytest-asyncio` mode | Already set `asyncio_mode = auto` (`pyproject.toml:37`); ensure `pytest-asyncio>=0.23.5` installed |
| Frontend `404` on hard refresh of `/customers/xxx` | SPA fallback not applied (would be nginx misconfig) | Already fixed: `try_files $uri /index.html` (`frontend/nginx.conf:5`) -- never happens |
| Backend `500` on `POST /system/reset` or agent investigate | DB not seeded or LLM error | Check `docker compose logs backend`; re-seed; with `mock_key_for_dev` agent uses deterministic fallback (no LLM call) |
| `open http://localhost:8000/docs` 404 | Backend not running | `docker compose ps`; `make backend`; check `PORT` vs `8000` hardcode |
| `tsc` errors on `npm run build` | Type mismatch in `frontend/src/services/api.ts` or components | `cd frontend && npm run lint` -> fix types; ensure `VITE_API_BASE_URL` typing |

---

## Verification Checklist

### Native (SQLite) -- Run After `make dev`

```bash
# Health & status
curl -s http://localhost:8000/health | jq
# expect {"status":"ok","service":"RETAINAI API","version":"0.1.0","env":"development"}

curl -s http://localhost:8000/api/v1/status | jq
# expect {"status":"operational","mode":"demo","loop":"SENSE->THINK->ACT->MEASURE->LEARN"}

# Portfolio -- 101 customers
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.total_customers'
# expect 101

# Customer & timeline
curl -s http://localhost:8000/api/v1/customers/acme-corp-001 | jq '{id, health_score, risk_level}'
curl -s "http://localhost:8000/api/v1/customers/acme-corp-001/timeline?days=60" | jq length

# Signals & risk
curl -s http://localhost:8000/api/v1/customers/acme-corp-001/signals | jq length
curl -s http://localhost:8000/api/v1/customers/acme-corp-001/risk | jq

# Event ingestion
curl -s -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"acme-corp-001","event_type":"FEEDBACK_SUBMITTED","payload":{"sentiment":"NEGATIVE","score":1}}' | jq

# Tests
cd backend && uv run pytest -v
# expect ~25 passed
cd frontend && npm run build
# expect tsc && vite build success

# OpenAPI
curl -s http://localhost:8000/openapi.json | jq '.info.title'
# "RETAINAI"
open http://localhost:8000/docs
open http://localhost:5173
```

### Docker (Postgres)

```bash
docker compose ps                              # backend (healthy), db (healthy), frontend running
docker compose exec db psql -U retainai -d retainaidb -c "SELECT count(*) FROM customers;"
# expect 101 after POST /system/reset

# Same curl suite as native (ports are identical)
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics'

# Frontend via nginx
curl -s http://localhost:5173/ | head -n 20
# contains <div id="root"> -> nginx serving dist/index.html
```

> File references are relative to repo root. Backend served by `uvicorn retainai.main:app` (`backend/Dockerfile:8`, `Makefile:24`); frontend by `vite` dev or `nginx:alpine` (`frontend/Dockerfile:8`, `frontend/nginx.conf:2`).

