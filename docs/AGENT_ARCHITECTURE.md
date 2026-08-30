# RETAINAI — Agent Architecture & Tool Specifications

## Core Philosophy
RETAINAI avoids opaque, noisy multi-agent chatter by employing a **Single Orchestrator with Specialized Tool Modules**. The Agent Orchestrator receives event triggers, executes tool functions to gather evidence across Customer 360 domains, synthesizes compound signals, assesses root causes, and generates structured retention plans.

---

## 1. Agent Tool Definitions

Every agent tool is strictly typed with Pydantic schemas, error handlers, and logging.

### 1. `get_customer_profile(customer_id: str)`
- **Input:** `customer_id`
- **Returns:** Customer identity, ARR, CSM contact, lifecycle stage, renewal date, and false-positive candidate status.

### 2. `get_usage_history(customer_id: str, days: int = 30)`
- **Input:** `customer_id`, time window in days
- **Returns:** Daily/weekly active users, WAU/MAU ratios, feature adoption breakdown, job completion rate, session counts.

### 3. `get_support_history(customer_id: str)`
- **Input:** `customer_id`
- **Returns:** List of support tickets, resolution status, priority levels, categories, SLA breaches, and sentiment scores.

### 4. `get_customer_feedback(customer_id: str)`
- **Input:** `customer_id`
- **Returns:** Recent NPS scores, CSAT ratings, qualitative comments, topic tags, and sentiment scores.

### 5. `get_account_activity(customer_id: str)`
- **Input:** `customer_id`
- **Returns:** Executive meeting logs, email touchpoints, admin login records, license allocation changes.

### 6. `calculate_signals(customer_id: str)`
- **Input:** `customer_id`
- **Returns:** Deterministic period-over-period deltas, compound signal combinations (e.g. `Usage ↓` + `Support Ticket Open` + `Admin Inactive`).

### 7. `get_previous_interventions(customer_id: str)`
- **Input:** `customer_id`
- **Returns:** Historical intervention recommendations, human approval decisions (approved/rejected), execution logs, and recorded 14-day outcomes.

### 8. `query_experience_memory(industry_segment: str, root_cause_category: str)`
- **Input:** Industry segment, root cause category
- **Returns:** Matching historical strategies from the global Experience Memory Bank with sample sizes, success rates, and confidence scores.

### 9. `generate_retention_plan(customer_id: str, root_cause: str, priority: str)`
- **Input:** Customer context, identified root cause, priority level
- **Returns:** Structured multi-step retention plan, milestone timelines, responsible owner, and personalized email outreach draft grounded in specific telemetry IDs.

### 10. `record_outcome(intervention_id: str, outcome_data: dict)`
- **Input:** Intervention ID, post-intervention metrics
- **Returns:** Outcome evaluation (`SUCCESS`, `NEUTRAL`, `FAILURE`), metric deltas, and updated Experience Memory entry.

---

## 2. Agent Execution Workflow (Sense → Think → Act → Measure → Learn)

```text
  [Customer Event / Telemetry Ingested]
                   │
                   ▼
       [Sense: Deterministic Signal Engine]
                   │ (If Risk Delta > Threshold)
                   ▼
       [Think: Agent Investigation Orchestrator]
                   ├─► Tool: get_customer_profile
                   ├─► Tool: get_usage_history
                   ├─► Tool: get_support_history
                   ├─► Tool: get_customer_feedback
                   ├─► Tool: get_account_activity
                   └─► Tool: query_experience_memory
                   │
                   ▼
       [Root Cause Analysis & Evidence Synthesis]
                   │
                   ▼
       [Act: Retention Plan & Draft Generation]
                   │
                   ▼
       [CSM Human-in-the-Loop Approval]
       ├── Approved ──► [Execute Intervention]
       └── Rejected ──► [Log CSM Feedback]
                   │
                   ▼
       [Measure: 14-Day Post-Intervention Tracking]
                   │
                   ▼
       [Learn: Update Experience Memory Bank]
```
