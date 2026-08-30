---
title: RETAINAI — AI Customer Rescue Agent (Mirror)
emoji: 🛡️
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
license: mit
short_description: Hybrid-live-dynamic mirror of RETAINAI backend (SENSE→THINK→ACT→MEASURE→LEARN)
tags:
  - customer-success
  - ai-agent
  - groq
  - fastapi
---

# RETAINAI — Hugging Face Space Mirror (deploy/hybrid-live-dynamic)

> **Mirror of the Render hybrid backend** — auto-synced from `deploy/hybrid-live-dynamic` branch.
> Primary live backend: `https://retainai-api-live.onrender.com` (Render Blueprint `render.yaml`).
> This Space is a **disaster-recovery / demo mirror** on Hugging Face Docker SDK.

## Architecture

```
Vercel (frontend) ──→ Render (primary API) ──┐
                     HF Space (mirror API) ───┘
Both expose identical FastAPI surface: /health, /readiness, /api/v1/*
```

- **Primary**: Render `retainai-api-live` (Docker, `backend/Dockerfile`, health `/health`)
- **Mirror**: This Space (Docker, `hf_space/Dockerfile` → same FastAPI app)
- **Frontend**: Vercel `retainai.vercel.app` (`frontend/`, `vercel.json`, `VITE_API_BASE_URL` → Render URL; switch to HF URL by env var)

## Quick Start — Create the Space

1. **Create Space**
   - https://huggingface.co/new-space → Owner: your org → Name: `retainai-live-mirror`
   - SDK: **Docker** → Visibility: Public or Private → Create

2. **Push this folder as Space repo**
   ```bash
   git clone https://huggingface.co/spaces/<YOUR_USERNAME>/retainai-live-mirror
   cd retainai-live-mirror
   # copy hf_space/* → repo root
   cp -r "C:/Hackathons/Latent Code/RETAINAI - AI Customer Rescue Agent/hf_space/"* .
   git add .
   git commit -m "feat: RETAINAI HF mirror (hybrid-live-dynamic)"
   git push
   ```

3. **Set Secrets** (Space Settings → Variables and secrets)
   - `GROQ_API_KEY` = `gsk_...` (required, Groq `openai/gpt-oss-120b`)
   - `LLM_API_KEY`  = same as GROQ_API_KEY (alias, optional)
   - `LLM_PROVIDER` = `groq`
   - `LLM_MODEL`    = `openai/gpt-oss-120b`
   - `OPENAI_API_KEY` = `sk_...` (only if `LLM_PROVIDER=openai`)
   - `CORS_ORIGINS` = `https://retainai.vercel.app,http://localhost:5173,https://<YOUR_USERNAME>-retainai-live-mirror.hf.space`
   - `DEMO_MODE` = `true`  (mirror demo; set `false` + `AUTH_ENABLED=true` for prod)
   - `AUTH_ENABLED` = `false`
   - `DATABASE_URL` = `sqlite+aiosqlite:///./retainai.db` (ephemeral on HF; add HF Postgres if needed)
   - Optional prod: `JWT_SECRET`, `APP_SECRET_KEY` (sync:false, generate 32+ chars)

4. **Verify**
   ```bash
   curl https://<YOUR_USERNAME>-retainai-live-mirror.hf.space/health
   curl https://<YOUR_USERNAME>-retainai-live-mirror.hf.space/readiness
   curl https://<YOUR_USERNAME>-retainai-live-mirror.hf.space/api/v1/status
   ```

5. **Switch frontend** (optional, to point Vercel at mirror)
   - Vercel Dashboard → Project `retainai` → Settings → Environment Variables
   - Update `VITE_API_BASE_URL` → `https://<YOUR_USERNAME>-retainai-live-mirror.hf.space/api/v1`
   - Redeploy (Vercel auto-rebuilds on env change)

## Files in this folder

| File | Purpose |
|------|---------|
| `Dockerfile` | HF Docker SDK — mirrors `backend/Dockerfile` (python:3.12-slim, uv, curl healthcheck, port 7860) |
| `app.py` | Thin stub — re-exports `retainai.main:app` for HF port mapping; no logic fork |
| `README.md` | This card (HF Space metadata + docs) |
| `requirements.txt` | Pinned snapshot (optional, Dockerfile uses `backend/pyproject.toml` + `uv`) |

## Syncing with `deploy/hybrid-live-dynamic`

- **Manual**: `git pull` from `deploy/hybrid-live-dynamic` → copy `backend/` changes → push to Space.
- **CI (optional)**: Add GitHub Action that on push to `deploy/hybrid-live-dynamic` does `git push hf main` (HF as second remote).
- Keep `hf_space/Dockerfile` in sync with `backend/Dockerfile` — only port differs (7860 for HF).

## Notes

- HF Spaces **Docker** expects port `7860` (not 8000) — Dockerfile maps `7860 → 8000` via `PORT` env.
- SQLite is ephemeral on HF (restarts wipe `/data`). For persistence, attach HF Postgres or use Render primary.
- LLM: Groq production Aug 2026 is `openai/gpt-oss-120b` (~500 tps). Legacy `llama-3.3-70b` was sunset 16 Aug 2026.
- See `docs/HF_SPACE_MIRROR.md` for extended runbook (rollback, secrets rotation, CORS).
