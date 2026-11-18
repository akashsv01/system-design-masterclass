"""Worked examples for the design-pattern refactoring lessons."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Callable, Protocol


# --- Strategy: start with a function --------------------------------------------------------
def regular_price(base_cents: int) -> int:
    return base_cents


def student_price(base_cents: int) -> int:
    return base_cents * 80 // 100


def checkout_total(base_cents: int, quantity: int, pricing: Callable[[int], int]) -> int:
    return pricing(base_cents) * quantity


class SurgePricing:
    """A strategy that needs its own state: a class with __call__, still usable wherever a function is."""

    def __init__(self, seats_left: int, capacity: int):
        self.seats_left = seats_left
        self.capacity = capacity

    def __call__(self, base_cents: int) -> int:
        sold_ratio = 1 - self.seats_left / self.capacity
        return base_cents + int(base_cents * 0.5 * sold_ratio)


# --- Observer ------------------------------------------------------------------------------
class EventBus:
    def __init__(self):
        self._listeners: dict[str, list[Callable[[dict], None]]] = {}

    def subscribe(self, event: str, listener: Callable[[dict], None]) -> None:
        self._listeners.setdefault(event, []).append(listener)

    def publish(self, event: str, payload: dict) -> list[str]:
        errors = []
        for listener in self._listeners.get(event, []):
            try:
                listener(payload)
            except Exception as exc:         # one failing listener must not stop the others
                errors.append(f"{getattr(listener, '__name__', 'listener')}: {exc}")
        return errors


# --- State ---------------------------------------------------------------------------------
class OrderState(ABC):
    name = "?"

    @abstractmethod
    def pay(self, order: Order) -> str: ...

    @abstractmethod
    def cancel(self, order: Order) -> str: ...


class Pending(OrderState):
    name = "pending"

    def pay(self, order: Order) -> str:
        order.state = Paid()
        return "paid"

    def cancel(self, order: Order) -> str:
        order.state = Cancelled()
        return "cancelled"


class Paid(OrderState):
    name = "paid"

    def pay(self, order: Order) -> str:
        return "already paid"

    def cancel(self, order: Order) -> str:
        order.state = Cancelled()
        return "refund issued"


class Cancelled(OrderState):
    name = "cancelled"

    def pay(self, order: Order) -> str:
        return "order is cancelled"

    def cancel(self, order: Order) -> str:
        return "already cancelled"


@dataclass
class Order:
    state: OrderState = field(default_factory=Pending)

    def pay(self) -> str:
        return self.state.pay(self)

    def cancel(self) -> str:
        return self.state.cancel(self)


# --- Decorator -----------------------------------------------------------------------------
class PaymentClient(Protocol):
    def charge(self, cents: int) -> str: ...


class FlakyProvider:
    def __init__(self, failures_before_success: int):
        self.remaining_failures = failures_before_success
        self.calls = 0

    def charge(self, cents: int) -> str:
        self.calls += 1
        if self.remaining_failures > 0:
            self.remaining_failures -= 1
            raise TimeoutError("provider timed out")
        return f"charged {cents}"


class RetryingClient:
    """Wraps any PaymentClient and adds retries; the caller doesn't change."""

    def __init__(self, inner: PaymentClient, attempts: int = 3):
        self.inner = inner
        self.attempts = attempts

    def charge(self, cents: int) -> str:
        last: Exception | None = None
        for _ in range(self.attempts):
            try:
                return self.inner.charge(cents)
            except TimeoutError as exc:
                last = exc
        raise last  # type: ignore[misc]


class LoggingClient:
    def __init__(self, inner: PaymentClient, log: list[str]):
        self.inner = inner
        self.log = log

    def charge(self, cents: int) -> str:
        self.log.append(f"charge {cents}")
        return self.inner.charge(cents)


# --- Builder / factory -----------------------------------------------------------------------
@dataclass(frozen=True)
class EventListing:
    title: str
    venue: str
    starts_at: str
    price_cents: int
    age_limit: int = 0
    seated: bool = True

    @classmethod
    def concert(cls, title: str, venue: str, starts_at: str, price_cents: int) -> EventListing:
        """A named factory: callers say what they want, not how to fill nine fields."""
        return cls(title, venue, starts_at, price_cents, age_limit=16, seated=False)


# --- Adapter ---------------------------------------------------------------------------------
class OldBankApi:
    def make_payment(self, amount_euros: float, reference: str) -> dict:
        return {"ok": True, "ref": reference, "amount": amount_euros}


class OldBankAdapter:
    """Presents OldBankApi through the PaymentClient interface the rest of the code expects."""

    def __init__(self, bank: OldBankApi):
        self.bank = bank

    def charge(self, cents: int) -> str:
        result = self.bank.make_payment(cents / 100, reference="booking")
        return f"charged {cents}" if result["ok"] else "declined"


# --- Command ---------------------------------------------------------------------------------
class SeatMap:
    def __init__(self):
        self.blocked: set[str] = set()
        self._done: list[Callable[[], None]] = []

    def run(self, do: Callable[[], None], undo: Callable[[], None]) -> None:
        do()
        self._done.append(undo)

    def block(self, seat: str) -> None:
        self.run(lambda: self.blocked.add(seat), lambda: self.blocked.discard(seat))

    def undo(self) -> None:
        if self._done:
            self._done.pop()()
