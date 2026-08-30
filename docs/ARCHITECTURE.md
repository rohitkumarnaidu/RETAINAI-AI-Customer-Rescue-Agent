# RETAINAI — Agent & Technical Architecture

## Architectural Principles
1. **Deterministic Foundation, Agentic Reasoning:** Math, percentage deltas, database constraints, state transitions, and tool validation are handled in strict deterministic Python code. Evidence synthesis, investigation, root-cause reasoning, and communication crafting are performed by LLM agents.
2. **Single Orchestrator with Modular Tools:** Rather than fragmented, noisy multi-agent communication, RETAINAI uses a central Agent Orchestrator equipped with clean, schema-validated, single-responsibility tools.
3. **Evidence-First Traceability:** Every conclusion produced by the agent includes explicit references to underlying telemetry record IDs (`usage_event_102`, `support_ticket_405`, `feedback_12`).

---

## System Component Diagram

```text
       ┌────────────────────────────────────────────────────────┐
       │               Frontend (React + Vite + Tailwind)       │
       └───────────────────────────┬────────────────────────────┘
                                   │ REST / WebSockets
       ┌───────────────────────────▼────────────────────────────┐
       │              FastAPI Application Services               │
       └──────┬────────────────────┬────────────────────┬───────┘
              │                    │                    │
   ┌──────────▼────────┐ ┌─────────▼────────┐ ┌─────────▼────────┐
   │ Customer 360 DB   │ │ Deterministic    │ │ Event Stream    │
   │ (SQLite/AsyncPG)  │ │ Signal Engine    │ │ Pipeline        │
   └──────────▲────────┘ └─────────┬────────┘ └─────────┬────────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   │ Trigger Event / Job
                       ┌───────────▼───────────┐
                       │   Agent Orchestrator  │
                       └───────────┬───────────┘
                                   │ Tool Calls
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────▼────────┐        ┌────────▼───────┐        ┌─────────▼────────┐
│ Customer 360   │        │ Risk & Root    │        │ Experience      │
│ Data Tools     │        │ Cause Tools    │        │ Memory Engine    │
└────────────────┘        └────────────────┘        └──────────────────┘
```

---

## Core Agent Tools & Schema Contracts

| Tool Name | Parameters | Output Schema | Purpose |
| :--- | :--- | :--- | :--- |
| `get_customer_profile` | `customer_id: str` | `CustomerProfile` | Returns core metadata, ARR, CSM, renewal date |
| `get_usage_history` | `customer_id: str, days: int` | `UsageSummary` | Retrieves WAU/MAU, feature adoption metrics |
| `get_support_tickets` | `customer_id: str` | `List[SupportTicket]` | Fetches open/closed tickets, severity, sentiment |
| `get_customer_feedback`| `customer_id: str` | `List[Feedback]` | Fetches NPS/CSAT comments and sentiment scores |
| `calculate_signals` | `customer_id: str` | `List[Signal]` | Deterministically computes period-over-period deltas |
| `get_previous_interventions`| `customer_id: str` | `List[Intervention]` | Retrieves history of past CSM interventions and results |
| `query_experience_memory` | `industry: str, root_cause: str` | `List[MemoryEntry]` | Retrieves historical successful strategies for similar contexts |
| `generate_retention_plan` | `customer_id: str, root_cause: str, plan_details: dict` | `RetentionPlan` | Formulates structured intervention plan & draft email |
| `record_intervention` | `customer_id: str, action_data: dict` | `Intervention` | Persists intervention and sets up evaluation timer |
| `record_outcome` | `intervention_id: str, outcome_data: dict` | `Outcome` | Evaluates 14-day post-intervention telemetry & logs learning |

---

## Agent State Machine

```text
[OBSERVING] ──(New Event)──> [SIGNAL_DETECTED]
                                    │
                                    ▼
                             [INVESTIGATING] (Tool execution)
                                    │
                                    ▼
                             [RISK_ASSESSED]
                                    │
                                    ▼
                             [ACTION_PLANNED]
                                    │
                         (Awaiting CSM Action)
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
      [ACTION_APPROVED]                         [ACTION_REJECTED]
               │                                         │
               ▼                                         ▼
      [EXECUTING_INTERVENTION]                  [FEEDBACK_RECORDED]
               │
               ▼
     [WAITING_FOR_OUTCOME] (14-Day Observation Window)
               │
               ▼
     [OUTCOME_EVALUATED]
               │
               ▼
    [EXPERIENCE_MEMORY_UPDATED] ──> [MONITORING]
```

---

## Data Schema Entities

- **`customers`**: ID, name, domain, segment, ARR, plan, renewal_date, csm_id, lifecycle_stage.
- **`usage_events`**: ID, customer_id, timestamp, active_users, wau, mau, feature_name, session_count.
- **`support_tickets`**: ID, customer_id, created_at, status, priority, category, summary, sentiment_score.
- **`feedback_entries`**: ID, customer_id, timestamp, type (NPS/CSAT), score, text, sentiment.
- **`account_activity`**: ID, customer_id, timestamp, activity_type, participant_role, notes.
- **`risk_assessments`**: ID, customer_id, timestamp, risk_level, score, confidence, explanations, evidence_ids.
- **`interventions`**: ID, customer_id, risk_assessment_id, csm_id, status (recommended, approved, rejected, executed), action_type, priority, plan_json, draft_email.
- **`intervention_outcomes`**: ID, intervention_id, evaluated_at, usage_delta, support_delta, sentiment_delta, outcome_status (success, neutral, failure), analysis.
- **`experience_memories`**: ID, industry_segment, root_cause_category, intervention_type, success_rate, sample_count, key_learnings.
