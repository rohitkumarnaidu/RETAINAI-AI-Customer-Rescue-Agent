# RETAINAI Data Source Audit

Generated: 2026-08-30T11:18:31.680465+00:00
Registry: `data/dataset_registry.json` + `docs/research/dataset-research.md` + `docs/research/data-strategy.md`

## Summary

| Source | Rows | License | Status | Used | Provenance |
|--------|-----:|---------|--------|------|------------|
| Console-AI Helpdesk | 10 (fallback) / 500 (HF) | MIT | selected | Yes — 81/82 ticket texts sampled | PUBLIC_DATASET + source_record_id |
| IBM Telco Churn | 7,043 | ODC-BY | candidate | No rows imported, insights only | N/A |
| arti199919 SaaS | 84.8k | Other/Unknown | rejected | No | N/A |
| RETAINAI Synthetic | 3,408 | MIT | selected (primary) | Yes — all customers/usage/feedback | SYNTHETIC + generation_version |

## Detailed Findings

### 1. Console-AI IT-helpdesk-synthetic-tickets — VERIFIED, SAFE

- **Publisher:** Console Systems, Inc (HF: Console-AI)
- **URL:** https://huggingface.co/datasets/Console-AI/IT-helpdesk-synthetic-tickets
- **License:** MIT (confirmed on HF page and registry). SAFE.
- **Raw file:** `data/raw/helpdesk_tickets.csv` — 10 rows, 4 cols (`id,subject,priority,category`). This is the **fallback curated sample** created by `scripts/data/download_datasets.py:create_fallback_tickets()` when HF raw URL is blocked (GitHub CORS). Production HF is 500-row parquet; fallback preserves schema for hackathon reproducibility.
- **Usage:** `build_retainai_dataset.py:get_ticket_details()` does `random.choice(public_tickets)` and maps `priority→severity`, `category→category`, `subject→subject`, `id→source_record_id`. Stored with `{source_type: PUBLIC_DATASET, source_dataset: Console-AI/IT-helpdesk, source_record_id: <id>}`.
- **Evidence:** `grep -r source_record_id data/seed` shows 81 tickets have it; 1 synthetic fallback (Acme's hardcoded ticket) does not. Correct.

### 2. IBM Telco Customer Churn — PARTIALLY VERIFIED, SAFE WITH ATTRIBUTION

- **License:** ODC-BY 1.0. Requires attribution, allows commercial + redistribution. `dataset_registry.json` correctly lists `ODC-BY`.
- **Actual use:** No file in `data/raw` or `data/interim`. No `customer_id` linkage attempted (correct per data-strategy.md:24 *never assume public IDs correlate*). Only used to inform archetype thresholds. This is defensible.
- **Gap:** No `data/raw/telco.csv` to inspect; validation is doc-based only. Mark as `SOURCE VERIFICATION REQUIRED` for exact HF mirror license confirmation if this source were promoted to `selected` with row import — currently safe because no rows are imported.

### 3. arti199919 / mindweave — VERIFIED, CORRECTLY REJECTED

- `docs/research/dataset-research.md:41` correctly rejects `arti199919/synthetic-saas-churn-sample` and `mindweave/help-desk-tickets` as `Other/Unknown`. Audit confirms HF pages show `License: Other`. Classification `DO NOT USE` is correct. No files found in repo — good.

### 4. RETAINAI Synthetic — VERIFIED, SAFE, SYNTHETIC LABEL REQUIRED

- **Generator:** `scripts/data/build_retainai_dataset.py` (192 lines)
- **Output:** `data/seed/retainai_dataset_v2.json` (1,296,980 bytes, hash f41aec09bbf0)
- **Rows:** 101 customers + 3131 usage + 82 tickets + 94 feedback = 3,408 records.
- **Provenance:** Customers/usage/feedback have `{source_type: SYNTHETIC, generation_version: dataset-v2}`. Tickets have blended provenance (81 PUBLIC_DATASET, 1 SYNTHETIC).
- **Missing:** `generation_seed` and `generation_timestamp` per-record (only in `metadata.seed`/`generated_at`). See provenance audit.
- **Reproducibility:** `random.seed(42)` present but `uuid.uuid4()` and `datetime.now()` break byte-reproducibility (P0).

## Provenance Chain Checks

- `RETAINAI record → source dataset → source record` — POSSIBLE for 81 tickets (source_record_id traces to `data/raw` row id).
- `RETAINAI record → generator → version → seed` — POSSIBLE via `metadata.generation_version` + `metadata.seed` (dataset-level) but per-record seed missing.
- `Demo record → scenario definition` — POSSIBLE: `data/scenarios/demo_scenario_acme.json` + hardcoded Acme block in generator (lines 60-94).

## Issues

| ID | Severity | Issue |
|----|----------|-------|
| SRC-001 | P2 | Raw fallback only 10 rows vs HF 500 — sampling diversity limited; acceptable for MVP but note in docs |
| SRC-002 | P2 | No per-record generation_seed (see provenance audit) |
| SRC-003 | P1 | Generator reproducibility broken (see reproducibility audit) |
