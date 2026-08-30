# Non-Functional Requirements Specification

## Reliability & Demo Stability
- **NFR-001 (P0):** The primary demo path MUST execute predictably without unhandled runtime exceptions or LLM connection failures during live replays.
- **NFR-002 (P0):** Deterministic mock fallbacks MUST exist for LLM provider timeouts or API rate-limit errors.

## Performance
- **NFR-003 (P0):** Health score computations and signal evaluation MUST complete within 50ms per account for offline batch processing.
- **NFR-004 (P0):** Agentic investigation and recommendation generation MUST return structured UI payloads within < 3 seconds when using cached/fast LLM inference.

## Security & Privacy
- **NFR-005 (P0):** No API keys, tokens, or credentials MUST ever be hardcoded or written to disk or logs.
- **NFR-006 (P0):** All environment secrets MUST be read via `.env` or system environment variables.
- **NFR-007 (P0):** Input schemas for API endpoints and LLM prompts MUST sanitize strings to mitigate prompt injection risks.

## Maintainability & Code Quality
- **NFR-008 (P0):** Backend code MUST be organized in modular packages (agents, intelligence, database, services, schemas).
- **NFR-009 (P0):** Backend dependencies MUST be locked and managed strictly via `uv` (`pyproject.toml` and `uv.lock`).
- **NFR-010 (P0):** Frontend code MUST pass TypeScript strict compilation checks without errors.
