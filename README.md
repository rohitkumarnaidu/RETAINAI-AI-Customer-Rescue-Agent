# RETAINAI — The Autonomous Customer Rescue Agent

> **Don't wait for churn. Let AI learn how to prevent it.**

[![BuildSprint 2026](https://img.shields.io/badge/BuildSprint-2026-blue)](https://buildsprint2026.dev)
[![Python](https://img.shields.io/badge/Python-3.11+-green)](https://www.python.org/)
[![uv](https://img.shields.io/badge/package_manager-uv-purple)](https://github.com/astral-sh/uv)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_18_+_TypeScript-61DAFB)](https://react.dev/)

**RETAINAI** is an autonomous customer retention intelligence system built for **BuildSprint 2026**. It transforms traditional passive churn metrics into an agentic closed-loop retention system:

$$\text{SENSE} \longrightarrow \text{THINK} \longrightarrow \text{ACT} \longrightarrow \text{MEASURE} \longrightarrow \text{LEARN} \longrightarrow \text{REPEAT}$$

---

## 🌟 Core Problem & Solution

* **Problem:** Customer Success teams manage dozens or hundreds of accounts, frequently discovering customer dissatisfaction only after cancellation or non-renewal.
* **Solution:** RETAINAI ingests multi-dimensional customer telemetry (product usage, feature adoption, support tickets, sentiment/feedback, and account admin activity), deterministically detects churn risk signals, agentically investigates root causes, formulates evidence-grounded next-best actions, and learns from intervention outcomes via an experience memory bank.

---

## 📚 Product & Engineering Documentation

We have meticulously planned and documented the entire system architecture, data models, AI evaluation frameworks, and demo scenarios. Please review these detailed documents in the `docs/` folder:

- **[PRODUCT.md](docs/PRODUCT.md)** - Deep Domain Research & Product Specification
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System Architecture Diagram & Concepts
- **[AGENT_ARCHITECTURE.md](docs/AGENT_ARCHITECTURE.md)** - Tools & Single Orchestrator Workflow
- **[DATA_MODEL.md](docs/DATA_MODEL.md)** - ERD and Customer 360 Object Definitions
- **[AI_EVALUATION.md](docs/AI_EVALUATION.md)** - E2E Benchmark Scenarios
- **[SECURITY.md](docs/SECURITY.md)** - Governance, Hallucination Prevention & HitL
- **[DEMO.md](docs/DEMO.md)** - 2-Minute Hackathon Pitch Script
- **[FUTURE_ROADMAP.md](docs/FUTURE_ROADMAP.md)** - Multi-Phase System Evolution

---

## 🏗️ Monorepo Architecture Overview

```text
retainai/
├── backend/            # Python FastAPI backend
│   ├── src/retainai/   # Core backend modules (agents, intelligence, database)
│   └── tests/          # 25+ integration & unit tests
├── frontend/           # React + TypeScript + Vite + Tailwind CSS dashboard
├── docs/               # Complete engineering requirements & architecture
```

---

## ⚡ Quickstart & Setup Guide

### 1. Backend Setup & Test Suite
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate  # Windows
pip install -e ".[dev]"

# Run the 25 integration tests (E2E workflows)
pytest tests -v

# Start the server (seeds the DB automatically)
uvicorn retainai.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Usage & Demo
Navigate to the local React frontend (usually `http://localhost:5173`) to view the **Command Center**. 
- Click into **Acme Corp** to view the Customer 360 timeline.
- Click the **AI Investigation** button to trigger the deterministic agent root-cause analysis and retention plan generation.
- Review **Logistics Pro** for an example of the Agent successfully identifying a False Positive efficiency gain.

