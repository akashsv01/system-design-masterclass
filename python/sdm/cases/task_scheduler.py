import heapq
from typing import Callable


class TaskScheduler:
    """Runs tasks when due, earliest first; time comes from an injected clock so tests control it."""

    def __init__(self, clock: Callable[[], float]):
        self.clock = clock
        self._heap: list[tuple[float, int, Callable[[], None]]] = []
        self._seq = 0                         # tie-breaker keeps insertion order for equal times

    def schedule(self, at: float, task: Callable[[], None]) -> None:
        heapq.heappush(self._heap, (at, self._seq, task))
        self._seq += 1

    def run_due(self) -> int:
        ran = 0
        while self._heap and self._heap[0][0] <= self.clock():
            _, _, task = heapq.heappop(self._heap)
            task()
            ran += 1
        return ran
