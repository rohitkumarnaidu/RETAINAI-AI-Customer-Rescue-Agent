# RETAINAI — Live Hybrid Deployment End-to-End (No Mock, Dynamic)

> **Branch:** `deploy/hybrid-live-dynamic` (live LLM, Groq `openai/gpt-oss-120b`, no `mock_key_for_dev`)
> **Primary:** Render Backend + Vercel Frontend (Hybrid A) + Optional HF Space Mirror
> **Status:** Local verified 101/3131/82/94/36 tests, frontend 376kB, live Groq dynamic 08-30-2026

---

## 0. Prerequisites

| Need | Value | Where |
|------|-------|-------|
| Git branch | `deploy/hybrid-live-dynamic` | `git checkout deploy/hybrid-live-dynamic` |
| Groq key | `gsk_your_groq_key_here` (or yours) | `.env` `GROQ_API_KEY`, Render/Vercel/HF Secrets |
| GitHub repo | `rohitkumarnaidu/RETAINAI-AI-Customer-Rescue-Agent` | `git remote get-url origin` |
| Node 20+ / Python 3.12 / uv | Local | `node -v`, `uv --version` |
| Accounts | Vercel, Render, HF (for mirror) | Free tiers ok |

> **No mock in this branch:** `backend/src/retainai/config/settings.py:33` `LLM_API_KEY=""`, `llm_client.py:55` `is_mock` excludes `mock_key_for_dev`, fallback only last-resort.

---

## 1. Local Verify (Do Before Deploy)

```powershell
# 1.1 Checkout live branch
git fetch origin
git checkout deploy/hybrid-live-dynamic
git status --short # should be clean

# 1.2 Env — live Groq (do NOT commit .env, it is gitignored)
# Edit .env:
#   LLM_PROVIDER=groq
#   LLM_MODEL=openai/gpt-oss-120b
#   LLM_API_KEY=
#   GROQ_API_KEY=gsk_your_groq_key_here
# Keep demo tenant:
#   DEMO_TENANT_ID=tenant_demo_32char_id_12345678

# 1.3 Seed & verify DB
cd backend
uv run python -m retainai.scripts.seed_database
# expect: 101 customers, 3131 usage, 82 tickets, 94 feedbacks
uv run python -c "import asyncio; from sqlalchemy.ext.asyncio import create_async_engine; from sqlalchemy import text; async def c(): e=create_async_engine('sqlite+aiosqlite:///C:/Hackathons/Latent Code/RETAINAI - AI Customer Rescue Agent/backend/retainai.db'); async with e.connect() as conn: 
    for t in ['customers','usage_events','support_tickets','customer_feedbacks']: 
        print(t, (await conn.execute(text(f'SELECT count(*) FROM {t}'))).scalar())
    await e.dispose()
import asyncio; asyncio.run(c())"

# 1.4 Tests & build
uv run pytest tests -q # 36 passed
cd ../frontend; npm run build # vite 376kB ok

# 1.5 Live LLM smoke (no mock) — must return dynamic, not fallback
uv run python test_live_llm.py  # or: groq call via llm_client
# expect: Live response HIGH_CONFIDENCE evidence_ids ['TICK-101'...], fallback_used=False

# 1.6 Start backend + frontend + hit endpoints
cd backend; uv run uvicorn retainai.main:app --host 127.0.0.1 --port 8000
# New terminal:
Invoke-RestMethod http://127.0.0.1:8000/health # {"status":"ok"}
Invoke-RestMethod http://127.0.0.1:8000/api/v1/portfolio # 101
Invoke-RestMethod http://127.0.0.1:8000/api/v1/customers/b2a88551-82e5-43d7-b620-ba1640900c71/risk # 48.9 AT_RISK 6 signals (dynamic)
Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/v1/agent/investigate/b2a88551-82e5-43d7-b620-ba1640900c71 # run_b2a88..., ENGINEERING_ESCALATION...
cd frontend; npm run dev # http://127.0.0.1:5173 -> RETAINAI
```

---

## 2. Render Backend (Primary API)

### 2.1 Blueprint (already in repo: `render.yaml:1`)
```yaml
services:
  - type: web
    name: retainai-api-live
    runtime: docker
    rootDir: backend
    dockerfilePath: ./Dockerfile
    plan: starter
    branch: deploy/hybrid-live-dynamic
    autoDeploy: true
    healthCheckPath: /health
    envVars:
      - key: LLM_PROVIDER
        value: groq
      - key: LLM_MODEL
        value: openai/gpt-oss-120b
      - key: LLM_API_KEY
        sync: false
      - key: GROQ_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: DATABASE_URL
        value: sqlite+aiosqlite:///./retainai.db
      - key: CORS_ORIGINS
        value: https://retainai-rescue-agent.vercel.app,http://localhost:5173
      - key: DEMO_MODE
        value: true
      - key: AUTH_ENABLED
        value: false
```

### 2.2 Create via Dashboard (2 min)
1. Render → New → Blueprint → Connect `rohitkumarnaidu/RETAINAI-AI-Customer-Rescue-Agent` → branch `deploy/hybrid-live-dynamic` → Apply `render.yaml`
2. Or New → Web Service → Connect repo → Runtime Docker → Root `backend` → Dockerfile `./Dockerfile` → Plan Starter → Add Env vars above
3. **Secrets (Environment → Secret):** `GROQ_API_KEY=gsk_...` (your live key), `LLM_API_KEY=` (empty, uses GROQ alias), `OPENAI_API_KEY` if using OpenAI
4. Deploy → logs `Application startup complete. Uvicorn running on http://0.0.0.0:8000`
5. Verify:
```bash
RENDER=https://retainai-api-live.onrender.com
curl $RENDER/health # {"status":"ok"}
curl $RENDER/readiness # {"ready"}
curl $RENDER/api/v1/status # operational
curl -X POST $RENDER/api/v1/system/reset # seed
curl $RENDER/api/v1/portfolio | jq .metrics.total_customers # 101
curl -X POST $RENDER/api/v1/agent/investigate/b2a88551-82e5-43d7-b620-ba1640900c71 | jq .run_id
```
> Note: Render free tier sleeps after 15m. Add `cron-job.org` ping `GET $RENDER/health` every 10m to keep warm.

### 2.3 Docker Local Parity
```bash
docker compose up --build # backend 8000 + frontend 5173 + db 5433
docker compose ps # backend healthy (curl fixed in backend/Dockerfile:2)
curl http://localhost:8000/health
```

---

## 3. Vercel Frontend (Agent Access Link)

### 3.1 Config (already in repo: `vercel.json:1`, `frontend/.env.production.example:8`)
```json
{
  "framework": "vite",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
`frontend/src/services/api.ts:3` reads `import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'`

### 3.2 Dashboard Deploy (Recommended, 3 min)
1. Vercel → Add New Project → Import `rohitkumarnaidu/RETAINAI-AI-Customer-Rescue-Agent` → Framework Vite → Root `./` (uses `vercel.json`)
2. **Env Vars (Settings → Environment Variables):**
   - `VITE_API_BASE_URL` = `https://retainai-api-live.onrender.com/api/v1` (Render URL from §2) — **rebuild required** (Vite inlines at build)
   - Optional: `VITE_APP_NAME=RETAINAI`, `VITE_TENANT_ID=tenant_demo_32char_id_12345678`
3. Deploy → `https://retainai-rescue-agent.vercel.app` (or `retainai-xxx.vercel.app`)
4. Verify:
```bash
curl https://retainai-rescue-agent.vercel.app # 200, contains RETAINAI
# In browser: open Vercel URL → CommandCenter 101 → Acme Corp 48.9 AT_RISK → Run AI Investigation → 6 signals, evidence_ids, 3-step plan → Approve → SUCCESS
```

### 3.3 CLI Deploy (Alternative, no-auth fallback)
```bash
npm i -g vercel
vercel --version # 59.10.0

# Temporary anonymous deploy (no login, claimable)
vercel deploy --temporary -y
# Preview URL: https://retainai-xxx.vercel.app
# Claim URL: https://vercel.com/claim-deployment?code=...

# OR via deploy script (Codex sandbox, bash)
bash "/mnt/c/Users/Dell/.agents/skills/deploy-to-vercel/resources/deploy-codex.sh"
# or
bash ~/.claude/skills/deploy-to-vercel/resources/deploy.sh
# link later:
vercel link --repo --scope <team> # then git push triggers preview
```

> **CORS:** Render `CORS_ORIGINS` must contain `https://retainai-rescue-agent.vercel.app`. Update in Render dashboard if Vercel URL differs.

---

## 4. HF Space Mirror (Optional, 5 min)

### 4.1 Create Space
1. https://huggingface.co/new-space → Owner `YOUR_USERNAME` → Name `retainai-live-mirror` → SDK **Docker** → Create

### 4.2 Push
```bash
git clone https://huggingface.co/spaces/<USER>/retainai-live-mirror
cd retainai-live-mirror
cp -r "C:/Hackathons/Latent Code/RETAINAI - AI Customer Rescue Agent/hf_space/"* .
# hf_space/Dockerfile expects self-contained (pyproject.toml + src at Space root)
# Copy backend source if not using hf_space stub:
# cp -r "../RETAINAI - AI Customer Rescue Agent/backend"/* . # alternative

git add .
git commit -m "feat: RETAINAI HF mirror (hybrid-live-dynamic)"
git push
```

### 4.3 Secrets (Space Settings → Variables and secrets)
- `GROQ_API_KEY=gsk_...` **Secret**
- `LLM_PROVIDER=groq` Variable
- `LLM_MODEL=openai/gpt-oss-120b`
- `CORS_ORIGINS=https://retainai-rescue-agent.vercel.app,http://localhost:5173,https://<USER>-retainai-live-mirror.hf.space`
- `DEMO_MODE=true` `AUTH_ENABLED=false` `DATABASE_URL=sqlite+aiosqlite:///./retainai.db` (ephemeral) or `/data/retainai.db` for persistence

### 4.4 Verify Mirror
```bash
HF=https://<USER>-retainai-live-mirror.hf.space
curl $HF/health # {"status":"ok"}
curl $HF/api/v1/status
# Switch Vercel to mirror (optional): VITE_API_BASE_URL=$HF/api/v1 → Redeploy
```

See `docs/HF_SPACE_MIRROR.md:1` + `hf_space/README.md:1` for full runbook.

---

## 5. Credentials for Submission Form

```
Agent Access Link (Primary): https://retainai-rescue-agent.vercel.app
Backend API: https://retainai-api-live.onrender.com
Docs: https://retainai-api-live.onrender.com/docs
Mirror (Additional Materials): https://<USER>-retainai-live-mirror.hf.space

Login: admin@retainai.io / demo123
       csm@retainai.io / demo123
       viewer@retainai.io / demo123
Tenant: tenant_demo_32char_id_12345678
Header: X-Tenant-Id: tenant_demo_32char_id_12345678 (auto via frontend/src/services/api.ts:14)
JWT (if AUTH_ENABLED=true): use POST /auth/login first, else DEMO_MODE=true bypass
Acme hero: b2a88551-82e5-43d7-b620-ba1640900c71 / acmecorp.com / ARR 144000 / CSM Sarah Johnson
```

---

## 6. Verification After Deploy (Run 2-3 Times as Judges Will)

```bash
RENDER=https://retainai-api-live.onrender.com
FRONT=https://retainai-rescue-agent.vercel.app

# Backend live
curl $RENDER/health | jq
curl -X POST $RENDER/api/v1/system/reset | jq
curl $RENDER/api/v1/portfolio | jq .metrics.total_customers # 101
curl $RENDER/api/v1/customers/b2a88551-82e5-43d7-b620-ba1640900c71/risk | jq

# Agent dynamic (groq live, not fallback template)
curl -X POST $RENDER/api/v1/agent/investigate/b2a88551-82e5-43d7-b620-ba1640900c71 | jq '{run_id, intervention_id, investigation: .investigation.root_cause, plan: .retention_plan.title}'

# HITL + learning
IID=$(curl -s -X POST $RENDER/api/v1/agent/investigate/b2a88551-82e5-43d7-b620-ba1640900c71 | jq -r .intervention_id)
curl -X POST $RENDER/api/v1/interventions/$IID/approve?approved_by=Sarah%20Johnson | jq .status # APPROVED
curl -X POST $RENDER/api/v1/interventions/$IID/outcome -H "Content-Type: application/json" -d '{"health_before":48.9,"health_after":82,"usage_before":42,"usage_after":118}' | jq .status # SUCCESS delta 33.1

# Frontend
curl $FRONT | grep RETAINAI
# Browser: $FRONT → CommandCenter 101 → Acme → Investigate → Approve → Outcome → Action Center mem-001 VALIDATED 0.92
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `VITE_API_BASE_URL` change no effect | Rebuild Vercel (Vite inlines at build, `vercel.json` not runtime) |
| CORS error | Add Vercel origin to Render `CORS_ORIGINS` and HF `CORS_ORIGINS` |
| 401 on agent | Set `DEMO_MODE=true AUTH_ENABLED=false` for demo, or `POST /auth/login` with `admin@retainai.io/demo123` and `Authorization: Bearer <token>` + `X-Tenant-Id` |
| Groq 429 | Check `GROQ_API_KEY` valid, Render logs `Groq API returned HTTP 429`, upgrade Groq plan or lower concurrency (semaphore 4) |
| Render cold start 50s | Ping `GET /health` via cron-job.org every 10m |
| HF SQLite wiped | Use `/data/retainai.db` or Render Postgres primary |

---

## 8. Files in This Branch

- `render.yaml:1` Render Blueprint (hybrid-live-dynamic)
- `vercel.json:1` Vercel Vite SPA
- `frontend/.env.production.example:1` VITE wiring
- `hf_space/Dockerfile:1` + `app.py:1` + `README.md:1` + `docs/HF_SPACE_MIRROR.md:1` Mirror
- `backend/src/retainai/config/settings.py:33` live hardening + `docker-compose.yml:29` empty default + `backend/Dockerfile:2` curl + `llm_client.py:55` live gate

> All steps tested locally 08-30: `pytest 36 passed`, `vite 376kB`, live Groq dynamic `HIGH_CONFIDENCE` 7 evidence, `APPROVED→SUCCESS 33.1`.

