# RETAINAI Data Leakage Audit

Generated: 2026-08-30T11:18:31.805155+00:00
Target: ZERO UNINTENTIONAL DATA LEAKAGE

## Overall: PASS — No leakage detected ✓

### Audit Method

Checked the exact information available at prediction time for risk calculation.

Risk is NOT stored in dataset. It is computed at read time via:

```
CustomerService.reassess_customer_risk(customer_id):
  usage = get_usage_events(days=30)
  tickets = get_support_tickets(days=30)
  feedback = get_feedback_entries(days=30)
  events = get_account_events(days=30)
  signals = SignalEngine.evaluate_all_signals(usage, tickets, feedback, events)
  health = HealthEngine.compute_health_components(signals)
  risk = RiskEngine.evaluate_risk(health, signals, total_points)
```

All engines use ONLY historical data within the window ending at `now`.

### Feature Availability

| Feature | Available at prediction time? | Leakage? | Evidence |
|---------|-------------------------------|----------|----------|
| Historical usage (30d) | Yes | No | TimeWindowEngine filters timestamp >= now-30d |
| Future usage (post-now) | No — not in DB at assessment | No | Dataset timestamps end at generation date; future replay uses explicit now+days for recovery (post-intervention) |
| Support ticket (past 30d) | Yes | No | SignalEngine filters tickets by created_at within window |
| Future ticket | No | No | Not yet ingested |
| Feedback (past) | Yes | No | 30d window |
| Future feedback | No | No | — |
| Intervention outcome | No — computed AFTER intervention | No | LearningEngine evaluates AFTER reassessment |
| Health_before / after | Measured at evaluation time | No | Not used as input to risk |

### Checks

- Risk on Day -10 does NOT use churn outcome at Day 0: Verified — no churn label exists in dataset; risk is rule-derived from health, not trained model.
- Risk does NOT use future intervention outcome: Verified — outcome is created after intervention.
- Risk does NOT use future feedback/usage: Verified — window is trailing 30d.

### Caveats

- `TimeWindowEngine.calculate_usage_window_delta` uses `datetime.now(timezone.utc)` as cutoff — if system clock is off, window could include future. Not leakage, but clock dependency noted.
- `AcmeReplayEngine.step_post_intervention_recovery` ingests usage at `now+1..now+7` days — these are intentionally future; they are created AFTER outcome evaluation, not used to predict past risk. Safe if not backfilled.
- No ML model training on synthetic labels — so no target leakage via label encoding. Health weights are fixed (0.40/0.30/0.20/0.10), not learned from leaked target.

### Verdict

`leakage_detected = False` — **PASS**. Note as CORRELATIONAL — NOT CAUSAL: archetype fingerprints create synthetic correlations (e.g., AT_RISK always low util) but not data leakage.
