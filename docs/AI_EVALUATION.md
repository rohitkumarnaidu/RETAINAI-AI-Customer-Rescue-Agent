# RETAINAI — AI Evaluation Framework & Test Suite

## Framework Principles
To ensure high precision and zero hallucinations in production customer success scenarios, RETAINAI evaluates model outputs against 5 rigid criteria:

1. **Evidence Groundedness:** Every risk factor or root cause claim must cite explicit record IDs from `usage_events`, `support_tickets`, `feedback_entries`, or `account_activity`. Uncited claims are rejected.
2. **False Positive Detection:** The system must differentiate between product disengagement and increased efficiency/job completion.
3. **Uncertainty Calibration:** When telemetry is missing or ambiguous, the model must output low confidence ($\le 0.60$) and recommend information-gathering actions rather than aggressive interventions.
4. **Actionability:** Retention recommendations must map directly to the root cause (e.g. Support Friction -> Ticket Escalation, Adoption Friction -> Feature Onboarding).
5. **Schema Compliance:** All JSON responses must parse strictly against Pydantic models.

---

## Benchmark Scenario Matrix

| Scenario ID | Account Name | Synthetic Signal Profile | Expected Risk Level | Expected Root Cause | Expected Key Intervention |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SC-01** | Apex Global | WAU steady, CSAT 5/5, 0 open tickets | `HEALTHY` | N/A (Stable adoption) | Periodic Quarterly Business Review |
| **SC-02** | Acme Corp | Usage -61%, 3 unresolved P1 tickets, CSAT 1/5 | `CRITICAL` | Support Friction & Adoption Drop | Support Escalation + Admin Outreach |
| **SC-03** | Logistics Pro | Usage -45%, Job Completion Rate 98%, CSAT 5/5 | `STABLE` / `WATCH` | **False Positive Candidate** (Workflow Efficiency) | Value Confirmation Check-in |
| **SC-04** | CloudTech Inc | Executive Sponsor left company, Admin login = 0 | `HIGH_RISK` | Stakeholder Disengagement | Executive Sponsor Re-alignment |
| **SC-05** | Delta Systems | CSAT dropped to 2/5, usage steady | `WATCH` | Emerging Negative Sentiment | Sentiment Outreach & Feedback Call |
| **SC-06** | InnoLabs | Renewal in 30 days, usage -30%, no CSM meet | `HIGH_RISK` | Commercial & Adoption Risk | Renewal Executive Review |
| **SC-07** | Zenith Retail | Support ticket resolved, usage recovered +38% | `HEALTHY` | Post-Intervention Recovery | Record Successful Outcome |
| **SC-08** | OmniMedia | Incomplete usage data, 1 unresolved ticket | `WATCH` | Insufficient Telemetry Data | Request Telemetry Sync |
