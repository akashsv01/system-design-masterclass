"""Small, focused examples for the LLD lessons. Each function or class is shown on its own in a lesson."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Protocol


# --- Responsibilities and encapsulation -------------------------------------------------
class Seat:
    """The seat decides whether it can be held. Callers ask; they don't poke at its fields."""

    def __init__(self, seat_id: str, price_cents: int):
        if price_cents <= 0:
            raise ValueError("price must be positive")
        self.seat_id = seat_id
        self._price_cents = price_cents
        self._holder: str | None = None

    @property
    def price_cents(self) -> int:
        return self._price_cents

    def hold(self, buyer: str) -> bool:
        if self._holder is not None:
            return False
        self._holder = buyer
        return True


# --- Value objects and entities ---------------------------------------------------------
@dataclass(frozen=True)
class Money:
    """A value object: defined by its value, immutable, compared by value."""
    cents: int
    currency: str

    def __post_init__(self):
        if self.cents < 0:
            raise ValueError("money cannot be negative")

    def add(self, other: Money) -> Money:
        if other.currency != self.currency:
            raise ValueError("currency mismatch")
        return Money(self.cents + other.cents, self.currency)


@dataclass(eq=False)
class Booking:
    """An entity: has an identity that stays the same while its attributes change."""
    booking_id: str
    seat_id: str
    total: Money
    status: str = "pending"

    def __eq__(self, other: object) -> bool:          # compared by identity, not by fields
        return isinstance(other, Booking) and other.booking_id == self.booking_id

    def __hash__(self) -> int:
        return hash(self.booking_id)


class BookingRepository(Protocol):
    def get(self, booking_id: str) -> Booking | None: ...
    def save(self, booking: Booking) -> None: ...


class InMemoryBookings:
    def __init__(self):
        self._rows: dict[str, Booking] = {}

    def get(self, booking_id: str) -> Booking | None:
        return self._rows.get(booking_id)

    def save(self, booking: Booking) -> None:
        self._rows[booking.booking_id] = booking


# --- Dependency injection and testing ----------------------------------------------------
class Checkout:
    """Collaborators are passed in, so a test can supply fakes."""

    def __init__(self, charge: Callable[[int], bool], clock: Callable[[], float], bookings: BookingRepository):
        self.charge = charge
        self.clock = clock
        self.bookings = bookings

    def pay(self, booking_id: str, hold_expires_at: float) -> str:
        booking = self.bookings.get(booking_id)
        if booking is None:
            return "not found"
        if self.clock() >= hold_expires_at:
            return "hold expired"
        if not self.charge(booking.total.cents):
            return "declined"
        booking.status = "paid"
        self.bookings.save(booking)
        return "paid"


# --- State machines ----------------------------------------------------------------------
class TicketState(Enum):
    ISSUED = "issued"
    SCANNED = "scanned"
    REFUNDED = "refunded"


ALLOWED = {
    TicketState.ISSUED: {TicketState.SCANNED, TicketState.REFUNDED},
    TicketState.SCANNED: set(),
    TicketState.REFUNDED: set(),
}


@dataclass
class Ticket:
    ticket_id: str
    state: TicketState = TicketState.ISSUED
    history: list[TicketState] = field(default_factory=list)

    def move_to(self, new: TicketState) -> None:
        if new not in ALLOWED[self.state]:
            raise ValueError(f"cannot go from {self.state.value} to {new.value}")
        self.history.append(self.state)
        self.state = new


# --- Concurrency: lock ordering ------------------------------------------------------------
class Wallet:
    def __init__(self, wallet_id: int, cents: int):
        self.wallet_id = wallet_id
        self.cents = cents
        self.lock = threading.Lock()


def transfer(a: Wallet, b: Wallet, cents: int) -> None:
    """Always lock the lower id first, so two opposite transfers can't deadlock."""
    first, second = (a, b) if a.wallet_id < b.wallet_id else (b, a)
    with first.lock, second.lock:
        if a.cents < cents:
            raise ValueError("insufficient funds")
        a.cents -= cents
        b.cents += cents
