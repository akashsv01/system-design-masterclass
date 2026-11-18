from sdm.booking import SeatDatabase
from blank import reserve


def test_first_buyer_confirmed():
    db = SeatDatabase("F12")
    assert reserve(db, "F12", "Maya") == "Confirmed"


def test_second_buyer_sold_out():
    db = SeatDatabase("F12")
    reserve(db, "F12", "Maya")
    assert reserve(db, "F12", "Leo") == "Sold out"


def test_seat_keeps_first_buyer():
    db = SeatDatabase("F12")
    reserve(db, "F12", "Maya")
    reserve(db, "F12", "Leo")
    assert db.get_seat("F12").buyer == "Maya"
