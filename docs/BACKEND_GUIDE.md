# RETAINAI -- Backend Guide

> **Source of truth:** Code under `backend/src/retainai/`. All facts below are derived from the
> implementation as of 2026-08-30. File references use `backend/src/retainai/...:line`
> where line numbers indicate the canonical definition.

---

## 1. Overview

RETAINAI is an **Autonomous Customer Rescue Agent** that closes the loop
`SENSE -> THINK -> ACT -> MEASURE -> LEARN` for customer churn prevention. The backend is a
deterministic, auditable core (health / risk / signals / time-window / learning engines)
wrapped by an async FastAPI service with agent orchestration (Gemini 2.5-flash) on top.

Key invariant: **all health and risk math is deterministic and LLM-free**. Agents may read
engine outputs and propose interventions but never override the numeric scoring.

Canonical decisions the docs must not drift from:

| Decision | Value | Where |
|---|---|---|
| Health dimensions | **4** (usage, support, sentiment, engagement) -- *not* 6 | `backend/src/retainai/engine/health_engine.py:26` |
| Risk levels | **6** (`HEALTHY / STABLE / WATCH / AT_RISK / HIGH_RISK / CRITICAL`) | `backend/src/retainai/db/models.py:14` |
| Acme hero customer | `b2a88551-82e5-43d7-b620-ba1640900c71` domain `acmecorp.com` | `data/seed/retainai_dataset_v2.json` + `backend/src/retainai/scripts/seed_database.py:44` |
| Health weights | `0.40 / 0.30 / 0.20 / 0.10` | `backend/src/retainai/config/settings.py:36` |
| Risk thresholds | `20 / 40 / 60 / 80` + hardcoded `90` boundary for HEALTHY | `backend/src/retainai/config/settings.py:40` + `backend/src/retainai/engine/risk_engine.py:30` |

---

## 2. Stack

| Layer | Choice | Version / Note |
|---|---|---|
| Runtime | Python | `>=3.11` (see `backend/pyproject.toml:10`) |
| Web framework | FastAPI | `>=0.110.0` |
| ORM | SQLAlchemy Async | `>=2.0.28` with `[asyncio]` extra |
| SQLite driver | aiosqlite | `>=0.20.0` |
| Postgres driver | asyncpg | `>=0.29.0` (no code change -- swap `DATABASE_URL`) |
| Validation | Pydantic | `>=2.6.0` + `pydantic-settings>=2.2.0` |
| Server | uvicorn | `>=0.28.0` with `standard` extra |
| HTTP client | httpx | `>=0.27.0` (agents / LLM) |
| Templating | jinja2 | `>=3.1.3` |
| Packaging | hatchling | build-backend `hatchling.build` |
| Package manager | uv (preferred) | `pip` fallback documented |
| Test runner | pytest + pytest-asyncio | `asyncio_mode = "auto"` -- `backend/pyproject.toml:36` |
| Lint / Type | ruff, mypy | dev optional-deps |

---

## 3. Project Structure

```mermaid
flowchart TB
    API["api/routes.py<br/>18 endpoints<br/>api/agent_routes.py (4)"]
    SVC["services/<br/>customer  |  signal  |  timeline<br/>intervention  |  event_ingestion"]
    REPO["repositories/<br/>customer  |  telemetry  |  risk<br/>intervention  |  memory  |  evidence"]
    DB["db/<br/>session.py + models.py (404)<br/>14 tables  |  5 enums"]
    ENG["engine/<br/>health  |  risk  |  signal<br/>time_window  |  learning"]
    AGENTS["agents/<br/>orchestrator  |  investigation<br/>action  |  llm_client  |  tools"]
    SEED["scripts/seed_database.py<br/>data/seed/*.json (101)"]
    CFG["config/settings.py<br/>HealthWeights 0.4/0.3/0.2/0.1"]

    API --> SVC --> REPO --> DB
    SVC --> ENG --> CFG
    AGENTS --> SVC
    AGENTS --> ENG
    SEED --> DB

    classDef api fill:#164e63,stroke:#06b6d4,color:#fff
    classDef svc fill:#1e3a5f,stroke:#3b82f6,color:#fff
    classDef data fill:#14532d,stroke:#22c55e,color:#fff
    classDef agent fill:#581c87,stroke:#a855f7,color:#fff
    class API api
    class SVC svc
    class REPO,DB data
    class ENG,AGENTS,SEED,CFG agent
```

### 3.1 File Tree

```
backend/
  pyproject.toml
  src/retainai/
    main.py                          # FastAPI app, lifespan, CORS, /health
    config/settings.py               # Settings + HealthWeights (extra=ignore)
    db/
      models.py                      # 404 lines, enums + 14 tables + indices
      session.py                     # engine, AsyncSessionLocal, get_db(), init_db()
      seed.py                        # legacy re-export (see scripts/seed_database.py)
    scripts/
      seed_database.py               # 222 lines, deterministic seeding
    models/
      schemas.py                     # Pydantic request/response schemas
    engine/
      health_engine.py               # compute_health_components
      risk_engine.py                 # map_health_to_risk_level, evaluate_risk
      signal_engine.py               # 5 detection methods + 2 aggregators
      learning_engine.py             # evaluate_intervention_outcome + validation gate
      time_window.py                 # compare_periods, calculate_usage_window_delta
    repositories/
      customer_repository.py         # get_by_id, list_all, list_by_risk, create, update_health_and_risk
      telemetry_repository.py        # usage / tickets / feedback / account events (30d window)
      risk_repository.py             # create_assessment, get_latest, history, create_investigation
      intervention_repository.py     # create, get_by_id, list, update_status, create_outcome
      memory_repository.py           # add_memory, get_validated_memories(segment filter), list_all
      evidence_repository.py         # add, get_customer_evidences, get_by_ids
    services/
      customer_service.py            # reassess_customer_risk (orchestrates engines + persistence)
      signal_service.py              # get_customer_signals (30d -> evaluate_all_signals -> dict)
      timeline_service.py            # get_unified_timeline (60d aggregation)
      intervention_service.py        # lifecycle: create/approve/reject
      event_ingestion_service.py     # ingest_event branch + reassess hook
    agents/
      orchestrator.py                # top-level LLM orchestration
      investigation_agent.py         # evidence gathering + root-cause
      action_agent.py                # retention plan generation
      llm_client.py                  # Gemini wrapper
      tools.py                       # agent tool definitions
    api/
      routes.py                      # /api/v1 main router (customers, timeline, signals, events)
      agent_routes.py                # agent run endpoints
    demo/
      acme_replay.py                 # deterministic Acme story replay (3+ phases)
  tests/
    test_main.py
    test_api_routes.py
    test_engines.py
    test_core_engine.py
    test_health_and_risk.py
    test_signal_engine.py
    test_time_window.py
    test_acme_replay.py
    test_repositories_and_services.py
    agents/test_orchestrator.py
    agents/test_investigation_agent.py
    agents/test_action_agent.py     # ~25 tests total, pytest asyncio_mode auto
data/
  seed/
    retainai_dataset_v2.json         # metadata version dataset-v2 seed 42, 101 customers
```

**Module graph (dependency direction `->` means "imports"):**

```
api/routes.py -> services/* -> repositories/* -> db/session.py
               -> engine/*    -> config/settings.py
demo/acme_replay.py -> services/event_ingestion_service.py -> services/customer_service.py
agents/* -> engine/*, repositories/*, tools.py, llm_client.py
scripts/seed_database.py -> db/session.py, db/models.py, data/seed/retainai_dataset_v2.json
```

---

## 4. Config & Environment

### 4.1 Settings object

File: `backend/src/retainai/config/settings.py:12`

```python
class HealthWeights(BaseSettings):
    usage: float = 0.40
    support: float = 0.30
    sentiment: float = 0.20
    engagement: float = 0.10

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",            # <-- CORS keys etc. are silently ignored
    )
    APP_NAME: str = "RETAINAI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    DATABASE_URL: str = "sqlite+aiosqlite:///./retainai.db"
    LLM_PROVIDER: str = "gemini"
    LLM_MODEL: str = "gemini-2.5-flash"
    LLM_API_KEY: str = "mock_key_for_dev"
    API_V1_PREFIX: str = "/api/v1"
    HEALTH_WEIGHT_USAGE: float = 0.40
    HEALTH_WEIGHT_SUPPORT: float = 0.30
    HEALTH_WEIGHT_SENTIMENT: float = 0.20
    HEALTH_WEIGHT_ENGAGEMENT: float = 0.10
    RISK_CRITICAL_THRESHOLD: float = 20.0
    RISK_HIGH_THRESHOLD: float = 40.0
    RISK_AT_RISK_THRESHOLD: float = 60.0
    RISK_WATCH_THRESHOLD: float = 80.0
    @property
    def health_weights(self) -> HealthWeights: ...
settings = Settings()
```

### 4.2 Environment variables

| Var | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./retainai.db` | Switch to `postgresql+asyncpg://user:pass@host/db` for prod |
| `LLM_PROVIDER` | `gemini` | LLM routing key consumed by `agents/llm_client.py` |
| `LLM_MODEL` | `gemini-2.5-flash` | Pinned model string, used in `AgentRun.model` |
| `LLM_API_KEY` | `mock_key_for_dev` | Mock key for local/test; replace in prod via `.env` |
| `APP_ENV` | `development` | Returned in `/health` payload |
| Any CORS var | -- | Ignored due to `extra="ignore"` -- CORS is permissive in dev (see `main.py:27`) |

### 4.3 HealthWeights dataclass

`backend/src/retainai/config/settings.py:36` exposes `settings.health_weights` which is read by
`HealthEngine.compute_health_components(..., weights=settings.health_weights)` at
`backend/src/retainai/engine/health_engine.py:16`. Override via `HEALTH_WEIGHT_*` env vars.
Weights are expected to sum to `1.0`; the engine does not re-normalize -- validate at deploy.

---

## 5. Database Layer

### 5.1 Session & Engine

File: `backend/src/retainai/db/session.py:10`

```python
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./retainai.db")
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession,
                                       expire_on_commit=False, autocommit=False, autoflush=False)
class Base(DeclarativeBase): pass
async def get_db(): ...   # FastAPI dependency, yields + closes
async def init_db(): await conn.run_sync(Base.metadata.create_all)
```

* `check_same_thread=False` is only added for SQLite.
* `expire_on_commit=False` keeps objects usable after `commit()` without re-query.
* `init_db()` uses `create_all` (idempotent) -- seeding does `drop_all` + `create_all` for determinism.

### 5.2 Enums

File: `backend/src/retainai/db/models.py:10`

```python
class RiskLevel(str, Enum):       # 6 values
    HEALTHY, STABLE, WATCH, AT_RISK, HIGH_RISK, CRITICAL

class InterventionStatus(str, Enum):  # 8 values
    PROPOSED, RECOMMENDED, APPROVED, REJECTED, IN_PROGRESS, EXECUTED, COMPLETED, CANCELLED

class OutcomeStatus(str, Enum):       # 7 values
    PENDING, POSITIVE, SUCCESS, NEUTRAL, NEGATIVE, FAILURE, INCONCLUSIVE

class ValidationStatus(str, Enum):    # 3 values
    CANDIDATE, VALIDATED, REJECTED

class AgentRunStatus(str, Enum):      # 4 values
    RUNNING, COMPLETED, FAILED, FALLBACK
```

All enums are `str` enums so SQLite stores them as text and Pydantic serializes without mapping.

### 5.3 Tables (14 ORM models)

Canonical table for prefix search:

| # | Model | `__tablename__` | File:Line | Key indices |
|---|---|---|---|---|
| 1 | `Customer` | `customers` | `models.py:57` | `idx_customers_risk(risk_level)`, `idx_customers_health(health_score)`, `idx_customers_status(status)` |
| 2 | `UsageEvent` | `usage_events` | `models.py:95` | `idx_usage_customer_time(customer_id, timestamp)` |
| 3 | `FeatureAdoption` | `feature_adoptions` | `models.py:118` | `idx_feature_customer_time(customer_id, period_start)` |
| 4 | `SupportTicket` | `support_tickets` | `models.py:135` | `idx_tickets_customer_status`, `idx_tickets_customer_time` |
| 5 | `CustomerFeedback` | `customer_feedbacks` | `models.py:156` | `idx_feedback_customer_time(customer_id, created_at)` |
| 6 | `AccountEvent` | `account_events` | `models.py:177` | `idx_account_evt_customer_time(customer_id, timestamp)` |
| 7 | `RiskAssessment` | `risk_assessments` | `models.py:198` | `idx_risk_customer_time(customer_id, created_at)` |
| 8 | `Evidence` | `evidences` | `models.py:222` | `idx_evidence_customer`, `idx_evidence_source(source_type, source_id)` |
| 9 | `InvestigationReport` | `investigation_reports` | `models.py:241` | -- |
| 10 | `Intervention` | `interventions` | `models.py:263` | `idx_interventions_customer`, `idx_interventions_status` |
| 11 | `InterventionOutcome` | `intervention_outcomes` | `models.py:286` | -- |
| 12 | `ExperienceMemory` | `experience_memories` | `models.py:308` | `idx_memory_segment`, `idx_memory_validation` |
| 13 | `AgentRun` | `agent_runs` | `models.py:334` | -- |
| 14 | `SystemEventLog` | `system_event_logs` | `models.py:355` | -- |

Full column-level reference is authoritative in `docs/DATA_MODEL.md` (re-generated from `models.py`).

#### Notable ORM choices

* All PKs are application-assigned `String(50)` (UUID or prefixed like `risk_abc01_<hex>`), not auto-increment.
* `Customer.health_score` defaults to `100.0` (`models.py:73`) and is overwritten by `reassess_customer_risk`.
* `UsageEvent.job_completion_rate` defaults to `1.0` (`models.py:108`) -- used to distinguish efficiency from decay.
* JSON columns (`feature_adoption_rates`, `detected_signals`, `evidence_ids`, `details`, etc.) store typed Python lists/dicts.
* `Alias` at `models.py:193`: `FeedbackEntry = CustomerFeedback`, `AccountActivity = AccountEvent`.
* All tables carry `{"extend_existing": True}` to tolerate repeated `create_all` in tests/seeding.

---

## 6. Repositories

Pattern: one repo per aggregate, constructor `__init__(self, db: AsyncSession)`, raw `select()` queries,
`commit()` + `refresh()` on writes. No shared base class.

### 6.1 CustomerRepository

File: `backend/src/retainai/repositories/customer_repository.py:8`

| Method | Signature | Notes |
|---|---|---|
| `get_by_id` | `(customer_id: str) -> Optional[Customer]` | `select(Customer).where(id==)` |
| `list_all` | `() -> List[Customer]` | `order_by(Customer.name)` |
| `list_by_risk` | `(risk_level: RiskLevel)` | `where risk_level == ? order_by health_score asc` |
| `create` | `(customer: Customer)` | `add + commit + refresh` |
| `update_health_and_risk` | `(customer_id, health_score, risk_level)` | rounds `health_score` to 1 decimal before persist |

### 6.2 TelemetryRepository

File: `backend/src/retainai/repositories/telemetry_repository.py:15`

All `get_*` methods take `customer_id` + `days: int = 30`, compute
`cutoff = datetime.now(timezone.utc) - timedelta(days=days)` and filter on the time column
(`timestamp` for usage/account, `created_at` for tickets/feedback). Ordering:

* `get_usage_events` -- `timestamp ASC` (window math expects chronological)
* `get_support_tickets` -- `created_at DESC`
* `get_feedback_entries` -- `created_at DESC`
* `get_account_events` -- `timestamp DESC`

Write methods: `add_usage_event`, `add_support_ticket`, `add_feedback`, `add_account_event`.

### 6.3 RiskRepository

File: `backend/src/retainai/repositories/risk_repository.py:8`

* `create_assessment(assessment)` -- persist `RiskAssessment`
* `get_latest_assessment(customer_id)` -- `order_by created_at desc limit 1`
* `get_assessment_history(customer_id, limit=10)` -- used by `TimelineService` with `limit=20`
* `create_investigation(report)` + `get_latest_investigation(customer_id)`

### 6.4 InterventionRepository

File: `backend/src/retainai/repositories/intervention_repository.py:8`

* `create_intervention`, `get_by_id`
* `get_customer_interventions(customer_id)` -- `order_by created_at desc`
* `update_status(intervention_id, status)` -- generic setter
* `create_outcome(outcome)` + `get_outcome_by_intervention(intervention_id)`

### 6.5 MemoryRepository

File: `backend/src/retainai/repositories/memory_repository.py:8`

* `add_memory(memory)`
* `get_validated_memories(customer_segment=None)` -- `where validation_status == VALIDATED` plus optional segment filter, `order_by confidence desc`
* `list_all()` -- `order_by updated_at desc`

### 6.6 EvidenceRepository

File: `backend/src/retainai/repositories/evidence_repository.py:8`

* `add_evidence(evidence)`
* `get_customer_evidences(customer_id)` -- `order_by timestamp desc`
* `get_by_ids(evidence_ids)` -- early-return `[]` on empty input, uses `id IN (...)`

---

## 7. Services

Services orchestrate repos + engines. They are **thin**: no caching, no background jobs.

### 7.1 CustomerService -- `backend/src/retainai/services/customer_service.py:10`

```python
async def reassess_customer_risk(self, customer_id: str) -> Dict[str, Any]:
    # 1. fetch customer (ValueError if missing)
    # 2. telemetry 30d: usage, tickets, feedback, events
    # 3. total_points = len(usage)+len(tickets)+len(feedback)+len(events)
    # 4. signals = SignalEngine.evaluate_all_signals(...)
    # 5. health  = HealthEngine.compute_health_components(signals)
    # 6. risk_res = RiskEngine.evaluate_risk(health, signals, total_points)
    # 7. await customer_repo.update_health_and_risk(...)
    # 8. assessment id = f"risk_{customer_id[:5]}_{uuid.uuid4().hex[:8]}"
    #    create RiskAssessment (calculation_version v1.0, detected_signals from risk_res)
    # 9. return dict {customer_id, health_score, risk_level, risk_score, confidence,
    #                 signals, health_components{usage/support/sentiment/engagement},
    #                 is_insufficient_data, evidence_ids}
```

Important: this method **always** uses `SignalEngine.evaluate_all_signals` (not `evaluate_signals`),
so the `FALSE_POSITIVE_SAFEGUARD` path is **not** triggered here. The safeguard lives in
`SignalEngine.evaluate_signals(customer, ...)` which checks `customer.is_false_positive_candidate`.
See §8.4 / `ENGINE_REFERENCE.md` for the discrepancy note.

### 7.2 SignalService -- `backend/src/retainai/services/signal_service.py:10`

```python
async def get_customer_signals(self, customer_id: str) -> List[Dict[str, Any]]:
    # 30d telemetry -> SignalEngine.evaluate_all_signals -> list of dicts
    # {signal_type, category, severity, value, baseline, delta_pct, summary, evidence_ids, impact_score}
```

### 7.3 TimelineService -- `backend/src/retainai/services/timeline_service.py:10`

```python
async def get_unified_timeline(self, customer_id: str, days: int = 60) -> List[Dict[str, Any]]:
```

5-source aggregation:

| Source | Query | Mapping rule |
|---|---|---|
| Usage | `TelemetryRepository.get_usage_events(60d)` | `severity = NORMAL if DAU>50 else WARNING`; title `DAU: {dau} (License Util: {pct}%)` |
| Tickets | `get_support_tickets(60d)` | `CRITICAL if severity in (HIGH,CRITICAL,URGENT) else INFO` |
| Feedback | `get_feedback_entries(60d)` | `WARNING if NEGATIVE else INFO`; truncates `text[:60]` |
| Account Events | `get_account_events(60d)` | always `INFO` |
| Risk Assessments | `RiskRepository.get_assessment_history(limit=20)` | `CRITICAL if CRITICAL/HIGH_RISK else INFO` |

Result is sorted descending by `timestamp` string (ISO). No pagination.

### 7.4 InterventionService -- `backend/src/retainai/services/intervention_service.py:8`

* `get_customer_interventions(customer_id)` -- passthrough
* `create_intervention(intervention)` -- passthrough
* `approve_intervention(id, approved_by="CSM")` -- sets `status=APPROVED`, `approved_at=now(UTC)`, `approved_by`
* `reject_intervention(id, reason?)` -- sets `status=REJECTED` (reason currently unused beyond signature)

Types used: `InterventionStatus` at `models.py:22`.

### 7.5 EventIngestionService -- `backend/src/retainai/services/event_ingestion_service.py:10`

```python
async def ingest_event(self, customer_id, event_type, payload, timestamp=None):
    # branches on event_type in {"USAGE_EVENT","SUPPORT_TICKET","CUSTOMER_FEEDBACK","ACCOUNT_EVENT"}
    # creates the matching telemetry row + SystemEventLog(event_type=EVENT_INGESTED)
    # commits, then calls CustomerService.reassess_customer_risk(customer_id)
    # returns {status:"processed", customer_id, event_type, reassessment}
```

ID patterns for ingested rows:

* Usage: `usg_{cid[:5]}_{int(ts)}`
* Ticket: `tck_{cid[:5]}_{int(ts)}` or `payload.id`
* Feedback: `fb_{cid[:5]}_{int(ts)}` or `payload.id`
* Account: `acct_{cid[:5]}_{int(ts)}`
* System log: `log_{uuid.hex[:10]}`

Unknown `event_type` still logs + reassesses (no telemetry row).

---

## 8. Engines Deep Dive

This section summarizes behavior; `docs/ENGINE_REFERENCE.md` is the exhaustive reference with
formulas, thresholds, signal catalog, time-window proof, and the safeguard discrepancy.

### 8.1 HealthEngine -- `backend/src/retainai/engine/health_engine.py:16`

```
usage_h = 100
support_h = 100
sentiment_h = 100
engagement_h = 100
for s in signals:
    USAGE    -> usage_h     -= s.impact_score
    SUPPORT  -> support_h   -= s.impact_score
    FEEDBACK -> sentiment_h -= s.impact_score
    ACTIVITY -> engagement_h-= s.impact_score
# USAGE_CONTEXT and other categories are IGNORED (no-op)
clamp each to [0, 100]
overall = usage*0.4 + support*0.3 + sentiment*0.2 + engagement*0.1
round all to 1 decimal
```

* `USAGE_CONTEXT` (false-positive safeguard) carries `impact_score=-35` but is **not subtracted**
  by this engine; it would increase nothing. The safeguard therefore only matters if callers route
  through a path that honors it -- see §8.4.
* Composite uses `HealthWeights` from settings; weights sum to 1.0.

### 8.2 RiskEngine -- `backend/src/retainai/engine/risk_engine.py:10`

**Threshold mapping** (`RiskEngine.map_health_to_risk_level` at `risk_engine.py:18`):

```
health < 20                -> CRITICAL
health < 40                -> HIGH_RISK
health < 60                -> AT_RISK
health < 80                -> WATCH
health < 90                -> STABLE        # <-- hardcoded 90.0, no setting
else                       -> HEALTHY
```

**Insufficient-data guard** (`evaluate_risk` at `risk_engine.py:31`):

```python
if total_data_points < 3:
    return RiskResult(WATCH, risk_score=0.30, confidence=0.40,
                      detected_signals=["INSUFFICIENT_DATA_BASELINE"],
                      is_insufficient_data=True)
```

Otherwise:

* `risk_score = (100 - health) / 100` clamped to `[0,1]`, rounded to 2 decimals.
* `confidence = min(0.95, 0.65 + len(signals)*0.08)` rounded to 2 decimals.
* `evidence_ids` = deduped union of `s.evidence_ids` across signals.
* `detected_signals` = list of `s.signal_type` strings.

### 8.3 SignalEngine -- `backend/src/retainai/engine/signal_engine.py:10`

Four detectors + two aggregators:

| Detector | Method | Triggers | Impact | Severity | Category |
|---|---|---|---|---|---|
| Usage decline | `detect_usage_decline_signals` | `TimeWindowEngine.calculate_usage_window_delta(7d vs 30d)` on `daily_active_users` (fallback `active_users`) | `40.0` if `delta <= -50%`, `25.0` if `<= -25%` | `CRITICAL` / `HIGH` | `USAGE` |
| Support friction | `detect_support_friction_signals` | unresolved critical tickets (`HIGH/CRITICAL/URGENT` + `OPEN/IN_PROGRESS`) else `len(open)>=3` | `35.0` / `20.0` | `CRITICAL` / `HIGH` | `SUPPORT` |
| Sentiment | `detect_sentiment_signals` | `sentiment==NEGATIVE` or `score<=2` | `30.0` | `HIGH` | `FEEDBACK` |
| Admin inactivity | `detect_admin_inactivity_signals` | no `ADMIN_LOGIN`/`ADMIN_ACTIVITY` in 14d, and `len(events)>0` | `15.0` | `MEDIUM` | `ACTIVITY` |
| Aggregator | `evaluate_all_signals` | union of the 4 above | -- | -- | -- |
| Contextual | `evaluate_signals(customer, ...)` | `evaluate_all_signals` + conditional `FALSE_POSITIVE_SAFEGUARD` if `customer.is_false_positive_candidate` | `-35.0` | `LOW` | `USAGE_CONTEXT` |

`DetectedSignal` dataclass at `signal_engine.py:14` carries `signal_type`, `category`, `severity`,
`value`, `baseline`, `delta_pct`, `summary`, `evidence_ids`, `impact_score`, plus `direction`
(`DECLINING` if `delta_pct<0` else `STABLE`) and `magnitude` alias.

### 8.4 Safeguard Note (Intentional Discrepancy)

`SignalEngine.evaluate_signals` appends a `FALSE_POSITIVE_SAFEGUARD` (`USAGE_CONTEXT`, `LOW`, `-35`) when
`customer.is_false_positive_candidate is True`. However, **`CustomerService.reassess_customer_risk`
calls `evaluate_all_signals`, not `evaluate_signals`** (`customer_service.py:28`), so the safeguard
is never triggered in the primary reassessment path -- and `HealthEngine` does not handle
`USAGE_CONTEXT` anyway. Downstream callers that *do* need it must explicitly call
`SignalEngine.evaluate_signals(customer, ...)`. A fix is discussed in `ENGINE_REFERENCE.md`.

### 8.5 TimeWindowEngine -- `backend/src/retainai/engine/time_window.py:10`

Two methods:

* `compare_periods(current_series, baseline_series, min_baseline_threshold=1.0) -> WindowComparison`
  -- mean-based comparison with zero-baseline guard (`pct_delta = 0 if cur<thres else 100`),
  trend by `±5%`, rounding to 2 decimals for `current/baseline/abs/pct`, `is_insufficient_data`
  if either series empty.

* `calculate_usage_window_delta(usage_events, current_days=7, baseline_days=30) -> WindowComparison`
  -- extracts `_get_dau` (`daily_active_users` if `>0` else `active_users`), `_get_ts` (make UTC-aware),
  slices `current = ts >= now-7d`, `baseline = now-30d <= ts < now-7d`, falls back to `baseline = all`
  if sparse, delegates to `compare_periods`.

### 8.6 LearningEngine -- `backend/src/retainai/engine/learning_engine.py:16`

```python
health_delta = health_after - health_before
status = SUCCESS if >=15 else NEUTRAL if >=0 else FAILURE   # rounded delta to 1 decimal elsewhere
outcome.id = f"outc_{intervention_id[:8]}_{int(now_ts)}"
outcome.confidence = 0.90          # hardcoded
outcome.status = evaluation_status = status
if SUCCESS: await _process_learning_candidate(...)
```

Validation gate (`_process_learning_candidate` at `learning_engine.py:55`):

* Fetches `Customer.segment` explicitly (avoids async lazy-load `MissingGreenlet`) -- falls back to `"Enterprise"`.
* Creates `ExperienceMemory` with id `mem_val_{customer_id[:5]}_{int(ts)}`:
  `context_pattern = f"{segment} Account Recovery -- {action_type}"`,
  `risk_pattern = action_type or "HIGH_RISK_SUPPORT_BUG_FRICTION"`,
  `signals = ["UNRESOLVED_CRITICAL_TICKET","USAGE_DECLINE","NEGATIVE_FEEDBACK"]` (hardcoded),
  `recommended_strategy = action_type`, `actual_action = intervention.title`,
  `observed_outcome = f"Health recovered +{delta:.1f} points ..."`,
  `confidence=0.92`, `validation_status=VALIDATED`, `success_count=1, failure_count=0`,
  `evidence_ids=[intervention.id, outcome.id]`.

Only `SUCCESS` outcomes pass the gate. The `record_outcome` wrapper (`learning_engine.py:91`) fetches
actual `health_before` from DB to avoid the `40.0` fallback when possible.

---

## 9. Seeding

### 9.1 Entry points

* `backend/src/retainai/scripts/seed_database.py:222` -- canonical script. Run via `python -m retainai.scripts.seed_database`.
* `backend/src/retainai/db/seed.py` -- historical shim that re-exports the above.
* API route `POST /api/v1/system/reset` (`api/routes.py:29`) calls `seed_demo_data()` in-process.

### 9.2 Dataset

`data/seed/retainai_dataset_v2.json`:

```json
{"metadata": {"version":"dataset-v2","seed":42,"generated_at":"2026-08-30T...", "customer_count":101}}
```

Totals on disk: **101 customers**, **3131 usage_events**, **82 support_tickets**, **94 customer_feedbacks**.

Archetypes (deterministic mapping in `seed_database.py:44`):

| Archetype | RiskLevel | Health | Count |
|---|---|---|---|
| ACMA_HERO | HEALTHY | 88.0 | 1 |
| HEALTHY | HEALTHY | 92.5 | 60 |
| EARLY_WARNING | WATCH | 68.0 | 19 |
| AT_RISK | AT_RISK | 42.0 | 12 |
| RECOVERING | STABLE | 78.0 | 7 |
| CRITICAL | CRITICAL | 18.0 | 2 |

**ACME_HERO** row (`seed_database.py:44`):

```
id=b2a88551-82e5-43d7-b620-ba1640900c71
name=Acme Corp  domain=acmecorp.com  tier=Enterprise
mrr=12000.0  arr=144000.0  csm= Sarah Johnson
health=88.0  risk=HEALTHY
```

Field aliases handled (`seed_database.py:120`):

* `dau` -> `daily_active_users`, `core_feature_clicks` -> `feature_clicks`,
* `license_utilization_pct` -> `license_utilization`, `channel` -> `source`,
* `feedback_text` -> `text`, `arr` computed as `mrr*12` if absent, `domain` from `website` or slug.

### 9.3 Memory seeding

Exactly **one** validated memory is seeded:

```python
ExperienceMemory(
    id="mem-001",
    context_pattern="Enterprise Account CSV Export Friction & Usage Drop",
    customer_segment="Enterprise",
    risk_pattern="HIGH_RISK_SUPPORT_BUG_FRICTION",
    signals=["UNRESOLVED_CRITICAL_TICKET","USAGE_DECLINE","NEGATIVE_FEEDBACK"],
    recommended_strategy="ENGINEERING_ESCALATION_AND_EXECUTIVE_CHECKIN",
    actual_action="Escalate fix to Sprint Priority 1; 1-on-1 Product Head checkin",
    observed_outcome="Customer usage recovered +44 points within 14 days of patch deployment.",
    confidence=0.92, validation_status=VALIDATED, success_count=4, failure_count=0,
    evidence_ids=["TICK-101","FEED-201"])
```

### 9.4 Determinism

* `Base.metadata.drop_all() + create_all()` each run (`seed_database.py:63`).
* `parse_dt` uses `datetime.fromisoformat`; parse failures fall back to `now(UTC)` -- do not assume seed is byte-identical if dataset timestamps change.
* `seed=42` in metadata governs upstream dataset generation, not runtime seeding.

---

## 10. API Surface

Prefix: `settings.API_V1_PREFIX = "/api/v1"` (`config/settings.py:28`).
Routers: `api/routes.py:29` (main) + `api/agent_routes.py`.

| Method | Path | Handler | Service |
|---|---|---|---|
| `POST` | `/api/v1/system/reset` | `reset_demo_database` | `scripts.seed_database.seed_demo_data` |
| `GET` | `/health` | `health_check` | -- (`retainai.db.session` init side effect) |
| `GET` | `/api/v1/status` | `api_status` | static `{loop: SENSE->THINK->...}` |
| `GET` | `/api/v1/customers` | `list_customers` | `CustomerRepository.list_all` |
| `GET` | `/api/v1/customers/{id}` | `get_customer` | `CustomerRepository.get_by_id` |
| `GET` | `/api/v1/customers/{id}/timeline` | `get_customer_timeline?days=60` | `TimelineService.get_unified_timeline` |
| `GET` | `/api/v1/customers/{id}/signals` | `get_customer_signals` | `SignalService.get_customer_signals` |
| `GET` | `/api/v1/customers/{id}/risk` | `get_customer_risk` | `CustomerService.reassess_customer_risk` |
| `POST` | `/api/v1/customers/{id}/reassess` | `reassess_customer` | `CustomerService.reassess_customer_risk` |
| `POST` | `/api/v1/events` | `ingest_event` | `EventIngestionService.ingest_event` |
| `POST` | `/api/v1/interventions` | `create_intervention` | `InterventionService.create_intervention` |
| `GET` | `/api/v1/customers/{id}/interventions` | `list_interventions` | `InterventionService.get_customer_interventions` |
| `POST` | `/api/v1/interventions/{id}/approve` | `approve_intervention` | `InterventionService.approve_intervention` |
| `POST` | `/api/v1/interventions/{id}/reject` | `reject_intervention` | `InterventionService.reject_intervention` |
| … | agent routes | `api/agent_routes.py` | `agents/orchestrator.py` + agents |

CORS: permissive allow-all in dev (`main.py:27`).

Lifespan: `main.py:13` calls `init_db()` on startup (create_all). Seed separately.

---

## 11. Testing

### 11.1 Layout

`backend/tests/` -- 13 modules:

```
test_main.py
test_api_routes.py
test_engines.py
test_core_engine.py
test_health_and_risk.py
test_signal_engine.py
test_time_window.py
test_acme_replay.py
test_repositories_and_services.py
agents/test_orchestrator.py
agents/test_investigation_agent.py
agents/test_action_agent.py
```

Config: `backend/pyproject.toml:32`

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
pythonpath = ["src"]
```

### 11.2 Running

```bash
# from repo root or backend/
uv run pytest              # preferred (uv)
# or
pip install -e backend[dev]
pytest                     # pip fallback
pytest -q backend/tests -v # verbose single-suite
pytest backend/tests/test_signal_engine.py -v  # focused
```

~25 tests total. `asyncio_mode = auto` means `async def test_*` needs no decorator.
A database reset (`POST /api/v1/system/reset` or `python -m retainai.scripts.seed_database`) may
be required between runs that mutate SQLite file.

### 11.3 What is covered

* **Signal detection:** severe/moderate usage decline, critical ticket friction, negative sentiment
  (`test_signal_engine.py:8`), sparse-baseline fallback.
* **Time window:** `compare_periods` divide-by-zero guard, trend thresholds `±5%`.
* **Health/Risk:** weight math, threshold boundaries including `90` STABLE->HEALTHY, insufficient-data
  `WATCH/0.30/0.40` path.
* **Acme replay:** deterministic 3-phase story (healthy baseline, friction injection, recovery).
* **Repos/Services:** async SQLAlchemy with `aiosqlite` against temp DBs.
* **Agents:** orchestrator routing, investigation evidence gathering, action plan generation (LLM mocked).

---

## 12. How to Run Locally

### 12.1 Prerequisites

* Python `>=3.11`
* `uv` (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`) -- or plain `pip`
* No external DB required for dev (SQLite file `./retainai.db` in repo root / backend CWD)

### 12.2 With uv (recommended)

```bash
git clone <repo> && cd "RETAINAI - AI Customer Rescue Agent"
uv sync --extra dev                          # create venv + install retainai + dev deps
uv run python -m retainai.scripts.seed_database   # seeds ./retainai.db (101 customers)
uv run uvicorn retainai.main:app --app-dir backend/src --reload --port 8000
# or: uv run python -m uvicorn retainai.main:app --app-dir backend/src --port 8000
curl http://localhost:8000/health                # {"status":"ok","service":"RETAINAI API",...}
curl http://localhost:8000/api/v1/status         # {"status":"operational","loop":"..."}
```

### 12.3 With pip

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -e backend[dev]
python -m retainai.scripts.seed_database
uvicorn retainai.main:app --app-dir backend/src --reload --port 8000
```

### 12.4 Docker Compose

```bash
docker compose up --build
# respects DATABASE_URL if set to postgres service; else SQLite volume
```

### 12.5 Environment overrides

Create `.env` at repo root or `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://retainai:retainai@localhost:5432/retainai
LLM_API_KEY=your_gemini_key
LLM_MODEL=gemini-2.5-flash
APP_ENV=production
```

Set `DATABASE_URL` to SQLite for local quickstart:

```
DATABASE_URL=sqlite+aiosqlite:///./retainai.db
```

---

## 13. Common Pitfalls

| Pitfall | Why it happens | Fix |
|---|---|---|
| **"Severe usage decline not triggered in production data"** | `TimeWindowEngine.calculate_usage_window_delta` slices by `datetime.now(UTC)`; if your test `UsageEvent.timestamp` values are stale or all outside the 30d window, the fallback `baseline = all events` collapses the delta to ~0. | Insert events with `timestamp` within `now ± 30d` in tests/seeds (see `seed_database.py:120` using `parse_dt` from dataset ISO timestamps). |
| **False-positive safeguard appears to do nothing** | `CustomerService.reassess_customer_risk` calls `evaluate_all_signals` while `evaluate_signals` (the one that appends `FALSE_POSITIVE_SAFEGUARD`) is never hit in that path. Even if hit, `HealthEngine` ignores `USAGE_CONTEXT`. | Call `SignalEngine.evaluate_signals(customer, ...)` explicitly where the customer matters and extend `HealthEngine` to handle `USAGE_CONTEXT` (see `ENGINE_REFERENCE.md` § False Positive Safeguard). |
| **`MissingGreenlet` when fetching `customer.segment` in learning** | Accessing a relationship/column on a detached or async-unloaded instance outside a session. | Already fixed in `learning_engine.py:62` via explicit `select(Customer.segment).where(id==)` -- do not revert to `intervention.customer.segment`. |
| **SQLite vs Postgres drift** | SQLite stores enums as text, no native enum; Postgres enforces typed enum via `asyncpg`. Table/column names and JSON semantics match but migration tooling differs. | Keep `__table_args__ = {"extend_existing": True}` and avoid enum-renames without a migration script. Test against Postgres in CI before release. |
| **`DATABASE_URL` with spaces or special chars breaks `check_same_thread` detection** | `session.py:14` checks `"sqlite" in DATABASE_URL` substring -- uncommon URLs (uppercase, encoded) may mis-route. | Keep URL literal lowercase; for Postgres always use `postgresql+asyncpg://`. |
| **Intervention approve/reject silently no-ops** | `InterventionService.approve/reject` returns `None` when `get_by_id` misses -- API layer must map to 404. | Routes in `api/routes.py` already raise `HTTPException(404)` when `None`. Don't bypass service. |
| **Weights that don't sum to 1.0 silently distort composite** | `HealthEngine` trusts `HealthWeights` without normalization. | Validate `sum(weights.values()) == 1.0` in deploy-time config test or add a `model_validator` to `HealthWeights`. |
| **Seeding looks idempotent but isn't -- it drops all tables** | `seed_demo_data` runs `Base.metadata.drop_all()` (`seed_database.py:63`). Data outside the seed has no migration path. | Never call `/api/v1/system/reset` against a production DB. For production migrations add an Alembic step outside this guide. |
| **`job_completion_rate` mis-tuned** | Stored but never consumed by any engine today. Setting it low looks like a signal but has no health impact. | If you intend to use it, wire it into `SignalEngine` (e.g., efficiency vs. decay) -- currently only the false-positive narrative references it. |
| **Time-travel / frozen-clock tests fail trend assertions** | `detect_admin_inactivity` and `calculate_usage_window_delta` both call `datetime.now(timezone.utc)` directly -- not injected. | In tests, insert events relative to `datetime.now(UTC)` or monkeypatch `datetime.now` carefully; prefer relative `timedelta(days=...)` pattern from existing tests. |

---

## 14. Tooling & Standards

* **Formatting / Lint:** `ruff` at `backend/pyproject.toml:39` (`line-length=100`, `target-version=py311`).
* **Typing:** `mypy` in dev deps -- models use `Mapped[]` with `mapped_column`.
* **Package layout:** `tool.hatch.build.targets.wheel.packages = ["src/retainai"]` -- import as `import retainai.*`.
* **Async discipline:** all DB access is `async`/`await`; `engine.begin()` + `AsyncSessionLocal` -- do not mix sync SQLAlchemy sessions.

---

## 15. References -- File Map

| Concern | File |
|---|---|
| App bootstrap & CORS | `backend/src/retainai/main.py:13` |
| Settings & weights | `backend/src/retainai/config/settings.py:12` |
| DB engine & session | `backend/src/retainai/db/session.py:10` |
| ORM models & enums | `backend/src/retainai/db/models.py:10` |
| Pydantic schemas | `backend/src/retainai/models/schemas.py:10` |
| Health formula | `backend/src/retainai/engine/health_engine.py:16` |
| Risk thresholds | `backend/src/retainai/engine/risk_engine.py:18` |
| Signal detectors | `backend/src/retainai/engine/signal_engine.py:28` |
| Time windows | `backend/src/retainai/engine/time_window.py:16` |
| Learning gate | `backend/src/retainai/engine/learning_engine.py:55` |
| Customer reassess | `backend/src/retainai/services/customer_service.py:18` |
| Timeline | `backend/src/retainai/services/timeline_service.py:13` |
| Event ingest | `backend/src/retainai/services/event_ingestion_service.py:15` |
| Seed | `backend/src/retainai/scripts/seed_database.py:44` |
| Dataset | `data/seed/retainai_dataset_v2.json` |

---

*Generated for RETAINAI backend `0.1.0`. Last synced with code 2026-08-30. Engines are deterministic
-- when in doubt, trust the code links above over this prose.*

