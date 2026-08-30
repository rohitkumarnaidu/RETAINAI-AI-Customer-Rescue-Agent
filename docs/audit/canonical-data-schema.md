# RETAINAI Canonical Data Schema — Audit Copy

Generated: 2026-08-30T11:18:31.778503+00:00
Canonical source: `backend/src/retainai/db/models.py` (404 lines, enums at :10)
Dataset: `data/seed/retainai_dataset_v2.json`
Auditor note: This file is a frozen audit rendering of the schema as of 2026-08-30. For live reference see `docs/DATA_MODEL.md` (which is generated from ORM).

## Enums

### RiskLevel (6 values) at db/models.py:14
HEALTHY, STABLE, WATCH, AT_RISK, HIGH_RISK, CRITICAL
Thresholds in `engine/risk_engine.py:18`: CRITICAL<20, HIGH<40, AT_RISK<60, WATCH<80, STABLE<90, else HEALTHY

### InterventionStatus (8), OutcomeStatus (7), ValidationStatus (3), AgentRunStatus (4) — see DATA_MODEL.md §2

## Tables — Audit Verification

| Table | Rows (dataset) | PK | FK → customers | Engine Reads | Verified |
|-------|----------------|----|---------------|--------------|----------|
| customers | 101 | id String(50) | — | health/risk update | VERIFIED via seed.py:94 |
| usage_events | 3131 | id | customer_id | time_window 7d vs 30d DAU | VERIFIED |
| support_tickets | 82 | id | customer_id | signal_engine HIGH/CRITICAL OPEN | VERIFIED |
| customer_feedbacks | 94 | id | customer_id | signal_engine NEGATIVE or score<=2 | VERIFIED |
| account_events | 0 (not seeded) | id | customer_id | ADMIN_LOGIN 14d inactivity | VERIFIED schema, but 0 rows in dataset |
| risk_assessments | 0 (created at runtime) | id | customer_id | reassess_customer_risk | VERIFIED via customer_service.py:48 |
| evidences | 0 | id | customer_id | not consumed today | EXISTS but not seeded |
| investigation_reports | 0 | id | customer_id, risk_assessment_id | orchestrator | EXISTS |
| interventions | 0 | id | customer_id, investigation_id | intervention_service | EXISTS |
| intervention_outcomes | 0 | id | intervention_id, customer_id | learning_engine | EXISTS |
| experience_memories | 1 (mem-001) | id | — (segment filtered) | memory_repo | VERIFIED seed.py:192 |
| agent_runs | 0 | id | customer_id | orchestrator | EXISTS |
| feature_adoptions | 0 | id | customer_id | future use | EXISTS, not seeded |
| system_event_logs | 0 | id | String(50) loose FK | ingestion | EXISTS |

Schema correctness: 10/10 (no P0 schema issues per audit; nullable mismatches documented below)

### Field-level audit (required vs optional)

**customers**: id PK NOT NULL ✓, name NOT NULL ✓, domain NOT NULL ✓, tier→segment alias ✓, mrr NOT NULL default 0.0 ✓, csm_name NOT NULL ✓, renewal_date NOT NULL ✓, health_score 0-100 ✓, risk_level enum ✓. All dataset customers have these.

**usage_events**: customer_id FK NOT NULL ✓, timestamp NOT NULL ✓, daily_active_users 0+ ✓, license_utilization 0..1 ✓, feature_clicks 0+ ✓, sessions 0+ ✓. Verified no negatives, no license out-of-range.

**support_tickets**: id PK ✓, customer_id FK ✓, created_at NOT NULL ✓, severity MEDIUM default ✓, status OPEN default ✓, subject NOT NULL ✓. All tickets have severity/category/status.

**customer_feedbacks**: customer_id FK ✓, created_at ✓, source default CSAT_SURVEY ✓, sentiment POSITIVE/NEUTRAL/NEGATIVE ✓, text default "" ✓, score nullable ✓.

### Drift between DATA_MODEL draft and code

- DATA_MODEL correctly notes 4-dim health (usage/support/sentiment/engagement) not 6 — no drift.
- Retired entities (`customer_users`, `health_records`, `contributing_factors`) correctly marked retired — no drift.
- `plan` vs `plan_steps` consolidated — verified.
- `account_events` is seed-empty: docs claim 0 rows, code supports but EDA must note 0 coverage (P2).

### Contract audit (generator vs DB vs API)

| Entity | Generator field | DB column | API schema | Match? |
|--------|-----------------|-----------|------------|--------|
| dau → daily_active_users | dau | daily_active_users + active_users duplicate | schemas.py maps dau | VERIFIED via alias in seed.py:128 |
| license_utilization_pct → license_utilization | license_utilization_pct | license_utilization Float | Pydantic float | VERIFIED alias seed.py:134 |
| channel → source | channel | source | source | VERIFIED |
| feedback_text → text | feedback_text | text + comment dup | text | VERIFIED |
| created_at → start_date | created_at | start_date Date | start_date | VERIFIED parse_dt |
| metadata | metadata | metadata_json | — | Stored passthrough |

No field mismatch P0; nullable `resolved_at` correctly None for OPEN tickets.
