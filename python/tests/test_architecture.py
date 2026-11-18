import pytest

from sdm.passwords import hash_password, verify_password
from sdm.rate_limit import FixedWindow, TokenBucket
from sdm.slo import budget_remaining, burn_rate, error_budget


def test_token_bucket_allows_burst_then_rate():
    b = TokenBucket(capacity=5, rate=1)
    assert sum(b.allow(0.0) for _ in range(8)) == 5   # burst of 5
    assert not b.allow(0.5)
    assert b.allow(1.0)                               # one token refilled per second


def test_fixed_window_edge_burst():
    w = FixedWindow(limit=10, window_seconds=60)
    allowed = sum(w.allow(59.9) for _ in range(10)) + sum(w.allow(60.1) for _ in range(10))
    assert allowed == 20                              # 20 requests in 0.2 s, all allowed


def test_passwords_hash_and_verify():
    h = hash_password("correct horse")
    assert verify_password("correct horse", h)
    assert not verify_password("wrong horse", h)
    assert hash_password("correct horse") != h        # random salt each time


def test_error_budget_math():
    assert error_budget(0.999, 10_000_000) == 10_000
    assert budget_remaining(0.999, 10_000_000, 2_500) == pytest.approx(0.75)
    assert burn_rate(0.999, 0.01) == pytest.approx(10)
