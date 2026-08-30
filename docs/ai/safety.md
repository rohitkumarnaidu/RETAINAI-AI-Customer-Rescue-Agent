# AI Safety & Guardrails Strategy

## Safety Measures

1. **Prompt Injection Mitigation:** All user-supplied inputs (customer feedback text, support ticket descriptions) are sanitized and escaped before string interpolation into LLM prompts.
2. **Secrets Protection:** LLM API keys are loaded via Pydantic BaseSettings from `.env` and NEVER passed into model context or output logs.
3. **No Unrestricted Execution:** The agent CANNOT send real emails, issue live credits, or change billing states without explicit human CSM approval (`PENDING -> APPROVED` UI flow).
4. **Data Privacy:** All customer data in demo scenarios is synthetic and contains no PII or real client identities.
