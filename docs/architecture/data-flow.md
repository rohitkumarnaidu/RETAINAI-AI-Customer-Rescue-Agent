# Data Flow Architecture — Closed-Loop Retention Cycle

## Closed-Loop Execution Sequence

```text
[1. Event Ingestion]
Customer Telemetry (Usage, Tickets, Feedback) ──> Event Repository

[2. Deterministic Health Engine]
Event Repository ──> Calculate Health Metrics ──> Risk Signal Detection

[3. Agentic Investigation Trigger]
Risk Signal (Health < 50) ──> Fetch Chronological Evidence ──> Investigation Agent

[4. Evidence-Grounded Root Cause]
Investigation Agent ──> Produce Root Cause Summary + Evidence IDs ──> Store Investigation

[5. Next-Best Action Generation]
Investigation + Experience Memory ──> Action Strategy Agent ──> Generate Retention Plan

[6. Human-in-the-Loop Gate]
Retention Plan ──> CSM Review Dashboard ──> Approved / Modified / Rejected

[7. Intervention Execution]
Approved Action ──> Record Intervention Timestamp & Initial State

[8. Outcome Observation & Learning]
Post-Intervention Telemetry (T+14 Days) ──> Compute Health Delta ──> Learning Engine
                                                                       │
                                                                       ▼
                                                          Experience Memory Bank
```

## Data Transformation Pipeline
1. Raw Event JSON -> Pydantic Model (`UsageEventCreate`, `TicketCreate`, `FeedbackCreate`)
2. Raw Events -> Aggregated Health Vectors (`HealthVector`: usage_score, support_score, sentiment_score)
3. Health Vector -> `RiskAssessment` Record
4. `RiskAssessment` + Raw Event Evidences -> LLM Prompt context (`InvestigationContext`)
5. LLM Prompt -> Structured Output Pydantic Model (`InvestigationReport`)
6. `InvestigationReport` + `RetentionPlan` -> CSM Approval State
7. Approval State + Post-Event Data -> `InterventionOutcome` -> `ExperienceMemory`
