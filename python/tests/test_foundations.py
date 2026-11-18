import threading

import pytest

from sdm.counter import SafeCounter, interleaved_lost_update
from sdm.payments import Card, Wallet, checkout
from sdm.percentiles import chance_any_slow, percentile
from sdm.seat_hold import Seat
from sdm.tiny_map import TinyMap, bucket_for


def test_percentile_nearest_rank():
    samples = [40, 42, 45, 47, 50, 52, 55, 60, 75, 900]
    assert percentile(samples, 50) == 50
    assert percentile(samples, 90) == 75
    assert percentile(samples, 99) == 900


def test_fanout_makes_tail_common():
    assert chance_any_slow(0.01, 1) == pytest.approx(0.01)
    assert chance_any_slow(0.01, 100) == pytest.approx(0.634, abs=0.001)


def test_tiny_map_put_get_and_overwrite():
    m = TinyMap(4)
    m.put("F12", "Maya")
    m.put("F21", "Leo")          # same characters, so same bucket
    assert bucket_for("F12", 4) == bucket_for("F21", 4)
    assert m.get("F12") == "Maya" and m.get("F21") == "Leo"
    m.put("F12", "Ana")
    assert m.get("F12") == "Ana"
    assert m.get("Z9") is None


def test_lost_update_replay():
    assert interleaved_lost_update() == 1


def test_safe_counter_with_threads():
    c = SafeCounter()
    threads = [threading.Thread(target=lambda: [c.increment() for _ in range(10_000)]) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert c.value == 40_000


def test_checkout_accepts_any_payment_method():
    assert checkout(Card("4242"), 1500) == "charged 1500 to card 4242"
    w = Wallet(2000)
    assert checkout(w, 1500) == "paid 1500 from wallet"
    with pytest.raises(ValueError):
        checkout(w, 1500)


def test_seat_hold_expiry_and_confirm():
    s = Seat("F12")
    assert s.hold("Maya", now=0)
    assert not s.hold("Leo", now=10)
    assert s.confirm("Maya", now=20)
    s2 = Seat("F13")
    s2.hold("Maya", now=0, hold_seconds=60)
    assert not s2.confirm("Maya", now=61)      # late payment
    assert s2.hold("Leo", now=61)              # expired hold freed the seat
