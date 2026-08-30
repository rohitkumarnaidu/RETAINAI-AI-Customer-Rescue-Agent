# DATABASE AUDIT — RETAINAI

**Date:** 2026-08-30 | **Engine:** SQLite + aiosqlite async via `db/session.py:13-20` `create_async_engine(DATABASE_URL, check_same_thread=False)` | **ORM:** SQLAlchemy async `DeclarativeBase` | **Models:** `db/models.py:530` 18 tables | **Session:** `AsyncSessionLocal` `session.py:33` `expire_on_commit=False`

## 1. Table Inventory — 18 Tables (PK / FK / Indexes / Uniqueness / Seed)

| # | Table | PK | FK | Indexes | Unique / Constraint | Seed Rows |
|---|-------|----|----|---------|---------------------|-----------|
| 1 | `customers` `models.py:75` | `id String(50)` | — | `idx_customers_risk(risk_level)` `idx_customers_health(health_score)` `idx_customers_status(status)` `models.py:110` | `risk_level enum HEALTHY..CRITICAL` `models.py:26` | **101** `seed_database.py` |
| 2 | `usage_events` `models.py:118` | `id String(50)` | `customers.id` `models.py:122` | `idx_usage_customer_time(customer_id,timestamp)` `models.py:141` | 5 redundant counters `daily_active_users,active_users,wau,mau,sessions` `models.py:124-132` | dozens per customer |
| 3 | `feature_adoptions` `models.py:146` | `id` | `customers.id` | `idx_feature_customer_time(customer_id,period_start)` | composite `period_start/end` | 0 standalone — via usage |
| 4 | `support_tickets` `models.py:166` | `id` | `customers.id` | `idx_tickets_customer_status`, `idx_tickets_customer_time` `models.py:183` | `severity` `LOW/MEDIUM/HIGH/CRITICAL` | seeded |
| 5 | `customer_feedbacks` `models.py:190` (`FeedbackEntry` alias `models.py:231`) | `id` | `customers.id` | `idx_feedback_customer_time` `models.py:107` | `sentiment POSITIVE/NEUTRAL/NEGATIVE` `models.py:198` | seeded |
| 6 | `account_events` `models.py:212` (`AccountActivity` alias `models.py:232`) | `id` | `customers.id` | `idx_account_evt_customer_time` `models.py:224` | `event_type ADMIN_LOGIN/CSM_MEETING…` | seeded |
| 7 | `risk_assessments` `models.py:235` | `id String(50)` | `customers.id` | `idx_risk_customer_time(customer_id,created_at)` | `calculation_version v1.0` `models.py:249` | via reassess |
| 8 | `evidences` `models.py:260` | `id` | `customers.id` | `idx_evidence_customer(customer_id)` `idx_evidence_source(source_type,source_id)` | source_type `USAGE_EVENT/SUPPORT_TICKET/FEEDBACK/ACCOUNT_EVENT` | seeded |
| 9 | `investigation_reports` `models.py:281` | `id String(50)` | `customers.id`, `risk_assessments.id NOT NULL` `models.py:286` | `idx_investigation_customer`, `idx_investigation_risk` | **FK NOT NULL hard** → P0-04 | runtime |
| 10 | `interventions` `models.py:307` | `id String(50)` | `customers.id`, `investigation_reports.id NOT NULL` `models.py:312` | `idx_interventions_customer`, `idx_interventions_status` | `recommendation_id String(80) nullable` `models.py:313` alias + `status PROPOSED→COMPLETED` 8 states `models.py:35` | runtime |
| 11 | `intervention_outcomes` `models.py:342` | `id String(50)` | `interventions.id`, `customers.id` | `idx_outcome_intervention intervention_id unique` `models.py:371`, `idx_outcome_customer` | triple naming `status/outcome/evaluation_status` `models.py:350/351/366`, `outcome SUCCESS&#124;PARTIAL&#124;FAILED&#124;UNKNOWN` | runtime |
| 12 | `experience_memories` `models.py:377` | `id String(50)` | — (no FK) | `idx_memory_segment(customer_segment)` `idx_memory_validation(validation_status)` | dup cols `pattern/context_pattern` `models.py:384-385` + `recommended_strategy/recommended_intervention` `models.py:388-390` | **1 sample** seeded |
| 13 | `agent_runs` `models.py:485` | `id String(50)` | `customers.id` | `idx_agent_runs_customer`, `idx_agent_runs_status` | `tool_calls JSON` `models.py:503` `state_history JSON` `models.py:504` status `RUNNING/COMPLETED/FAILED/FALLBACK` | runtime |
| 14 | `agent_steps` `models.py:438` | `id String(80)` | `agent_runs.id` | `idx_agent_steps_run(run_id)` | `step_type/state/tool_name/latency_ms` | runtime |
| 15 | `learning_candidates` `models.py:459` | `id String(80)` | **NONE** `customer_id String(50) plain` `models.py:463` `intervention_id String(50) plain` `models.py:464` | `idx_candidates_customer`, `idx_candidates_status` | **MISSING FKs** `P2` | runtime |
| 16 | `system_event_logs` `models.py:516` | `id String(50)` | **NONE** `customer_id String(50) plain` `models.py:521` | `idx_syslog_customer_time`, `idx_syslog_type(event_type)` | **MISSING FK** | empty |
| 17 | `feature_adoptions` (#3 duplicate count) | — | — | — | — | — |
| 18 | *(logical)* `sqlite_sequence` / `alembic_version` | — | — | — | **No alembic_version table** `session.py:54` `create_all` only | — |

## 2. Missing FKs & Integrity Gaps

- `learning_candidates.customer_id` `models.py:463` + `.intervention_id` `models.py:464` plain strings — orphan rows survive `DELETE FROM customers`. `learning_engine.py:171 source_intervention_ids JSON` compounds. Fix: `ForeignKey("customers.id", ondelete="CASCADE")` + `ForeignKey("interventions.id")`.
- `system_event_logs.customer_id` `models.py:521` same plain — should be `ForeignKey("customers.id")` or NULL documented for system-wide.
- `interventions.investigation_id` `models.py:312` is NOT NULL FK but `routes.py:314 create_intervention` trusts `req.investigation_id` without existence check → `IntegrityError: FOREIGN KEY constraint failed` → 500 (D-P0-04). Also `orchestrator.py:257` had to invent a fallback `RiskAssessment` to satisfy FK.
- `intervention_outcomes.intervention_id` `models.py:371 unique=True` idempotency guard at DB is good; but `learning_engine.py:122` catches `UNIQUE` via `if "UNIQUE" in str(e)` string match fragile for Postgres — use `IntegrityError.orig` code.
- `experience_memories` has no FK either — could reference `learning_candidates.id` provenance but doesn't.

SQLite FK enforcement ON via `PRAGMA foreign_keys=ON` `session.py:28` + WAL `session.py:29` listening on `engine.sync_engine:24` per-connect — covers pool but new engines outside session bypass.

## 3. Indexes — Good + Gaps

Good: all `customer_id+time` composites for timeline `TelemetryRepository` window queries 7d/30d `signal_engine.py:110,252`. Missing: `learning_candidates(pattern)` for `_get_candidates_for_pattern` `learning_engine.py:194 where pattern==` (full scan 10 rows tolerable); `experience_memories(pattern)` for `memory_repository.get_by_pattern()`; no `customers(arr)` for portfolio sort; `interventions(recommendation_id)` for alias lookup `routes.py:373`. Add where used.

- `__table_args__ extend_existing=True` on all tables `models.py:114` allows re-`create_all` without boom — demo-friendly but hides migration drift.

## 4. Seed Incomplete — 9 Tables Empty Until Runtime

`scripts/seed_database.py:73-213` seeds `customers 101`, `usage_events`, `support_tickets`, `customer_feedbacks`, `account_events`, `risk_assessments`, `evidences`, `experience_memories 1` via `memory_repository.add_memory`. Leaves empty until flows run: `feature_adoptions` (via usage only), `investigation_reports`, `interventions`, `intervention_outcomes`, `learning_candidates`, `agent_runs`, `agent_steps`, `system_event_logs`, `feature_adoptions` standalone. Demo therefore shows `ActionCenter.tsx:105 No interventions yet` until investigation run — expected. Seed 2 demo interventions + outcomes to demo Measure→Learn closed loop without manual orchestration.

`seed_database.py` vs `db/seed.py` stub diverge + `seed_demo_data()` destructive `drop_all+create_all` `session.py:54` vs stub — P1.

## 5. Triple .db Divergence (P0-03 Block)

`session.py:13 DATABASE_URL = os.getenv("DATABASE_URL","sqlite+aiosqlite:///./retainai.db")` vs `config/settings.py:29 DATABASE_URL` vs relative `./retainai.db` resolved per CWD. FS scan: `backend/retainai.db` (sid Gunicorn), `backend/src/retainai.db` (uvicorn cwd), `./retainai.db` (tests) 1.7–1.9 MB diverged. Seed from `backend/` writes one; `uvicorn retainai.main:app` from `backend/src` reads another → empty portfolio `totalARR 0k`. Fix: `session.py:13` → `from retainai.config import settings; DATABASE_URL = settings.DATABASE_URL` absolute via `Path(__file__).resolve().parent.parent / "retainai.db"`.

## 6. No Alembic / Migrations

`session.py:54 await conn.run_sync(Base.metadata.create_all)` on every startup; `seed_database.py` also `drop_all+create_all`. No `alembic_version` table, no migration history. Column rename like `ExperienceMemory.pattern→context_pattern` `models.py:384` requires manual drop. Add `alembic init` + `env.py` targeting `Base.metadata`; keep `create_all` only when `settings.DEMO_MODE` true and document drop is demo-only.

## 7. CRUD & Session Hardening

- Repos parameterized `customer_repository.py:20,33,63` + `evidence_repository.py` — no string interpolation; `tools.py:70 customer_id ; --` check redundant with ORM param but defense-in-depth.
- `expire_on_commit=False` `session.py:36` prevents stale `await session.refresh()` patterns.
- WAL `session.py:29` prevents SQLite writer starvation; `pool_pre_ping=True` `session.py:19`.
- Transaction not unit-of-work across orchestrator — 7 separate `commit()` in `orchestrator.py:105,189,273,306,346,385` — partial fail leaves orphan `RiskAssessment` without `InvestigationReport`. Wrap body in `async with session.begin()` atomic.

## 8. Fix Plan (ordered)

1. Unify `DATABASE_URL` to `settings.py` absolute; backup & delete orphan `.db`s (Gate A). 2. Add FKs `learning_candidates` + `system_event_logs`; validate `investigation_id` exists in `routes.py:314` before construct (raise 400). 3. Add `alembic` scaffold; gate `create_all/drop_all` on `DEMO_MODE`. 4. Seed 2 interventions+outcomes for demo Learn; add 3 missing indexes. 5. Wrap orchestrator 7 commits in single transaction; catch `IntegrityError` by code not string.
## 9. CRUD Integrity Walkthrough

- Create: POST /interventions creates Intervention; FK check missing investigation_id -> IntegrityError bypassed only by orchestrator fallback RA creation orchestrator.py:257-274.
- Read: CustomerRepository.list_all returns List[Customer] ordered name; no cursor.
- Update: InterventionService.approve sets status APPROVED approved_at now, approved_by param; no optimistic lock.
- Delete: Customer cascade all, delete-orphan relationships models.py:99-108 — deleting customer deletes 8 child tables via cascade.
- Learning pipeline CRUD: LearningEngine._create_learning_candidate adds candidate, commits, then _validation_gate may commit again 187,216 — 2 commits not atomic.

## 10. Session & Concurrency Hardening

- engine sync_engine PRAGMA foreign_keys ON session.py:28 covers pool connects; but AsyncEngine pool_pre_ping True 19 ensures reconnect also pragmas.
- No connection pooling limits set — default 5; 120 rate limit * 5 workers => SQLite busy.
- No row-level locking; two concurrent POST /interventions/{id}/outcome for same id race 122 UNIQUE handling via string.

## 11. Data Quality Checks

- Health 85 default models.py:92 vs Risk fallback 85 Customer360.tsx:73 chunk — inconsistent magic.
- ARR vs MRR not derived: arr column independent float; portfolio atRisk sum uses arr only.
- Timestamps timezone.utc lambda models.py:95 consistent.

## 12. Alembic Scaffold Suggestion

- alembic.ini script_location backend/alembic; env.py import Base.metadata; autogenerate for missing FKs + recommendation_id index.

## 13. Additional Indexes to Add (CREATE INDEX)

- CREATE INDEX idx_candidates_pattern ON learning_candidates(pattern);
- CREATE INDEX idx_memories_pattern ON experience_memories(pattern);
- CREATE INDEX idx_interventions_rec_id ON interventions(recommendation_id);
- CREATE INDEX idx_customers_arr ON customers(arr);
- Ensures prefix lookup fast for alias & N+1 fallback getAllInterventions api.ts:48.

## 14. Seed Divergence Detail

backend/src/retainai/scripts/seed_database.py vs scripts/seed_database.py stub — HEAD points at backend/src/... but Makefile python backend/src/retainai/scripts/seed_database.py writes backend/src/retainai.db while docker-compose backend/Dockerfile WORKDIR /app writes /app/retainai.db.

## 15. Backup & Delete Orphan Command

- cp backend/retainai.db retainai.db.backup.\ ; cp backend/src/retainai.db ... ; then rm orphan after verifying unified absolute path.
