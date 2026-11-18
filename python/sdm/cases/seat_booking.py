import threading
from dataclasses import dataclass


@dataclass
class Hold:
    seat: str
    buyer: str
    expires_at: float


class SeatInventory:
    """Holds and confirmations for one event. The lock makes check-and-change one step."""

    def __init__(self, seats: list[str], hold_seconds: float = 600):
        self.free = set(seats)
        self.holds: dict[str, Hold] = {}
        self.booked: dict[str, str] = {}
        self.hold_seconds = hold_seconds
        self._lock = threading.Lock()

    def _expire(self, now: float) -> None:
        for seat, h in list(self.holds.items()):
            if h.expires_at <= now:
                del self.holds[seat]
                self.free.add(seat)

    def hold(self, seat: str, buyer: str, now: float) -> bool:
        with self._lock:
            self._expire(now)
            if seat not in self.free:
                return False
            self.free.remove(seat)
            self.holds[seat] = Hold(seat, buyer, now + self.hold_seconds)
            return True

    def confirm(self, seat: str, buyer: str, now: float) -> bool:
        with self._lock:
            self._expire(now)
            h = self.holds.get(seat)
            if h is None or h.buyer != buyer:
                return False                 # late payment: caller must refund
            del self.holds[seat]
            self.booked[seat] = buyer
            return True
