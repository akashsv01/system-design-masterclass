from sdm.booking import SeatDatabase, reserve


def test_first_buyer_gets_the_seat():
    db = SeatDatabase("F12")
    assert reserve(db, "F12", "Maya") == "Confirmed"
    assert db.get_seat("F12").buyer == "Maya"


def test_second_buyer_is_told_sold_out():
    db = SeatDatabase("F12")
    reserve(db, "F12", "Maya")
    assert reserve(db, "F12", "Leo") == "Sold out"
    assert db.get_seat("F12").buyer == "Maya"


def test_overlapping_reads_both_pass_the_check():
    """The race from the lesson, made deterministic: both reads happen before either save."""
    db = SeatDatabase("F12")
    maya_view = db.get_seat("F12")
    leo_view = db.get_seat("F12")
    assert not maya_view.is_reserved and not leo_view.is_reserved  # both pass `if seat.is_reserved`
    maya_view.is_reserved, maya_view.buyer = True, "Maya"
    db.save(maya_view)
    leo_view.is_reserved, leo_view.buyer = True, "Leo"
    db.save(leo_view)
    assert db.get_seat("F12").buyer == "Leo"  # last write wins; Maya was also told "Confirmed"
