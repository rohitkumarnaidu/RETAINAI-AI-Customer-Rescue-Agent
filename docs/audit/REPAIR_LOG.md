# REPAIR LOG — 2026-08-30

All repairs verified with `pytest 31 passed` + `tsc --noEmit` + `vite build` + E2E `succeed`.

| ID | Severity | File | Fix | Verification |
|---|---|---|---|---|
| D-P0-01 | P0 | `backend/src/retainai/main.py:84` | Exception handler now re-raises HTTPException (404/401/422 preserved) | `TestClient GET /customers/nonexistent → 404` (was 500) |
| D-P0-03 | P0 | `backend/src/retainai/db/session.py:13` | DATABASE_URL now single source via `settings.DATABASE_URL` (fixes triple .db divergence) | `pytest 31 passed`, `TOTAL 101` via AsyncSessionLocal |
| D-P0-04 | P0 | `backend/src/retainai/api/routes.py:314` | POST /interventions validates investigation_id FK → 400 if not found | Manual + `pytest` green |
| D-P1-03 | P1 | `frontend/src/components/ActionCenter.tsx:131` | `92%` → `—` (no fabricated rate) | `tsc && vite build` OK |
| D-P2-01 backend | P2 | `backend/src/retainai/config/settings.py:65`, `engine/risk_engine.py:61` | Added `RISK_HEALTHY_THRESHOLD=90.0`, removed hardcoded 90 | `pytest 31 passed`, risk mapping tested |
| D-P2-02 | P2 | `backend/src/retainai/api/routes.py:501-547` | Observability 0.97 fabricated → computed from AgentRun/AgentStep actual success_rate | `TestClient GET /metrics/observability` returns real rate |
| D-P2-03 | P2 | `backend/src/retainai/engine/health_engine.py:40` | USAGE_CONTEXT -35 now correctly adjusts health (was no-op) | `pytest 31 passed`, health 100 clamp verified |
| D-P2-04 | P2 | `backend/src/retainai/engine/risk_engine.py:115` | Dead `any(...)` now assigned `has_admin_inactivity` | `pytest` + no linter B018 |
| D-P3-A11Y-01 | P3 | `frontend/src/components/CommandCenter.tsx:42,128,147` | Added aria-live, aria-label, role=button+tabIndex+onKeyDown | `tsc --noEmit` OK |
| D-P3-A11Y-02 | P3 | `frontend/src/components/Customer360.tsx:73,75,91,120` + `RiskBadge.tsx:5` | Magic 85 → null + `—` placeholder, risk fallback documented | `vite build 281kB` OK |

**Parallel sub-agents used:** 2 backend + 2 frontend agents in parallel for audit, 2 repair agents parallel (backend engines + frontend a11y). All repairs minimal, no over-refactor.

**Remaining known limitations (not repaired — documented P2/P3):**
- Triple .db files still exist on disk (unified via settings going forward; manual cleanup `rm backend/src/retainai.db` recommended before demo)
- Orphaned routers `api/agent.py` etc. retained as dead code (not mounted) — deletion deferred to avoid test mis-import; documented in API audit
- GET /customers/{id}/risk still mutates (intentional demo SENSE→THINK fast-path; POST /reassess is canonical; doc as known)
- Seed leaves 9 tables empty (feature_adoptions etc.) — not seeded by design for demo; agent falls back to INSUFFICIENT_EVIDENCE correctly
- In-memory dedup `_seen_event_hashes` still process-local (P1) — noted for production Redis
- Rate limit still in-memory — noted

**Regression status:** Full `pytest 31 passed` after each batch, frontend `tsc && vite build` green, E2E `Acme health 48.9 AT_RISK → investigate 6 evidences → approve → SUCCESS → candidate created` verified.
