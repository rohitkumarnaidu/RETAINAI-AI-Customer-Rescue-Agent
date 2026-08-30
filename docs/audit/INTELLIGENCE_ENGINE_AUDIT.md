# INTELLIGENCE ENGINE AUDIT — RETAINAI

**Date:** 2026-08-30 | **Commit:** 14197b2 | **Files:** `engine/{health,risk,signal,time_window,learning}_engine.py`, `config/settings.py:77`, `services/{customer,signal,timeline,event_ingestion}_service.py`, `repositories/*`, `db/models.py`

## 1. Engine Matrix — 9 Fields Each (Exists / Connected / Consumes / Produces / State / Deterministic / Failure / Tested / Visible / Config-driven)

| Field | Health `health_engine.py:61` | Risk `risk_engine.py:156` | Signal `signal_engine.py:421` | Time-Window `time_window.py` + `signal_engine.py:110` | Learning `learning_engine.py:333` |
|-------|------------------------------|---------------------------|-------------------------------|--------------------------------------------------------|-----------------------------------|
| **Exists** | yes `class HealthEngine:18` | yes `class RiskEngine:48` `RiskResult:12` | yes `class SignalEngine:101` 8 detectors  `DetectedSignal:19` | yes `TimeWindowEngine.calculate_usage_window_delta` called `signal_engine.py:110` | yes `class LearningEngine:28 MIN_EVIDENCE 2:23` |
| **Connected** | `services/customer_service.py` reassess → `engine.health_engine.compute_health_components` + `orchestrator.py:173 reassess` | same `customer_service` → `RiskEngine.evaluate_risk` before `InvestigationAgent` | `services/signal_service.py get_customer_signals` → `SignalEngine.evaluate_all_signals` `signal_engine.py:367` + `agents/tools.py:212 calculate_customer_signals` | transitively via signal usage decline `signal_engine.py:110` | `api/routes.py:408 POST /interventions/{id}/outcome` → `LearningEngine.evaluate_intervention_outcome:36` → `_create_learning_candidate:134` → `_validation_gate:198` → `_promote_to_memory:228` |
| **Consumes** | `List[DetectedSignal{category,impact_score}]` + `HealthWeights{0.4,0.3,0.2,0.1}` `health_engine.py:23` | `HealthComponents{overall,usage,support,sentiment,engagement}` + `List[DetectedSignal]` + `total_data_points int` `risk_engine.py:69` + `customer_id,previous_risk_score` | `UsageEvent[], SupportTicket[], CustomerFeedback[], AccountEvent[]` `signal_engine.py:105-213` + `customer.is_false_positive_candidate` `signal_engine.py:406` | `UsageEvent[] timestamps + daily_active_users` | `intervention_id,health_before,health_after,usage_before,usage_after,customer_response,notes` `learning_engine.py:36` |
| **Produces** | `HealthComponents{usage_health,support_health,sentiment_health,engagement_health,overall_health round 1}` `health_engine.py:55` | `RiskResult{health_score,risk_level enum, risk_score 0..1,risk_level_str,risk_change,top_signals,evidence_ids,confidence,uncertainty[],is_insufficient_data}` `risk_engine.py:141` | `List[DetectedSignal{signal_type,category,severity,value,baseline,delta_pct,summary,evidence_ids,impact_score,signal_id,calculated_at,time_window,delta,source_ids}]` `signal_engine.py:19-38` | `{current_value,baseline_value,percentage_delta}` `time_window.py` | `InterventionOutcome{health_delta,observation,status,confidence}` `learning_engine.py:88` → `LearningCandidate{pattern,sample_size,confidence}` `learning_engine.py:171` → `ExperienceMemory{pattern,recommended_strategy}` `learning_engine.py:256` |
| **State** | **Stateless pure** no DB writes; pure subtract-then-clamp `health_engine.py:31-45` | Stateless pure but has sparse branch `if total_data_points<3 => is_insufficient_data WATCH confidence 0.40` `risk_engine.py:77-93` | Stateless pure | Stateless pure | **Stateful** writes 3 tables; reads segment `Customer.segment` `learning_engine.py:141` |
| **Deterministic** | **Yes** `round(composite,1)` `health_engine.py:60` no LLM/random/time | **Yes** thresholds map fixed `risk_engine.py:52-64` + `sorted(impact_score)` `risk_engine.py:121` + `assert 0<=risk_score<=1` `risk_engine.py:135` | **Yes** window deltas `avg_cur/avg_base` `signal_engine.py:263`; no random; `signal_id uuid:31` is non-derivable but not used in health | **Yes** date math `cutoff_7/30` `signal_engine.py:251-253` | **Gate deterministic** `if sample_size<2 return` `learning_engine.py:201`; `confidence=min(0.95,base+0.12*(sample-1))` `learning_engine.py:163` pseudo-det subset |
| **Failure** | Returns `100/100/100/100` when signals `[]` — benign default overstates health | `INSUFFICIENT_DATA_BASELINE` when `<3 points` `risk_engine.py:78` confidence capped `0.40`; `has_decline && has_false_positive` adds `conflicting_evidence` `risk_engine.py:117` | Returns `[]` if `usage_events empty` `signal_engine.py:107`; `if not base: base=full history` `signal_engine.py:260` fallback hides insufficient | Falls back to full history when `base empty` `signal_engine.py:260` — masks seasonal | Skips promotion when `<2` `learning_engine.py:201`, confidence `<0.70` `learning_engine.py:205`, success_rate `<0.6` `learning_engine.py:212`; swallows DB errors `learning_engine.py:122` string match fragile |
| **Tested** | `tests/test_health_and_risk.py` asserts composite but boundary 0/100 missing | same file; level map boundaries not exhaustively | `tests/test_signal_engine.py` severity & usage decline but zero-baseline `avg_base==0` `signal_engine.py:265` not tested | `tests/test_time_window.py` | `tests/test_learning_validation.py` gate thresholds but contradictory `recent_failures*0.15` `learning_engine.py:168` untested |
| **Visible** | 4 tiles `Customer360.tsx:127 {healthComps entries}` via `GET /risk` `routes.py:96` → `health_components` | `risk_level,risk_score,confidence,uncertainty` in `Customer360.tsx:117-132` + portfolio `risk_distribution` `CommandCenter.tsx:164` | `signals[]` pills `Customer360.tsx:138 s.signal_type · severity` + health calc | via signal `delta_pct` only | `ActionCenter.tsx:125 success_rate*100` + `GET /learning` `routes.py:195` candidates/validated |
| **Config-driven** | **Partial** weights configurable `settings.health_weights` `config/settings.py:67 HealthWeights{usage 0.40…}` but default literals still `health_engine.py:49` | **Partial** `RISK_CRITICAL 20, HIGH 40, AT_RISK 60, WATCH 80` `settings.py:61-65` configurable, but `90.0 HEALTHY` literal `risk_engine.py:61` hardcoded (D-P2-04), map fixed 20/40/60/80 | **No** impacts `40/35/30/25/20/18/15/12/-35` `signal_engine.py:124,139,168,183,208,239,280,306,325,335,359,418` literals; windows `7/30/14` `signal_engine.py:110,252,220` literals | **No** days `7/30` literals | **No** `MIN_EVIDENCE 2, MIN_CONFIDENCE 0.70, MIN_SAMPLE_SIZE 2` `learning_engine.py:23-25` module constants not in `settings.py` (D-P2-06); `health_delta >=15 SUCCESS` `learning_engine.py:57` literal |

## 2. Hardcoded Inventory (grep)

- **Health weights** `0.40/0.30/0.20/0.10` mirrored `health_engine.py:49-53` + `settings.py:56-59` — settings tunable but engines default to `settings.health_weights` only if caller passes none.
- **Risk map** `20→CRITICAL(+ WATCH fallback), 40→HIGH_RISK,60→AT_RISK,80→WATCH,90→STABLE else HEALTHY` `risk_engine.py:52-64` — `90` not settings.
- **Signal impacts:** `40 SEVERE_USAGE_DECLINE:124`, `25 MODERATE:138`, `35 CRITICAL_TICKET:168`, `20 VOLUME_SPIKE:183`, `30 NEGATIVE_FEEDBACK:208`, `15 ADMIN_INACTIVITY:239`, `30/20 FEATURE_ADOPTION:280-282`, `18 RESOLUTION_STALLED:306`, `12 ENGAGEMENT_DECLINE:335`, `15 SENTIMENT_DETERIORATION:359`, `-35 FALSE_POSITIVE_SAFEGUARD:418` — total 12 literals.
- **Learning:** `MIN_EVIDENCE 2:23`, `MIN_CONFIDENCE 0.70:24`, `MIN_SAMPLE_SIZE 2:25`, `health_delta >=15 SUCCESS, >=5 NEUTRAL` `learning_engine.py:57-80`, `confidence_base 0.90/0.55:55`, `base_conf 0.68/0.45:159`, `penalize 0.15:168`, `boost 0.12:163`.
- **Time windows:** `current 7d / baseline 30d` `signal_engine.py:110`, `admin cutoff 14d` `signal_engine.py:220`, `30d/7d` string `signal_engine.py:281`.

## 3. Boundary & Edge Tests Missing

- Health clamping `max(0,min(100))` `health_engine.py:42-45` at `overall 0%/100%` not asserted.
- `risk_level` inclusive `health=20,40,60,80,90` — using `<` means `health==90` is `HEALTHY` not `STABLE`; off-by-one untested.
- Zero-baseline `avg_base==0 → pct=0` `signal_engine.py:265-266` for new accounts without history — no test.
- Duplicate events / empty evidence `<2 items` `orchestrator.py:204` marks uncertainty but does not short-circuit; `INSUFFICIENT_EVIDENCE` vs `SPARSE_DATA` vs `CONFLICTING_EVIDENCE` vs `HUMAN_ESCALATION` distinctions untested.
- Learning contradictory `recent_failures*0.15` `learning_engine.py:168` with pattern `2 successes +1 failure` not exercised.
- `dead admin check` `risk_engine.py:115 any("ADMIN_INACTIVITY"... )` return value discarded — dead code.
- `health_delta` exact `15.0` boundary for SUCCESS `learning_engine.py:57` not tested.

## 4. Determinism & Replay

All 5 engines identical for identical DB snapshots (no `random`, only `datetime.now` for `signal_id` + `calculated_at` `signal_engine.py:31` non-derivable but irrelevant to health). `GET /replay/{run_id}` `routes.py:581` correctly documents `health/risk/signal deterministic; LLM fallback deterministic when mock`.

## 5. Fixes

Move signal impacts + windows `SIGNAL_SEVERE_IMPACT etc` + days `TIME_WINDOW_CURRENT/BASELINE 7/30` to `settings.py`; add `RISK_HEALTHY_THRESHOLD=90` `settings.py:65`; move learning thresholds `LEARNING_MIN_SAMPLE etc` to settings; add boundary tests `health 0/50/100`, `risk 19/20/39/40/59/60/79/80/89/90/91`, `zero baseline`, `duplicate hash`, `sparse evidence` before Gate F.
## 6. Engine Call Graph (end-to-end)

Customer Data (models) -> TelemetryRepository.get_usage_events (days 30) -> SignalEngine.evaluate_all_signals (8 detectors 367-384) -> HealthEngine.compute_health_components (subtract impacts clamp) -> RiskEngine.evaluate_risk (map health to 6 levels) -> exists as health_dimensions + risk_assessment in orchestrator.py:173-174 -> TimelineService + TimeWindowEngine reuse signal windows.

Learning is detached: LearningEngine.record_outcome wrapper 300 fetches health_before 318 from Customer.health_score 100 fallback then +delta then evaluate -> candidate -> gate -> memory.

## 7. Signal Detail Table

| Signal | Category | Thr. | Impact | Window | Evidence IDs | File:line |
| SEVERE_USAGE_DECLINE | USAGE | <=-50% | 40 | 30d/7d 110 | last 5 usage | signal_engine:113 |
| MODERATE_USAGE_DECLINE | USAGE | <=-25% | 25 | 30d/7d | last 5 | :127 |
| UNRESOLVED_CRITICAL_TICKET | SUPPORT | HIGH/CRITICAL open | 35 | snapshot | unresolved ids | :159 |
| HIGH_TICKET_VOLUME_SPIKE | SUPPORT | >=3 open | 20 | snapshot | open ids | :170 |
| NEGATIVE_CUSTOMER_FEEDBACK | FEEDBACK | score<=2/NEGATIVE |30 | snapshot | 1 feedback | :198 |
| ADMIN_INACTIVITY | ACTIVITY | 0 logins 14d |15 |14d cutoff 220 | first 3 events | :228 |
| FEATURE_ADOPTION_DECLINE | USAGE | <=-30% clicks |20/30 |30d/7d 252 | last 3 | :270 |
| SUPPORT_RESOLUTION_DETERIORATION | SUPPORT | 0 resolved,>=1 open |18 |30d | 3 open | :294 |
| ENGAGEMENT_DECLINE | ACTIVITY | <=-25% sessions |12 |14d 315 | last 3 | :324 |
| SENTIMENT_DETERIORATION | FEEDBACK | -1..-2 mapping |15 |30d sorted |2 recent | :352 |
| FALSE_POSITIVE_SAFEGUARD | USAGE_CONTEXT | is_false_positive_candidate | -35 | — | none | :406 |

## 8. Deterministic Replay Verification

- SignalEngine uuid signal_id 31 + calculation_version v2.1-2026 :16 are non-deterministic but not part of health math (derived delta 45). S31 deterministic replay routes.py:581 returns recorded tool_outputs + deterministic flag True.
- RiskEngine assessment_version v2.1-risk 27 baked.

## 9. Risk Thresholds Hidden Debt

settings.py defines 20,40,60,80 but risk_engine.py:78 uses <3 points threshold plus 90 literal. Add RISK_HEALTHY_THRESHOLD=90 to settings and map STABLE <90 else HEALTHY with constant.

## 10. Engine Test Gaps Checklist

- No 0% health composite when all impacts max (>=100 over) — clamp order test
- No mixed impacts overflow >=100 clamping test
- No contradictory signal penalty confidence 0.65 cap test risk_engine:138

## 11. Configuration Screw Inventory

All weights, thresholds, timeouts that should be settings.py but are literals: health 4 weights already 56 settings.py good; risk 90 not; signal 12 impacts none; time-window 7/30/14 none; learning 3 gates none. Target: 0 literals in engine/*.py except derived math.

## 12. Failure Injection Tests to Add

- GET /customers/{id}/timeline with days=999 -> no events => sparse_data path risk_engine:111
- POST /events duplicate payload same event_hash => expect idempotent 200 already_ingested not duplicate
- POST /interventions/{id}/outcome with health_before 100 health_after 100 delta 0 => PARTIAL not SUCCESS

## 13. Visibility Score

Each engine result rendered: health 4 tiles visible 100% ; risk level/badge visible 100% ; signals pills visible but truncated to 8  Customer360:138 slice; time-window not directly visible (delta_pct hidden in signal summary); learning candidates not directly visible until validated (indirect via memory cards).

## 14. Extra Verification

Run pytest backend/tests/test_health_and_risk.py -k boundary to catch 90 literal; run test_signal_engine::test_zero_baseline to assert pct 0 when avg_base 0.
## 15. Determinism Notes
- Health recomputed per call; learning penalty -0.15 cap 0.95.

## 16. Gate Checklist
- Gates C/D/E/F mapping.
