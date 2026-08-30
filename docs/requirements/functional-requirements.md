# Functional Requirements Specification

## Customer & Account Management
- **FR-001 (P0):** System MUST maintain customer account records containing account metadata (tier, MRR, renewal date, CSM owner, industry, creation date).
- **FR-002 (P0):** System MUST render a customer portfolio dashboard displaying active accounts, deterministic health scores (0-100), and risk categories (LOW, MEDIUM, HIGH, CRITICAL).
- **FR-003 (P0):** System MUST maintain a unified chronological timeline per customer aggregating usage, support, sentiment, and account events.

## Usage & Activity Intelligence
- **FR-004 (P0):** System MUST ingest product usage events (daily active users, license utilization percentage, key feature adoption counts).
- **FR-005 (P0):** System MUST deterministically calculate period-over-period usage deltas (e.g., 7-day vs 30-day moving average drop > 30%).

## Support & Feedback Intelligence
- **FR-006 (P0):** System MUST ingest support ticket records including severity, status, open duration, resolution flag, and subject text.
- **FR-007 (P0):** System MUST ingest customer feedback entries (CSAT, NPS, survey comments, sentiment classification).

## Risk Detection & Health Engine
- **FR-008 (P0):** System MUST calculate account health using a deterministic weighted multi-dimensional model (Usage Health, Support Health, Sentiment Health, Engagement Health).
- **FR-009 (P0):** System MUST generate discrete Risk Signals whenever health drops below configurable thresholds or negative deltas trigger.

## Investigation & Root Cause Synthesis
- **FR-010 (P0):** System MUST synthesize evidence from telemetry when risk is detected, producing a root-cause explanation.
- **FR-011 (P0):** System MUST tag every claim in the explanation with specific evidence identifiers (`usage_evt_101`, `ticket_202`, `feedback_303`).
- **FR-012 (P0):** System MUST return `INSUFFICIENT_EVIDENCE` status if evidence quality or quantity is inadequate rather than hallucinating root causes.

## Action Planning & Human-in-the-Loop Interventions
- **FR-013 (P0):** System MUST generate a personalized Next-Best Action retention plan specifying recommended action type, messaging angle, offer/incentive, and target executive.
- **FR-014 (P0):** System MUST support CSM action approval, modification, or rejection.

## Closed-Loop Outcome Observation & Experience Memory
- **FR-015 (P0):** System MUST record post-intervention outcome telemetry (e.g., usage 14 days post-intervention).
- **FR-016 (P0):** System MUST update Experience Memory with validated strategies when interventions yield positive usage/health recovery.
- **FR-017 (P0):** System MUST reference validated Experience Memory entries to inform subsequent retention recommendations for accounts with matching risk profiles.
