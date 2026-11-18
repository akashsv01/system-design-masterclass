from dataclasses import dataclass
from typing import Optional


@dataclass
class Seat:
    seat_id: str
    state: str = "available"          # "available" | "held" | "booked"
    holder: Optional[str] = None
    hold_expires_at: float = 0.0

    def hold(self, buyer: str, now: float, hold_seconds: float = 600) -> bool:
        if self.state == "held" and now >= self.hold_expires_at:
            self.state, self.holder = "available", None   # an expired hold frees the seat
        if self.state != "available":
            return False
        self.state, self.holder = "held", buyer
        self.hold_expires_at = now + hold_seconds
        return True

    def confirm(self, buyer: str, now: float) -> bool:
        if self.state != "held" or self.holder != buyer or now >= self.hold_expires_at:
            return False
        self.state = "booked"
        return True
