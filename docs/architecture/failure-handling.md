# Failure Handling & Resilience Architecture

## Error Taxonomy & Resilience Strategies

### 1. LLM Service Timeouts / Provider Errors
- **Risk:** LLM API network timeouts or rate limits during live presentation.
- **Mitigation:**
  - Fast retry with exponential backoff (1s, 2s, 4s).
  - Deterministic Fallback Heuristic Generator: If the LLM call fails completely, the Orchestrator invokes a local fallback routine that populates structured `InvestigationReport` and `RetentionPlan` objects using deterministic rule matrices based on health signals.

### 2. Evidence Insufficiency (`INSUFFICIENT_EVIDENCE`)
- **Risk:** Account has insufficient telemetry (e.g., brand new customer with 0 tickets and <2 usage records).
- **Mitigation:**
  - System explicitly outputs `confidence: INSUFFICIENT_EVIDENCE`.
  - System populates `missing_evidence: ["Minimum 7 days of usage telemetry", "At least 1 support or feedback record"]`.
  - UI highlights "Gathering Baseline Data" rather than guessing root causes.

### 3. Database Connection Failures
- **Risk:** Intermittent local SQLite / PostgreSQL socket loss.
- **Mitigation:**
  - SQLAlchemy Async connection pool recycling with pre-ping validation.

### 4. Malformed LLM Outputs
- **Risk:** LLM outputs JSON that fails Pydantic schema validation.
- **Mitigation:**
  - Self-healing repair parser: Pass validation error message back to model once for auto-correction, or fall back to rule-based fallback model if second attempt fails.
