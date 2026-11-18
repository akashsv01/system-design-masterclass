from dataclasses import dataclass, replace
from typing import Optional


@dataclass
class Seat:
    seat_id: str
    is_reserved: bool = False
    buyer: Optional[str] = None


class SeatDatabase:
    """A stand-in for a real database: reads return a copy, like a row fetched over the network."""

    def __init__(self, *seat_ids: str):
        self.rows = {sid: Seat(sid) for sid in seat_ids}

    def get_seat(self, seat_id: str) -> Seat:
        return replace(self.rows[seat_id])

    def save(self, seat: Seat) -> None:
        self.rows[seat.seat_id] = replace(seat)


def reserve(db: SeatDatabase, seat_id: str, buyer: str) -> str:
    seat = db.get_seat(seat_id)
    if seat.is_reserved:
        return "Sold out"
    seat.is_reserved = True
    seat.buyer = buyer
    db.save(seat)
    return "Confirmed"
