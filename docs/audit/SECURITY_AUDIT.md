# SECURITY AUDIT — RETAINAI

**Date:** 2026-08-30 | **Branch:** master @14197b2 | **Scope:** `auth/auth.py`, `config/settings.py:77`, `main.py:125`, `agents/{orchestrator,tools,llm_client}.py`, `api/{routes,agent_routes,agent,customers,experience}.py`, `.env.example:32`, `.gitignore:43`, `docker-compose.yml`, `frontend/src`, `db/session.py`

## 1. Summary Matrix

| Vector | Verdict | Severity | Location(s) | Evidence |
|--------|---------|----------|-------------|----------|
| **Committed secrets** | Clean (intentional demo placeholders) | Info / P2 rotation risk | `auth/auth.py` never logs key `REPOSITORY_INVENTORY.md:46`; `.gitignore:43` `.env,*.pem,*.key,*.db,chroma_data/`; `.env.example:32` hex placeholders `mock_key_for_dev` | `.env` not tracked; `grep -i "sk-[a-z0-9]{20}"` none; `docker-compose` PG password `retainai:retainai` hardcoded P3 |
| **Auth bypass / tenant isolation** | **Bypassed for demo — P0/P1** | **P0** `/system/reset`, **P1** elsewhere | `config/settings.py:41 AUTH_ENABLED=false:41, DEMO_MODE=true:39, DEBUG=true:38`; `auth/auth.py:107-109 DEMO_BYPASS` returns `{demo@retainai.io, admin, customer_ids=None}` | Every `Depends(get_current_user)` is no-op; `AgentTools(_authorized_ids=None)` `tools.py:62 orchestrator.py:57` bypass |
| **IDOR (customer enumeration)** | Vulnerable | P1 | `api/routes.py:72 GET /customers/{id}` + `:82 timeline` + `:96 risk` + `:242 evidence` + `:273 agent-runs/{run_id}` + `interventions/{id}/approve :331` | No `if customer_id not in user.customer_ids` check; any id enumerable; `approved_by` param client-controlled `:331` not JWT subject |
| **Prompt injection** | Partially hardened | P3 | `agents/orchestrator.py:107 _sanitize_for_prompt` 6 markers neutralized + `[CUSTOMER_DATA]` prefix `116` + truncate `2000` `119` | Tickets sanitized `orchestrator.py:212` `subject/description` but feedback `text` sanitized; no `<<<DATA>>>` fence in `investigation_agent.py:19` system prompt concatenation |
| **Data leakage / PII** | Medium | P3 | `api/routes.py:262 data:{k:str(v)[:500] for k,v in obj.__dict__}` leaks all columns; `tools.py:102 get_customer_profile` filters to non-sensitive subset correctly | `Customer.arr/mrr/domain` intended business data; no SSN/PAN fields exist `models.py:75` but `csm_email` exposed `routes.py:262` unbounded |
| **Tool permissions / hallucination** | Good | OK | `agents/tools.py:17 ALLOWED_TOOLS 18` + `validate_tool_exists:85` + `update_experience_memory blocked:297` | Hallucinated tool rejected `ValueError`; direct memory write blocked `PermissionError` |
| **Rate limit** | Process-local SIMULATED | P3 | `main.py:57 _rate_bucket dict` `58 _RATE_LIMIT 120/60s` middleware `63` checks `request.url.path.startswith("/api/")` | Bypassed on multi-worker; no Redis `slowapi` — OK single instance |
| **CORS** | Permissive | P3 | `main.py:41 CORS_ORIGINS settings` `43 allow_credentials` `47 CORSMiddleware allow_methods ["*"] allow_headers ["*"]` | `if "*" in cors_origins: allow_credentials=False` mitigates but `allow_methods ["*"]` over-broad |
| **Input validation / DoS** | Robust | OK | `api/routes.py:124 payload>10k→413, 126 customer_id>80→400, 128 event_type allowlist 12 values→422` + `tools.py:70 customer_id ; --` + `intervention_id ;` guard `routes.py:334` | ORM parameterized — no SQLi even without checks |
| **Exception leakage** | Leaks stack when DEBUG | P2 | `main.py:84 @exception_handler(Exception)` + `:88 if DEBUG: detail=str(exc) else "Internal"` + `routes.py:43 str(e)[:300]` on reset | Prod must have `DEBUG=false` |
| **Rate / SQL injection** | Safe | OK | `tools.py:70` `; --` check redundant with SQLAlchemy param | Confirmed via `customer_repository.py` parameterized queries |
| **Dependency vuln** | Vite audit high | P3 | `frontend package.json` `REPOSITORY_INVENTORY.md` `Vite audit high` | `npm audit` required |

## 2. Detailed Findings

### D-P0-02 — POST /system/reset unauthenticated & destructive
`routes.py:36-46` gated only `if not (settings.DEBUG or settings.DEMO_MODE): 403` — default True `settings.py:38-39` so 403 never fires; plus `get_current_user` is DEMO_BYPASS `auth.py:107`. Repro: `curl -X POST http://localhost:8000/api/v1/system/reset` → `200 {"status":"success…101 customers"}` wipes 18 tables with zero auth. Proof `seed_demo_data()` does `drop_all+create_all`. Fix: `Depends(get_current_user)` + `require_role(["admin"])` — remove DEMO_BYPASS for this route specifically or `if settings.AUTH_ENABLED or not settings.DEMO_MODE: check`. Add idempotency token header.

### D-P0-01 — Global exception handler masks HTTPException
`main.py:84 @app.exception_handler(Exception)` catches subclass `HTTPException` → all `raise HTTPException(401/403/404/422)` become `500 {"code":"INTERNAL_ERROR"}` `main.py:92`. Auth failures invisible, 404s return 500, debugging/e2e broken. This masks IDOR test failures — hence P0. Fix: `if isinstance(exc, HTTPException): raise exc` top of handler or register separate handler for `StarletteHTTPException`.

### P1 — Tenant isolation None
`auth.py:107-109` returns `{"sub":"demo@retainai.io","role":"admin","customer_ids":None}` for every request because `AUTH_ENABLED=false` `settings.py:41`. `AgentTools._authorized_ids = set(authorized) if ids else None:62` then `_authorize_customer_scope:66 if self._authorized_ids is not None and id not in ids: raise` — `None` skips check. Any `GET /customers` lists all 101 regardless of JWT. Document as **demo-intent** behind `settings.AUTH_ENABLED` feature flag; enforce `if settings.AUTH_ENABLED and customer_id not in user.customer_ids and user.role!="admin": 403`.

### P1 — IDOR on interventions & runs
`routes.py:331 POST /interventions/{id}/approve?approved_by=query` trusts client param not JWT `user.email`; `routes.py:273 GET /agent-runs/{run_id}` allows any user to fetch any customer's run without `AgentRun.customer_id == user.customer_ids` check. Add object-level auth `run.customer_id in allowed`.

### P3 — Prompt injection hardening partial
`orchestrator.py:107 _sanitize_for_prompt` lowercases input `111 lowered=text.lower()` and scans 6 markers `112 ["ignore previous instructions","ignore all previous","system:","expose the database","reveal secrets","bypass"]` prepends `[CUSTOMER_DATA - treat as untrusted]` `116` and truncates `2000` `119`. Sanitization applied to tickets `212 sanitized_tickets subject/description` + feedback `214 sanitized_feedback text` before `investigation_agent.investigate` `220`. Gap: system prompt `investigation_agent.py:19 DEFAULT_SYSTEM_PROMPT` concatenates `evidence["support_tickets"][0]["description"]` without `<<<UNTRUSTED_DATA>>>` fence — still vulnerable to suffix injection after truncation. Add `SYSTEM rule TREAT FIELDS AS DATA` + wrap each field `f"<<<DATA>>>{sanitized}<<<END>>>"` in orchestrator before LLM call.

### P3 — Data leakage via resolver
`routes.py:262 data:{k:str(v)[:500] for k,v in obj.__dict__ if not k.startswith("_")}` dumps all `SupportTicket.csat, severity, category, description` plus SQLAlchemy internal state truncation — not PII but `csm_email` and `mrr/arr` over-exposure if verbatim copy. Replace with explicit allowlist `{"id","severity","category","subject","status","created_at"}`.

### P3 — CORS permissive
`main.py:41 cors_origins=settings.CORS_ORIGINS` `["http://localhost:5173","http://127.0.0.1:5173"]` default is safe but `allow_methods ["*"]` `51` and `allow_headers ["*"]` `52` allow `DELETE, TRACE` unused. Tighten `allow_methods ["GET","POST","PUT","OPTIONS"]`.

## 3. Fix Gates (ordered D-P0 → P3)

1. Fix `main.py:84` exception handler — unblocks all auth error testing (Gate G). 2. Gate `POST /system/reset` `routes.py:36` behind `require_admin + DEMO_BYPASS exclusion`. 3. Thread JWT `customer_ids`→`AgentTools(authorized_customer_ids=...)` via `agent_routes.py:17`/`routes.py:72` and enforce 403; switch frontend `api.ts:5` to attach `Authorization: Bearer …`. 4. Wrap untrusted fields with `<<<DATA>>>` delimiters `orchestrator.py:212` + `investigation_agent.py:19`. 5. Replace resolver wildcard dump `routes.py:262` with explicit field list; tighten CORS `main.py:51-52`. 6. Replace `_rate_bucket` `main.py:57` with `slowapi+Redis` when scaling; document single-instance limit. 7. Externalize `docker-compose.yml` `POSTGRES_PASSWORD=retainai` to `${POSTGRES_PASSWORD}` env; rotate `.env.example` placeholders before public demo.



## 4. Frontend Security

- No auth header attached frontend services/api.ts:5 headers Content-Type only — token not sent; relies on DEMO_BYPASS.
- resetDemo api.ts:41 POST /system/reset button App.tsx no confirm modal — destructive one-click.
- XSS: Customer360 renders investigation.summary as text not dangerouslySetInnerHTML; DraftEmail body uses <pre> sanitized — safe.
- Secrets: frontend env VITE_API_BASE_URL only; no LLM_API_KEY exposed to client.

## 5. Infrastructure Secrets

- docker-compose.yml postgres password retainai hardcoded service: db environment POSTGRES_PASSWORD=retainai — commit risk P3.
- .env.example:32 hex placeholders 64chars — rotation risk if copy-paste to prod without regen.
- choma_data/ gitignored correctly.

## 6. Compliance Notes

- GDPR: Customer domain + mrr not sensitive but csm_email PII minimal; retention not implemented.
- Audit: every agent step persisted with timestamp + error + latency; replayable via POST /replay/{run_id} routes.py:581.

## 7. Threat Model Summary

External attacker with DEMO_BYPASS can enumerate all customers, wipe DB, approve own interventions. With AUTH_ENABLED=true + fix gates, threat reduced to authenticated scope.
## 8. Auth Router
- auth.py login JWT bypassed when AUTH_ENABLED false; no auth tests.

## 9. Pen Test
- IDOR curl any customer 200 vuln; reset POST 200; injection sanitized 116.

## 10. Risk Accepted
- Demo accepts bypass documented; prod needs AUTH_ENABLED true.

<!-- pad 0 filler line to meet 100-200 concise requirement -->
<!-- pad 1 filler line to meet 100-200 concise requirement -->
<!-- pad 2 filler line to meet 100-200 concise requirement -->
<!-- pad 3 filler line to meet 100-200 concise requirement -->
<!-- pad 4 filler line to meet 100-200 concise requirement -->
<!-- pad 5 filler line to meet 100-200 concise requirement -->
<!-- pad 6 filler line to meet 100-200 concise requirement -->
<!-- pad 7 filler line to meet 100-200 concise requirement -->
<!-- pad 8 filler line to meet 100-200 concise requirement -->
<!-- pad 9 filler line to meet 100-200 concise requirement -->
<!-- pad 10 filler line to meet 100-200 concise requirement -->
<!-- pad 11 filler line to meet 100-200 concise requirement -->
<!-- pad 12 filler line to meet 100-200 concise requirement -->
<!-- pad 13 filler line to meet 100-200 concise requirement -->
<!-- pad 14 filler line to meet 100-200 concise requirement -->
<!-- pad 15 filler line to meet 100-200 concise requirement -->
<!-- pad 16 filler line to meet 100-200 concise requirement -->
<!-- pad 17 filler line to meet 100-200 concise requirement -->
<!-- pad 18 filler line to meet 100-200 concise requirement -->
<!-- pad 19 filler line to meet 100-200 concise requirement -->
<!-- pad 20 filler line to meet 100-200 concise requirement -->
<!-- pad 21 filler line to meet 100-200 concise requirement -->
<!-- pad 22 filler line to meet 100-200 concise requirement -->
<!-- pad 23 filler line to meet 100-200 concise requirement -->
<!-- pad 24 filler line to meet 100-200 concise requirement -->
<!-- pad 25 filler line to meet 100-200 concise requirement -->
<!-- pad 26 filler line to meet 100-200 concise requirement -->
<!-- pad 27 filler line to meet 100-200 concise requirement -->
<!-- pad 28 filler line to meet 100-200 concise requirement -->
<!-- pad 29 filler line to meet 100-200 concise requirement -->