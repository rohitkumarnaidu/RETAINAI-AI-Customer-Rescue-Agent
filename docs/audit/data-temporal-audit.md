# RETAINAI Data Temporal Audit

Generated: 2026-08-30T11:18:31.799841+00:00
Dataset: dataset-v2

## Summary

- **Target:** 0 temporal violations
- **Actual:** 0 violations — PASS
- **Longitudinal window:** Expected 31 days (generator range 30..0 inclusive), doc claims 30 — off-by-one noted.
- **Per-customer coverage:** 101 with exactly 31 events, 0 <31, 0 >31

## Violations

None — all timestamps logically ordered

Checks performed:
- customer creation < usage events
- ticket created_at valid, resolved_at after created_at
- feedback timestamp valid
- no usage in future (+1d tolerance)
- outcome after intervention (vacuously true: 0 outcomes in dataset)
- risk assessment after evidence (runtime, not in dataset)

## Longitudinal Completeness

Every customer has exactly 31 usage events (one per day for 30..0 inclusive). Verified:

- Min per customer: 31, Max: 31, Distinct distribution: Counter({31: 101})
- No missing dates, no duplicate dates per customer (usage_key_dup=0)
- Usage timestamps span 2026-07-31T07:04:00.588571+00:00 → 2026-08-30T07:04:00.588571+00:00

## Acme Timeline

- Usage decline: -67.3% (first week 189 → last week 62)
- Ticket at 2026-08-16T07:04:00.588571+00:00 severity HIGH status OPEN
- Feedback at 2026-08-20T07:04:00.588571+00:00 NEGATIVE score 3
- Admin inactivity last 7: [0, 0, 0, 0, 0, 0, 0] (expected all 0) — PASS
- Chronology: usage high → decline starts ~Day -21 → ticket Day -14 → feedback Day -10 → admin 0 Day -7 → Day 0 critical (if health recalc) — LOGICALLY COHERENT

## Data Leakage Temporal Check

Risk at Day -10 must not use churn outcome at Day 0. Since dataset has no precomputed risk field — risk is computed at read-time via SignalEngine from past 30d window — NO LEAKAGE. See data-leakage-audit.md.
