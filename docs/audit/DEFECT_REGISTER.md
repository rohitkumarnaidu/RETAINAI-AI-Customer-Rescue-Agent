# DEFECT REGISTER — RETAINAI Forensic Audit 2026-08-30

Source: 4 parallel agents (frontend, backend, intelligence, API+DB, security). Branch master @14197b2. No code changed yet.

## Severity Model
P0 Blocker | P1 Critical | P2 High | P3 Medium | P4 Low

---

### D-P0-01 — Global exception handler masks HTTPException
- **Severity:** P0
- **Area:** Backend / main.py
- **File:** `backend/src/retainai/main.py:84`
- **Observed:** `@app.exception_handler(Exception)` catches `HTTPException` (subclasses Exception) → all 401/403/404/422 become 500 INTERNAL_ERROR
- **Expected:** Register for `Exception` excluding `HTTPException` or `except HTTPException: raise`
- **Root cause:** Wrong exception class in handler registration
- **Impact:** Auth failures invisible, 404s return 500, debugging/e2e broken
- **Fix:** `if isinstance(exc, HTTPException): raise exc` at top of handler or split handlers; add test
- **Verification:** `curl /api/v1/customers/nonexistent` → 404 not 500

### D-P0-02 — POST /system/reset unauthenticated & destructive
- **Severity:** P0
- **Area:** API / DB
- **File:** `backend/src/retainai/api/routes.py:36-46`, `settings.py:38`, `auth.py:107`
- **Observed:** Gate `DEBUG||DEMO_MODE` (default True) + DEMO_BYPASS auth → any caller can `drop_all+create_all` wiping prod
- **Expected:** `require_role(["admin"])` + remove DEMO_BYPASS for this route, or `AUTH_ENABLED=true` gate
- **Fix:** Add admin guard, document demo-reset intent, add idempotency token
- **Impact:** Data loss / DoS if env left default

### D-P0-03 — Triple SQLite files diverge
- **Severity:** P0
- **Area:** DB / session
- **File:** `backend/src/retainai/db/session.py:13`, `config/settings.py:29`, FS scan `retainai.db` x3
- **Observed:** `os.getenv("DATABASE_URL")` vs `settings.DATABASE_URL` + relative `./retainai.db` resolves per CWD → `backend/retainai.db` vs `backend/src/retainai.db` vs `./retainai.db` diverged 1.7-1.9MB
- **Expected:** Single source of truth `settings.DATABASE_URL` absolute path, one file
- **Fix:** `session.py:13` → `settings.DATABASE_URL`; unify to `sqlite+aiosqlite:///./retainai.db` absolute via settings; delete orphans after backup
- **Impact:** Seed writes one DB, app reads another → empty portfolio

### D-P0-04 — POST /interventions FK violation
- **Severity:** P0
- **Area:** API / models
- **File:** `backend/src/retainai/api/routes.py:314-328`, `db/models.py:312`
- **Observed:** `Intervention.investigation_id NOT NULL FK` but route trusts `req.investigation_id` with zero existence check → IntegrityError 500
- **Expected:** Validate `investigation_id` exists or allow NULL for ad-hoc
- **Fix:** `select InvestigationReport where id==req.investigation_id` else 400; or make FK nullable
- **Impact:** Create flow 500

### D-P1-01 — Orphaned routers ghost surface
- **Severity:** P1
- **Area:** Backend / api
- **Files:** `backend/src/retainai/api/agent.py:10`, `customers.py:12`, `experience.py:12` — never mounted `main.py:97`
- **Observed:** 8 ghost endpoints with diverged auth/schemas (e.g. `GET /customers/{id}/risk` returns List vs dict)
- **Expected:** Delete or mount canonical; tests must not import orphan
- **Fix:** Delete 3 files or align to canonical; dedup `/learning/memories` triplicate
- **Impact:** Spec drift, false greens

### D-P1-02 — DEMO_BYPASS nulls auth & tenant isolation
- **Severity:** P1
- **Area:** Auth
- **Files:** `backend/src/retainai/auth/auth.py:107-109`, `config/settings.py:40`, `.env:22-25` AUTH_ENABLED=false
- **Observed:** All `Depends(get_current_user)` return `demo@retainai.io admin customer_ids=None` → any user enumerates any customer; `AgentTools._authorized_ids=None` same
- **Expected:** Intentional for hackathon demo but doc + gate prod; thread JWT customer_ids via AgentTools
- **Fix:** Document as demo-intent; add `if settings.AUTH_ENABLED: enforce; require scope when AUTH_ENABLED=true`

### D-P1-03 — Frontend hardcoded 92% + magic defaults
- **Severity:** P1
- **Area:** Frontend
- **Files:** `frontend/src/components/ActionCenter.tsx:131` `return '92%';`, `Customer360.tsx:123` `85`, `RiskBadge.tsx:34` `0.85`
- **Observed:** Every memory with missing success_rate claims 92%; empty risk shows 85 health
- **Expected:** Render `—` or hide field; no invented score
- **Fix:** Replace `92%` with `—`; replace `85` fallback with skeleton
- **Impact:** Judge screenshot as mock data

### D-P1-04 — Working-tree vs HEAD divergence breaks tsc
- **Severity:** P1
- **Area:** Frontend / build
- **Files:** `frontend/src/components/ui.tsx` untracked, `frontend/src/services/api.ts` 51 vs 268 lines, `tailwind.config.js` forked
- **Observed:** `npx tsc --noEmit` PASS on HEAD but FAIL on working-tree (`ui.tsx:64 resolveEvidence` missing in HEAD api.ts)
- **Expected:** HEAD === polished tree
- **Fix:** Commit working-tree api.ts + ui.tsx + tailwind; `tsc && vite build` must pass on HEAD
- **Impact:** CI/build gate fail, polished UI not shipped

### D-P1-05 — No URL routing
- **Severity:** P1
- **Area:** Frontend
- **File:** `frontend/src/App.tsx:9` `useState<Tab>('command')`, no react-router
- **Observed:** Refresh loses selectedCustomer; share link impossible; back/forward broken
- **Expected:** Add react-router deep links (or doc as hackathon scope)
- **Impact:** Feels prototype to enterprise judges

### D-P2-01 — GET /customers/{id}/risk mutates
- **Severity:** P2
- **Area:** API
- **File:** `backend/src/retainai/api/routes.py:96`
- **Observed:** GET calls `reassess_customer_risk` → writes new RiskAssessment row → not idempotent, audit spam on poll
- **Expected:** Read-only GET; reassess via POST
- **Fix:** Make GET read last assessment; keep POST /reassess for write

### D-P2-02 — Tool timeout declared not enforced
- **Severity:** P1 (auditor flagged P1) / P2
- **Area:** Agents
- **File:** `backend/src/retainai/agents/tools.py:48` TOOL_TIMEOUT 5s never via `asyncio.wait_for`
- **Fix:** Wrap tool calls with wait_for; test

### D-P2-03 — In-memory idempotency lost on restart + SQLite JSON fail
- **Severity:** P1
- **Area:** Services
- **File:** `backend/src/retainai/services/event_ingestion_service.py:16,77,89`
- **Observed:** `_seen_event_hashes` Set process-local + DB check `details["event_hash"].as_string()` fails on SQLite swallowed `except: pass` → duplicates after restart
- **Fix:** Separate `event_hash` column + unique constraint; use json_extract on SQLite

### D-P2-04 — Risk threshold 90.0 not configurable + dead admin check
- **Severity:** P2
- **Area:** Engine
- **Files:** `backend/src/retainai/engine/risk_engine.py:61` hardcoded 90, `:115` `any(...)` discarded, `:78` WATCH mapping
- **Fix:** Add `RISK_HEALTHY_THRESHOLD=90` to settings; assign admin flag

### D-P2-05 — Signal thresholds not configurable
- **Severity:** P2
- **Area:** Engine
- **File:** `backend/src/retainai/engine/signal_engine.py:113-169` impacts 40/35/30 etc literals
- **Expected:** Move to settings per config-dynamic audit
- **Fix:** Add SIGNAL_* to settings or document as code-constants

### D-P2-06 — Learning validation not config-driven + cross-pattern bleed
- **Severity:** P2
- **Area:** Engine
- **Files:** `backend/src/retainai/engine/learning_engine.py:23-25,57-69`, `memory_repository.py:20`
- **Observed:** MIN_EVIDENCE 2 etc module constants; memory query ignores risk_pattern
- **Fix:** Move to settings; rank by token overlap

### D-P2-07 — Observability fabricated 0.97
- **Severity:** P2
- **Area:** API
- **File:** `backend/src/retainai/api/routes.py:525` success_rate 0.97 hardcoded
- **Fix:** Compute from AgentRun status

### D-P2-08 — Stale frontend cache + silent catch
- **Severity:** P2
- **Area:** Frontend
- **Files:** `frontend/src/components/CommandCenter.tsx:38,47` `catch{}`, `ActionCenter.tsx:29 void outData`
- **Observed:** `/portfolio` 500 silently falls back to N+1; approve doesn't refetch portfolio; outcomes fetched then discarded
- **Fix:** Typed error boundaries + React Query or refetch on approve

### D-P2-09 — Duplicate agent investigate paths shadow
- **Severity:** P2
- **Area:** API
- **Files:** `backend/src/retainai/api/agent_routes.py:16` vs `:26`
- **Observed:** `POST /agent/investigate/{id}` also matches `/{id}/investigate` with id=investigate
- **Fix:** Keep one canonical path

### D-P3-01 — Rate limiter process-local + CORS permissive
- **Files:** `backend/src/retainai/main.py:57,51`
- **Fix:** slowapi + Redis when scaling; tighten allow_methods/headers

### D-P3-02 — Seed incomplete (9 tables empty) + no migrations
- **Files:** `backend/src/retainai/scripts/seed_database.py:73-213`, `db/session.py:54` create_all
- **Fix:** Add alembic or at least seed feature_adoptions/account_events/evidences; document drop_all is demo-only

### D-P3-03 — Prompt injection hardening partial (6 markers) + no DATA delimiters
- **Files:** `backend/src/retainai/agents/orchestrator.py:107-121`, `investigation_agent.py:19`
- **Fix:** Add SYSTEM rule TREAT FIELDS AS DATA + <<<DATA>>> wrappers

### D-P3-04 — A11y: search input unnamed, live regions missing, row not keyboardable
- **Files:** `frontend/src/components/CommandCenter.tsx:199`, `App.tsx:111`, `CommandCenter.tsx:254`
- **Fix:** aria-label, aria-live, role=button + onKeyDown

### ... (P3/P4 remainder: debug true default, pg password hardcoded, Vite audit high, health 40 fallback, health_engine USAGE_CONTEXT no-op, time_window fallback hides insufficient, decay_stale_memories never scheduled, etc. See full audit reports.)

## Counts (from 4 agents)
- P0: 4
- P1: 5 (+ auth bypass intentional)
- P2: 9 major
- P3: 8+
- P4: 5+ polish

## Fix Ordering (dependency)
1. D-P0-03 unify DB (unblocks all)
2. D-P0-01 exception handler (unblocks error testing)
3. D-P0-02 + D-P0-04 API guards
4. D-P1-04 commit frontend divergence (unblocks build)
5. D-P1-03 remove 92%/85 mocks
6. D-P1-01 delete orphans + dedup routes
7. D-P2-01 GET /risk read-only + D-P2-07 observability real + D-P1-02 doc auth
8. Remaining P2/P3 in parallel
