# RETAINAI Infrastructure & Deployment Guide

> **Scope:** Local development + Docker Compose. **No cloud deployment -- local-only MVP.** All paths relative to workspace root `C:\Hackathons\Latent Code\RETAINAI - AI Customer Rescue Agent\`.

---

## Table of Contents

1. [Overview](#overview)
2. [Monorepo Layout](#monorepo-layout)
3. [Docker Compose -- 3-Service Stack](#docker-compose--3-service-stack)
4. [Environment & DATABASE_URL Handling](#environment--database_url-handling)
5. [Dockerfiles](#dockerfiles)
6. [Nginx](#nginx)
7. [Makefile Targets](#makefile-targets)
8. [Environment Variables Reference](#environment-variables-reference)
9. [Health Checks & Lifecycle](#health-checks--lifecycle)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Current Deployment Scope (Local-Only)](#current-deployment-scope-local-only)
12. [Observability Gap](#observability-gap)
13. [Rollback & Reset](#rollback--reset)
14. [Future Roadmap -- Stages 4–6](#future-roadmap--stages-46)
15. [Verification](#verification)
16. [Troubleshooting -- Infra FAQ](#troubleshooting--infra-faq)

---

## Overview

| Property | Value |
|----------|-------|
| **Compose file** | `docker-compose.yml:1` (`version: '3.8'`) |
| **Services** | `backend` (FastAPI :8000), `frontend` (Nginx :5173), `db` (Postgres 16) |
| **Python canonical** | `3.11` (`backend/Dockerfile:1`, `backend/pyproject.toml:10` `requires-python >=3.11`) -- CI uses `3.12` drift (see CI section) |
| **Node** | `20-alpine` (`frontend/Dockerfile:1`) |
| **DB (compose)** | `postgres:16-alpine` (`docker-compose.yml:34`) |
| **DB (native dev)** | SQLite via `aiosqlite` (`backend/pyproject.toml:16`, `backend/src/retainai/db/session.py:9`) |
| **Volumes** | `postgres_data:/var/lib/postgresql/data` (`docker-compose.yml:50-51`) |
| **Infra README** | `infra/README.md:1` -- 7 lines minimal; this doc is authoritative |

```
                 ┌─────────────┐      :8000      ┌──────────────────┐
  Browser ──────►│  frontend   │────────────────►│     backend      │
  :5173          │  nginx:alpine│  VITE_API_BASE  │  python:3.11-slim│
                 │  (static)   │  http://backend  │  FastAPI+uvicorn│
                 └─────────────┘                  └────────┬─────────┘
                                                           │ asyncpg
                                                  ┌────────▼─────────┐
                                                  │   db             │
                                                  │ postgres:16      │
                                                  │ :5432            │
                                                  └──────────────────┘
```

---

## Monorepo Layout

```
RETAINAI - AI Customer Rescue Agent/
├── backend/
│   ├── Dockerfile               # python:3.11-slim, uv sync, uvicorn  (8 lines)
│   ├── pyproject.toml           # deps: fastapi, sqlalchemy[asyncio], asyncpg, aiosqlite, httpx, jinja2
│   ├── uv.lock
│   ├── README.md
│   └── src/retainai/
│       ├── main.py              # FastAPI app + lifespan (50 lines)
│       ├── config/settings.py   # pydantic-settings, extra="ignore" (59 lines)
│       ├── db/session.py        # engine, Base, init_db (40 lines)
│       ├── db/models.py         # Customer, RiskLevel, Intervention, AgentRun, ExperienceMemory …
│       ├── api/routes.py        # primary router prefix /api/v1 (204 lines)
│       ├── api/agent_routes.py  # agent router prefix /api/v1/agent (74 lines)
│       ├── api/agent.py         # ORPHANED -- not mounted (34 lines)
│       ├── api/customers.py     # ORPHANED -- not mounted (50 lines)
│       ├── api/experience.py    # ORPHANED -- not mounted (33 lines)
│       ├── engine/              # health_engine, risk_engine, signal_engine, learning_engine
│       ├── agents/              # orchestrator, investigation_agent, action_agent
│       ├── services/            # customer_service, signal_service, timeline_service, …
│       ├── repositories/        # customer_repository, evidence_repository, memory_repository
│       ├── demo/acme_replay.py  # AcmeReplayEngine (three-act demo)
│       └── scripts/seed_database.py  # seed_demo_data() -- drops+creates+seeds 101
├── frontend/
│   ├── Dockerfile               # node:20-alpine build -> nginx:alpine (12 lines)
│   ├── nginx.conf               # listen 5173, try_files fallback (6 lines)
│   ├── package.json             # vite, react 18, axios, tailwind 3
│   ├── vite.config.ts           # dev proxy /api -> localhost:8000
│   └── src/
│       ├── App.tsx              # tabs + Reset Demo -> POST /system/reset (App.tsx:19)
│       ├── services/api.ts      # axios baseURL = VITE_API_BASE_URL || localhost:8000/api/v1
│       └── components/          # CommandCenter, Customer360, ActionCenter
├── data/seed/retainai_dataset_v2.json  # 101 customers, 3131 usage, 82 tickets, 94 feedback
├── docker-compose.yml           # 3 services, healthchecks, volume (51 lines)
├── Makefile                     # 11 targets inc. docker-up/down, smoke, clean (45 lines)
├── .env                         # actual env (mock_key_for_dev)
├── .env.example                 # template (24 lines)
├── infra/README.md              # 7 lines minimal
└── .github/workflows/ci.yml     # 2 jobs: backend-tests, frontend-tests (42 lines)
```

---

## Docker Compose -- 3-Service Stack

**File:** `docker-compose.yml:1`

### `backend` -- `docker-compose.yml:4`

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  ports:
    - "8000:8000"
  env_file: .env
  environment:
    - DATABASE_URL=postgresql+asyncpg://retainai:retainai@db:5432/retainaidb
    - LLM_PROVIDER=${LLM_PROVIDER:-gemini}
    - LLM_MODEL=${LLM_MODEL:-gemini-2.5-flash}
    - LLM_API_KEY=${LLM_API_KEY}
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    retries: 5
  depends_on:
    db:
      condition: service_healthy
```

| Aspect | Detail |
|--------|--------|
| **Build context** | `./backend` (`docker-compose.yml:6`) |
| **Port** | `8000:8000` -- FastAPI + Uvicorn |
| **`env_file`** | `.env` -- loaded first, then `environment` overrides (`docker-compose.yml:10-15`) |
| **`DATABASE_URL` override** | Hard-overridden to `postgresql+asyncpg://retainai:retainai@db:5432/retainaidb` -- **ignores** `DATABASE_URL` from `.env`/`.env.example` (`sqlite:///./retainai.db`) when running via compose |
| **LLM vars** | `LLM_PROVIDER`/`MODEL` default via `${VAR:-default}`; `LLM_API_KEY` passed through (no default) |
| **Healthcheck** | `curl -f http://localhost:8000/health` every `10s`, `5` retries (`docker-compose.yml:16-18`) -- **gap:** `backend/Dockerfile:1` is `python:3.11-slim` which **does not include `curl`**; healthcheck will fail until `curl` is installed (add `apt-get update && apt-get install -y curl` to Dockerfile) |
| **Depends on** | `db` `service_healthy` -- waits for `pg_isready` (`docker-compose.yml:20-22`) |

### `frontend` -- `docker-compose.yml:24`

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  ports:
    - "5173:5173"
  environment:
    - VITE_API_BASE_URL=http://localhost:8000/api/v1
```

| Aspect | Detail |
|--------|--------|
| **Build** | Multi-stage `node:20-alpine` -> `nginx:alpine` (`frontend/Dockerfile:1`) |
| **Port** | `5173:5173` (Nginx listens `5173` per `frontend/nginx.conf:2`) |
| **`VITE_*` caveat** | **Baked at build time, not runtime.** `VITE_API_BASE_URL` is an `environment` var at compose time but Vite inlines `import.meta.env.VITE_*` at `npm run build` (`frontend/Dockerfile:6`). Changing the compose `environment` without rebuilding does **nothing** -- the value in `dist/` is frozen at build. To point at a different backend, rebuild: `docker compose build frontend` |
| **`env_file` gap** | Frontend service has **no `env_file`** -- only `environment` (`docker-compose.yml:30-31`); `.env` is not read for frontend |
| **Hardcoded origin** | Compose hardcodes `http://localhost:8000/api/v1`; not configurable via `.env` without editing compose |

### `db` -- `docker-compose.yml:33`

```yaml
db:
  image: postgres:16-alpine
  restart: always
  environment:
    POSTGRES_USER: retainai
    POSTGRES_PASSWORD: retainai
    POSTGRES_DB: retainaidb
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U retainai -d retainaidb"]
    interval: 5s
    timeout: 5s
    retries: 5
```

| Aspect | Detail |
|--------|--------|
| **Image** | `postgres:16-alpine` |
| **Credentials** | `retainai` / `retainai` / `retainaidb` (`docker-compose.yml:36-39`) -- matches `DATABASE_URL` override |
| **Port** | `5432:5432` exposed to host -- conflict if host Postgres already on `5432` |
| **Volume** | `postgres_data` named volume (`docker-compose.yml:42-43`, `50-51`) -- persists across `docker compose up` but **deleted** by `docker compose down -v` / `make docker-down` |
| **Healthcheck** | `pg_isready -U retainai -d retainaidb` every `5s` (`docker-compose.yml:44-48`) |
| **Restart** | `always` -- restarts on failure even outside compose lifecycle |

### Volumes -- `docker-compose.yml:50`

```yaml
volumes:
  postgres_data:
```

No driver options -- default `local` volume.

### Caveats Summary

| # | Caveat | File:Line | Impact | Fix |
|---|--------|-----------|--------|-----|
| 1 | `VITE_API_BASE_URL` baked at build | `docker-compose.yml:31` + `frontend/Dockerfile:6` | Env change requires rebuild | Rebuild frontend or inject via `window.__ENV__` / nginx sub_filter |
| 2 | Backend healthcheck needs `curl` missing in `python:3.11-slim` | `docker-compose.yml:17` vs `backend/Dockerfile:1` | Healthcheck always fails -> `depends_on` never satisfied in some Docker versions | `RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*` |
| 3 | Frontend not reading `.env` | `docker-compose.yml:24-31` | `.env` `VITE_*` ignored | Add `env_file: .env` or keep hardcoded env |
| 4 | `.env` `DATABASE_URL` ignored in compose | `docker-compose.yml:12` | SQLite URL in `.env.example:10` misleading for compose | Document precedence |
| 5 | `docker compose down -v` deletes volume | `Makefile:42` + `docker-compose.yml:50` | Data loss | Use `down` without `-v` for safe stop |

---

## Environment & DATABASE_URL Handling

Two code paths resolve `DATABASE_URL` -- they **both default to SQLite** but via different mechanisms:

| Layer | File:Line | Code | Behavior |
|-------|-----------|------|----------|
| **Settings (Pydantic)** | `backend/src/retainai/config/settings.py:29` | `DATABASE_URL: str = "sqlite+aiosqlite:///./retainai.db"` | Read via `pydantic-settings` from `env_file=".env"` (`settings.py:19`), `extra="ignore"` -> unknown keys silently dropped |
| **Session (SQLAlchemy)** | `backend/src/retainai/db/session.py:9` | `os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./retainai.db")` | Direct `os.getenv` fallback -- used to create `engine` |
| **Engine connect_args** | `backend/src/retainai/db/session.py:14` | `connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}` | SQLite needs `check_same_thread=False` for async; Postgres gets `{}` |

### Precedence (native dev)

```
.env  ──►  os.getenv / pydantic-settings  ──►  sqlite+aiosqlite:///./retainai.db
                                        (fallback if .env missing)
```

### Precedence (Docker Compose)

```
.env  ──►  compose env_file  ──►  compose environment DATABASE_URL override
                                   postgresql+asyncpg://retainai:retainai@db:5432/retainaidb
                                   (wins -- .env value discarded)
```

### URL Forms

| Context | URL | Driver | When |
|---------|-----|--------|------|
| Native dev SQLite | `sqlite+aiosqlite:///./retainai.db` | `aiosqlite` (`backend/pyproject.toml:16`) | Default when `.env` has `DATABASE_URL=sqlite:///./retainai.db` (note: `sqlite://` vs `sqlite+aiosqlite://` -- SQLAlchemy normalizes; session.py adds `aiosqlite` if needed) |
| Postgres native | `postgresql+asyncpg://retainai:retainai@localhost:5432/retainaidb` | `asyncpg` (`backend/pyproject.toml:17`) | Manual override for parity testing |
| Compose Postgres | `postgresql+asyncpg://retainai:retainai@db:5432/retainaidb` | `asyncpg` | `host=db` inside Docker network |

> `session.py:9` does **not** use `settings.DATABASE_URL` -- it reads `os.getenv` directly. Changing `settings.DATABASE_URL` without setting the env var has no effect on the engine. Keep them in sync.

---

## Dockerfiles

### Backend -- `backend/Dockerfile:1` (8 lines)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock* README.md ./
COPY src ./src
RUN uv sync --frozen || uv sync
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "retainai.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

| Step | Purpose | Notes |
|------|---------|-------|
| `FROM python:3.11-slim` | Minimal Debian-based Python | No `curl` -- breaks healthcheck (see caveats) |
| `RUN pip install uv` | Install Astral `uv` package manager | Fast resolver; respects `uv.lock` |
| `COPY pyproject.toml uv.lock* README.md` | Copy manifests before source for layer caching | `README.md` required by `hatchling` build (`backend/pyproject.toml:33`) |
| `COPY src ./src` | Copy application source | |
| `RUN uv sync --frozen \|\| uv sync` | Install deps; `--frozen` enforces lock, fallback allows lock drift | Creates `.venv` inside image |
| `EXPOSE 8000` | Document port | Compose maps `8000:8000` |
| `CMD uv run uvicorn ...` | Start ASGI server bound to `0.0.0.0:8000` | Matches `Makefile:24` native `uv run uvicorn --reload` |

> No `HEALTHCHECK` instruction in the Dockerfile itself -- healthcheck lives in compose (`docker-compose.yml:16`).

### Frontend -- `frontend/Dockerfile:1` (12 lines)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
```

| Stage | Purpose | Notes |
|-------|---------|-------|
| `build` | `node:20-alpine`, `npm ci`, `npm run build` (`tsc && vite build` per `frontend/package.json:8`) | Produces `dist/`; `VITE_API_BASE_URL` inlined here |
| `nginx` | `nginx:alpine`, copies `dist` + `nginx.conf`, `EXPOSE 5173` | Serves SPA with fallback |

---

## Nginx

**File:** `frontend/nginx.conf:1` (6 lines)

```nginx
server {
  listen 5173;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

| Directive | Value | Purpose |
|-----------|-------|---------|
| `listen` | `5173` | Matches `docker-compose.yml:29` port mapping |
| `root` | `/usr/share/nginx/html` | Vite `dist` output |
| `try_files` | `$uri $uri/ /index.html` | SPA fallback -- client-side routing (React) |

No gzip, caching headers, or proxy pass in this MVP config. API calls go directly to `http://localhost:8000` via browser (CORS `allow_origins=["*"]` at `backend/src/retainai/main.py:29`).

---

## Makefile Targets

**File:** `Makefile:1` (45 lines). 11 targets.

| Target | Command | Purpose | Notes / Caveat |
|--------|---------|---------|----------------|
| `help` | `@echo` block | Print CLI help | **Outdated** -- lists only 7 of 11 targets; missing `docker-up`, `docker-down`, `smoke` |
| `setup-backend` | `cd backend && uv sync` (`Makefile:15`) | Install Python deps | Requires `uv` on PATH |
| `setup-frontend` | `cd frontend && npm install` (`Makefile:18`) | Install Node deps | Uses `npm install` not `npm ci` |
| `dev` | `make -j 2 backend frontend` (`Makefile:21`) | Run both servers concurrently | Parallel via `-j 2`; Ctrl-C kills both; runs `--reload` backend |
| `backend` | `cd backend && uv run uvicorn retainai.main:app --reload --port 8000` (`Makefile:24`) | Backend only | Reload mode; SQLite default |
| `frontend` | `cd frontend && npm run dev` (`Makefile:27`) | Frontend only | Vite dev server `5173` with proxy `/api -> localhost:8000` (`frontend/vite.config.ts`) |
| `test` | `cd backend && uv run pytest` (`Makefile:30`) | Run pytest suite | ~25 tests (`backend/tests`); `asyncio_mode = auto` (`backend/pyproject.toml:37`) |
| `seed` | `cd backend && uv run python -m retainai.scripts.seed_database` (`Makefile:33`) | Seed demo data | Idempotent drop+recreate+seed 101 customers |
| `clean` | `rm -rf backend/.venv frontend/node_modules frontend/dist backend/__pycache__` (`Makefile:36`) | Remove artifacts | **Windows gap:** `rm -rf` fails on `cmd.exe`/`PowerShell` -- use `Remove-Item -Recurse -Force` or `make` via Git Bash/WSL |
| `docker-up` | `docker compose up --build -d` (`Makefile:39`) | Build & start compose detached | Rebuilds images; `-d` detached |
| `docker-down` | `docker compose down -v` (`Makefile:42`) | Stop & **delete volume** | **Destructive:** `-v` removes `postgres_data` -> data loss; use `docker compose down` without `-v` for safe stop |
| `smoke` | `cd backend && uv run python -m retainai.scripts.seed_database` (`Makefile:45`) | Duplicate of `seed` | **Should be** a curl sequence per `IMPLEMENTATION_PLAN.md` -- currently just re-seeds; no HTTP verification |

### Typical Flows

```bash
make setup-backend && make setup-frontend   # first time
make dev                                     # native concurrent dev
make test                                    # backend tests
make seed                                    # re-seed
make docker-up                               # compose
make docker-down                             # DANGEROUS -- deletes volume
```

---

## Environment Variables Reference

**Template:** `.env.example:1` (24 lines) | **Actual:** `.env:1` (same with `LLM_API_KEY=mock_key_for_dev`)

| Variable | Example | Used By | Read? | Notes |
|----------|---------|---------|-------|-------|
| `APP_NAME` | `RETAINAI` | `backend/src/retainai/config/settings.py:24` | ✅ | FastAPI `title` (`main.py:21`) |
| `APP_ENV` | `development` | `settings.py:25`, `main.py:41` | ✅ | Returned at `GET /health` |
| `DEBUG` | `true` | `settings.py:26` | ✅ | No effect on FastAPI debug mode currently (not wired) |
| `PORT` | `8000` | `settings.py:27` | ✅ (declared) | **Not used** to start server -- `uvicorn --port 8000` hardcoded (`Makefile:24`, `Dockerfile:8`) |
| `DATABASE_URL` | `sqlite:///./retainai.db` | `settings.py:29` + `session.py:9` | ✅ (session) / ⚠️ (settings) | Session reads `os.getenv` directly; compose overrides to `postgresql+asyncpg://...` |
| `LLM_PROVIDER` | `gemini` | `settings.py:31` | ✅ | `gemini` is only provider wired; mock fallback if key is `mock_key_for_dev` |
| `LLM_MODEL` | `gemini-2.5-flash` | `settings.py:32` | ✅ | Used by `AgentOrchestrator` |
| `LLM_API_KEY` | `your_llm_api_key_here` / `mock_key_for_dev` | `settings.py:33`, LLM client | ✅ | `mock_key_for_dev` triggers deterministic fallback (no LLM call) in `llm_client` |
| `API_V1_PREFIX` | `/api/v1` | `settings.py:35` | ✅ (declared) | **Not used** -- routers hardcode `prefix="/api/v1"` (`routes.py:32`, `agent_routes.py:13`) |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | `settings.py` (ignored) | ❌ **IGNORED** | `settings.py:18` `extra="ignore"` + `main.py:27-33` hardcodes `allow_origins=["*"]` -- env value never read |
| `DEMO_MODE` | `true` | -- | ❌ **IGNORED** | `extra="ignore"` -- no code reads this key |
| `LOG_LEVEL` | `INFO` | -- | ❌ **IGNORED** | `extra="ignore"` -- logging uses `logging` defaults, not this var |
| `HEALTH_WEIGHT_USAGE` | `0.40` | `settings.py:38` | ✅ | HealthEngine weight |
| `HEALTH_WEIGHT_SUPPORT` | `0.30` | `settings.py:39` | ✅ | |
| `HEALTH_WEIGHT_SENTIMENT` | `0.20` | `settings.py:40` | ✅ | |
| `HEALTH_WEIGHT_ENGAGEMENT` | `0.10` | `settings.py:41` | ✅ | |
| `RISK_CRITICAL_THRESHOLD` | `20.0` | `settings.py:44` | ✅ | `<20 -> CRITICAL` |
| `RISK_HIGH_THRESHOLD` | `40.0` | `settings.py:45` | ✅ | `<40 -> HIGH_RISK` |
| `RISK_AT_RISK_THRESHOLD` | `60.0` | `settings.py:46` | ✅ | `<60 -> AT_RISK` |
| `RISK_WATCH_THRESHOLD` | `80.0` | `settings.py:47` | ✅ | `<80 -> WATCH`; `<90 -> STABLE`; else `HEALTHY` (hardcoded `90` in `backend/src/retainai/engine/risk_engine.py`) |

> **Docs gap:** `.env.example:20-24` lists `CORS_ORIGINS`, `DEMO_MODE`, `LOG_LEVEL` but `settings.py:18` `extra="ignore"` drops them and `main.py:29` hardcodes CORS. Either wire these vars or remove them from the template.

### `.env` Actual (dev)

```ini
LLM_API_KEY=mock_key_for_dev   # deterministic fallback -- no external LLM call
DATABASE_URL=sqlite:///./retainai.db
```

`mock_key_for_dev` is treated as a sentinel in the LLM client -- agent workflows return rule-based outputs instead of calling Gemini, making offline demos fully reproducible.

---

## Health Checks & Lifecycle

### App Lifespan -- `backend/src/retainai/main.py:13`

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()   # ← create tables if missing
    yield
    # no shutdown hook
```

- `lifespan` is passed to `FastAPI(..., lifespan=lifespan)` (`main.py:24`), so Uvicorn runs it on startup.
- `init_db()` does `await conn.run_sync(Base.metadata.create_all)` (`backend/src/retainai/db/session.py:39`) -- **no migrations** (no Alembic). Schema is derived from `Base` subclasses in `backend/src/retainai/db/models.py`.
- Seeding is **not** part of lifespan -- tables are created empty. Seed via `POST /api/v1/system/reset`, `make seed`, or the frontend **Reset Demo** button.

### Health Endpoints

| Endpoint | File:Line | Purpose | Used By |
|----------|-----------|---------|---------|
| `GET /health` | `main.py:39` | Liveness: `{status, service, version, env}` | Docker `HEALTHCHECK` (`docker-compose.yml:17`) |
| `GET /api/v1/status` | `main.py:44` | Loop descriptor: `{status, mode, loop}` | Frontend / monitoring |

### Container Health Checks

| Service | Test | Interval | Timeout | Retries | Depends |
|---------|------|----------|---------|---------|---------|
| `backend` | `curl -f http://localhost:8000/health` | `10s` | -- | `5` | waits for `db` healthy |
| `db` | `pg_isready -U retainai -d retainaidb` | `5s` | `5s` | `5` | -- |

> Backend healthcheck will **always fail** until `curl` is added to `backend/Dockerfile:1` (see caveats).

### Startup Order (compose)

```
db (pg_isready) ──healthy──► backend (curl /health) ──► frontend (nginx, no dependency)
```

Frontend has no `depends_on` -- it may start before backend is ready. Browser retries or `VITE_API_BASE_URL` fetch will fail until backend is up; Vite dev proxy (`frontend/vite.config.ts`) also expects backend on `:8000`.

---

## CI/CD Pipeline

**File:** `.github/workflows/ci.yml:1` (42 lines)

```mermaid
flowchart LR
    push[push / PR -> main] --> backend-tests
    push --> frontend-tests

    subgraph backend-tests [backend-tests -- ubuntu-latest]
        A1[checkout@v4] --> A2[astral-sh/setup-uv@v3<br/>enable-cache:true]
        A2 --> A3[uv python install 3.12]
        A3 --> A4[uv sync<br/>working-directory: backend]
        A4 --> A5[uv run pytest<br/>working-directory: backend]
    end

    subgraph frontend-tests [frontend-tests -- ubuntu-latest]
        B1[checkout@v4] --> B2[setup-node@v4<br/>node 20<br/>cache npm]
        B2 --> B3[npm ci<br/>working-directory: frontend]
        B3 --> B4[npm run build<br/>tsc && vite build]
    end

    style backend-tests fill:#EEF2FF
    style frontend-tests fill:#F0FDF4
```

| Job | Steps | Notes |
|-----|-------|-------|
| `backend-tests` | `checkout` -> `setup-uv` -> `uv python install 3.12` -> `uv sync` -> `uv run pytest` | **Python drift:** installs `3.12` but canonical is `3.11` (`backend/Dockerfile:1`, `pyproject.toml:10`). Tests pass on 3.12 but image runs 3.11 -- minor risk. No lint (`ruff`/`mypy`) in CI despite being in `pyproject.toml:26-31`. |
| `frontend-tests` | `checkout` -> `setup-node 20` -> `npm ci` -> `npm run build` | Build-only; no unit tests. Cache keyed on `frontend/package-lock.json`. |

### Triggers

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

No tag/release triggers, no scheduled runs.

### What CI Does NOT Do

- No deployment (no Vercel/Fly/ECS/K8s step)
- No Docker build in CI (compose not exercised)
- No secret scanning, no SAST
- No `ruff`/`mypy` checks
- No coverage gate (`pytest-cov` is installed but not run)

---

## Current Deployment Scope (Local-Only)

| Dimension | Status |
|-----------|--------|
| **Local native** | ✅ Supported -- `make dev` (SQLite, Vite proxy, Uvicorn reload) |
| **Local Docker** | ✅ Supported -- `docker compose up --build` (Postgres, Nginx) |
| **Cloud / PaaS** | ❌ None -- no Vercel, Fly, Render, AWS, GCP config |
| **Container registry** | ❌ No image push (no `docker/build-push-action`) |
| **IaC** | ❌ No Terraform / CDK / Pulumi |
| **CDN / edge** | ❌ None |
| **Domain / TLS** | ❌ `localhost` only; no cert management |
| **Secrets manager** | ❌ Env vars in `.env` (plain file) |
| **Migrations** | ❌ `Base.metadata.create_all` on startup; no Alembic |
| **Backups** | ❌ Volume `postgres_data` ephemeral; no snapshot job |

> This is an **MVP / hackathon** footprint. Production hardening items are catalogued in the [Future Roadmap](#future-roadmap--stages-46).

---

## Observability Gap

| Capability | Status | Notes |
|------------|--------|-------|
| **Logging** | ⚠️ Basic `logging` via stdlib (`seed_database.py:logger`) | No structured JSON logs, no correlation IDs, no log level env wiring (`LOG_LEVEL` ignored) |
| **Metrics** | ❌ None | No Prometheus `/metrics`, no OTEL, no Datadog |
| **Tracing** | ❌ None | No distributed tracing across agent workflow |
| **Alerting** | ❌ None | |
| **Health probes** | ✅ `GET /health`, `GET /api/v1/status` | But `curl` missing breaks Docker healthcheck |
| **Error tracking** | ❌ None | No Sentry / Rollbar |

**Recommendation for production:**

- Add `prometheus_fastapi_instrumentator` and expose `/metrics`.
- Wire `LOG_LEVEL` via `logging.basicConfig(level=settings.LOG_LEVEL)`.
- Fix `backend/Dockerfile` to install `curl` and add `HEALTHCHECK` instruction.
- Add `SENTRY_DSN` env and `sentry_sdk.init`.

---

## Rollback & Reset

### Safe Stop (preserves data)

```bash
docker compose down          # stops + removes containers, keeps postgres_data volume
docker compose up -d         # data survives
```

### Destructive Reset (deletes data)

```bash
make docker-down             # -> docker compose down -v  (Makefile:42) -- deletes volume
docker compose down -v       # equivalent
```

> **Warning:** `make docker-down` is **destructive** -- the `-v` flag removes the named volume `postgres_data`. Recovery requires re-seeding. For a safe stop use `docker compose down` (no `-v`) or add a new Make target `docker-stop: docker compose down`.

### App-Level Reset (preserves volume, truncates tables)

```bash
# Option A -- API (works in both native and compose)
curl -X POST http://localhost:8000/api/v1/system/reset

# Option B -- CLI (native only, needs DB reachable)
cd backend && uv run python -m retainai.scripts.seed_database

# Option C -- Frontend button
# Open http://localhost:5173 -> header -> "Reset Demo" -> calls POST /system/reset
```

All three run `seed_demo_data()` (`backend/src/retainai/scripts/seed_database.py:73`) which does:

```python
async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.drop_all)
    await conn.run_sync(Base.metadata.create_all)
# then inserts 101 customers + 3131 usage + 82 tickets + 94 feedback + 1 memory
```

Idempotent -- safe to run repeatedly.

---

## Future Roadmap -- Stages 4–6

> From `FUTURE_ROADMAP.md` & `IMPLEMENTATION_PLAN.md` -- condensed for infra planning. No code exists for these stages yet.

| Stage | Theme | Infra Implications |
|-------|-------|--------------------|
| **4 -- Hardening** | Auth (JWT/OAuth), RBAC, rate limiting, input validation, Alembic migrations, `ruff`/`mypy` in CI, `curl` fix, `VITE_*` runtime injection, `cors_origins` wiring | Add `alembic.ini`, auth middleware, API gateway or FastAPI `Depends(get_current_user)`, fix Dockerfile & compose |
| **5 -- Observability & Scale** | Structured logs, Prometheus + Grafana, OTEL tracing, Sentry, horizontal scaling (Gunicorn/Uvicorn workers), read replicas, Redis cache, Postgres connection pooling | Add `prometheus_fastapi_instrumentator`, OTEL SDK, Redis service in compose, `DATABASE_URL` pool params, load balancer |
| **6 -- Cloud Deployment** | Container registry (GHCR/ECR), CI `docker/build-push-action`, IaC (Terraform), managed Postgres (RDS/Cloud SQL), object storage for exports, CDN, TLS, secrets manager (Vault/AWS SM), blue/green or canary deploys, backup/restore jobs | New `infra/terraform/`, `Dockerfile` multi-arch, GH Actions deploy job, migration to managed DB, backup cron |

---

## Verification

```bash
# 1. Compose health
docker compose ps
docker compose logs -f                # follow logs (infra/README.md:3)
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/api/v1/status | jq
curl -s http://localhost:8000/docs | head

# 2. Frontend
open http://localhost:5173            # infra/README.md:6
curl -s http://localhost:5173/ | head # nginx serves index.html

# 3. DB
docker compose exec db pg_isready -U retainai -d retainaidb
docker compose exec db psql -U retainai -d retainaidb -c "SELECT count(*) FROM customers;"
# expect 101 after seed

# 4. Native smoke (SQLite)
make seed
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.total_customers'
```

---

## Troubleshooting -- Infra FAQ

| Symptom | Cause | Fix |
|---------|-------|-----|
| `uv: command not found` | `uv` not installed on host | `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `curl: not found` in backend healthcheck logs | `python:3.11-slim` has no `curl` | Add to `backend/Dockerfile:3`: `RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*` |
| `port 5432 already in use` on `docker compose up` | Host Postgres running | `sudo lsof -i :5432` -> stop host service or remap: `"5433:5432"` in `docker-compose.yml:41` |
| `make clean` fails on Windows (`rm: command not found`) | `Makefile:36` uses Unix `rm -rf` | Run via Git Bash / WSL, or `Remove-Item -Recurse -Force backend\.venv, frontend\node_modules, frontend\dist` in PowerShell |
| `VITE_API_BASE_URL` change has no effect | Baked at build time | `docker compose build frontend && docker compose up -d` |
| `CORS` error in browser despite `CORS_ORIGINS` env | `CORS_ORIGINS` ignored (`main.py:29` hardcodes `["*"]`) | Edit `main.py:27-33` to read `settings.CORS_ORIGINS` or keep permissive for MVP |
| `DATABASE_URL` env seems ignored in compose | Compose `environment` override wins | Edit `docker-compose.yml:12` or set `DATABASE_URL` there |
| `docker compose down -v` deleted my data | `-v` removes `postgres_data` volume (`Makefile:42`) | Use `docker compose down` (no `-v`); re-seed with `POST /api/v1/system/reset` or `make seed` |
| Backend starts before DB is ready (native) | No `depends_on` outside compose | Ensure Postgres reachable on host or use SQLite fallback (`DATABASE_URL=sqlite:///./retainai.db`) |
| Frontend `404` on refresh of `/customers/...` route | Nginx missing SPA fallback | Already handled: `try_files $uri /index.html` (`frontend/nginx.conf:5`) |
| CI passes but local `make test` fails | Python `3.11` vs `3.12` drift | Align: `uv python install 3.11` locally or bump `backend/Dockerfile:1` to `3.12` |
| `open http://localhost:8000/docs` 404 | Backend not running or wrong port | Check `docker compose ps`, `make backend`, `PORT` env vs hardcoded `8000` |

> For API troubleshooting (status codes, agent fallback, orphaned routes) see [API_REFERENCE.md](./API_REFERENCE.md). For dev workflow (native vs Docker, seeding, tests) see [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md).

