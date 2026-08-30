# RETAINAI — Real World End-to-End Solution Plan

> **Version:** 2.0 — 2026-08-30 | **Owner:** RETAINAI Founding Team | **Status:** Build-Ready
> **Purpose:** Production-grade, real-world SENSE→THINK→ACT→MEASURE→LEARN for any org — not demo CSV. Solves `docs/RETAINAI_HACKATHON_CHECKLIST.md:4` "CSMs discover churn after cancel" with evidence-grounded, explainable, closed-loop intelligence.
> **Principle:** Deterministic engines for math, agentic reasoning for synthesis — `docs/PRODUCT.md:49`.

---

## Table of Contents
1. [Real Problem vs Demo Problem](#1-real-problem)
2. [Real-World User Journey](#2-real-journey)
3. [End-to-End Architecture (Prod)](#3-architecture)
4. [DataIngestion — Real Sources (Not CSV)](#4-ingestion)
5. [Signal → Health → Risk (Deterministic Core)](#5-signal-health-risk)
6. [Investigation & Action (Agentic)](#6-investigation-action)
7. [Human-in-the-Loop & Execution](#7-hitl)
8. [Measure & Learning (Closed Loop)](#8-measure-learn)
9. [Integrations Adapter Layer](#9-integrations)
10. [Data Model (Tenant-Isolated)](#10-data-model)
11. [API Contracts (Real)](#11-api)
12. [Frontend — Real Operations Console](#12-frontend)
13. [Security, Privacy, Safety (Real)](#13-security)
14. [Observability & Cost Control](#14-observability)
15. [Deployment & Infra (Real)](#15-deployment)
16. [Testing & Evaluation (Real)](#16-testing)
17. [Rollout Plan — From Demo to Prod](#17-rollout)
18. [KPIs & Definition of Done (Real)](#18-kpis)
19. [File Touch Map — What Changes from Demo](#19-file-map)

---

## 1. Real Problem

**Demo problem:** 101 synthetic accounts, CSV upload proves dynamicity.

**Real-world problem:** 500–2000 accounts per CSM, signals fragmented across 5 systems:
- **Product:** Segment/Mixpanel/PostHog `UsageEvent` daily_active_users, wau, mau, feature_adoption_rates
- **Support:** Zendesk/Intercom `SupportTicket` severity/open, csat
- **Feedback:** NPS/CSAT surveys `CustomerFeedback` sentiment
- **CRM:** Salesforce/HubSpot `AccountEvent` admin logins, renewal_date
- **Billing:** Stripe `arr/mrr`

Current: batch sync monthly → churn discovered at renewal → `health 18 CRITICAL` too late.

**Real solution must:** ingest live events (webhooks, not CSV), detect compound signals in minutes, explain *why* with evidence IDs, recommend tenant-specific playbook, learn from *your* outcomes, not global static playbook.

---

## 2. Real Journey

```
Day 0: Org signs up → webhook URLs provisioned (POST /ingest/webhook/{provider})
Day 1: Backfill 90d history via bulk JSON (POST /ingest/batch) → portfolio shows 347 accounts, risk_distribution live
Day 3: Customer Hooli Health 92 → 61 after 3 events: usage -38% (USAGE), 2 critical tickets (SUPPORT), admin inactivity 14d (ACTIVITY) → risk AT_RISK
Day 3 10:02: CSM opens Hooli 360 → clicks Run investigation → orchestrator investigates
Day 3 10:03: Report: Root cause "Adoption friction + unresolved support" confidence 0.88, evidence [tck_..., usg_...], 3-step plan + email draft grounded in TICK-101
Day 3 10:05: CSM approves → intervention EXECUTED
Day 17: Usage +22 health 61→83 → outcome SUCCESS delta +22 → candidate → 2nd similar success → VALIDATED memory tenant-specific → next similar customer auto-ranks that playbook 75% success rate
Day 30: Portfolio ARR at risk $42k → $18k
```

No manual CSV after Day 1; thereafter webhooks drive SENSE.

---

## 3. Architecture

```
[Browser] React + AuthContext (JWT tenant_id) → axios → FastAPI main.py:27
  ├─ TenantMiddleware (X-Tenant-Id, rate-limit per-tenant main.py:57)
  ├─ Auth get_current_user (JWT HS256 + API-Key dual, DEMO_MODE bypass off in prod)
  ├─ Routes routes.py:880 + agent_routes.py:74 (all Depends(get_current_user, get_tenant))
  │    ├─ CustomerService.reassess (org.health_weights)
  │    ├─ EventIngestionService (idempotency per org+event_hash)
  │    └─ Orchestrator → Tools → InvestigationAgent → ActionAgent → LLMClient per-tenant
  ├─ Postgres docker-compose.yml:34 (tenant_id FK on every table)
  ├─ Chroma tenant_{id}_memories (upsert tenant-scoped)
  └─ Adapters: generic/stripe/hubspot/zendesk → EventIngestion generic types

Deterministic: engines (signal, health, risk, time_window) — LLM only for synthesis/plan.
```

---

## 4. Ingestion — Real Sources

| Source | Provider | Webhook → Event Type | Payload → `POST /ingest/webhook/{provider}` |
|--------|----------|----------------------|---------------------------------------------|
| Product | Segment, Mixpanel, PostHog | `track: Feature Used` → `USAGE_EVENT`, `FEATURE_ADOPTION_CHANGED` | `daily_active_users, feature_clicks, license_utilization` |
| Support | Zendesk, Intercom | `ticket.created` → `SUPPORT_TICKET`, `ticket.solved` → `ACCOUNT_EVENT` | `severity, status, subject, description` |
| Feedback | Delighted, Wootric | `survey.answered` → `CUSTOMER_FEEDBACK` | `sentiment, score, text` |
| CRM | Salesforce, HubSpot | `account.updated` → `ACCOUNT_EVENT` | `event_type, description` |
| Billing | Stripe | `invoice.payment_failed` → `ACCOUNT_EVENT` | `amount, arr` |

**Endpoints (already in routes.py:375 generic):**
- `POST /events` single `{customer_id, event_type, payload, timestamp, _dedup_id}` — allowlist 12 types `event_ingestion_service.py:18`, 413 if >10k
- `POST /ingest/batch` ` {customers:[...]}` max 500 — for backfill
- `POST /ingest/webhook/{provider}` `X-API-Key` verify, maps to 4 canonical types

**Idempotency:** `sha256(customer:event:id:ts + payload_hash)[:16]` + `payload.id` DB check `event_ingestion_service.py:92` + `SystemEventLog` `details.event_hash` — retry-safe, no 3 events from 1 duplicate.

**CSV remains** as admin import `routes.py:160` for migration, but not primary.

---

## 5. Signal → Health → Risk

**SignalEngine `signal_engine.py:421` 7 detectors (unchanged, already generic):**
- `SEVERE_USAGE_DECLINE -50% CRITICAL` `MODERATE -25% HIGH`, `UNRESOLVED_CRITICAL_TICKET`, `NEGATIVE_FEEDBACK`, `ADMIN_INACTIVITY 14d`, `FEATURE_ADOPTION_DECLINE`, `ENGAGEMENT_DECLINE` — compound `usage + support + sentiment` triggers HIGH.

**HealthEngine `health_engine.py:50` weighted composite clamped 0-100:**
- OrgSettings per-tenant weights `settings.py:56` default `0.40/0.30/0.20/0.10` — org can tune `PUT /org/settings` without code deploy.

**RiskEngine `risk_engine.py:26` thresholds `20/40/60/80/90` → `CRITICAL/HIGH_RISK/AT_RISK/WATCH/STABLE/HEALTHY` + `confidence 0.65+0.08*len(signals)` + `INSUFFICIENT_EVIDENCE` if <2 categories + health>60.

**TimeWindow `time_window.py:107` 7d/30d compare, safeguard `min_baseline 1.0` avoids divide-by-zero.

All deterministic, no LLM.

---

## 6. Investigation & Action

**Orchestrator `agents/orchestrator.py:52` bounded:** `MAX_ITER 8, MAX_TOOL 12, MAX_RUNTIME 60s`, `VALID_TRANSITIONS` map, `AgentState` 17 states, `AgentStep` audit per transition, sanitizes prompt injection `[CUSTOMER_DATA]`, validates `evidence_ids` against real `usage/support/feedback` ids.

**Flow `orchestrator.py:134`:**
```
SIGNAL_ANALYSIS (reassess) → INVESTIGATING (get_customer_profile, search_customer_evidence 30d, calculate_customer_signals)
→ RISK_ASSESSMENT → ROOT_CAUSE_ANALYSIS (InvestigationAgent)
→ ACTION_PLANNING (query_experience_memory tenant-scoped + ActionAgent)
→ AWAITING_APPROVAL → COMPLETED
```

**InvestigationAgent `investigation_agent.py:46`:** `SystemPrompt` cites IDs, sparse guard → `INSUFFICIENT_EVIDENCE` + `missing_evidence`, fallback deterministic payload if `mock_key_for_dev`.

**ActionAgent `action_agent.py:31`:** reads `ExperienceMemory` per tenant `tools.py:229` → `Engineering escalation + executive checkin` etc. — plan `3 steps + draft email` grounded in `TICK-101`.

**LLMClient `agents/llm_client.py:39` per-tenant `provider/model/api_key` (BYOK `OrgSettings.llm_api_key_encrypted` Fernet `APP_SECRET_KEY`), `groq: openai/gpt-oss-120b ~500tps` (current prod) / `gpt-oss-20b ~1000tps`, `openai: gpt-4o`, `gemini: gemini-2.5-pro`, fallback honest.

---

## 7. HITL

`Intervention` `models.py:307` `PROPOSED→APPROVED|REJECTED|MODIFIED→EXECUTED→COMPLETED`, `requires_approval` true unless `NO_ACTION_MONITOR` or `HEALTHY`.

**UI `Customer360.tsx:88`:** `Approve` `POST /interventions/{id}/approve?approved_by=CSM` → `SystemEventLog HUMAN_DECISION` for learning; `Reject` captures feedback; `Modify` captures `modified_action`.

No auto-send without approval in prod.

---

## 8. Measure & Learn

**Measure:** `LearningEngine.evaluate_intervention_outcome:36` `health_delta = health_after - health_before` 14d window → `≥15 SUCCESS, ≥5 PARTIAL, ≥0 PARTIAL, else FAILURE` — phrases "associated with improvement" not causal.

**Learn:** `LearningEngine._create_learning_candidate:134` `pattern: "{segment} :: {action_type}"` tenant-scoped, `sample_size = len(existing)+1`, `confidence 0.68→0.95` penalize failures → `Validation Gate` `MIN_SAMPLE 2, MIN_CONF 0.70, success>=0.6` → `VALIDATED` `ExperienceMemory` `models.py:377` `tenant_id` FK + `Chroma tenant_{id}_memories`.

**Future:** `query_experience_memory` tenant + segment filter → next plan `matched_memory_ids` ranked `success_rate`.

---

## 9. Integrations

**Adapter Interface `integrations/adapters.py`:** `class Adapter: normalize(raw) -> {customer_id, event_type, payload}`. Implement `StripeAdapter`, `HubSpotAdapter`, `ZendeskAdapter`, `GenericAdapter`. Webhook route `POST /ingest/webhook/{provider}` verifies `X-API-Key` or HMAC, calls `adapter.normalize` → `EventIngestionService`.

Add future without touching core: new adapter + route param.

---

## 10. Data Model

**Tenant-isolated (Phase 1 migration):** `Tenant(id PK)`, `User(id, tenant_id FK, email unique, password_hash, role ADMIN/MEMBER/VIEWER)`, `OrgSettings(tenant_id PK, health_weights JSON, risk_thresholds JSON, llm_provider/model/api_key_encrypted, prompts)` + `tenant_id FK indexed` on all 14 tables `models.py:75` `customers..system_event_logs`.

**Migration `alembic 001_add_tenancy_nullable`:** add nullable → backfill `tenant_id='demo-tenant-001'` → `SET NOT NULL` + index. Rollback keep nullable flag.

**Indexes already:** `idx_usage_customer_time`, `idx_tickets_customer_status`, `idx_risk_customer_time` `models.py:290`.

---

## 11. API Contracts

**Auth:** `POST /auth/signup {email,password,orgName} → {jwt, tenant_id}`, `POST /auth/login → {jwt}`, `GET /auth/me`, `Authorization: Bearer <JWT> + X-Tenant-Id` → `get_current_user`.

**Org:** `GET/PUT /org/settings` `health_weights/risk_thresholds/llm/prompts` (never raw key, `has_key` bool).

**Core (tenant-scoped):** `GET /portfolio?limit&segment&risk_level&search&sort_by` `routes.py:53`, `GET /customers/{id}/risk|timeline|signals|evidence`, `POST /events`, `POST /ingest/batch|webhook/{provider}`, `POST /agent/investigate/{id}` → `{run_id, investigation, retention_plan, state_history}`, `GET /agent-runs/{run_id}`, `POST /interventions/{id}/approve|reject|modify`, `POST /interventions/{id}/outcome`, `GET /learning`, `GET /evidence/{id}`, `GET /metrics/observability` per-tenant, `GET/PUT /config/prompts` alias.

---

## 12. Frontend

**Stack:** React18 TS Vite5 Tailwind3 `VITE_API_BASE_URL` `api.ts:5` interceptor injects JWT.

**Pages:** `/login`, `/signup`, `/onboarding` (CSV column remap `CsvUpload.tsx:22` headers → RETAINAI fields), `/command` `CommandCenter.tsx:180` KPIs `totalARR/atRiskARR/critical/watch` from `GET /portfolio` real, `/customers` `CustomersView.tsx:105` filters + CSV import + single form, `/customers/:id` `Customer360.tsx:389` 7 parallel queries + `Inject Live Data` 3 buttons → `ingestEvent` → refresh, `Run investigation` spinner → `Investigation` + `Agent trace` state_history + `EvidenceDrawer`, `/investigations` `InvestigationsView`, `/interventions` `InterventionsView`, `/learning` `LearningView` validated vs candidates, `/audit` `AuditView` `GET /metrics/observability`, `SettingsView` sliders for weights/thresholds + LLM BYOK + prompt editors.

**No hardcode:** `?? 85` → `null → <Skeleton>`, hero pinned to highest risk not Acme, `92%` → `success_rate` calc.

---

## 13. Security

- `JWT HS256` `PyJWT` `exp 24h` `JWT_SECRET` rotate, `passlib bcrypt` `User.password_hash`, `X-API-Key` fallback only when `AUTH_ENABLED=false` (demo), prod `AUTH_ENABLED=true`.
- `require_tenant` + `require_role(ADMIN)` gate `PUT /org/settings`, `POST /system/reset`.
- `TenantMiddleware` logs `tenant_id` + `X-Request-ID` `main.py:63`, rate-limit per-tenant `600/60s` `main.py:57`, `CORS` `CORS_ORIGINS` not `*` `main.py:42`.
- Secrets `.env` gitignored `.gitignore:42`, `.env.example` demo hex only, `llm_api_key_encrypted` Fernet `APP_SECRET_KEY`.
- Prompt injection sanitize `[CUSTOMER_DATA]` `orchestrator.py:108`, allowlist `ALLOWED_TOOLS` `tools.py:17`, scope `customer.tenant_id == tenant_id`.

---

## 14. Observability

- `main.py:63` `X-Request-ID` latency log, `AgentRun:485` `model_version/prompt_version` captures `provider:model@org.updated_at`, `AgentStep:438` per transition, `SystemEventLog:516` tenant-tagged, `GET /metrics/observability` `routes.py:762` per-tenant breakdown, `POST /replay/{run_id}` `routes.py:861` deterministic.

---

## 15. Deployment

- `docker-compose.yml:51` `backend:8000` `FROM python:3.12-slim` `uv sync`, `frontend:5173` `VITE_API_BASE_URL`, `postgres:16-alpine` volume, healthcheck `pg_isready`.
- `main.py:27` `lifespan` `alembic upgrade head` + `ensure_demo_tenant`.
- Env prod `DATABASE_URL=postgresql+asyncpg://.../retainaidb`, `AUTH_ENABLED=true`, `DEMO_MODE=false`, `JWT_SECRET`/`APP_SECRET_KEY` rotated.
- CI `Makefile:29` `uv run pytest -q` 31 + `tsc --noEmit` + `vite build` 265kB + `test_tenancy_isolation.py`.

---

## 16. Testing

| Gate | Command | Criteria |
|------|---------|----------|
| Unit | `uv run pytest backend/tests/test_signal_engine.py -k health_and_risk` | clamp 0-100, thresholds |
| Integration | `GET /customers/{id}/risk` after `POST /events` | health delta deterministic |
| Tenant | `test_tenancy_isolation.py` 2 tenants disjoint, cross-tenant 403 | 0 leak |
| E2E | `final_golden.py` 14 A-N + `audit_comprehensive.py` 24/24 + clean `e2e-clean-001` 28 steps | all pass |
| Smoke | `docker compose up --build -d && curl /health /readiness` | 200 |

---

## 17. Rollout

**Sprint 0 (2d)** Phase 0 harden dynamic literals, **Sprint 1 (4d)** Phase 1 tenancy, **Sprint 2 (3d)** Phase 2 onboarding + webhook, **Sprint 3 (2d)** Phase 3 per-tenant config, **Sprint 4 (1.5d)** tenant learning, **Sprint 5 (2d)** Prod harden → tag `v0.2.0-dynamic`.

Feature flag `FEATURE_TENANCY=false` keeps demo until migration green; judge gets `DEMO_API_KEY` prefilled.

---

## 18. KPIs

- TTFI `<3 min` signup→investigation, isolation 0/1000 cross-reads, `health` recomputation `<30ms` per event, portfolio KPIs drift ≥3 points on inject.

**Done `v0.2.0-dynamic`:** 2 signups isolated, CSV remap `company→name` 5 rows → 5 customers + risk, webhook `SUPPORT_TICKET CRITICAL` → health -20, investigate → evidence resolvable, settings change → next health differs, 2 successes → `VALIDATED` tenant-only.

---

## 19. File Touch Map

`db/models.py:75`, `db/session.py`, `auth/auth.py`, `main.py:27`, `api/routes.py:40/53/76/160`, `api/agent_routes.py:16`, `repositories/*.py`, `services/*`, `engine/*`, `agents/*`, `integrations/adapters.py`, `services/api.ts:5`, `context/AuthContext.tsx` NEW, `components/Onboarding.tsx` NEW, `components/SettingsView.tsx` NEW, `docker-compose.yml:12`.

*This plan makes RETAINAI real-world: any org, any data shape via adapters, tenant-isolated intelligence, BYOK LLM, validated learning — demo CSV is just one SENSE injector among webhooks.*

