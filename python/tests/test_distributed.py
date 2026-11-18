import math

from sdm.clocks import LamportClock, quorum_overlaps
from sdm.queues import Consumer, backlog_over_time, drain_seconds
from sdm.retries import PaymentService, backoff_delays


def test_backoff_doubles_and_caps_without_jitter():
    assert backoff_delays(7, base=0.1, cap=5, jitter=False) == [0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 5.0]


def test_jitter_stays_under_the_ceiling_and_is_deterministic():
    d = backoff_delays(5, base=0.1, cap=5)
    assert all(0 <= x <= min(5, 0.1 * 2 ** i) for i, x in enumerate(d))
    assert d == backoff_delays(5, base=0.1, cap=5)


def test_idempotency_key_prevents_double_charge():
    p = PaymentService()
    a = p.charge("4242", 4500, idempotency_key="order-91")
    b = p.charge("4242", 4500, idempotency_key="order-91")   # the retry
    assert a == b and len(p.charges) == 1
    p.charge("4242", 4500)
    p.charge("4242", 4500)
    assert len(p.charges) == 3                               # without a key, each retry charges


def test_lamport_clock_orders_causally_related_events():
    a, b = LamportClock(), LamportClock()
    sent = a.tick()
    received = b.receive(sent)
    assert received > sent


def test_quorum_rule():
    assert quorum_overlaps(3, 2, 2)
    assert not quorum_overlaps(3, 1, 2)


def test_backlog_and_drain():
    assert backlog_over_time(2000, 1500, 3) == [500, 1000, 1500]
    assert drain_seconds(30_000, 1000, 1500) == 60
    assert math.isinf(drain_seconds(10, 1500, 1500))


def test_dedup_consumer():
    c = Consumer()
    for m in ["m1", "m2", "m1"]:
        c.handle(m)
    assert c.emails_sent == 2
