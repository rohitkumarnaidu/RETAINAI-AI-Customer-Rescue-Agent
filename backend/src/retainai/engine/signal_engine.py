"""Deterministic Signal Engine for churn warning signal detection."""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from retainai.db.models import (
    UsageEvent,
    SupportTicket,
    CustomerFeedback,
    AccountEvent,
)
from retainai.engine.time_window import TimeWindowEngine


@dataclass
class DetectedSignal:
    signal_type: str
    category: str  # USAGE, SUPPORT, FEEDBACK, ACTIVITY, COMPOUND
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    value: float
    baseline: float
    delta_pct: float
    summary: str
    evidence_ids: List[str] = field(default_factory=list)
    impact_score: float = 0.0

    @property
    def direction(self) -> str:
        return "DECLINING" if self.delta_pct < 0 else "STABLE"

    @property
    def magnitude(self) -> float:
        return self.delta_pct


class SignalEngine:
    """Detects deterministic friction signals from telemetry."""

    @staticmethod
    def detect_usage_decline_signals(usage_events: List[UsageEvent]) -> List[DetectedSignal]:
        signals = []
        if not usage_events:
            return signals

        cmp = TimeWindowEngine.calculate_usage_window_delta(usage_events, current_days=7, baseline_days=30)
        evidence_ids = [e.id for e in usage_events[-5:]]

        if cmp.percentage_delta <= -50.0:
            signals.append(
                DetectedSignal(
                    signal_type="SEVERE_USAGE_DECLINE",
                    category="USAGE",
                    severity="CRITICAL",
                    value=cmp.current_value,
                    baseline=cmp.baseline_value,
                    delta_pct=cmp.percentage_delta,
                    summary=f"Daily Active Users dropped {abs(cmp.percentage_delta):.1f}% over the last 7 days (from {cmp.baseline_value:.0f} to {cmp.current_value:.0f}).",
                    evidence_ids=evidence_ids,
                    impact_score=40.0,
                )
            )
        elif cmp.percentage_delta <= -25.0:
            signals.append(
                DetectedSignal(
                    signal_type="MODERATE_USAGE_DECLINE",
                    category="USAGE",
                    severity="HIGH",
                    value=cmp.current_value,
                    baseline=cmp.baseline_value,
                    delta_pct=cmp.percentage_delta,
                    summary=f"Daily Active Users declined {abs(cmp.percentage_delta):.1f}% compared to 30-day baseline.",
                    evidence_ids=evidence_ids,
                    impact_score=25.0,
                )
            )

        return signals

    @staticmethod
    def detect_support_friction_signals(tickets: List[SupportTicket]) -> List[DetectedSignal]:
        signals = []
        if not tickets:
            return signals

        open_tickets = [t for t in tickets if t.status in ("OPEN", "IN_PROGRESS")]
        unresolved_critical = [
            t for t in open_tickets if t.severity in ("HIGH", "CRITICAL", "URGENT")
        ]

        if unresolved_critical:
            evidence_ids = [t.id for t in unresolved_critical]
            signals.append(
                DetectedSignal(
                    signal_type="UNRESOLVED_CRITICAL_SUPPORT_TICKET",
                    category="SUPPORT",
                    severity="CRITICAL",
                    value=float(len(unresolved_critical)),
                    baseline=0.0,
                    delta_pct=100.0,
                    summary=f"{len(unresolved_critical)} open high-severity support ticket(s) unresolved: '{unresolved_critical[0].subject}'.",
                    evidence_ids=evidence_ids,
                    impact_score=35.0,
                )
            )
        elif len(open_tickets) >= 3:
            evidence_ids = [t.id for t in open_tickets]
            signals.append(
                DetectedSignal(
                    signal_type="HIGH_TICKET_VOLUME_SPIKE",
                    category="SUPPORT",
                    severity="HIGH",
                    value=float(len(open_tickets)),
                    baseline=1.0,
                    delta_pct=200.0,
                    summary=f"Spike in unresolved support requests ({len(open_tickets)} open tickets).",
                    evidence_ids=evidence_ids,
                    impact_score=20.0,
                )
            )

        return signals

    @staticmethod
    def detect_sentiment_signals(feedback_entries: List[CustomerFeedback]) -> List[DetectedSignal]:
        signals = []
        if not feedback_entries:
            return signals

        negative_entries = [f for f in feedback_entries if f.sentiment == "NEGATIVE" or (f.score and f.score <= 2)]
        if negative_entries:
            latest = negative_entries[0]
            signals.append(
                DetectedSignal(
                    signal_type="NEGATIVE_CUSTOMER_FEEDBACK",
                    category="FEEDBACK",
                    severity="HIGH",
                    value=float(latest.score or 1),
                    baseline=5.0,
                    delta_pct=-80.0,
                    summary=f"Negative feedback recorded ({latest.source}): '{latest.text}'",
                    evidence_ids=[latest.id],
                    impact_score=30.0,
                )
            )

        return signals

    @staticmethod
    def detect_admin_inactivity_signals(events: List[AccountEvent]) -> List[DetectedSignal]:
        signals = []
        if not events:
            return signals

        now = datetime.now(timezone.utc)
        cutoff_14 = now - timedelta(days=14)
        recent_logins = [
            e for e in events
            if e.event_type in ("ADMIN_LOGIN", "ADMIN_ACTIVITY")
            and (e.timestamp.replace(tzinfo=timezone.utc) if e.timestamp.tzinfo is None else e.timestamp) >= cutoff_14
        ]

        if not recent_logins and len(events) > 0:
            signals.append(
                DetectedSignal(
                    signal_type="ADMIN_INACTIVITY",
                    category="ACTIVITY",
                    severity="MEDIUM",
                    value=0.0,
                    baseline=3.0,
                    delta_pct=-100.0,
                    summary="No admin activity or workspace logins detected in the last 14 days.",
                    evidence_ids=[e.id for e in events[:3]],
                    impact_score=15.0,
                )
            )

        return signals

    @classmethod
    def evaluate_all_signals(
        cls,
        usage_events: List[UsageEvent],
        tickets: List[SupportTicket],
        feedback: List[CustomerFeedback],
        account_events: List[AccountEvent],
    ) -> List[DetectedSignal]:
        signals: List[DetectedSignal] = []
        signals.extend(cls.detect_usage_decline_signals(usage_events))
        signals.extend(cls.detect_support_friction_signals(tickets))
        signals.extend(cls.detect_sentiment_signals(feedback))
        signals.extend(cls.detect_admin_inactivity_signals(account_events))
        return signals

    @classmethod
    def evaluate_signals(
        cls,
        customer: Any,
        usage_events: List[UsageEvent],
        tickets: List[SupportTicket],
        feedback: List[CustomerFeedback],
        account_events: List[AccountEvent],
        reference_date: Optional[datetime] = None,
    ) -> List[DetectedSignal]:
        signals = cls.evaluate_all_signals(usage_events, tickets, feedback, account_events)
        if getattr(customer, "is_false_positive_candidate", False):
            signals.append(
                DetectedSignal(
                    signal_type="FALSE_POSITIVE_SAFEGUARD",
                    category="USAGE_CONTEXT",
                    severity="LOW",
                    value=0.95,
                    baseline=1.0,
                    delta_pct=0.0,
                    summary="High job completion efficiency indicates false positive risk candidate.",
                    evidence_ids=[],
                    impact_score=-35.0,
                )
            )
        return signals
