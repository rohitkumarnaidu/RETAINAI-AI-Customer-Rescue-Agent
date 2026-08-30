# RETAINAI Data Integrity Audit

Generated: 2026-08-30T11:18:31.803599+00:00
Dataset: dataset-v2 seed 42

## Referential Integrity — Target 100%

- **Result:** 100.0000% — VERIFIED, 0 orphan records
- Usage: 3131 all have valid customer_id
- Tickets: 82 all valid
- Feedback: 94 all valid
- Check: `usage.customer_id → customers.id` etc. via Counter join — PASS

DB also verified: `PRAGMA foreign_key_check` = 0 violations (sqlite, checked via backend/retainai.db)

## Duplicate Audit

| Class | Count | Rate | Verdict |
|-------|------:|------|---------|
| Exact duplicate IDs — customers | 0 | — | PASS |
| Exact duplicate IDs — usage | 0 | — | PASS |
| Exact duplicate IDs — tickets | 0 | — | PASS |
| Exact duplicate IDs — feedback | 0 | — | PASS |
| Semantic duplicate (customer_id,timestamp) | 0 | — | PASS |
| Total duplicate_rate | 0.0000% | — | PASS |

No near-duplicate support tickets flagged: subjects varied via random.choice + fallback.

## Missing Data Audit

- **missing_data_rate:** 0.0000%
- Required fields checked: name/domain/tier/mrr etc. — 0 missing per SCHEMA audit.
- Optional fields: feedback.score null? All feedback have score (1..10). Ticket resolved_at null for OPEN (64/82) — expected.
- Pattern: missingness not disproportionate across archetypes (healthy vs at-risk etc. similar rates).

## Outlier Audit

- **MRR:** min 1019, max 12000, mean 3137, outliers (IQR): [12000.0]
  - Acme 12000 is High but intentional demo hero — LEGITIMATE.
- **DAU:** min 16, max 537, mean 245, outliers sample: []
  - No negative, no extreme >1000 improbable but max 537 within archetype base 50-500 * mod 1.1 — LEGITIMATE synthetic.
- **Outliers classification:** No impossible values, no generation bug; demo-specific Acme high MRR is expected.

## Range Validity

- MRR >=0: PASS (0 invalid)
- DAU >=0: PASS
- license_utilization 0..1: PASS (0 out-of-range)
- NPS/CSAT score: feedback scores 1..10 integer — all in range
- Risk/health 0..100: customers health 18..92.5, all in range

## Issues

No P0 integrity blockers. See data-audit-result.json for weights: referential 10/10, missingness 5/5, duplicate 5/5, range 5/5.
