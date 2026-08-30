# Agent Architecture — Orchestrator & Tool Specs

## Agent Design Philosophy
To eliminate "fake multi-agent complexity" while providing deep reasoning, RETAINAI uses a single deterministic **Retention Orchestrator** that delegates specific cognitive sub-tasks to tightly scoped LLM invocation routines and deterministic tools.

```text
                        ┌──────────────────────────────┐
                        │    Retention Orchestrator    │
                        └──────────────┬───────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌───────────────────┐        ┌───────────────────┐        ┌───────────────────┐
│ Investigation Tool│        │ Action Strategy   │        │ Learning & Memory │
│     (LLM)         │        │    Tool (LLM)     │        │    Engine (Hybrid)│
└───────────────────┘        └───────────────────┘        └───────────────────┘
```

## Agent Tool Contracts

### 1. `search_customer_evidence`
- **Type:** Deterministic
- **Purpose:** Query all usage events, support tickets, and feedback items within a given date window for a customer.
- **Input:** `{ customer_id: str, days_back: int }`
- **Output:** `{ usage_events: [...], tickets: [...], feedback: [...] }`

### 2. `calculate_health_signals`
- **Type:** Deterministic
- **Purpose:** Execute multi-dimensional health scoring model and compute 7-day vs 30-day percentage deltas.
- **Input:** `{ customer_id: str }`
- **Output:** `{ health_score: float, usage_score: float, support_score: float, sentiment_score: float, signals: list[str] }`

### 3. `investigate_root_cause`
- **Type:** LLM
- **Purpose:** Synthesize multi-source telemetry evidence into a coherent diagnostic summary with explicit evidence ID citations.
- **Input:** `{ customer_id: str, health_signals: dict, evidence: dict }`
- **Output:** `InvestigationReport` (Pydantic schema)

### 4. `recommend_retention_action`
- **Type:** LLM
- **Purpose:** Match root causes and matching Experience Memory strategies to produce an evidence-grounded next-best retention action.
- **Input:** `{ customer_id: str, investigation_report: dict, matched_memories: list[dict] }`
- **Output:** `RetentionPlan` (Pydantic schema)

### 5. `evaluate_intervention_outcome`
- **Type:** Hybrid (Deterministic Delta + LLM Insight)
- **Purpose:** Compare pre- and post-intervention health scores, measure recovery, and format a reusable rule for Experience Memory.
- **Input:** `{ intervention_id: str, days_observed: int }`
- **Output:** `OutcomeEvaluation` (Pydantic schema)
