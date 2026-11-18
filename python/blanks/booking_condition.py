def reserve(db, seat_id, buyer):
    seat = db.get_seat(seat_id)
    if ____:
        return "Sold out"
    seat.is_reserved = True
    seat.buyer = buyer
    db.save(seat)
    return "Confirmed"
