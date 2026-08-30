# RETAINAI — Data Model Specification

## Data Model ERD & Entity Relationships

RETAINAI uses a normalized Relational Data Model (SQLite for MVP, AsyncPG for Production) designed for Customer 360 observability, agent memory, and event-driven tracking.

---

## Entity Schemas

### 1. `customers`
- `id` (PK, String): Unique identifier (e.g., `cust_acme_001`).
- `name` (String): Company name.
- `domain` (String): Primary domain name.
- `segment` (String): Enterprise, Mid-Market, SMB.
- `industry` (String): Industry vertical.
- `plan` (String): Active subscription tier (e.g. Enterprise Tier 3).
- `arr` (Float): Annual Recurring Revenue in USD.
- `csm_name` (String): Assigned CSM.
- `csm_email` (String): Assigned CSM email.
- `start_date` (Date): Contract start date.
- `renewal_date` (Date): Contract renewal date.
- `lifecycle_stage` (String): Active, Onboarding, At Risk, Churned.
- `is_false_positive_candidate` (Boolean): Flag for automated job-completion false positive test cases.

### 2. `customer_users`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `name`, `email`, `role` (Admin, Power User, End User)
- `is_champion` (Boolean)
- `last_active` (DateTime)

### 3. `usage_events`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `timestamp` (DateTime)
- `active_users` (Integer)
- `wau` (Integer)
- `mau` (Integer)
- `total_sessions` (Integer)
- `feature_adoption_rates` (JSON)
- `job_completion_rate` (Float): Key metric distinguishing efficiency from disengagement.

### 4. `support_tickets`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `created_at` (DateTime), `resolved_at` (Optional DateTime)
- `status` (OPEN, IN_PROGRESS, RESOLVED, ESCALATED)
- `priority` (LOW, MEDIUM, HIGH, URGENT)
- `category` (Bug, Feature, Integration, Billing)
- `subject` (String)
- `sentiment_score` (Float: -1.0 to +1.0)

### 5. `feedback_entries`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `timestamp` (DateTime)
- `type` (NPS, CSAT, SURVEY, QUALITATIVE)
- `score` (Integer: 0-10 or 1-5)
- `comment` (Text)
- `sentiment` (POSITIVE, NEUTRAL, NEGATIVE)
- `sentiment_score` (Float)

### 6. `account_activity`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `timestamp` (DateTime)
- `activity_type` (Meeting, Email, Admin_Login, License_Change)
- `actor_name` (String), `actor_role` (String)
- `notes` (Text)

### 7. `health_records`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `timestamp` (DateTime)
- `product_health`, `engagement_health`, `support_health`, `sentiment_health`, `relationship_health`, `commercial_health`, `overall_health` (Float 0-100)

### 8. `risk_assessments`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `timestamp` (DateTime)
- `risk_level` (HEALTHY, STABLE, WATCH, AT_RISK, HIGH_RISK, CRITICAL)
- `risk_score` (Float 0.0 - 1.0)
- `confidence` (Float 0.0 - 1.0)
- `trend` (INCREASING, DECREASING, STABLE)
- `delta_points` (Float)
- `root_cause` (String)
- `reasoning_summary` (Text)
- `alternative_explanations` (JSON List)
- `evidence_ids` (JSON List)
- `contributing_factors` (JSON Dict)

### 9. `interventions`
- `id` (PK, String)
- `customer_id` (FK -> `customers.id`)
- `risk_assessment_id` (FK -> `risk_assessments.id`)
- `created_at` (DateTime)
- `status` (RECOMMENDED, APPROVED, REJECTED, EXECUTED)
- `action_type` (String)
- `title`, `objective`, `priority`
- `plan_steps` (JSON List of step objects)
- `draft_email` (JSON Dict)
- `csm_feedback_reason` (Optional Text)

### 10. `intervention_outcomes`
- `id` (PK, String)
- `intervention_id` (FK -> `interventions.id`)
- `evaluated_at` (DateTime)
- `status` (SUCCESS, NEUTRAL, FAILURE, PENDING)
- `usage_delta_pct`, `support_tickets_resolved`, `sentiment_delta_score`, `health_delta_score` (Float)
- `evaluation_summary` (Text)

### 11. `experience_memories`
- `id` (PK, String)
- `industry_segment` (String)
- `root_cause_category` (String)
- `intervention_type` (String)
- `sample_size` (Integer)
- `successful_outcomes` (Integer)
- `success_rate` (Float)
- `key_insights` (Text)
- `confidence` (Float)
- `last_updated` (DateTime)

### 12. `system_event_logs`
- `id` (PK, String)
- `timestamp` (DateTime)
- `customer_id` (String)
- `event_type` (String)
- `description` (Text)
- `details` (JSON)
