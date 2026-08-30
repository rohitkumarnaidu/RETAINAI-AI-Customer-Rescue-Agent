# RETAINAI Data Audit Issues

Generated: 2026-08-30T11:18:31.984377+00:00
Dataset: dataset-v2 hash f41aec09bbf0

| ID | Severity | Issue | Evidence | Impact | Recommended Fix | Status |
|----|----------|-------|----------|--------|----------------|--------|
| ARCH-001 | P1 | RECOVERING archetype flat not recovering slope | Generator line 130 else branch dau_mod 0.8 for recovering | Recovery narrative unsupported | Make recovering: dau_mod 0.6 rising to 1.0 last 7d | OPEN |
| SCHEMA-003 | P2 | account_events 0 rows, ADMIN_INACTIVITY never fires from dataset | Dataset has 0 account_events, signal_engine needs >0 events | Signal gap | Seed 1 admin login per customer per week via generator | OPEN |
| DOC-001 | P1 | demo_scenario_acme.json id cust-acme-101 stale vs actual b2a88551... | Scenario file vs generator hardcoded id | Demo confusion | Update scenario file to match generated id or regenerate from generator | OPEN |
| ENGINE-001 | P1 | Orchestrator creates InvestigationReport with random risk_assessment_id not linked to actual RiskAssessment | orchestrator.py:74 risk_assessment_id=f"risk_{{cid[:5]}}_{{uuid}}" | FK orphan, traceability broken | Persist reassessment id and use it | OPEN |
| ENGINE-002 | P2 | LearningEngine immediately VALIDATED on single SUCCESS (health_delta>=15) | learning_engine.py:100 validation_status=VALIDATED | Premature universal rule (observational, N=1) | Require success_count>=3 or human approval or segment N>=5 | OPEN |
| DATA-001 | P2 | Support severity HIGH-heavy 84% no CRITICAL | Counter HIGH 69 MEDIUM 13, raw fallback has 0 CRITICAL | Unrealistic distribution | Add CRITICAL/URGENT sample rows to fallback or weight generator | OPEN |
| DATA-002 | P2 | Feedback scores perfectly banded by archetype (clustering) | HEALTHY 8-10, AT_RISK 1-4 etc. | Synthetic fingerprint, unrealistic separability | Add overlap jitter or Gaussian noise | OPEN |
| DOC-002 | P2 | Longitudinal docs say 30 days, dataset is 31 | Generator range(30,-1,-1) inclusive | Off-by-one | Doc fix or change to range(29,-1,-1) | OPEN |
| INFRA-001 | P2 | normalize_datasets.py and validate_datasets.py empty | 0 lines | Architecture overclaim | Implement or remove docs reference | OPEN |


Fixed: dataset hash F41AEC09BBF02973129C6C26E04C2152A787E6CFAA9B38B8537644FF20CA910E (patched provenance + code fix)
