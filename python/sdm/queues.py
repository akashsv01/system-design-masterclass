def backlog_over_time(arrive_per_s: float, process_per_s: float, seconds: int, start: float = 0) -> list[float]:
    """Messages waiting at the end of each second."""
    backlog, out = start, []
    for _ in range(seconds):
        backlog = max(0.0, backlog + arrive_per_s - process_per_s)
        out.append(backlog)
    return out


def drain_seconds(backlog: float, arrive_per_s: float, process_per_s: float) -> float:
    spare = process_per_s - arrive_per_s
    return float("inf") if spare <= 0 else backlog / spare


class Consumer:
    """At-least-once delivery means duplicates; remembering processed ids makes the effect happen once."""

    def __init__(self):
        self.seen: set[str] = set()
        self.emails_sent = 0

    def handle(self, message_id: str) -> None:
        if message_id in self.seen:
            return
        self.emails_sent += 1
        self.seen.add(message_id)
