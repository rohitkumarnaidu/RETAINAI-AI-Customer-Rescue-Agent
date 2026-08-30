# RETAINAI API Reference

> **Version:** `0.1.0` | **Base URL:** `http://localhost:8000` | **Prefix:** `/api/v1` | **Spec:** `http://localhost:8000/docs`

Complete REST API reference for the RETAINAI autonomous customer rescue platform. All endpoints are **unauthenticated** (MVP) and return JSON. App defined at `backend/src/retainai/main.py:20` with routers from `backend/src/retainai/api/routes.py:32` and `backend/src/retainai/api/agent_routes.py:13`.

---

## Table of Contents

1. [Overview](#overview) 2. [Endpoint Index](#endpoint-index) 3. [System](#system) 4. [Customers](#customers) 5. [Timeline](#timeline) 6. [Signals](#signals) 7. [Risk](#risk) 8. [Evidence](#evidence) 9. [Events](#events) 10. [Interventions](#interventions) 11. [Outcomes & Portfolio](#outcomes--portfolio) 12. [Learning](#learning) 13. [Agent Operations](#agent-operations) 14. [Schema Definitions](#schema-definitions) 15. [Alias & Orphaned Routes](#alias--orphaned-routes) 16. [Error Handling](#error-handling) 17. [OpenAPI](#openapi) 18. [Verification](#verification)

---

## Overview

| Property | Value |
|----------|-------|
| **Framework** | FastAPI `>=0.110.0` (`backend/pyproject.toml:12`) |
| **App entry** | `backend/src/retainai/main.py:14` -- `lifespan` calls `await init_db()` (`backend/src/retainai/db/session.py:38`) then `yield` |
| **Title** | `settings.APP_NAME` -> `RETAINAI` (`backend/src/retainai/config/settings.py:24`) |
| **Description** | `RETAINAI - The Autonomous Customer Rescue Agent API` (`backend/src/retainai/main.py:22`) |
| **Version** | `0.1.0` (`backend/src/retainai/main.py:23`) |
| **Base URL** | `http://localhost:8000` |
| **API prefix** | `/api/v1` (`backend/src/retainai/config/settings.py:35`, routers `prefix="/api/v1"`) |
| **Auth** | **None** -- `CORSMiddleware allow_origins=["*"] allow_credentials=True` (`backend/src/retainai/main.py:27-33`) |
| **Content-Type** | `application/json` |
| **CORS gap** | `.env.example:20` `CORS_ORIGINS` ignored -- `settings.py:18` `extra="ignore"` + `main.py:29` hardcodes `["*"]` |
| **Loop** | `SENSE -> THINK -> ACT -> MEASURE -> LEARN` at `GET /api/v1/status` (`backend/src/retainai/main.py:44-50`) |

### Quick Start

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/status
open http://localhost:8000/docs
```

```python
import httpx
BASE = "http://localhost:8000/api/v1"
print(httpx.get(f"{BASE}/portfolio").json()["metrics"])
```

---

## Endpoint Index

24 mounted endpoints (2 top-level + 18 in `routes.py` + 4 in `agent_routes.py`). Routers: `api_router` + `agent_router` (`backend/src/retainai/main.py:35-36`). Pagination: none. Ordering documented per endpoint.

| # | Group | Method | Path | Description |
|---|-------|--------|------|-------------|
| 1 | System | `GET` | `/health` | Liveness probe |
| 2 | System | `GET` | `/api/v1/status` | Operational mode & loop |
| 3 | System | `POST` | `/api/v1/system/reset` | Drop + re-seed 101 customers |
| 4 | Customers | `GET` | `/api/v1/customers` | List all (101) |
| 5 | Customers | `GET` | `/api/v1/customers/{customer_id}` | Get one (404 if missing) |
| 6 | Timeline | `GET` | `/api/v1/customers/{customer_id}/timeline` | Unified feed `?days=60` |
| 7 | Signals | `GET` | `/api/v1/customers/{customer_id}/signals` | Detected churn signals |
| 8 | Risk | `GET` | `/api/v1/customers/{customer_id}/risk` | Deterministic reassess |
| 9 | Risk | `POST` | `/api/v1/customers/{customer_id}/reassess` | Explicit reassess (404) |
| 10 | Evidence | `GET` | `/api/v1/customers/{customer_id}/evidence` | Supporting evidence |
| 11 | Events | `POST` | `/api/v1/events` | Ingest + auto-reassess |
| 12 | Interventions | `GET` | `/api/v1/customers/{customer_id}/interventions` | Per-customer list |
| 13 | Interventions | `POST` | `/api/v1/interventions` | Create -> `PROPOSED` |
| 14 | Interventions | `POST` | `/api/v1/interventions/{intervention_id}/approve` | Approve -> `APPROVED` |
| 15 | Interventions | `POST` | `/api/v1/interventions/{intervention_id}/outcome` | Record outcome -> Learn |
| 16 | Portfolio | `GET` | `/api/v1/portfolio` | ARR at risk + distribution |
| 17 | Learning | `GET` | `/api/v1/learning/memories` | Experience memory |
| 18 | Learning | `GET` | `/api/v1/experience-memory` | Alias (same) |
| 19 | Interventions | `GET` | `/api/v1/interventions` | All desc |
| 20 | Outcomes | `GET` | `/api/v1/outcomes` | All desc |
| 21 | Agent | `POST` | `/api/v1/agent/investigate/{customer_id}` | Full rescue workflow |
| 22 | Agent | `POST` | `/api/v1/agent/{customer_id}/investigate` | Alias |
| 23 | Agent | `GET` | `/api/v1/agent/runs/{customer_id}` | Audit history |
| 24 | Agent | `POST` | `/api/v1/agent/demo/replay_acme_step` | Acme 3-act replay |

---

## System

### `GET /health` -- `backend/src/retainai/main.py:39`

Docker `HEALTHCHECK` (`docker-compose.yml:17` `curl -f http://localhost:8000/health` interval 10s retries 5).

```json
{ "status": "ok", "service": "RETAINAI API", "version": "0.1.0", "env": "development" }
```

| Field | Type | Notes |
|-------|------|-------|
| `status` | `string` | `"ok"` |
| `service` | `string` | `"RETAINAI API"` |
| `version` | `string` | `app.version` |
| `env` | `string` | `settings.APP_ENV` |

```bash
curl http://localhost:8000/health
```

```python
import httpx
assert httpx.get("http://localhost:8000/health").json()["status"] == "ok"
```

### `GET /api/v1/status` -- `backend/src/retainai/main.py:44`

```json
{ "status": "operational", "mode": "demo", "loop": "SENSE->THINK->ACT->MEASURE->LEARN" }
```

```bash
curl http://localhost:8000/api/v1/status
```

### `POST /api/v1/system/reset` -- `backend/src/retainai/api/routes.py:35`

Drops all tables -> `Base.metadata.create_all` -> seeds 101 customers + usage/tickets/feedback/memories via `seed_demo_data()` (`backend/src/retainai/scripts/seed_database.py:73`). Idempotent. Frontend **Reset Demo** calls this (`frontend/src/App.tsx:19`, `frontend/src/services/api.ts:214`).

| Status | Body |
|--------|------|
| `200` | `{"status":"success","message":"Database reset and re-seeded with 101 customers successfully"}` |
| `500` | `{"detail":"Database reset failed: <reason>"}` (`routes.py:42`) |

```bash
curl -X POST http://localhost:8000/api/v1/system/reset
```

```python
import httpx
r = httpx.post("http://localhost:8000/api/v1/system/reset")
assert r.json()["status"] == "success"
```

> Distinct from `docker compose down -v` which deletes volume -- this truncates tables but keeps volume (see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md#rollback--reset)).

---

## Customers

### `GET /api/v1/customers` -- `backend/src/retainai/api/routes.py:45`

Via `CustomerRepository.list_all()`. Returns 101 after seed.

```bash
curl http://localhost:8000/api/v1/customers | jq '.[0] | {id, name, risk_level}'
```

```python
import httpx
cs = httpx.get("http://localhost:8000/api/v1/customers").json()
print(len(cs), cs[0]["risk_level"])
```

### `GET /api/v1/customers/{customer_id}` -- `backend/src/retainai/api/routes.py:52`

| Status | Body |
|--------|------|
| `200` | `CustomerSchema` |
| `404` | `{"detail":"Customer not found"}` |

```bash
curl http://localhost:8000/api/v1/customers/acme-corp-001 | jq '{health_score, risk_level}'
```

```python
import httpx
r = httpx.get("http://localhost:8000/api/v1/customers/acme-corp-001")
r.raise_for_status()
print(r.json()["health_score"])
```

---

## Timeline

### `GET /api/v1/customers/{customer_id}/timeline?days=60` -- `backend/src/retainai/api/routes.py:62`

Unified feed via `TimelineService.get_unified_timeline(customer_id, days=days)` merging usage, tickets, feedback, account events, assessments, interventions.

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `days` | `int` | `60` | Window in days |

Response: `List[TimelineItemSchema]` newest-first.

```bash
curl "http://localhost:8000/api/v1/customers/acme-corp-001/timeline?days=30" | jq length
```

```python
import httpx
items = httpx.get("http://localhost:8000/api/v1/customers/acme-corp-001/timeline", params={"days":60}).json()
print(items[0]["event_type"], items[0]["severity"])
```

---

## Signals

### `GET /api/v1/customers/{customer_id}/signals` -- `backend/src/retainai/api/routes.py:69`

Via `SignalService.get_customer_signals`. Engine maps `category` -> health dimension; `impact_score` deducts from dimension.

```bash
curl http://localhost:8000/api/v1/customers/acme-corp-001/signals | jq '.[] | {signal_type, severity, impact_score}'
```

---

## Risk

Risk computed as **SignalEngine -> HealthEngine -> RiskEngine**. Health weights `0.4/0.3/0.2/0.1` (`backend/src/retainai/config/settings.py:38-47`). Thresholds `20/40/60/80/90` -> `CRITICAL/HIGH_RISK/AT_RISK/WATCH/STABLE/HEALTHY` (`backend/src/retainai/engine/risk_engine.py`, hardcoded `90` in engine).

### `GET /api/v1/customers/{customer_id}/risk` -- `backend/src/retainai/api/routes.py:76`

Via `CustomerService.reassess_customer_risk`. Returns `RiskAssessmentSchema`-like dict with `health_score`, `risk_level`, `detected_signals`, `confidence`.

```bash
curl http://localhost:8000/api/v1/customers/acme-corp-001/risk | jq '{health_score, risk_level, confidence}'
```

### `POST /api/v1/customers/{customer_id}/reassess` -- `backend/src/retainai/api/routes.py:83`

Explicit reassess -- same logic as `GET /risk` but mutation verb. Returns `404` if `ValueError` (unknown customer).

| Status | Condition |
|--------|-----------|
| `200` | Computed |
| `404` | Unknown `customer_id` |

```bash
curl -X POST http://localhost:8000/api/v1/customers/acme-corp-001/reassess | jq
```

---

## Evidence

### `GET /api/v1/customers/{customer_id}/evidence` -- `backend/src/retainai/api/routes.py:93`

Via `EvidenceRepository.get_customer_evidences`. Returns `List[EvidenceSchema]`.

```bash
curl http://localhost:8000/api/v1/customers/acme-corp-001/evidence | jq '.[0]'
```

---

## Events

### `POST /api/v1/events` -- `backend/src/retainai/api/routes.py:100`

SENSE entry. `EventIngestionService.ingest_event` persists, recalculates signals, triggers reassess. Request: `EventIngestRequest` (`backend/src/retainai/models/schemas.py:109`).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `customer_id` | `string` | yes | Must exist |
| `event_type` | `string` | yes | e.g. `FEATURE_CLICK`, `SUPPORT_TICKET_CREATED`, `FEEDBACK_SUBMITTED` |
| `payload` | `Dict[str,Any]` | yes | Arbitrary JSON |
| `timestamp` | `datetime \| null` | no | ISO 8601; server-now if omitted |

```bash
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"acme-corp-001","event_type":"NEGATIVE_FEEDBACK","payload":{"score":1,"text":"CSV export broken"},"timestamp":"2026-08-30T12:00:00Z"}' | jq
```

```python
import httpx, datetime
r = httpx.post("http://localhost:8000/api/v1/events", json={
    "customer_id": "acme-corp-001",
    "event_type": "SUPPORT_TICKET_CREATED",
    "payload": {"severity": "CRITICAL", "category": "BUG"},
    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
})
print(r.json())
```

---

## Interventions

### `GET /api/v1/customers/{customer_id}/interventions` -- `backend/src/retainai/api/routes.py:112`

Via `InterventionService.get_customer_interventions`. `List[InterventionSchema]`.

```bash
curl http://localhost:8000/api/v1/customers/acme-corp-001/interventions | jq
```

### `POST /api/v1/interventions` -- `backend/src/retainai/api/routes.py:119`

Creates `PROPOSED` intervention. ID: `inv_{customer_id[:8]}_{uuid8}` (`routes.py:124`). Request: `InterventionCreateRequest` (`schemas.py:116`).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `customer_id` | `string` | yes | |
| `investigation_id` | `string` | yes | Links to agent run or manual |
| `action_type` | `string` | yes | `ENGINEERING_ESCALATION`, `EXECUTIVE_CHECKIN`, … |
| `title` | `string` | yes | |
| `description` | `string` | yes | |
| `plan` | `string` | yes | Steps as string (agent returns structured) |

Response `200`: `InterventionSchema` `status="PROPOSED"`.

```bash
curl -X POST http://localhost:8000/api/v1/interventions \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"acme-corp-001","investigation_id":"manual-001","action_type":"EXECUTIVE_CHECKIN","title":"Exec check-in","description":"Renewal risk","plan":"1. Prep 2. Call 3. Follow"}' | jq '{id, status}'
```

```python
import httpx
r = httpx.post("http://localhost:8000/api/v1/interventions", json={
    "customer_id": "acme-corp-001", "investigation_id": "manual-001",
    "action_type": "EXECUTIVE_CHECKIN", "title": "Exec check-in",
    "description": "High-touch", "plan": "1. Prep 2. Call"
})
print(r.json()["id"], r.json()["status"])
```

### `POST /api/v1/interventions/{intervention_id}/approve?approved_by=CSM` -- `backend/src/retainai/api/routes.py:136`

`PROPOSED -> APPROVED`. Query param `approved_by` default `"CSM"`.

| Status | Condition |
|--------|-----------|
| `200` | `InterventionSchema` with `approved_at`, `approved_by` |
| `404` | `Intervention not found` |

```bash
curl -X POST "http://localhost:8000/api/v1/interventions/inv_acme_001/approve?approved_by=Alice%20CSM" | jq .status
```

### `POST /api/v1/interventions/{intervention_id}/outcome` -- `backend/src/retainai/api/routes.py:146`

Records outcome -> `LearningEngine.evaluate_intervention_outcome` validation gate. Supports path param **or** body `intervention_id` (`routes.py:151` `effective_id = req.intervention_id or intervention_id`). Request: `OutcomeCreateRequest` (`schemas.py:142`).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `intervention_id` | `string \| null` | no | Fallback to path param |
| `health_before` | `float` | yes | 0–100 |
| `health_after` | `float` | yes | 0–100 |
| `usage_before` | `float` | no | default `0.0` |
| `usage_after` | `float` | no | default `0.0` |
| `customer_response` | `string \| null` | no | `positive`/`neutral`/`negative` |
| `notes` | `string \| null` | no | |

Response `200`: `OutcomeSchema` with `health_delta`, `confidence`, `evaluation_status`.

```bash
curl -X POST http://localhost:8000/api/v1/interventions/inv_acme_001/outcome \
  -H "Content-Type: application/json" \
  -d '{"health_before":42,"health_after":78,"usage_before":120,"usage_after":210,"customer_response":"positive","notes":"Recovered +44 pts"}' | jq
```

```python
import httpx
r = httpx.post("http://localhost:8000/api/v1/interventions/inv_acme_001/outcome", json={
    "intervention_id": "inv_acme_001", "health_before": 42, "health_after": 78,
    "usage_before": 120, "usage_after": 210, "customer_response": "positive"
})
print(r.json()["evaluation_status"], r.json()["health_delta"])
```

---

## Outcomes & Portfolio

### `GET /api/v1/interventions` (all) -- `backend/src/retainai/api/routes.py:197`

All interventions `order_by created_at desc`.

```bash
curl http://localhost:8000/api/v1/interventions | jq length
```

### `GET /api/v1/outcomes` (all) -- `backend/src/retainai/api/routes.py:203`

All outcomes `order_by created_at desc`.

```bash
curl http://localhost:8000/api/v1/outcomes | jq '.[0] | {intervention_id, health_delta}'
```

### `GET /api/v1/portfolio` -- `backend/src/retainai/api/routes.py:163`

Aggregates: `total_customers`, `arr_at_risk` (sum `arr` where `risk_level in (CRITICAL,HIGH_RISK,AT_RISK)`), `risk_distribution` histogram. Powers Command Center KPIs.

```json
{
  "metrics": { "total_customers": 101, "arr_at_risk": 1250000.0, "risk_distribution": { "HEALTHY": 42, "CRITICAL": 6 } },
  "customers": [ { "id": "...", "risk_level": "CRITICAL" } ]
}
```

```bash
curl http://localhost:8000/api/v1/portfolio | jq '.metrics'
```

```python
import httpx
print(httpx.get("http://localhost:8000/api/v1/portfolio").json()["metrics"]["risk_distribution"])
```

---

## Learning

### `GET /api/v1/learning/memories` -- `backend/src/retainai/api/routes.py:184`

Via `MemoryRepository.list_all()`. `List[ExperienceMemorySchema]`.

```bash
curl http://localhost:8000/api/v1/learning/memories | jq '.[0] | {context_pattern, validation_status}'
```

### `GET /api/v1/experience-memory` -- `backend/src/retainai/api/routes.py:191`

**Alias** -- identical handler, prefer `/learning/memories`.

```bash
curl http://localhost:8000/api/v1/experience-memory | jq length
```

```python
import httpx
a = httpx.get("http://localhost:8000/api/v1/learning/memories").json()
b = httpx.get("http://localhost:8000/api/v1/experience-memory").json()
assert len(a) == len(b)
```

---

## Agent Operations

Router `prefix="/api/v1/agent"` tag `Agent Operations` (`backend/src/retainai/api/agent_routes.py:13`).

### `POST /api/v1/agent/investigate/{customer_id}` -- `backend/src/retainai/api/agent_routes.py:16`

Full rescue workflow (`Sense -> Think -> Act`) via `AgentOrchestrator.run_full_rescue_workflow(customer_id)`.

Response `200` -- `FullAgentInvestigationResponse` (`frontend/src/services/api.ts:145`):

```json
{
  "run_id": "run_9f3c...",
  "customer_id": "acme-corp-001",
  "health_dimensions": { "usage": 42, "support": 55, "sentiment": 60, "engagement": 48 },
  "risk_assessment": { "risk_level": "AT_RISK", "health_score": 48.3, "confidence": 0.85 },
  "investigation": {
    "summary": "CSV export bug + usage decline",
    "root_cause": "HIGH_RISK_SUPPORT_BUG_FRICTION",
    "confidence": 0.88,
    "uncertainty_status": "CONFIDENT",
    "evidence_ids": ["TICK-101"],
    "recommended_action_summary": "Engineering escalation",
    "missing_evidence": []
  },
  "retention_plan": {
    "objective": "Restore export reliability", "priority": "P1",
    "action_type": "ENGINEERING_ESCALATION", "title": "Escalate CSV fix",
    "description": "...",
    "plan_steps": [{ "step": 1, "title": "...", "owner": "Eng", "action": "..." }],
    "draft_email": { "subject": "...", "body": "..." }
  },
  "intervention_id": "inv_acme-co_9f3c..."
}
```

| Status | Condition |
|--------|-----------|
| `200` | Completed (or `FALLBACK` if `LLM_API_KEY=mock_key_for_dev`) |
| `500` | `detail: "Agent investigation failed: <reason>"` (`agent_routes.py:23`) |

```bash
curl -X POST http://localhost:8000/api/v1/agent/investigate/acme-corp-001 | jq '{run_id, intervention_id}'
```

```python
import httpx
data = httpx.post("http://localhost:8000/api/v1/agent/investigate/acme-corp-001", timeout=60).json()
print(data["investigation"]["root_cause"], data["intervention_id"])
```

### `POST /api/v1/agent/{customer_id}/investigate` -- `backend/src/retainai/api/agent_routes.py:26`

Alias -- same handler, path-param-first style.

```bash
curl -X POST http://localhost:8000/api/v1/agent/acme-corp-001/investigate | jq
```

### `GET /api/v1/agent/runs/{customer_id}` -- `backend/src/retainai/api/agent_routes.py:35`

Audit history `order_by started_at desc`. Returns `List[AgentRunDTO]` with `id, started_at, completed_at, status, workflow_type, model, input_summary, output_summary, tool_calls, error`.

```bash
curl http://localhost:8000/api/v1/agent/runs/acme-corp-001 | jq '.[0] | {id, status, model}'
```

### `POST /api/v1/agent/demo/replay_acme_step` -- `backend/src/retainai/api/agent_routes.py:61`

Demo helper via `AcmeReplayEngine` (`backend/src/retainai/demo/acme_replay.py`).

| Param | Type | Default | Allowed |
|-------|------|---------|---------|
| `step` | `string` | `friction` | `healthy` / `friction` / `recovery` |
| `intervention_id` | `string` | `inv_acme_001` | any (used only for `recovery`) |

| `step` | Handler | Effect |
|--------|---------|--------|
| `healthy` | `step_healthy_baseline()` | Acme healthy baseline |
| `friction` | `step_inject_friction()` | Inject critical ticket + usage drop |
| `recovery` | `step_post_intervention_recovery(intervention_id)` | Simulate recovery |

| Status | Condition |
|--------|-----------|
| `200` | Step executed |
| `400` | `Invalid step name. Choose 'healthy', 'friction', or 'recovery'.` (`agent_routes.py:74`) |

```bash
curl -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=healthy" | jq
curl -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=friction" | jq
curl -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=recovery&intervention_id=inv_acme_001" | jq
```

---

## Schema Definitions

All Pydantic models at `backend/src/retainai/models/schemas.py:1`. ORM at `backend/src/retainai/db/models.py`. `from_attributes=True` hydrates from ORM.

### Core Schemas

**`HealthComponentsSchema` / `HealthDimensionSchema`** (`schemas.py:8`, alias `schemas.py:17`):

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `usage_health` | `float` | `100.0` | 0–100 |
| `support_health` | `float` | `100.0` | |
| `sentiment_health` | `float` | `100.0` | |
| `engagement_health` | `float` | `100.0` | |
| `overall_health` | `float` | `100.0` | `0.4*usage+0.3*support+0.2*sentiment+0.1*engagement` |

**`DetectedSignalSchema`** (`schemas.py:20`): `signal_type, category (USAGE/SUPPORT/FEEDBACK/ACTIVITY), severity (LOW/MEDIUM/HIGH/CRITICAL), value, baseline, delta_pct, summary, evidence_ids[], impact_score`.

**`ComputedSignalSchema`** (`schemas.py:32`): `name, category, impact_score, evidence_id?`.

**`CustomerSchema`** (`schemas.py:39`): `id, external_id?, name, domain, segment, industry, plan, mrr, arr, csm_name, csm_email, start_date, renewal_date, status, health_score, risk_level (HEALTHY/STABLE/WATCH/AT_RISK/HIGH_RISK/CRITICAL), is_false_positive_candidate, created_at`.

**`RiskAssessmentSchema`** (`schemas.py:62`): `id, customer_id, created_at (auto now), health_score, risk_level, usage/support/sentiment/engagement_health (100), detected_signals[], confidence 0.85, calculation_version "v1.0"`.

**`RetentionPlanSchema`** (`schemas.py:79`): `objective, priority, root_cause, steps[] (Dict), draft_email (Dict)`.

**`EvidenceSchema`** (`schemas.py:87`): `id, customer_id, source_type, source_id, timestamp, summary, importance`.

**`TimelineItemSchema`** (`schemas.py:99`): `id, timestamp (string ISO), source, event_type, title, details {}, severity INFO`.

### Request / Response Schemas

| Schema | File | Fields |
|--------|------|--------|
| `EventIngestRequest` | `schemas.py:109` | `customer_id*, event_type*, payload* Dict, timestamp? datetime` |
| `InterventionCreateRequest` | `schemas.py:116` | `customer_id*, investigation_id*, action_type*, title*, description*, plan*` |
| `InterventionSchema` | `schemas.py:125` | `id (inv_{cust8}_{uuid8}), customer_id, investigation_id, action_type, title, description, plan, status, created_at, approved_at?, completed_at?, approved_by?` |
| `OutcomeCreateRequest` | `schemas.py:142` | `intervention_id? (fallback to path), health_before*, health_after*, usage_before 0, usage_after 0, customer_response?, notes?` |
| `OutcomeSchema` | `schemas.py:152` | `id, intervention_id, customer_id, created_at, status, health_before, health_after, health_delta, usage_before/after, customer_response?, notes?, confidence, evaluation_status` |
| `ExperienceMemorySchema` | `schemas.py:171` | `id, created_at, context_pattern, customer_segment, risk_pattern, signals[], recommended_strategy, actual_action, observed_outcome, confidence, validation_status (CANDIDATE/VALIDATED/REJECTED), success_count, failure_count` |

---

## Alias & Orphaned Routes

### Aliases (mounted, supported)

| Canonical | Alias | File | Recommendation |
|-----------|-------|------|----------------|
| `GET /learning/memories` | `GET /experience-memory` | `routes.py:184/191` | Use `/learning/memories` |
| `POST /agent/investigate/{id}` | `POST /agent/{id}/investigate` | `agent_routes.py:16/26` | Use `/agent/investigate/{id}` |
| `intervention_id` body `null` | path param | `routes.py:151` | `effective_id = body.id or path` |

All aliases return identical shapes -- no deprecation headers (MVP).

### Orphaned Files (NOT mounted -- `404` if called)

Routers in these files are **never included** in `main.py:35-36` -- dead code, listed to prevent confusion.

| File | Prefix | Tag | Bug / Drift |
|------|--------|-----|-------------|
| `backend/src/retainai/api/agent.py:11` | `/api/v1/agent` | `Agent` | `from retainai.agent.orchestrator` should be `agents` -- import fails if mounted |
| `backend/src/retainai/api/customers.py:12` | `/api/v1/customers` | `Customers` | Orders `RiskAssessment` by `timestamp` not `created_at` (`customers.py:37`); also duplicates `/interventions` with `created_at` |
| `backend/src/retainai/api/experience.py:12` | `/api/v1` | `Experience & Actions` | Orders `ExperienceMemory` by `last_updated` not `updated_at` (`experience.py:18`), `InterventionOutcome` by `evaluated_at` not `created_at` (`experience.py:32`) |

> Authoritative routers are `routes.py` + `agent_routes.py` only. Verify via `backend/src/retainai/main.py:35-36`.

---

## Error Handling

Standard FastAPI envelope: `{"detail": "<message>"}`.

| Status | When | Example `detail` |
|--------|------|------------------|
| `200` | Success | -- |
| `400` | Invalid Acme `step` | `Invalid step name. Choose 'healthy', 'friction', or 'recovery'.` (`agent_routes.py:74`) |
| `404` | Unknown `customer_id`/`intervention_id` | `Customer not found` (`routes.py:58`), `Intervention not found` (`routes.py:142`) |
| `422` | Pydantic validation | `{"detail":[{"loc":["body","customer_id"],"msg":"Field required"}]}` |
| `500` | Unhandled reset/agent error | `Database reset failed: <err>` (`routes.py:42`), `Agent investigation failed: <err>` (`agent_routes.py:23`) |

No `401`/`403` -- auth not installed. CORS permissive (`main.py:29` `["*"]`). Path params are `str`; unknown IDs -> `404` not `422`. `OutcomeCreateRequest.health_before/after` required `float`.

---

## OpenAPI

| URL | Format |
|-----|--------|
| `http://localhost:8000/docs` | Swagger UI (try-it-out) |
| `http://localhost:8000/redoc` | ReDoc |
| `http://localhost:8000/openapi.json` | Raw JSON |

Generated from `schemas.py:1` + route decorators. Tag `Agent Operations` (`agent_routes.py:13`). Frontend client at `frontend/src/services/api.ts:1` uses `axios` with `baseURL = VITE_API_BASE_URL || 'http://localhost:8000/api/v1'` -- `VITE_*` baked at build (see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md)).

```bash
curl http://localhost:8000/openapi.json -o openapi.json
npx @openapitools/openapi-generator-cli generate -i openapi.json -g typescript-axios -o ./generated
```

---

## Verification

```bash
# Liveness
curl -s http://localhost:8000/health | jq
# {"status":"ok","service":"RETAINAI API","version":"0.1.0","env":"development"}
curl -s http://localhost:8000/api/v1/status | jq

# Portfolio (101 after seed)
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.total_customers'

# Customer & timeline
curl -s http://localhost:8000/api/v1/customers/acme-corp-001 | jq '{risk_level, health_score}'
curl -s "http://localhost:8000/api/v1/customers/acme-corp-001/timeline?days=60" | jq length

# Signals, risk, evidence
curl -s http://localhost:8000/api/v1/customers/acme-corp-001/signals | jq length
curl -s http://localhost:8000/api/v1/customers/acme-corp-001/risk | jq
curl -s http://localhost:8000/api/v1/customers/acme-corp-001/evidence | jq '.[0]'

# Event ingestion
curl -s -X POST http://localhost:8000/api/v1/events -H "Content-Type: application/json" \
  -d '{"customer_id":"acme-corp-001","event_type":"FEEDBACK_SUBMITTED","payload":{"sentiment":"NEGATIVE"}}' | jq

# Intervention lifecycle
IID=$(curl -s -X POST http://localhost:8000/api/v1/interventions -H "Content-Type: application/json" \
  -d '{"customer_id":"acme-corp-001","investigation_id":"manual-verify","action_type":"EXECUTIVE_CHECKIN","title":"Verify","description":"Verify lifecycle","plan":"1. Call"}' | jq -r .id)
curl -s -X POST "http://localhost:8000/api/v1/interventions/$IID/approve?approved_by=QA" | jq .status
curl -s -X POST "http://localhost:8000/api/v1/interventions/$IID/outcome" -H "Content-Type: application/json" \
  -d '{"health_before":50,"health_after":75,"usage_before":100,"usage_after":180,"customer_response":"positive"}' | jq

# Agent (3-8s; deterministic fallback if mock key)
curl -s -X POST http://localhost:8000/api/v1/agent/investigate/acme-corp-001 | jq '{run_id, intervention_id}'

# Acme 3-act
curl -s -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=healthy" | jq
curl -s -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=friction" | jq
curl -s -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=recovery&intervention_id=inv_acme_001" | jq

# OpenAPI
curl -s http://localhost:8000/openapi.json | jq '.info.title'  # "RETAINAI"
```

> Served by `uvicorn retainai.main:app` (`backend/Dockerfile:8`, `Makefile:24`). Paths relative to workspace root.

