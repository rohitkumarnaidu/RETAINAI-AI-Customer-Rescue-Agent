# Model Strategy — RETAINAI

## LLM Provider Selection
For BuildSprint 2026, RETAINAI uses **Gemini 2.5 Flash** (or configured Claude 3.5 Sonnet / OpenAI GPT-4o-mini) as its primary LLM engine.

## Rationale
- Fast response time (< 1.5 seconds latency for structured JSON synthesis).
- Strong instruction following for strict JSON schemas.
- High context window permitting ingestion of 90-day multi-source telemetry logs.

## Fallback Mechanisms
If the primary LLM provider fails or times out:
1. Retries up to 2 times with 1-second delay.
2. Falls back to a **Deterministic Rules-Based Synthesis Engine** that maps health signal vectors directly to pre-structured template outputs, ensuring 100% demo uptime.
