# RETAINAI Data EDA Report

Generated: 2026-08-30T11:18:31.979504+00:00
Dataset: dataset-v2 seed 42 generated 2026-08-30T07:04:00.588571+00:00
Source: `data/seed/retainai_dataset_v2.json`

## Dataset Overview

| Entity | Records | Notes |
|--------|--------:|-------|
| Customers | 101 | 101 inc 1 Acme |
| Usage events | 3131 | 31 per customer (31*101=3131) |
| Support tickets | 82 | 82, avg 0.81/cust |
| Feedback | 94 | 94, avg 0.93/cust |
| Date range | 2026-07-31 → 2026-08-30 | 30 days window |
| Entities | 5 archetypes + Acme | See archetype audit |
| Cardinality | customers PK 101 unique, usage 3131 unique, tickets 82 unique | No duplicates |

## Univariate Analysis

### Customers

- **MRR:** min 1019, max 12000, mean 3137, median 2960
  - Mid-Market uniform 1k-5k; Acme 12k outlier intentional
- **Tiers:** Enterprise Acme 1, Mid-Market 100 (generator hardcodes Mid-Market for portfolio) — no SMB variance
- **Archetypes:** {'ACME_HERO': 1, 'HEALTHY': 60, 'EARLY_WARNING': 19, 'RECOVERING': 7, 'CRITICAL': 2, 'AT_RISK': 12}
- **Renewal dates:** now+30..300d, spread uniform

### Usage

- **DAU:** min 16, max 537, mean 245.0, std≈ 130.7
- **license_utilization_pct:** min 0.20, max 0.90, mean 0.76
  - Archetype-fixed: HEALTHY 0.85, AT_RISK 0.50, CRITICAL 0.20, others 0.70 — no within-archetype variance
- **core_feature_clicks:** 5×DAU, min 70, max 2689
- **admin_logins:** 0–5, HEALTHY 0-2, Acme 0 last 7
- **Missing:** 0, outliers: Acme high not outlier by IQR

### Support Tickets

- **Per archetype:** HEALTHY 0.30 (low), CRITICAL 2.5
- **Severity:** HIGH 69 (84%), MEDIUM 13
- **Category:** SOFTWARE 46, NETWORK 18, SECURITY 17, BUG 1
- **Status:** OPEN 64, RESOLVED 18
- **Missing:** resolved_at null for OPEN (64) expected

### Feedback

- **Sentiment:** POSITIVE 44 47%, NEGATIVE 26 28%, NEUTRAL 24 26%
- **Score:** 1:8 2:6 3:9 4:3 5:7 6:12 7:5 8:17 9:13 10:14
  - Archetype bands: HEALTHY 8-10, AT_RISK 1-4, CRITICAL 1-2 — synthetic clustering

## Bivariate Analysis

Observed (SYNTHETIC — not causal):

- **usage decline vs risk (archetype):** HEALTHY stable → HEALTHY risk, CRITICAL -70% → CRITICAL risk. Association is BY DESIGN (archetype drives both).
- **support volume vs risk:** CRITICAL 1-2 tickets/customer vs HEALTHY 0.3 — association positive.
- **negative feedback vs risk:** CRITICAL 100% neg rate (but small n), HEALTHY low — association.

> Label: ASSOCIATION ONLY — synthetic generation encodes these; do not interpret as discovered predictive feature.

## Temporal Analysis

- **Daily activity:** 101 events/day uniform (one per customer per day).
- **Usage trajectories:** See archetype audit. Acme: [188,184,197,181,186,197,187,180,193,124,123,123,139,143,123,137,139,126,121,144,147,132,140,63,53,57,44,80,74,55,69] (clear cliff at index 9).
- **Support over time:** uniform random 1-10% daily prob, not bursty.
- **Feedback over time:** random 2-5% daily; no seasonality.

## Customer-Level Analysis

Representative timelines (31d):

- **HEALTHY (Synthetic Company 0, base DAU ~300):** flat 270-330 DAU, util 0.85, 0 tickets, positive feedback 9.
- **AT_RISK (example AT_RISK cust):** first 16d ~baseline, last 15d ~60% DAU, 1 HIGH ticket OPEN, feedback 2 NEGATIVE.
- **CRITICAL (example):** first 10d baseline, days 11-25 30% baseline, last 5d 5% baseline — extreme.
- **Acme:** as above, matches intended story Day -21 decline, Day -14 ticket, Day -10 feedback, Day -7 admin 0, Day 0 critical health.

## Missing-data Visualization (text)

- Customers: 0 missing required
- Usage: 0 missing
- Tickets: 64 null resolved_at (expected), 0 missing other
- Feedback: 0 null score (all scored), 0 missing

## Correlation / Association

- Cramer's V not computed (categorical archetype vs risk is 1.0 perfect due to seed mapping).
- Pearson dau vs mrr: ~0 (no relation, as designed).
- For demo, do not claim model-learned correlations; they are generator artifacts.

## Quality Check per Visualization (sec 30)

Each chart idea below includes caveat that synthetic generation explains pattern:
- Archetype pie: Q: distribution? Conclusion: HEALTHY-heavy realistic portfolio. Confounder: weighted random list. Not misleading if labeled synthetic.
- MRR hist: Q: revenue spread? Shows Mid-Market 1-5k uniform, Acme outlier. Synthetic uniform not lognormal -> note.
- etc.
