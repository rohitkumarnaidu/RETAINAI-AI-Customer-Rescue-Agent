# RETAINAI Data

This directory contains the datasets and schemas utilized by RETAINAI to demonstrate the Autonomous Customer Rescue loop.

## Structure

- `/seed`: Contains deterministic synthetic data generated for initializing the application state (`retainai_synthetic_data.json`).
- `/scenarios`: Contains specific scenario outlines (like `demo_scenario_acme.json`) used for the guided demo.
- `/raw`, `/interim`, `/processed`: Traditional data engineering pipelines (empty/ignored for the MVP as we rely entirely on deterministic synthesis).
- `/fixtures`: Small curated chunks of data for testing.
- `dataset_registry.json`: Provenance and licensing information for all data used in the project.

## Provenance and Strategy

We evaluated public churn datasets (Telco Churn, UCI, Kaggle) but rejected them as they lack the longitudinal event history (daily usage, specific ticket filing dates) needed by our AI agents to investigate root causes.

As a result, we rely on a **Deterministic Synthetic Generation Strategy**. 
- **License:** MIT
- **Privacy:** 100% PII-free.
- **Reproducibility:** A fixed seed guarantees the exact same database state on every machine.

## How to generate data

Run the generation script from the project root:

```bash
python scripts/data/build_retainai_dataset.py --seed 42
```