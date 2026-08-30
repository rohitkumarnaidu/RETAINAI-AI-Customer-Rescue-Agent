# RETAINAI Data Signal Audit

Generated: 2026-08-30T11:18:31.806971+00:00

## Signal Definitions (engine/signal_engine.py)

| Signal | Category | Impact | Threshold |
|--------|----------|--------|-----------|
| SEVERE_USAGE_DECLINE | USAGE | 40 | -50% DAU 7d vs 30d |
| MODERATE_USAGE_DECLINE | USAGE | 25 | -25% |
| UNRESOLVED_CRITICAL_SUPPORT_TICKET | SUPPORT | 35 | ≥1 HIGH/CRITICAL OPEN |
| HIGH_TICKET_VOLUME_SPIKE | SUPPORT | 20 | ≥3 OPEN |
| NEGATIVE_CUSTOMER_FEEDBACK | FEEDBACK | 30 | NEGATIVE or score≤2 |
| ADMIN_INACTIVITY | ACTIVITY | 15 | 0 ADMIN_LOGIN in 14d, events>0 |
| FALSE_POSITIVE_SAFEGUARD | USAGE_CONTEXT | -35 | is_false_positive_candidate |
| INSUFFICIENT_DATA_BASELINE | — | — | total_points <3 |

## Discrimination Test

Does signal set separate archetypes?

- **HEALTHY (60):** avg_dau 264.3 (stable), tickets/cust 0.3 low, neg_rate 0.0 — expected 0-1 signals -> HEALTHY.
- **EARLY_WARNING (19):** dau_mod 0.8, util 0.70, prob_ticket 0.03 — expect 0-1 signals → WATCH (68 health).
- **AT_RISK (12):** dau drop 40% after day 15, util 0.50, ticket 0.05 — expect 2-3 signals → AT_RISK (42 health).
- **CRITICAL (2):** dau drop 70% then 95%, util 0.20, ticket 0.10 — expect 3-4 signals → CRITICAL (18 health).
- **RECOVERING (7):** same as early warning but narrative post-intervention — STABLE (78).
- **ACME_HERO:** 3 signals simultaneously (usage -67%, ticket HIGH OPEN, feedback NEGATIVE, admin 0) — CRITICAL when reassessed (engine will compute ~15 health, risk CRITICAL).

**Verdict:** Signals DO discriminate — HEALTHY vs CRITICAL separable via usage decline + ticket + feedback. Early warning vs healthy borderline (0.8 dau_mod may not trigger -25% threshold). Verified via audit decline pct: Acme -67% triggers SEVERE, AT_RISK -40% triggers MODERATE.

## Perturbation Sensitivity (manual)

- Take one HEALTHY customer, drop usage 30%: TimeWindow will see -30% → MODERATE_USAGE_DECLINE (+25 impact) → health 75 → risk WATCH. Sensitive.
- Change negative feedback to positive: NEGATIVE signal removed (-30) → health +30*0.20 weight = +6 points. Sensible.

## Health vs Risk Monotonicity

- Health 100→90 HEALTHY, 90→80 STABLE, 80→60 WATCH, 60→40 AT_RISK, 40→20 HIGH_RISK, <20 CRITICAL — monotonic per settings.
- Increasing negative signals monotonically decreases health (weights positive, impact_scores positive, subtracted). No inverse bug.
- Support resolution: RESOLVED ticket not counted as OPEN → signal disappears → health recovers. Correct.

## Issues

- No USAGE signals for RECOVERING improvement — dataset has no post-recovery trajectory (recovering archetype uses same 0.8 flat, not improving). Signal for recovery would be absence of decline, not positive signal.
- ADMIN_INACTIVITY requires events>0 to trigger; dataset has 0 account_events seeded, so this signal NEVER fires from dataset alone (only via AcmeReplayEngine). Gap: P2.
- FALSE_POSITIVE safeguard never in dataset (0 customers have is_false_positive_candidate=True). Test-coverage gap, not data bug.
