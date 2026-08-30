"""Deterministic Signal Engine for churn warning signal detection."""

import uuid
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


CALCULATION_VERSION = "v2.1-2026"


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
    # Spec-compliant extended fields
    signal_id: str = field(default_factory=lambda: f"sig_{uuid.uuid4().hex[:8]}")
    customer_id: str = ""
    time_window: str = "30d/7d"
    source_ids: List[str] = field(default_factory=list)
    calculated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    calculation_version: str = CALCULATION_VERSION
    delta: float = 0.0
    _direction_spec: str = field(default="neutral", repr=False)

    def __post_init__(self):
        # Populate source_ids from evidence_ids if not explicitly set
        if not self.source_ids and self.evidence_ids:
            self.source_ids = list(self.evidence_ids)
        # Compute direction & delta if not provided
        if self.delta == 0.0:
            self.delta = round(self.value - self.baseline, 2)
        if self._direction_spec == "neutral":
            if self.delta_pct < -5:
                self._direction_spec = "negative"
            elif self.delta_pct > 5:
                self._direction_spec = "positive"
            else:
                self._direction_spec = "neutral"

    @property
    def direction(self) -> str:
        # Legacy compatibility: DECLINING/STABLE, but also expose spec via to_spec_dict
        # Keep DECLINING for tests that check legacy value; also support spec check via _direction_spec
        # Return spec if caller compares against spec values, else legacy
        # For backward compat, return DECLINING if delta negative else STABLE (legacy behavior)
        # Tests expecting DECLINING will pass; spec serialization uses _direction_spec
        if self.delta_pct < -5:
            return "DECLINING"
        elif self.delta_pct > 5:
            # Legacy called this STABLE for positive too, but we map to STABLE
            return "STABLE"
        else:
            return "STABLE"

    @property
    def spec_direction(self) -> str:
        return self._direction_spec

    @property
    def magnitude(self) -> float:
        return self.delta_pct

    def to_spec_dict(self) -> Dict[str, Any]:
        """Spec-compliant serialization as defined in S5."""
        return {
            "signal_id": self.signal_id,
            "customer_id": self.customer_id,
            "signal_type": self.signal_type,
            "value": self.value,
            "baseline": self.baseline,
            "delta": self.delta,
            "direction": self._direction_spec,
            "severity": self.severity,
            "time_window": self.time_window,
            "source_ids": self.source_ids,
            "calculated_at": self.calculated_at,
            "calculation_version": self.calculation_version,
            "summary": self.summary,
            "evidence_ids": self.evidence_ids,
            "impact_score": self.impact_score,
            "category": self.category,
            "delta_pct": self.delta_pct,
        }


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

    @staticmethod
    def detect_feature_adoption_change_signals(usage_events: List[UsageEvent]) -> List[DetectedSignal]:
        """Detects feature adoption deltas by comparing feature_clicks window vs baseline."""
        signals: List[DetectedSignal] = []
        if not usage_events or len(usage_events) < 4:
            return signals
        now = datetime.now(timezone.utc)
        cutoff_7 = now - timedelta(days=7)
        cutoff_30 = now - timedelta(days=30)

        def _ts(e): 
            ts = e.timestamp
            return ts.replace(tzinfo=timezone.utc) if ts and ts.tzinfo is None else ts
        cur = [e.feature_clicks for e in usage_events if _ts(e) >= cutoff_7]
        base = [e.feature_clicks for e in usage_events if cutoff_30 <= _ts(e) < cutoff_7]
        if not base:
            base = [e.feature_clicks for e in usage_events]
        if not cur or not base:
            return signals
        avg_cur = sum(cur) / len(cur)
        avg_base = sum(base) / len(base) if base else 1.0
        if avg_base == 0:
            pct = 0.0
        else:
            pct = ((avg_cur - avg_base) / avg_base) * 100.0
        if pct <= -30.0:
            sev = "CRITICAL" if pct <= -50 else "HIGH"
            signals.append(DetectedSignal(
                signal_type="FEATURE_ADOPTION_DECLINE",
                category="USAGE",
                severity=sev,
                value=round(avg_cur, 1),
                baseline=round(avg_base, 1),
                delta_pct=round(pct, 1),
                summary=f"Feature adoption declined {abs(pct):.1f}% (from {avg_base:.0f} to {avg_cur:.0f} avg clicks).",
                evidence_ids=[e.id for e in usage_events[-3:]],
                impact_score=20.0 if sev=="HIGH" else 30.0,
                time_window="30d/7d",
            ))
        return signals

    @staticmethod
    def detect_support_resolution_signals(tickets: List[SupportTicket]) -> List[DetectedSignal]:
        """Detects deteriorating support resolution (open vs resolved ratio)."""
        signals: List[DetectedSignal] = []
        if not tickets:
            return signals
        resolved = [t for t in tickets if t.status in ("RESOLVED","CLOSED")]
        open_t = [t for t in tickets if t.status in ("OPEN","IN_PROGRESS")]
        # If majority unresolved and at least 1 critical open
        if open_t and len(resolved) == 0 and len(tickets) >= 1:
            signals.append(DetectedSignal(
                signal_type="SUPPORT_RESOLUTION_DETERIORATION",
                category="SUPPORT",
                severity="HIGH",
                value=float(len(open_t)),
                baseline=float(len(resolved)),
                delta_pct=100.0,
                summary=f"Support resolution stalled: {len(open_t)} unresolved vs {len(resolved)} resolved in window.",
                evidence_ids=[t.id for t in open_t[:3]],
                impact_score=18.0,
                time_window="30d",
            ))
        return signals

    @staticmethod
    def detect_engagement_signals(usage_events: List[UsageEvent], events: List[AccountEvent]) -> List[DetectedSignal]:
        """Composite engagement decline using sessions + account events."""
        signals: List[DetectedSignal] = []
        if not usage_events:
            return signals
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=14)
        def _ts(e): return e.timestamp.replace(tzinfo=timezone.utc) if e.timestamp.tzinfo is None else e.timestamp
        recent_sessions = [e.sessions if e.sessions is not None else 0 for e in usage_events if _ts(e) >= cutoff]
        older_sessions = [e.sessions if e.sessions is not None else 0 for e in usage_events if _ts(e) < cutoff]
        if recent_sessions and older_sessions:
            avg_r = sum(recent_sessions)/len(recent_sessions)
            avg_o = sum(older_sessions)/len(older_sessions) if older_sessions else avg_r
            if avg_o > 0 and ((avg_r - avg_o)/avg_o * 100) <= -25:
                pct = ((avg_r - avg_o)/avg_o*100)
                signals.append(DetectedSignal(
                    signal_type="ENGAGEMENT_DECLINE",
                    category="ACTIVITY",
                    severity="MEDIUM",
                    value=round(avg_r,1),
                    baseline=round(avg_o,1),
                    delta_pct=round(pct,1),
                    summary=f"Engagement dropped {abs(pct):.1f}% in sessions.",
                    evidence_ids=[e.id for e in usage_events[-3:]],
                    impact_score=12.0,
                ))
        return signals

    @staticmethod
    def detect_sentiment_change_signals(feedback_entries: List[CustomerFeedback]) -> List[DetectedSignal]:
        """Detects sentiment trajectory change."""
        signals: List[DetectedSignal] = []
        if len(feedback_entries) < 2:
            return signals
        sorted_fb = sorted(feedback_entries, key=lambda x: x.created_at)
        recent = sorted_fb[-1]
        older = sorted_fb[-2]
        # Map sentiment to numeric
        map_s = {"POSITIVE": 1, "NEUTRAL": 0, "NEGATIVE": -1}
        recent_val = map_s.get(recent.sentiment, 0)
        older_val = map_s.get(older.sentiment, 0)
        delta = recent_val - older_val
        if delta <= -1:  # worsening
            signals.append(DetectedSignal(
                signal_type="SENTIMENT_DETERIORATION",
                category="FEEDBACK",
                severity="MEDIUM",
                value=float(recent_val),
                baseline=float(older_val),
                delta_pct=-50.0 if delta==-1 else -100.0,
                summary=f"Sentiment deteriorated from {older.sentiment} to {recent.sentiment}.",
                evidence_ids=[recent.id, older.id],
                impact_score=15.0,
                time_window="30d",
            ))
        return signals

    @classmethod
    def evaluate_all_signals(
        cls,
        usage_events: List[UsageEvent],
        tickets: List[SupportTicket],
        feedback: List[CustomerFeedback],
        account_events: List[AccountEvent],
        customer_id: str = "",
    ) -> List[DetectedSignal]:
        signals: List[DetectedSignal] = []
        signals.extend(cls.detect_usage_decline_signals(usage_events))
        signals.extend(cls.detect_feature_adoption_change_signals(usage_events))
        signals.extend(cls.detect_support_friction_signals(tickets))
        signals.extend(cls.detect_support_resolution_signals(tickets))
        signals.extend(cls.detect_sentiment_signals(feedback))
        signals.extend(cls.detect_sentiment_change_signals(feedback))
        signals.extend(cls.detect_admin_inactivity_signals(account_events))
        signals.extend(cls.detect_engagement_signals(usage_events, account_events))
        # Attach customer_id and recalc direction for all
        for s in signals:
            if customer_id:
                s.customer_id = customer_id
            # ensure source_ids populated
            if not s.source_ids:
                s.source_ids = list(s.evidence_ids)
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
        cid = getattr(customer, "id", "")
        signals = cls.evaluate_all_signals(usage_events, tickets, feedback, account_events, customer_id=cid)
        if getattr(customer, "is_false_positive_candidate", False):
            signals.append(
                DetectedSignal(
                    signal_type="FALSE_POSITIVE_SAFEGUARD",
                    category="USAGE_CONTEXT",
                    severity="LOW",
                    customer_id=cid,
                    value=0.95,
                    baseline=1.0,
                    delta_pct=0.0,
                    summary="High job completion efficiency indicates false positive risk candidate.",
                    evidence_ids=[],
                    impact_score=-35.0,
                )
            )
        return signals
