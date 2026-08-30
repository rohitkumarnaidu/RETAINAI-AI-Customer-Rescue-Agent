# AI & Model Requirements Specification

## AI System Principles
1. **Deterministic / AI Separation:** Numerical risk scoring, event delta calculations, thresholds, and state transitions MUST be executed in deterministic Python code. LLMs MUST NOT perform basic arithmetic.
2. **Strict Schema Output:** All LLM outputs MUST conform to strict JSON schemas validated via Pydantic models.
3. **Grounding in Evidence:** LLMs MUST NOT generate claims without citing specific dataset event IDs (`ticket_id`, `usage_event_id`, `feedback_id`).
4. **Honest Uncertainty:** When data is sparse or conflicting, the AI model MUST output confidence levels (`HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT_EVIDENCE`).

## AI Functionalities
- **AI-001 (P0):** Investigation Agent MUST synthesize heterogeneous events into a cohesive account diagnostic narrative.
- **AI-002 (P0):** Action Strategy Agent MUST match root causes and account context with appropriate retention strategies.
- **AI-003 (P0):** Learning & Reflection Agent MUST analyze post-intervention health deltas and extract generalized, reusable rules into Experience Memory.

## Model Strategy
- Primary LLM: Fast multi-modal model (e.g., Gemini 2.5 Flash / Claude 3.5 Sonnet / OpenAI GPT-4o-mini).
- Fallback Strategy: Structured deterministic heuristic templates if LLM service is unavailable during demo mode.
