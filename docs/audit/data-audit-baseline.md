# RETAINAI Data Audit Baseline — Existing Claims

Generated: 2026-08-30T11:18:31.679464+00:00
Auditor: forensic end-to-end audit (automated, evidence-backed)
Dataset: `data/seed/retainai_dataset_v2.json` (hash f41aec09bbf0)
Seed: 42
Version: dataset-v2

> This file records every documented claim as an unverified hypothesis before independent verification.

## Existing Claims

| Claim | Source | Documented Value | Actual (Measured) | Status | Notes |
|-------|--------|------------------|-------------------|--------|-------|
| Customer count | docs/DATA_MODEL.md:618, README, build script default | 101 (1 Acme + 100 portfolio) | 101 | VERIFIED | 101 = 1 ACME_HERO + 60 HEALTHY + 19 EARLY_WARNING + 12 AT_RISK + 7 RECOVERING + 2 CRITICAL |
| Usage event count | docs/DATA_MODEL.md:221 | 3,131 | 3131 | VERIFIED | 101 customers × 31 days |
| Support ticket count | docs/DATA_MODEL.md:270 | 82 | 82 | VERIFIED | Archetype-correlated generation |
| Feedback event count | Task prompt (example claim) | 81 (claimed in audit prompt) | 94 | FAILED | Prompt example said 81, actual is 94. Docs/DATA_MODEL says 94. |
| Seed | data/README.md, scripts/data/build script | seed=42 reproducibility | 42 (dataset) but generator not byte-reproducible | PARTIALLY VERIFIED | `random.seed(42)` set but `uuid.uuid4()` + `datetime.now()` make IDs/timestamps non-deterministic |
| Referential integrity | Task prompt example claim | 100% | 100.00% | VERIFIED | 0 orphans |
| Provenance | docs/research/data-strategy.md:5 | 100% with source_type tags | 100.00% with source_type; per-record seed missing | PARTIALLY VERIFIED | All records have source_type but no per-record generation_seed |
| License MIT | dataset_registry.json, LICENSE | MIT | MIT (Console-AI) + ODC-BY (IBM, candidate only) | VERIFIED | See data-license-audit.md |
| Longitudinal coverage | docs/research/data-strategy.md:47 | 30 days | 31 days (range 30..0 inclusive) | PARTIALLY VERIFIED | Off-by-one: generator does 31 days |
| Acme scenario | docs/research/data-strategy.md:54, demo_scenario_acme.json | Acme Corp critical decline + ticket + feedback | Exists, valid | VERIFIED | Acme id b2a88551-82e5-43d7-b620-ba1640900c71, decline -67%, ticket HIGH/OPEN, feedback NEGATIVE, admin 0 last 7d |

## Verification Method

Each claim verified by:
- Loading actual `data/seed/retainai_dataset_v2.json`
- Counting via Python (not trusting docs)
- Cross-checking `backend/retainai.db` via sqlite3
- Inspecting generator source `scripts/data/build_retainai_dataset.py`
- Inspecting DB schema `backend/src/retainai/db/models.py`

## Discrepancies That Must Not Be Silently Corrected

1. Feedback count 81 vs 94 — prompt example is illustrative, docs are correct (94).
2. 30 vs 31 days — document correct value or fix generator loop.
3. Reproducibility — docs claim seed guarantees exact same DB state; code fails due to unseeded UUID/timestamp.
