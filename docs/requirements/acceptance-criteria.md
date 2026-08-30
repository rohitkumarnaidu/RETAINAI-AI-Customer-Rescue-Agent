# Acceptance Criteria Matrix

| Req ID | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| **FR-001** | Customer Records | P0 | Given seed data, system loads customer profile, metadata, MRR, and renewal date accurately. |
| **FR-002** | Customer Portfolio | P0 | Portfolio API returns accounts sorted by risk level; UI renders health badges (0-100) and risk labels. |
| **FR-003** | Timeline View | P0 | Timeline endpoint returns aggregated chronological events (usage, tickets, feedback) with unique IDs. |
| **FR-004** | Usage Events Ingestion | P0 | Ingesting daily usage records updates account metrics and historical usage log. |
| **FR-005** | Usage Delta Calculation | P0 | Deterministic calculation triggers warning signal if 7-day DAU average is >30% below 30-day baseline. |
| **FR-006** | Support Ticket Ingestion | P0 | Ingesting support ticket updates ticket counts and open high-severity flag on account. |
| **FR-007** | Feedback Ingestion | P0 | Ingesting negative feedback (<3 CSAT or NEGATIVE sentiment) updates customer sentiment driver. |
| **FR-008** | Health Model Engine | P0 | System computes composite score: `0.4*Usage + 0.3*Support + 0.2*Sentiment + 0.1*Engagement`. |
| **FR-009** | Signal & Risk Detection | P0 | Health score < 50 automatically emits `RiskAssessment` record with `CRITICAL` or `HIGH` level. |
| **FR-010** | Agent Root-Cause Synthesis | P0 | Agent produces structured JSON containing `root_cause_summary` explaining usage/support/feedback correlation. |
| **FR-011** | Evidence Grounding | P0 | Every claim in root-cause synthesis references valid `evidence_ids` from dataset. |
| **FR-012** | Insufficient Evidence Flag | P0 | When <2 data sources exist for an account, agent returns `confidence: INSUFFICIENT_EVIDENCE`. |
| **FR-013** | Action Plan Generation | P0 | Agent formulates actionable plan with action type, incentive, target persona, and rationale. |
| **FR-014** | Human-in-the-Loop Workflow | P0 | CSM can click Approve/Modify/Reject in UI; state updates in backend from `PENDING` to `APPROVED`. |
| **FR-015** | Outcome Observation | P0 | Replay script introduces post-intervention event; health recalculation produces `health_delta`. |
| **FR-016** | Experience Memory Update | P0 | Successful intervention (`health_delta > +15`) increments `success_count` in Experience Memory Bank. |
| **FR-017** | Memory-Informed Future Recommendation | P0 | Agent queries Experience Memory for matching risk patterns and includes top-performing strategy in response. |
