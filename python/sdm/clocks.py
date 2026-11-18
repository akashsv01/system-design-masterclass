class LamportClock:
    """A counter that only moves forward and jumps ahead of any timestamp it receives."""

    def __init__(self):
        self.time = 0

    def tick(self) -> int:                  # a local event, or sending a message
        self.time += 1
        return self.time

    def receive(self, sent_at: int) -> int:
        self.time = max(self.time, sent_at) + 1
        return self.time


def quorum_overlaps(n: int, r: int, w: int) -> bool:
    """With N replicas, every read set of size R shares a replica with every write set of size W iff R + W > N."""
    return r + w > n
