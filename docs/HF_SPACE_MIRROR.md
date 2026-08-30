# HF Space Mirror — RETAINAI (deploy/hybrid-live-dynamic)

> **Purpose**: Document how to create and maintain a Hugging Face Space Docker mirror of the Render hybrid backend.
> Primary backend: Render `retainai-api-live` (Blueprint `render.yaml`, branch `deploy/hybrid-live-dynamic`).
> Mirror: HF Space `retainai-live-mirror` (Docker SDK, `hf_space/`).

---

## 1. When to Use the Mirror

| Scenario | Primary | Mirror |
|----------|---------|--------|
| Normal demo | Vercel → Render `retainai-api-live.onrender.com` | Standby |
| Render outage / cold-start | Switch `VITE_API_BASE_URL` to HF URL | Vercel → HF Space |
| Judge / offline demo (no Render) | HF Space public URL shareable | Direct |
| Disaster recovery | Promote HF Space to primary by updating Vercel env | — |

---

## 2. Create the Space (Step-by-Step)

### 2.1 Create Space on HF

1. Go to https://huggingface.co/new-space
2. Owner: your HF username/org (e.g. `latentcode`)
3. Space name: `retainai-live-mirror` (or `retainai-hybrid-live`)
4. SDK: **Docker** (not Gradio/Streamlit)
5. Hardware: CPU basic (free) — upgrade to CPU upgrade if needed for LLM latency
6. Visibility: Public (demo) or Private (gated)
7. Create → note the git remote: `https://huggingface.co/spaces/<USER>/retainai-live-mirror`

### 2.2 Push `hf_space/` to the Space

HF Spaces are git repos. Two options:

**Option A — Copy folder to Space clone (simplest)**

```bash
git clone https://huggingface.co/spaces/<USER>/retainai-live-mirror
cd retainai-live-mirror
# From your RETAINAI repo:
cp -r "C:/Hackathons/Latent Code/RETAINAI - AI Customer Rescue Agent/hf_space/"* .
# Or on Linux/macOS:
# cp -r /path/to/RETAINAI/hf_space/* .
git add .
git commit -m "feat: RETAINAI HF mirror (hybrid-live-dynamic)"
git push
```

**Option B — Add HF as second remote to existing repo**

```bash
cd "C:/Hackathons/Latent Code/RETAINAI - AI Customer Rescue Agent"
git remote add hf https://huggingface.co/spaces/<USER>/retainai-live-mirror
# Push only hf_space/ contents via subtree or manual copy to hf branch
git subtree push --prefix hf_space hf main
# Or maintain a hf-mirror branch that mirrors backend + hf_space stub
```

> **File layout expected at Space root**:
> ```
> Dockerfile   ← from hf_space/Dockerfile (HF expects ./Dockerfile at root)
> app.py       ← from hf_space/app.py
> README.md    ← from hf_space/README.md (HF card; sdk: docker)
> ```

If your Space build fails with `COPY ../backend/...`, adjust `hf_space/Dockerfile` to be self-contained:
- Either keep `backend/` alongside at Space root (`cp -r backend backend` before push)
- Or use the self-contained variant below (no `../backend`):

```dockerfile
# Self-contained fallback (if pushing only hf_space/):
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock* README.md ./
COPY src ./src
COPY app.py ./app.py
RUN uv sync --frozen || uv sync
ENV PORT=7860
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:${PORT}/health || exit 1
CMD ["sh","-c","uv run uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
```

### 2.3 Configure Secrets (HF Space Settings → Variables and secrets)

| Variable | Value | Type | Notes |
|----------|-------|------|-------|
| `GROQ_API_KEY` | `gsk_...` | **Secret** | Required for `LLM_PROVIDER=groq` |
| `LLM_API_KEY` | `gsk_...` (same) | Secret | Alias, covers `LLM_API_KEY` path |
| `LLM_PROVIDER` | `groq` | Variable | |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Variable | Groq prod Aug 2026 (llama-3.3 sunset 16 Aug) |
| `OPENAI_API_KEY` | `sk_...` | Secret | Only if `LLM_PROVIDER=openai` |
| `CORS_ORIGINS` | `https://retainai.vercel.app,http://localhost:5173,https://<USER>-retainai-live-mirror.hf.space` | Variable | Must include Vercel origin + HF origin |
| `DEMO_MODE` | `true` | Variable | Mirror demo default |
| `AUTH_ENABLED` | `false` | Variable | |
| `DATABASE_URL` | `sqlite+aiosqlite:///./retainai.db` | Variable | Ephemeral on HF; see §4 |
| `JWT_SECRET` | 32+ chars | Secret | Only if `AUTH_ENABLED=true` |
| `APP_SECRET_KEY` | 32+ chars | Secret | Only if `AUTH_ENABLED=true` |

> `sync: false` in `render.yaml` ↔ HF **Secret** — both mean "set in dashboard, never commit".

### 2.4 Verify

```bash
HF=https://<USER>-retainai-live-mirror.hf.space
curl $HF/health              # → {"status":"ok","service":"RETAINAI API",...}
curl $HF/readiness           # → {"status":"ready","database":"connected"}
curl $HF/api/v1/status       # → {"status":"operational","mode":"demo",...}
curl $HF/docs                # FastAPI Swagger (if DEBUG=true)
```

If `/health` returns `error` with `detail`, check Space logs (HF Space → Logs tab) — usually missing `GROQ_API_KEY` or import path.

---

## 3. Frontend Wiring

- **Default (Render primary)**: Vercel env `VITE_API_BASE_URL=https://retainai-api-live.onrender.com/api/v1`
- **Mirror**: Change to `https://<USER>-retainai-live-mirror.hf.space/api/v1` and redeploy Vercel.

Code handling (`frontend/src/services/api.ts:3`):

```ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
```

- Vite inlines `VITE_*` at **build time** — set Vercel env before `npm run build`.
- SPA fallback: `vercel.json` rewrites `/(.*)` → `/index.html`.
- CORS: backend must list Vercel origin in `CORS_ORIGINS` (both Render `render.yaml` and HF Space Variables).

Local switch:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8000/api/v1
# or
VITE_API_BASE_URL=https://<USER>-retainai-live-mirror.hf.space/api/v1
```

---

## 4. Persistence Notes

- **SQLite on HF**: File `./retainai.db` is ephemeral — Space restarts / rebuilds wipe it. Acceptable for demo mirror.
- **For persistence**:
  - Attach HF-hosted Postgres (Space → Settings → linked Postgres) and set `DATABASE_URL=postgresql+asyncpg://...`
  - Or keep HF as stateless mirror and rely on Render primary's DB.
  - Or use HF Persistent Storage (`/data`) and set `DATABASE_URL=sqlite+aiosqlite:////data/retainai.db`.

---

## 5. Sync Runbook

| Event | Action |
|-------|--------|
| Push to `deploy/hybrid-live-dynamic` | Manually `git pull` → copy `backend/` changes to Space repo → `git push hf` |
| `backend/Dockerfile` changes | Update `hf_space/Dockerfile` (keep `curl`, `PORT=7860`, healthcheck) |
| `render.yaml` env changes | Mirror to HF Space Variables |
| LLM model upgrade | Update `LLM_MODEL` in both `render.yaml` and HF Variables |
| Rotate secrets | Update Render dashboard + HF Secrets + local `.env` (never commit) |

**CI auto-sync (optional)**:

```yaml
# .github/workflows/hf-mirror.yml
name: Sync HF Mirror
on:
  push:
    branches: [deploy/hybrid-live-dynamic]
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          git clone https://oauth2:${{ secrets.HF_TOKEN }}@huggingface.co/spaces/<USER>/retainai-live-mirror hf-mirror
          cp -r backend hf-mirror/backend
          cp hf_space/Dockerfile hf-mirror/Dockerfile
          cp hf_space/app.py hf-mirror/app.py
          cp hf_space/README.md hf-mirror/README.md
          cd hf-mirror && git add . && git commit -m "sync: $GITHUB_SHA" || true && git push
```

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Space build fails `COPY ../backend` | Use self-contained Dockerfile variant (§2.2) |
| `health` returns 500 / import failed | Check logs: missing `backend/src` at build, or `retainai` not installed — ensure `uv sync` ran |
| CORS error from Vercel | Add Vercel origin to HF `CORS_ORIGINS` and restart Space |
| 401 on `/api/v1/*` with `AUTH_ENABLED=true` | Set `JWT_SECRET` same as Render, or set `DEMO_MODE=true` for demo |
| Cold start slow | HF CPU basic sleeps after inactivity — first request wakes (~30s); consider HF upgrade or keep Render primary |

---

## 7. References

- `hf_space/README.md` — HF Space card (sdk: docker, app_port: 7860)
- `hf_space/Dockerfile` — mirrors `backend/Dockerfile` (adds `curl`, `HEALTHCHECK`)
- `hf_space/app.py` — stub re-exporting `retainai.main:app`
- `render.yaml` — Render Blueprint (primary)
- `vercel.json` — Vercel SPA config
- `frontend/.env.production.example` — `VITE_API_BASE_URL` wiring
