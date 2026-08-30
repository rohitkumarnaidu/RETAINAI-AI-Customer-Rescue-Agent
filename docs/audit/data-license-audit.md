# RETAINAI Data License Audit

Generated: 2026-08-30T11:18:31.680786+00:00
Registry: `data/dataset_registry.json`
Raw: `data/raw/helpdesk_tickets.csv`
Project LICENSE: `LICENSE` (MIT, Copyright (c) 2026 BuildSprint)

## License Matrix

| Source | Publisher | License | License URL | Compatibility | Attribution | Redistribution | Commercial | Verdict |
|--------|-----------|---------|-------------|---------------|-------------|----------------|------------|---------|
| Console-AI Helpdesk | Console Systems | MIT | https://huggingface.co/datasets/Console-AI/IT-helpdesk-synthetic-tickets | Compatible with MIT project | Required (retain MIT notice) | Yes | Yes | SAFE WITH ATTRIBUTION |
| IBM Telco Churn | IBM | ODC-BY 1.0 | https://opendatacommons.org/licenses/by/1-0/ | Compatible | Required (ODC-BY) | Yes | Yes | SAFE WITH ATTRIBUTION (candidate only, no rows copied) |
| RETAINAI Synthetic | Internal | MIT | local://LICENSE | N/A (own) | N/A | Yes | Yes | SAFE |
| arti199919 SaaS | arti199919 | Other/Unknown | https://huggingface.co/datasets/arti199919/synthetic-saas-churn-sample | Unknown | Unknown | No | No | DO NOT USE |
| mindweave helpdesk | mindweave | Unknown | n/a | Unknown | Unknown | No | No | DO NOT USE |

## Detailed Verification

### MIT (Console-AI) — Independent Verification

- Checked HF dataset page via `dataset_registry.json` URL. Page header shows `License: MIT`.
- `data/raw/helpdesk_tickets.csv` fallback preserves MIT notice requirement via registry attribution.
- No violation: transformed sampling (`subject` reuse) is allowed under MIT with attribution (which registry provides).
- Action: Keep `dataset_registry.json` attribution and ensure demo video/docs mention Console-AI if ticket text shown verbatim.

### ODC-BY (IBM Telco) — Independent Verification

- ODC-BY 1.0 at https://opendatacommons.org/licenses/by/1-0/ permits: share, create, adapt with attribution + share alike not required.
- Registry lists `Open Data Commons Attribution License (ODC-BY)` and URL — correct.
- Actual repo does NOT copy raw rows (verified: no `telco*.csv` via glob). So attribution obligation is minimal (informational only). If rows were copied, would need to retain attribution notice in `data/metadata`.
- Verdict: SAFE WITH ATTRIBUTION; NEEDS REVIEW only if promoted to row import.

### Other/Unknown — Verification

- `docs/research/dataset-research.md:22` marks both as `License: Other/Unknown` and rejects them. Verified on HF: arti199919 page shows `License: Other`, mindweave similar.
- Repo contains no files from these sources (verified via `glob data/**/*arti*` zero). Correct rejection.

### Synthetic MIT — Verification

- Project `LICENSE` is MIT (verified read: MIT License, Copyright 2026 BuildSprint). Synthetic output is owned by project.
- No PII: 100% synthetic customer names (`Synthetic Company N` + Acme Corp fictional), no real domains.

## Redistribution & BuildSprint Compliance

- Hackathon requires open-source repo with no secrets, no prohibited AI harness, legally usable demo data.
- All included data is MIT/ODC-BY/synthetic — legally usable for public GitHub + demo video.
- No `Other/Unknown` dataset is included in `data/seed` or `data/raw` beyond fallback — compliant.
- Recommended: add `data/raw/ATTRIBUTION.md` listing Console-AI MIT notice for completeness (P3 polish).

## Classification Legend

- SAFE: MIT/CC0 own data
- SAFE WITH ATTRIBUTION: MIT/ODC-BY with notice
- NEEDS REVIEW: ambiguous but candidate-only
- DO NOT USE: Other/Unknown with rows
