import random


def backoff_delays(attempts: int, base: float = 0.1, cap: float = 5.0, jitter: bool = True, seed: int = 1) -> list[float]:
    """Delay before each retry: doubles every time, capped, optionally randomised ("full jitter")."""
    rng = random.Random(seed)
    delays = []
    for attempt in range(attempts):
        ceiling = min(cap, base * 2 ** attempt)
        delays.append(rng.uniform(0, ceiling) if jitter else ceiling)
    return delays


class PaymentService:
    """Charges a card. Remembers idempotency keys so a retried request is not charged twice."""

    def __init__(self):
        self.charges: list[tuple[str, int]] = []
        self.results: dict[str, str] = {}

    def charge(self, card: str, amount: int, idempotency_key: str | None = None) -> str:
        if idempotency_key is not None and idempotency_key in self.results:
            return self.results[idempotency_key]       # same answer, no second charge
        self.charges.append((card, amount))
        result = f"charge-{len(self.charges)}"
        if idempotency_key is not None:
            self.results[idempotency_key] = result
        return result
