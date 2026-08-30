# RETAINAI — Security & Governance Architecture

## Security Controls & Policies

### 1. Environment Variable & Secret Protection
- Secrets, API keys (e.g. OpenAI, Anthropic, database connection strings) are stored strictly in environment variables (`.env`) and accessed via `pydantic-settings`.
- Zero hardcoded secrets in codebase or frontend bundles.

### 2. Tool Permissioning & Human-in-the-Loop Guardrails
- **Safe Read Tools:** `get_customer_profile`, `get_usage_history`, `get_support_history`, `get_customer_feedback`, `query_experience_memory` execute automatically.
- **Action Execution:** External emails, meeting invitations, and account setting changes **require explicit CSM authorization** (`status = APPROVED`) before execution.

### 3. Prompt Injection & Hallucination Defense
- System prompts isolate customer feedback text within XML tags (`<customer_feedback>...</customer_feedback>`) and instruct the LLM to treat internal content as raw data rather than system directives.
- Model outputs are validated via rigid Pydantic JSON schemas. Malformed outputs trigger fallback handling.

### 4. Data Privacy & Audit Trail
- All agent runs, tool calls, inputs, outputs, timestamps, and confidence scores are logged into `system_event_logs` and `agent_runs` for auditability and compliance.
