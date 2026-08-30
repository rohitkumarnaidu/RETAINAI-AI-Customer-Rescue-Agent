"""Tests for Time-Window Engine."""

from datetime import datetime, timedelta
from retainai.db.models import UsageEvent
from retainai.engine.time_window import TimeWindowEngine


def test_time_window_compare_periods_normal():
    current = [40.0, 42.0, 38.0]
    baseline = [100.0, 102.0, 98.0]
    res = TimeWindowEngine.compare_periods(current, baseline)

    assert res.current_value == 40.0
    assert res.baseline_value == 100.0
    assert res.absolute_delta == -60.0
    assert res.percentage_delta == -60.0
    assert res.trend_direction == "DECREASING"
    assert res.is_insufficient_data is False


def test_time_window_zero_baseline_safeguard():
    current = [10.0, 15.0]
    baseline = [0.0, 0.0]
    res = TimeWindowEngine.compare_periods(current, baseline)

    assert res.percentage_delta == 100.0
    assert res.is_insufficient_data is False


def test_time_window_empty_series():
    res = TimeWindowEngine.compare_periods([], [])
    assert res.is_insufficient_data is True
