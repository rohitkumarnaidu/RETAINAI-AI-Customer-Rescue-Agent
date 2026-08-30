# RETAINAI Data Generation & Processing

This directory contains the scripts necessary to construct the baseline dataset for RETAINAI.

Because public datasets lack the longitudinal depth (time-series events) and specific entity interactions (Feature Adoption + Support Tickets + CSM Feedback) required to demonstrate our Agentic workflow, we utilize a **Purely Deterministic Synthetic Generation Strategy**.

## Files

- `build_retainai_dataset.py`: The core generation engine. Deterministically builds customer archetypes, time-series usage telemetry, support tickets, and feedback. It guarantees the generation of the "Acme Corp" critical failure scenario.

## Usage

To generate the standard dataset for the hackathon MVP:

```bash
python scripts/data/build_retainai_dataset.py --seed 42
```

This will output a normalized JSON file to `data/seed/retainai_synthetic_data.json`.