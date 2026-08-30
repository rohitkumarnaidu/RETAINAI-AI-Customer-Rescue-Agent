# RETAINAI Data Freeze

Frozen: 2026-08-30T11:20:22.402664+00:00
Freezer: forensic audit 2026-08-30

`
dataset_version: dataset-v2
generation_version: dataset-v2 (patched provenance 2026-08-30)
seed: 42
generation_command: python scripts/data/build_retainai_dataset.py --seed 42 --reference-date 2026-08-30T07:04:00+00:00
validation_command: python scripts/data/audit_dataset.py --dataset data/seed/retainai_dataset_v2.json
dataset_path: data/seed/retainai_dataset_v2.json
dataset_hash (sha256 12): f41aec09bbf0
customer_count: 101
usage_events: 3131
support_tickets: 82
feedback_events: 94
audit_date: 2026-08-30T11:18:38.430568+00:00
audit_version: audit-v1.0
data_quality_score: 96.5
overall_status: PASS
referential_integrity: 1.0
temporal_violations: 0
provenance_coverage: 1.0
reproducible: True
acme_valid: True
db: backend/retainai.db (101/3131/82/94) + retainai.db (101/3131/82/94)
tests: 31 passed
`

**Do NOT manually edit frozen generated data afterward. Generator is source of truth. Rerun pipeline via generation_command + validation_command.**

Validation after freeze:

`
python scripts/data/audit_dataset.py  # expect PASS, 96.5, P0 0
uv run pytest tests -q                 # expect 31 passed
`
