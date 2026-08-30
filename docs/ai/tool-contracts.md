# Tool Contracts Specification

## 1. `search_customer_evidence`
- **Executor:** Deterministic Service
- **Input:** `CustomerSearchInput(customer_id: str, days_back: int = 30)`
- **Output:** `CustomerEvidencePayload(usage_events: list[UsageEventSchema], support_tickets: list[TicketSchema], customer_feedbacks: list[FeedbackSchema])`

## 2. `calculate_customer_signals`
- **Executor:** Deterministic Intelligence Engine
- **Input:** `CustomerSignalInput(customer_id: str)`
- **Output:** `HealthSignalResult(health_score: float, usage_score: float, support_score: float, sentiment_score: float, engagement_score: float, risk_level: str, triggered_signals: list[str])`

## 3. `investigate_root_cause`
- **Executor:** LLM Agent
- **Input:** `InvestigationInput(customer_id: str, health_result: HealthSignalResult, evidence: CustomerEvidencePayload)`
- **Output:** `InvestigationReportSchema(id: str, root_cause_summary: str, evidence_ids: list[str], confidence: str, missing_evidence: list[str])`

## 4. `generate_retention_plan`
- **Executor:** LLM Agent
- **Input:** `ActionPlanInput(customer_id: str, investigation: InvestigationReportSchema, matched_memories: list[ExperienceMemorySchema])`
- **Output:** `RetentionPlanSchema(id: str, action_type: str, proposed_plan: str, incentive_offered: str, target_executive: str, rationale: str)`

## 5. `evaluate_outcome`
- **Executor:** Deterministic Math + LLM Learning Engine
- **Input:** `OutcomeEvaluationInput(intervention_id: str)`
- **Output:** `OutcomeEvaluationSchema(health_delta: float, outcome_status: str, learned_memory_rule: Optional[ExperienceMemorySchema])`
