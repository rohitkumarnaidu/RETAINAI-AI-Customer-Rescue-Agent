# Data Strategy

## 1. Final Data Architecture

RETAINAI utilizes a **Hybrid Data Architecture**:

```text
PUBLIC BASELINE DISTRIBUTIONS & TEXT (Console-AI Helpdesk)
      ↓
NORMALIZATION
      ↓
SYNTHETIC LONGITUDINAL EVENT GENERATOR (Archetypes)
      ↓
RETAINAI NORMALIZED DATA MODEL
      ↓
APPLICATION DATABASE
```

## 2. Public vs Synthetic Boundaries

- **Observed / Public Derived:** The text used in `support_tickets.subject` is sampled directly from the MIT-licensed `Console-AI/IT-helpdesk-synthetic-tickets` dataset to ensure realistic SaaS friction scenarios.
- **Synthetic Events:** The actual time-series occurrences of those tickets, alongside `UsageEvents` (DAU, feature adoption) and `CustomerFeedbacks`, are generated synthetically using predefined behavioral archetypes.

**IMPORTANT:** We *never* assume public dataset identifiers (e.g., a ticket ID from the HF dataset) correlate to a customer ID in a churn dataset. All `customer_id` linkages are synthetically generated to maintain strict referential integrity. All generated records contain metadata tags tracking their provenance.

## 3. Customer Archetypes & Behavior Modeling

We generate a portfolio of 100+ customers using the following archetypes to create a realistic distribution:

### HEALTHY (60% of base)
- **Usage:** Stable DAU, high license utilization (>80%), frequent admin logins.
- **Support:** 0-1 open tickets, generally low severity, fast resolution times.
- **Feedback:** Positive NPS/CSAT, sentiment > 0.7.

### EARLY_WARNING (20% of base)
- **Usage:** Slight decline in DAU (5-10%), reduced core feature clicks.
- **Support:** 1-2 open tickets, potentially medium severity.
- **Feedback:** Neutral sentiment, minor feature complaints.

### AT_RISK (10% of base)
- **Usage:** Significant usage drop (>20% over 14 days), license utilization < 60%.
- **Support:** Unresolved high-severity tickets or SLA breaches.
- **Feedback:** Negative sentiment, low CSAT.

### CRITICAL (5% of base)
- **Usage:** Severe usage cliff (>50% drop), 0 admin logins.
- **Support:** Multiple unresolved critical tickets.
- **Feedback:** Angry feedback, explicit churn threat.

### RECOVERING (5% of base)
- **Timeline:** Shows `AT_RISK` behavior 30 days ago, a recorded `Intervention`, and subsequently improving metrics in the last 14 days.

## 4. Acme Corp Demo Scenario

While the 100+ portfolio is generated using deterministic randomness, **Acme Corp** is a hardcoded hero scenario guaranteeing the end-to-end RETAINAI loop works perfectly for the demo:
- **Day -30:** Acme is `HEALTHY`.
- **Day -21:** Core feature adoption drops suddenly.
- **Day -14:** Acme files a High-Severity support ticket ("Data export failing consistently").
- **Day -10:** Acme submits negative NPS feedback.
- **Day -7:** Admin logins drop to 0. 
- **Day 0:** RETAINAI Risk Engine triggers `CRITICAL` status.

## 5. Provenance & Metadata

Every generated entity contains a `metadata` payload declaring its origin:
```json
{
  "source_type": "PUBLIC_DATASET",
  "source_dataset": "Console-AI/IT-helpdesk-synthetic-tickets",
  "source_record_id": "86eza0fwq"
}
```
or
```json
{
  "source_type": "SYNTHETIC",
  "source_dataset": "RETAINAI Synthetic SaaS Lifecycle",
  "generation_version": "dataset-v2"
}
```

This ensures we do not claim synthetic events as actual ground truth, nor do we train predictive models on artificially correlated target labels.

## 6. Reproducible Pipeline

Run the pipeline from the project root:
```bash
python scripts/data/download_datasets.py
python scripts/data/build_retainai_dataset.py --seed 42
```
This produces `data/seed/retainai_dataset_v2.json` and updates `data/scenarios/demo_scenario_acme.json`.