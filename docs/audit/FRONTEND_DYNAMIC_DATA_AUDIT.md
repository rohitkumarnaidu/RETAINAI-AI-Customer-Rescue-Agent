# FRONTEND DYNAMIC DATA AUDIT — RETAINAI

**Date:** 2026-08-30 | **Commit:** 14197b2 | **Stack:** React 18 + TS + axios `services/api.ts:51`, Vite 5 | **Views:** `CommandCenter.tsx:180`, `Customer360.tsx:327`, `ActionCenter.tsx:198`, `RiskBadge.tsx`, `ui.tsx` | **API base:** `VITE_API_BASE_URL || localhost:8000/api/v1` `api.ts:3`

## 1. Method

For each rendered value, trace **DB column (`db/models.py`) → API field (`api/routes.py` / `repositories/*` ) → Service thunk (`services/api.ts`) → JSX**. Mark **DYNAMIC** if value comes from DB via API; **HARDCODED** if literal fallback; **DISCARDED** if fetched then voided; **CLIENT-FILTERED** if post-fetched transform shown as-is.

## 2. CommandCenter — `components/CommandCenter.tsx:180`

| UI Token | Source of Truth | Chain (DB → API → UI) | Verdict |
|----------|-----------------|------------------------|---------|
| `totalARR` `CommandCenter.tsx:38 reduce arr` + display `CommandCenter.tsx:68 ${(totalARR/1000).toFixed(0)}k` | `customers.arr Float` `models.py:86` | `Customer.arr` 101 rows → `GET /portfolio` `routes.py:423 sum(c.arr)` `routes.py:429` → `getPortfolio()` `api.ts:50` → `totalARR` | **DYNAMIC** |
| `atRiskARR` `CommandCenter.tsx:39 [...critical,...watch].reduce` | same + `customers.risk_level` `models.py:93` updated by `CustomerService.reassess` | same portfolio `arr_at_risk = sum CRITICAL/HIGH_RISK/AT_RISK` `routes.py:429` intersects client calc | **DYNAMIC** |
| `risk_distribution` bar `CommandCenter.tsx:164` | same risk_level distribution | `risk_distribution[c.risk_level.value]++` `routes.py:431` → `metrics.risk_distribution` | **DYNAMIC** |
| `customers.length`, subtitle `CommandCenter.tsx:54 {critical} · {watch} · {healthy} · {atRiskARR} · {total}` | same aggregates | client `filter risk_level` `CommandCenter.tsx:35-36` mirrors server counts | **DYNAMIC** |
| Customer rows `name,domain,segment,risk_level,health_score,arr,csm_name,industry` `CommandCenter.tsx:145-155` + `HealthRing` `CommandCenter.tsx:97` | `customers.*` `models.py:78-93` | same `/portfolio customers[]` payload `routes.py:441 list_all()` | **DYNAMIC** |
| Search `q` filter `CommandCenter.tsx:26 matchesQ name/domain/csm` + risk pills `CommandCenter.tsx:131` | client filter over same array `filtered useMemo` `CommandCenter.tsx:24` | no API param — client filter but over dynamic data | **DYNAMIC (client-filtered)** |
| Hero pin `acme` `CommandCenter.tsx:40 find id==='acme-corp-001' \|\| name includes 'acme'` | DB id exists `seed_database.py:73` acme-corp-001 seeded | heuristic substring `toLowerCase().includes('acme')` | **DYNAMIC w/ hardcoded HERO badge** `CommandCenter.tsx:149 <span HERO>` amber border for any acme-named |
| Featured banner `acme ARR/domain/CSM` `CommandCenter.tsx:173 ${acme.arr.toLocaleString()}` | same `customers.arr/domain/csm_name` | same | **DYNAMIC** |

## 3. Customer360 — `components/Customer360.tsx:327` 7 queries + investigation loop

| UI Token | Source | Chain | Verdict |
|----------|--------|-------|---------|
| Header `healthScore` `Customer360.tsx:73 risk?.health_score ?? customer.health_score ?? 85` ring `Customer360.tsx:87 <HealthRing score={healthScore}>` | `risk_assessments.health_score Float` `models.py:241` + `customers.health_score 100.0` `models.py:92` | `GET /customers/{id}/risk` `routes.py:96 reassess` → `reassessment.health_score` + fallback `customer.health_score` + literal `85` `Customer360.tsx:73` | **DYNAMIC + hardcoded 85 fallback** `Customer360.tsx:73,123` magic if both null (P1-03) |
| `riskLevel` `Customer360.tsx:72 risk?.risk_level \|\| 'HEALTHY'` + `<RiskBadge level>` `Customer360:91` | `risk_assessments.risk_level RiskLevel enum` `models.py:242` via `RiskEngine.map_health_to_risk_level` `risk_engine.py:52` | same `GET /risk` `risk_level_str` | **DYNAMIC** default `HEALTHY` string if null — literal but low risk |
| `health_components` 4 tiles `Customer360.tsx:125-133 {Object.entries(healthComps).map k:v}` | `HealthEngine` weighted `0.4/0.3/0.2/0.1` `health_engine.py:48-53` → `RiskResult.health_components` `routes.py:96` | `GET /risk health_components={usage,support,sentiment,engagement}` | **DYNAMIC** — weights invisible but computed live |
| `rootCause` `Customer360.tsx:75 risk?.primary_root_cause \|\| risk?.root_cause \|\| 'No severe risk detected'` + reasoning `'Telemetry within nominal'` `Customer360:76` | `SignalEngine` + `TimelineService` reasoning `customer_service.reassess` summary | same `risk.reassess` summary/primary_root_cause | **DYNAMIC + fallback literals** `'No severe risk detected'` + `'Telemetry within nominal ranges.'` `Customer360:75-76,123` |
| Signals pills `signals.slice(0,8) s.signal_type · s.severity` `Customer360.tsx:138` | `DetectedSignal{signal_type,severity,impact_score}` `signal_engine.py:20` | `GET /customers/{id}/signals` `routes.py:89 SignalService` → `api.ts:34` | **DYNAMIC** |
| Investigation `root_cause,summary,confidence,uncertainty_status,evidence_ids,recommended_action,missing_evidence` `Customer360:188-206` + confidence badge `Customer360:190 <ConfidenceBadge>` | `InvestigationAgent.investigate` → `InvestigationReport{root_cause,summary,confidence,uncertainty_status,evidence_ids,missing_evidence}` `models.py:289-294` | `POST /agent/investigate/{id}` `agent_routes.py:16` `AgentOrchestrator.run_full_rescue_workflow` `orchestrator.py:220` → `api.ts:35` | **DYNAMIC** |
| Missing/weak banner `Customer360:194 missing_evidence.join(' · ')` | same `investigation.missing_evidence` | same | **DYNAMIC** — empty when CLEARED |
| Evidence chips `evidence_ids.map id chip` `Customer360:202` + drawer `ui.tsx EvidenceDrawer` | `InvestigationReport.evidence_ids JSON` `models.py:292` validated `orchestrator.py:232` `ex` filtering | same + `/evidence/{id}` `routes.py:242` resolver on click | **DYNAMIC** — fabricated IDs filtered |
| Retention plan header `title,objective,action_type,priority` `Customer360:224-227` | `ActionStrategyAgent.generate_plan` → `Intervention{action_type,title,description,priority}` `models.py:314-324` | same `retention_plan` object from `orchestrator.py:305,349` `plan_res.model_dump()` | **DYNAMIC** |
| Plan steps `s.title/owner/action/target_date` `Customer360:230` `plan_steps.map` | `RetentionPlan.steps[]` `action_agent.py` | same `retention_plan.plan_steps` + fallback `orchestrator.py:318 Human Review Required` | **DYNAMIC** with empty fallback literal |
| Draft email `subject,body` `Customer360:244 <pre body>` | `DraftEmail` `action_agent.py` `csm_name` templated | same `retention_plan.draft_email` | **DYNAMIC** |
| Timeline `filteredTimeline` `timestamp,source,title,description,details` `Customer360:267` | `TimelineService.get_unified_timeline` unions `usage_events,support_tickets,customer_feedbacks,account_events,risk_assessments` | `GET /customers/{id}/timeline?days=60` `routes.py:82` → `api.ts:32` → `filter source.includes` `Customer360:77` | **DYNAMIC** client-filtered `ALL/USAGE/SUPPORT/FEEDBACK/ACCOUNT` `Customer360:260` |
| Intervention history `iv.title/status/description/created_at/action_type` `Customer360:286` | `interventions.*` `models.py:307-325` | `GET /customers/{id}/interventions` `routes.py:307` → `api.ts:42` | **DYNAMIC** |
| Relevant experience `m.pattern/confidence/sample_size` `Customer360:301` | `experience_memories.*` `models.py:384-398` | `GET /customers/{id}/memory` `routes.py:182` segment-filtered → `api.ts:45` | **DYNAMIC** |
| Agent runs `r.id/status/output_summary/started_at` `Customer360:174-178` | `agent_runs` `models.py:485` | `GET /agent/runs/{id}` `agent_routes.py:35` → `api.ts:37` | **DYNAMIC** |

## 4. ActionCenter — `components/ActionCenter.tsx:198`

| UI Token | Source | Chain | Verdict |
|----------|--------|-------|---------|
| Tab counts `memories.length, interventions.length` `ActionCenter.tsx:78,89` `Experience Memory (n)` | counts | `GET /learning/memories` `routes.py:444` + `GET /interventions` `routes.py:470` → `api.ts:46,48` | **DYNAMIC** |
| Memory card `industry_segment/customer_segment/risk_pattern/context_pattern` `ActionCenter.tsx:118-120` | `experience_memories.customer_segment/risk_pattern/context_pattern` `models.py:386-388` | same `/learning/memories` | **DYNAMIC** (`industry_segment` field alias mismatch `api.ts:23` maps to `customer_segment`) |
| Memory quote `key_insights/observed_outcome/recommended_strategy` `ActionCenter.tsx:138` | `experience_memories.observed_outcome/recommended_strategy` `models.py:392-393` | same | **DYNAMIC** |
| **Success rate** `ActionCenter.tsx:125 IIFE success_rate*100 else success_count/total else confidence*100 else '92%'` | `experience_memories.success_rate` `models.py:399` float 0..1 + `success_count/failure_count` `models.py:397` | same | **PARTIALLY HARDCODED literal `'92%'` `ActionCenter.tsx:131`** when all three absent — pre-validation card claims 92% (P1-03). After validation `success_rate` present so dynamic. |
| Sample size `ActionCenter.tsx:143 success_count ?? sample_size ?? 1` | `experience_memories.sample_size/success_count` `models.py:398` | same | **DYNAMIC** |
| `RiskBadge.tsx:34` confidence `0.85` fallback when absent | `risk_assessments.confidence 0.85` `models.py:248` default | `RiskBadge.tsx:34` mirrors DB default but hardcoded | **HARDCODED literal `0.85`** `RiskBadge.tsx:34` |
| Interventions list `title,status,objective,priority,customer_id` `ActionCenter.tsx:170-188` | `interventions.*` `models.py:314-325` | `GET /interventions` `routes.py:470` | **DYNAMIC** but `plan_steps.length` `ActionCenter.tsx:184` reads undefined — `plan` stored JSON string `models.py:317` never deserialized to `plan_steps` by API |
| `void outData` `ActionCenter.tsx:29,33 void getAllOutcomes()` | `intervention_outcomes` `models.py:342` | `GET /outcomes` `routes.py:487` fetched then discarded `ActionCenter.tsx:33 void outData` | **DISCARDED** — DB→API real but UI never renders (D-P2-08) |
| Loading `Loading Learning Loop` spinner `ActionCenter.tsx:48` / error `AlertTriangle` `ActionCenter:95` | UI state | local | chrome not data |

## 5. Cross-Cutting

- No `Math.random()`, no `mock arrays` in frontend `grep REPOSITORY_INVENTORY.md:44`; `setTimeout 1000` `App.tsx:26` auto-navigates to demo Acme — UX shim not data.
- `silent catch(()=>[])` everywhere `Customer360.tsx:29-34` + `ActionCenter.tsx:27` swallows `GET /portfolio 500` → falls back to `N+1` client load; hides `main.py:84` handler bug.
- `approve` doesn't refetch portfolio `Customer360.tsx:60` — approved status stale on CommandCenter until manual refresh `CommandCenter.tsx:14 load()`.
- `outcomes` triple naming `status/outcome/evaluation_status` `models.py:350/351/366` never uniformly surfaced.

## 6. Conclusion — ~90% Dynamic

~90% of displayed data is **DB → API → UI dynamic**: ARR totals, `risk_distribution`, every portfolio row, 4 health tiles, signals, `rootCause`/`reasoning`, timeline (unioned telemetry), plan steps, draft email, intervention history, memories, agent runs. Remaining ~10% = fallback literals (`85` `Customer360:73,123`, `'92%'` `ActionCenter:131`, `'No severe risk detected'` `Customer360:75`, `0.85` `RiskBadge:34`), discarded outcomes `ActionCenter:33 void`, and substring hero pin. Fix: replace `92%` with `—`, `85` fallback with `<Skeleton/>`, deserialize `plan` JSON to `plan_steps` in `routes.py:470` or `ActionCenter.tsx:184`, render `outData` outcomes, remove `void`, refetch portfolio on approve.
## 7. API Service Layer — services/api.ts:51 contract table

- api singleton axios baseURL api.ts:5 baseURL VITE_API_BASE_URL || localhost:8000/api/v1 headers JSON
- Interfaces: Customer(13 fields) api.ts:10, RiskAssessment api.ts:16, InterventionStep api.ts:17, DraftEmail api.ts:18, RetentionPlan api.ts:19, InvestigationResult api.ts:20, Intervention api.ts:21, InterventionOutcome api.ts:22, ExperienceMemory api.ts:23, TimelineEvent api.ts:24, Signal api.ts:25, FullAgentInvestigationResponse api.ts:27 — 12 typed contracts.
- Thunks 15: getCustomers 29, getCustomer 30, getCustomerTimeline 32, getCustomerRisk 33, getCustomerSignals 34, runInvestigation 35, getAgentRuns 37, getAgentRunDetail 38, approveIntervention 39, rejectIntervention 40, resetDemo 41, getCustomerInterventions 42, getCustomerEvidence 43, resolveEvidence 44, getCustomerMemory 45, getExperienceMemories 46 with try/catch fallback, getAllInterventions 48 N+1 fallback, getAllOutcomes 49, getPortfolio 50, getObservability 51 — all dynamic axios GET/POST.

## 8. Hardcoded Literal Complete Inventory (grep)

Frontend grep: 92% ActionCenter:131, 85 Customer360:73,123 fallback, 0.85 RiskBadge:34, acme substring CommandCenter:40,68,145, setTimeout 1000 App:26, No severe risk detected Customer360:75, Telemetry within nominal Customer360:76. Backend grep: 90.0 risk_engine:61 HEALTHY threshold, 40/35/30 etc signal_engine:124+ impacts 12 literals, MIN_SAMPLE_SIZE 2 learning_engine:25, MAX_ITER 8 orchestrator:28, HEALTHY 40.0 fallback learning_engine:313.

No if customer==Acme or health==70 literals in engines — clean per REPOSITORY_INVENTORY.md:39.

## 9. Refresh & Cache Gaps

- CommandCenter load() useEffect [] once 19 — no polling; Refresh button calls load() 61 manually.
- Customer360 load() 24 Promise.all 6 parallel; investigating refetches 47-53 4 queries after investigation.
- approve handleApprove 58-63 updates interventions array only, does not invalidate CommandCenter portfolio counts or ActionCenter tab counts.
- No React Query / SWR; stale-while-revalidate not implemented — D-P2-08 stale frontend cache.

## 10. A11y & UX Polish (out of dynamic scope but affects judge)

- Search input missing aria-label CommandCenter:128, table header sticky but no role=button on rows 147, risk pills not keyboardable, color contrast ok.

## 11. Component File Map

- CommandCenter.tsx:180 4 KPI cards + 2-column Needs attention + Portfolio table + Featured Acme banner 168 + RiskBadge/HealthRing imports
- Customer360.tsx:327 header HealthRing 87 + Why at risk 111 + Investigation 162 + Timeline 257 + Intervention history 283 + Relevant experience 298 + Lifecycle SENSE->LEARN 313
- ActionCenter.tsx:198 header Brain 56 + tab toggle memory/interventions 68 + memories grid 104 + interventions list 153
- api.ts:51 15 thunks + 12 interfaces covering full backend surface
- RiskBadge.tsx pills 4 risk colors, HealthRing arc
- ui.tsx Card, SkeletonCard, ErrorState, EvidenceDrawer with /evidence fetch

## 12. Proof No Mock Arrays

- grep -R mock frontend/src => no mock arrays; grep Random => none; only void outData discard and fallback literals.
