# API CONTRACT AUDIT — RETAINAI

**Date:** 2026-08-30 | **Branch:** master @14197b2 | **Files:** `backend/src/retainai/api/routes.py` (600 lines, 33 routes), `api/agent_routes.py` (74 lines, 4 routes), `api/agent.py` + `customers.py` + `experience.py` (8 ghost), `main.py` (125 lines), `auth/auth.py`, `models/schemas.py`

## 1. Endpoint Inventory — 43 Endpoints (37 mounted + 8 ghost + 3 infra → headline 43 after dedup)

Count method: `grep -c "@router\.(get|post|put|delete)"` across `api/` = 45 decorators; minus 2 duplicates (`experience-memory` triplicate counts) = 43 distinct contracts. Mounted set = `main.py:97` `app.include_router(api_router)` + `agent_router` only — orphan files never mounted.

### 1.1 Canonical Mounted (33 + 4)

| # | Method | Path | Request | Response | Caller (frontend) | Service / Repo | DB Tables Touched | Error States |
|---|--------|------|---------|----------|-------------------|----------------|-------------------|--------------|
| 1 | POST | `/api/v1/system/reset` | none | `{status,message}` | `api.ts:41 resetDemo()` + `App.tsx:26` button | `seed_demo_data()` `routes.py:36` `scripts/seed_database.py` | **ALL** (`drop_all`+`create_all`) | 403 prod-gated, 500 seed fail — **P0 unauth** |
| 2 | GET | `/api/v1/customers` | `?limit=200,offset=0,risk_level,segment,search,sort_by,sort_order` bounded `routes.py:64-65` 1..500 | `List[CustomerSchema]` | `api.ts:29 getCustomers()` | `CustomerRepository.list_all_paginated` `routes.py:49` | `customers` | 422 invalid sort_by (silent) |
| 3 | GET | `/api/v1/customers/{customer_id}` | path id | `CustomerSchema` | `api.ts:30 getCustomer()` `Customer360.tsx:28` | `CustomerRepository.get_by_id` `routes.py:72` | `customers` | 404 |
| 4 | GET | `/api/v1/customers/{customer_id}/timeline` | `?days=60` | `List[TimelineEvent{source,timestamp,title}]` | `api.ts:32 getCustomerTimeline()` | `TimelineService.get_unified_timeline` `routes.py:82` `timeline_service.py` | `usage_events,support_tickets,customer_feedbacks,account_events,risk_assessments` | 404 customer |
| 5 | GET | `/api/v1/customers/{customer_id}/signals` | — | `List[DetectedSignal.to_spec_dict]` | `api.ts:34 getCustomerSignals()` | `SignalService.get_customer_signals` `routes.py:89` | 4 telemetry + `signal_engine` | — |
| 6 | GET | `/api/v1/customers/{customer_id}/risk` | — | `RiskResult.to_spec_dict{health_score,risk_level,risk_score,health_components,confidence,evidence_ids}` | `api.ts:33 getCustomerRisk()` `Customer360.tsx:30` | **`CustomerService.reassess_customer_risk` `routes.py:96`** — WRITES | `risk_assessments` INSERT + `customers` update | **200 but MUTATES (P2-01)** |
| 7 | POST | `/api/v1/customers/{customer_id}/reassess` | — | same as #6 | reassess alias | same `routes.py:103` try/except `ValueError→404` | `risk_assessments` | 404 |
| 8 | GET | `/api/v1/customers/{customer_id}/evidence` | — | `List[Evidence{source_type,summary}]` | `api.ts:43 getCustomerEvidence()` | `EvidenceRepository.get_customer_evidences` `routes.py:113` | `evidences` | — |
| 9 | POST | `/api/v1/events` | `EventIngestRequest{customer_id,event_type,payload,timestamp,_dedup_id}` validated `routes.py:124-130` | `{ingested,signals,risk}` | manual ingestion | `EventIngestionService.ingest_event` `routes.py:120` | `system_event_logs` + per-type | 400 id>80, 413 >10k, 422 bad event_type 12-allowlist, 500 |
| 10 | POST | `/api/v1/customers/{customer_id}/investigate` | — | `FullAgentInvestigationResponse` | alias for agent | `AgentOrchestrator.run_full_rescue_workflow` `routes.py:148` | `agent_runs,investigation_reports,interventions` | 500 orch fail |
| 11 | GET | `/api/v1/customers/{customer_id}/recommendations` | — | `List[{recommendation_id,intervention_id,action_type,status,priority}]` `routes.py:165` | `CustomersView` future | `InterventionService.get_customer_interventions` `routes.py:159` | `interventions` | — |
| 12 | GET | `/api/v1/customers/{customer_id}/memory` | — | `List[ExperienceMemory]` filtered segment | `api.ts:45 getCustomerMemory()` `Customer360.tsx:31` | `MemoryRepository.get_validated_memories(segment)` `routes.py:182` | `customers,experience_memories` | 404 customer |
| 13 | GET | `/api/v1/learning` | — | `{candidates[20],validated_memories}` | `api.ts:47 getLearningOverview()` `LearningView.tsx` | `select LearningCandidate` + `MemoryRepository` `routes.py:195` | `learning_candidates,experience_memories` | — |
| 14 | GET | `/api/v1/evidence/{evidence_id}` | path id | `{evidence_id,source_type,data:obj.__dict__[0:500]}` | `ui.tsx: EvidenceDrawer` `api.ts:44 resolveEvidence()` | 4-table scan + fallback `evidences` `routes.py:242` | `usage_events,support_tickets,customer_feedbacks,account_events,evidences` | 404 |
| 15 | GET | `/api/v1/agent-runs/{run_id}` | — | `{run_id,customer_id,status,current_state,state_history,steps[]}` | `api.ts:38 getAgentRunDetail()` | `AgentRun+AgentStep` `routes.py:273` | `agent_runs,agent_steps` | 404 |
| 16 | GET | `/api/v1/customers/{customer_id}/interventions` | — | `List[InterventionSchema]` | `api.ts:42 getCustomerInterventions()` `Customer360.tsx:32` | `InterventionService` `routes.py:307` | `interventions` | — |
| 17 | POST | `/api/v1/interventions` | `InterventionCreateRequest{customer_id,investigation_id,action_type,title,description,plan}` | `InterventionSchema` | orchestrator internal | `InterventionService.create_intervention` `routes.py:314` constructs `Intervention(id=f"inv_…")` | `interventions` | **500 FK if investigation_id invalid (P0-04)** |
| 18 | POST | `/api/v1/interventions/{intervention_id}/approve` | `?approved_by` len>100→400 `routes.py:334` | `InterventionSchema` | `api.ts:39 approveIntervention()` `Customer360.tsx:60` | `approve_intervention` `routes.py:331` | `interventions` | 400 `;--` guard, 404 |
| 19 | POST | `/api/v1/interventions/{intervention_id}/reject` | `?reason,actor` | `InterventionSchema` | `api.ts:40 rejectIntervention()` | `reject_intervention` `routes.py:345` | `interventions` | 404 |
| 20 | POST | `/api/v1/interventions/{intervention_id}/modify` | `{modified_action,reason,actor}` | `InterventionSchema` | — | `modify_intervention` `routes.py:355` | `interventions` | 404 |
| 21 | POST | `/api/v1/recommendations/{recommendation_id}/approve` | `?approved_by` | `{recommendation_id,decision,intervention_id,status}` | `recommendation_id` alias | `select where recommendation_id==` fallback `routes.py:366-373` | `interventions` | 404 |
| 22 | POST | `/api/v1/recommendations/{recommendation_id}/reject` | `?reason,actor` | same | alias | same `routes.py:382` | `interventions` | 404 |
| 23 | POST | `/api/v1/recommendations/{recommendation_id}/modify` | body | same | alias | same `routes.py:394` | `interventions` | 404 |
| 24 | POST | `/api/v1/interventions/{intervention_id}/outcome` | `OutcomeCreateRequest{health_before,health_after,usage_before,usage_after,customer_response,notes}` | `InterventionOutcome` | Measure tab | `LearningEngine.evaluate_intervention_outcome` `routes.py:406` | `intervention_outcomes,learning_candidates,experience_memories` | 422 missing fields |
| 25 | GET | `/api/v1/portfolio` | — | `{metrics:{total_customers,arr_at_risk,risk_distribution},customers[]}` | `api.ts:50 getPortfolio()` `CommandCenter.tsx:15` | `CustomerRepository.list_all` `routes.py:423` | `customers` | — |
| 26 | GET | `/api/v1/learning/memories` | `?limit=50,offset=0` capped 1..200 `routes.py:451` | `List[ExperienceMemorySchema]` slice `[offset:offset+limit]` | `api.ts:46 getExperienceMemories()` try→fallback | `MemoryRepository.list_all()` `routes.py:444` | `experience_memories` | — |
| 27 | GET | `/api/v1/experience-memory` | same | same alias | alias fallback `api.ts:46` second try | same `routes.py:457` | `experience_memories` | — |
| 28 | GET | `/api/v1/interventions` | `?limit,offset,status` | `List[InterventionSchema]` ordered `created_at desc` | `api.ts:48 getAllInterventions()` `ActionCenter.tsx:27` | `select interventions where status` `routes.py:470` | `interventions` | — |
| 29 | GET | `/api/v1/outcomes` | `?limit,offset` | `List[OutcomeSchema]` | `api.ts:49 getAllOutcomes()` → `void outData` `ActionCenter.tsx:33` | `select intervention_outcomes` `routes.py:487` | `intervention_outcomes` | — |
| 30 | GET | `/api/v1/metrics/observability` | — | `{agent_runs{total,completed,completion_rate},tool_calls{success_rate:0.97},outcomes{success_rate},learning{candidates,validated_memories}}` | `api.ts:51 getObservability()` `AuditView.tsx` | `AgentRun+Outcome+Candidate` `routes.py:501` | 4 tables | **fabricated 0.97 literal `routes.py:525`** |
| 31 | GET | `/api/v1/config/prompts` | — | `{investigation{effective,override,default,is_custom},action{…},provider,model,timeout}` | — | `settings` + `agents/investigation_agent.DEFAULT_SYSTEM_PROMPT` `routes.py:532` | — | — |
| 32 | PUT | `/api/v1/config/prompts` | `{investigation,action,provider,model}` >10k→413 `routes.py:563` | same echo | — | `settings` mutation `routes.py:557` | — | 413 |
| 33 | POST | `/api/v1/replay/{run_id}` | — | `{run_id,input_event,customer_state,tool_outputs,configuration,execution_sequence,recorded_replay_mode}` | — | `AgentRun` `routes.py:581` | `agent_runs` | 404 |
| 34 | POST | `/api/v1/agent/investigate/{customer_id}` | — | `FullAgentInvestigationResponse` | `api.ts:35 runInvestigation()` primary | `AgentOrchestrator` `agent_routes.py:16` | `agent_runs,…` | 500 |
| 35 | POST | `/api/v1/agent/{customer_id}/investigate` | — | same | duplicate | same `agent_routes.py:26` — **shadow (P2-09)** | same | 500 when `customer_id=="investigate"` |
| 36 | GET | `/api/v1/agent/runs/{customer_id}` | — | `List[{id,started_at,status,workflow_type,tool_calls}]` | `api.ts:37 getAgentRuns()` `Customer360.tsx:34` | `AgentRun where customer_id` `agent_routes.py:35` | `agent_runs` | — |
| 37 | POST | `/api/v1/agent/demo/replay_acme_step` | `?step=healthy|friction|recovery,intervention_id` | step payload | demo harness | `AcmeReplayEngine` `agent_routes.py:61` | `customers,risk_assessments` | 400 bad step |

Infra: `GET /health` `main.py:103` liveness, `GET /readiness` `main.py:108` `SELECT 1` → 503 if DB down, `GET /api/v1/status` `main.py:119` static `{operational,demo,SENSE→THINK…}`.

Orphaned (never mounted `main.py:97`): `api/agent.py:10` 1 route, `api/customers.py:12` 4 routes (notably `GET /customers/{id}/risk` returns `List` vs canonical dict `customers.py:12`), `api/experience.py:12` 3 routes — total 8 ghosts counted in 43 headline after dedup.

## 2. Critical Findings

**GET /risk mutates (P2-01)** `routes.py:96` calls `reassess_customer_risk` → INSERT. Polling every 60s floods `risk_assessments`. Fix: `GET` reads `select ... order_by created_at desc limit 1`; keep `POST /reassess` `routes.py:103` as sole writer (idempotent guard).

**POST /system/reset unauth (P0-02)** `routes.py:36` gated only `DEBUG||DEMO_MODE` (both True default `settings.py:38-39`) + `Depends(get_current_user)` is DEMO_BYPASS `auth/auth.py:107 admin customer_ids=None`. Repro: `curl -X POST localhost:8000/api/v1/system/reset` → 200. Fix: `require_role(["admin"])` + `if settings.AUTH_ENABLED or settings.ENV=="production": 403` without DEMO_BYPASS; add idempotency token.

**Duplicate shadow (P2-09)** `agent_routes.py:16 /agent/investigate/{id}` vs `:26 /agent/{id}/investigate` — FastAPI route order makes second match `id="investigate"` with `customer_id="investigate"` → surprising 404. Keep one canonical `POST /customers/{id}/investigate` `routes.py:148`.

**Triplicate memories** `routes.py:444 /learning/memories` vs `:457 /experience-memory` vs ghost `experience.py:12`. Two mounted impls use `repo.list_all()[offset:offset+limit]` without `order_by` → nondet pagination; `getExperienceMemories()` `api.ts:46` tries `/learning/memories` then fallback `/experience-memory` hedging. Deduplicate to single `/learning/memories` ordered `updated_at desc`.

**recommendation_id alias contract** `db/models.py:313 recommendation_id String(80) nullable` + `routes.py:366` double-lookup `select where recommendation_id==` then `where id==` + `routes.py:167 recommendation_id || id` in portfolio. Frontend passes `intervention_id` as `recommendation_id` path — works via fallback but undocumented. Return both fields consistently and document.

**Orphans spec drift** `customers.py:12` `GET /customers/{id}/risk` returns `List[RiskAssessment]` while canonical `routes.py:96` returns dict `RiskResult.to_spec_dict` — mounting both would 500 `Customer360.tsx:73`. Delete orphans `D-P1-01`.

**Observability fabricated** `routes.py:525 success_rate: 0.97 if total_runs>0 else 1.0` literal — not computed from `AgentStep.status`.

## 3. Pagination & Sorting Contract

All list endpoints cap `limit 1..200` `routes.py:451,464,478,495` and `offset >=0`. Only `GET /customers` `routes.py:67` supports `sort_by/sort_order + search/risk_level/segment`; others are plain `offset:offset+limit` over `list_all()` in memory — O(N) on large portfolios. Add DB-level `limit/offset/order_by`.

## 4. Error Handling Gap

`main.py:84 @app.exception_handler(Exception)` catches subclass `HTTPException` → 404/422/413/403 all become 500 `INTERNAL_ERROR`. Every `raise HTTPException(404)` in table above is currently a 500. Fix split: `if isinstance(exc, HTTPException): raise exc` at top of handler.

## 5. Auth Coverage

All 37 mounted routes declare `Depends(get_current_user)` but `settings.AUTH_ENABLED=false` `config/settings.py:41` returns admin `customer_ids=None` `auth.py:107` → tenant isolation none. Valid for hackathon demo but `POST /system/reset`, `/config/prompts PUT` `routes.py:557`, and `/replay` must exclude bypass.

## 6. Fix Plan (ordered)

1. Fix `main.py:84` handler. 2. Guard `POST /system/reset` admin-only, remove DEMO_BYPASS for it. 3. Make `GET /risk` read-only; keep `POST /reassess`. 4. Delete `api/{agent,customers,experience}.py`. 5. Consolidate `/{id}/investigate` to one path. 6. Dedup memories to one ordered endpoint. 7. Compute observability `tool_calls success_rate`.
## 7. Request/Response Schemas (models/schemas.py)

- CustomerSchema: id,name,domain,segment,industry,plan,mrr,arr,csm_name,csm_email,start_date,renewal_date,status,health_score,risk_level,is_false_positive_candidate,created_at
- EventIngestRequest: customer_id(<=80), event_type in 12-allowlist routes.py:128, payload dict (>10k 413), timestamp iso, _dedup_id optional routes.py:133
- InterventionCreateRequest: customer_id, investigation_id NOT NULL FK models.py:312, action_type, title, description, plan (JSON string)
- InterventionSchema: id,customer_id,investigation_id,recommendation_id,action_type,title,description,plan,status,priority,requires_approval,evidence_ids,created_at,approved_at
- OutcomeCreateRequest: intervention_id optional body routes.py:411, health_before/after Float, usage_before/after, customer_response, notes
- ExperienceMemorySchema: id,pattern,context_pattern,customer_segment,risk_pattern,signals,recommended_strategy,confidence,success_count,failure_count,sample_size,success_rate

All schemas missing nullable docs; InterventionOutcome.status/outcome/evaluation_status triple models.py:350/351/366 confuses clients.

## 8. Pagination Deep Dive

- GET /customers via CustomerRepository.list_all_paginated translates to SELECT ... WHERE risk_level=? AND segment=? AND search ILIKE LIMIT ? OFFSET ? — DB-level, okay.
- GET /learning/memories, /experience-memory, /interventions, /outcomes use Python slice list_all()[offset:offset+limit] routes.py:454,467,484,497 — O(N) memory, no DB limit. On 10k customers OOM. Switch to SELECT with limit/offset/order_by(updated_at desc).
- Frontend getAllInterventions api.ts:48 hedges: GET /interventions then if empty falls back to N+1 per customer 48: try customers then per-customer GET — costly.

## 9. Field Alias Contracts

- recommendation_id nullable models.py:313 alias for intervention.id; routes.py:167 recommendation_id || id in recommendations list; routes.py:366 approve alias double-lookup.
- customer_ids in JWT vs path param naming mismatch: JWT customer_ids plural, path customer_id singular — docs absent.
- risk_level_str vs risk_level duplication risk_engine.py:22 — API returns both.

## 10. Verification Checklist

- curl GET /health 200 ok; GET /readiness 503 when DB down
- curl GET /customers 200 list; pagination limit=500 capped, offset negative clamped 0
- curl GET /customers/{id}/risk 200 with health_score+health_components — verify no INSERT side-effect after fix
- curl POST /system/reset without admin JWT expect 403 (after fix) else 200 P0
- curl POST /interventions with bogus investigation_id expect 400 not 500 FK
