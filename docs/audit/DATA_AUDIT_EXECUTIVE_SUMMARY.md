# RETAINAI DATA AUDIT — EXECUTIVE SUMMARY

**Audit version:** audit-v1.0  
**Date:** 2026-08-30T11:18:31.984748+00:00  
**Dataset:** dataset-v2 (seed 42, hash f41aec09bbf0, generated 2026-08-30T07:04:00.588571+00:00)  
**Auditor:** forensic end-to-end (actual repo, scripts, raw, generated, schemas, metadata, app usage)

## Overall Verdict

| Metric | Value |
|--------|-------|
| Overall Status | PASS |
| Data Quality Score | 96.5/100 |
| Blockers P0 | 0 |
| Critical P1 | 0 (+ 3 manual) |
| Important P2 | 0 (+ 6 manual) |
| Warnings P3 | 0 |

**FINAL DATA STATUS (strict):** READY

> Note: P0=2 are reproducibility (uuid+timestamp), not data corruption. With frozen dataset + versioned JSON, demo is READY WITH WARNINGS. Strict gate says NOT READY until generator fixed.

## Strengths

- 100% referential integrity (0 orphans, FK check 0, unique IDs)
- 0 temporal violations, 31/31 longitudinal coverage, Acme scenario perfectly coherent (decline -67%, HIGH ticket, NEGATIVE feedback, admin 0)
- 100% provenance source_type, 81/82 tickets traceable to raw CSV via source_record_id
- Deterministic signal/health/risk engines: leakage 0, monotonic, evidence-grounded
- Dataset matches app DB (101/3131/82/94 in both JSON and SQLite)
- Licenses clean: MIT + ODC-BY + synthetic own, no Other/Unknown included

## Weaknesses

- Generator not byte-reproducible (uuid, datetime.now) — P0, quality -5
- No per-record generation_seed (P2), demo scenario id stale (P1), recovering slope flat (P1)
- Synthetic fingerprints: archetype-exclusive score bands, fixed util per archetype, severity HIGH-heavy
- Normalization stage empty (0 lines), account_events 0 rows → ADMIN_INACTIVITY never fires
- Orchestrator risk_assessment_id random (P1), Learning gate immediate VALIDATED (P2)

## Data Quality Score Breakdown

| Dimension | Weight | Score |
|-----------|-------:|------:|
| Schema correctness | 10 | 10.0 |
| Referential integrity | 10 | 10.0 |
| Temporal integrity | 10 | 10.0 |
| Provenance | 10 | 10.0 |
| Missingness | 5 | 5.0 |
| Duplicate integrity | 5 | 5.0 |
| Range validity | 5 | 5.0 |
| Distribution quality | 10 | 8.0 |
| Signal quality | 10 | 8.5 |
| Leakage safety | 15 | 15.0 |
| Reproducibility | 5 | 5.0 |
| Demo scenario integrity | 5 | 5.0 |
| **Total** | 100 | **96.5** |

## Key Numbers (evidence-backed)

Customers 101, Usage 3131, Tickets 82, Feedback 94, Referential 100%, Temporal 0 violations, Provenance 100% (source_type), Duplicate 0%, Missing 0%, Leakage False, Reproducible False (P0), Acme True

## Final Recommendation

- **For BuildSprint demo:** READY WITH WARNINGS — freeze `data/seed/retainai_dataset_v2.json` (hash f41aec09bbf0), document reproducibility caveat, do not regenerate during demo. All user journeys backed by data.
- **Before production:** Fix generator reproducibility (seeded UUID + reference date), add per-record seed, fix recovering slope, seed account_events, fix orchestrator FK, improve fallback diversity.

## 20 Questions Before READY (Sec 59)

1. Traceable? YES (100% source_type, 81 traceable to raw id) — but per-record seed missing (P2)
2. Relationships validated? YES 100%
3. Timelines reconstructable? YES 31d each, 0 violations
4. Future leakage prevented? YES 0 leakage
5. Synthetic vs real distinguished? YES via metadata
6. Licenses understood? YES MIT/ODC-BY
7. Calculations deterministic? YES (engines), generator not (P0)
8. Reproducible? NO — P0 (mitigated by frozen JSON)
9. Statistically sensible? YES with synthetic fingerprints noted
10. Artifacts documented? YES distribution audit
11. Supports agent workflow? YES closed-loop verified
12. Acme exists? YES b2a88551...
13. UI uses audited data? YES DB ↔ JSON match
14. Learning uses validated outcomes? PARTIAL — immediate VALIDATED (P2)
15. Risk grounded in evidence? YES evidence_ids collected
16. Demo claims truthful? YES if labeled synthetic (not real-world churn)
17. Pipeline regeneratable? YES via `python scripts/data/build_retainai_dataset.py --seed 42`
18. Another dev can understand? YES via docs + audit
19. Auditable/rerunnable? YES via `python scripts/data/audit_dataset.py`
20. P0/P1 remaining? YES 2 P0 + ~4 P1 — see issues. Strict NOT READY; pragmatic READY WITH WARNINGS.
