# Primary Demo Scenario — "Acme Corp Rescue Story"

## Scenario Persona: Acme Corp (Enterprise Tier)
- **MRR:** $12,500 / month
- **Renewal Date:** 60 Days
- **CSM Owner:** Sarah Jenkins

## Story Arc & Chronological Telemetry

### Phase 1: Baseline Health (Days 1 - 30)
- High Daily Active Users (DAU: 120+).
- License Utilization: 88%.
- 0 open support tickets.
- NPS Score: 9 (Positive sentiment).

### Phase 2: Emerging Friction Signals (Days 31 - 45)
- Support Ticket #TICK-101 filed: "Export to CSV fails on reports with >10,000 rows" (Severity: HIGH). Ticket sits unresolved for 10 days.
- CSAT Survey Feedback #FEED-201: "Reporting module is unreliable for our end-of-month executive deck" (Score: 2/5, Sentiment: NEGATIVE).
- Admin Logins drop from 15 logins/week to 1 login/week.
- DAU drops from 120 to 42 (65% drop in core feature clicks).

### Phase 3: Autonomous Agent Sensing & Investigation (Day 46)
- RETAINAI Health Engine recalculates Acme Corp score: **88 -> 38 (CRITICAL)**.
- Risk Assessment emits signals: `[USAGE_DROP_65_PCT, UNRESOLVED_HIGH_SEVERITY_TICKET, NEGATIVE_CSAT_FEEDBACK]`.
- RETAINAI Investigation Agent investigates evidence (`usage_evt_45`, `TICK-101`, `FEED-201`) and outputs:
  - **Root Cause:** "Acme's reporting export failure (TICK-101) directly blocked month-end reporting, triggering negative sentiment (FEED-201) and executive login drop-off."
  - **Confidence:** `HIGH`.

### Phase 4: Action Plan & Human Approval (Day 47)
- RETAINAI Action Strategy Agent references Experience Memory and generates Retention Plan:
  - **Action Type:** `ENGINEERING_ESCALATION_AND_EXECUTIVE_CHECKIN`.
  - **Proposed Plan:** "Escalate TICK-101 fix to Sprint Priority 1. Offer 1-on-1 technical onboarding session with Head of Product."
- CSM Sarah Jenkins reviews and clicks **APPROVE** in RETAINAI UI.

### Phase 5: Intervention & Closed-Loop Learning (Day 60)
- Engineering deploys CSV export patch.
- Replay script triggers Day 60 telemetry:
  - DAU recovers to 110+.
  - License utilization recovers to 85%.
  - Acme Corp Health Score rebounds: **38 -> 82 (LOW RISK)**.
- RETAINAI Learning Engine records: `health_delta: +44`.
- Experience Memory updated: "Engineering Escalation + Exec Checkin successfully rescues Enterprise accounts experiencing export feature friction (Success Count +1)."
