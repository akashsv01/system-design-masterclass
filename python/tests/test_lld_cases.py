import threading

import pytest

from sdm.cases.board_game import connect_four, tic_tac_toe
from sdm.cases.cart import Cart, ten_percent_over
from sdm.cases.elevator import Elevator
from sdm.cases.expenses import balances, settle
from sdm.cases.keyed_limiter import KeyedLimiter
from sdm.cases.library import Copy, Library, Member
from sdm.cases.logger import Logger, MemorySink
from sdm.cases.notifier import Notifier
from sdm.cases.parking_lot import ParkingLot, Size, Spot
from sdm.cases.score_processor import ScoreProcessor
from sdm.cases.seat_booking import SeatInventory
from sdm.cases.task_scheduler import TaskScheduler
from sdm.cases.vending import VendingMachine
from sdm.lld import Money


def test_parking_smallest_fit():
    lot = ParkingLot([Spot("L1", Size.LARGE), Spot("M1", Size.MEDIUM), Spot("S1", Size.SMALL)])
    assert lot.park("CAR", Size.MEDIUM) == "M1"
    assert lot.park("VAN", Size.LARGE) == "L1"
    assert lot.park("TRUCK", Size.LARGE) is None
    with pytest.raises(ValueError):
        lot.park("CAR", Size.SMALL)
    assert lot.leave("CAR") == "M1"


def test_elevator_scan_order():
    e = Elevator(10)
    for f in (5, 2, 8):
        e.request(f)
    assert [e.next_stop(), e.next_stop(), e.next_stop()] == [2, 5, 8]
    e.request(1)
    assert e.next_stop() == 1                 # turns around when nothing is ahead


def test_vending_states():
    vm = VendingMachine({"water": 150}, {"water": 1})
    assert vm.select("water") == ("insert money first", 0)
    vm.insert(200)
    assert vm.select("water") == ("dispensed water", 50)
    vm.insert(200)
    assert vm.select("water") == ("sold out", 0) and vm.cancel() == 200


def test_library_limits():
    lib = Library()
    lib.members["m1"] = Member("m1", max_loans=1)
    lib.copies["c1"] = Copy("c1", "isbn-1")
    lib.copies["c2"] = Copy("c2", "isbn-1")
    assert lib.borrow("m1", "isbn-1") == "c1"
    with pytest.raises(ValueError):
        lib.borrow("m1", "isbn-1")
    lib.give_back("c1")
    assert lib.borrow("m1", "isbn-1") in {"c1", "c2"}


def test_expenses_balance_and_settle():
    bal = balances([("ana", 9000, ["ana", "ben", "cleo"]), ("ben", 3000, ["ben", "cleo"])])
    assert sum(bal.values()) == 0
    assert bal == {"ana": 6000, "ben": -1500, "cleo": -4500}
    assert settle(bal) == [("cleo", "ana", 4500), ("ben", "ana", 1500)]
    odd = balances([("ana", 100, ["ana", "ben", "cleo"])])
    assert sum(odd.values()) == 0             # leftover cent not lost


def test_logger_levels_and_threads():
    sink = MemorySink()
    log = Logger([sink], level="INFO")
    log.log("DEBUG", "hidden")
    threads = [threading.Thread(target=lambda: [log.log("INFO", "hold", seat="F12") for _ in range(200)]) for _ in range(4)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert len(sink.lines) == 800 and all(l == "INFO hold seat=F12" for l in sink.lines)


def test_notifier_partial_failure_and_dedupe():
    sent = []
    def email(u, m): sent.append(("email", u))
    def sms(u, m): raise RuntimeError("provider down")
    n = Notifier({"email": email, "sms": sms}, {"maya": ["email", "sms"]})
    assert n.notify("n1", "maya", "Your ticket") == {"email": "sent", "sms": "failed: provider down"}
    assert n.notify("n1", "maya", "Your ticket")["email"] == "duplicate skipped"
    assert sent == [("email", "maya")]


def test_keyed_limiter_isolates_keys():
    lim = KeyedLimiter(capacity=2, rate=1)
    assert [lim.allow("a", 0), lim.allow("a", 0), lim.allow("a", 0)] == [True, True, False]
    assert lim.allow("b", 0)


def test_task_scheduler_with_fake_clock():
    now = [0.0]
    ran = []
    s = TaskScheduler(clock=lambda: now[0])
    s.schedule(5, lambda: ran.append("b"))
    s.schedule(2, lambda: ran.append("a"))
    assert s.run_due() == 0
    now[0] = 6
    assert s.run_due() == 2 and ran == ["a", "b"]


def test_seat_inventory_holds_and_late_payment():
    inv = SeatInventory(["F12"], hold_seconds=60)
    assert inv.hold("F12", "maya", now=0)
    assert not inv.hold("F12", "leo", now=1)
    assert not inv.confirm("F12", "maya", now=61)     # expired: refund
    assert inv.hold("F12", "leo", now=61) and inv.confirm("F12", "leo", now=62)


def test_seat_inventory_concurrent_holds():
    inv = SeatInventory(["F12"])
    wins = []
    threads = [threading.Thread(target=lambda b=b: wins.append(inv.hold("F12", b, now=0))) for b in "abcdefgh"]
    for t in threads: t.start()
    for t in threads: t.join()
    assert wins.count(True) == 1


def test_cart_total_and_discount():
    c = Cart(discounts=[ten_percent_over(10_000)])
    c.add("hoodie", Money(6000, "EUR"), 2)
    assert c.subtotal() == Money(12_000, "EUR") and c.total() == Money(10_800, "EUR")
    with pytest.raises(ValueError):
        c.add("x", Money(100, "USD"))


def test_board_games():
    t = tic_tac_toe()
    for col in range(2):
        t.place("X", col, row=0)
    r, c = t.place("X", 2, row=0)
    assert t.wins(r, c)
    f = connect_four()
    for _ in range(3):
        f.place("R", 0)
    r, c = f.place("R", 0)
    assert (r, c) == (2, 0) and f.wins(r, c)


def test_score_processor_dedupe_order_corrections():
    p = ScoreProcessor()
    assert p.receive({"id": "e2", "seq": 2, "type": "goal", "goal_id": "g2", "team": "away"}) == []   # waits for 1
    assert p.receive({"id": "e1", "seq": 1, "type": "goal", "goal_id": "g1", "team": "home"}) == [1, 2]
    assert p.receive({"id": "e1", "seq": 1, "type": "goal", "goal_id": "g1", "team": "home"}) == []   # duplicate
    p.receive({"id": "e3", "seq": 3, "type": "goal_disallowed", "goal_id": "g2"})
    assert (p.state.home, p.state.away) == (1, 0)
