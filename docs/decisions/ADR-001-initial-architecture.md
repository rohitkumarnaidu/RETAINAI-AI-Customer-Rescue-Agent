# ADR-001: Initial System & Agent Architecture

- **Status:** Approved
- **Date:** 2026-08-30
- **Context:** BuildSprint 2026 Hackathon project for RETAINAI — The Autonomous Customer Rescue Agent.

## Decision
We adopt a **Monorepo Architecture** combining a **Python FastAPI backend (managed via uv)** and a **React + TypeScript + Vite + Tailwind CSS frontend**.

For AI and logic execution, we select a **Hybrid Architecture**:
1. **Deterministic Execution:** Health score calculation, 7-day vs 30-day usage deltas, threshold triggers, risk classification, database state machine, and tool validation are implemented in pure, testable Python code.
2. **Focused Agentic Reasoning:** LLM calls are strictly reserved for higher-order reasoning: synthesizing multi-source telemetry evidence, generating evidence-grounded diagnostic summaries, formulating personalized retention action plans, and extracting generalized rules into an Experience Memory Bank.
3. **Focused Orchestrator Pattern:** A single deterministic Python Orchestrator coordinates execution steps instead of using a loose multi-agent mesh.

## Rationale
- **Reliability:** Pure deterministic logic guarantees reproducible health scores and eliminates hallucinated calculations.
- **Hackathon Demo Quality:** Concentrating LLM calls on high-value synthesis ensures predictable latency and complete demo stability.
- **Auditability:** Every AI conclusion is anchored to specific database event IDs (`ticket_id`, `usage_event_id`, `feedback_id`).

## Alternatives Considered
1. **Pure LLM Multi-Agent Framework (e.g. CrewAI / AutoGen swarm):** Rejected due to non-deterministic execution paths, high latency, prompt drift, and difficult debugging during demo.
2. **Traditional Pure Static Analytics Dashboard:** Rejected because it lacks autonomous investigation, root-cause reasoning, next-best action generation, and closed-loop learning.

## Trade-offs & Mitigations
- *Trade-off:* Hybrid architecture requires explicit Pydantic schema definitions and tool contracts.
- *Mitigation:* Clear separation of concerns makes unit and integration testing straightforward with `pytest`.
