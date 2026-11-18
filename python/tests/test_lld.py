import threading

import pytest

from sdm.lld import (
    Booking, BookingRepository, Checkout, InMemoryBookings, Money, Seat, Ticket, TicketState, Wallet, transfer,
)
from sdm.patterns import (
    EventBus, EventListing, FlakyProvider, LoggingClient, OldBankAdapter, OldBankApi, Order, RetryingClient, SeatMap,
    SurgePricing, checkout_total, regular_price, student_price,
)


def test_seat_encapsulation():
    s = Seat("F12", 4500)
    assert s.hold("Maya") and not s.hold("Leo")
    with pytest.raises(ValueError):
        Seat("F13", 0)
    with pytest.raises(AttributeError):
        s.price_cents = 1                     # read-only property


def test_money_is_a_value_object():
    assert Money(500, "EUR") == Money(500, "EUR")
    assert Money(500, "EUR").add(Money(250, "EUR")) == Money(750, "EUR")
    with pytest.raises(ValueError):
        Money(500, "EUR").add(Money(1, "USD"))
    with pytest.raises(Exception):
        Money(500, "EUR").cents = 1           # frozen


def test_checkout_with_fakes():
    repo: BookingRepository = InMemoryBookings()
    repo.save(Booking("b1", "F12", Money(4500, "EUR")))
    charges = []
    now = [100.0]
    co = Checkout(charge=lambda c: charges.append(c) or True, clock=lambda: now[0], bookings=repo)
    assert co.pay("b1", hold_expires_at=200.0) == "paid" and charges == [4500]
    now[0] = 300.0
    repo.save(Booking("b2", "F13", Money(4500, "EUR")))
    assert co.pay("b2", hold_expires_at=200.0) == "hold expired"


def test_ticket_state_machine():
    t = Ticket("t1")
    t.move_to(TicketState.REFUNDED)
    with pytest.raises(ValueError):
        t.move_to(TicketState.SCANNED)        # a refunded ticket can't be scanned


def test_transfer_lock_ordering_no_deadlock():
    a, b = Wallet(1, 10_000), Wallet(2, 10_000)
    t1 = threading.Thread(target=lambda: [transfer(a, b, 1) for _ in range(2000)])
    t2 = threading.Thread(target=lambda: [transfer(b, a, 1) for _ in range(2000)])
    t1.start(); t2.start(); t1.join(5); t2.join(5)
    assert not t1.is_alive() and not t2.is_alive()
    assert a.cents + b.cents == 20_000


def test_strategy_function_then_class():
    assert checkout_total(5000, 2, regular_price) == 10_000
    assert checkout_total(5000, 2, student_price) == 8_000
    assert checkout_total(5000, 1, SurgePricing(seats_left=10, capacity=100)) == 7250


def test_observer_isolates_failures():
    bus, seen = EventBus(), []
    def broken(_):
        raise RuntimeError("smtp down")
    bus.subscribe("booked", broken)
    bus.subscribe("booked", lambda p: seen.append(p["seat"]))
    errors = bus.publish("booked", {"seat": "F12"})
    assert seen == ["F12"] and len(errors) == 1


def test_state_pattern():
    o = Order()
    assert o.pay() == "paid" and o.pay() == "already paid"
    assert o.cancel() == "refund issued" and o.state.name == "cancelled"


def test_decorators_stack():
    log: list[str] = []
    provider = FlakyProvider(failures_before_success=2)
    client = LoggingClient(RetryingClient(provider, attempts=3), log)
    assert client.charge(4500) == "charged 4500" and provider.calls == 3 and log == ["charge 4500"]


def test_factory_and_adapter_and_command():
    e = EventListing.concert("Tour", "Arena", "2026-12-01T20:00", 6000)
    assert e.age_limit == 16 and not e.seated
    assert OldBankAdapter(OldBankApi()).charge(4500) == "charged 4500"
    m = SeatMap()
    m.block("F12"); m.block("F13"); m.undo()
    assert m.blocked == {"F12"}
