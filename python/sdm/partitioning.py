import bisect
import hashlib


def stable_hash(key: str) -> int:
    """Same number for the same key on every machine and every run (unlike Python's built-in hash for str)."""
    return int(hashlib.md5(key.encode()).hexdigest()[:8], 16)


def modulo_shard(key: str, n_shards: int) -> int:
    return stable_hash(key) % n_shards


class Ring:
    """Consistent hashing: servers and keys share one circle; a key belongs to the next server clockwise."""

    def __init__(self, servers: list[str], vnodes: int = 50):
        self.points = sorted((stable_hash(f"{s}#{i}"), s) for s in servers for i in range(vnodes))
        self.hashes = [h for h, _ in self.points]

    def owner(self, key: str) -> str:
        i = bisect.bisect(self.hashes, stable_hash(key)) % len(self.points)
        return self.points[i][1]


def moved_fraction(keys: list[str], before, after) -> float:
    return sum(before(k) != after(k) for k in keys) / len(keys)
