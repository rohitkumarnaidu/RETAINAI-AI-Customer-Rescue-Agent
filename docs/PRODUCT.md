# RETAINAI — Product Specification & Domain Research

## Tagline
> **Don't wait for churn. Let AI learn how to prevent it.**

## Operating Model
> **SENSE → THINK → ACT → MEASURE → LEARN → REPEAT**

---

## 1. Domain & Competitive Research

Customer Success (CS) teams manage portfolios of tens to hundreds of B2B SaaS accounts. Traditional customer success platforms (Gainsight, ChurnZero, Totango, Vitally, Planhat) rely heavily on static, rule-based health scores and manual playbooks.

### Competitor Gap Analysis
| Platform | Monitoring Capability | Health Scoring | Risk Explanation | Action Model | Learning Loop |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gainsight / ChurnZero** | Batch data syncs | Weighted linear average | Vague color alerts (Red/Yellow) | Manual playbook execution | **None** (static playbooks) |
| **Totango / Vitally** | Event triggers | Component scores | Metric breakdown | Templated emails | **None** |
| **RETAINAI** | **Real-time event stream** | **Multi-dimensional health matrix + signal delta** | **Evidence-grounded root cause + confidence model** | **Personalized action plan + human-in-the-loop approval** | **Closed-loop experience memory bank** |

### Key Research Findings
1. **Activity vs. Outcome:** Lower login activity does *not* inherently equal churn. A customer who completes their implementation and achieves automated success requires fewer logins. RETAINAI explicitly accounts for job completion vs disengagement (False Positive handling).
2. **Compound Signals:** Single negative signals (e.g., 1 support ticket) are frequently noise. Compound signals (Usage decline $\land$ Unresolved severity-1 ticket $\land$ Admin inactivity $\land$ Negative CSAT) indicate critical churn risk.
3. **The Actionability Gap:** Knowing an account is 82% churn-risk without an evidence-grounded action plan leaves CSMs frozen. Explanations must answer *Why* and *What to do next*.

---

## 2. Core Problem Breakdown

1. **Problem A — Signal Fragmentation:** Telemetry is scattered across Product Analytics, Support (Zendesk/Intercom), Feedback (NPS/CSAT), and CRM meetings.
2. **Problem B — Delayed Detection:** Risk is surfaced 30-60 days too late (at renewal time or post-cancellation).
3. **Problem C — Weak Explanation:** Black-box ML probability scores lack natural language reasoning and traceable evidence.
4. **Problem D — Action Gap:** Alerts lack customized, contextual intervention strategies.
5. **Problem E — No Closed Learning Loop:** Organizations fail to track which interventions actually worked for specific account profiles, repeating ineffective outreach.

---

## 3. Product Vision & Principles

RETAINAI is an evidence-driven, explainable, self-improving customer retention agentic system. It operates as an always-on background intelligence layer that ingests customer events, deterministically computes health deltas, agentically investigates root causes using tools, plans tailored interventions, captures CSM feedback, and measures post-intervention outcomes to update its global experience memory.

---

## 4. Multi-Dimensional Health Matrix

Health is not a single scalar value. RETAINAI calculates 6 distinct dimensions (0-100 scale):
1. **Product Health:** WAU/MAU ratio, core feature usage frequency, session duration.
2. **Engagement Health:** Admin active days, stakeholder meeting cadence, email responses.
3. **Support Health:** Ticket volume, unresolved critical tickets, SLA breaches, time-to-resolution.
4. **Sentiment Health:** Qualitative NPS feedback, CSAT ratings, support chat sentiment score.
5. **Relationship Health:** Executive sponsor engagement, multi-department adoption width.
6. **Commercial Health:** ARR tier, contract tenure, time remaining until renewal date.

Overall risk level (`HEALTHY`, `STABLE`, `WATCH`, `AT_RISK`, `HIGH_RISK`, `CRITICAL`) is derived from dimension scores, compound signal detection, and baseline deltas.

