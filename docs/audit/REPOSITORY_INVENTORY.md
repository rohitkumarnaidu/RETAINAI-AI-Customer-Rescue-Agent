# REPOSITORY INVENTORY
Generated 2026-08-30 via parallel forensic agents. Root: `C:\Hackathons\Latent Code\RETAINAI - AI Customer Rescue Agent`

## File Counts
- `backend/src/retainai` — 46 .py files (incl. __pycache__)
- `backend/tests` — 14 test files, 34 defs
- `frontend/src` — 8 HEAD files + 1 untracked `ui.tsx`, + nginx.conf/Dockerfile
- `docs` — 32 md files + `docs/audit` 22 data-audit files

## Module Table
| Area | Location | Purpose | Dependencies | Runtime Used | Tested | Status |
|---|---|---|---|---|---|---|
| Frontend boot | `frontend/src/main.tsx:1-10`, `App.tsx:1-138`, `index.css` | 3-tab manual router (command/customer360/actions), reset demo | React 18, Vite 5, axios | Yes | No | P1 divergent: working-tree 7-tab vs HEAD 3-tab |
| Frontend services | `frontend/src/services/api.ts:1-268 HEAD` vs `working-tree 51-line min` | axios singleton 15 thunks, 14 interfaces | axios | Yes | No | P2 drift: resolveEvidence only in working-tree |
| Frontend components | `frontend/src/components/{CommandCenter,Customer360,ActionCenter,RiskBadge}.tsx` + `ui.tsx` untracked | Portfolio table, 360 workspace, learning loop, pills | lucide-react | Yes | No | P3 fallback literals 85/92% + stale cache |
| Backend app | `backend/src/retainai/main.py` | FastAPI lifespan init_db, CORS, rate-limit, request-id, exception handler, /health /readiness | fastapi, uvicorn | Yes | `test_main.py:7,14` | P0 exception handler masks HTTPException:84 |
| Backend API canonical | `backend/src/retainai/api/routes.py:33` (33 endpoints) | Single source of truth | fastapi, sqlalchemy | Yes | `test_api_routes.py:32-65` | P0 GET /risk mutates |
| Backend API agent | `backend/src/retainai/api/agent_routes.py:13` (4 endpoints) | /agent/investigate + runs + replay | orchestrator | Yes | `test_acme_replay.py` | P2 duplicate paths shadow |
| Backend API orphaned | `backend/src/retainai/api/agent.py:10` (1), `customers.py:12` (4), `experience.py:12` (3) | Ghost duplicates diverged auth/schemas | — | NO never mounted `main.py:97` | Misleading | P1 delete or align |
| Auth | `backend/src/retainai/auth/auth.py` | JWT + API-key + DEMO_BYPASS | pyjwt, passlib/bcrypt | Bypassed `AUTH_ENABLED=false` | None | P1 tenant isolation None |
| DB models | `backend/src/retainai/db/models.py:530` 18 tables | Customer, usage, tickets, feedback, risk, evidence, reports, interventions, outcomes, memories, agent runs/steps, logs | sqlalchemy | Yes | via repositories | P1 FK missing on candidates/logs, seed incomplete |
| DB session | `backend/src/retainai/db/session.py` | AsyncEngine sqlite WAL, PRAGMA FK, get_db | aiosqlite | Yes | — | P2 dual DATABASE_URL sources |
| DB seed | `backend/src/retainai/scripts/seed_database.py` vs `scripts/seed_database.py` stub | Seeds 101 customers + telemetry + 1 memory | — | Yes (`drop_all+create_all`) | — | P1 destructive no alembic; 9 tables never seeded |
| DB repos | `backend/src/retainai/repositories/*` | Customer, telemetry, intervention, memory | sqlalchemy | Yes | `test_repositories_and_services.py:20,33,63` | Clean parameterized |
| Services | `backend/src/retainai/services/{customer,signal,timeline,event_ingestion,intervention}_service.py` | Reassess, signals, timeline, dedup | engines, repos | Yes | Indirect | P1 in-mem dedup lost on restart; JSON dedup fails on SQLite |
| Engines | `backend/src/retainai/engine/{health,risk,signal,time_window,learning}_engine.py` | Pure deterministic | settings | Yes | `test_health_and_risk.py`, `test_signal_engine.py`, `test_time_window.py`, `test_learning_validation.py` | P2 thresholds not all configurable; dead admin check |
| Agents | `backend/src/retainai/agents/{orchestrator,investigation_agent,action_agent,tools,llm_client}.py` | Rescue workflow 8 iter/60s bounded | httpx gemini | Yes (mock default `mock_key_for_dev`) | `agents/test_*.py` | P2 tool timeout declared not enforced; state warn-only |
| Integrations | `backend/src/retainai/integrations/{adapters,chroma_memory}.py` | Demo adapter + 8-dim SHA256 hash embed fallback | chromadb optional | Fallback dict | — | P3 non-semantic embed |
| Demo | `backend/src/retainai/demo/acme_replay.py` | 4-step acme health→friction→recovery | — | Via agent_routes | `test_acme_replay.py:16,29` | P4 hardcoded health_before 40 |
| Config | `backend/src/retainai/config/settings.py` | Weights 0.4/0.3/0.2/0.1, risk 20/40/60/80 (no 90), LLM 10s, rate 120/60 | pydantic-settings | Yes | Indirect | P2 missing RISK_HEALTHY_THRESHOLD |
| Tests | `backend/tests` 14 files 34 defs | Unit/integration/API/agent/DB | pytest-asyncio | — | — | P3 gaps: no auth/injection/IDOR |
| Infra | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `nginx.conf`, `Makefile` | Local + docker postgres option | — | — | — | P3 hardcoded pg password; 3 .db files diverge |

## Dead Code / Duplicates
- Orphaned routers 3 files; `GET /learning/memories` vs `/experience-memory` triplicate; `GET /risk` List vs dict; `InterventionOutcome.status/outcome/evaluation_status` triple; `ExperienceMemory.pattern/context_pattern` dup; `UsageEvent` 5 redundant counters.
## Hardcoded Inventory (grep)
- Frontend: `92%` @ ActionCenter:131, `85` @ Customer360:123, `acme` substring pin @ CommandCenter:68/82, `setTimeout 1000` @ App:26
- Backend: `90.0` @ risk_engine:61, impact scores 40/35/30 etc @ signal_engine, `MIN_SAMPLE_SIZE 2` @ learning_engine:25, `MAX_ITER 8` @ orchestrator:28, `HEALTHY 40.0` fallback @ learning_engine:313
- No `if risk > 70` or `customer == "Acme"` in engines — clean; mock sentinel `mock_key_for_dev` intentional.

## Mocks / Stubs
- `llm_client.py:37` mock gate honest (logs mock, returns fallback); not masquerading.
- `chroma_memory.py:74` in-mem dict fallback when chromadb missing — documented synthetic.
- No `mock arrays` in frontend; no `Math.random()`.

## Secrets Scan
- `.env` not tracked, `.gitignore:43` covers `.env, *.pem, *.key, *.db, chroma_data/`. `.env.example:32` hex demo secrets — rotation risk P2. `docker-compose pg password retainai` hardcoded P3. `llm_client` never logs key.
