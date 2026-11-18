def bucket_for(key: str, n_buckets: int) -> int:
    """A deliberately simple hash for teaching: add up character codes, wrap around the bucket count."""
    return sum(ord(c) for c in key) % n_buckets


class TinyMap:
    """A hash map built from a list of buckets; each bucket is a short list of (key, value) pairs."""

    def __init__(self, n_buckets: int = 8):
        self.buckets = [[] for _ in range(n_buckets)]

    def put(self, key: str, value) -> None:
        bucket = self.buckets[bucket_for(key, len(self.buckets))]
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                return
        bucket.append((key, value))

    def get(self, key: str):
        bucket = self.buckets[bucket_for(key, len(self.buckets))]
        for k, v in bucket:
            if k == key:
                return v
        return None
