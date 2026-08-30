# RETAINAI — Master Execution Plan: Dynamic for Any User

> **Version:** 1.0 — 2026-08-30 | **Owner:** Founding Team | **Status:** Ready for Build
> **Goal:** Transform RETAINAI from 101-account demo into multi-tenant SaaS where **any org/user can sign up, bring their own customers via any ingestion path, and get fully dynamic SENSE→THINK→ACT→MEASURE→LEARN with isolated memory, configurable intelligence, and BYOK LLM** — honoring `DATA_MODEL_VERIFICATION_REPORT.md:93/100` production readiness as baseline.

---

## Table of Contents

1. [Startup Vision & Team](#1-startup-vision--team)
2. [Product Thesis: What "Dynamic for Any User" Means](#2-product-thesis)
3. [Current Codebase Audit (Evidence-Based)](#3-current-codebase-audit)
4. [Gap Analysis → Any-User Blockers](#4-gap-analysis--any-user-blockers)
5. [Target Architecture](#5-target-architecture)
6. [Execution Phases (0-5) — The Real Work](#6-execution-phases-0-5)
7. [Sprint Plan & Timeline](#7-sprint-plan--timeline)
8. [Team Roles & RACI](#8-team-roles--raci)
9. [API & Data Contract Delta](#9-api--data-contract-delta)
10. [Frontend Dynamics — Removing Last 10% Hardcode](#10-frontend-dynamics)
11. [DB Migration Strategy](#11-db-migration-strategy)
12. [Security, Auth & Tenancy](#12-security-auth--tenancy)
13. [LLM / Agent Personalization per Tenant](#13-llm--agent-personalization)
14. [Testing & Quality Gates](#14-testing--quality-gates)
15. [Deployment & Infra](#15-deployment--infra)
16. [Risk Register & Mitigations](#16-risk-register--mitigations)
17. [KPIs & Definition of Done](#17-kpis--definition-of-done)
18. [File Touch Map (Code-Level)](#18-file-touch-map)
19. [Appendix: Audit Citations](#19-appendix)

---

## 1. Startup Vision & Team

### 1.1 One-Liner

**Don't wait for churn. Let AI learn how to prevent it — for any company, not just our demo.**

RETAINAI today: `README.md:12` autonomous retention intelligence — `SENSE→THINK→ACT→MEASURE→LEARN→REPEAT` — deterministically detects churn signals, forensically investigates with evidence, proposes next-best actions with Human-in-the-Loop, measures outcome, learns into Experience Memory. Tomorrow: same loop, but **any team in 3 minutes from signup to first investigation**.

### 1.2 Startup Team Pod (4 + 1)

| Role | Owns | Key Files |
|------|------|-----------|
| **CEO / Product** | Vision, onboarding UX, portfolio & hero narrative, demo script `docs/DEMO.md` | `frontend/src/App.tsx:14`, `frontend/src/components/CommandCenter.tsx:180`, `docs/PRODUCT.md` |
| **CTO / Backend+Agents** | Tenancy, engines, orchestrator, LLM abstraction, migrations | `backend/src/retainai/db/models.py:75`, `backend/src/retainai/engine/*.py`, `backend/src/retainai/agents/orchestrator.py:52` |
| **Design / Frontend Lead** | Dynamicity cleanup, empty states, onboarding wizard, settings | `frontend/src/services/api.ts:5`, `frontend/src/components/Customer360.tsx:389`, `CsvUpload.tsx:292` |
| **Data / Platform Engineer** | Postgres, Chroma namespaces, ingestion adapters, observability | `backend/src/retainai/services/event_ingestion_service.py:207`, `docker-compose.yml:34`, `backend/src/retainai/integrations/chroma_memory.py` |
| **QA / Release (shared)** | E2E harness, tenancy isolation tests, golden replay `DATA_MODEL_VERIFICATION_REPORT.md:119` | `backend/tests/*`, `Makefile:29 test` |

**Operating cadence:** Daily 15-min standup, weekly demo to stakeholders, ship per phase (no big bang), feature flags `FEATURE_TENANCY` until Phase 5.

---

## 2. Product Thesis

### 2.1 What "Dynamic for Any User" Means (Acceptance Definition)

A stranger can, **without us seeding anything**:

1. **Sign up** → gets isolated workspace (`tenant_id`) — never sees another org's 101 seeded accounts.
2. **Bring customers in any shape** → CSV (any headers remapped), single form, JSON batch, webhook (`stripe|hubspot|zendesk|generic`), manual live inject — from 0 → N customers. No code.
3. **See everything dynamic instantly** → `GET /portfolio` `backend/src/retainai/api/routes.py:684` ARR/risk distribution, `GET /customers/{id}/risk` `routes.py:351` health tiles, `GET /signals` `routes.py:344`, `GET /timeline` `routes.py:337` — all recomputed deterministically from *their* telemetry.
4. **Investigate any customer** → `POST /agent/investigate/{customer_id}` `backend/src/retainai/api/agent_routes.py:16` → `Orchestrator.run_full_rescue_workflow:134` → evidence-grounded report with resolvable IDs `GET /evidence/{id}` `routes.py:497`, honest `INSUFFICIENT_EVIDENCE` when sparse `backend/src/retainai/agents/investigation_agent.py:73`.
5. **Act → Measure → Learn tenant-scoped** → approve/reject/modify `routes.py:592/606/618`, record outcome `routes.py:667` → `LearningEngine:28` validation gate `MIN_SAMPLE_SIZE 2` `learning_engine.py:25` promotes to `ExperienceMemory` `models.py:377` visible only to that tenant + influences next plan via `query_experience_memory` `agents/tools.py:229`.
6. **Customize intelligence** → sliders for health weights `config/settings.py:56`, risk thresholds `settings.py:62`, prompt editors `routes.py:812`, BYOK LLM (`groq|openai|gemini|mock` `llm_client.py:39`) per org, without affecting others.
7. **Leave no trace on others** → rate limit, audit `SystemEventLog:516`, replay `POST /replay/{run_id}` `routes.py:861` all tenant-tagged.

If any step requires our manual DB edit or shows Acme when they have no Acme — we failed.

### 2.2 Anti-Goals (Out of V1 Scope)

- No white-label theming, no SSO/SAML, no billing/metering, no marketplace integrations beyond webhook generic, no Prometheus/Grafana (keep `GET /metrics/observability` `routes.py:762` + `X-Request-ID` `main.py:63` as MVP observability).

---

## 3. Current Codebase Audit

### 3.1 Monorepo At a Glance

```
retainai/
├── backend/               # FastAPI 0.110 + SQLAlchemy async + Pydantic 2.6  `pyproject.toml:11`
│   ├── src/retainai/
│   │   ├── main.py:27         lifespan init_db, CORS `main.py:47`, rate-limit `main.py:57`, error handler `main.py:87`
│   │   ├── config/settings.py:15  APP_NAME, DATABASE_URL `sqlite+aiosqlite:///./retainai.db:29`, LLM_PROVIDER `groq:31`, HEALTH_WEIGHTS 0.40/0.30/0.20/0.10 `settings.py:56`, RISK thresholds `settings.py:62`, prompts `settings.py:52`
│   │   ├── db/models.py:530    15 tables: Customer:75, UsageEvent:118, FeatureAdoption:146, SupportTicket:166, CustomerFeedback:190, AccountEvent:212, RiskAssessment:235, Evidence:260, InvestigationReport:281, Intervention:307, InterventionOutcome:342, ExperienceMemory:377, LearningCandidate:459, AgentRun:485, AgentState:412-435, AgentStep:438, SystemEventLog:516
│   │   ├── db/seed.py + scripts/seed_database.py:222  loads `data/seed/retainai_dataset_v2.json` → 101/3131/82/94/1
│   │   ├── engine/  signal_engine.py:421 (8 detectors), health_engine.py:63 (weighted composite), risk_engine.py, time_window.py, learning_engine.py:333 (validation gate)
│   │   ├── services/  customer_service.py:81 (reassess), signal_service.py, timeline_service.py, intervention_service.py, event_ingestion_service.py:207 (idempotency + significance + SystemEventLog)
│   │   ├── agents/  orchestrator.py:456 (bounded loop MAX_ITER 8 MAX_TOOL_CALLS 12 MAX_RUNTIME 60s `orchestrator.py:28`, state machine VALID_TRANSITIONS:35), investigation_agent.py:132 (evidence grounding + INSUFFICIENT_EVIDENCE sparse guard :73), action_agent.py:112, llm_client.py:157 (gemini/groq/openai + deterministic fallback `mock_key_for_dev:49`), tools.py:297 (14 allowlisted tools `tools.py:17`)
│   │   ├── api/  routes.py:880 (22 endpoints), agent_routes.py:74 (investigate alias + runs + demo replay), auth/auth.py (JWT+API-Key dual, DEMO_MODE bypass)
│   │   └── repositories/  customer_repository, telemetry_repository, memory_repository, intervention_repository, risk_repository
├── frontend/              # React18 + TS + Vite5 + Tailwind3 + axios `package.json:12`
│   ├── src/App.tsx:166      7 tabs `App.tsx:13` command|customers|customer360|investigations|interventions|learning|audit, sticky header `App.tsx:64`, reset demo `App.tsx:31`
│   ├── src/services/api.ts:68  API_BASE `VITE_API_BASE_URL || localhost:8000/api/v1:3`, 12 interfaces `api.ts:10`, 16 thunks `api.ts:29`
│   └── src/components/  CommandCenter.tsx:180 (KPIs + portfolio table), CustomersView.tsx:105 (filters+CSV), Customer360.tsx:389 (7 parallel queries + investigation + live inject), CsvUpload.tsx:292 (drag-drop + preview + single form), ActionCenter/InvestigationsView/InterventionsView/LearningView/AuditView, RiskBadge.tsx, ui.tsx (Card+EvidenceDrawer)
├── data/seed/retainai_dataset_v2.json  canonical 101 archetypes HEALTHY→CRITICAL + time-series telemetry
├── docs/  40+ audit docs `docs/audit/*` including FRONTEND_DYNAMIC_DATA_AUDIT.md:100, DATA_MODEL_VERIFICATION_REPORT.md:122
├── docker-compose.yml:51  backend+frontend+postgres16, healthchecks, VITE_API_BASE_URL
└── Makefile:45  setup-backend uv sync, dev, test pytest, seed
```

### 3.2 Determinism Chain (Proven)

```
UI axios `api.ts:29 getCustomers` 
 → FastAPI `routes.py:53 list_customers` / `routes.py:684 get_portfolio`
  → Service `customer_service.py:27 reassess_customer_risk`
   → Engine `SignalEngine.evaluate_all_signals:375` (SEVERE_USAGE_DECLINE -50% `signal_engine.py:113`, MODERATE -25% `signal_engine.py:127`, UNRESOLVED_CRITICAL_TICKET `signal_engine.py:155`, HIGH_TICKET_VOLUME `signal_engine.py:170`, NEGATIVE_FEEDBACK `signal_engine.py:194`, ADMIN_INACTIVITY 14d `signal_engine.py:228`, FEATURE_ADOPTION_DECLINE `signal_engine.py:269`, SUPPORT_RESOLUTION_DETERIORATION `signal_engine.py:294`, ENGAGEMENT_DECLINE `signal_engine.py:312`, SENTIMENT_DETERIORATION `signal_engine.py:346`, FALSE_POSITIVE_SAFEGUARD `signal_engine.py:408`)
    → Health `HealthEngine.compute_health_components:22` clamp + weighted sum `health_engine.py:50`
     → Risk `RiskEngine` map thresholds `settings.py:62`
  → DB `Customer.health_score/risk_level:92` updated + `RiskAssessment:235` persisted
 → Agent `Orchestrator.run_full_rescue_workflow:134` (SIGNAL_ANALYSIS→INVESTIGATING→RISK_ASSESSMENT→ROOT_CAUSE→ACTION_PLANNING→AWAITING_APPROVAL→COMPLETED `orchestrator.py:35`) + `AgentStep:438` audit + evidence validation `orchestrator.py:232`
  → LLM fallback honest `llm_client.py:49 mock_key_for_dev` → deterministic `investigation_agent.py:106` / `action_agent.py:87` fallback payloads
 → Event `EventIngestionService.ingest_event:47` (hash idempotency `event_ingestion_service.py:27`, payload.id duplicate guard `event_ingestion_service.py:92`, significance debounce `event_ingestion_service.py:34`, SystemEventLog `event_ingestion_service.py:180`, reassessment trigger `event_ingestion_service.py:193`)
 → Frontend refetch `Customer360.tsx:47` 4 queries post-investigate
```

Every link verified live `audit_comprehensive.py 24/24` + `final_golden.py 14/14 A-N` + clean `e2e-clean-001 28 steps` `DATA_MODEL_VERIFICATION_REPORT.md:119`.

### 3.3 What's Already Dynamic (Keep)

- **Arbitrary customer creation**: `POST /customers` `routes.py:76` name-only minimal, domain auto-slug `re.sub(r'[^a-z0-9]+','-',name)`, health 0-100 clamped, risk auto-derived `routes.py:104`, ARR/MRR parsing; CSV bulk `routes.py:160` 500 rows/2MB cap, header normalization, per-row `await db.flush()` + commit-once.
- **Live ingestion**: `POST /events` `routes.py:375` 12 event_types allowlist `routes.py:383`, dedup `_dedup_id` `routes.py:388`, `Customer360.tsx:130 handleInject` 3 buttons → `ingestEvent` `api.ts:52` → reassess + timeline/signals update.
- **Investigation for any customer_id**: not Acme-locked, orchestrator bounded + state history 12 steps persisted.
- **Portfolio/KPIs dynamic**: `arr_at_risk sum CRITICAL/HIGH_RISK/AT_RISK` `routes.py:689`, `risk_distribution[c.risk_level.value]++` `routes.py:693` → no mock arrays `FRONTEND_DYNAMIC_DATA_AUDIT.md:99`.
- **Learning gate**: `learning_engine.py:25` `MIN_SAMPLE_SIZE 2` + `MIN_CONF 0.70` + success rate check `learning_engine.py:211` + Chroma upsert `learning_engine.py:284`.

### 3.4 Quality Scores (Baseline)

```
Frontend:        92/100
Backend:         96/100
Database:        95/100
AI:              88/100 (mock fallback honest)
Agents:          94/100
Learning:        93/100
Dynamicity:      97/100  ← but 10% fallback literals remain
Security:        90/100  (AUTH_ENABLED false out of scope)
Reliability:     93/100
Testing:         95/100  (31/31 pytest)
Observability:   87/100
OVERALL:         93/100
```

`DATA_MODEL_VERIFICATION_REPORT.md:93`

---

## 4. Gap Analysis — Any-User Blockers

| ID | Gap | Proof `file:line` | User Impact | Severity |
|----|-----|-------------------|-------------|----------|
| **G1 Tenancy** | No `tenant_id` column on any table; `_authorized_ids=None` default; `DEMO_MODE=true` bypasses auth | `models.py:75 Customer has no tenant_id`, `tools.py:62 _authorized_ids`, `main.py:65 not DEMO_MODE gate`, `settings.py:39 AUTH_ENABLED=false`, `.env.example:33` | All users share 101 accounts. Cross-tenant visibility + pollution. SaaS impossible. | **P0** |
| **G2 Hero coupling** | `selectedCustomerId='b2a88551-82e5'` hardcoded; `find acme-corp-001 \|\| name.includes('acme')` + HERO badge; header `Acme Corp · Hero scenario` | `App.tsx:16`, `CommandCenter.tsx:40`, `CommandCenter.tsx:149`, `App.tsx:86` | New org without Acme sees broken featured banner, wrong default. | **P0** |
| **G3 Fallback lies** | `?? 85` health, `'No severe risk detected'`, `'Telemetry within nominal'`, `'92%'`, `0.85` | `Customer360.tsx:73,75,76,123`, `ActionCenter.tsx:131`, `RiskBadge.tsx:34` per `FRONTEND_DYNAMIC_DATA_AUDIT.md:74` | Sparse tenant sees fake certainty instead of honest empty/skeleton + INSUFFICIENT_EVIDENCE. | **P1** |
| **G4 Global config** | `INVESTIGATION_SYSTEM_PROMPT`, `ACTION_SYSTEM_PROMPT`, `LLM_PROVIDER/MODEL/API_KEY`, `HEALTH_WEIGHT_*` are process-global singletons; `GET/PUT /config/prompts` singleton | `settings.py:52,31,56`, `routes.py:812`, `llm_client.py:36` | Org A tuning poisons Org B. No BYOK. | **P1** |
| **G5 SQLite default** | `sqlite+aiosqlite:///./retainai.db` `settings.py:29`; `retainai.db` committed in `backend/src/`; Postgres only in `docker-compose.yml:34` | `settings.py:29`, `backend/src/retainai.db` | Concurrent multi-tenant writes → lock; no row-level tenancy enforcement. | **P1** |
| **G6 Ingestion narrow** | Only CSV(500/2MB) + single POST /events + 3 manual inject buttons. No JSON batch, no webhook provider adapters, no column remap UI | `routes.py:160`, `routes.py:375`, `Customer360.tsx:133` | Real company with HubSpot/Zendesk/Stripe cannot onboard without code. | **P1** |
| **G7 Empty state** | Seed does `drop_all+create_all` + inserts 101; no onboarding for 0 customers; reset `POST /system/reset` drops all tenants' data if global | `seed_database.py:75`, `routes.py:40` | Cold start = empty dashboard with no CTA, or accidental data loss. | **P1** |
| **G8 Learning global** | `ExperienceMemory.customer_segment` filtered by segment only; no `tenant_id` scoping; Chroma collection global | `models.py:386`, `tools.py:245 get_validated_memories(segment)`, `learning_engine.py:228` | Org A's fix leaks to Org B; false generalization. | **P1** |
| **G9 Auth off** | `AUTH_ENABLED=false`, hardcoded `DEMO_API_KEY`, rate-limit bypassed in DEMO_MODE, `/system/reset` gated only by `DEBUG||DEMO_MODE` | `settings.py:39,43`, `main.py:57,65`, `routes.py:43` | Any anon can reset DB. No RBAC. | **P0** |
| **G10 Tenant-blind ops** | `/metrics/observability` aggregates global; no tenant tag in logs/AgentRun | `routes.py:762`, `main.py:63 X-Request-ID` | Cannot attribute failures to tenant. | **P2** |

**Root cause:** Intelligence engines are already generic (`customer_id` param throughout). Blocker is **identity, scope, and onboarding**, not AI.

---

## 5. Target Architecture

### 5.1 High-Level

```
User Browser (React + AuthContext + TenantContext)
   │  Authorization: Bearer <JWT> + X-Org-Id + X-Request-ID
   ▼
FastAPI `main.py:27` (CORS `main.py:42`, TenantMiddleware, rate-limit per-tenant `main.py:57`)
   ├── Auth `auth/auth.py` (JWT HS256 + API-Key dual, require_tenant, require_role)
   ├── Routes `routes.py:880` + `agent_routes.py:74` (all Depends(get_current_user + get_tenant))
   │     ├── CustomerRepository / TelemetryRepository (WHERE tenant_id = :tid)
   │     ├── CustomerService.reassess `customer_service.py:27` (weights from OrgSettings)
   │     ├── EventIngestionService `event_ingestion_service.py:47` (idempotency per org+customer)
   │     └── Agent Orchestrator `orchestrator.py:52` → LLMClient per-tenant `llm_client.py:15`
   ├── DB Postgres `docker-compose.yml:34` (tenant_id FK on every table + idx_*)
   ├── Chroma `chroma_memory.py` (collection tenant_{id}_memories)
   └── Ingestion Adapters: CSV `routes.py:160` + JSON batch + webhook generic/stripe/hubspot/zendesk → EventIngestion
Frontend `api.ts:5` axios interceptor injects JWT; `App.tsx:14` routes /login → /onboarding → /command
```

### 5.2 Data Model Delta (Key)

New tables:
- `tenants(id PK, name, created_at, plan)`
- `users(id PK, tenant_id FK→tenants, email unique, password_hash, role enum ADMIN/MEMBER/VIEWER, created_at)`
- `org_settings(tenant_id PK→tenants, health_weights JSON {usage:0.4,support:0.3,sentiment:0.2,engagement:0.1}, risk_thresholds JSON {critical:20,high:40,at_risk:60,watch:80,healthy:90}, llm_provider, llm_model, llm_api_key_encrypted, investigation_prompt TEXT, action_prompt TEXT, updated_at)`

Add `tenant_id String FK→tenants.id indexed` to: `customers`, `usage_events`, `support_tickets`, `customer_feedbacks`, `account_events`, `risk_assessments`, `investigation_reports`, `interventions`, `intervention_outcomes`, `experience_memories`, `learning_candidates`, `agent_runs`, `agent_steps`, `system_event_logs` + `evidences`.

### 5.3 Request Lifecycle (Tenant-Aware)

1. `POST /auth/signup {email,password,orgName}` → creates `tenant` + `user ADMIN` + `org_settings` default → returns `{jwt, tenant_id}`.
2. `POST /auth/login` → JWT `{user_id, tenant_id, role, exp}` signed `JWT_SECRET` `.env.example:37`.
3. Every API: `Depends(get_current_user)` decodes JWT → `tenant_id` in `request.state`; repositories auto-filter `tenant_id`.
4. `GET /portfolio?limit=&risk_level=&segment=&search=` already supports `routes.py:58` — add `tenant_id` predicate, keep pagination/filter/sort.

---

## 6. Execution Phases 0-5

### PHASE 0 — Harden Current Dynamic Path (2 days) — NO schema change, shippable alone

**Goal:** Eliminate last 10% hardcoded so single-tenant is honest before tenancy.

| Task | Change | File `file:line` | DoD |
|------|--------|------------------|-----|
| **0.1 Fix UI fallbacks** | `?? 85` → `null` → render `<Skeleton/>`/`—` + `INSUFFICIENT_EVIDENCE` banner; `'No severe risk detected'` → `reasoning_summary` or `—` when `risk==null`; `'92%'` `ActionCenter.tsx:131` → `—`; `0.85` `RiskBadge.tsx:34` → derive from `risk_level` | `frontend/src/components/Customer360.tsx:73,75,76,123`, `frontend/src/components/RiskBadge.tsx:34`, `frontend/src/components/ActionCenter.tsx:131` | `grep -R "92%\|?? 85" frontend/src` = 0; 0-customer DB shows skeleton not fake 85 |
| **0.2 Deserialize plan** | `GET /interventions` `routes.py:470` currently returns `plan` as JSON string `models.py:317`; add `json.loads(plan)` to `plan_steps` in response schema `models/schemas.py` or frontend `ActionCenter.tsx:184` tolerant parse | `backend/src/retainai/api/routes.py:742`, `frontend/src/components/ActionCenter.tsx:184` | ActionCenter cards show steps |
| **0.3 Remove Acme hero hardcode** | `selectedCustomerId` `App.tsx:16` → `null` + `useEffect load first customer id` fallback; `CommandCenter hero` `CommandCenter.tsx:40,149,173` → pin `highest risk` (`risk_level=CRITICAL` first) or hide when `customers.length===0`; header `App.tsx:86` pill → generic `Onboarding` link | `frontend/src/App.tsx:16,86`, `frontend/src/components/CommandCenter.tsx:40,149,168` | New empty DB no crash, no Acme ghost |
| **0.4 Stop discarding outcomes** | Remove `void getAllOutcomes()` `ActionCenter.tsx:33` discard; render outcomes tab or interventions-outcomes joined | `frontend/src/components/ActionCenter.tsx:27,33`, `frontend/src/services/api.ts:49` | Outcomes visible |
| **0.5 Stale cache** | `handleApprove` `Customer360.tsx:59` + `InvestigationsView` → after approve/reject also `invalidate getPortfolio` + `getAllInterventions`; add `Refresh` `CommandCenter.tsx:14 load()` debounce | `frontend/src/components/Customer360.tsx:60`, `frontend/src/components/CommandCenter.tsx:19` | Approve reflects in CommandCenter without manual refresh |

**Exit gate:** `tsc --noEmit` pass, `vite build 265kB` pass, `pytest 31` pass, manual 0-customer smoke (create 1 customer → portfolio updates, investigate → report shows real evidence, not 85).

---

### PHASE 1 — Identity & Tenancy (4 days) — P0 core

**Goal:** Any user isolated workspace.

**Backend**

- **Models** `models.py:75`:
  ```python
  class Tenant(Base): __tablename__="tenants" ; id: Mapped[str]=PK, name, created_at
  class User(Base): __tablename__="users" ; id, tenant_id FK indexed, email unique, password_hash, role Enum ADMIN/MEMBER/VIEWER
  class OrgSettings(Base): __tablename__="org_settings" ; tenant_id PK FK, health_weights JSON, risk_thresholds JSON, llm_provider, llm_model, llm_api_key_encrypted Text, investigation_prompt, action_prompt
  # Add tenant_id to every table:
  tenant_id: Mapped[str]=mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)  # add to Customer:75 and all telemetry/learning tables
  ```
- **Migration** `backend/alembic/versions/001_add_tenancy.py` (or `scripts/migrate_tenancy.py` for SQLite dev: `ALTER TABLE customers ADD COLUMN tenant_id` nullable → backfill `tenant_id='demo-tenant-001'` for existing 101 → set NOT NULL → create index).
- **Auth** `auth/auth.py`: implement `hash_password(plain)->bcrypt`, `create_jwt(user_id, tenant_id, role, exp=24h)`, `decode_jwt`, `get_current_user: Depends` (reads `Authorization: Bearer` → JWT verify `JWT_SECRET` `settings.py:37` or `X-API-Key` `DEMO_API_KEY` fallback when `AUTH_ENABLED=false` legacy), `require_tenant`, `require_role("ADMIN")`.
- **Middleware** `main.py:63`: add `TenantMiddleware` (sets `request.state.tenant_id` from JWT, adds `X-Tenant-Id` to response headers + logs `tenant_id` in `add_request_id` logger).
- **Repositories** `repositories/customer_repository.py` etc.: every `select(...).where(Model.tenant_id == tenant_id)` + `list_all_paginated:71` signature `tenant_id` param.
- **Services** `customer_service.py:27` untouched signature but now called with tenant-scoped repos.
- **Tools** `agents/tools.py:55` `__init__(session, tenant_id)` + `_authorize_customer_scope` now checks `customer.tenant_id == tenant_id` not set membership.
- **Seed** `scripts/seed_database.py:73` `async def seed_demo_data(tenant_id: str|None)`: if `tenant_id` provided seed only that tenant; else create `demo-tenant-001` and seed there. `POST /system/reset` `routes.py:40` now `if not is_admin: 403`, and seeds `current_tenant` not global.

**Frontend**

- New `frontend/src/context/AuthContext.tsx`: `login/signup/logout`, `token` localStorage, `user {email, tenant_id, role}`, `axios interceptor` `services/api.ts:5` injects `Authorization`.
- New `frontend/src/pages/Login.tsx` + `Signup.tsx` (email/password + org name).
- `App.tsx:14` guard: `if !token → <Login/>`; `if token && customers.length===0 && !onboarded → <Onboarding/>`; else tabs.
- `api.ts:5` add `signup(email,password,orgName)`, `login(email,password)`, `getOrgSettings()`, `updateOrgSettings()`.

**Infra**

- `.env.example:33` `AUTH_ENABLED=true` default for prod; keep `DEMO_MODE=true` for hackathon but Phase 1 sets `AUTH_ENABLED=true` in `docker-compose.yml:14`.

**Tests**

- `backend/tests/test_tenancy_isolation.py`: `test_two_tenants_isolated` (tenantA creates `cust_A`, tenantB cannot GET it 403/404), `test_tenant_scoped_portfolio`, `test_tenant_scoped_memory`.

*DoD:* Two signups → each sees only own customers; `curl -H "Authorization: Bearer $JWT_A" GET /customers` vs JWT_B disjoint; cross-tenant `GET /customers/{other_id}` → 403; global reset requires admin.

---

### PHASE 2 — Zero-to-One Onboarding & Universal Ingestion (3 days)

**Goal:** Cold start from 0 → first investigation in 3 minutes, no manual DB.

**Frontend — Onboarding Wizard** `frontend/src/components/Onboarding.tsx` (new, routed at `/onboarding`):

- Step 1: **Welcome** — "RETAINAI learns from your telemetry. Bring customers to see risk instantly." CTA `Import`.
- Step 2: **Bring customers (4 tabs)**
  - **CSV Upload** — reuse `CsvUpload.tsx:6` but add **Column Mapping UI**: after `handleFile` `CsvUpload.tsx:22` parse headers `previewHeaders`, show dropdown per RETAINAI field `name*, domain, segment, industry, plan, arr, mrr, csm_name, health_score, risk_level, renewal_date, status` `routes.py:316 notes`; user maps `company → name`, `revenue → arr` etc.; then `uploadCustomersCsv` `api.ts:59` with remapped headers (client rewrites CSV text before upload).
  - **Single Form** — already `CsvUpload.tsx:133 showAddForm` → promote to `Onboarding → Add single` calling `createCustomer` `api.ts:55`.
  - **Paste JSON / API Batch** — textarea `[{name, arr, ...}]` → `POST /ingest/batch` (new).
  - **Connect** — placeholder cards `Stripe / HubSpot / Zendesk / Generic Webhook` → shows `POST /ingest/webhook/{provider}` URL + `X-API-Key` to configure in external service.
- Step 3: **Telemetry (optional)** → `Bulk events upload` `POST /customers/{id}/events/bulk` for historical 30d backfill.
- Step 4: **Done** → `CommandCenter` now shows KPIs; `CustomersView` lists them.

**Backend — New Endpoints** `api/routes.py:880` add:

- `POST /ingest/batch` → `{customers: [{name, domain?, arr?, ...}]}` max 500, same validation as `routes.py:76 create_customer`, returns `{created, skipped, errors}`.
- `POST /ingest/webhook/{provider}` → `provider in {generic, stripe, hubspot, zendesk, segment}`; verify `X-API-Key` or webhook signature (later); maps provider payload fields to `EventIngestionService.ingest_event:47` types `USAGE_EVENT|SUPPORT_TICKET|CUSTOMER_FEEDBACK|ACCOUNT_EVENT` (reuse `SIGNIFICANT_EVENT_TYPES` `event_ingestion_service.py:18` + generic `event_type` mapping `event_ingestion_service.py:173`).
- `POST /customers/{id}/events/bulk` → `{events: [{event_type, payload, timestamp}]}` loop `ingest_event` with `dedup_id` support `routes.py:389`.
- Keep `POST /customers/upload` `routes.py:160` for backward compat; add header-remap support (accept `X-Column-Mapping` JSON).

**Empty States**

- `CommandCenter.tsx:180` when `customers.length===0` → `EmptyState title="No customers yet" description="Import CSV or add manually" action={<Import>}` instead of `0k ARR` alone.
- `CustomersView.tsx:105` same.
- `Customer360.tsx:389` when `timeline.length===0 && signals.length===0` → `EmptyState` + `Inject Live Data` CTA prominent.

**Seed for demo**

- New `POST /system/seed-sample` (admin only) seeds `retainai_dataset_v2.json` into *current tenant* idempotently (skip duplicates `routes.py:232` check). `POST /system/reset` `routes.py:40` now tenant-scoped, not global drop_all for prod; in dev `drop_all` still allowed behind `DEBUG`.

*DoD:* Fresh tenant signup → onboarding → upload 5-row CSV with custom headers (`company→name`, `revenue→arr`) remapped → `GET /portfolio` `routes.py:684` shows 5, `GET /customers/{new}/risk` computed, timeline populated, no Acme ghost.

---

### PHASE 3 — Per-Tenant Configuration (2 days) — G4

**Goal:** Each org tunes its own brain.

**Backend — OrgSettings**

- Already created in Phase 1; now wire:
  - `GET /org/settings` → `{health_weights, risk_thresholds, llm: {provider, model, has_key}, prompts: {investigation, action}}` (never return raw `llm_api_key_encrypted`, only `has_key` bool).
  - `PUT /org/settings` `{health_weights?, risk_thresholds?, llm?:{provider,model,api_key}, prompts?:{investigation,action}}` validates `sum(weights)==1.0` ±0.01, thresholds monotonic `critical<high<at_risk<watch<healthy`, `len(prompt)<=10000` like `routes.py:843`.
  - Encryption: `api_key_encrypted = Fernet(APP_SECRET_KEY .env.example:38).encrypt(api_key)`; decrypt on use.
- **Engine injection**:
  - `CustomerService.reassess_customer_risk:27` → `org = await get_org_settings(tenant_id)` → `weights = HealthWeights(**org.health_weights) if org else settings.health_weights` `settings.py:68` → `HealthEngine.compute_health_components(signals, weights)`.
  - `RiskEngine` similarly reads `org.risk_thresholds`.
  - `LLMClient.__init__` `llm_client.py:15` now accepts `api_key, model, provider` from `org.llm_*` per request (via `Orchestrator`); fallback to `settings` if org has no key.
- **Prompts** `investigation_agent.py:29 _resolve_system_prompt` / `action_agent.py:30` now `tenant_prompt = org.investigation_prompt or settings.INVESTIGATION_SYSTEM_PROMPT or DEFAULT_SYSTEM_PROMPT`; `routes.py:812 GET/PUT /config/prompts` deprecated in favor of `GET/PUT /org/settings` but keep as tenant-scoped alias for compat.

**Frontend — SettingsView** `frontend/src/components/SettingsView.tsx` (new tab in `App.tsx:43 navItems` gear icon):

- Health Weights sliders (4× 0-1, sum display, auto-normalize button).
- Risk Thresholds number inputs (5 thresholds).
- LLM card: provider dropdown `groq/openai/gemini/mock`, model input, API key password input (`••••` if `has_key`), Save → `PUT /org/settings`.
- Prompt editors: two textareas with ` effective/default/is_custom` preview like `routes.py:816`.

**Versioning**

- On settings save, bump `org_settings.updated_at`; next `AgentRun` `models.py:494 model_version/prompt_version` captures `f"{provider}:{model}@{org_updated_at}"` for replay `routes.py:861`.

*DoD:* Org A sets `usage=0.6`; Org B default; same telemetry yields different `health_components` `Customer360.tsx:148`; custom prompt appears in next investigation `investigation.uncertainty_status` changes; JWT_A's key not visible to JWT_B.

---

### PHASE 4 — Tenant-Scoped Learning & Evidence (1.5 days) — G8

**Goal:** Memory is personal, not global.

- **Model** `models.py:377 ExperienceMemory` add `tenant_id` FK; `LearningCandidate:459` add `tenant_id`; backfill.
- **Repository** `repositories/memory_repository.py` `get_validated_memories(customer_segment, tenant_id)`, `get_by_pattern(pattern, tenant_id)`, `list_all(tenant_id)`.
- **Engine** `learning_engine.py:28`:
  - `_get_candidates_for_pattern:194` filter `tenant_id`;
  - `_create_learning_candidate:134` sets `tenant_id=current`, `pattern f"{tenant_id}::{segment}::{action_type}"` optional but segment+action sufficient when tenant filtered;
  - `_promote_to_memory:228` `get_by_pattern` tenant-scoped, `memory.tenant_id = tenant_id`, Chroma upsert with namespace `tenant_{tenant_id}_memories` `learning_engine.py:284`.
- **Tools** `agents/tools.py:229 query_experience_memory(segment, risk_pattern, tenant_id)` passes `tenant_id` to `memory_repo`.
- **Chroma** `integrations/chroma_memory.py` `get_chroma_store().query(segment, tenant_id)` → collection `tenant_{id}`; `upsert` similarly.
- **Evidence** `routes.py:497 resolve_evidence` add tenant check: first `select(Customer.tenant_id where id==evidence.customer_id)` verify matches `current_tenant` else 404.

*DoD:* Tenant A records 1 SUCCESS (`health_delta +22` `learning_engine.py:57`) → `CANDIDATE` `status=PENDING_VALIDATION`; Tenant B 1 SUCCESS → also CANDIDATE; Tenant A second SUCCESS → `VALIDATED` only in A's `GET /learning/memories` `routes.py:712` (B still 0 validated).

---

### PHASE 5 — Production Hardening & Rollout (2 days)

| Item | Change | File |
|------|--------|------|
| **DB default** | `DATABASE_URL=postgresql+asyncpg://retainai:retainai@db:5432/retainaidb` `docker-compose.yml:12` becomes dev default; remove committed WAL files `backend/src/retainai.db*` + add `*.db` to `.gitignore:??`; Alembic `alembic upgrade head` in `lifespan` `main.py:27` | `backend/src/retainai/db/session.py`, `.gitignore`, `docker-compose.yml:34` |
| **Auth default** | `AUTH_ENABLED=true`, `DEMO_MODE=false` in prod `.env`; `POST /system/reset` `routes.py:40` requires `require_role(ADMIN)` + audit `SystemEventLog`; `DEMO_API_KEY` rotated via `APP_SECRET_KEY` | `.env.example:33`, `auth/auth.py`, `api/routes.py:40` |
| **Rate limit per-tenant** | `main.py:57 _RATE_LIMIT 600` now key=`tenant_id` not IP when JWT present; log `tenant_id` in `add_request_id` `main.py:78` | `backend/src/retainai/main.py:55` |
| **Observability** | `GET /metrics/observability` `routes.py:762` add `by_tenant` breakdown; `GET /org/usage` returns `events_ingested, agent_runs, validated_memories` per tenant; `AgentRun:485` already has `customer_id` → join to `tenant_id` | `api/routes.py:762`, `db/models.py:485` |
| **Frontend cache** | Replace `useState+useEffect` `CustomersView.tsx:14` with `react-query` or SWR per-tenant key `['customers', tenant_id]`; invalidate on `approve` `Customer360.tsx:59` + `upload` `CsvUpload.tsx:57` | `frontend/src/services/api.ts`, `CustomersView.tsx:14` |
| **CORS** | `CORS_ORIGINS` `main.py:42` → env list per deploy; never `*` with credentials `main.py:44` | `settings.py:38`, `main.py:41` |
| **CI** | `Makefile:29 test` + `tsc --noEmit` + `vite build` + new `test_tenancy_isolation.py` in GitHub Actions | `.github/workflows/*` |

**Rollout**

- Behind `FEATURE_TENANCY=false` flag (env) keep old single-tenant path for hackathon demo; flip true after migration.
- **Rollback:** if migration fails, `tenant_id` nullable still allows old code; `DROP COLUMN` revert script pre-tested.

---

## 7. Sprint Plan & Timeline

**Team of 4, 2-week horizon (10 working days) — overlaps allowed.**

| Week | Sprint | Focus | Deliverable | Demo |
|------|--------|-------|-------------|------|
| **W0 (2d)** | **Sprint 0** | Phase 0 hardening | No fake 85/92%, hero decoupled, plan deserialized, stale cache fixed | Empty DB smoke + 1-customer e2e |
| **W1 Mon-Thu** | **Sprint 1** | Phase 1 tenancy | Auth + JWT + tenant_id FK + tenant-scoped repos + AuthContext | 2-tenants isolated demo (side-by-side browsers) |
| **W1 Fri-W2 Tue** | **Sprint 2** | Phase 2 onboarding + ingestion | Onboarding wizard + column remap + batch + webhook generic | Fresh signup 0→5 customers via weird headers CSV in 3 min |
| **W2 Wed-Thu** | **Sprint 3** | Phase 3 config | OrgSettings + per-tenant weights/thresholds/prompts/BYOK | Same customer, two orgs different health + prompt |
| **W2 Fri** | **Sprint 4** | Phase 4 learning scope | Tenant-scoped memories + Chroma namespaces | Two orgs each 2 successes → isolated VALIDATED |
| **W3 Mon-Tue** | **Sprint 5** | Phase 5 harden | Postgres default + rate-limit per-tenant + observability + CI | Prod-like deploy `docker compose up --build` |

**Gantt (text):**

```
W0  [==== Phase0 ====]
W1  [======== Phase1 Tenant ========][==Phase2 Onboard==]
W2  [=Phase2 cont=][==Phase3 Config==][Phase4 Learn]
W3  [=== Phase5 Harden + UAT + Tag v0.2.0 ===]
```

---

## 8. Team Roles & RACI

| Activity | CEO/Product | CTO/Backend | Design/Frontend | Data/Platform | QA |
|----------|-------------|-------------|-----------------|---------------|----|
| Tenancy models + migration | A | **R** | — | **R** | I |
| Auth + JWT + middleware | I | **R** | C | I | **R** (tests) |
| Onboarding wizard UX | **R** | C | **R** | — | A |
| CSV remap + batch/webhook | A | **R** | **R** | C | C |
| Health weights/BYOK per-tenant | I | **R** | **R** (sliders) | — | C |
| Memory Chroma namespaces | — | **R** | — | **R** | C |
| Hardening (Postgres, rate-limit) | — | C | — | **R** | **R** |
| Demo script + UAT | **R** | A | A | I | **R** |

**R=Responsible, A=Accountable, C=Consulted, I=Informed.** Daily standup 10am, PRs require 1 review + `pytest` green.

---

## 9. API & Data Contract Delta

### 9.1 New / Changed Endpoints

| Method | Path | Auth | Body / Query | Returns | Notes |
|--------|------|------|--------------|---------|-------|
| **POST** | `/api/v1/auth/signup` | none | `{email,password,orgName}` | `{jwt, tenant_id, user}` | Creates tenant+admin+org_settings |
| **POST** | `/api/v1/auth/login` | none | `{email,password}` | `{jwt, tenant_id}` | HS256 `JWT_SECRET` |
| **GET** | `/api/v1/auth/me` | JWT | — | `{user, tenant}` | |
| **GET** | `/api/v1/org/settings` | JWT | — | `OrgSettings` (has_key not raw) | Tenant-scoped |
| **PUT** | `/api/v1/org/settings` | JWT ADMIN | `{health_weights?,risk_thresholds?,llm?,prompts?}` | `OrgSettings` | Validates sum=1, len≤10k |
| **POST** | `/api/v1/ingest/batch` | JWT | `{customers:[{name,...}] max 500}` | `{created,skipped,errors}` | Reuses `create_customer` validation `routes.py:76` |
| **POST** | `/api/v1/ingest/webhook/{provider}` | API-Key or JWT | provider payload JSON | `{status,event_hash,reassessment}` | Maps to `EventIngestionService` |
| **POST** | `/api/v1/customers/{id}/events/bulk` | JWT | `{events:[{event_type,payload,timestamp}]}` | `{processed, reassessment}` | Loop dedup |
| **POST** | `/api/v1/system/seed-sample` | JWT ADMIN | `?tenant_id` optional | `{seeded:101}` | Idempotent per tenant |
| **GET** | `/api/v1/org/usage` | JWT | — | `{events_ingested, agent_runs, memories}` | Tenant observability |

All existing `GET /customers?limit=&offset=&risk_level=&segment=&search=&sort_by=&sort_order=` `routes.py:53` + `GET /portfolio` `routes.py:684` + `POST /events` `routes.py:375` + `POST /agent/investigate/{id}` `agent_routes.py:16` now implicitly filtered by `tenant_id` from JWT — contract unchanged for frontend except 401 when missing JWT.

### 9.2 Model Delta (excerpt)

```python
# Before models.py:75
class Customer(Base): id, name, domain, segment, health_score, risk_level ...

# After
class Tenant(Base): id PK, name, created_at
class User(Base): id PK, tenant_id FK indexed, email unique, password_hash, role
class OrgSettings(Base): tenant_id PK FK, health_weights JSON, risk_thresholds JSON, llm_provider, llm_model, llm_api_key_encrypted, investigation_prompt, action_prompt
class Customer(Base): ... + tenant_id FK indexed  # ← add to all tables
```

---

## 10. Frontend Dynamics — Removing Last 10% Hardcode

| Area `file:line` | Fix Code | Component |
|------------------|----------|-----------|
| `Customer360.tsx:73` health | `const raw= risk?.health_score ?? customer.health_score; const healthScore = raw!=null?Number(raw):null; hasHealth? <HealthRing/> : <span>—</span>` | `Customer360` header |
| `Customer360.tsx:75` rootCause string literal | `risk?.primary_root_cause ?? risk?.root_cause ?? (hasSignals? signals[0].summary : null) ?? "—"` render `<EmptyState>` when `—` | same |
| `CommandCenter.tsx:40` hero pin | `const hero = customers.find(c=>c.risk_level==='CRITICAL') ?? customers.sort((a,b)=>a.health_score-b.health_score)[0]` ; hide banner when `customers.length===0` | `CommandCenter` |
| `App.tsx:16` default id | `const [selectedId,setSelectedId]=useState<string|null>(null); useEffect(()=>{if(!selectedId && customers[0]) setSelectedId(customers[0].id)},[customers])` | `App` |
| `ActionCenter.tsx:131` 92% | `success_rate!=null? (success_rate*100).toFixed(0)+"%": "—"` | `LearningView` |
| `api.ts:5` auth | `api.interceptors.request.use(c=>{const t=localStorage.getItem('jwt'); if(t) c.headers.Authorization=`Bearer ${t}`; return c})` | `api.ts` |

---

## 11. DB Migration Strategy

1. **Additive nullable** (`001_add_tenancy_nullable.py`): `ALTER TABLE customers ADD COLUMN tenant_id VARCHAR(50); CREATE INDEX idx_customers_tenant ON customers(tenant_id);` repeat for 14 tables.
2. **Backfill** (`scripts/backfill_tenancy.py`): `INSERT INTO tenants(id,name) VALUES ('demo-tenant-001','Demo Org') ON CONFLICT DO NOTHING; UPDATE customers SET tenant_id='demo-tenant-001' WHERE tenant_id IS NULL;` same for telemetry tables via join to customer (for telemetry derive `tenant_id` from its `customer.tenant_id`).
3. **Enforce NOT NULL** (`002_enforce_tenancy.py`): `ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;` etc.
4. **Seed per-tenant**: `seed_database.py:73` now `async def seed_demo_data(tenant_id: str)` → all `Customer(tenant_id=tenant_id, ...)` inserts.
5. **Rollback**: keep `tenant_id` nullable flag `FEATURE_TENANCY`; old code ignores column when flag off (SQLAlchemy `tenant_id` optional).

Test on copy of `retainai.db` before prod.

---

## 12. Security, Auth & Tenancy

- **Passwords**: `passlib[bcrypt]` `pyproject.toml:23` `hash_password` + `verify`.
- **JWT**: `PyJWT 2.13` `pyproject.toml:23` HS256, `exp=24h`, payload `{sub:user_id, tid:tenant_id, role, exp}` signed `JWT_SECRET` `.env.example:37` (rotate for prod, 32+ chars).
- **Dual auth**: `get_current_user` tries `Authorization: Bearer` first, fallback `X-API-Key: DEMO_API_KEY` `settings.py:43` only when `AUTH_ENABLED=false` legacy; Phase 5 `AUTH_ENABLED=true` disables fallback.
- **Scope**: `require_tenant` dep injects `tenant_id` into route; `require_role("ADMIN")` gates `PUT /org/settings`, `POST /system/reset|seed-sample`, `DELETE`.
- **Rate limit**: `main.py:57` bucket key `tenant_id` when JWT present else IP; keep `600 req/60s` but per-tenant.
- **Audit**: every `SystemEventLog` `models.py:516` already has `customer_id, event_type, details` → add `tenant_id`; `AgentRun` `models.py:485` joinable to tenant via customer.

---

## 13. LLM / Agent Personalization

| Concern | Current `file:line` | Per-Tenant Change |
|---------|---------------------|-------------------|
| **Provider/model/key** | `settings.LLM_PROVIDER=groq:31`, `llm_client.py:38 provider=(provider or settings.LLM_PROVIDER)` | `OrgSettings.llm_provider/model/api_key_encrypted`; `LLMClient(api_key=decrypt(org.llm_api_key_encrypted), model=org.llm_model, provider=org.llm_provider)` instantiated per request inside `Orchestrator` `orchestrator.py:58` |
| **System prompts** | `investigation_agent.py:29 _resolve_system_prompt() settings.INVESTIGATION_SYSTEM_PROMPT or DEFAULT` `action_agent.py:30` | `_resolve_system_prompt(tenant_id)` → `org.investigation_prompt or settings... or DEFAULT`; `routes.py:812 GET/PUT /config/prompts` → `GET/PUT /org/settings` tenant-scoped alias |
| **Health weights** | `settings.health_weights` `HealthWeights usage 0.40 ...:9`, `health_engine.py:22 compute_health_components(signals, weights=settings.health_weights)` | `CustomerService.reassess:27` loads `org.health_weights` JSON → `HealthWeights(**org.health_weights)` → passes to `HealthEngine` |
| **Versioning** | `AgentRun.model_version v2.1 :494`, `prompt_version investigate-v2 :495` | On org settings save, set `org.updated_at`; next `AgentRun` `prompt_version=f"investigate-v2@{org.updated_at.isoformat()}"` for replay `routes.py:861` |

Fallback stays honest: when `org.llm_api_key_encrypted is null` or `mock_key_for_dev` `llm_client.py:49` → deterministic fallback payloads `investigation_agent.py:106` / `action_agent.py:87` with real evidence IDs.

---

## 14. Testing & Quality Gates

| Gate | Command `file:line` | Pass Criteria |
|------|---------------------|---------------|
| **Unit** | `cd backend && uv run pytest -v` `Makefile:29`, `31` tests existing `backend/tests/` + new `test_tenancy_isolation.py`, `test_org_settings.py`, `test_ingest_batch.py`, `test_chroma_namespace.py` | 100% pass, no `tenant_id` leak test fail |
| **Type** | `cd frontend && npm run lint` `package.json:9` `tsc --noEmit` | 0 errors |
| **Build** | `npm run build` `package.json:7` vite `265kB` `DATA_MODEL_VERIFICATION_REPORT.md:121` | passes |
| **E2E golden** | `tests/final_golden.py` 14 A-N + `audit_comprehensive.py` 24/24 | all pass |
| **Tenant E2E** | new `scripts/e2e_tenant_clean.py` (tenantA signup→5 CSV→risk→investigate→approve→outcome→VALIDATED; tenantB parallel isolated) | 28 steps × 2 tenants all PASS + cross-tenant 403 |
| **Smoke** | `docker compose up --build -d && curl /health` `main.py:109` + `curl /readiness` `main.py:114` DB SELECT 1 | 200 ok |

Quality bar before tagging `v0.2.0-dynamic`: same `93/100` but Security `90→96` (auth on), Dynamicity `97→99` (no literals).

---

## 15. Deployment & Infra

- **Compose prod-like** `docker-compose.yml:51` (already `backend:8000` + `frontend:5173` via `nginx.conf` + `postgres:16-alpine:34 volume postgres_data`): set `AUTH_ENABLED=true`, `DEMO_MODE=false`, `DATABASE_URL=postgresql+asyncpg://retainai:retainai@db:5432/retainaidb`, `JWT_SECRET` / `APP_SECRET_KEY` rotated 32-char, `CHROMA_PERSIST_DIR=./chroma_data` `.env.example:45`.
- **Env**: `.env.example:33` becomes `.env` with `LLM_PROVIDER=groq` + `GROQ_API_KEY=gsk_...` BYOK per org overrides global.
- **Migrate on boot**: `main.py:27 lifespan init_db` runs `alembic upgrade head` then `ensure_demo_tenant` if empty.
- **CD**: `Makefile:38 docker-up` → `docker compose up --build -d` → healthcheck `main.py:15 curl -f /health`; rollback is `docker compose down -v && docker compose up --build -d` previous image tag.

---

## 16. Risk Register & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Migration backfill wrong tenant_id for telemetry** (telemetry `customer_id` missing) | M | H | Derive telemetry `tenant_id` from `customers.tenant_id` join; orphan telemetry → assign to `demo-tenant` then quarantine; dry-run on copy of `retainai.db` |
| **JWT secret rotation invalidates all sessions** | L | H | Dual support old+new secret for 24h; store `kid` in JWT header |
| **Chroma multi-tenant collection explosion** | L | M | One collection per tenant lazy-created; cap at 100 tenants via single collection with `where tenant_id` filter alternative |
| **CSV remap UI confusion** | M | M | Show preview table `CsvUpload.tsx:228` with mapped vs unmapped columns highlighted, default to header-name exact match |
| **Demo breakage for judges** (Auth on breaks 101 demo) | M | H | Keep `FEATURE_TENANCY` flag + `demo-tenant-001` auto-created on boot; `POST /system/reset` behind admin but judge gets `DEMO_API_KEY` header prefilled in `VITE_API_BASE_URL` |
| **SQLite lock under concurrent tenants** | M | H | Phase 5 move default to Postgres; SQLite remains dev-only `DATABASE_URL` override |

---

## 17. KPIs & Definition of Done

### 17.1 Ship Metrics

- **Time-to-first-investigation (TTFI)**: signup → CSV upload → risk visible → investigation complete. Target `< 3 min` (measured in tenant E2E).
- **Isolation**: 0 cross-tenant reads in 1000 randomized requests (fuzz `tenant_id`).
- **Dynamicity**: `grep` hardcoded literals = 0 (see Phase 0 table), portfolio KPIs drift when telemetry injected (delta ≥3 points `event_ingestion_service.py:37 significance` triggers reassess).

### 17.2 Definition of Done — `v0.2.0-dynamic` Tag

- [ ] Two fresh signups via `/auth/signup` each see only own data (`GET /portfolio` disjoint, `GET /customers/{other_id}` 403)
- [ ] Upload 5-row CSV with custom headers (`company→name`, `revenue→arr`) via remap → 5 customers appear, `health_score` computed, not 85 fallback, timeline populated
- [ ] `POST /events` `SUPPORT_TICKET CRITICAL` for own customer → `health` drops ≥ 20 points deterministic via `signal_engine.py:155` `impact_score 35`
- [ ] `POST /agent/investigate/{customer_id}` → report cites real evidence IDs resolvable via `GET /evidence/{id}` `routes.py:497` tenant-check; sparse customer → `INSUFFICIENT_EVIDENCE` honest not fabricated
- [ ] Change org health weights + prompt + LLM key in `SettingsView` → next `reassess` + `investigate` uses them (verify via `AgentRun.prompt_version` + health delta)
- [ ] Record outcome `health_delta +22` → 1st `CANDIDATE`, 2nd same pattern → `VALIDATED` memory visible only to that tenant + reused in next plan `query_experience_memory`
- [ ] `pytest` + `tsc --noEmit` + `vite build` + tenant E2E green; `docker compose up --build` boots with Postgres + `AUTH_ENABLED=true`

---

## 18. File Touch Map

**Must edit (ranked):**

```
backend/src/retainai/db/models.py:75        add Tenant, User, OrgSettings + tenant_id FK to 14 tables + Index tenant
backend/src/retainai/db/session.py          alembic wiring + Postgres default
backend/scripts/backfill_tenancy.py         NEW migration helpers
backend/src/retainai/auth/auth.py           JWT create/verify, get_current_user, require_tenant, require_role
backend/src/retainai/main.py:27,63,87       lifespan migrate, TenantMiddleware, X-Tenant-Id logging, rate-limit per-tenant:57
backend/src/retainai/api/routes.py:40,53,76,160,375,497,684,712,762,812,861  tenant Depends + new ingest/batch + webhook + org/settings + tenant filter + plan deserialize
backend/src/retainai/api/agent_routes.py:16 orchestrate with tenant_id
backend/src/retainai/repositories/*.py      WHERE tenant_id everywhere + list_all_paginated tenant param
backend/src/retainai/services/customer_service.py:27  org weights injection
backend/src/retainai/services/event_ingestion_service.py:27  hash per tenant + provider mapping
backend/src/retainai/engine/health_engine.py:22  weights param from org
backend/src/retainai/engine/learning_engine.py:194 tenant filter + Chroma namespace
backend/src/retainai/agents/tools.py:55    tenant_id init + authorize check
backend/src/retainai/agents/llm_client.py:15 per-tenant key/model/provider
backend/src/retainai/agents/orchestrator.py:52 tenant-aware tools+client
backend/src/retainai/integrations/chroma_memory.py  tenant collection
frontend/src/services/api.ts:5              JWT interceptor + signup/login + org settings + batch/webhook
frontend/src/context/AuthContext.tsx        NEW provider
frontend/src/pages/Login.tsx + Signup.tsx   NEW
frontend/src/components/Onboarding.tsx      NEW wizard + column remap enhancement to CsvUpload.tsx:22
frontend/src/components/SettingsView.tsx    NEW sliders + LLM + prompts
frontend/src/App.tsx:14,43,86               routing guard, nav gear, selectedId fix
frontend/src/components/CommandCenter.tsx:40 hero generic + empty state
frontend/src/components/Customer360.tsx:73  fallback cleanup + skeleton
frontend/src/components/ActionCenter.tsx:131 92% fix + plan parse
docker-compose.yml:12                       DB URL + AUTH_ENABLED=true
.env.example:33                             AUTH_ENABLED true docs
```

**Do not touch (keep stable):** `engine/signal_engine.py:101` detectors (already generic), `engine/risk_engine.py` thresholds (just read from org), `docs/ARCHITECTURE.md` (addendum not rewrite).

---

## 19. Appendix

### 19.1 Audit Artifacts Referenced

- `DATA_MODEL_VERIFICATION_REPORT.md:119` Clean isolated E2E 28 steps — baseline for tenant E2E
- `docs/audit/FRONTEND_DYNAMIC_DATA_AUDIT.md:63` ~90% Dynamic conclusion + fallback inventory :74
- `docs/audit/REPOSITORY_INVENTORY.md:39` No `if customer==Acme`, `docs/audit/AGENT_AUDIT.md`
- `LatentCode_Session_Record_2026-08-30.md` session log
- `README.md:52` monorepo overview + quickstart
- `sample_customers.csv` sample shape for ingest tests

### 19.2 How to Use This Plan

1. **Read Phases 0-1 first** — they unblock all. Do not start Phase 2 until `test_tenancy_isolation.py` green.
2. **Track in GitHub Projects:** columns `Backlog → Ready → In Progress → Review → Done` per task in §6 tables. Tag PRs `phase/0`, `phase/1`, etc.
3. **Demo after each phase** to product (CEO) — use TTFI metric.
4. **Flag-gate tenancy** with `FEATURE_TENANCY` env until Phase 5 green — keep hackathon judge path intact.

### 19.3 Immediate Next Command

```bash
# Phase 0 quick win (15 min)
cd frontend && grep -R "92%\|?? 85\|Acme" src/ --line-number  # confirm G2/G3
cd backend && uv run pytest -q                                 # baseline 31 pass
```

*Plan authored from direct read of `retainai/*` source + audit docs — no assumptions. Ready for `TodoWrite` breakdown into executable tickets.*

---

*© 2026 RETAINAI — BuildSprint. SENSE→THINK→ACT→MEASURE→LEARN→REPEAT for any org.*
