"""Pydantic API Request/Response Schemas for RETAINAI."""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone
from pydantic import BaseModel, Field, ConfigDict


class HealthComponentsSchema(BaseModel):
    usage_health: float = 100.0
    support_health: float = 100.0
    sentiment_health: float = 100.0
    engagement_health: float = 100.0
    overall_health: float = 100.0


# Backward compatibility alias
HealthDimensionSchema = HealthComponentsSchema


class DetectedSignalSchema(BaseModel):
    signal_type: str
    category: str
    severity: str
    value: float
    baseline: float
    delta_pct: float
    summary: str
    evidence_ids: List[str] = Field(default_factory=list)
    impact_score: float = 0.0


class ComputedSignalSchema(BaseModel):
    name: str
    category: str
    impact_score: float
    evidence_id: Optional[str] = None


class CustomerSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    external_id: Optional[str] = None
    name: str
    domain: str
    segment: str
    industry: str
    plan: str
    mrr: float
    arr: float
    csm_name: str
    csm_email: str
    start_date: date
    renewal_date: date
    status: str
    health_score: float
    risk_level: str
    is_false_positive_candidate: bool = False
    created_at: datetime


class RiskAssessmentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    health_score: float
    risk_level: str
    usage_health: float = 100.0
    support_health: float = 100.0
    sentiment_health: float = 100.0
    engagement_health: float = 100.0
    detected_signals: List[str] = Field(default_factory=list)
    confidence: float = 0.85
    calculation_version: str = "v1.0"


class RetentionPlanSchema(BaseModel):
    objective: str
    priority: str
    root_cause: str
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    draft_email: Dict[str, Any] = Field(default_factory=dict)


class EvidenceSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    source_type: str
    source_id: str
    timestamp: datetime
    summary: str
    importance: float


class TimelineItemSchema(BaseModel):
    id: str
    timestamp: str
    source: str
    event_type: str
    title: str
    details: Dict[str, Any] = Field(default_factory=dict)
    severity: str = "INFO"


class EventIngestRequest(BaseModel):
    customer_id: str
    event_type: str
    payload: Dict[str, Any]
    timestamp: Optional[datetime] = None


class InterventionCreateRequest(BaseModel):
    customer_id: str
    investigation_id: str
    action_type: str
    title: str
    description: str
    plan: str


class InterventionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    investigation_id: str
    action_type: str
    title: str
    description: str
    plan: str
    status: str
    created_at: datetime
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    approved_by: Optional[str] = None


class OutcomeCreateRequest(BaseModel):
    intervention_id: Optional[str] = None
    health_before: float
    health_after: float
    usage_before: float = 0.0
    usage_after: float = 0.0
    customer_response: Optional[str] = None
    notes: Optional[str] = None


class OutcomeSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    intervention_id: str
    customer_id: str
    created_at: datetime
    status: str
    health_before: float
    health_after: float
    health_delta: float
    usage_before: float
    usage_after: float
    customer_response: Optional[str] = None
    notes: Optional[str] = None
    confidence: float
    evaluation_status: str


class ExperienceMemorySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    context_pattern: str
    customer_segment: str
    risk_pattern: str
    signals: List[str] = Field(default_factory=list)
    recommended_strategy: str
    actual_action: str
    observed_outcome: str
    confidence: float
    validation_status: str
    success_count: int
    failure_count: int
