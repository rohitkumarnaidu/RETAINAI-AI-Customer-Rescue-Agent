# RETAINAI — MASTER AUDIT PLAN
**Date:** 2026-08-30 | **Branch:** master | **Commit:** 14197b2 | **Auditors:** 4 parallel forensic agents (frontend, backend, intelligence, API+DB, security)
**Mode:** Audit-before-modifying — no code changed yet. Runtime trace verified.

## 1. Audit Scope
Full end-to-end verification: UI → API → services → deterministic engines → agents → tools → DB → persisted state → API response → UI update.
Every link traced for breakage. No assumption that file exists = feature works.

**In scope:** frontend (React+TS), backend (FastAPI), DB (SQLite via SQLAlchemy async), deterministic engines (health/risk/signal/time-window/learning), agents (orchestrator/investigation/action/LLM client/tools), config, auth, integrations, tests, seed, infra, docs, demo.

## 2. Repository Inventory (summary)
| Area | Location | Purpose | Dependencies | Runtime Used | Tested | Status |
|---|---|---|---|---|---|---|
| Frontend | `frontend/src` (8 files HEAD + `ui.tsx` working-tree) | 3-tab shell (Command/Customer360/Action) manual tab router | axios, lucide-react, Vite, Tailwind | Yes | No unit tests | P1 divergent: HEAD != working-tree |
| Backend API canonical | `backend/src/retainai/api/routes.py` (33 endpoints) + `agent_routes.py` (4) | Portfolio, customers, timeline, risk, events, investigate, interventions, outcomes, learning, observability | FastAPI, SQLAlchemy | Yes | 34 tests | P0: GET /risk mutates, /system/reset unauth |
| Backend API orphaned | `api/agent.py`, `api/customers.py`, `api/experience.py` (8 ghost routes) | Duplicates diverged | — | NO (never mounted) | Misleading greens | P1 spec drift |
| DB | `db/models.py` 18 tables, `session.py`, `scripts/seed_database.py` | 101 seeded customers + telemetry | aiosqlite | Yes | Integrity tested | P0: 3 .db files diverge, no migrations |
| Engines | `engine/{health,risk,signal,time_window,learning}_engine.py` | Deterministic health/risk/signal/learning | settings | Yes | 9 engine tests | P2: weights not fully config-driven, dead code |
| Agents | `agents/{orchestrator,investigation_agent,action_agent,tools,llm_client}.py` | Rescue workflow + HITL plan | httpx/Gemini or mock fallback | Yes (mock default) | 4 agent tests | P2: tool timeout not enforced, state machine warn-only |
| Config | `config/settings.py` | Weights, thresholds, LLM, auth, timeouts | pydantic-settings | Yes | — | P2: dual DATABASE_URL sources, missing 90 threshold |
| Auth | `auth/auth.py` | JWT + API-key, DEMO_BYPASS | passlib, pyjwt | Bypassed in demo | No auth tests | P1: DEMO_BYPASS nulls isolation |
| Tests | `backend/tests` 14 files, 34 defs | Unit/integration/API/agent/DB | pytest-asyncio | — | — | P3 gaps: no injection/IDOR |
| Infra | `docker-compose.yml`, `Makefile`, `frontend/nginx.conf` | Local + docker | — | — | — | P3 hardcoded creds |

Full inventory: `REPOSITORY_INVENTORY.md`

## 3. Current Architecture (as-observed)
`Customer Data → Signal Layer (signal_engine 8 detectors) → Health (health_engine weighted 0.4/0.3/0.2/0.1) → Risk (risk_engine map 20/40/60/80 + 90 hardcoded) → Orchestrator (state machine 8 iter/12 tools/60s) → Investigation (LLM or fallback) → Evidence Grounding (validate IDs) → Root Cause → Next Best Action (3-step fallback + email) → Human Approval → Intervention → Outcome → Learning Candidate → Validation Gate (sample>=2, conf>=0.70, success>=0.6) → Experience Memory → Future Retrieval (Chroma hash-embed or SQL)`
Closed loop verified happy-path. Gaps: signal thresholds not configurable, evidence from last-5 insertion order, memory never decays.

## 4. Implementation Status
- Completed: portfolio/customer360/action views, risk/health/signal deterministic, orchestrator bounded workflow, seed 101 accounts, demo replay, 34 tests passing
- Unknown/risky: DB isolation (AUTH_ENABLED false), triple .db divergence, orphaned routers, GET /risk side-effect, fabricated 0.97 observability, hardcoded 92% fallback, stale frontend cache

## 5. Test Strategy
- Run `pytest backend/tests -v` (34 tests) after every repair
- Add missing: boundary 0%/50%/100%, zero-baseline, duplicate events, injection, IDOR, timeout, insufficient evidence, learning promotion
- E2E: Create customer → portfolio → timeline → reassess → investigate → evidence → root cause → plan → approve → outcome → learning → similar customer reflects memory

## 6. Runtime Verification Strategy
- Startup: `uvicorn retainai.main:app --reload` + `npm run dev` + `curl /health /readiness /api/v1/portfolio`
- DB reality: check 3 .db files unified, tables exist, seed 101, CRUD via API
- Frontend: manual click-through Command → Customer360 (acme-corp-001) → investigate → approve → Action center; check no hardcoded values beyond fallbacks
- Chaos: LLM unavailable (mock fallback), DB restart, malformed event, empty customer, invalid tool arg

## 7. Risk Classification
P0 Blocker: app cannot run / core demo broken / data corrupt / security compromised
P1 Critical: major functionality disconnected/incorrect/non-dynamic
P2 High: important integration defect not completely breaking
P3 Medium: quality/UX/observability/edge
P4 Low: polish/docs

## 8. Verification Gates
- Gate A: API contracts correct (field names/types nullable)
- Gate B: DB reality (migrations, seed, reads/writes, FKs)
- Gate C: Deterministic engines pure & config-driven
- Gate D: Agent uses tools + evidence grounding + uncertainty
- Gate E: Frontend dynamic (DB→API→UI, no hardcoded state)
- Gate F: E2E closed loop passes
- Gate G: Security scan clean (no committed secrets, IDOR checked)
- Gate H: Build green (tsc, vite build, pytest, docker)

## 9. Final Acceptance Criteria (condensed — see spec §84)
Product, dynamic, agentic AI, DB, frontend, integration, reliability, security, hackathon all must pass. Most critical: every UI value traces to DB→API→UI; recommendation personalized; evidence IDs valid; insufficient evidence handled; learning validated before promotion; failures graceful; demo <=2min reproducible.

## 10. Immediate Defects (triage)
See `DEFECT_REGISTER.md` — 30+ defects. Top to fix first:
P0-01 main.py:84 exception handler masks HTTPException
P0-02 POST /system/reset unauthenticated + destructive
P0-03 3 SQLite files diverge (unify DATABASE_URL via settings)
P0-04 POST /interventions FK violation (validate investigation_id)
P1-01 orphaned routers (delete or mount; fix customers.py risk List vs dict)
P1-02 AUTH_ENABLED false / DEMO_BYPASS (document as demo-intent, gate /system/reset)
P1-03 Risk threshold 90.0 not configurable + risk_change dead path
P1-04 Working-tree vs HEAD divergence breaks tsc (commit ui.tsx + fix resolveEvidence)
P1-05 frontend 92% hardcoded fallback + 85 magic defaults + stale cache
...
Full list + repair ordering in DEFECT_REGISTER.md
