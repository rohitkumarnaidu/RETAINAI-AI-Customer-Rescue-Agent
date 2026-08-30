# RETAINAI Data Provenance Audit

Generated: 2026-08-30T11:18:31.803236+00:00
Target: 100% records with valid provenance
Actual: 100.00%

## Coverage

- Customers: 101/101 = 100.00% with source_type
- Usage: 3131/3131 — 100%
- Tickets: 82/82 — 100% (81 PUBLIC_DATASET, 1 SYNTHETIC)
- Feedback: 94/94 — 100%
- Overall: 100.00%

Calculated: `provenance_coverage = records_with_valid_provenance / total_records` = 1.0000

## Public-derived traceability

Can we trace `RETAINAI record → source dataset → source record` ?

- For 81 tickets: YES. Example: ticket id 84499... → metadata {source_record_id: kz5mjjpox} → data/raw/helpdesk_tickets.csv id kz5mjjpox subject "Access Issue with Shared Network Drive". Verified by joining ticket metadata to raw CSV.
- For 1 Acme ticket (synthetic): N/A — source_type SYNTHETIC, not public.

## Synthetic traceability

Can we trace `RETAINAI record → generator → version → seed/archetype` ?

- Customers/usage/feedback: have generation_version=dataset-v2 but NO per-record generation_seed. Dataset metadata has seed 42, but individual records do not store it. So trace is PARTIAL: you can trace to generator version, but not replay exact archetype assignment per customer without re-running generator (and generator is not byte-reproducible anyway).
- Archetype field exists per customer (HEALTHY etc.) — useful.
- Missing: generation_timestamp per record (only dataset generated_at).

## Demo traceability

`Demo record → scenario definition → deterministic generation` ?

- Acme: customer id b2a88551... is hardcoded in generator lines 60-94. Scenario doc `data/scenarios/demo_scenario_acme.json` has different id (cust-acme-101) — STALE vs actual. Actual Acme id is UUID v4, not cust-acme-101. This is a P1 doc drift.
- Ticket/feedback for Acme are hardcoded SYNTHETIC, not sampled — deterministic.

## Verdict

- **Provenance coverage (source_type):** 100% PASS
- **Full provenance (source_type + source_dataset + source_record_id or generation_version + generation_seed + timestamp):** PARTIALLY VERIFIED — missing per-record generation_seed/timestamp (P2)
- **No missing/ambiguous/duplicated provenance:** No fabricated records; duplicated source_record_ids possible? Check: source_record_id counts Counter({'86eza0fwq': 15, 'kz5mjjpox': 11, '6bqwkmxi1': 11, '2apbmy56h': 10, 'cvf932pt2': 8, '1sj8czs0k': 7, '0k8ro1kdx': 6, 'hmth9114b': 6, 'rq9cpafv3': 5, '1aiu3lrqi': 2}) — some sampled tickets share same raw id via random.choice (expected), not duplicated provenance error.
- **Impossible to trace:** None — all records traceable to either public sample or synthetic generator.

## Recommendation

- Add `generation_seed` and `generation_timestamp` to each record's metadata (P2).
- Align demo_scenario_acme.json id with actual generator id or make seed script overwrite scenario file (currently build script docs say it updates demo_scenario_acme.json but code does not).
