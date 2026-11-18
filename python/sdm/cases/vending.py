class VendingMachine:
    """States: idle → has_money → (dispense) → idle. Every action is checked against the state."""

    def __init__(self, prices: dict[str, int], stock: dict[str, int]):
        self.prices = prices
        self.stock = stock
        self.balance = 0

    @property
    def state(self) -> str:
        return "has_money" if self.balance > 0 else "idle"

    def insert(self, cents: int) -> None:
        if cents <= 0:
            raise ValueError("insert a positive amount")
        self.balance += cents

    def select(self, item: str) -> tuple[str, int]:
        if self.state == "idle":
            return ("insert money first", 0)
        if self.stock.get(item, 0) == 0:
            return ("sold out", 0)
        if self.balance < self.prices[item]:
            return ("not enough money", 0)
        self.stock[item] -= 1
        change, self.balance = self.balance - self.prices[item], 0
        return (f"dispensed {item}", change)

    def cancel(self) -> int:
        refund, self.balance = self.balance, 0
        return refund
