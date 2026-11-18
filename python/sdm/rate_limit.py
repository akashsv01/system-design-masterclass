class TokenBucket:
    """Holds up to `capacity` tokens and refills `rate` tokens per second. Each request spends one."""

    def __init__(self, capacity: float, rate: float, now: float = 0.0):
        self.capacity = capacity
        self.rate = rate
        self.tokens = capacity
        self.updated = now

    def allow(self, now: float) -> bool:
        elapsed = now - self.updated
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)   # refill since last call
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False


class FixedWindow:
    """Counts requests per calendar window (e.g. per minute). Simple, but allows bursts at window edges."""

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self.counts: dict[int, int] = {}

    def allow(self, now: float) -> bool:
        w = int(now // self.window)
        if self.counts.get(w, 0) >= self.limit:
            return False
        self.counts[w] = self.counts.get(w, 0) + 1
        return True
