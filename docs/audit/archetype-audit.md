# RETAINAI Archetype Audit

Generated: 2026-08-30T11:18:31.983370+00:00

Expected behaviors from `docs/research/data-strategy.md:3`

| Archetype | Expected (doc) | Actual (measured) | Customer Count | Pass |
|-----------|---------------|-------------------|----------------|------|
| HEALTHY | Stable DAU, >80% util, 0-1 low ticket, NPS>7 | avg_dau 264.3 util 0.85 prob_ticket 0.01 fb 8-10 | 60 (59.4%) | PASS |
| EARLY_WARNING | -5-10% decline, 1-2 medium tickets, neutral | dau_mod 0.8 util 0.70 prob 0.03 fb 5-7 | 19 (18.8%) | PASS with note: 0.8 flat, not declining |
| AT_RISK | >20% drop 14d, <60% util, high unresolved, low CSAT | dau_mod 0.6 after 15d drop 40% util 0.50 tickets 0.05 fb 1-4 | 12 (11.9%) | PASS |
| CRITICAL | >50% cliff, 0 admin, multiple critical, angry | dau 0.3 then 0.05 util 0.20 tickets 0.10 fb 1-2 | 2 (2.0%) | PASS but n=2 small |
| RECOVERING | AT_RISK 30d ago then intervention then improving 14d | Actual: flat 0.8 same as EARLY_WARNING, no improving trajectory | 7 (6.9%) | FAILED — no recovery slope |
| ACME_HERO | Day -21 decline, -14 ticket HIGH, -10 feedback NEG, -7 admin 0, Day 0 CRITICAL | decline -67% ticket HIGH OPEN feedback NEG admin 0 | 1 | PASS |

## Customer counts per archetype vs intended 60/20/10/5/5

Intended weighted list 60/20/10/5/5 sum 100. Actual random.choice variance produces 60/19/12/7/2 — within RNG variance, not bug. But RECOVERING should be 5% (5) actual 7 (ok). CRITICAL 5 expected 2 actual — small sample under.

## Support/Feedback per archetype

| Archetype | tickets/customer | neg feedback rate | feedback count |
|-----------|----------------:|------------------:|---------------:|
| HEALTHY | 0.3 | 0.0 | 44 |
| EARLY_WARNING | 1.47 | 0.0 | 20 |
| AT_RISK | 1.83 | 1.0 | 22 |
| CRITICAL | 2.5 | 1.0 | 3 |
| RECOVERING | 1.14 | 0.0 | 4 |
| ACME_HERO | 1.0 | 1.0 | 1 |

## Risk behavior per archetype (seeded, before engine reassessment)

- HEALTHY → health 92.5 → risk HEALTHY (61 in DB)
- EARLY_WARNING → 68 → WATCH (19)
- AT_RISK → 42 → AT_RISK (12)
- CRITICAL → 18 → CRITICAL (2)
- RECOVERING → 78 → STABLE (7)
- ACME_HERO → 88 → HEALTHY initially, but engine reassessment will drop to ~10-20 CRITICAL (intended story is post-reassessment CRITICAL)

## Issues

- RECOVERING narrative not realized in data (P2): docs/data-strategy.md:50 describes recovering as improved last 14d but generator treats as flat 0.8. Should add upward slope.
- No FALSE_POSITIVE archetype in dataset despite engine support (P3).
