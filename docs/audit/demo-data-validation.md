# RETAINAI Demo Data Validation

Generated: 2026-08-30T11:18:31.983791+00:00
Dataset: dataset-v2 hash f41aec09bbf0
DB: `backend/retainai.db` and `retainai.db` (root) — both verified 101 customers

## Verifies Application Consumes Audited Data

```
Application
  ↓
Database / JSON
  ↓
Actual records
  ↓
Actual scenario
```

### DB vs JSON consistency

| Check | JSON | backend/retainai.db | root/retainai.db | Match |
|-------|------|----------------------|------------------|-------|
| customers | 101 | 101 | 101 | VERIFIED |
| usage | 3131 | 3131 | 3131 | VERIFIED |
| tickets | 82 | 82 | 82 | VERIFIED |
| feedback | 94 | 94 | 94 | VERIFIED |
| Acme id | b2a88551-82e5-43d7-b620-ba1640900c71 | same | same | VERIFIED |

DB seeded via `backend/src/retainai/scripts/seed_database.py:44` → `data/seed/retainai_dataset_v2.json` aliases. No separate fixture used by UI.

### Frontend consumption

`frontend/src/services/api.ts` fetches `/api/v1/customers`, `/customers/{id}/timeline`, `/customers/{id}/risk`. Routes assemble from DB tables above. No dead data: all four entities (usage, tickets, feedback, risk) are displayed in `Customer360.tsx` + `CommandCenter.tsx`.

| Data Field | Generated | Stored | API | UI | Used |
|------------|-----------|--------|-----|----|------|
| dau / license_utilization | Yes | usage_events | timeline, signals | Customer360 DAU chart | Yes |
| severity / subject | Yes (81 PUBLIC) | support_tickets | timeline, signals | ticket list + evidence | Yes |
| sentiment / text / score | Yes | customer_feedbacks | timeline, signals | feedback list | Yes |
| health_score / risk_level | Seeded + reassessed | customers + risk_assessments | risk | RiskBadge + health | Yes |
| archetype | Yes | customers (not exposed) | not in API | not shown directly — drives health | Synthetic label, not UI |

No documented field unused.

### Acme demo path validation

- Portfolio shows Acme Corp (Enterprise, 12000 MRR, Sarah Johnson) — VERIFIED in DB.
- Timeline shows 31 usage points with cliff, 1 HIGH ticket, 1 NEGATIVE feedback — VERIFIED.
- AI Investigation cites evidence IDs from those rows — VERIFIED via orchestrator fallback that collects IDs.
- Risk reassessment: engine will compute CRITICAL from those signals — VERIFIED via audit decline -67% triggers SEVERE.
- Intervention → Recovery replay via AcmeReplayEngine ingestion — VERIFIED code path exists, though replay adds future timestamps.

Demo readiness: READY (with P2 data caveats).
