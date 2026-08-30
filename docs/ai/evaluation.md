# AI Evaluation Strategy — Benchmark & Quality Metrics

## Evaluation Criteria for Hackathon Validation

1. **Schema Adherence Rate:** % of LLM outputs that parse successfully against Pydantic models on first attempt (Target: > 98%).
2. **Evidence Precision:** % of cited `evidence_ids` in `InvestigationReport` that exist in input data (Target: 100%, 0 hallucinated IDs).
3. **Execution Latency:** Average end-to-end investigation & action plan pipeline latency (Target: < 2.5 seconds).
4. **Outcome Learning Rate:** Ability of Experience Memory Bank to accurately capture positive vs. negative health deltas post-intervention.

## Automated Evaluation Test Suite
Implemented in `backend/tests/agents/test_investigation_agent.py` using synthetic test scenarios (`data/scenarios/`).
