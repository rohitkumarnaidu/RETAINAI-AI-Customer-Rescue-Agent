"""SQLAlchemy ORM Models for RETAINAI Customer 360, Health Engine & Agent Memory — Tenant-Isolated Phase 1."""

from datetime import datetime, date, timezone
from enum import Enum
from typing import List, Optional, Dict, Any
from sqlalchemy import (
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Date,
    Text,
    ForeignKey,
    JSON,
    Enum as SQLEnum,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from retainai.db.session import Base

# Export Base for model imports
__all__ = ["Base"]


class RiskLevel(str, Enum):
    HEALTHY = "HEALTHY"
    STABLE = "STABLE"
    WATCH = "WATCH"
    AT_RISK = "AT_RISK"
    HIGH_RISK = "HIGH_RISK"
    CRITICAL = "CRITICAL"


class InterventionStatus(str, Enum):
    PROPOSED = "PROPOSED"
    RECOMMENDED = "RECOMMENDED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"
    EXECUTED = "EXECUTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class OutcomeStatus(str, Enum):
    PENDING = "PENDING"
    POSITIVE = "POSITIVE"
    SUCCESS = "SUCCESS"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    FAILURE = "FAILURE"
    INCONCLUSIVE = "INCONCLUSIVE"


class ValidationStatus(str, Enum):
    CANDIDATE = "CANDIDATE"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"
    PENDING_VALIDATION = "PENDING_VALIDATION"
    WEAKENED = "WEAKENED"
    CONTRADICTED = "CONTRADICTED"
    STALE = "STALE"
    REVOKED = "REVOKED"
    ARCHIVED = "ARCHIVED"


class AgentRunStatus(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    FALLBACK = "FALLBACK"


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


# ── Tenant Isolation Core (Phase 1) ────────────────────────────────────────────

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    users: Mapped[List["User"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    customers: Mapped[List["Customer"]] = relationship(back_populates="tenant")

    __table_args__ = (
        {"extend_existing": True},
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), nullable=False, default=UserRole.MEMBER)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tenant: Mapped["Tenant"] = relationship(back_populates="users")

    __table_args__ = (
        Index("idx_users_tenant", "tenant_id"),
        Index("idx_users_email", "email"),
        {"extend_existing": True},
    )


class OrgSettings(Base):
    __tablename__ = "org_settings"

    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("tenants.id"), primary_key=True)
    health_weights: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {"usage": 0.4, "support": 0.3, "sentiment": 0.2, "engagement": 0.1})
    risk_thresholds: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {"critical": 20, "high": 40, "at_risk": 60, "watch": 80, "healthy": 90})
    llm_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="groq")
    llm_model: Mapped[str] = mapped_column(String(100), nullable=False, default="openai/gpt-oss-120b")
    llm_api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    investigation_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    tenant: Mapped["Tenant"] = relationship("Tenant")

    __table_args__ = (
        {"extend_existing": True},
    )


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    domain: Mapped[str] = mapped_column(String(100), nullable=False)
    segment: Mapped[str] = mapped_column(String(50), nullable=False, default="Enterprise")
    industry: Mapped[str] = mapped_column(String(50), nullable=False, default="Software")
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="Enterprise Tier")
    mrr: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    arr: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    csm_name: Mapped[str] = mapped_column(String(100), nullable=False)
    csm_email: Mapped[str] = mapped_column(String(100), nullable=False, default="csm@retainai.io")
    start_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    renewal_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ACTIVE")
    health_score: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    risk_level: Mapped[RiskLevel] = mapped_column(SQLEnum(RiskLevel), nullable=False, default=RiskLevel.HEALTHY)
    is_false_positive_candidate: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="customers")
    usage_events: Mapped[List["UsageEvent"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    feature_adoptions: Mapped[List["FeatureAdoption"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    support_tickets: Mapped[List["SupportTicket"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    feedback_entries: Mapped[List["CustomerFeedback"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    account_events: Mapped[List["AccountEvent"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    risk_assessments: Mapped[List["RiskAssessment"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    evidences: Mapped[List["Evidence"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    investigation_reports: Mapped[List["InvestigationReport"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    interventions: Mapped[List["Intervention"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    agent_runs: Mapped[List["AgentRun"]] = relationship(back_populates="customer", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_customers_tenant", "tenant_id"),
        Index("idx_customers_risk", "risk_level"),
        Index("idx_customers_health", "health_score"),
        Index("idx_customers_status", "status"),
        {"extend_existing": True},
    )


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    daily_active_users: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active_users: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wau: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mau: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    license_utilization: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    job_completion_rate: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    feature_clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    usage_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    feature_adoption_rates: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, default="DAILY_SUMMARY")
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="usage_events")

    __table_args__ = (
        Index("idx_usage_tenant", "tenant_id"),
        Index("idx_usage_customer_time", "customer_id", "timestamp"),
        {"extend_existing": True},
    )


class FeatureAdoption(Base):
    __tablename__ = "feature_adoptions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    feature_name: Mapped[str] = mapped_column(String(100), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    adoption_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer: Mapped["Customer"] = relationship(back_populates="feature_adoptions")

    __table_args__ = (
        Index("idx_feature_tenant", "tenant_id"),
        Index("idx_feature_customer_time", "customer_id", "period_start"),
        {"extend_existing": True},
    )


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    external_ticket_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="BUG")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")  # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    csat: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, default=dict)

    customer: Mapped["Customer"] = relationship(back_populates="support_tickets")

    __table_args__ = (
        Index("idx_tickets_tenant", "tenant_id"),
        Index("idx_tickets_customer_status", "customer_id", "status"),
        Index("idx_tickets_customer_time", "customer_id", "created_at"),
        {"extend_existing": True},
    )


class CustomerFeedback(Base):
    __tablename__ = "customer_feedbacks"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="CSAT_SURVEY")
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-10 or 1-5
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False, default="NEUTRAL")  # POSITIVE, NEUTRAL, NEGATIVE
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)  # -1.0 to 1.0
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="GENERAL")
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, default=dict)

    customer: Mapped["Customer"] = relationship(back_populates="feedback_entries")

    __table_args__ = (
        Index("idx_feedback_tenant", "tenant_id"),
        Index("idx_feedback_customer_time", "customer_id", "created_at"),
        {"extend_existing": True},
    )


class AccountEvent(Base):
    __tablename__ = "account_events"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # ADMIN_LOGIN, CSM_MEETING, CONTRACT_CHANGE
    description: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="account_events")

    __table_args__ = (
        Index("idx_account_evt_tenant", "tenant_id"),
        Index("idx_account_evt_customer_time", "customer_id", "timestamp"),
        {"extend_existing": True},
    )


# Aliases for backward compatibility
FeedbackEntry = CustomerFeedback
AccountActivity = AccountEvent


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    health_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(SQLEnum(RiskLevel), nullable=False)
    usage_health: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    support_health: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    sentiment_health: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    engagement_health: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    detected_signals: Mapped[List[str]] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.85)
    calculation_version: Mapped[str] = mapped_column(String(20), default="v1.0")

    customer: Mapped["Customer"] = relationship(back_populates="risk_assessments")
    investigation_reports: Mapped[List["InvestigationReport"]] = relationship(back_populates="risk_assessment")

    __table_args__ = (
        Index("idx_risk_tenant", "tenant_id"),
        Index("idx_risk_customer_time", "customer_id", "created_at"),
        {"extend_existing": True},
    )


class Evidence(Base):
    __tablename__ = "evidences"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # USAGE_EVENT, SUPPORT_TICKET, FEEDBACK, ACCOUNT_EVENT
    source_id: Mapped[str] = mapped_column(String(100), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[float] = mapped_column(Float, default=0.5)  # 0.0 to 1.0
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer: Mapped["Customer"] = relationship(back_populates="evidences")

    __table_args__ = (
        Index("idx_evidence_tenant", "tenant_id"),
        Index("idx_evidence_customer", "customer_id"),
        Index("idx_evidence_source", "source_type", "source_id"),
        {"extend_existing": True},
    )


class InvestigationReport(Base):
    __tablename__ = "investigation_reports"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    risk_assessment_id: Mapped[str] = mapped_column(ForeignKey("risk_assessments.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[str] = mapped_column(String(50), default="HIGH_CONFIDENCE")  # HIGH_CONFIDENCE, MEDIUM_CONFIDENCE, LOW_CONFIDENCE, INSUFFICIENT_EVIDENCE
    uncertainty_status: Mapped[str] = mapped_column(String(50), default="CLEAR")
    evidence_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    missing_evidence: Mapped[List[str]] = mapped_column(JSON, default=list)

    customer: Mapped["Customer"] = relationship(back_populates="investigation_reports")
    risk_assessment: Mapped["RiskAssessment"] = relationship(back_populates="investigation_reports")
    interventions: Mapped[List["Intervention"]] = relationship(back_populates="investigation")

    __table_args__ = (
        Index("idx_investigation_tenant", "tenant_id"),
        Index("idx_investigation_customer", "customer_id"),
        Index("idx_investigation_risk", "risk_assessment_id"),
        {"extend_existing": True},
    )


class Intervention(Base):
    __tablename__ = "interventions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    investigation_id: Mapped[str] = mapped_column(ForeignKey("investigation_reports.id"), nullable=False)
    recommendation_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    approved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    expected_outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    success_metric: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM")
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[InterventionStatus] = mapped_column(SQLEnum(InterventionStatus), default=InterventionStatus.PROPOSED)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="interventions")
    investigation: Mapped["InvestigationReport"] = relationship(back_populates="interventions")
    outcome: Mapped[Optional["InterventionOutcome"]] = relationship(back_populates="intervention", uselist=False)

    __table_args__ = (
        Index("idx_interventions_tenant", "tenant_id"),
        Index("idx_interventions_customer", "customer_id"),
        Index("idx_interventions_status", "status"),
        {"extend_existing": True},
    )


class InterventionOutcome(Base):
    __tablename__ = "intervention_outcomes"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    intervention_id: Mapped[str] = mapped_column(ForeignKey("interventions.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status: Mapped[OutcomeStatus] = mapped_column(SQLEnum(OutcomeStatus), default=OutcomeStatus.PENDING)
    outcome: Mapped[str] = mapped_column(String(20), default="UNKNOWN")  # SUCCESS|PARTIAL|FAILED|UNKNOWN
    health_before: Mapped[float] = mapped_column(Float, nullable=False)
    health_after: Mapped[float] = mapped_column(Float, nullable=False)
    health_delta: Mapped[float] = mapped_column(Float, nullable=False)
    usage_before: Mapped[float] = mapped_column(Float, default=0.0)
    usage_after: Mapped[float] = mapped_column(Float, default=0.0)
    before_metrics: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    after_metrics: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    observations: Mapped[List[str]] = mapped_column(JSON, default=list)
    evidence_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    time_window: Mapped[str] = mapped_column(String(20), default="14d")
    customer_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    support_resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.85)
    evaluation_status: Mapped[OutcomeStatus] = mapped_column(SQLEnum(OutcomeStatus), default=OutcomeStatus.PENDING)

    intervention: Mapped["Intervention"] = relationship(back_populates="outcome")

    __table_args__ = (
        Index("idx_outcome_tenant", "tenant_id"),
        Index("idx_outcome_intervention", "intervention_id", unique=True),
        Index("idx_outcome_customer", "customer_id"),
        {"extend_existing": True},
    )


class ExperienceMemory(Base):
    __tablename__ = "experience_memories"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_observed: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    context_pattern: Mapped[str] = mapped_column(String(150), nullable=False)
    pattern: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    customer_segment: Mapped[str] = mapped_column(String(100), nullable=False)
    risk_pattern: Mapped[str] = mapped_column(String(150), nullable=False)
    signals: Mapped[List[str]] = mapped_column(JSON, default=list)
    recommended_strategy: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_intervention: Mapped[str] = mapped_column(Text, nullable=False, default="")
    actual_action: Mapped[str] = mapped_column(Text, nullable=False)
    observed_outcome: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    validation_status: Mapped[ValidationStatus] = mapped_column(SQLEnum(ValidationStatus), default=ValidationStatus.CANDIDATE)
    status: Mapped[str] = mapped_column(String(30), default="VALIDATED")
    success_count: Mapped[int] = mapped_column(Integer, default=1)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    sample_size: Mapped[int] = mapped_column(Integer, default=1)
    success_rate: Mapped[float] = mapped_column(Float, default=0.0)
    source_intervention_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    evidence_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    contexts: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    version: Mapped[str] = mapped_column(String(20), default="v1.0")

    __table_args__ = (
        Index("idx_memory_tenant", "tenant_id"),
        Index("idx_memory_segment", "customer_segment"),
        Index("idx_memory_validation", "validation_status"),
        {"extend_existing": True},
    )


class AgentState(str, Enum):
    RECEIVED = "RECEIVED"
    SIGNAL_ANALYSIS = "SIGNAL_ANALYSIS"
    INVESTIGATING = "INVESTIGATING"
    RISK_ASSESSMENT = "RISK_ASSESSMENT"
    ROOT_CAUSE_ANALYSIS = "ROOT_CAUSE_ANALYSIS"
    ACTION_PLANNING = "ACTION_PLANNING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    ACTION_EXECUTED = "ACTION_EXECUTED"
    OBSERVING_OUTCOME = "OBSERVING_OUTCOME"
    OUTCOME_EVALUATION = "OUTCOME_EVALUATION"
    LEARNING_CANDIDATE = "LEARNING_CANDIDATE"
    VALIDATION = "VALIDATION"
    MEMORY_UPDATED = "MEMORY_UPDATED"
    COMPLETED = "COMPLETED"
    # Failure states
    TOOL_FAILED = "TOOL_FAILED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    MODEL_FAILED = "MODEL_FAILED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    TIMEOUT = "TIMEOUT"
    HUMAN_ESCALATION = "HUMAN_ESCALATION"
    CANCELLED = "CANCELLED"


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), nullable=False)
    step_type: Mapped[str] = mapped_column(String(50), nullable=False)
    state: Mapped[str] = mapped_column(String(50), nullable=False, default=AgentState.RECEIVED.value)
    input_reference: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_reference: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tool_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="SUCCESS")
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_agent_steps_tenant", "tenant_id"),
        Index("idx_agent_steps_run", "run_id"),
        {"extend_existing": True},
    )


class LearningCandidate(Base):
    __tablename__ = "learning_candidates"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(String(50), nullable=False)
    intervention_id: Mapped[str] = mapped_column(String(50), nullable=False)
    pattern: Mapped[str] = mapped_column(Text, nullable=False)
    context_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    intervention_type: Mapped[str] = mapped_column(String(100), nullable=False)
    observed_outcome: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    source_intervention_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    sample_size: Mapped[int] = mapped_column(Integer, default=1)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="PENDING_VALIDATION")
    validation_status: Mapped[ValidationStatus] = mapped_column(SQLEnum(ValidationStatus), default=ValidationStatus.CANDIDATE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_candidates_tenant", "tenant_id"),
        Index("idx_candidates_customer", "customer_id"),
        Index("idx_candidates_status", "status"),
        {"extend_existing": True},
    )


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[AgentRunStatus] = mapped_column(SQLEnum(AgentRunStatus), default=AgentRunStatus.RUNNING)
    workflow_type: Mapped[str] = mapped_column(String(100), nullable=False, default="INVESTIGATION_RESCUE")
    model: Mapped[str] = mapped_column(String(50), nullable=False, default="gemini-2.5-flash")
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v2.1")
    prompt_version: Mapped[str] = mapped_column(String(50), nullable=False, default="investigate-v2")
    current_state: Mapped[str] = mapped_column(String(50), nullable=False, default=AgentState.RECEIVED.value)
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    input_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    output_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    final_decision: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tool_calls: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    state_history: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="agent_runs")

    __table_args__ = (
        Index("idx_agent_runs_tenant", "tenant_id"),
        Index("idx_agent_runs_customer", "customer_id"),
        Index("idx_agent_runs_status", "status"),
        {"extend_existing": True},
    )


class SystemEventLog(Base):
    __tablename__ = "system_event_logs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    customer_id: Mapped[str] = mapped_column(String(50), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    __table_args__ = (
        Index("idx_syslog_tenant", "tenant_id"),
        Index("idx_syslog_customer_time", "customer_id", "timestamp"),
        Index("idx_syslog_type", "event_type"),
        {"extend_existing": True},
    )


# ── Chat (Parallel Multi-Agent) ──────────────────────────────────────────────

class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    customer_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("customers.id"), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="New chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    message_count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        Index("idx_chat_conv_tenant", "tenant_id"),
        Index("idx_chat_conv_customer", "customer_id"),
        {"extend_existing": True},
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("tenants.id"), nullable=True, index=True)
    conversation_id: Mapped[str] = mapped_column(String(80), ForeignKey("chat_conversations.id"), nullable=False, index=True)
    customer_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("customers.id"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    agent_traces: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True, default=list)
    model: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_chat_msg_tenant", "tenant_id"),
        Index("idx_chat_msg_conv", "conversation_id"),
        Index("idx_chat_msg_customer", "customer_id"),
        {"extend_existing": True},
    )
