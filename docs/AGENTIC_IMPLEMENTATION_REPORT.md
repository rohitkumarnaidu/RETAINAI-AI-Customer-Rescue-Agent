# RETAINAI -- Agentic Implementation Report (2026-08-30)

## What existed (pre-audit)
- FastAPI + async SQLAlchemy + React dashboard (CommandCenter/Customer360/ActionCenter)
- SignalEngine (usage/support/feedback/activity), HealthEngine, RiskEngine, TimeWindowEngine, LearningEngine (immediate promotion)
- Orchestrator with 3 tools, Investigation/Action agents with deterministic LLM fallback (gemini-2.5-flash)
- DB models for customers, telemetry, risk, evidence, interventions, outcomes, memories, agent_runs (no steps/candidates)
- EventIngestionService (basic), seed of 101 customers, acme replay, 27 tests passing
- Docs for architecture/product/demo

## What was broken
1. RiskEngine missing `risk_change/previous_risk_score/top_signals/uncertainty` and stale/conflicting detection
2. SignalEngine missing spec signals (feature adoption, support resolution, engagement, sentiment change) and missing spec fields (`signal_id`, `time_window`, `source_ids`, `calculated_at`, `calculation_version`)
3. Orchestrator had no explicit state machine, no bounded loop limits, no evidence ID validation, no prompt-injection defense, no uncertainty states beyond sparse check
4. Tools had no allowlist/input schema/auth/timeout/audit; `risk_pattern` length caused ValueError in query_experience_memory
5. LearningEngine promoted single success immediately to VALIDATED (S22 violation), no candidate, no sample/confidence gate, outcome id collision on same-second, candidate id collision
6. Event ingestion had no idempotency, no significance debounce, no dedup
7. No AgentStep, LearningCandidate table, Intervention structured fields, ExperienceMemory `pattern/sample_size/status` missing
8. No observability metrics, no replay endpoint, no evidence resolver, no HITL modify/reject endpoints
9. Integrations undocumented as real vs simulated

## What was missing
- AgentState machine (14 states + 8 failure states), VALID_TRANSITIONS, AgentStep persistence
- Bounded loop: MAX_ITERATIONS 8, MAX_TOOL_CALLS 12, MAX_RUNTIME 60s, MAX_RETRIES 3
- Uncertainty states: SUFFICIENT/LIMITED/INSUFFICIENT/CONFLICTING/TOOL_FAILURE/HUMAN_ESCALATION
- Deterministic TIME_WINDOW handling of None sessions
- Integration adapter interface (RealAdapter vs DemoAdapter) per S36
- Human-in-loop modify/reject capture as SystemEventLog learning signal (S48 E/F)
- Validated learning pipeline with MIN_SAMPLE_SIZE=2, MIN_CONF 0.70
- Idempotency hash + in-memory dedup set + significance check
- Endpoints: `/customers/{id}/recommendations`, `/customers/{id}/memory`, `/learning`, `/evidence/{id}`, `/agent-runs/{id}`, `/replay/{run_id}`, `/metrics/observability`, recommendation alias approve/reject/modify

## What was changed (why + how tested)
| File | Change | Reason | Test |
|------|--------|--------|------|
| `engine/signal_engine.py` | Added CALCULATION_VERSION, spec fields, 4 new detectors, to_spec_dict, backward compat direction property | S5 spec schema + determinism | `test_engines.py` now passes (8 signals); hero sees 7 signals after friction |
| `engine/risk_engine.py` | Enriched RiskResult, evaluate_risk with previous_health delta, uncertainty list, conflicting detection | S6 separation structured vs AI | manual hero: risk_change computed |
| `db/models.py` | Added AgentState enum, AgentStep, LearningCandidate, enriched Intervention/Outcome/Memory/Run | S10,S18,S19,S23,S30 persistence | in-memory DB create_all passes |
| `agents/orchestrator.py` | Rewrote `run_full_rescue_workflow` with state machine, _transition_state, bounded checks, sanitizer, evidence validation, structured output schema | S10,S14,S42 safety | `test_orchestrator` + hero loop pass |
| `agents/tools.py` | Allowlist, pydantic Input schemas, _authorize, _log_tool_call, hallucinated tool rejection, expanded aliases | S11-13 security | hero retrieval uses filtered memories |
| `engine/learning_engine.py` | Candidate creation, _validation_gate, _promote_to_memory, unique ids via uuid, thresholds 2/0.70, contradictory penalize, causality-safe language | S20-25 learning | `test_learning_validation` 3/3 pass, hero second success validates |
| `services/event_ingestion_service.py` | _compute_event_hash, _is_significant, idempotency dedup, DEMO_MODE handling | S32,S56 debouncing | duplicate event returns `duplicate_ignored` |
| `services/intervention_service.py` | Added modify/reject with SystemEventLog, get_human_feedback_summary | S15 HITL | hero approve flow |
| `api/routes.py` | Added 10 endpoints + evidence resolver + replay + metrics | S34,S44,S31 observability | curl via test client |
| `repositories/memory_repository.py` | Added get_by_pattern, decay_stale_memories | S25 decay | - |
| `integrations/adapters.py` | New module: IntegrationInterface, Real/Demo adapters, registry, get_adapter, describe_integration | S35-38 real vs simulated | adapter health_check |
| `tests/test_hero_e2e.py` | Hero loop covering S26+S51 | E2E proof | pass |
| `tests/test_learning_validation.py` | S48 A-D validation cases | learning | 3 pass |

## How it was tested
- `pytest tests -q` -> 28->31 passed after fixes (run 3x). Hero loop executed in-memory twice: single candidate PENDING, second consistent -> VALIDATED, retrieval returns memory.
- Event dedup test: same payload twice -> second returns `duplicate_ignored` without duplicate rows.
- Orchestrator state_history length ≥14, includes INSUFFICIENT_EVIDENCE -> ACTION_PLANNING branching correctly warned not failed.

## What remains simulated
- All external integrations via DemoAdapter (SIMULATED) -- adapter reports `"mode":"SIMULATED"`; RealAdapter requires `DEMO_MODE=false` + real env credential.
- LLM calls via `LLMClient` fallback when `LLM_API_KEY=mock_key_for_dev`; real Gemini call path exists but not exercised in CI (recorded replay mode flag).

## What remains out of scope (P2 per S83)
- Real OAuth/JWT auth, Redis dedup, background job queue, causal uplift experiments, drift detection, MCP, multi-tenancy RLS, offline RL.

## Demo reliability
Hero scenario `POST /api/v1/agent/investigate/{id}` deterministic via seed + signals: health 70.8->47.4 after friction, 7 signals incl. `UNRESOLVED_CRITICAL_SUPPORT_TICKET`. Second similar customer after 2 successes retrieves validated memory (confidence 0.80->0.92). Verified via `test_hero_e2e.py` clean DB repeat.

## Remaining risks / next steps
- Promote in-memory dedup to Redis, add JWT middleware, schedule `decay_stale_memories` cron, calibrate thresholds on real arr dataset.

