import threading

from sdm.rate_limit import TokenBucket


class KeyedLimiter:
    """One token bucket per key, created on first use; a lock keeps check-and-spend atomic."""

    def __init__(self, capacity: float, rate: float):
        self.capacity, self.rate = capacity, rate
        self.buckets: dict[str, TokenBucket] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, now: float) -> bool:
        with self._lock:
            bucket = self.buckets.get(key)
            if bucket is None:
                bucket = self.buckets[key] = TokenBucket(self.capacity, self.rate, now)
            return bucket.allow(now)
