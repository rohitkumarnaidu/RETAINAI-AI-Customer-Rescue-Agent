# RETAINAI Dataset Architecture Audit

Generated: 2026-08-30T11:18:31.945217+00:00

Intended architecture:
```
PUBLIC DATA / BASELINE INFORMATION
          ↓
NORMALIZATION
          ↓
SYNTHETIC LONGITUDINAL GENERATION
          ↓
RETAINAI DATA MODEL
          ↓
VALIDATION
          ↓
APPLICATION
          ↓
AGENTIC WORKFLOW
```

## Implementation Mapping

| Architecture Stage | Implementation | File | Function | Verified |
|--------------------|---------------|------|----------|----------|
| Source | Console-AI Helpdesk fallback 10 rows | data/raw/helpdesk_tickets.csv + scripts/data/download_datasets.py | download_helpdesk_tickets(), create_fallback_tickets() | VERIFIED (10 rows), FALLBACK not 500 |
| Normalization | (Missing) | scripts/data/normalize_datasets.py | — empty (0 lines) | FAILED — no code; ticket priority uppercasing done ad-hoc in generator |
| Generation | Archetype-driven 31d longitudinal | scripts/data/build_retainai_dataset.py | build_portfolio(seed, count), generate_customer(), get_ticket_details() | VERIFIED but reproducibility P0 |
| Validation | CLI audit | scripts/data/audit_dataset.py | audit() | VERIFIED (created 2026-08-30) |
| Storage | SQLAlchemy async SQLite/Postgres | backend/src/retainai/db/models.py + session.py 404 lines | Base.metadata.create_all(), AsyncSessionLocal | VERIFIED — 14 tables, FKs, indices |
| Application | FastAPI routes + React dashboard | backend/src/retainai/api/routes.py (206 lines) + frontend/src/App.tsx | /api/v1/customers, /timeline, /risk, /events etc. | VERIFIED |
| Agent consumption | Tools + Orchestrator + Engines | backend/src/retainai/agents/tools.py, orchestrator.py, engine/* | AgentTools.search_customer_evidence(), SignalEngine, HealthEngine, RiskEngine | VERIFIED — evidence-grounded |

## Gaps

- **Normalization stage missing:** `normalize_datasets.py` and `validate_datasets.py` are 0 bytes. Data flows directly from raw CSV sampling inside generator without standalone normalization. For hackathon, this is acceptable but architecture diagram overstates pipeline maturity (P2).
- **Source stage fallback vs production:** HF download requires network; fallback ensures build succeeds but sampling diversity 10 vs 500 (P2).
- **Validation stage was missing before audit** — now added as `audit_dataset.py` (remediation).
