# RETAINAI -- UI Design System

> **Source of truth:** Code under `frontend/` -- `frontend/src/index.css:5`,
> `frontend/tailwind.config.js:1`, `frontend/src/App.tsx:37`, and component files.
> All tokens below are derived from implementation as of 2026-08-30.

---

## 1. Principles

* **Dark-first, enterprise** -- `bg-slate-950` canvas, `indigo->violet` hero accents, semantic
  `emerald` (healthy) / `rose` (critical) / `amber` (watch) overlays.
* **Tailwind-only, no component library** -- every class is explicit in JSX; no `shadcn/ui`,
  no Radix, no MUI. Reuse is by copying the proven `bg-slate-900/60 border-slate-800 rounded-xl` recipe.
* **Density over whitespace** -- 11–12px labels are first-class; `gap-4`, `p-4/5/6`, `max-h-*` scroll
  belts keep 101 rows scannable above the fold.
* **Demo affordance** -- the Acme hero banner (`amber` gradient, `border-amber-500/30`) is a
  demo-scoped pattern, not a domain primitive -- see §9.

---

## 2. Color Palette

### 2.1 Primitive tokens (Tailwind)

All colors are Tailwind defaults -- no custom hex besides `body bg #0f172a` --
`frontend/src/index.css:12`. The `brand` extension in `frontend/tailwind.config.js:10`
(`#f0f9ff` -> `#0c4a6e`) is **defined but unused** -- see §10.

### 2.2 Slate -- canvas & surfaces

| Token | Hex (Tailwind) | Usage | Example File:Line |
|---|---|---|---|
| `bg-slate-950` | `#020617` | Page canvas, header 80% blur, table thead, search input | `frontend/src/App.tsx:37`, `frontend/src/App.tsx:39`, `frontend/src/components/CommandCenter.tsx:230` |
| `bg-slate-950/80` | 80% opacity | Header backdrop + toast reasoning box | `frontend/src/App.tsx:39`, `frontend/src/components/Customer360.tsx:203` |
| `bg-slate-950/60` | 60% opacity | Timeline cards, footer, insight quotes | `frontend/src/components/Customer360.tsx:382`, `frontend/src/components/ActionCenter.tsx:137` |
| `bg-slate-900/80` | 80% opacity | 360 header card, ActionCenter header | `frontend/src/components/Customer360.tsx:130`, `frontend/src/components/ActionCenter.tsx:56` |
| `bg-slate-900/60` | 60% opacity | Overview cards, customer list wrapper, health cards, intervention wrapper | `frontend/src/components/CommandCenter.tsx:146`, `frontend/src/components/CommandCenter.tsx:186`, `frontend/src/components/Customer360.tsx:179` |
| `bg-slate-900/90` | 90% opacity | Retention step rows | `frontend/src/components/Customer360.tsx:323` |
| `bg-slate-900` | `#0f172a` | Nav pill, search pills, status pills, evidence pills | `frontend/src/App.tsx:60`, `frontend/src/components/CommandCenter.tsx:209`, `frontend/src/components/Customer360.tsx:286` |
| `bg-slate-800/50` | 50% opacity | Hover on nav, table row hover, divide separators | `frontend/src/App.tsx:66`, `frontend/src/components/CommandCenter.tsx:256` |
| `bg-slate-800` | `#1e293b` | Badge bg (lifecycle, status) | `frontend/src/components/Customer360.tsx:225`, `frontend/src/components/ActionCenter.tsx:171` |
| `border-slate-900` | -- | Footer top | `frontend/src/App.tsx:125` |
| `border-slate-800/80` | 80% opacity | Header border, insight border | `frontend/src/App.tsx:39`, `frontend/src/components/ActionCenter.tsx:137` |
| `border-slate-800` | -- | Card borders (default) | `frontend/src/components/CommandCenter.tsx:146`, `frontend/src/components/Customer360.tsx:179` |
| `border-slate-800/50` | 50% opacity | Divide, error rose border 50% | `frontend/src/components/CommandCenter.tsx:240`, `frontend/src/components/CommandCenter.tsx:99` |
| `border-slate-700` | -- | Evidence pill, reset button | `frontend/src/components/Customer360.tsx:286`, `frontend/src/App.tsx:101` |
| `border-slate-700/80` | 80% opacity | Reset demo border | `frontend/src/App.tsx:101` |
| `text-slate-100` | `#f1f5f9` | Titles, headings strong | `frontend/src/App.tsx:49`, `frontend/src/components/CommandCenter.tsx:151` |
| `text-slate-200` | `#e2e8f0` | Card titles, strong rows | `frontend/src/components/CommandCenter.tsx:261`, `frontend/src/components/Customer360.tsx:205` |
| `text-slate-300` | `#cbd5e1` | Body secondary, evidence text | `frontend/src/components/CommandCenter.tsx:229`, `frontend/src/components/Customer360.tsx:272` |
| `text-slate-400` | `#94a3b8` | Meta labels, subtitle, inactive nav | `frontend/src/App.tsx:54`, `frontend/src/App.tsx:66` |
| `text-slate-500` | `#64748b` | Tertiary, timestamps, dot rings bg | `frontend/src/App.tsx:126`, `frontend/src/components/Customer360.tsx:384` |

**Background global:** `body { background-color: #0f172a }` at `frontend/src/index.css:12`
which is `slate-900` pure -- canvas uses `slate-950 (#020617)` so cards `slate-900/60` contrast on
`slate-950`. Selection: `selection:bg-indigo-500 selection:text-white` at `frontend/src/App.tsx:37`.

### 2.3 Indigo / Violet -- primary actions

| Token | Usage | File:Line |
|---|---|---|
| `bg-indigo-600` | Active tab pill, filter pill active, tab pills active, count badges hover | `frontend/src/App.tsx:65`, `frontend/src/components/CommandCenter.tsx:216`, `frontend/src/components/ActionCenter.tsx:73` |
| `bg-indigo-950/80` | Badge bg (indigo pill), step number | `frontend/src/App.tsx:50`, `frontend/src/components/Customer360.tsx:324` |
| `bg-indigo-950` | Bot icon box, pill inner | `frontend/src/components/Customer360.tsx:242` |
| `bg-indigo-950/30` | Hint box "Click Run..." | `frontend/src/components/Customer360.tsx:362` |
| `from-indigo-600 to-violet-600` | CTA Run AI Investigation gradient + hover `from-indigo-500 to-violet-500` | `frontend/src/components/Customer360.tsx:148` |
| `from-indigo-600 to-violet-500` | Brand Shield gradient `from-indigo-600 to-violet-500` | `frontend/src/App.tsx:44` |
| `bg-gradient-to-tr` | Shield `bg-gradient-to-tr` diagonal | `frontend/src/App.tsx:44` |
| `text-indigo-400` | Brand AI suffix, % badge, hint arrow, icons | `frontend/src/App.tsx:49`, `frontend/src/components/CommandCenter.tsx:152`, `frontend/src/components/Customer360.tsx:245` |
| `text-indigo-300` | Hint box text, step title | `frontend/src/components/Customer360.tsx:362`, `frontend/src/components/Customer360.tsx:286` |
| `text-indigo-200` | Sparkles on CTA | `frontend/src/components/Customer360.tsx:159` |
| `border-indigo-800/50` | Badge border, Bot box, AI output card | `frontend/src/App.tsx:50`, `frontend/src/components/Customer360.tsx:239` |
| `border-indigo-900/40` | AI Output card border | `frontend/src/components/Customer360.tsx:239` |
| `shadow-indigo-950` | Tab active shadow, CTA shadow `shadow-lg shadow-indigo-950/50`, Shield `shadow-indigo-950` | `frontend/src/App.tsx:45`, `frontend/src/App.tsx:65`, `frontend/src/components/Customer360.tsx:148` |

### 2.4 Emerald -- healthy / success / ARR

| Token | Usage | File:Line |
|---|---|---|
| `bg-emerald-950/80` | RiskBadge HEALTHY bg | `frontend/src/components/RiskBadge.tsx:11` |
| `bg-emerald-950` | Success pill (approved, Investigation Active) | `frontend/src/components/Customer360.tsx:251`, `frontend/src/components/Customer360.tsx:302` |
| `bg-emerald-600` -> `hover:bg-emerald-500` | Approve button + success_rate `text-emerald-400` 18 mono + Draft Email subject | `frontend/src/components/Customer360.tsx:309`, `frontend/src/components/ActionCenter.tsx:124` |
| `text-emerald-400` | Healthy badge, ARR Total, success %, health ARR | `frontend/src/components/RiskBadge.tsx:11`, `frontend/src/components/CommandCenter.tsx:152`, `frontend/src/components/Customer360.tsx:143` |
| `text-emerald-300` | Toast `bg-emerald-950/80 border-emerald-800/80`, approved badge | `frontend/src/App.tsx:112`, `frontend/src/components/Customer360.tsx:302` |
| `border-emerald-800/50` | Badge border | `frontend/src/components/RiskBadge.tsx:11` |
| `shadow-emerald-950` | Approve button `shadow-md shadow-emerald-950` | `frontend/src/components/Customer360.tsx:309` |
| `bg-emerald-500` dot | Footer system dot `animate-pulse`, emerald dot in badge | `frontend/src/App.tsx:128`, `frontend/src/components/RiskBadge.tsx:12` |

### 2.5 Rose -- critical / error / at-risk

| Token | Usage | File:Line |
|---|---|---|
| `bg-rose-950/80` | RiskBadge CRITICAL bg | `frontend/src/components/RiskBadge.tsx:15` |
| `bg-rose-950/30` | Error panel bg `bg-rose-950/30 border-rose-800/50` | `frontend/src/components/CommandCenter.tsx:99`, `frontend/src/components/Customer360.tsx:167`, `frontend/src/components/ActionCenter.tsx:95` |
| `text-rose-400/80` | Sub-label "Immediate Agent Intervention" | `frontend/src/components/CommandCenter.tsx:172` |
| `text-rose-400` | Critical ARR, error title, TrendingDown icon, CRITICAL badge | `frontend/src/components/CommandCenter.tsx:160`, `frontend/src/components/RiskBadge.tsx:15` |
| `text-rose-300` | Error body, error panel text | `frontend/src/components/CommandCenter.tsx:99` |
| `text-rose-200` | Error heading | `frontend/src/components/CommandCenter.tsx:102` |
| `border-rose-800/50` | Badge + error border | `frontend/src/components/RiskBadge.tsx:15`, `frontend/src/components/CommandCenter.tsx:99` |
| `bg-rose-500` dot | Rose badge dot `animate-pulse` | `frontend/src/components/RiskBadge.tsx:16` |

### 2.6 Amber -- watch / featured / warning

| Token | Usage | File:Line |
|---|---|---|
| `bg-amber-950/80` | RiskBadge WATCH bg | `frontend/src/components/RiskBadge.tsx:18` |
| `bg-amber-500/20` | Watch card title ring, Acme hero badge | `frontend/src/components/CommandCenter.tsx:200`? actually `Acme Hero` at `frontend/src/components/CommandCenter.tsx:121` `bg-amber-500/20 text-amber-300 border border-amber-500/30` |
| `bg-amber-950/20` + `border-l-2 border-l-amber-500` | Acme table row highlight | `frontend/src/components/CommandCenter.tsx:257` |
| `from-amber-950/40 via-indigo-950/50 to-slate-900` + `border-amber-500/30` | Acme Hero Banner gradient | `frontend/src/components/CommandCenter.tsx:113` |
| `from-amber-500 to-indigo-600` | Acme CTA gradient (hover `from-amber-400 to-indigo-500`) | `frontend/src/components/CommandCenter.tsx:134` |
| `text-amber-400/80` | Watchlist subtitle "Early Warning..." | `frontend/src/components/CommandCenter.tsx:181` |
| `text-amber-400` | WATCH badge, Star icon, 10px Primary Root Cause label, priority | `frontend/src/components/RiskBadge.tsx:18`, `frontend/src/components/CommandCenter.tsx:180`, `frontend/src/components/Customer360.tsx:204`, `frontend/src/components/ActionCenter.tsx:186` |
| `text-amber-300` | Acme row CTA, hero badge | `frontend/src/components/CommandCenter.tsx:289`, `frontend/src/components/CommandCenter.tsx:121` |
| `border-amber-800/50` | Badge | `frontend/src/components/RiskBadge.tsx:18` |
| `border-amber-500/30` + `border-amber-500/40` | Hero banner + hero badge + CTA | `frontend/src/components/CommandCenter.tsx:113`, `frontend/src/components/CommandCenter.tsx:289` |
| `bg-amber-500` dot | WATCH dot `animate-pulse` | `frontend/src/components/RiskBadge.tsx:19` |

### 2.7 Violet -- secondary accent

| Token | Usage | File:Line |
|---|---|---|
| `text-violet-400` | ListOrdered icon in Action Plan | `frontend/src/components/Customer360.tsx:298` |
| `to-violet-500` / `to-violet-600` | Gradients alongside indigo (Shield, CTA) | `frontend/src/App.tsx:44`, `frontend/src/components/Customer360.tsx:148` |

### 2.8 Summary -- semantic mapping

| Semantic | Token | Example |
|---|---|---|
| Canvas | `bg-slate-950` (`#020617`) | Page, header backdrop, table thead |
| Surface (card) | `bg-slate-900/60 + border-slate-800` | All overview cards, list wrapper, timeline |
| Surface strong | `bg-slate-900/80` | 360 header, ActionCenter header |
| Primary action | `bg-indigo-600 -> violet` gradient + `shadow-indigo-950` | Tabs active, CTA |
| Success / healthy / ARR | `emerald-400` text on `emerald-950/80` bg | Healthy badge, Total ARR, success % |
| Danger / critical | `rose-400` on `rose-950/30` bg | Critical badge, ARR at Risk, error panels |
| Warning / featured | `amber-400` on `amber-950/80` bg + `amber-500` dot | Watch badge, Acme hero, priority |
| Disabled | `opacity-50` + `animate-spin` guard | Investigating / approving buttons |
| Borders default | `border-slate-800` (80% on header/pills) | Cards, tables, pills |

---

## 3. Typography

### 3.1 Global font

File: `frontend/src/index.css:5`

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #0f172a;
  color: #f8fafc;
}
```

* No Google Fonts, no `@font-face` -- system sans stack.
* Smoothing hints ensure crisp rendering on macOS/Windows.
* `font-sans` on root at `frontend/src/App.tsx:37` pins Tailwind sans to this stack.

### 3.2 Monospace

Applied selectively via `font-mono` for data, badges, domains, emails, counts:

| Where | Size | Color | File:Line |
|---|---|---|---|
| Wordmark `RETAINAI` | `text-base font-extrabold tracking-tight` + `font-mono` | white / indigo-400 suffix | `frontend/src/App.tsx:49` |
| Badge `v1.0 Autonomous Engine` | `10px rounded-full uppercase tracking-wider` | `bg-indigo-950 text-indigo-400` | `frontend/src/App.tsx:50` |
| Footer + Loop Protocol | `xs text-slate-500 font-mono` | slate-500 | `frontend/src/App.tsx:126` |
| RiskBadge | `xs–sm tracking-wider` | per-color | `frontend/src/components/RiskBadge.tsx:29` |
| ARR values | `text-2xl font-bold` + `font-mono` on table `arr` | emerald/rose/slate-200 | `frontend/src/components/CommandCenter.tsx:151`, `frontend/src/components/CommandCenter.tsx:271` |
| Domain + segment + email | `font-mono` `11px` or `xs` | slate-500 / indigo-400 | `frontend/src/components/CommandCenter.tsx:266`, `frontend/src/components/Customer360.tsx:221` |
| Evidence pills | `10px font-mono bg-slate-900 border-slate-700` | slate-300 | `frontend/src/components/Customer360.tsx:286` |
| Timestamps timeline | `11px font-mono` | slate-500? actually `text-slate-400` | `frontend/src/components/Customer360.tsx:385` |
| Source badge timeline | `10px font-mono uppercase` | slate-300 | `frontend/src/components/Customer360.tsx:386` |
| Counts success_rate | `text-lg font-extrabold font-mono` | emerald-400 | `frontend/src/components/ActionCenter.tsx:124` |
| Footer memory | `11px font-mono` | slate-400 -> strong slate-300 | `frontend/src/components/ActionCenter.tsx:141` |

### 3.3 Headings scale

| Level | Class | Size | Weight | Usage |
|---|---|---|---|---|
| Page h1 | `text-2xl font-bold text-slate-100` | 24px | 700 | 360 customer name `frontend/src/components/Customer360.tsx:133`, ActionCenter `frontend/src/components/ActionCenter.tsx:60` |
| Hero h3 | `text-xl font-bold text-white` | 20px | 700 | Acme banner name `frontend/src/components/CommandCenter.tsx:123` |
| Card h2 | `text-base font-bold text-slate-100` | 16px | 700 | AI Output `Autonomous Investigation...` `frontend/src/components/Customer360.tsx:246` |
| Card h3 | `text-sm font-semibold text-slate-200` + optional icon indigo-400 4x4 | 14px | 600 | Deterministic Risk Engine `frontend/src/components/Customer360.tsx:180`, Account Ownership `frontend/src/components/Customer360.tsx:213`, Timeline `frontend/src/components/Customer360.tsx:374` |
| Table thead | `uppercase tracking-wider font-semibold text-xs text-slate-400` | 12px | 600 | `frontend/src/components/CommandCenter.tsx:230` |
| Label xs | `text-xs font-semibold uppercase tracking-wider text-slate-400` | 12px | 600 | Overview card labels `Total Portfolio ARR` `frontend/src/components/CommandCenter.tsx:148` |
| Micro label | `text-[10px] font-mono uppercase tracking-wider` | 10px | 500 | `v1.0`, `Primary Root Cause`, `Evidence Grounding`, `Hero Scenario` -> amber/indigo variants |
| Micro 11px | `text-[11px] font-mono` | 11px | 400–600 | Domain, lifecycle, renewal, customer ID line |

### 3.4 Body text

| Style | Class | Usage |
|---|---|---|
| Default xs | `text-xs text-slate-400` | Subtitles, list helper `frontend/src/components/ActionCenter.tsx:62` |
| Strong xs | `text-xs font-medium text-slate-200/300` | Row names `frontend/src/components/CommandCenter.tsx:261` |
| Muted 11px | `text-[11px] text-slate-500` | CSM email subline `frontend/src/components/CommandCenter.tsx:279` |
| Quote  xs | `text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border-slate-800/50` + quotes around content | Memory insight `frontend/src/components/ActionCenter.tsx:137` |
| Email body | `text-xs whitespace-pre-wrap font-sans leading-relaxed` | Draft email pre `frontend/src/components/Customer360.tsx:347` |

---

## 4. Layout & Spacing

### 4.1 Page shell

| Layer | Classes | File:Line |
|---|---|---|
| Root | `min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white` | `frontend/src/App.tsx:37` |
| Container | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | `frontend/src/App.tsx:40`, `frontend/src/App.tsx:118`, footer |
| Header | `sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 h-16 flex justify-between items-center` | `frontend/src/App.tsx:39` |
| Main | `py-8` inside container -- vertical rhythm `space-y-6` on each tab root | every tab: `space-y-6` |
| Footer | `border-t border-slate-900 bg-slate-950/60 py-4 mt-12` + `flex flex-col sm:flex-row justify-between gap-2 font-mono text-xs text-slate-500` | `frontend/src/App.tsx:125` |

`max-w-7xl` = `80rem / 1280px` -- fixed cap on all sections, responsive padding `px-4 -> sm:px-6 -> lg:px-8`.

### 4.2 Headers -- sticky & backdrop

* Header is `sticky top-0 z-50` with `backdrop-blur-md` + `bg-slate-950/80` -- content scrolls
  under it; table thead is also sticky (`sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md`) so the
  thead pins below the global header inside the `max-h-[600px]` scroll belt.
* AI Output card header has `border-b border-slate-800/80 pb-3 mb-4 flex justify-between` with
  left Bot icon box `p-1.5 bg-indigo-950 border` and right status pill.

### 4.3 Cards

Standard recipe -- used 10+ times:

```html
<div class="bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-sm">
```

Variants:

| Variant | Classes | Where |
|---|---|---|
| Default card | `bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-sm` | Overview cards `frontend/src/components/CommandCenter.tsx:146` |
| Strong header card | `bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm` | 360 header + ActionCenter header |
| Saturated AI card | `bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-900/40 p-6 rounded-xl shadow-xl` | AI Output `frontend/src/components/Customer360.tsx:239` |
| Empty state | `p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-500 text-xs` | Memories empty `frontend/src/components/ActionCenter.tsx:106` |
| Nested inner box | `bg-slate-950/80 p-3 rounded-lg border border-slate-800` | Root cause `frontend/src/components/Customer360.tsx:203`, evidence `frontend/src/components/Customer360.tsx:279` |
| Nested step row | `bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex gap-3` | Plan steps `frontend/src/components/Customer360.tsx:323` |
| Timeline event | `bg-slate-950/80 border border-slate-800 p-3 rounded-lg relative` | Timeline `frontend/src/components/Customer360.tsx:382` |
| Hero banner | `bg-gradient-to-r from-amber-950/40 via-indigo-950/50 to-slate-900 border border-amber-500/30 p-5 rounded-2xl shadow-xl overflow-hidden` | Acme `frontend/src/components/CommandCenter.tsx:113` |

Padding scale: `p-3` (inner boxes)  |  `p-4` (list rows)  |  `p-5` (cards)  |  `p-6` (header cards) -- no `p-8` except empty states.

Gap scale: `gap-1.5` (pill internals)  |  `gap-2` (icons)  |  `gap-3` (header groups)  |  `gap-4` (grids)  |  `gap-6` (main grid).

Rounding: `rounded-md` (filter pills, inner)  |  `rounded-lg` (inputs, buttons)  |  `rounded-xl` (cards, nav, hero)  |  `rounded-2xl` (hero banner)  |  `rounded-full` (badges, dots).

### 4.4 Grids

| Grid | Classes | File:Line |
|---|---|---|
| Overview 4-col | `grid grid-cols-1 md:grid-cols-4 gap-4` | `frontend/src/components/CommandCenter.tsx:145` |
| 360 main | `grid grid-cols-1 lg:grid-cols-3 gap-6` -- left `lg:col-span-1 space-y-6`, right `lg:col-span-2 space-y-6` | `frontend/src/components/Customer360.tsx:174` |
| Memories | `grid grid-cols-1 md:grid-cols-2 gap-4` | `frontend/src/components/ActionCenter.tsx:104` |
| Nav pill | `flex gap-1 bg-slate-900/90 p-1 border border-slate-800/80 rounded-xl` | `frontend/src/App.tsx:60` |
| Header flex | `flex flex-col md:flex-row justify-between gap-4` -- responsive stack on mobile | `frontend/src/components/Customer360.tsx:130`, `frontend/src/components/ActionCenter.tsx:56` |

### 4.5 Tables

File: `frontend/src/components/CommandCenter.tsx:228`

```html
<div class="overflow-x-auto max-h-[600px] overflow-y-auto">
  <table class="w-full text-left text-xs text-slate-300">
    <thead class="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md uppercase tracking-wider font-semibold border-b border-slate-800">
    <tbody class="divide-y divide-slate-800/50">
      <tr class="hover:bg-slate-800/40 group cursor-pointer">
```

* `max-h-[600px]` is a virtual viewport -- table scrolls independently.
* `sticky` thead with blur prevents content bleed.
* `divide-y divide-slate-800/50` soft rules between rows.
* Acme row override `bg-amber-950/20 border-l-2 border-l-amber-500`.

### 4.6 Timeline vertical line

File: `frontend/src/components/Customer360.tsx:380`

```html
<div class="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800 pl-8 max-h-96 overflow-y-auto pr-2">
  <div class="relative bg-slate-950/80 ...">
    <div class="absolute -left-8 top-3.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
```

* `before:` pseudo on container paints a `0.5px` vertical `bg-slate-800` at `left-3`.
* Each event dot `bg-indigo-500 ring-4 ring-slate-900` at `-left-8 top-3.5` sits on the line.
* `max-h-96` scroll keeps the timeline bounded; `pl-8` indents cards past the line.

---

## 5. Components Inventory

### 5.1 Buttons

| Variant | Classes | Size | Icon | File:Line |
|---|---|---|---|---|
| **Primary tab active** | `bg-indigo-600 text-white shadow-md shadow-indigo-950 rounded-lg font-semibold` | `px-3.5 py-1.5 text-xs flex gap-2` | LayoutDashboard/Users/Brain 3.5 | `frontend/src/App.tsx:63` |
| **Tab inactive** | `text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg` | same | same | `frontend/src/App.tsx:66` |
| **CTA gradient indigo->violet** | `bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-950/50 rounded-lg font-medium` | `px-5 py-2.5 text-sm flex gap-2` | Sparkles 4 | `frontend/src/components/Customer360.tsx:148` |
| **Approve emerald** | `bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-950 rounded-lg` | `px-3.5 py-1.5 text-xs flex gap-1.5` | ThumbsUp 3.5 | `frontend/src/components/Customer360.tsx:309` |
| **360 View indigo** | `bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/50 text-indigo-300 rounded-lg` | `px-3 py-1.5 text-xs inline-flex gap-1` | Sparkles 3.5 ArrowUpRight 3 | `frontend/src/components/CommandCenter.tsx:290` |
| **360 View amber (Acme)** | `bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300` | same | same | `frontend/src/components/CommandCenter.tsx:289` |
| **Acme CTA gradient** | `bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-bold shadow-lg shadow-amber-950/40 rounded-xl` | `px-4 py-2 text-xs flex gap-2` | Sparkles 4 ArrowUpRight 4 | `frontend/src/components/CommandCenter.tsx:134` |
| **Ghost pills (filter)** | `px-2.5 py-1 rounded-md` active `bg-indigo-600 text-white` vs `text-slate-400 hover:text-slate-200` | `text-xs` | none | `frontend/src/components/CommandCenter.tsx:214` |
| **Reset demo** | `bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white rounded-xl font-medium` | `px-3 py-1.5 text-xs flex gap-1.5` | RefreshCw 3.5 indigo-400 | `frontend/src/App.tsx:101` |

Disabled state: `disabled:opacity-50` on investigating CTA, disabled `resetting` on header.
Focus ring: default browser (no `focus:` overrides beyond `focus:outline-none focus:border-indigo-500` on inputs).

### 5.2 Form controls

**Search input** -- `frontend/src/components/CommandCenter.tsx:199`:

```html
<div class="relative flex-1 md:w-64">
  <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
  <input placeholder="Filter accounts or CSMs..."
         class="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600" />
</div>
```

* `pl-9` reserves space for the icon; `placeholder-slate-600` is the only placeholder styling.
* No label element -- placeholder is the label (accessibility gap -- see §9).
* Other inputs: none -- the rest of the UI is read-only or button-driven.

### 5.3 Pills / Badges

| Pill | Classes | Font | Where |
|---|---|---|---|
| **RiskBadge** | `inline-flex gap-1.5 rounded-full font-mono tracking-wider border + {size} + {color}` + dot `h-1.5 w-1.5 animate-pulse` | `xs` (sm/md)  |  `sm` (lg) | `frontend/src/components/RiskBadge.tsx:22` |
| **Count badge indigo** | `bg-indigo-950/80 text-indigo-400 text-xs px-2.5 py-0.5 rounded-full border border-indigo-800/40` | `xs` | `frontend/src/components/CommandCenter.tsx:190` |
| **Version `v1.0` badge** | `text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800/50 px-2 py-0.5 rounded-full uppercase tracking-wider` | `10px mono` | `frontend/src/App.tsx:50` |
| **Hero scenario badge** | `bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full` | `10px mono` | `frontend/src/components/CommandCenter.tsx:121` |
| **Segment badge** | `text-[11px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/40` | `11px mono` | `frontend/src/components/ActionCenter.tsx:117` |
| **Status pill** | `bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded` | `10px mono` | `frontend/src/components/ActionCenter.tsx:171` |
| **Evidence pill** | `bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded` | `10px mono` | `frontend/src/components/Customer360.tsx:286` |
| **Source badge** | `text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase` | `10px mono` | `frontend/src/components/Customer360.tsx:386` |
| **Confidence pill** | `text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded` | `11px mono` | `frontend/src/components/Customer360.tsx:265` |
| **Investigation Active** | `text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2.5 py-1 rounded-full flex gap-1` + `CheckCircle2 3.5` | `xs mono` | `frontend/src/components/Customer360.tsx:251` |
| **Plan Approved** | `text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg flex gap-1` + `CheckCircle2 3.5` | `xs font-semibold` | `frontend/src/components/Customer360.tsx:302` |
| **Filter pills container** | `flex gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs` | `xs` | `frontend/src/components/CommandCenter.tsx:209` |
| **Tab pills container (ActionCenter)** | `flex bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs` | `xs font-medium` | `frontend/src/components/ActionCenter.tsx:68` |
| **Nav pill container** | `flex gap-1 bg-slate-900/90 p-1 border border-slate-800/80 rounded-xl` | `xs font-semibold` | `frontend/src/App.tsx:60` |

Sizing for `RiskBadge` -- `frontend/src/components/RiskBadge.tsx:22`:

| Size | Classes | Usage |
|---|---|---|
| `sm` | `px-2 py-0.5 text-xs border` | Table rows (implied default path) |
| `md` | `px-2.5 py-1 text-xs border` | Default -- Acme hero, table `frontend/src/components/CommandCenter.tsx:131` |
| `lg` | `px-3 py-1.5 text-sm border font-medium` | 360 header `frontend/src/components/Customer360.tsx:134` |

### 5.4 Cards -- see §4.3 for full recipe

Repeated inner patterns: `p-3 rounded-lg bg-slate-950/80 border` for data boxes,
`p-5 rounded-xl bg-slate-900/60 border` for list cards, `p-6 rounded-xl` for headers.

### 5.5 Tables -- see §4.5

Responsive `overflow-x-auto`, capped `max-h-[600px]` belt, sticky thead, `divide-y` rows,
truncate on Root Cause `max-w-xs truncate`.

### 5.6 Timeline -- see §4.6

Container `before:` vertical line + per-event `bg-indigo-500 ring-4` dot + `max-h-96` scroll.

### 5.7 Empty / loading / error states

| State | Classes | File:Line |
|---|---|---|
| Loading | `flex flex-col items-center justify-center h-96 text-slate-400 gap-3` + `w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin` + label `text-sm` | `frontend/src/components/CommandCenter.tsx:90`, `frontend/src/components/Customer360.tsx:107`, `frontend/src/components/ActionCenter.tsx:46` |
| Error panel | `p-6 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 flex gap-3` + `AlertTriangle 6 text-rose-400 shrink-0` + heading `font-semibold text-rose-200` + helper `text-sm text-rose-400/80` | `frontend/src/components/CommandCenter.tsx:99` |
| Error inline | `p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex gap-2` + `AlertTriangle 4` | `frontend/src/components/Customer360.tsx:167` |
| Empty table row | `p-8 text-center text-slate-500` inside `colSpan` row | `frontend/src/components/CommandCenter.tsx:243` |
| Empty timeline | `text-slate-500 text-xs py-4 text-center` | `frontend/src/components/Customer360.tsx:378` |
| Empty memories | `col-span-2 p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-500 text-xs` | `frontend/src/components/ActionCenter.tsx:106` |
| Empty plans | `p-8 text-center text-slate-500 text-xs` | `frontend/src/components/ActionCenter.tsx:162` |
| Toast | `bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-300 text-xs py-2 px-4 text-center font-mono animate-fade-in` | `frontend/src/App.tsx:112` |

Loading labels are specific per tab: `Connecting to RETAINAI Intelligence Engine (101 Benchmark Accounts)...` vs `Retrieving Customer 360 Telemetry & Timeline for {id}...` vs `Loading Learning Loop & Experience Memory Bank...`.

---

## 6. Icons -- lucide-react 0.344

All icons are React components (`lucide-react`), `strokeWidth 2` default, sized `w-3.5 h-3.5` -> `w-6 h-6`.

| Icon | Size | Color | Where | File:Line |
|---|---|---|---|---|
| `Shield` | `w-5 h-5 text-white` inside `w-9 h-9 gradient` | white on indigo->violet | Brand logo | `frontend/src/App.tsx:45` |
| `LayoutDashboard` | `w-3.5 h-3.5` | inherits tab | Nav Command | `frontend/src/App.tsx:69` |
| `Users` | `w-3.5 h-3.5` / `w-4 h-4 text-amber-400` | per-tab / Watchlist | Nav 360 + Watchlist card | `frontend/src/App.tsx:81`, `frontend/src/components/CommandCenter.tsx:178` |
| `Brain` | `w-3.5 h-3.5` / `w-6 h-6 text-indigo-400` | per-tab / header | Nav Actions + ActionCenter H1 | `frontend/src/App.tsx:93`, `frontend/src/components/ActionCenter.tsx:59` |
| `RefreshCw` | `w-3.5 h-3.5 text-indigo-400 + animate-spin when resetting` | indigo-400 | Reset button | `frontend/src/App.tsx:104` |
| `DollarSign` | `w-4 h-4 text-emerald-400` | emerald | Total ARR card | `frontend/src/components/CommandCenter.tsx:149` |
| `TrendingDown` | `w-4 h-4 text-rose-400` / `w-3.5 h-3.5 text-rose-400` | rose | ARR at Risk + Risk Assessment inline | `frontend/src/components/CommandCenter.tsx:158`, `frontend/src/components/Customer360.tsx:195` |
| `ShieldAlert` | `w-4 h-4 text-rose-400` / `w-4 h-4` indigo in Root Cause | rose / indigo | Critical card + Root Cause Diagnosed | `frontend/src/components/CommandCenter.tsx:168`, `frontend/src/components/Customer360.tsx:263` |
| `AlertTriangle` | `w-6 h-6 text-rose-400` / `w-4 h-4` | rose | Error panels | `frontend/src/components/CommandCenter.tsx:100`, `frontend/src/components/Customer360.tsx:168` |
| `Search` | `w-4 h-4 text-slate-500 absolute left-3` | slate-500 | Search input | `frontend/src/components/CommandCenter.tsx:198` |
| `Sparkles` | `w-3.5–4 h-3.5–4` + `w-4 text-indigo-200` on gradient CTA | per-button | All 360 CTAs | `frontend/src/components/CommandCenter.tsx:293`, `frontend/src/components/Customer360.tsx:159` |
| `Star` | `w-6 h-6 fill-amber-400/20 text-amber-400` / `w-3.5 h-3.5 fill-amber-400` | amber | Hero banner + Acme row | `frontend/src/components/CommandCenter.tsx:116`, `frontend/src/components/CommandCenter.tsx:264` |
| `ArrowUpRight` | `w-4 h-4` / `w-3 h-3 text-slate-400` | slate-400 / white | Hero CTA + row CTA | `frontend/src/components/CommandCenter.tsx:138`, `frontend/src/components/CommandCenter.tsx:295` |
| `Building` | `w-3.5 h-3.5 text-slate-500` | slate-500 | Domain inline | `frontend/src/components/Customer360.tsx:137` |
| `Activity` | `w-4 h-4 text-indigo-400` | indigo | Health card heading | `frontend/src/components/Customer360.tsx:181` |
| `Bot` | `w-5 h-5 text-indigo-400` inside `bg-indigo-950` | indigo | AI Output header | `frontend/src/components/Customer360.tsx:243` |
| `CheckCircle2` | `w-3.5 h-3.5` | emerald | Investigation Active + Plan Approved | `frontend/src/components/Customer360.tsx:252`, `frontend/src/components/Customer360.tsx:303` |
| `Clock` | `w-4 h-4 text-indigo-400` | indigo | Timeline heading | `frontend/src/components/Customer360.tsx:373` |
| `ArrowRight` | `w-4 h-4 shrink-0` | indigo-300 | "Click Run" hint | `frontend/src/components/Customer360.tsx:364` |
| `ListOrdered` | `w-4 h-4 text-violet-400` | violet | Action Plan heading | `frontend/src/components/Customer360.tsx:298` |
| `FileText` | `w-3.5 h-3.5 text-indigo-400` | indigo | Evidence citations | `frontend/src/components/Customer360.tsx:281` |
| `ThumbsUp` | `w-3.5 h-3.5` | white | Approve button | `frontend/src/components/Customer360.tsx:314` |
| `Mail` | `w-4 h-4` | emerald-400 | Draft Email header | `frontend/src/components/Customer360.tsx:342` |
| `Zap` | `w-3.5 h-3.5` | per-tab | ActionCenter Recorded Plans | `frontend/src/components/ActionCenter.tsx:88` |

No icon is custom SVG -- all come from `lucide-react`. No `icon_font` sprite.

---

## 7. States & Interactions

| State | Class | Where |
|---|---|---|
| **Hover (row)** | `hover:bg-slate-800/40` (+ `group-hover:text-indigo-400` on name) | `frontend/src/components/CommandCenter.tsx:256`, `:262` |
| **Hover (card)** | `hover:border-slate-700` | Memories `frontend/src/components/ActionCenter.tsx:113` |
| **Hover (pill button)** | `hover:text-slate-200 hover:bg-slate-800/50` (inactive nav), `hover:bg-amber-500/30` (Acme row), `hover:bg-indigo-900` (indigo row), `hover:from-amber-400 hover:to-indigo-500` (Acme CTA) | `frontend/src/App.tsx:66`, `frontend/src/components/CommandCenter.tsx:289` |
| **Hover (plan row)** | `hover:bg-slate-800/20` | `frontend/src/components/ActionCenter.tsx:167` |
| **Active (tab)** | `bg-indigo-600 text-white shadow-md shadow-indigo-950 font-semibold` | `frontend/src/App.tsx:65`, `frontend/src/components/CommandCenter.tsx:216` |
| **Focus (input)** | `focus:outline-none focus:border-indigo-500` | `frontend/src/components/CommandCenter.tsx:204` |
| **Disabled** | `disabled:opacity-50` + guard `disabled={investigating\|approving\|resetting}` + spinner replaces icon | `frontend/src/components/Customer360.tsx:149`, `:308`, `frontend/src/App.tsx:100` |
| **Loading spin** | `animate-spin` on `RefreshCw` + `w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full` + `w-4 h-4 border-2 border-white border-t-transparent` | `frontend/src/App.tsx:104`, `frontend/src/components/CommandCenter.tsx:91`, `frontend/src/components/Customer360.tsx:154` |
| **Pulse** | `animate-pulse` on `h-1.5 w-1.5 rounded-full` dot (RiskBadge) + footer emerald dot `w-2 h-2 bg-emerald-500 animate-pulse` | `frontend/src/components/RiskBadge.tsx:30`, `frontend/src/App.tsx:128` |
| **Fade-in** | `animate-fade-in` on toast (Tailwind default animation -- no custom keyframes defined, relies on Tailwind) | `frontend/src/App.tsx:112` |
| **Cursor** | `cursor-pointer` on table rows only | `frontend/src/components/CommandCenter.tsx:256` |
| **Backdrop blur** | `backdrop-blur-md` on header + table thead; `backdrop-blur-sm` on cards | `frontend/src/App.tsx:39`, `frontend/src/components/CommandCenter.tsx:230`, `:146` |

No focus rings beyond default, no keyboard trap, no `active:scale-95` -- interaction model is
mouse-first. Keyboard navigation works via native `tabIndex` on buttons/inputs only.

---

## 8. Responsive Breakpoints

Tailwind defaults (`sm:640px md:768px lg:1024px xl:1280px`) -- no custom screens in
`frontend/tailwind.config.js:1`.

| Breakpoint | Behavior | File:Line |
|---|---|---|
| Base (mobile) | `px-4`, single-col grids, stacked header `flex-col`, toast centered, table `overflow-x-auto` | `frontend/src/App.tsx:40`, `grid-cols-1` |
| `sm:` | `px-6` on container, subtitle `hidden sm:block`, `sm:px-6` | `frontend/src/App.tsx:40`, `:54` |
| `md:` | `md:grid-cols-4` overview, `md:flex-row` hero/banner between, `md:w-64` search, `hidden md:inline` Reset label, `md:flex-row justify-between` headers | `frontend/src/components/CommandCenter.tsx:145`, `:113`, `:198`, `frontend/src/App.tsx:105` |
| `lg:` | `lg:px-8`, `lg:grid-cols-3` 360 main, `lg:col-span-*` split | `frontend/src/App.tsx:40`, `frontend/src/components/Customer360.tsx:174` |
| `md:grid-cols-2` | Memories grid splits at `md` | `frontend/src/components/ActionCenter.tsx:104` |

No `xl:` usage. Tables never collapse to cards on mobile -- they scroll horizontally.
Hero banner stacks (`flex-col`) on mobile -> side-by-side `md:flex-row`.

---

## 9. Accessibility Notes

| Topic | Current State | Gap | Recommendation |
|---|---|---|---|
| Color contrast | `slate-400` on `slate-950` (~5.8:1) passes WCAG AA for small text; `indigo-400` on `slate-950` (~4.9:1) marginal but acceptable; `rose-400` + `amber-400` used at `xs` with 80% bg -- contrast is close to threshold | Pill text `10–11px` at low font-weight may fall below AA when on `slate-900` | Audit with `axe` at `10px mono` + increase weight to `medium` on pills or bump to `amber-300` lighter |
| Keyboard nav | All controls are `button` / `input` / `a` -- reachable via Tab; no `tabIndex` overrides | No visible `focus:ring` custom -- focus ring is default browser (often `outline` hidden by `focus:outline-none` on search input | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` to primary buttons/inputs |
| Labels | Search has `placeholder="Filter accounts or CSMs..."` but no `aria-label` or `<label>`; filter pills use text content; timeline timestamps are human-readable but not `datetime` | Screen readers announce placeholder only until typed | Add `aria-label="Filter accounts or CSMs"` to search input; add `aria-pressed` to filter pills; add `<time datetime={evt.timestamp}>` to timeline |
| Semantics | Table has proper `thead/tbody/tr/th/td`, `colSpan` on empty row, `sticky thead`; headings use `h1/h2/h3` correctly per tab | No `<nav>` landmark wraps the pill nav (it is `nav` at `frontend/src/App.tsx:60` -- correct), but no `aria-current="page"` on active tab | Add `aria-current="page"` to active `button` |
| Motion | `animate-spin` and `animate-pulse` are the only animations; no `prefers-reduced-motion` query | Users with vestibular disorders cannot disable spin | Add `@media (prefers-reduced-motion: reduce) { .animate-spin, .animate-pulse { animation: none; } }` |
| Images/alt | No `<img>` anywhere -- all imagery is CSS/icon -- no alt gap | -- | -- |
| Live regions | Toast `resetMessage` appears but is not `role="status"`/`aria-live`; investigation result replaces static box without announcement | Screen reader may miss async updates | Wrap toast in `<div role="status" aria-live="polite">`, wrap AI output in `aria-live="polite"` |

No `skipToContent` link, no heading outline tooling. The system is informally accessible for
demo use; prod would need a dedicated `axe` + keyboard audit pass.

---

## 10. What Is NOT Used

| Not used | Supposed alternative in config | Why omitted |
|---|---|---|
| `shadcn/ui` / Radix primitives | -- | Every component is bare Tailwind + `lucide-react` -- no headless library needed at this scale |
| `brand` palette | `frontend/tailwind.config.js:10` defines `brand: {50,100,500,600,700,900}` (`#f0f9ff` -> `#0c4a6e`) | Never referenced -- tailwind scans `src/**/*` and finds no `bg-brand-*` / `text-brand-*`; kept as scaffold for future theming |
| `@/*` alias | `frontend/tsconfig.json:23` `baseUrl .` + `paths: {"@/*": ["src/*"]}` | No import uses `@/`; all imports are relative (`../services/api`) |
| Charts lib | -- | No charts -- metrics are `text-2xl` numbers + `%` + timeline table |
| CSS modules / scoped CSS | -- | `frontend/src/index.css:1` is the only CSS file -- directives + one `body` rule |
| `rounded-full` images / avatars | -- | No user avatars -- CSM shown as `name + mono email` |
| Dark/light theme toggle | -- | Dark-only; `bg-slate-950` is the only canvas; no `prefers-color-scheme` branch |
| Extra Tailwind plugins | `frontend/tailwind.config.js:21` `plugins: []` | No typography/forms/aspect-ratio plugin |

---

## 11. Visual Reference -- Component Moods

* **Header** -- `sticky` slate-950/80 blur, Shield indigo->violet, mono wordmark, pill nav slate-900/90.
* **Acme Hero** -- amber->indigo gradient, Star fill, amber CTA amber->indigo, hero badge, RiskBadge md.
* **Cards** -- `slate-900/60 / border-slate-800 / rounded-xl / p-5` with `xs uppercase tracking-wider` labels.
* **Tables** -- `max-h-[600px]` belt, `sticky` thead `slate-950/80 blur`, `divide-y`, Acme `amber-950/20 border-l`.
* **AI Output** -- `from-slate-900 to-slate-950` + `border-indigo-900/40` + `shadow-xl`, Bot indigo-950 box.
* **Timeline** -- `before:` line `slate-800`, dots `indigo-500 ring-4 slate-900`, cards `slate-950/80`.
* **Badges** -- `rounded-full` + `font-mono tracking-wider` + `h-1.5 w-1.5 animate-pulse`; colors per §2 semantic mapping.

---

## 12. File Map -- Quick Reference

| Concern | File |
|---|---|
| Tailwind directives + body bg #0f172a + sans stack | `frontend/src/index.css:5` |
| Brand palette extension (unused) | `frontend/tailwind.config.js:10` |
| PostCSS tailwind + autoprefixer | `frontend/postcss.config.js:1` |
| Shell + header + nav + footer tokens | `frontend/src/App.tsx:37` |
| Search input + filter pills tokens | `frontend/src/components/CommandCenter.tsx:198` |
| Overview cards + hero + table tokens | `frontend/src/components/CommandCenter.tsx:113` + `:145` + `:228` |
| Health + account + AI + timeline tokens | `frontend/src/components/Customer360.tsx:130` + `:179` + `:239` + `:380` |
| Memories + plans tokens | `frontend/src/components/ActionCenter.tsx:56` + `:104` + `:154` |
| RiskBadge color + size | `frontend/src/components/RiskBadge.tsx:11` + `:22` |
| States `hover/active/spin/pulse` | `frontend/src/components/CommandCenter.tsx:256`, `frontend/src/App.tsx:65` |
| Icons lucide | `frontend/src/App.tsx:6`, `frontend/src/components/CommandCenter.tsx:4`, `frontend/src/components/Customer360.tsx:13` |
| Responsive `max-w-7xl`, `md:grid-cols-*` | `frontend/src/App.tsx:40`, `frontend/src/components/CommandCenter.tsx:145` |
| Vite proxy + port, nginx SPA fallback | `frontend/vite.config.ts:7`, `frontend/nginx.conf:5` |

---

*Generated for RETAINAI frontend `0.1.0`. Last synced with code 2026-08-30. Tailwind-only, no shadcn --
when in doubt, trust the code links above over this prose.*

