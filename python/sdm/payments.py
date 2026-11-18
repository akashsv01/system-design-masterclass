from typing import Protocol


class PaymentMethod(Protocol):
    def pay(self, amount_cents: int) -> str: ...


class Card:
    def __init__(self, last4: str):
        self.last4 = last4

    def pay(self, amount_cents: int) -> str:
        return f"charged {amount_cents} to card {self.last4}"


class Wallet:
    def __init__(self, balance_cents: int):
        self.balance_cents = balance_cents

    def pay(self, amount_cents: int) -> str:
        if amount_cents > self.balance_cents:
            raise ValueError("insufficient balance")
        self.balance_cents -= amount_cents
        return f"paid {amount_cents} from wallet"


def checkout(method: PaymentMethod, amount_cents: int) -> str:
    return method.pay(amount_cents)
