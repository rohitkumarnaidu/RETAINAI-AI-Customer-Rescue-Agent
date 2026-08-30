# RETAINAI -- Agentic System Audit (2026-08-30)

## 1. Current Architecture
Single Orchestrator + Specialized Tools (per spec). Flow: Event -> SignalEngine (deterministic) -> HealthEngine -> RiskEngine -> Orchestrator (state machine) -> InvestigationAgent -> ActionAgent (with ExperienceMemory) -> Intervention (HITL) -> Outcome Observer -> LearningEngine validation gate -> ExperienceMemory -> future retrieval.

Diagram mirrors target architecture in prompt S3. No fake multi-agent chatter.

## 2. Agent Inventory
| Agent | Responsibility | Input | Output | Validation |
|-------|---------------|-------|--------|------------|
| Orchestrator | Bounded SENSE->ACT loop, state transitions, evidence validation, timeout guard | customer_id, telemetry | structured_output + intervention | state_history, AgentStep |
| InvestigationAgent | Root cause synthesis, evidence grounding, uncertainty | signals+evidence | summary/root_cause/confidence/evidence_ids | evidence resolver |
| ActionStrategyAgent | Next-best action, email draft, memory-aware | summary+root_cause+memories | action_type/plan_steps/draft_email | schema validation, requires_approval |

LLMClient deterministic fallback when `LLM_API_KEY=mock_key_for_dev` (recorded replay mode).

## 3. Tool Inventory (14, all validated)
`get_customer_profile`, `search_customer_evidence`, `get_customer_usage`/`get_usage_history`, `get_support_interactions`, `get_customer_feedback`, `get_account_activity`, `calculate_customer_signals`, `compare_customer_periods`, `evaluate_customer_risk`, `query_experience_memory`, `generate_retention_plan`, `record_intervention`, `record_outcome`, `update_experience_memory` (blocked). All have allowlist, input schema, customer-scope auth, timeout 5s, audit log, sensitive-field filtering.

## 4. Backend Architecture
FastAPI `retainai/main.py` (lifespan init_db). Services: CustomerService, SignalService, TimelineService, InterventionService, EventIngestionService. Engines: Signal/Risk/Health/TimeWindow/Learning. Repos: customer/telemetry/memory/intervention/risk/evidence. All async SQLAlchemy aiosqlite.

## 5. Integration Inventory (S35)
| Integration | Mode | Auth | Status |
|-------------|------|------|--------|
| CRM | SIMULATED (DemoAdapter) | env ref | reachable, fallback deterministic |
| product_analytics | SIMULATED | Bearer | deterministic |
| support_platform | SIMULATED | OAuth | deterministic |
| email/Slack | SIMULATED | API key | deterministic |
| LLM provider | REAL if key present else DEMO fallback | LLM_API_KEY | timeout 10s, retry 3 |

Adapter boundary: `IntegrationInterface` -> RealAdapter vs DemoAdapter. Domain never sees raw secrets (S38). Docs in `src/retainai/integrations/adapters.py`.

## 6. Learning Architecture
OBSERVATION -> EVALUATION (health_delta) -> CONFIDENCE -> LearningCandidate (status PENDING_VALIDATION, sample_size, confidence) -> VALIDATION GATE (min sample 2, min conf 0.70, consistency >0.6, data quality) -> VALIDATED ExperienceMemory (or REJECTED). Single success -> CANDIDATE not VALIDATED (proven via test). Second consistent success -> promotion + memory update (increment success_count, decay logic). Contradictory outcomes penalize confidence.

## 7. Memory Architecture
ExperienceMemory fields: pattern, segment, risk_pattern, signals, recommended_strategy, observed_outcome, confidence, validation_status (CANDIDATE/VALIDATED/REJECTED/STALE...), success_count/failure_count, sample_size/success_rate, evidence_ids/source_intervention_ids, contexts, version, last_observed. Retrieval filters VALIDATED only, segment-aware, relevance token match. Stale detection via `decay_stale_memories`.

## 8. Event Architecture
CustomerEvent enum: USAGE_CHANGED, FEATURE_ADOPTION_CHANGED, SUPPORT_TICKET_CREATED/RESOLVED, FEEDBACK_RECEIVED, SENTIMENT_CHANGED, ACCOUNT_ACTIVITY_CHANGED, INTERVENTION_COMPLETED, OUTCOME_AVAILABLE. EventIngestionService does: idempotency hash (dedup), significance check (debounce), SystemEventLog, deterministic reassess. Duplicate hash -> `duplicate_ignored` status, no duplicate telemetry.

## 9. Security Model
- Tool auth: `_authorize_customer_scope` validates id format, blocks `;--` injection, tenant allowlist ready.
- No LLM direct DB: LLM -> validated Tool -> Auth -> Service -> DB -> validated result.
- Secrets in `.env` not in prompts, never logged.
- Prompt-injection defense: `_sanitize_for_prompt` prefixes injected strings as `[CUSTOMER_DATA]`, truncates 2000 chars.
- Output filtering: sensitive fields removed in `get_customer_profile`.
- Hallucinated tool rejection: allowlist check.

## 10. Observability Model
AgentRun: run_id, current_state, state_history, total_steps, tool_calls (tool+status+latency), model/model_version/prompt_version, confidence, error. AgentStep per transition with latency_ms. Metrics endpoint `/metrics/observability` tracks completion_rate, tool success, outcome success, learning counts. Request_id per metric call. Timeline via `/agent-runs/{id}`.

## 11. Evaluation Methodology
27->31 tests passing. Suites: signal/risk/health/time_window, orchestrator full workflow, acme replay, hero full loop (S51), learning validation (single not promoted, repeated validates, contradictory penalized). Manual hero scenario run twice shows deterministic replay.

## 12. Test Results
```
27 -> 31 tests, all passing (1 hero_e2e + 3 learning validation added)
- signal_engine: severe usage, feature adoption, engagement, false-positive safeguard
- orchestrator: bounded loop, state machine, evidence grounding valid/invalid filtering
- learning: validation gate thresholds correctly enforced
- security/idempotency: dedicated tests (see test_learning_validation.py, hero)
```

## 13. Known Limitations
- Auth is scope-check stub (no JWT/OAuth); production needs real tenant isolation.
- Idempotency cache is in-memory (needs Redis for multi-instance).
- No real external API calls verified (all SIMULATED adapters).
- LLM determinism via fallback; real Gemini not exercised in CI.
- No background job queue (async within request); needs Celery/RQ for scale.
- Stale decay not scheduled (manual call).

## 14. Simulated Components
Clearly isolated behind DemoAdapter + LLM fallback. Domain depends on IntegrationInterface, demo path logged as `"mode":"SIMULATED"` and `"recorded_replay_mode":true`. Not represented as real.

## 15. Real Integrations
None verified as REAL in hackathon env (credentials mocked). Adapter health_check reports REAL only when env credential present & DEMO_MODE=false.

## 16. Remaining Risks
- Authorization stub -> must add JWT before prod.
- In-memory dedup -> race in concurrent events.
- Learning gate tuned for demo (threshold 0.70) -> needs calibration on real data.
- Outcome causality language fixed to "associated with" but future needs counterfactual.

## 17. Future Improvements
P2: causal experiments, drift detection, multi-tenancy, offline RLHF, MCP tool server, enterprise queue & replay persistence.

