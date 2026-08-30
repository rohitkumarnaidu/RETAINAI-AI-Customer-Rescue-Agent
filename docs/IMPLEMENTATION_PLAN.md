# RETAINAI -- Complete Implementation Plan (Docs-First)

> **Goal:** Close every remaining gap from the end-to-end audit and ship a demo-reliable, judge-proof monorepo. This plan is the single source of truth -- all agents read it before coding.

**Date:** 2026-08-30 | **Owner:** LatentCode Builder | **Stack:** FastAPI + SQLAlchemy Async (SQLite->Postgres), React 18 + TS + Vite + Tailwind, Gemini 2.5 Flash (fallback deterministic), uv, 101 hybrid synthetic accounts.

---

## 0. Guiding Principles (from docs)

1. **Deterministic core, agentic reasoning.** Math/thresholds/DB in `engine/` & `services/`; LLM only for synthesis/plan/email. Never let LLM do arithmetic. (`docs/REQUIREMENTS`, `ARCHITECTURE.md`)
2. **Single Orchestrator + typed tools.** Avoid multi-agent chatter; 5 canonical contracts in `docs/ai/tool-contracts.md`.
3. **Evidence-first.** Every claim cites `evidence_ids`; `INSUFFICIENT_EVIDENCE` when `<2` sources.
4. **Closed loop:** `SENSE -> THINK -> ACT -> MEASURE -> LEARN -> REPEAT` -- `LearningEngine` validation gate on `health_delta >=15` -> `VALIDATED` memory.
5. **Demo reliability > novelty.** Mock fallback on every LLM call, deterministic `b2a88551-...` Acme hero, `/system/reset` re-seeds 101.

---

## 1. Canonical Decisions (lock contradictions found in audit)

| Topic | Canonical Choice | Rationale |
|---|---|---|
| **Health model** | 4-dim: `0.4*usage +0.3*support +0.2*sentiment +0.1*engagement` (`settings.py:HEALTH_WEIGHT_*`, `engine/health_engine.py:48`) | FR-008 acceptance test expects this; 6-dim is roadmap only |
| **Risk enum** | `HEALTHY/STABLE/WATCH/AT_RISK/HIGH_RISK/CRITICAL` thresholds `20/40/60/80/90` (`config/settings.py:44`) | Matches `risk_engine.py:26`, covers all archetypes |
| **Tool set** | 5-step orchestrator tools: `search_customer_evidence`, `calculate_customer_signals`, `investigate_root_cause`, `generate_retention_plan`, `evaluate_outcome` -- keep `AgentTools` as impl, 10-tool naming is legacy | `ai/tool-contracts.md` is authoritative; 10-tool variant stays as alias |
| **Financial field** | Canonical `arr` + derived `mrr=arr/12`; seed maps `tier->segment`, `mrr->arr` | `models.py:79-80`, `scripts/seed_database.py:100-103` |
| **Usage schema** | Unified: `daily_active_users, wau, mau, license_utilization, job_completion_rate, feature_clicks, sessions` | Required for SC-03 false-positive (`job_completion_rate`) |
| **State machine** | `OBSERVING->SIGNAL_DETECTED->INVESTIGATING->RISK_ASSESSED->ACTION_PLANNED->APPROVED/REJECTED->EXECUTING->WAITING_FOR_OUTCOME(14d)->EVALUATED->MEMORY_UPDATED` | `ARCHITECTURE.md` |
| **Acme identity** | `id=b2a88551-82e5-43d7-b620-ba1640900c71` name `Acme Corp` domain `acmecorp.com` tier `Enterprise` | `data/seed/retainai_dataset_v2.json` -- replay must resolve by name, not hardcode |

---

## 2. Work Breakdown -- 5 Parallel Tracks

### Track A -- Backend API Contracts & Persistence
**Owner: Agent-A** | **Files:** `backend/src/retainai/api/routes.py`, `api/agent_routes.py`, `repositories/`, `models/schemas.py`, `db/session.py`
- [ ] A1. Add missing global routes: `GET /interventions`, `GET /outcomes`, `GET /experience-memory` alias for `GET /learning/memories` (keep both), `GET /learning/memories` stays. Provide pagination `?limit&offset`.
- [ ] A2. Add alias `POST /agent/{customer_id}/investigate` alongside `POST /agent/investigate/{customer_id}` (both -> `AgentOrchestrator.run_full_rescue_workflow`).
- [ ] A3. Fix `POST /interventions` id gen: `uuid4().hex` not `db.bind.dialect.timestamp()`.
- [ ] A4. Add `GET /portfolio` already exists -- ensure `arr_at_risk` uses string enum comparison safely (`c.risk_level.value in (...)`).
- [ ] A5. Schemas: align `CustomerSchema` (`status` vs `lifecycle_stage`) and ensure `InterventionSchema.plan` deserializes JSON string vs list.

### Track B -- Determinism, Seed & Demo Replay
**Owner: Agent-B** | **Files:** `backend/src/retainai/demo/acme_replay.py`, `scripts/seed_database.py`, `db/seed.py`, `agent/` duplication, `data/seed/retainai_dataset_v2.json`, `engine/*`
- [ ] B1. Delete legacy `backend/src/retainai/agent/` folder (keep `agents/`); update any imports.
- [ ] B2. Rewrite `backend/src/retainai/db/seed.py` to re-export `scripts/seed_database.seed_demo_data` (or delete) -- must not import `CustomerUser` etc. Fix blocks `pytest`.
- [ ] B3. Fix `demo/acme_replay.py:15` -> resolve Acme id by query `select Customer where name ilike '%Acme%'` fallback to `b2a88551...`; make `AcmeReplayEngine(customer_id=None)` auto-resolve.
- [ ] B4. Harden `scripts/seed_database.py` idempotence: log counts, ensure 101/3131/82/94 assertions, keep `--seed 42` provenance.
- [ ] B5. Health/Risk/Seignal engines already pass 25 tests -- add one regression test for `FALSE_POSITIVE_SAFEGUARD` net negative impact.

### Track C -- Infra, Docker & Env Hardening
**Owner: Agent-C** | **Files:** `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.env.example`, `.env`, `infra/README.md`, `Makefile`, `.github/`
- [ ] C1. Create `backend/Dockerfile` (python:3.11-slim, `uv sync --frozen`, `uvicorn retainai.main:app --host 0.0.0.0`).
- [ ] C2. Create `frontend/Dockerfile` (node:20-alpine, `npm ci`, `vite build` + `serve` or `nginx`).
- [ ] C3. Make `docker-compose.yml` use `env_file: .env`, add `healthcheck` for backend `/health`, add `depends_on` already OK.
- [ ] C4. Create `.env` from `.env.example` (mock key), ensure `.gitignore` keeps it ignored but `.env.example` committed.
- [ ] C5. Flesh `infra/README.md` with `up/down/logs` commands; add `Makefile: docker-up, docker-down, smoke`.
- [ ] C6. Add `/.github/workflows/ci.yml` optional (pytest + tsc + vite build).

### Track D -- Frontend Wiring & UX Polish
**Owner: Agent-D** | **Files:** `frontend/src/services/api.ts`, `components/CommandCenter.tsx`, `components/Customer360.tsx`, `components/ActionCenter.tsx`, `App.tsx`, `vite.config.ts`
- [ ] D1. Align `services/api.ts` to canonical paths: `getExperienceMemories->/learning/memories` (keep `/experience-memory` as fallback), `getAllInterventions->/interventions` (now exists), `getAllOutcomes->/outcomes`, unify `runInvestigation`/`triggerInvestigation` to `POST /agent/investigate/{id}` (keep alias).
- [ ] D2. `CommandCenter.tsx:32` N+1 fix: try `GET /portfolio` first, fallback to per-customer risk only for filtered view; add skeleton loaders.
- [ ] D3. `Customer360.tsx` -- handle `risk_level` enum display, evidence chip overflow, approve->toast->refresh interventions.
- [ ] D4. `ActionCenter.tsx` -- wire to real `/interventions` & `/outcomes` + `/learning/memories`; add empty/loading/error states already partially done, verify after A1.
- [ ] D5. `vite.config.ts` proxy `/api` -> `http://localhost:8000` for dev parity.
- [ ] D6. Types: align `Customer.lifecycle_stage` vs `status`, `Intervention.plan_steps` JSON parse guard.

### Track E -- QA, E2E & Submission Readiness
**Owner: Agent-E** | **Files:** `backend/tests/**`, `tests/e2e/`, `docs/DEMO.md`, `README.md`, `LICENSE`
- [ ] E1. Run `pytest -v` after every track merge -- must stay 25/25 (add new tests for A1 aliases).
- [ ] E2. Add `tests/test_api_routes.py` cases for new aliases (`/experience-memory`, `/interventions`, `/outcomes`, `/agent/{id}/investigate`).
- [ ] E3. Frontend `npm run build` must pass `tsc --noEmit`.
- [ ] E4. E2E smoke: `seed_demo_data -> GET /customers (101) -> GET /portfolio -> POST /agent/investigate/{acme} -> POST /interventions/{id}/approve -> POST /interventions/{id}/outcome -> GET /learning/memories`.
- [ ] E5. Update `README.md` Quickstart (both `uv` and `pip` paths), add Docker quickstart, add Demo script (Acme hero).
- [ ] E6. Final `git status` clean, tag `v1.0-demo`.

---

## 3. Execution Order & Dependencies

```
Phase 0 (now):  This plan merged -> docs/IMPLEMENTATION_PLAN.md  ✅
Phase 1 (parallel): A + B + C start together (no cross-deps except A1 needed for D4)
Phase 2: D starts after A1 done (needs new routes); E2 runs after A1.
Phase 3: E4 smoke runs after A+B+C+D all merged.
Phase 4: docs/DEMO.md + README polish, git tag.
```

Agents coordinate via: A1 notifies D, B3 notifies E4 (Acme id). All agents `git pull --rebase` before pushing.

---

## 4. Acceptance Criteria (Definition of Done)

- `pytest backend/tests -v` -> **25+ PASS**, no `ImportError` from `db/seed.py`.
- `npm run build` (frontend) -> **PASS** with no `tsc` errors.
- `docker compose config` -> valid; `docker compose up --build -d` -> backend `/health` 200, frontend 5173 serves.
- Smoke script:
  ```bash
  curl GET /api/v1/customers -> 101
  curl GET /api/v1/portfolio -> total_customers 101
  curl POST /api/v1/agent/investigate/b2a88551-82e5-43d7-b620-ba1640900c71 -> run_id
  curl POST /api/v1/interventions/{id}/approve -> APPROVED
  curl POST /api/v1/interventions/{id}/outcome -> SUCCESS + memory VALIDATED
  curl GET /api/v1/learning/memories -> >=1
  curl GET /api/v1/experience-memory -> same as above (alias)
  curl GET /api/v1/interventions -> list
  curl GET /api/v1/outcomes -> list
  ```
- `docs/` -- all 30 existing files untouched except this new plan; contradictions locked per §1.

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Route alias breakage | Keep both old+new paths; frontend tries canonical, falls back |
| Seed non-determinism | Pin `--seed 42`, assert counts, idempotent `drop_all/create_all` |
| LLM outage in demo | `LLMClient` fallback already in `agents/llm_client.py:37` -- never remove |
| N+1 portfolio slowness | Use `/portfolio` bulk, debounce search |
| Enum drift regression | Lock `RiskLevel` + `InterventionStatus` in `models.py`, add test |

---

## 6. Files to Touch (complete list for agents)

```
backend/src/retainai/api/routes.py
backend/src/retainai/api/agent_routes.py
backend/src/retainai/demo/acme_replay.py
backend/src/retainai/db/seed.py
backend/src/retainai/db/models.py (no schema change, just guard)
backend/src/retainai/models/schemas.py
backend/Dockerfile            (new)
frontend/Dockerfile           (new)
frontend/src/services/api.ts
frontend/src/components/CommandCenter.tsx
frontend/src/components/Customer360.tsx
frontend/src/components/ActionCenter.tsx
frontend/vite.config.ts
docker-compose.yml
.env / .env.example
infra/README.md
Makefile
backend/tests/test_api_routes.py (add)
tests/e2e/smoke.py (new, optional)
```

---

*End of plan. Agents: read this, then claim your Track and ship. No scope creep beyond §2.*

