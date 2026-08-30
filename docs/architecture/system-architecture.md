# System Architecture — RETAINAI

## High-Level Architecture Overview

RETAINAI is structured as a modern monorepo with an event-driven Python FastAPI backend and a React single-page application frontend.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           REACT FRONTEND (Vite)                         │
│   Portfolio View | Customer Timeline | Investigation | Action Desk     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST / API
┌────────────────────────────────────▼────────────────────────────────────┐
│                             FASTAPI BACKEND                             │
│                                                                         │
│  ┌────────────────────────┐         ┌────────────────────────────────┐  │
│  │   DETERMINISTIC ENGINE │         │      AGENTIC REASONING LOOP    │  │
│  │  - Health Calculator   │         │  - Investigation Agent         │  │
│  │  - Delta Evaluation    │         │  - Action Strategy Agent       │  │
│  │  - Signal Detector     │         │  - Experience Memory Engine    │  │
│  └───────────┬────────────┘         └───────────────┬────────────────┘  │
│              │                                      │                   │
│              └──────────────────┬───────────────────┘                   │
│                                 ▼                                       │
│                       SQLAlchemy Async ORM                              │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  ▼
                    SQLite (Local) / PostgreSQL (Prod)
```

## Modular Components

### 1. Frontend (`frontend/`)
- Single-page dashboard built with React, Vite, TypeScript, and Tailwind CSS.
- Communication via typed HTTP REST client services (`/src/services/api.ts`).

### 2. Backend (`backend/`)
- FastAPI application entrypoint (`src/retainai/main.py`).
- **Intelligence Layer (`src/retainai/intelligence/`):** Pure Python modules calculating health scores, windowed usage trends, and signal triggers.
- **Agentic Layer (`src/retainai/agents/`):** Orchestrator, LLM prompt formats, evidence parsing, and JSON response validators.
- **Database Layer (`src/retainai/database/` & `src/retainai/models/`):** Async SQLAlchemy ORM models mapping customers, events, risk assessments, interventions, and experience memories.
