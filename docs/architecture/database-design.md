# Database Design — Schema Definition

## Entity Relationship Diagram (Textual Representation)

```text
CUSTOMERS (1) ───< USAGE_EVENTS (N)
CUSTOMERS (1) ───< SUPPORT_TICKETS (N)
CUSTOMERS (1) ───< CUSTOMER_FEEDBACKS (N)
CUSTOMERS (1) ───< RISK_ASSESSMENTS (N)
RISK_ASSESSMENTS (1) ───< INVESTIGATION_REPORTS (1)
INVESTIGATION_REPORTS (1) ───< INTERVENTIONS (1)
INTERVENTIONS (1) ───< INTERVENTION_OUTCOMES (1)
EXPERIENCE_MEMORIES (Standalone Bank with Similarity Search Tags)
```

## Relational Schemas & Indexes

```sql
CREATE TABLE customers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'Enterprise',
    mrr FLOAT NOT NULL DEFAULT 0.0,
    csm_name VARCHAR(255) NOT NULL,
    renewal_date DATE NOT NULL,
    health_score FLOAT NOT NULL DEFAULT 100.0,
    risk_level VARCHAR(50) NOT NULL DEFAULT 'LOW',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_customers_risk ON customers(risk_level);
CREATE INDEX idx_customers_health ON customers(health_score);

CREATE TABLE usage_events (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    dau INT NOT NULL,
    license_utilization_pct FLOAT NOT NULL,
    core_feature_clicks INT NOT NULL,
    export_events INT NOT NULL,
    admin_logins INT NOT NULL
);
CREATE INDEX idx_usage_customer_time ON usage_events(customer_id, timestamp);

CREATE TABLE support_tickets (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE NULL,
    severity VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    csat_score INT NULL
);
CREATE INDEX idx_tickets_customer_time ON support_tickets(customer_id, created_at);

CREATE TABLE customer_feedbacks (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    channel VARCHAR(50) NOT NULL,
    score INT NULL,
    sentiment VARCHAR(50) NOT NULL,
    feedback_text TEXT NOT NULL
);
CREATE INDEX idx_feedbacks_customer_time ON customer_feedbacks(customer_id, timestamp);

CREATE TABLE risk_assessments (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    health_score FLOAT NOT NULL,
    risk_level VARCHAR(50) NOT NULL,
    primary_driver VARCHAR(255) NOT NULL,
    detected_signals TEXT NOT NULL -- JSON list
);

CREATE TABLE investigation_reports (
    id VARCHAR(36) PRIMARY KEY,
    risk_assessment_id VARCHAR(36) NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    root_cause_summary TEXT NOT NULL,
    evidence_ids TEXT NOT NULL, -- JSON list
    confidence VARCHAR(50) NOT NULL,
    missing_evidence TEXT NOT NULL -- JSON list
);

CREATE TABLE interventions (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    investigation_id VARCHAR(36) NOT NULL REFERENCES investigation_reports(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    proposed_plan TEXT NOT NULL,
    csm_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    executed_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE TABLE intervention_outcomes (
    id VARCHAR(36) PRIMARY KEY,
    intervention_id VARCHAR(36) NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    health_score_before FLOAT NOT NULL,
    health_score_after FLOAT NOT NULL,
    health_delta FLOAT NOT NULL,
    outcome_status VARCHAR(50) NOT NULL
);

CREATE TABLE experience_memories (
    id VARCHAR(36) PRIMARY KEY,
    customer_segment VARCHAR(100) NOT NULL,
    risk_pattern VARCHAR(255) NOT NULL,
    trigger_signals TEXT NOT NULL, -- JSON list
    recommended_action TEXT NOT NULL,
    success_count INT NOT NULL DEFAULT 1,
    failure_count INT NOT NULL DEFAULT 0,
    confidence_score FLOAT NOT NULL DEFAULT 0.8,
    validated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```
