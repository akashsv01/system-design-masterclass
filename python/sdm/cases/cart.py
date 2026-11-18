from dataclasses import dataclass, field
from typing import Callable

from sdm.lld import Money

Discount = Callable[["Cart"], Money]


@dataclass
class Line:
    sku: str
    unit: Money
    qty: int


@dataclass
class Cart:
    currency: str = "EUR"
    lines: dict[str, Line] = field(default_factory=dict)
    discounts: list[Discount] = field(default_factory=list)

    def add(self, sku: str, unit: Money, qty: int = 1) -> None:
        if qty <= 0:
            raise ValueError("quantity must be positive")
        if unit.currency != self.currency:
            raise ValueError("currency mismatch")
        if sku in self.lines:
            self.lines[sku].qty += qty
        else:
            self.lines[sku] = Line(sku, unit, qty)

    def subtotal(self) -> Money:
        return Money(sum(l.unit.cents * l.qty for l in self.lines.values()), self.currency)

    def total(self) -> Money:
        off = sum(d(self).cents for d in self.discounts)
        return Money(max(0, self.subtotal().cents - off), self.currency)   # never negative


def ten_percent_over(threshold_cents: int) -> Discount:
    return lambda cart: Money(cart.subtotal().cents // 10 if cart.subtotal().cents >= threshold_cents else 0, cart.currency)
