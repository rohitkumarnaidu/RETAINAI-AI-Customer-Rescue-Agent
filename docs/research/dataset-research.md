# Dataset Research & Evaluation

## 1. Executive Summary

During the research phase for RETAINAI, we investigated several open data platforms (Hugging Face, UCI Machine Learning Repository, Kaggle) to identify suitable datasets for training and demonstrating the autonomous customer rescue loop. 

Our hybrid architecture maps real-world public baseline characteristics (like Support Ticket text and demographic churn baselines) into our RETAINAI Customer schema, while utilizing a Deterministic Synthetic Event layer to construct the rich SaaS longitudinal behavior required for our Agentic reasoning demonstration.

## 2. Research Method
We searched across Hugging Face, Kaggle, and UCI for domains including "Customer Churn", "Subscription Churn", "Helpdesk/Support Tickets", and "Product Adoption". 

## 3. Candidate Datasets

| Dataset | Source | Domain | Rows | License | Churn? | Support? | Usage? | Score | Decision |
| ------- | ------ | ------ | ---: | ------- | ------ | -------- | ------ | ----: | -------- |
| IBM Telco Customer Churn | Hugging Face | Telecom | 7,043 | ODC-BY | Yes | No | Low | 4.0 | Selected (Secondary Baseline) |
| Console-AI IT Helpdesk Synthetic | Hugging Face | IT Support | 500 | MIT | No | Yes | No | 4.5 | Selected (Secondary Baseline) |
| Bank Customer Churn | Kaggle | Banking | 10k | CC0 | Yes | No | No | 2.0 | Rejected |
| Iranian Telecom Churn | UCI | Telecom | 3,150 | CC BY 4.0 | Yes | No | No | 2.5 | Rejected |
| Travel Review Ratings | UCI | Sentiment | 5.4k | CC0 | No | No | No | 1.0 | Rejected |
| arti199919 Synthetic SaaS | Hugging Face | SaaS | 84.8k | Unknown | Yes | No | Yes | 1.0 | Rejected (Unclear License) |
| mindweave help-desk-tickets | Hugging Face | Support | 3k | Unknown | No | Yes | No | 1.0 | Rejected (Unclear License) |
| RETAINAI Synthetic SaaS Lifecycle | Internal | SaaS | N/A | MIT | Yes | Yes | Yes | 5.0 | Selected (Primary Generator) |

## 4. Dataset Comparison & Licensing

### Console-AI IT Helpdesk Synthetic Tickets
- **Original Publisher:** Console Systems, Inc
- **Dataset URL:** `https://huggingface.co/datasets/Console-AI/IT-helpdesk-synthetic-tickets`
- **License:** MIT
- **RETAINAI Usefulness:** Extremely high for generating realistic support ticket `subject` and `category` fields that match SaaS environments (e.g., "Software Conflict Causing App Crashes").
- **Privacy:** 100% Synthetic, completely safe.

### IBM Telco Customer Churn
- **Original Publisher:** IBM
- **Dataset URL:** Available across multiple repositories (Kaggle/HF). We use the generalized schema representation.
- **License:** Open Data Commons Attribution License (ODC-BY)
- **RETAINAI Usefulness:** Good baseline for determining realistic churn distributions based on tenure and contract type. We sample its distribution curves to inform our synthetic event generation.

## 5. Rejected Sources
- **arti199919/synthetic-saas-churn-sample:** Contained some longitudinal data, but the license is explicitly marked "other/unknown", making it legally risky for a compliant hackathon submission.
- **Bank/Iranian Churn:** Domains do not cleanly map to our SaaS `usage_events` model (Feature Adoption, Logins).

## 6. Final Decision & Architecture
We use a **Hybrid Data Architecture**:
1. **Public Data (Helpdesk Tickets):** We sample realistic support subjects from the MIT-licensed Console-AI dataset to seed our `support_tickets` text.
2. **Synthetic Layer:** We use `scripts/data/build_retainai_dataset.py` to generate 100+ customers utilizing the `HEALTHY`, `EARLY_WARNING`, `AT_RISK`, `CRITICAL`, and `RECOVERING` archetypes over a 30-90 day chronological window.
3. **Acme Scenario:** The specific "Acme Corp" narrative is perfectly preserved alongside the randomized baseline portfolio to ensure a deterministic demo.