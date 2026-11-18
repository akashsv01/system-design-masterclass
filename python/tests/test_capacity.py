import pytest

from sdm.availability import downtime_minutes_per_month, redundant, serial
from sdm.capacity import average_rps, in_flight, peak_rps, servers_needed


def test_serial_is_worse_than_each_part():
    assert serial(0.999, 0.999, 0.999) == pytest.approx(0.997, abs=1e-4)


def test_redundancy_helps_if_failures_are_independent():
    assert redundant(0.99, 2) == pytest.approx(0.9999)


def test_downtime_budget():
    assert downtime_minutes_per_month(0.999) == pytest.approx(43.2)


def test_capacity_estimate():
    assert average_rps(8_640_000) == pytest.approx(100)
    assert peak_rps(8_640_000, 50) == pytest.approx(5000)
    assert servers_needed(5000, 800) == 9


def test_littles_law():
    assert in_flight(2000, 0.150) == pytest.approx(300)
