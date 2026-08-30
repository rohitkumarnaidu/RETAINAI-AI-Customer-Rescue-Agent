"""Time-Window Engine for deterministic moving-average and period comparisons."""

from dataclasses import dataclass
from typing import List, Sequence, Optional
from datetime import datetime, timedelta, timezone
from retainai.db.models import UsageEvent


@dataclass
class WindowComparison:
    current_value: float
    baseline_value: float
    absolute_delta: float
    percentage_delta: float
    trend_direction: str  # INCREASING, DECREASING, STABLE
    is_insufficient_data: bool


class TimeWindowEngine:
    """Utilities for 7-day, 14-day, 30-day usage comparisons with divide-by-zero safeguards."""

    @staticmethod
    def compare_periods(
        current_series: Sequence[float],
        baseline_series: Sequence[float],
        min_baseline_threshold: float = 1.0,
    ) -> WindowComparison:
        if not current_series or not baseline_series:
            return WindowComparison(
                current_value=0.0,
                baseline_value=0.0,
                absolute_delta=0.0,
                percentage_delta=0.0,
                trend_direction="STABLE",
                is_insufficient_data=True,
            )

        avg_current = sum(current_series) / len(current_series)
        avg_baseline = sum(baseline_series) / len(baseline_series)

        abs_delta = avg_current - avg_baseline

        # Handle zero or sparse baseline safely
        if avg_baseline < min_baseline_threshold:
            pct_delta = 0.0 if avg_current < min_baseline_threshold else 100.0
        else:
            pct_delta = ((avg_current - avg_baseline) / avg_baseline) * 100.0

        if pct_delta > 5.0:
            trend = "INCREASING"
        elif pct_delta < -5.0:
            trend = "DECREASING"
        else:
            trend = "STABLE"

        return WindowComparison(
            current_value=round(avg_current, 2),
            baseline_value=round(avg_baseline, 2),
            absolute_delta=round(abs_delta, 2),
            percentage_delta=round(pct_delta, 2),
            trend_direction=trend,
            is_insufficient_data=False,
        )

    @classmethod
    def calculate_usage_window_delta(
        cls, usage_events: List[UsageEvent], current_days: int = 7, baseline_days: int = 30
    ) -> WindowComparison:
        if not usage_events:
            return WindowComparison(
                current_value=0.0,
                baseline_value=0.0,
                absolute_delta=0.0,
                percentage_delta=0.0,
                trend_direction="STABLE",
                is_insufficient_data=True,
            )

        now = datetime.now(timezone.utc)
        current_cutoff = now - timedelta(days=current_days)
        baseline_cutoff = now - timedelta(days=baseline_days)

        def _get_dau(evt: UsageEvent) -> float:
            if evt.daily_active_users is not None and evt.daily_active_users > 0:
                return float(evt.daily_active_users)
            return float(evt.active_users or 0)

        def _get_ts(evt: UsageEvent) -> datetime:
            ts = evt.timestamp
            if ts and ts.tzinfo is None:
                return ts.replace(tzinfo=timezone.utc)
            return ts

        current_daus = [
            _get_dau(e) for e in usage_events if _get_ts(e) >= current_cutoff
        ]
        baseline_daus = [
            _get_dau(e)
            for e in usage_events
            if baseline_cutoff <= _get_ts(e) < current_cutoff
        ]

        if not baseline_daus:
            # Fallback to entire dataset baseline if sparse window
            baseline_daus = [_get_dau(e) for e in usage_events]

        return cls.compare_periods(current_daus, baseline_daus)
