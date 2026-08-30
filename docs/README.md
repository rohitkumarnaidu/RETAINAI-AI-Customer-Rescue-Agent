# RETAINAI -- Documentation Hub

> **Don't wait for churn. Let AI learn how to prevent it.**

**RETAINAI** is an evidence-driven, explainable, self-improving agentic Customer Success intelligence layer that ingests multi-dimensional telemetry (product usage, feature adoption, support tickets, sentiment/feedback, account admin activity), deterministically detects churn risk signals, agentically investigates root causes, formulates evidence-grounded next-best actions, and learns from intervention outcomes via a closed-loop experience memory bank.

**Operating Model:** `SENSE -> THINK -> ACT -> MEASURE -> LEARN -> REPEAT`

- **SENSE** -- Deterministic Signal Engine + Health Engine ingest telemetry and compute period-over-period deltas
- **THINK** -- Agent Orchestrator + Investigation Agent + Experience Memory query synthesize root cause
- **ACT** -- Retention plan generation + Human-in-the-Loop (HITL) approval gate
- **MEASURE** -- 14-day post-intervention telemetry tracking
- **LEARN** -- Validation gate `health_delta >= 15` -> `VALIDATED` experience memory -> future recommendations
- **REPEAT** -- Continuous background intelligence

---

## Table of Contents

1. [Quick Navigation -- Doc Map](#quick-navigation--doc-map)
2. [How to Read These Docs (by Role)](#how-to-read-these-docs-by-role)
3. [Canonical Decisions (Single Source of Truth)](#canonical-decisions-single-source-of-truth)
4. [Acme Corp Hero -- Quick Reference](#acme-corp-hero--quick-reference)
5. [Dataset & Portfolio Snapshot](#dataset--portfolio-snapshot)
6. [Verification Commands](#verification-commands)
7. [Monorepo Structure](#monorepo-structure)
8. [Tech Stack](#tech-stack)
9. [Documentation Maintenance](#documentation-maintenance)

---

## Quick Navigation -- Doc Map

### Getting Started

| # | Document | Path | Description |
|---|----------|------|-------------|
| G-01 | Development Guide | `docs/DEVELOPMENT_GUIDE.md` | Native (SQLite) + Docker (Postgres) setup, `uv`/`pip` paths, `make` targets, 3 reset ways, troubleshooting, verification checklist. Start here for local dev. |
| G-02 | Infrastructure Guide | `docs/INFRASTRUCTURE.md` | `docker-compose.yml` services, `backend/Dockerfile` + `frontend/Dockerfile`, `nginx.conf` SPA fallback, `VITE_API_BASE_URL` bake, healthcheck, rollback/reset, `env_file` wiring. |
| G-03 | Hackathon Master Checklist | `docs/RETAINAI_HACKATHON_MASTER.md` | 38-section universal BuildSprint template (product-agnostic). Use to verify submission completeness. |
| G-04 | Hackathon Checklist | `docs/RETAINAI_HACKATHON_CHECKLIST.md` | Execution checklist with unchecked `todo` items tracking doc/code parity. |
| G-05 | Implementation Plan | `docs/IMPLEMENTATION_PLAN.md` | **Authoritative** 5-track plan (Tracks A–E), canonical decisions table, execution order, acceptance criteria (`pytest 25+`, `npm run build`, `docker compose up`), smoke curl sequence. |

### Product & Requirements

| # | Document | Path | Description |
|---|----------|------|-------------|
| P-01 | **Product Specification** | `docs/PRODUCT.md` | Tagline, domain research, competitor gap analysis (Gainsight/ChurnZero vs RETAINAI), 5 problem breakdowns, vision & principles, operating model deep-dive, 6-dim -> 4-dim health matrix, risk levels, closed-loop scenario, differentiators, success metrics. **Start here for PMs.** |
| P-02 | Problem Statement | `docs/requirements/problem.md` | Formal problem framing: signal fragmentation, delayed detection. |
| P-03 | Product Requirements | `docs/requirements/product-requirements.md` | High-level product requirements and scope. |
| P-04 | Functional Requirements | `docs/requirements/functional-requirements.md` | 17 FRs (FR-001..FR-017) -- customer records, portfolio, timeline, ingestion, delta calc, health engine, risk signals, synthesis, evidence IDs, `INSUFFICIENT_EVIDENCE`, next-best action, HITL, 14-day outcome, memory update. |
| P-05 | Non-Functional Requirements | `docs/requirements/non-functional-requirements.md` | NFR-001..NFR-010 -- demo stability, fallback, perf (<50 ms/signal, <3 s agent), security, maintainability. |
| P-06 | Acceptance Criteria | `docs/requirements/acceptance-criteria.md` | Given/When/Then matrix per FR/SC with `health_delta >=15` gate. |
| P-07 | Agent Requirements | `docs/requirements/agent-requirements.md` | Agent contract: evidence grounding, HITL, fallback. |
| P-08 | AI Requirements | `docs/requirements/ai-requirements.md` | AI-specific constraints (deterministic math vs agentic reasoning). |
| P-09 | Data Requirements | `docs/requirements/data-requirements.md` | Archetype distribution, field schemas, provenance. |
| P-10 | Data Model | `docs/DATA_MODEL.md` | ERD, 14 ORM tables (`backend/src/retainai/db/models.py:57`), enums, indices, column specs, Customer 360 object. |
| P-11 | Data Strategy | `docs/research/data-strategy.md` | Hybrid architecture (public Console-AI helpdesk + synthetic longitudinal generator), archetype definitions, provenance metadata. |
| P-12 | Dataset Research | `docs/research/dataset-research.md` | Candidate dataset evaluation that led to `dataset-v2`. |

### Architecture

| # | Document | Path | Description |
|---|----------|------|-------------|
| A-01 | System Architecture | `docs/ARCHITECTURE.md` | Component diagram (React/Vite -> FastAPI -> Customer360 DB + Signal Engine + Event Pipeline -> Agent Orchestrator -> Tools + Memory), state machine, 10-tool catalog, schema entities. |
| A-02 | System Architecture (Detailed) | `docs/architecture/system-architecture.md` | Expanded system view with service boundaries. |
| A-03 | Agent Architecture | `docs/AGENT_ARCHITECTURE.md` | Single Orchestrator + typed tools, tool permissioning, lifecycle. |
| A-04 | Agent Architecture (Detailed) | `docs/architecture/agent-architecture.md` | Detailed agent wiring and prompt contracts. |
| A-05 | Backend Guide | `docs/BACKEND_GUIDE.md` | `backend/src/retainai/` module map, `config/settings.py:12`, `db/session.py:10`, 14 tables, 6 repos, 5 services, 5 engines, seeding, API surface, pitfalls. **Start here for backend engineers.** |
| A-06 | Frontend Guide | `docs/FRONTEND_GUIDE.md` | React 18 + TS + Vite + Tailwind, `services/api.ts` canonical paths, `CommandCenter.tsx` N+1 fix, `Customer360.tsx`, `ActionCenter.tsx`, `vite.config.ts` proxy. |
| A-07 | UI Design System | `docs/UI_DESIGN_SYSTEM.md` | Tokens, components, layout (shadcn/Tailwind), chart patterns. |
| A-08 | Data Flow | `docs/architecture/data-flow.md` | Event ingestion -> Signal -> Health -> Risk -> Assessment persistence -> Timeline aggregation. |
| A-09 | Database Design | `docs/architecture/database-design.md` | Normalized schema, indices, `extend_existing`, JSON columns. |
| A-10 | Failure Handling | `docs/architecture/failure-handling.md` | Retry, fallback, insufficient-data guard, orphaned routes. |

### Intelligence (Agent & Engine)

| # | Document | Path | Description |
|---|----------|------|-------------|
| I-01 | Engine Reference | `docs/ENGINE_REFERENCE.md` | **Normative** deterministic engine spec: `HealthEngine.compute_health_components` (`backend/src/retainai/engine/health_engine.py:16`), `RiskEngine` thresholds (`backend/src/retainai/engine/risk_engine.py:10`), `SignalEngine` 7 signals (`backend/src/retainai/engine/signal_engine.py:10`), `TimeWindowEngine` (`backend/src/retainai/engine/time_window.py:10`), `LearningEngine` validation gate (`backend/src/retainai/engine/learning_engine.py:16`), magic numbers, safeguard discrepancy §7. |
| I-02 | AI Evaluation | `docs/AI_EVALUATION.md` | SC-01..08 benchmark scenarios, false-positive safeguards, evidence grounding audit, memory retrieval precision. |
| I-03 | Agent Evaluation | `docs/ai/agent-evaluation.md` | Agent-level E2E evaluation. |
| I-04 | LLM Integration | `docs/ai/llm-integration.md` | `agents/llm_client.py:37` provider routing, `mock_key_for_dev` fallback, retry, schema enforcement. |
| I-05 | Tool Contracts | `docs/ai/tool-contracts.md` | 5 canonical tool schemas (authoritative) vs legacy 10-tool alias. |
| I-06 | Prompt Library | `docs/ai/prompt-library.md` | `investigation_agent.py:19` + `action_agent.py:20` system prompts, user prompt assembly. |
| I-07 | Memory Engine | `docs/ai/memory-engine.md` | `ExperienceMemory` validation, confidence `0.92`, `mem-001` seed. |

### Platform (API & Security)

| # | Document | Path | Description |
|---|----------|------|-------------|
| PL-01 | API Reference | `docs/API_REFERENCE.md` | 24 mounted endpoints (`backend/src/retainai/main.py:35`, `backend/src/retainai/api/routes.py:32`, `backend/src/retainai/api/agent_routes.py:13`), System/Customers/Timeline/Signals/Risk/Evidence/Events/Interventions/Outcomes/Portfolio/Learning/Agent, alias & orphaned routes, schemas (`backend/src/retainai/models/schemas.py:1`), OpenAPI, verification curls. |
| PL-02 | Security & Governance | `docs/SECURITY.md` | Threat model, secrets via `backend/src/retainai/config/settings.py:15`, `LLM_API_KEY` mock gate (`backend/src/retainai/agents/llm_client.py:37`), HITL permissioning, prompt/hallucination defense (7 layers), audit `AgentRun` (`backend/src/retainai/db/models.py:374`) + `SystemEventLog` (`backend/src/retainai/db/models.py:394`), 10 open risks. |
| PL-03 | Decisions -- ADR-001 | `docs/decisions/ADR-001.md` | Architecture decision record: single orchestrator vs multi-agent. |

### Demo & Roadmap

| # | Document | Path | Description |
|---|----------|------|-------------|
| D-01 | **Demo Guide** | `docs/DEMO_GUIDE.md` | **Start here for judges/demos.** Project overview, Acme hero identity (`b2a88551-82e5-43d7-b620-ba1640900c71`), dataset stats, 5-phase Acme story (DAU 120->42->118, health 88->38->82, delta +44), 2-min winning script (timed 0:00–2:00), click path, SC-01..08 table, reliability & fallback, Acme replay `POST /api/v1/agent/demo/replay_acme_step` (`backend/src/retainai/demo/acme_replay.py`), troubleshooting, 13-step checklist, Q&A. |
| D-02 | Demo (Legacy Script) | `docs/DEMO.md` | Original 2-min pitch script (33 lines, stale $180k -- canonical is $144k). Kept for reference; prefer `DEMO_GUIDE.md`. |
| D-03 | Demo Flow | `docs/demo/demo-flow.md` | 9-step click sequence (Portfolio -> 360 -> Investigate -> Plan -> Approve -> Inject -> Reassess -> Memory). |
| D-04 | Demo Scenario | `docs/demo/demo-scenario.md` | `data/scenarios/demo_scenario_acme.json` narrative (baseline/friction/sensing/action/recovery). |
| D-05 | **Roadmap** | `docs/ROADMAP.md` | Visual `RETAIN->EXPAND->UNDERSTAND -> Continuous Learning -> Outcomes`, 6 stages (Stage 1–3 MVP done, Stage 4–6 Future), MVP vs Future table, technical debt, 30/60/90-day plan, stage metrics, how to contribute. |
| D-06 | Future Roadmap (Canonical Future) | `docs/FUTURE_ROADMAP.md` | 44-line fresh future-only evolution (Stages 4–6): live integrations (Segment/Mixpanel/PostHog/Zendesk/Intercom/Salesforce/HubSpot/Stripe/Slack + Kafka/NATS), hybrid ML (XGBoost, survival, uplift), autonomous playbooks + RBAC/SOC2. |
| D-07 | Codex Report | `docs/codex-report.md` | Audit findings that fed `IMPLEMENTATION_PLAN.md`. |
| D-08 | Audit Reports | `docs/audit/` | Full audit out/. |

### Data

| # | Document | Path | Description |
|---|----------|------|-------------|
| DT-01 | Dataset v2 | `data/seed/retainai_dataset_v2.json` | `metadata.version: "dataset-v2"`, `seed: 42`, `customer_count: 101` -- Idempotent seed source (`backend/src/retainai/scripts/seed_database.py:73`). |
| DT-02 | Demo Scenario JSON | `data/scenarios/demo_scenario_acme.json` | 5-phase Acme JSON (baseline DAU120 util88.5 -> friction TICK-101/FEED-201 DAU42 -> sensing 88->38 CRITICAL -> action `ENGINEERING_ESCALATION_AND_EXECUTIVE_CHECKIN` -> recovery DAU110 util86% 38->82). |
| DT-03 | Data Strategy | `docs/research/data-strategy.md` | Synthetic generator, archetypes HEALTHY60/EARLY_WARNING19/AT_RISK12/RECOVERING7/CRITICAL2/ACME_HERO1. |
| DT-04 | Dataset Research | `docs/research/dataset-research.md` | Console-AI IT-helpdesk-synthetic-tickets evaluation. |

---

## How to Read These Docs (by Role)

### For Product Managers / Judges (15-min path)

1. **`docs/PRODUCT.md`** -- Domain, competitor gap, operating model, health matrix, closed-loop example, differentiators. This is the product truth.
2. **`docs/DEMO_GUIDE.md`** -- 5-phase Acme story + 2-min script + click path. Run the demo verbatim.
3. **`docs/ARCHITECTURE.md`** -- Component diagram + state machine (1 page).
4. **`docs/FUTURE_ROADMAP.md`** + **`docs/ROADMAP.md`** -- What ships now vs what expands next (Stages 1–3 are MVP, 4–6 are future).

> **One-liner to remember:** RETAINAI is the only CS platform that closes the loop -- every intervention is measured and remembered (`health_delta >=15 -> VALIDATED`), so the next recommendation is grounded in what actually worked.

### For Backend / Full-Stack Engineers (2-hour path)

1. **`docs/IMPLEMENTATION_PLAN.md`** -- Canonical decisions + 5-track breakdown + DoD (proof checklist). Read before touching code.
2. **`docs/BACKEND_GUIDE.md`** -- Module graph, enums (`backend/src/retainai/db/models.py:14`), session (`backend/src/retainai/db/session.py:10`), repos/services/engines deep dive.
3. **`docs/ENGINE_REFERENCE.md`** -- Every threshold, impact score, clamp, and rounding rule (`backend/src/retainai/engine/health_engine.py:16`, `backend/src/retainai/engine/risk_engine.py:10`, `backend/src/retainai/engine/signal_engine.py:10`, `backend/src/retainai/engine/time_window.py:10`, `backend/src/retainai/engine/learning_engine.py:16`). Code wins if doc diverges -- open a fix PR.
4. **`docs/API_REFERENCE.md`** -- 24 endpoints, schemas (`backend/src/retainai/models/schemas.py:1`), alias table, `curl` verification.
5. **`docs/DEVELOPMENT_GUIDE.md`** -- `uv sync`, `uv run pytest -v`, `uv run uvicorn retainai.main:app --reload --port 8000`, `POST /api/v1/system/reset`, `GET /api/v1/portfolio -> 101`.
6. **`docs/DEMO_GUIDE.md` § Demo Reliability** -- `AcmeReplayEngine` (`backend/src/retainai/demo/acme_replay.py`) + fallback + 3 reset ways.
7. **`docs/SECURITY.md` §10** -- Know the open risks (CORS `["*"]` at `backend/src/retainai/main.py:29`, no auth, `VITE_API_BASE_URL` baked) before prod.

Execution order per `docs/IMPLEMENTATION_PLAN.md:82`:

```
Phase 0: plan merged ✅
Phase 1 (parallel): Track A (API) + B (Seed/Demo) + C (Infra/Docker)
Phase 2: Track D (Frontend) after A1 (needs /interventions, /outcomes, /experience-memory aliases)
Phase 3: Track E (QA/E2E smoke) after A+B+C+D
Phase 4: docs/DEMO.md + README polish, git tag v1.0-demo
```

### For AI / Research / Evaluators (1-hour path)

1. **`docs/PRODUCT.md` § Research Findings** -- Activity vs Outcome, compound signals, actionability gap.
2. **`docs/ENGINE_REFERENCE.md` §§ 2–6** -- Deterministic core that agents consume but never override.
3. **`docs/AI_EVALUATION.md`** + **`docs/ai/tool-contracts.md`** -- 5 canonical tools, SC-01..08, evidence grounding, memory retrieval precision.
4. **`docs/DEMO_GUIDE.md` § Alternative Scenarios** -- SC-01..08 edge coverage (false positive, sparse data, compound critical).
5. **`docs/SECURITY.md` §4** -- Prompt injection & hallucination 7-layer defense (JSON MIME + fence stripping + `model_validate` + fallback + sparse gate + confidence calibration).

### For Designers / Frontend Engineers

1. **`docs/FRONTEND_GUIDE.md`** -- `frontend/src/services/api.ts:1`, `CommandCenter.tsx`, `Customer360.tsx`, `ActionCenter.tsx`, `vite.config.ts:7` proxy.
2. **`docs/UI_DESIGN_SYSTEM.md`** -- Tokens, Tailwind, layout.
3. **`docs/DEMO_GUIDE.md` § Step-by-Step Click Path** -- Exact shouts for the live click demo.

### For DevOps / Operators

1. **`docs/INFRASTRUCTURE.md`** -- Compose (`docker-compose.yml:12` `DATABASE_URL` override), `backend/Dockerfile:1` `python:3.11-slim`, `frontend/Dockerfile:1` `node:20-alpine`, `frontend/nginx.conf:2` `listen 5173`, healthcheck (`docker-compose.yml:17` `curl -f http://localhost:8000/health`).
2. **`docs/DEVELOPMENT_GUIDE.md` § Docker Path** -- `make docker-up` / `down` / `logs`, `POST /api/v1/system/reset` seeding, `VITE_*` rebuild caveat.
3. **`docs/SECURITY.md` §12** -- Operator hardening checklist before handling non-synthetic data.
4. **`docs/ROADMAP.md` § Technical Debt & Gaps** -- 10 open risks + 30/60/90 plan.

---

## Canonical Decisions (Single Source of Truth)

Per `docs/IMPLEMENTATION_PLAN.md:19` -- when any doc conflicts, **this table wins**. Code links are from the 2026-08-30 snapshot.

| Topic | Canonical Choice | Code Anchor | Rationale | Draft Label |
|---|---|---|---|---|
| **Health model** | 4-dim: `0.4*usage +0.3*support +0.2*sentiment +0.1*engagement` | `backend/src/retainai/config/settings.py:36`, `backend/src/retainai/engine/health_engine.py:48` | FR-008 acceptance test expects this; 6-dim is roadmap only | MVP |
| **Risk enum** | `HEALTHY / STABLE / WATCH / AT_RISK / HIGH_RISK / CRITICAL` thresholds `20 / 40 / 60 / 80 / 90` | `backend/src/retainai/config/settings.py:44` (`20/40/60/80`), `backend/src/retainai/engine/risk_engine.py:30` (hardcoded `90`) | Matches `risk_engine.py:26`, covers all archetypes | MVP |
| **Tool set** | 5-step orchestrator: `search_customer_evidence`, `calculate_customer_signals`, `investigate_root_cause`, `generate_retention_plan`, `evaluate_outcome` -- keep `AgentTools` as impl, 10-tool naming is legacy | `docs/ai/tool-contracts.md` authoritative; `backend/src/retainai/agents/tools.py:1` | Single orchestrator, no multi-agent chatter | MVP |
| **Financial field** | Canonical `arr` + derived `mrr = arr/12`; seed maps `tier->segment`, `mrr->arr` | `backend/src/retainai/db/models.py:79`, `backend/src/retainai/scripts/seed_database.py:100` | `ARR` is 12xMRR canonically | MVP |
| **Usage schema** | Unified: `daily_active_users, wau, mau, license_utilization, job_completion_rate, feature_clicks, sessions` | `backend/src/retainai/db/models.py:95`, `backend/src/retainai/engine/time_window.py:55` | Required for SC-03 false-positive (`job_completion_rate`) | MVP |
| **State machine** | `OBSERVING -> SIGNAL_DETECTED -> INVESTIGATING -> RISK_ASSESSED -> ACTION_PLANNED -> APPROVED/REJECTED -> EXECUTING -> WAITING_FOR_OUTCOME(14d) -> EVALUATED -> MEMORY_UPDATED -> MONITORING` + intervention `PROPOSED/RECOMMENDED/...` | `docs/ARCHITECTURE.md` + `backend/src/retainai/db/models.py:35` `InterventionStatus` | Full SENSE->LEARN repeat | MVP |
| **Acme hero identity** | `id=b2a88551-82e5-43d7-b620-ba1640900c71` name `Acme Corp` domain `acmecorp.com` tier `Enterprise` | `data/seed/retainai_dataset_v2.json:10`, `backend/src/retainai/demo/acme_replay.py:31` | Replay must resolve by name (`ilike %acme%`) fallback to hardcoded id | MVP |
| **Health weights** | `0.40 / 0.30 / 0.20 / 0.10` sum `1.0`, no re-normalization | `backend/src/retainai/config/settings.py:36` | FR-008 | MVP |
| **Known gap: FR-002 labels** | FR says `LOW/MED/HIGH/CRITICAL`; actual is 6-level enum | `docs/requirements/functional-requirements.md:5` vs `backend/src/retainai/db/models.py:14` | FR draft predates risk engine; canonical is 6-level | Gap |
| **Known gap: FR-005 threshold** | FR says `>30%` drop triggers warning; actual is `-25% MODERATE / -50% SEVERE` | `docs/requirements/functional-requirements.md:9` vs `backend/src/retainai/engine/signal_engine.py:38` | Engine is more sensitive; FR prose is stale | Gap |
| **Known gap: FR-008 dims** | FR prose lists 4 dims correctly, some stale docs show 6 | `docs/requirements/functional-requirements.md:12` | 6-dim is `FUTURE_ROADMAP.md` Stage 4+; MVP is 4-dim | Gap |

> **Rule:** Engines are pure, synchronous, LLM-free (`engine/*`). Agents explain and propose; engines decide health and risk. Never let LLM do arithmetic. See `docs/ENGINE_REFERENCE.md:660` and `docs/BACKEND_GUIDE.md:16`.

---

## Acme Corp Hero -- Quick Reference

| Field | Value | Source |
|---|---|---|
| **Name** | Acme Corp | `data/seed/retainai_dataset_v2.json:10` |
| **ID** | `b2a88551-82e5-43d7-b620-ba1640900c71` | `data/seed/retainai_dataset_v2.json:10`, `backend/src/retainai/demo/acme_replay.py:31` |
| **Domain** | `acmecorp.com` | `data/seed/retainai_dataset_v2.json:12` |
| **Tier / Segment** | Enterprise | `data/seed/retainai_dataset_v2.json:13` |
| **MRR** | $12,000 / month | `data/seed/retainai_dataset_v2.json:14` |
| **ARR** | $144,000 (12 x MRR) | Derived; legacy `DEMO.md` showed $180k -- stale, canonical is $144k |
| **CSM Owner** | Sarah Johnson | `data/seed/retainai_dataset_v2.json:15` (JSON) -- `DEMO.md` legacy variant `Sarah Jenkins` is alias; code resolves CSM name dynamically via `backend/src/retainai/agents/tools.py:21` |
| **Archetype** | `ACME_HERO` | `data/seed/retainai_dataset_v2.json:16` -> `backend/src/retainai/scripts/seed_database.py:44` -> health `88.0` `HEALTHY` |
| **Initial Health** | `88.0` (`HEALTHY`) | `backend/src/retainai/scripts/seed_database.py:44` -- after `step_healthy_baseline` DAU `125` (`backend/src/retainai/demo/acme_replay.py:42`) |
| **Friction Signals** | `TICK-101` HIGH BUG "CSV Export fails for datasets >10,000 rows" OPEN + `FEED-201` NEG `score=2` `sentiment_score=-0.85` + DAU `42` (util `32%`) | `data/scenarios/demo_scenario_acme.json:24`, `backend/src/retainai/demo/acme_replay.py:59` |
| **Sensed Health** | `88 -> 38` (`CRITICAL`) | `docs/DEMO.md` / `backend/src/retainai/demo/acme_replay.py:103` `await service.reassess_customer_risk(cid)` |
| **Root Cause (agent)** | "Acme's reporting export failure (TICK-101) directly blocked month-end reporting, triggering negative sentiment (FEED-201) and executive login drop-off." | `docs/demo/demo-scenario.md:25`, `backend/src/retainai/agents/investigation_agent.py:79` fallback citing `TICK-101` |
| **Retention Plan** | `ENGINEERING_ESCALATION_AND_EXECUTIVE_CHECKIN` | `data/scenarios/demo_scenario_acme.json:42`, `backend/src/retainai/demo/acme_replay.py:135` |
| **Recovery** | DAU `110+` (engine uses `118`), license `86%`, Health `38 -> 82`, delta `+44` | `data/scenarios/demo_scenario_acme.json:46`, `backend/src/retainai/demo/acme_replay.py:111` |
| **Learning Outcome** | `health_delta +44 -> SUCCESS (>=15) -> VALIDATED` memory | `backend/src/retainai/engine/learning_engine.py:27` |

**Alternate Acme demo ID in scenario JSON** -- `data/scenarios/demo_scenario_acme.json:5` uses `cust-acme-101` and `acme.com` / `mrr 12500` / `Sarah Jenkins`. This is the **design-time scenario file**, not the seeded DB identity. The DB identity is `b2a88551...` / `acmecorp.com` / `12000` / `Sarah Johnson`. Code at `backend/src/retainai/demo/acme_replay.py:21` resolves by `ilike %acme%` with fallback to `b2a88551...`, so either works in demo but DB lookup should use the UUID form.

---

## Dataset & Portfolio Snapshot

| Entity | Count | Source |
|---|---|---|
| **Customers** | **101** | `data/seed/retainai_dataset_v2.json:6` + `backend/src/retainai/scripts/seed_database.py:44` |
| **Usage Events** | **3131** | Same dataset totals |
| **Support Tickets** | **82** | Same |
| **Customer Feedbacks** | **94** | Same |
| **Experience Memories (seeded)** | **1** (`mem-001` -- Enterprise CSV Export Friction, `VALIDATED`, `confidence 0.92`) | `backend/src/retainai/scripts/seed_database.py:160` |

**Archetype Distribution** (`backend/src/retainai/scripts/seed_database.py:44`):

| Archetype | `RiskLevel` | `Health` | Count | Share |
|---|---|---|---|---|
| `ACME_HERO` | `HEALTHY` | `88.0` | 1 | 1% |
| `HEALTHY` | `HEALTHY` | `92.5` | 60 | 59% |
| `EARLY_WARNING` | `WATCH` | `68.0` | 19 | 19% |
| `AT_RISK` | `AT_RISK` | `42.0` | 12 | 12% |
| `RECOVERING` | `STABLE` | `78.0` | 7 | 7% |
| `CRITICAL` | `CRITICAL` | `18.0` | 2 | 2% |
| **Total** | -- | -- | **101** | **100%** |

All records carry `metadata.source_type` = `SYNTHETIC` + `generation_version: "dataset-v2"` (`data/seed/retainai_dataset_v2.json:19`), seed `42`.

---

## Verification Commands

Run from repo root `C:\Hackathons\Latent Code\RETAINAI - AI Customer Rescue Agent\`.

### Native (SQLite, no Docker)

```bash
# 1. Install & seed
cd backend && uv sync                                    # or: pip install -e ".[dev]"
uv run python -m retainai.scripts.seed_database          # expect: 101 customers, 3131 usage events, …
cd ..

# 2. Start backend (terminal A) + frontend (terminal B)
make dev                                                 # runs backend :8000 + frontend :5173 in parallel (-j2)
# or individually:
# terminal A: make backend   # cd backend && uv run uvicorn retainai.main:app --reload --port 8000
# terminal B: make frontend  # cd frontend && npm run dev

# 3. Liveness
curl -s http://localhost:8000/health | jq
# {"status":"ok","service":"RETAINAI API","version":"0.1.0","env":"development"}
curl -s http://localhost:8000/api/v1/status | jq
# {"status":"operational","mode":"demo","loop":"SENSE->THINK->ACT->MEASURE->LEARN"}

# 4. Portfolio -- must be 101 after seed
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.total_customers'
# 101
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.risk_distribution'

# 5. Timeline & signals for Acme
curl -s http://localhost:8000/api/v1/customers/b2a88551-82e5-43d7-b620-ba1640900c71 | jq '{health_score, risk_level}'
curl -s "http://localhost:8000/api/v1/customers/b2a88551-82e5-43d7-b620-ba1640900c71/timeline?days=60" | jq length
curl -s http://localhost:8000/api/v1/customers/b2a88551-82e5-43d7-b620-ba1640900c71/signals | jq '.[].signal_type'
curl -s http://localhost:8000/api/v1/customers/b2a88551-82e5-43d7-b620-ba1640900c71/risk | jq

# 6. Full rescue workflow (deterministic fallback with mock key -- no Gemini call)
curl -s -X POST http://localhost:8000/api/v1/agent/investigate/b2a88551-82e5-43d7-b620-ba1640900c71 | jq '{run_id, intervention_id}'

# 7. Intervention lifecycle
IID=$(curl -s -X POST http://localhost:8000/api/v1/interventions \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"b2a88551-82e5-43d7-b620-ba1640900c71","investigation_id":"manual-001","action_type":"EXECUTIVE_CHECKIN","title":"Exec check-in","description":"Renewal risk","plan":"1. Prep 2. Call 3. Follow"}' | jq -r .id)
curl -s -X POST http://localhost:8000/api/v1/interventions/$IID/approve | jq .status
curl -s -X POST http://localhost:8000/api/v1/interventions/$IID/outcome \
  -H "Content-Type: application/json" \
  -d '{"health_before":38,"health_after":82,"usage_before":42,"usage_after":118,"customer_response":"positive"}' | jq

# 8. Memory & reset
curl -s http://localhost:8000/api/v1/learning/memories | jq length   # alias: /experience-memory
curl -s -X POST http://localhost:8000/api/v1/system/reset | jq       # idempotent re-seed

# 9. Tests & frontend build
cd backend && uv run pytest -v                                          # expect ~25 passed
cd ../frontend && npm run build                                         # tsc && vite build
```

### Docker (Postgres)

```bash
make docker-up                                                           # docker compose up --build -d
docker compose ps                                                        # backend (healthy) after ~15s, db (healthy)
docker compose logs -f backend
curl -s http://localhost:8000/health | jq
curl -X POST http://localhost:8000/api/v1/system/reset | jq            # seed compose DB (empty until seeded)
curl -s http://localhost:8000/api/v1/portfolio | jq '.metrics.total_customers'  # 101
open http://localhost:5173                                               # frontend via nginx (frontend/nginx.conf:2)
open http://localhost:8000/docs                                          # Swagger UI

# Tear down
docker compose down              # safe -- keeps postgres_data volume
# docker compose down -v         # DANGEROUS -- deletes volume (Makefile:42)
```

### Demo 3-Act (Acme Replay)

```bash
curl -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=healthy" | jq   # DAU 125 baseline
curl -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=friction" | jq  # TICK-101 + FEED-201 + DAU 42
# run full investigation here, capture intervention_id
curl -X POST "http://localhost:8000/api/v1/agent/demo/replay_acme_step?step=recovery&intervention_id=inv_acme_001" | jq  # DAU 118, delta +44
```

### PowerShell Equivalents (Windows without `make`)

```powershell
cd backend; uv sync
cd backend; uv run python -m retainai.scripts.seed_database
cd backend; uv run uvicorn retainai.main:app --reload --port 8000   # terminal A
cd frontend; npm install; npm run dev                                 # terminal B
Invoke-RestMethod http://localhost:8000/health | ConvertTo-Json
Invoke-RestMethod http://localhost:8000/api/v1/portfolio | Select-Object -ExpandProperty metrics
cd backend; uv run pytest -v
```

---

## Monorepo Structure

```
RETAINAI - AI Customer Rescue Agent/
├── backend/
│   ├── pyproject.toml              # deps, pytest (asyncio_mode auto), ruff, mypy
│   ├── Dockerfile                  # python:3.11-slim, uv sync --frozen, uvicorn
│   ├── src/retainai/
│   │   ├── main.py                 # lifespan init_db(), CORS, routers mount (main.py:35)
│   │   ├── config/settings.py      # pydantic-settings, weights 0.4/0.3/0.2/0.1, thresholds 20/40/60/80
│   │   ├── db/
│   │   │   ├── session.py          # async engine, AsyncSessionLocal, Base, init_db()
│   │   │   └── models.py           # 14 tables, 5 enums, 10+ indices
│   │   ├── engine/                 # health_engine, risk_engine, signal_engine, time_window, learning_engine
│   │   ├── repositories/           # customer, telemetry, risk, intervention, memory, evidence
│   │   ├── services/               # customer_service.reassess_customer_risk(), signal, timeline, intervention, event_ingestion
│   │   ├── agents/                 # orchestrator, investigation_agent, action_agent, llm_client, tools
│   │   ├── api/
│   │   │   ├── routes.py           # 18 endpoints + System reset
│   │   │   └── agent_routes.py     # 4 agent + demo replay endpoints
│   │   ├── demo/acme_replay.py     # AcmeReplayEngine 3 steps
│   │   └── scripts/seed_database.py # 101/3131/82/94 deterministic seed
│   └── tests/                      # 13 modules, ~25 tests, asyncio_mode auto
├── frontend/
│   ├── package.json                # React 18 + TS + Vite + Tailwind + axios + lucide
│   ├── vite.config.ts              # proxy /api -> http://localhost:8000
│   ├── nginx.conf                  # SPA fallback try_files, listen 5173
│   ├── Dockerfile                  # node:20-alpine build -> nginx:alpine
│   └── src/
│       ├── App.tsx                 # tab nav + Reset Demo (App.tsx:19)
│       ├── services/api.ts         # axios, baseURL VITE_API_BASE_URL || localhost:8000/api/v1
│       └── components/             # CommandCenter, Customer360, ActionCenter
├── data/
│   ├── seed/retainai_dataset_v2.json # 101 customers, seed 42, dataset-v2
│   └── scenarios/demo_scenario_acme.json # 5-phase Acme hero JSON
├── docs/                           # ← you are here -- see Quick Navigation above
├── infra/README.md
├── docker-compose.yml              # backend + frontend + db (postgres:16-alpine)
├── Makefile                        # setup-backend, setup-frontend, dev, seed, test, docker-up/down
├── .env.example                    # template (LLM_API_KEY=your_llm_api_key_here)
├── .env                            # actual (mock_key_for_dev, ignored by git)
└── README.md                       # repo root landing page
```

File references use `backend/src/retainai/...:line` from the 2026-08-30 snapshot. When code and doc conflict, code wins -- open a fix PR.

---

## Tech Stack

| Layer | Choice | Version / Anchor |
|---|---|---|
| Runtime | Python | `>=3.11` (`backend/pyproject.toml:10`, `backend/Dockerfile:1` `python:3.11-slim`) |
| Web | FastAPI | `>=0.110.0` |
| ORM | SQLAlchemy Async | `>=2.0.28` `[asyncio]` |
| Drivers | aiosqlite / asyncpg | `>=0.20.0` / `>=0.29.0` |
| Validation | Pydantic + pydantic-settings | `>=2.6.0` / `>=2.2.0` |
| Server | uvicorn | `>=0.28.0` `[standard]` |
| HTTP | httpx | `>=0.27.0` (LLM) |
| Packaging | `uv` (preferred) + `uv.lock` | `backend/pyproject.toml` / `backend/uv.lock` |
| Testing | pytest + pytest-asyncio | `asyncio_mode = auto` (`backend/pyproject.toml:36`) |
| Frontend | React 18 + TypeScript + Vite + Tailwind | `frontend/package.json` |
| HTTP Client | axios | `frontend/src/services/api.ts:1` |
| Icons | lucide-react | `frontend/src/components/*` |
| Infra | Docker Compose + Postgres 16-alpine + nginx:alpine | `docker-compose.yml` |
| LLM | Gemini 2.5 Flash (fallback deterministic) | `backend/src/retainai/agents/llm_client.py:37`, `backend/src/retainai/config/settings.py:31` |

---

## Documentation Maintenance

- **Source of truth:** `docs/IMPLEMENTATION_PLAN.md` §1 locks health, risk, tool, financial, usage, state-machine, Acme identity decisions. `docs/ENGINE_REFERENCE.md` is the engine math source of truth.
- **Doc hygiene:** When adding a new detector, update `docs/ENGINE_REFERENCE.md` §4 and wiring note in `docs/BACKEND_GUIDE.md` -- do not add a parallel detector inside an agent prompt.
- **Offsets:** Stale numbers to watch -- `docs/DEMO.md` showed `$180k ARR` (canonical `$144k` via `12000x12`), `docs/PRODUCT.md` previously 56 lines vs expanded 500+ (this file), `FUTURE_ROADMAP.md` 44 fresh lines vs `ROADMAP.md` expanded 500+.
- **Other docs are owned by other tracks:** `docs/ARCHITECTURE.md`, `docs/FUTURE_ROADMAP.md` are intentionally **not** touched by this hub task (other agents own them). This hub only owns `docs/README.md`, `docs/PRODUCT.md`, `docs/DEMO_GUIDE.md`, `docs/ROADMAP.md`.

---

*Last synced: 2026-08-30. Engines are deterministic -- when in doubt, trust `backend/src/retainai/engine/*` over prose. For questions, start with `docs/PRODUCT.md` (PM), `docs/BACKEND_GUIDE.md` (backend), `docs/DEMO_GUIDE.md` (judges), `docs/DEVELOPMENT_GUIDE.md` (setup).*


