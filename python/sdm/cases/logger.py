import threading
from typing import Protocol

LEVELS = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40}


class Sink(Protocol):
    def write(self, line: str) -> None: ...


class MemorySink:
    def __init__(self):
        self.lines: list[str] = []

    def write(self, line: str) -> None:
        self.lines.append(line)


class Logger:
    """Filters by level, formats once, writes to every sink; safe to call from many threads."""

    def __init__(self, sinks: list[Sink], level: str = "INFO"):
        self.sinks = sinks
        self.level = LEVELS[level]
        self._lock = threading.Lock()

    def log(self, level: str, message: str, **fields) -> None:
        if LEVELS[level] < self.level:
            return
        extra = " ".join(f"{k}={v}" for k, v in sorted(fields.items()))
        line = f"{level} {message}" + (f" {extra}" if extra else "")
        with self._lock:                     # lines from different threads never interleave
            for sink in self.sinks:
                sink.write(line)
