# RETAINAI Data Distribution / Realism Audit

Generated: 2026-08-30T11:18:31.805699+00:00

> Question: Does synthetic data behave plausibly for retention scenario, not just "error-free"?

## Customer Tiers / Archetypes

| Archetype | Count | % | Expected | Actual Behavior |
|-----------|------:|---:|----------|----------------|
| HEALTHY | 60 | 59.4% | — | avg_dau 264.3, tickets/cust 0.3, neg_rate 0.0 |
| EARLY_WARNING | 19 | 18.8% | — | avg_dau 192.8, tickets/cust 1.47, neg_rate 0.0 |
| AT_RISK | 12 | 11.9% | — | avg_dau 231.2, tickets/cust 1.83, neg_rate 1.0 |
| RECOVERING | 7 | 6.9% | — | avg_dau 278.4, tickets/cust 1.14, neg_rate 0.0 |
| CRITICAL | 2 | 2.0% | — | avg_dau 186.0, tickets/cust 2.5, neg_rate 1.0 |
| ACME_HERO | 1 | 1.0% | — | avg_dau 130.6, tickets/cust 1.0, neg_rate 1.0 |

- HEALTHY 60% expected vs 59.4% actual — close.
- EARLY_WARNING 20% vs 18.8% — within random variance.
- AT_RISK 10% vs 11.9% — slight over.
- CRITICAL 5% vs 2.0% — under (only 2, but small sample).
- RECOVERING 5% vs 6.9% — slight over.
- ACME_HERO 1 deterministically.

## MRR Distribution

- Range: 1019 – 12000, mean 3137
- Mid-Market synthetic: 1000–5000 uniform (generator random.uniform) — realistic for SMB segment.
- Enterprise Acme 12000 — demo hero, high but plausible (ARR 144k).

## Usage / DAU

- Global DAU mean 245, min 16, max 537.
- HEALTHY avg ~ 264.3 — stable via dau_mod 0.9–1.1.
- AT_RISK drops 40% after day 15 — visible cliff.
- CRITICAL drops to 5% after day 5 — severe.

## Support Ticket Frequency / Severity

- Tickets per customer: HEALTHY 0.3 (18 resolved), AT_RISK+CRITICAL higher.
- Severity: HIGH 69 (84%), MEDIUM 13 (16%), CRITICAL 0 — **unrealistic**: no CRITICAL/URGENT despite docs mentioning them. Synthetic artifact: generator only outputs HIGH/MEDIUM via get_ticket_details uppercased priority; raw fallback has 0 CRITICAL. P2.
- Status: OPEN 64 (78%), RESOLVED 18 — only HEALTHY tickets resolved, others OPEN. Deterministic but plausible.

## Feedback / NPS

- Sentiment: POSITIVE 44 (47%), NEGATIVE 26 (28%), NEUTRAL 24 (26%) — balanced for demo.
- NPS scores 1..10 uniform-ish via randint per archetype — AT_RISK 1-4, HEALTHY 8-10 — **excessive clustering by archetype** (synthetic fingerprint). P2: real-world more overlapping.

## Risk Distribution (DB)

- Via backend/retainai.db: HEALTHY 61, WATCH 19, AT_RISK 12, STABLE 7, CRITICAL 2 — matches archetype→health map (seed.py). No HIGH_RISK (0) because thresholds not hit — gap.
- Health scores: 92.5 HEALTHY, 68 WATCH, 42 AT_RISK, 18 CRITICAL, 78 RECOVERING, 88 ACME. Deterministic mapping, not computed via engine for initial seed — intentional, but health will shift after reassessment.

## Artifact Flags

| Check | Result |
|-------|--------|
| Unrealistic uniformity | No — DAU uniform jitter per archetype |
| Excessive clustering | Yes — ticket prob 0.01 HEALTHY vs 0.10 CRITICAL perfect tiering; feedback score bands exclusive |
| Perfect correlations | Yes — health archetype perfectly maps to risk_level (seeded, not engine) |
| Overly clean | Yes — no malformed values, no missing — synthetic clean |
| Deterministic fingerprints | Yes — AT_RISK util always 0.50, CRITICAL 0.20 — no variance |
| Generation fingerprints | Yes — dau_mod discrete values, admin_logins 0-2 uniform |

Classification: **SYNTHETIC ARTIFACT** for archetype-conditioned fields; **REALISTIC SIGNAL** for trend directions (decline curves plausible).

## Balance Audit

- Dominated by HEALTHY (59%) — intentional, realistic SaaS portfolio.
- Feedback positive 47% vs negative 28% — healthy skew plausible.
- Tickets HIGH-heavy 84% — demo-driven, not realistic prod mix (prod would be MEDIUM-heavy).

Not problematic for hackathon; document as synthetic artifact.
