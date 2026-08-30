# Agent Architecture Requirements

## Agent Topology
To ensure maximum reliability and transparency, RETAINAI uses a **Focused Single Orchestrator + Specialized Execution Modules** architecture:

$$\text{Orchestrator} \longrightarrow \begin{cases} \text{Evidence Retrieval Service (Deterministic)} \\ \text{Signal Analytics Service (Deterministic)} \\ \text{Investigation Agent (LLM)} \\ \text{Action Plan Agent (LLM)} \\ \text{Memory & Learning Engine (Hybrid)} \end{cases}$$

## Agent Requirements
- **AG-001 (P0):** The Orchestrator MUST drive the full lifecycle state machine:
  `SIGNAL_DETECTED -> INVESTIGATING -> ACTION_RECOMMENDED -> APPROVED -> EXECUTING -> OUTCOME_PENDING -> EVALUATED -> LEARNED`.
- **AG-002 (P0):** Investigation Agent MUST receive structured JSON telemetry from the Evidence Retrieval Service and output a structured `InvestigationReport`.
- **AG-003 (P0):** Action Strategy Agent MUST receive the `InvestigationReport` and matched `ExperienceMemory` entries to produce a structured `RetentionPlan`.
- **AG-004 (P0):** Learning Engine MUST trigger 14 days (or simulated step) post-intervention to calculate outcome impact and convert successful rescues into `ValidatedExperience`.
