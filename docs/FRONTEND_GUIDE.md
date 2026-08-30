# RETAINAI -- Frontend Guide

> **Source of truth:** Code under `frontend/`. All facts below are derived from the
> implementation as of 2026-08-30. File references use `frontend/...:line`
> where line numbers indicate the canonical definition.

---

## 1. Overview

RETAINAI frontend is a **single-page dashboard** that surfaces the closed-loop
`SENSE -> THINK -> ACT -> MEASURE -> LEARN` protocol for autonomous customer rescue.
It is intentionally minimal: **no router, no global store, no component library** --
three tabs driven by local `useState`, Tailwind for styling, and a single `axios`
client that talks to FastAPI at `http://localhost:8000/api/v1`.

Key invariants the docs must not drift from:

| Decision | Value | Where |
|---|---|---|
| Framework | React **18.3.1** + TypeScript **5.2.2** | `frontend/package.json:14` |
| Bundler | Vite **5.1.6** | `frontend/package.json:25` |
| Styling | Tailwind **3.4.1** | `frontend/package.json:24` |
| HTTP | axios **1.6.8** + lucide-react **0.344** | `frontend/package.json:13` |
| Tabs | `command` \| `customer360` \| `actions` via `useState` | `frontend/src/App.tsx:8` |
| Router | **None** -- conditional render, no `react-router` | `frontend/src/App.tsx:119` |
| Store | **None** -- local `useState` only, no Redux/Zustand/Context | `frontend/src/App.tsx:9` |
| Default customer | `acme-corp-001` (featured hero banner) | `frontend/src/App.tsx:10` |

---

## 2. Stack

| Layer | Choice | Version / Note |
|---|---|---|
| Runtime | Node | `20-alpine` in Docker -- `frontend/Dockerfile:1` |
| Framework | React | `18.3.1` -- `StrictMode` in `frontend/src/main.tsx:7` |
| DOM | react-dom | `18.3.1` |
| Language | TypeScript | `5.2.2`, `strict: true` -- `frontend/tsconfig.json:18` |
| Bundler | Vite | `5.1.6` + `@vitejs/plugin-react 4.2.1` |
| CSS | Tailwind CSS | `3.4.1` + `autoprefixer 10.4.18` + `postcss 8.4.35` |
| HTTP | axios | `1.6.8` single client `api` -- `frontend/src/services/api.ts:5` |
| Icons | lucide-react | `0.344.0` -- every icon is an SVG component |
| Server (prod) | nginx | `alpine` -- SPA fallback -- `frontend/nginx.conf:5` |
| Package mgr | npm | `npm ci` in Docker, `package-lock.json` committed |
| Build output | `dist/` | `frontend/Dockerfile:9` copies to `/usr/share/nginx/html` |

Explicit non-dependencies -- intentionally absent:

| Not used | Why / Alternative |
|---|---|
| `react-router-dom` | Tab state replaces routing -- `frontend/src/App.tsx:8` |
| Redux / Zustand / Jotai / Context | Local `useState` per component is sufficient for 3 tabs |
| `shadcn/ui`, Radix, MUI | Hand-rolled Tailwind only |
| Chart library (recharts, chart.js) | No charts -- numeric cards + tables + timeline |
| `React.memo`, `useMemo`, `useCallback` | No memo optimization anywhere |
| ESLint config | No `.eslintrc` -- `lint` script is `tsc --noEmit` -- `frontend/package.json:9` |

---

## 3. Project Structure

```
frontend/
  index.html               # 13 lines -- Vite entry, <div id="root">, title RETAINAI -- Autonomous Customer Rescue Agent
  package.json             # 28 lines -- scripts: dev/build/lint/preview
  vite.config.ts           # 16 lines -- react(), port 5173, proxy /api -> localhost:8000
  tailwind.config.js       # 22 lines -- content globs + brand palette extension (unused)
  postcss.config.js        # 6 lines -- tailwindcss + autoprefixer
  tsconfig.json            # 28 lines -- target ES2020, module ESNext, bundler, react-jsx, @/* alias
  nginx.conf               # 6 lines -- listen 5173, root /usr/share/nginx/html, try_files SPA fallback
  Dockerfile               # 12 lines -- multi-stage node:20-alpine -> nginx:alpine, EXPOSE 5173
  dist/                    # build output (git-ignored in dev, copied in Docker)
  src/
    main.tsx               # 10 lines -- StrictMode + createRoot(App)
    index.css              # 14 lines -- @tailwind directives + body { bg #0f172a, font sans }
    App.tsx                # 138 lines -- shell, tab state, header, footer, Reset Demo
    services/
      api.ts               # 268 lines -- axios client + 12 interfaces + 15 functions
    components/
      CommandCenter.tsx    # 308 lines -- portfolio, hero, 4 cards, table, search+filters
      Customer360.tsx      # 403 lines -- 360 view, risk engine, AI investigation, timeline
      ActionCenter.tsx     # 191 lines -- learning loop, 2 tabs (memory + interventions)
      RiskBadge.tsx        # 34 lines -- pill pill with dot, sm|md|lg
```

**Dependency graph (`->` means imports):**

```
src/main.tsx -> App.tsx -> components/* -> services/api.ts -> axios
              -> index.css (Tailwind)
vite.config.ts -> @vitejs/plugin-react
index.html -> src/main.tsx (type="module")
```

### 3.1 File-by-file sizes (exact)

| File | Lines | Role |
|---|---|---|
| `frontend/index.html` | 13 | HTML entry, `#root`, module script |
| `frontend/src/main.tsx` | 10 | React root, `StrictMode` |
| `frontend/src/index.css` | 14 | Tailwind base/components/utilities + body bg |
| `frontend/src/App.tsx` | 138 | Shell + navigation |
| `frontend/src/components/CommandCenter.tsx` | 308 | Portfolio tab |
| `frontend/src/components/Customer360.tsx` | 403 | 360 + agent tab |
| `frontend/src/components/ActionCenter.tsx` | 191 | Learning tab (actual file 198 inc. imports) |
| `frontend/src/components/RiskBadge.tsx` | 34 | Shared badge |
| `frontend/src/services/api.ts` | 268 | API client |
| `frontend/package.json` | 28 | Deps + scripts |
| `frontend/vite.config.ts` | 16 | Dev server |
| `frontend/tailwind.config.js` | 22 | Theme |
| `frontend/postcss.config.js` | 6 | PostCSS |
| `frontend/tsconfig.json` | 28 | TS config |
| `frontend/nginx.conf` | 6 | SPA fallback |
| `frontend/Dockerfile` | 12 | Multi-stage build |

---

## 4. Routing via Tabs (No Router)

### 4.1 Mechanism

File: `frontend/src/App.tsx:8`

```tsx
const [activeTab, setActiveTab] = useState<'command' | 'customer360' | 'actions'>('command');
const [selectedCustomerId, setSelectedCustomerId] = useState<string>('acme-corp-001');
```

Three string literals are the entire routing table. Changing tab is `setActiveTab(...)` --
no URL change, no `history.pushState`, no deep linking.

```tsx
// frontend/src/App.tsx:119 -- conditional render, not <Routes>
{activeTab === 'command' && <CommandCenter onSelectCustomer={handleSelectCustomer} />}
{activeTab === 'customer360' && <Customer360 customerId={selectedCustomerId} />}
{activeTab === 'actions' && <ActionCenter />}
```

### 4.2 Navigation handlers

| Handler | File:Line | Behavior |
|---|---|---|
| `handleSelectCustomer(id)` | `frontend/src/App.tsx:14` | `setSelectedCustomerId(id); setActiveTab('customer360')` |
| Tab buttons `onClick` | `frontend/src/App.tsx:62` | Direct `setActiveTab('command' \| 'customer360' \| 'actions')` |
| `handleResetDemo` | `frontend/src/App.tsx:19` | `POST /system/reset` -> toast -> `window.location.reload()` after 1s |

### 4.3 Why no router

* Single-page dashboard with exactly 3 views; URL sharing is not a product requirement.
* Keeps bundle minimal (no `react-router-dom` dep) and avoids route-level code splitting complexity.
* Trade-off: no browser back/forward, no bookmarkable customer URL, no `/:customerId` deep link.
  Adding a router would require lifting `customerId` into URL params and handling `useParams`.

---

## 5. State Management -- Local `useState` Only

### 5.1 Rule

Every piece of state lives in the component that owns it. No `createContext`, no provider,
no Redux/Zustand/Jotai, no `useReducer`, no `useMemo`/`useCallback`/`React.memo`.

### 5.2 State inventory

**`App.tsx:8` -- 4 atoms:**

```tsx
activeTab: 'command' | 'customer360' | 'actions'  // default 'command'
selectedCustomerId: string                          // default 'acme-corp-001'
resetting: boolean                                  // default false
resetMessage: string | null                         // toast after reset
```

**`CommandCenter.tsx:18` -- 5 atoms:**

```tsx
customers: CustomerWithRisk[]   // enriched with latestRisk
loading: boolean                // true on mount
error: string | null
searchQuery: string             // controlled input
filterRisk: string              // 'ALL' | 'CRITICAL' | 'WATCH' | 'HEALTHY'
```

**`Customer360.tsx:34` -- 9 atoms:**

```tsx
customer: Customer | null
timeline: TimelineEvent[]
riskData: any                   // RiskAssessmentResponse | RiskAssessment[] | null
loading: boolean
investigating: boolean          // Run AI Investigation spinner guard
investigationResult: FullAgentInvestigationResponse | null
approving: boolean              // Approve button guard
approvedInterventionId: string | null
error: string | null
```

**`ActionCenter.tsx:15` -- 5 atoms:**

```tsx
memories: ExperienceMemory[]
interventions: Intervention[]
loading: boolean
error: string | null
activeTab: 'memory' | 'interventions'  // inner tab, defaults 'memory'
```

**Derived state (not stored):** `totalARR`, `atRiskARR`, `criticalCount`, `watchCount`,
`filteredCustomers`, `currentRiskLevel`, `healthScore`, `rootCauseText` -- all computed inline
on every render.

### 5.3 Data flow diagram

```
App (selectedCustomerId, activeTab)
 ├─ CommandCenter --onSelectCustomer(id)--> App.handleSelectCustomer -> sets both atoms
 │     └─ api: getPortfolio() || getCustomers()+getCustomerRisk(*)  -> customers[]
 │
 ├─ Customer360(customerId)
 │     └─ api: getCustomerById + getCustomerTimeline(60) + getCustomerRisk
 │     └─ handlers: runInvestigation -> approveIntervention
 │
 └─ ActionCenter
       └─ api: getExperienceMemories + getAllInterventions + getAllOutcomes (voided)
```

Props flow is **one-way** and shallow: only `customerId: string` and `onSelectCustomer: (id)=>void`
cross component boundaries.

---

## 6. Components Deep Dive

### 6.1 `App.tsx` -- Shell (138 lines)

**File:** `frontend/src/App.tsx:1`

**Props:** none (root). Exports `App` named + default.

**State:** `activeTab`, `selectedCustomerId`, `resetting`, `resetMessage` -- see §5.2.

**Handlers:**

* `handleSelectCustomer(customerId: string)` at `frontend/src/App.tsx:14` -- sets both `selectedCustomerId`
  and `activeTab='customer360'`.
* `handleResetDemo()` at `frontend/src/App.tsx:19` -- async, sets `resetting=true`, calls `resetDemo()`
  (`POST /system/reset`), shows `res.message || "Database reset successfully!"`, then
  `setTimeout(() => window.location.reload(), 1000)`. On catch, `alert("Reset endpoint failed ... uv run python -m retainai.scripts.seed_database")`.

**Layout -- 4 zones:**

| Zone | File:Line | Classes |
|---|---|---|
| Root | `frontend/src/App.tsx:37` | `min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500` |
| Header | `frontend/src/App.tsx:39` | `sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80` + `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between` |
| Main | `frontend/src/App.tsx:118` | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8` -- conditional render block |
| Footer | `frontend/src/App.tsx:125` | `border-t border-slate-900 bg-slate-950/60 py-4 mt-12` -- dot + backend URL + Loop Protocol |

**Header sub-sections:**

1. **Brand left** at `frontend/src/App.tsx:43` -- `Shield` gradient `from-indigo-600 to-violet-500 rounded-xl shadow-lg`, wordmark `RETAIN<span indigo-400>AI</span>` mono extrabold, badge `v1.0 Autonomous Engine` (10px indigo-950), subtitle `Closed-Loop AI Customer Success & Retention Command Center` (11px slate-400, hidden on mobile).
2. **Nav center** at `frontend/src/App.tsx:60` -- pill `bg-slate-900/90 p-1 border rounded-xl`, 3 buttons `gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all`. Active: `bg-indigo-600 text-white shadow-md shadow-indigo-950`; inactive: `text-slate-400 hover:text-slate-200 hover:bg-slate-800/50`. Icons `LayoutDashboard`, `Users`, `Brain` 3.5x3.5.
3. **Reset right** at `frontend/src/App.tsx:98` -- `bg-slate-900 border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-medium`, `RefreshCw` 3.5x3.5 indigo-400 with `animate-spin` when `resetting`, label hidden on mobile (`hidden md:inline`).
4. **Toast** at `frontend/src/App.tsx:111` -- `bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-300 text-xs py-2 text-center font-mono`.

**Footer:** dot `w-2 h-2 bg-emerald-500 animate-pulse` + hardcoded text `FastAPI Backend Connected: http://localhost:8000` + `Loop Protocol: SENSE -> THINK -> ACT -> MEASURE -> LEARN` (mono, slate-500).

---

### 6.2 `CommandCenter.tsx` -- Portfolio (308 lines)

**File:** `frontend/src/components/CommandCenter.tsx:1`

```tsx
interface CommandCenterProps { onSelectCustomer: (customerId: string) => void; }
interface CustomerWithRisk extends Customer { latestRisk?: { risk_level?: string; root_cause?: string; primary_root_cause?: string; }; }
```

**State:** `customers`, `loading`, `error`, `searchQuery`, `filterRisk` -- see §5.2.

**Data fetching -- dual-path with try/catch cascade** at `frontend/src/components/CommandCenter.tsx:25`:

```tsx
useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      try {
        const portfolio: any = await getPortfolio();            // fast bulk path
        const customersWithRisk = portfolio.customers.map((c: any) => ({
          ...c, latestRisk: { risk_level: c.risk_level, health_score: c.health_score },
        }));
        setCustomers(customersWithRisk); return;
      } catch {}
      // Fallback N+1 path:
      const customerList = await getCustomers();
      const customersWithRisk = await Promise.all(
        customerList.map(async (cust) => {
          try { const riskData: any = await getCustomerRisk(cust.id);
                let latest: any = Array.isArray(riskData) ? riskData[0] : riskData;
                return { ...cust, latestRisk: latest };
          } catch { return cust; }
        })
      );
      setCustomers(customersWithRisk);
    } catch (err: any) { setError(err.message || 'Failed...'); }
    finally { setLoading(false); }
  }; fetchData();
}, []);
```

* Empty deps `[]` -> mount-only.
* Primary: `GET /portfolio` returns `{metrics, customers}` where each customer already carries `risk_level` + `health_score`.
* Fallback: `GET /customers` + `N` parallel `GET /customers/{id}/risk` via `Promise.all`. Per-customer failures are swallowed (`return cust` bare).
* Outer catch surfaces `error`.

**Derived metrics** at `frontend/src/components/CommandCenter.tsx:60`:

```tsx
totalARR      = customers.reduce((sum, c) => sum + c.arr, 0);
criticalCount = customers.filter(c => ['CRITICAL','HIGH_RISK'].includes(c.latestRisk?.risk_level)).length;
watchCount    = customers.filter(c => ['WATCH','AT_RISK'].includes(c.latestRisk?.risk_level)).length;
atRiskARR     = customers.filter(c => ['CRITICAL','HIGH_RISK','WATCH','AT_RISK'].includes(...)).reduce((s,c)=>s+c.arr,0);
```

**Hero account:** `acmeCustomer = customers.find(c => c.name.toLowerCase().includes('acme'))` -- `frontend/src/components/CommandCenter.tsx:68`.

**Filtering + sorting** at `frontend/src/components/CommandCenter.tsx:70`:

```tsx
filteredCustomers = customers.filter(cust =>
  (cust.name + cust.domain + cust.csm_name).toLowerCase().includes(searchQuery.toLowerCase())
  && (filterRisk==='ALL' || (cust.latestRisk?.risk_level||'HEALTHY')===filterRisk)
).sort((a,b) => a.name.toLowerCase().includes('acme') ? -1 : b.name.toLowerCase().includes('acme') ? 1 : 0);
```

* Search covers `name | domain | csm_name`, case-insensitive.
* Filter pills: `ALL | CRITICAL | WATCH | HEALTHY` -- exact match on `risk_level`.
* Sort: Acme first if present, else stable input order.

**UI sections:**

| Section | File:Line | Notes |
|---|---|---|
| Loading | `frontend/src/components/CommandCenter.tsx:88` | `h-96 flex-col` spinner `border-indigo-500` + text `Connecting to RETAINAI Intelligence Engine (101 Benchmark Accounts)...` |
| Error | `frontend/src/components/CommandCenter.tsx:97` | `bg-rose-950/30 border-rose-800/50` + `AlertTriangle` + hint `Ensure the FastAPI backend is running at http://localhost:8000.` |
| Hero Banner | `frontend/src/components/CommandCenter.tsx:112` | `bg-gradient-to-r from-amber-950/40 via-indigo-950/50 to-slate-900 border-amber-500/30 rounded-2xl shadow-xl p-5`, Star icon amber, RiskBadge + CTA `bg-gradient-to-r from-amber-500 to-indigo-600 Launch Acme 360 Rescue` |
| 4 Overview Cards | `frontend/src/components/CommandCenter.tsx:144` | `grid md:grid-cols-4 gap-4`, each `bg-slate-900/60 border-slate-800 p-5 rounded-xl backdrop-blur-sm`, icons DollarSign/TrendingDown/ShieldAlert/Users, Total ARR emerald, ARR at Risk rose + `%` calc `((atRiskARR/totalARR)*100).toFixed(1)` |
| List Header | `frontend/src/components/CommandCenter.tsx:186` | `bg-slate-900/60 border rounded-xl overflow-hidden`, title + count badge `bg-indigo-950/80`, search `Search` icon + `bg-slate-950` input `placeholder-slate-600`, filter pills `bg-slate-950 p-1 border rounded-lg` active `bg-indigo-600` |
| Table | `frontend/src/components/CommandCenter.tsx:228` | `overflow-x-auto max-h-[600px] overflow-y-auto`, `thead sticky top-0 bg-slate-950/80 backdrop-blur-md uppercase` columns: Customer Account, Risk Level, ARR, Primary Root Cause, CSM Owner, Action. Rows `hover:bg-slate-800/40` Acme `bg-amber-950/20 border-l-2 border-l-amber-500` Star, name `group-hover:text-indigo-400`, domain+segment `[11px] font-mono`, ARR mono, rootCause `max-w-xs truncate`, CSM `text-[11px]`, CTA `Sparkles ArrowUpRight` indigo vs amber |

---

### 6.3 `Customer360.tsx` -- 360 View (403 lines)

**File:** `frontend/src/components/Customer360.tsx:1`

```tsx
interface Customer360Props { customerId: string; }
```

**State:** 9 atoms listed in §5.2 at `frontend/src/components/Customer360.tsx:34`.

**Data fetching** at `frontend/src/components/Customer360.tsx:45`:

```tsx
useEffect(() => {
  const fetchCustomerData = async () => {
    setLoading(true); setError(null); setInvestigationResult(null); setApprovedInterventionId(null);
    const [cust, timelineData, riskResp] = await Promise.all([
      getCustomerById(customerId),
      getCustomerTimeline(customerId, 60).catch(() => []),
      getCustomerRisk(customerId).catch(() => null)
    ]);
    setCustomer(cust); setTimeline(timelineData); setRiskData(riskResp);
  }; fetchCustomerData();
}, [customerId]);  // re-runs on customer change, resets investigation
```

* `timeline` defaults to `[]` on failure; `riskData` to `null`.
* `60` passed to `getCustomerTimeline` -> `GET /customers/{id}/timeline?days=60`.

**Handlers:**

* `handleRunInvestigation` at `frontend/src/components/Customer360.tsx:72` -- `setInvestigating(true)`, `await runInvestigation(customerId)` (`POST /agent/investigate/{id}`) -> `setInvestigationResult(result)`, then refresh `getCustomerRisk` + `getCustomerTimeline(60)` in sequence.
* `handleApproveAction` at `frontend/src/components/Customer360.tsx:91` -- reads `investigationResult.intervention_id`, `await approveIntervention(invId, customer.csm_name || "CSM")`, then `setApprovedInterventionId(invId)`. Guarded by `if (!invId) return`.

**Derived values** at `frontend/src/components/Customer360.tsx:122`:

```tsx
currentRiskLevel = riskData?.risk_level || (Array.isArray(riskData) && riskData[0]?.risk_level) || 'HEALTHY';
healthScore      = riskData?.health_score ?? (riskData?.risk_score ? 100 - riskData.risk_score : 85);
rootCauseText    = riskData?.primary_root_cause || riskData?.root_cause || (Array.isArray(riskData)&&riskData[0]?.root_cause) || 'No severe risk detected';
reasoningText    = riskData?.reasoning_summary || (Array.isArray(riskData)&&riskData[0]?.reasoning_summary) || 'Telemetry within nominal ranges.';
```

* `healthScore` fallback: if only `risk_score` exists, `100 - risk_score`; else `85`.
* Polymorphic: handles both `RiskAssessment[]` and `RiskAssessmentResponse` shapes via `Array.isArray` checks.

**UI layout:**

| Zone | File:Line | Details |
|---|---|---|
| Loading | `frontend/src/components/Customer360.tsx:105` | `h-96` spinner + `Retrieving Customer 360 Telemetry & Timeline for {customerId}...` |
| Not found | `frontend/src/components/Customer360.tsx:114` | `bg-slate-900` centered text `Customer context not found...` |
| Header Card | `frontend/src/components/Customer360.tsx:130` | `bg-slate-900/80 border p-6 rounded-xl flex md:row gap-4`, title 2xl + `RiskBadge size lg`, meta `font-mono` domain industry plan ARR emerald, CTA `bg-gradient-to-r from-indigo-600 to-violet-600 Run AI Investigation` disabled opacity-50 spinner guard |
| Grid | `frontend/src/components/Customer360.tsx:174` | `grid lg:grid-cols-3 gap-6` -- left `lg:col-span-1` (2 cards), right `lg:col-span-2` (2 cards) |
| Health Card left | `frontend/src/components/Customer360.tsx:179` | `bg-slate-900/60 border p-5 rounded-xl`, `Activity` indigo, Health Index `3xl font-extrabold` /100, Risk `TrendingDown rose`, root cause box `bg-slate-950/80 p-3 border mono 10px amber` + `reasoningText 11px` |
| Account Card | `frontend/src/components/Customer360.tsx:212` | `bg-slate-900/60 border p-5 rounded-xl space-y-3`, rows: CSM name, email mono indigo-400, lifecycle badge `bg-slate-800 11px`, renewal mono |
| AI Output Card right | `frontend/src/components/Customer360.tsx:239` | `bg-gradient-to-b from-slate-900 to-slate-950 border-indigo-900/40 shadow-xl p-6 rounded-xl`, header Bot indigo-950 + title + status pill `bg-emerald-950 border-emerald-800 CheckCircle2 Investigation Active` |
| -- Conditional result | `frontend/src/components/Customer360.tsx:257` | If `investigationResult`: Root Cause box `bg-slate-950/80 border` with ShieldAlert indigo, confidence pill `bg-indigo-950 % (uncertainty)`, summary bold + evidence pills `FileText mono 10px bg-slate-900 border-slate-700`, Action Plan `ListOrdered violet` + toggle: approved `CheckCircle2 Plan Approved emerald` vs `ThumbsUp Approve emerald bg-emerald-600` + steps `bg-slate-900/90 border p-3` numbered `bg-indigo-950` owner mono, Draft Email `Mail emerald bg-slate-950 whitespace-pre-wrap`. Else `Current Status` amber box + `Click Run AI Investigation... ArrowRight` indigo-950/30 |
| Timeline Card | `frontend/src/components/Customer360.tsx:371` | `bg-slate-900/60 border p-5 rounded-xl`, header Clock + `({n} Events)`, empty `No telemetry...`, else `pl-8 before:absolute left-3 w-0.5 bg-slate-800`, scroll `max-h-96`, event `bg-slate-950/80 border p-3 rounded-lg`, dot `bg-indigo-500 ring-4 ring-slate-900 -left-8 top-3.5`, timestamp mono 11px, source badge `bg-slate-900 border uppercase`, title semibold, desc `line-clamp-2` |

---

### 6.4 `ActionCenter.tsx` -- Learning Loop (191 lines logical, 198 file)

**File:** `frontend/src/components/ActionCenter.tsx:1`

No props -- standalone.

**State** at `frontend/src/components/ActionCenter.tsx:15`:

```tsx
memories: ExperienceMemory[]
interventions: Intervention[]
loading: boolean
error: string | null
activeTab: 'memory' | 'interventions'  // default 'memory'
```

**Data fetching** at `frontend/src/components/ActionCenter.tsx:22`:

```tsx
useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    const [memData, intData, outData] = await Promise.all([
      getExperienceMemories().catch(() => []),
      getAllInterventions().catch(() => []),
      getAllOutcomes().catch(() => []),
    ]);
    setMemories(memData); setInterventions(intData); void outData;
  }; fetchData();
}, []);
```

* `void outData` -- outcomes are fetched but **discarded** (see §11 Known Gap #3).
* All three catches return `[]` so the tab never fails to render; outer catch sets `error`.

**UI:**

| Zone | File:Line | Details |
|---|---|---|
| Loading | `frontend/src/components/ActionCenter.tsx:44` | `h-96` spinner + `Loading Learning Loop & Experience Memory Bank...` |
| Header | `frontend/src/components/ActionCenter.tsx:56` | `bg-slate-900/80 border p-6 rounded-xl flex md:row gap-4`, Brain indigo + h1 `Action Center & Learning Loop` + subtitle `Closed-loop ...`, tab pills `bg-slate-950 p-1 border rounded-lg active bg-indigo-600` Brain vs Zap + counts `({len})` |
| Error | `frontend/src/components/ActionCenter.tsx:94` | `bg-rose-950/30 border-rose-800/50 AlertTriangle rose` |
| Tab memory | `frontend/src/components/ActionCenter.tsx:102` | `grid md:grid-cols-2 gap-4`, empty `No entries... col-span-2`, else cards `bg-slate-900/60 border p-5 rounded-xl hover:border-slate-700`, segment badge `bg-indigo-950/80 mono 11px` fallback `customer_segment`, title `root_cause_category || risk_pattern`, success_rate emerald 18 mono `success_rate*100 || success_count/(success+failure) || confidence || '92%'` (fallback chain at `frontend/src/components/ActionCenter.tsx:125`), insight `bg-slate-950/60 p-3 border quotes` fallback `observed_outcome || recommended_strategy`, footer `Action Type` + `Sample Size` mono 11px fallback `success_count ?? sample_size ?? 1`, border-t |
| Tab interventions | `frontend/src/components/ActionCenter.tsx:153` | wrapper `bg-slate-900/60 border rounded-xl overflow-hidden`, header `Active & Historical Interventions {len} Plans`, empty `No plans`, else per plan `p-4 hover:bg-slate-800/20 space-y-2` title xs status pill `bg-slate-800 10px mono` date `toLocaleDateString()` objective xs meta `Steps N Priority amber Customer ID indigo 11px` |

---

### 6.5 `RiskBadge.tsx` -- Pill (34 lines)

**File:** `frontend/src/components/RiskBadge.tsx:1`

```tsx
interface RiskBadgeProps { level: string; size?: 'sm' | 'md' | 'lg'; } // default md
```

**Logic** at `frontend/src/components/RiskBadge.tsx:8`:

```tsx
const upperLevel = level ? level.toUpperCase() : 'HEALTHY';
let colorClasses = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50';
let dotColor = 'bg-emerald-500';
if (upperLevel === 'CRITICAL' || upperLevel === 'HIGH') {
  colorClasses = 'bg-rose-950/80 text-rose-400 border-rose-800/50'; dotColor = 'bg-rose-500';
} else if (upperLevel === 'WATCH' || upperLevel === 'MEDIUM') {
  colorClasses = 'bg-amber-950/80 text-amber-400 border-amber-800/50'; dotColor = 'bg-amber-500';
}
// fallback remains emerald
```

| RiskLevel input | Normalized | Visual | Notes |
|---|---|---|---|
| `HEALTHY` | `HEALTHY` | emerald-950/80 / emerald-400 / emerald dot | default |
| `CRITICAL`, `HIGH`, `HIGH_RISK`* | `CRITICAL`/`HIGH` | rose | `HIGH_RISK` misses (`!== 'HIGH'`) -> **falls through to emerald** unless caller maps |
| `WATCH`, `MEDIUM` | `WATCH`/`MEDIUM` | amber | |
| `AT_RISK`, `STABLE`, `NEUTRAL`, `HIGH_RISK` | -- | **emerald (incorrect)** | Known nuance -- see §11 |
| `undefined`/`""` | `HEALTHY` | emerald | fallback at line 9 |

*Actual API risk levels include `HIGH_RISK` and `AT_RISK` (backend `RiskLevel` has 6 values) -- the
component only handles `CRITICAL|HIGH|WATCH|MEDIUM|HEALTHY` exactly, so callers that pass raw
backend levels without mapping hit the emerald fallback. `CommandCenter` aggregates with
`['CRITICAL','HIGH_RISK']` counts but renders via `RiskBadge` raw -- `HIGH_RISK` will render
emerald before a mapping fix. CommandCenter hero fallback uses `'WATCH'` default -- `frontend/src/components/CommandCenter.tsx:131`.

**Sizing** at `frontend/src/components/RiskBadge.tsx:22`:

```tsx
sm: 'px-2 py-0.5 text-xs border'
md: 'px-2.5 py-1 text-xs border'          // default
lg: 'px-3 py-1.5 text-sm border font-medium'
```

Render: `span inline-flex gap-1.5 rounded-full sizeClasses colorClasses font-mono tracking-wider`
+ dot `h-1.5 w-1.5 rounded-full animate-pulse`.

---

## 7. API Integration

### 7.1 Client

File: `frontend/src/services/api.ts:1`

```ts
import axios from 'axios';
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
export const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });
```

* Env override: `VITE_API_BASE_URL` (Vite exposes only `VITE_` prefixed env).
* All functions are thin wrappers: `api.get/post` + `response.data` return, errors bubble to callers
  who `.catch(() => [] | null)` where tolerated.

### 7.2 Interfaces

File: `frontend/src/services/api.ts:12`

| Interface | File:Line | Fields (abridged) |
|---|---|---|
| `Customer` | `frontend/src/services/api.ts:12` | `id name domain segment industry plan arr csm_name csm_email start_date renewal_date lifecycle_stage is_false_positive_candidate? created_at` |
| `RiskAssessment` | `frontend/src/services/api.ts:29` | `id customer_id timestamp risk_level(4 union) risk_score confidence trend delta_points root_cause reasoning_summary alternative_explanations evidence_ids contributing_factors` |
| `InterventionStep` | `frontend/src/services/api.ts:45` | `step title owner action target_date` |
| `DraftEmail` | `frontend/src/services/api.ts:53` | `recipient_name recipient_role subject body` |
| `RetentionPlan` | `frontend/src/services/api.ts:60` | `objective priority root_cause steps draft_email` |
| `InvestigationResult` | `frontend/src/services/api.ts:68` | `status assessment plan` (legacy shape) |
| `Intervention` | `frontend/src/services/api.ts:74` | `id customer_id risk_assessment_id created_at status action_type title objective priority plan_steps draft_email csm_feedback_reason?` |
| `InterventionOutcome` | `frontend/src/services/api.ts:89` | `id intervention_id evaluated_at status usage_delta_pct support_tickets_resolved sentiment_delta_score health_delta_score evaluation_summary` |
| `ExperienceMemory` | `frontend/src/services/api.ts:101` | `id industry_segment root_cause_category intervention_type sample_size successful_outcomes success_rate key_insights confidence last_updated` |
| `TimelineEvent` | `frontend/src/services/api.ts:114` | `id timestamp type title description? source severity? details?` |
| `Signal` | `frontend/src/services/api.ts:125` | `id signal_type severity description detected_at` |
| `RiskAssessmentResponse` | `frontend/src/services/api.ts:133` | `customer_id health_score risk_score risk_level primary_root_cause reasoning_summary contributing_factors? delta_points? trend?` |
| `FullAgentInvestigationResponse` | `frontend/src/services/api.ts:145` | `run_id customer_id health_dimensions risk_assessment investigation{summary,root_cause,confidence,uncertainty_status,evidence_ids,recommended_action_summary,missing_evidence} retention_plan{objective,priority,action_type,title,description,plan_steps,draft_email?} intervention_id` |

### 7.3 Endpoint table -- 15 exported functions

| # | Export | File:Line | Method & Path | Return | Used in | Fallback / Unused note |
|---|---|---|---|---|---|---|
| 1 | `getCustomers` | `frontend/src/services/api.ts:172` | `GET /customers` | `Customer[]` | `CommandCenter` fallback, `getAllInterventions` fallback loop | Fallback path only if `getPortfolio` fails |
| 2 | `getCustomer` | `frontend/src/services/api.ts:177` | `GET /customers/{id}` | `Customer` | -- aliased | Alias only |
| 3 | `getCustomerById` | `frontend/src/services/api.ts:182` | alias to `getCustomer` | `Customer` | `Customer360` | Re-export identity `= getCustomer` |
| 4 | `getCustomerTimeline` | `frontend/src/services/api.ts:184` | `GET /customers/{id}/timeline?days=60` default 60 | `TimelineEvent[]` | `Customer360` (60) | Caller passes `60` explicitly; catch -> `[]` |
| 5 | `getCustomerRisk` | `frontend/src/services/api.ts:189` | `GET /customers/{id}/risk` | `RiskAssessmentResponse \| RiskAssessment[]` (any) | `CommandCenter` (N+1), `Customer360` | Handles both array and single via `Array.isArray` at call sites |
| 6 | `getCustomerSignals` | `frontend/src/services/api.ts:194` | `GET /customers/{id}/signals` | `Signal[]` | **Not used** | Exported but no component imports it |
| 7 | `runInvestigation` | `frontend/src/services/api.ts:199` | `POST /agent/investigate/{id}` | `FullAgentInvestigationResponse` | `Customer360` | Primary agent trigger |
| 8 | `getInvestigation` | `frontend/src/services/api.ts:204` | `GET /agent/runs/{runIdOrCustomerId}` | `any` | **Not used** | Exported, no caller |
| 9 | `approveIntervention` | `frontend/src/services/api.ts:209` | `POST /interventions/{id}/approve?approved_by=CSM` | `Intervention` | `Customer360` | `approvedBy` is `customer.csm_name \|\| "CSM"`, `encodeURIComponent` at `frontend/src/services/api.ts:210` |
| 10 | `resetDemo` | `frontend/src/services/api.ts:214` | `POST /system/reset` | `{status, message}` | `App` | Triggers full DB drop+seed |
| 11 | `getCustomerInterventions` | `frontend/src/services/api.ts:219` | `GET /customers/{id}/interventions` | `Intervention[]` | `getAllInterventions` fallback loop internally | |
| 12 | `triggerInvestigation` | `frontend/src/services/api.ts:224` | `POST /agent/investigate/{id}` alias | `InvestigationResult` (legacy) | **Not used** | Duplicate of `runInvestigation` with different response typing |
| 13 | `getExperienceMemories` | `frontend/src/services/api.ts:229` | `GET /learning/memories` -> fallback `GET /experience-memory` on catch | `ExperienceMemory[]` | `ActionCenter` | Try/catch cascade at `frontend/src/services/api.ts:230` -- legacy route support |
| 14 | `getAllInterventions` | `frontend/src/services/api.ts:239` | `GET /interventions` -> fallback per-customer aggregation if empty | `Intervention[]` | `ActionCenter` | If `response.data.length===0`, loops `getCustomers()` + per-customer `getCustomerInterventions` -- `frontend/src/services/api.ts:243` |
| 15 | `getPortfolio` | `frontend/src/services/api.ts:260` | `GET /portfolio` | `{metrics, customers}` | `CommandCenter` primary path | Fast bulk path -- `frontend/src/components/CommandCenter.tsx:31` |
| -- | `getAllOutcomes` | `frontend/src/services/api.ts:265` | `GET /outcomes` | `InterventionOutcome[]` | `ActionCenter` (fetched then `void`) | Fetched in `Promise.all` but discarded via `void outData` -- `frontend/src/components/ActionCenter.tsx:33` |

**Error handling convention:** API functions bubble; components decide tolerance.
Bulk-tolerated calls use `.catch(() => [] | null)`, critical path (`getCustomers`, `getCustomerById`)
let errors surface to outer `catch -> setError`.

---

## 8. Data Fetching Patterns

### 8.1 Bulk portfolio vs N+1

`CommandCenter` implements an optimistic bulk-first pattern -- `frontend/src/components/CommandCenter.tsx:30`:

```
try  getPortfolio()           -> 1 request  -> done
catch -> getCustomers() + NxgetCustomerRisk  -> 1 + N requests
```

* Bulk (`GET /portfolio`) is preferred -- single round-trip, metrics bundled.
* N+1 is a true fallback, not a parallel strategy -- empty `catch {}` swallows the bulk failure silently.
* Per-customer `getCustomerRisk` failures are individually caught (`return cust`) so one bad account does not fail the portfolio.

### 8.2 `Promise.all` for independent resources

`Customer360` at `frontend/src/components/Customer360.tsx:53` fetches 3 independent resources in parallel:

```tsx
const [cust, timelineData, riskResp] = await Promise.all([
  getCustomerById(customerId),
  getCustomerTimeline(customerId, 60).catch(() => []),
  getCustomerRisk(customerId).catch(() => null)
]);
```

`ActionCenter` at `frontend/src/components/ActionCenter.tsx:26` fetches 3 in parallel:

```tsx
const [memData, intData, outData] = await Promise.all([
  getExperienceMemories().catch(() => []),
  getAllInterventions().catch(() => []),
  getAllOutcomes().catch(() => []),
]);
```

Pattern: fastest-possible load, per-resource `.catch` so one failing endpoint does not reject the `Promise.all`.

### 8.3 Sequential refresh after mutation

`handleRunInvestigation` at `frontend/src/components/Customer360.tsx:79` does **sequential** refresh after the POST:

```tsx
const result = await runInvestigation(customerId);
setInvestigationResult(result);
const updatedRisk = await getCustomerRisk(customerId).catch(() => null);
const updatedTimeline = await getCustomerTimeline(customerId, 60).catch(() => []);
setRiskData(updatedRisk); setTimeline(updatedTimeline);
```

Not `Promise.all` -- ordered so risk is available before timeline renders (minor, but intentional).

### 8.4 What is *not* done

* No SWR/React Query caching, no deduplication, no polling, no WebSocket.
* No abort controller -- stale `customerId` races are possible if user clicks rapidly across customers
  (the `useEffect [customerId]` at `frontend/src/components/Customer360.tsx:70` resets `investigationResult`
  but does not cancel in-flight fetches).
* No pagination -- all lists assume ~101 customers fit in one response.

---

## 9. Design Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| Tab state instead of router | 3 views, no deep-link requirement, smallest bundle | No bookmarkable URLs, no browser history, no `/:id` share link |
| Local `useState` only | State is shallow and co-located; global store would be ceremony | No cross-tab state sync; prop drilling is 1 level deep only |
| `axios` over `fetch` | Interceptor-ready client, `baseURL` centralization, familiar error shape | Extra dep vs native `fetch`; but justified by `API_BASE_URL` env logic |
| `lucide-react` for icons | Tree-shakable SVG components, consistent stroke model | No icon font, no extra CSS |
| `any` for `riskData` | API returns polymorphic `RiskAssessmentResponse \| RiskAssessment[]` | Callers use `Array.isArray` guards; stricter typing would need a union helper |
| `getPortfolio` primary + N+1 fallback | Bulk endpoint is faster; N+1 keeps UI working if bulk unavailable | Two code paths to maintain; per-customer risk mapping duplicates logic |
| Per-resource `.catch(() => [] \| null)` | Degraded-but-rendered UX over hard error | Silent failures -- no toast for individual customer risk fetch failures |
| `max-h-[600px]` + `max-h-96` scroll containers | Keep tables/timelines bounded without page scroll jank | Requires `overflow-y-auto` management; sticky headers need `backdrop-blur` |
| Gradient accents on hero/CTA | Hero account (Acme) needs visual prominence in demo | `amber` hero is a demo-specific affordance, not a domain concept |
| No memo optimization | 101 rows render is cheap; memo would obscure data-flow | Every render recomputes `filteredCustomers` and metrics -- acceptable at this scale |

---

## 10. Build & Dev

### 10.1 Vite config

File: `frontend/vite.config.ts:1`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
```

* `plugin-react` enables Fast Refresh + JSX transform.
* Proxy: any `/api/*` request from the dev server rewrites to `http://localhost:8000` -- avoids CORS in dev.
  The path prefix is **not** `http://localhost:8000/api/v1` -- the client already includes `/api/v1` in
  `API_BASE_URL`, so the proxy forwards `http://localhost:8000/api/v1/...` correctly via `changeOrigin`.

### 10.2 Env override

`frontend/src/services/api.ts:3`:

```ts
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
```

* Set `VITE_API_BASE_URL=http://your-host/api/v1` in `.env` or shell to target a different backend.
* `.env` at repo root is **not** auto-loaded by Vite unless `VITE_` prefixed -- use `frontend/.env` or
  export in shell. Vite requires restart after env change.

### 10.3 Tailwind config

File: `frontend/tailwind.config.js:1` -- `content` globs `index.html` + `src/**/*.{js,ts,jsx,tsx}`,
brand palette extension `brand: {50,100,500,600,700,900}` (`#f0f9ff` -> `#0c4a6e`) which is **defined
but never referenced** -- UI uses `slate|indigo|emerald|rose|amber|violet` directly.

### 10.4 PostCSS & Tailwind directives

* `frontend/postcss.config.js:1` -- `tailwindcss` + `autoprefixer`.
* `frontend/src/index.css:1` -- `@tailwind base; @tailwind components; @tailwind utilities;` + `body` bg `#0f172a`.

### 10.5 TypeScript

File: `frontend/tsconfig.json:1` -- `target ES2020`, `module ESNext`, `moduleResolution bundler`,
`jsx react-jsx`, `strict true`, `noUnusedLocals/Parameters true`, `baseUrl .` with `@/* -> src/*`
alias (alias is configured but **no import uses it** -- all imports are relative `../services/api`).

### 10.6 Scripts

File: `frontend/package.json:6`

| Script | Command | Notes |
|---|---|---|
| `dev` | `vite` | Dev server `http://localhost:5173` with HMR + proxy |
| `build` | `tsc && vite build` | Type-check then bundle to `dist/` |
| `lint` | `tsc --noEmit` | Type-check only -- no ESLint despite name |
| `preview` | `vite preview` | Serve `dist/` locally on `5173` |

* No `test` script -- no frontend unit tests.
* No `.eslintrc` -- editing `lint` to run ESLint will fail until config is added.
* `dist/` is nginx root in Docker; `vite build` hashes assets.

### 10.7 nginx SPA fallback

File: `frontend/nginx.conf:1`

```nginx
server {
  listen 5173;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

* Single `try_files` rule -- any unknown path serves `index.html` so tab state (which is JS-only)
  does not 404 on refresh. Actual path still ignored by JS router (no router to read it), so
  refresh always lands on default tab.
* No gzip/brotli, no caching headers, no `/api` proxy -- in prod, API must be separately routed
  (e.g., compose `depends_on` or gateway).

### 10.8 Docker multi-stage

File: `frontend/Dockerfile:1`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
```

* Stage 1: `npm ci` (clean install) -> `npm run build` -> `dist`.
* Stage 2: `nginx:alpine` with `dist` as `root` + custom `nginx.conf`, `5173`.
* No `ARG VITE_API_BASE_URL` -- build-time env must be injected via `VITE_API_BASE_URL` at
  `docker build --build-arg` + `ARG` plumbing if you need a non-localhost API in the image.

### 10.9 Running locally

```bash
cd frontend
npm ci                  # or npm install
npm run dev             # http://localhost:5173  (expects backend on :8000)
# or prod preview:
npm run build && npm run preview
# env override:
VITE_API_BASE_URL=http://staging.example.com/api/v1 npm run dev
```

---

## 11. Key User Flows

### 11.1 CommandCenter -> 360 -> Agent -> Approve -> Learning

The happy path that demonstrates the `SENSE->THINK->ACT->MEASURE->LEARN` loop:

```
1. Land on Command Center (activeTab='command')
   GET /portfolio (or GET /customers + Nx GET /customers/{id}/risk)
   -> 4 metric cards, hero Acme banner, searchable table (101 rows)

2. Search / filter:
   Typing in search input (Search icon) filters name|domain|csm_name live
   Clicking filter pill ALL|CRITICAL|WATCH|HEALTHY does exact risk_level match
   Table re-sorts Acme first; rows hover indigo, click row OR 360 View button

3. Deep dive:
   Click customer row -> onSelectCustomer(id) -> setSelectedCustomerId + activeTab='customer360'
   Customer360 mounts: Promise.all(getCustomerById + getCustomerTimeline(60) + getCustomerRisk)
   -> Header card with RiskBadge lg + CTA, Health Index /100, root cause box, ownership card

4. Investigate:
   Click "Run AI Investigation" (gradient indigo->violet, Sparkles)
   POST /agent/investigate/{id} -> FullAgentInvestigationResponse
   UI shows Bot header + Investigation Active emerald pill, then:
     - Root Cause Diagnosed (ShieldAlert) + confidence% (uncertainty)
     - Evidence citation pills (FileText, mono, bg-slate-900)
     - Recommended Action Plan (ListOrdered violet) + Approve button (ThumbsUp emerald)
     - Draft Email (Mail) with subject + body whitespace-pre-wrap

5. Approve:
   Click "Approve Intervention Plan" -> POST /interventions/{id}/approve?approved_by=CSM
   Button flips to "Plan Approved" CheckCircle2 emerald, approvedInterventionId set

6. Verify learning:
   Switch to Action & Learning (Brain tab)
   GET /learning/memories (or /experience-memory fallback) + GET /interventions (+ GET /outcomes voided)
   -> Experience Memory grid shows segment badge, success_rate emerald %, insight quotes, sample size
   -> Recorded Plans tab shows Active & Historical Interventions with status + priority amber
```

### 11.2 Reset Demo

```
Header -> Reset Demo (RefreshCw, bg-slate-900, border-slate-700)
  POST /system/reset  (App.tsx:23)
  On success: toast bg-emerald-950/80 + window.location.reload() after 1000ms
  On failure: alert("Reset endpoint failed ... uv run python -m retainai.scripts.seed_database")
  Note: seed drops all tables -- destructive, not idempotent (see §12.3)
```

### 11.3 Direct navigation

```
Header nav pill (bg-slate-900/90) has 3 buttons:
  Command Center (LayoutDashboard)  -> activeTab='command'
  Customer 360   (Users)            -> activeTab='customer360' (shows last selectedCustomerId)
  Action & Learning (Brain)         -> activeTab='actions'
No URL change -- refresh always returns to 'command' (no persistence to localStorage or URL).
```

---

## 12. Edge Cases & Known Gaps

| # | Gap | File:Line | Impact | Workaround / Fix |
|---|---|---|---|---|
| 1 | **AT_RISK badge renders emerald (healthy)** | `frontend/src/components/RiskBadge.tsx:14` -- only `CRITICAL\|HIGH\|WATCH\|MEDIUM` handled; `AT_RISK` falls through to default emerald | Watchlist accuracy: `AT_RISK` accounts appear healthy | Add `upperLevel === 'AT_RISK' \|\| upperLevel === 'HIGH_RISK'` branches; or normalize backend levels to component levels at `frontend/src/services/api.ts:189` |
| 2 | **HIGH_RISK badge also emerald** | Same branch -- `HIGH_RISK !== HIGH` string check fails | Critical count correct but badge wrong color | Include `HIGH_RISK` in rose branch |
| 3 | **getAllOutcomes fetched then discarded** | `frontend/src/components/ActionCenter.tsx:33` `void outData` | Outcomes never surface in UI; `getAllOutcomes()` at `frontend/src/services/api.ts:265` is effectively dead fetches | Remove `getAllOutcomes` from `Promise.all` or render an outcomes tab; currently wastes 1 request per ActionCenter mount |
| 4 | **Footer backend URL hardcoded** | `frontend/src/App.tsx:129` `http://localhost:8000` literal | Staging/prod footer lies about connected host | Read from `API_BASE_URL` or `import.meta.env.VITE_API_BASE_URL` |
| 5 | **No auth, no CSRF, no request headers** | `frontend/src/services/api.ts:5` -- only `Content-Type: application/json` | Any browser can hit `POST /system/reset` and drop DB | Add auth header + backend guard (see `docs/SECURITY.md`) |
| 6 | **No pagination** | `frontend/src/components/CommandCenter.tsx:228` `max-h-[600px]` scroll, `frontend/src/components/ActionCenter.tsx:154` bare list | 101 rows fits but 10k would jank; timeline `max-h-96` similar | Add `limit/offset` query + virtualized list |
| 7 | **No router / deep links** | `frontend/src/App.tsx:119` conditional render | Cannot share `customerId` URL, refresh loses context | Adopt `react-router-dom` with `/:customerId` param + `useSearchParams` for filters |
| 8 | **`getCustomerSignals` + `getInvestigation` exported but unused** | `frontend/src/services/api.ts:194` + `frontend/src/services/api.ts:204` | Dead code, confuses API table | Remove or wire to a Signals panel in `Customer360` |
| 9 | **`triggerInvestigation` duplicate of `runInvestigation`** | `frontend/src/services/api.ts:224` vs `:199` | Two exports hitting same `POST /agent/investigate/{id}` with different return types | Delete `triggerInvestigation`, keep typed `runInvestigation` |
| 10 | **`@/*` alias unused** | `frontend/tsconfig.json:24` | Configured but no import uses `@/` -- misleading | Either migrate imports to `@/` or remove alias |
| 11 | **`brand` palette in tailwind.config.js unused** | `frontend/tailwind.config.js:10` `brand.{50,100,500,600,700,900}` | Dead theme extension; clutters config | Remove or apply to buttons (e.g., `bg-brand-500`) |
| 12 | **Race on rapid customer click** | `frontend/src/components/Customer360.tsx:45` no abort controller | Stale `setCustomer` may win over newer fetch if user clicks rows quickly | Add `AbortController` per `useEffect` + cancel on cleanup |
| 13 | **`healthScore` fallback `85` is arbitrary** | `frontend/src/components/Customer360.tsx:123` `... : 85` | HEALTHY default even when risk endpoint fails | Surface explicit "unknown" state instead of silent 85 |
| 14 | **Search + filter have no URL persistence** | `frontend/src/components/CommandCenter.tsx:22` | Refresh resets query, cannot share filtered view | Persist to `localStorage` or URL search params |
| 15 | **`lint` script is misnamed** | `frontend/package.json:9` `tsc --noEmit` | CI `npm run lint` does type-check, not lint | Add real ESLint config + `eslint .` script |

---

## 13. Tooling & Standards

| Concern | Choice | File |
|---|---|---|
| Formatting | Prettier not configured; Tailwind class order is manual | -- |
| Lint | `tsc --noEmit` only (strict) -- no ESLint | `frontend/package.json:9`, `frontend/tsconfig.json:18` |
| Types | `strict: true`, `noUnusedLocals/Parameters true` | `frontend/tsconfig.json:18` |
| Module resolution | `bundler` -- `allowImportingTsExtensions`, `isolatedModules` | `frontend/tsconfig.json:10` |
| JSX | `react-jsx` -- no `React` import needed except for `useState`/`useEffect` usage | `frontend/tsconfig.json:15` |
| Build | `tsc && vite build` -- type-check before emit | `frontend/package.json:8` |
| Preview | `vite preview` -- serves `dist/` | `frontend/package.json:10` |
| No tests | No frontend test runner, no `test` script | `frontend/package.json:6` |
| Async | `async/await` only -- no `.then` chains in components | `frontend/src/components/*` |
| Error surfaces | Loading spinner (`border-indigo-500 animate-spin`) vs rose error panel (`bg-rose-950/30`) | `frontend/src/components/CommandCenter.tsx:88` |

---

## 14. File Map -- Quick Reference

| Concern | File |
|---|---|
| App shell + tabs + reset | `frontend/src/App.tsx:8` |
| Axios client + all interfaces | `frontend/src/services/api.ts:5` |
| `getPortfolio` bulk endpoint | `frontend/src/services/api.ts:260` |
| `getCustomers` + `getCustomerRisk` fallback | `frontend/src/services/api.ts:172` + `:189` |
| `runInvestigation` + `approveIntervention` | `frontend/src/services/api.ts:199` + `:209` |
| `getExperienceMemories` fallback cascade | `frontend/src/services/api.ts:229` |
| `getAllInterventions` per-customer fallback | `frontend/src/services/api.ts:239` |
| CommandCenter mount + metrics | `frontend/src/components/CommandCenter.tsx:25` + `:60` |
| CommandCenter search + filter | `frontend/src/components/CommandCenter.tsx:70` |
| Customer360 fetch + handlers | `frontend/src/components/Customer360.tsx:45` + `:72` |
| Customer360 derived risk/health | `frontend/src/components/Customer360.tsx:122` |
| ActionCenter fetch (void outData) | `frontend/src/components/ActionCenter.tsx:26` |
| RiskBadge color + size logic | `frontend/src/components/RiskBadge.tsx:11` + `:22` |
| Tailwind body bg + font | `frontend/src/index.css:5` |
| Vite proxy + port | `frontend/vite.config.ts:7` |
| Brand palette (unused) | `frontend/tailwind.config.js:10` |
| Path alias `@/*` (unused) | `frontend/tsconfig.json:23` |
| SPA fallback | `frontend/nginx.conf:5` |
| Docker build | `frontend/Dockerfile:1` |

---

*Generated for RETAINAI frontend `0.1.0`. Last synced with code 2026-08-30. No router, no store --
when in doubt, trust the code links above over this prose.*

