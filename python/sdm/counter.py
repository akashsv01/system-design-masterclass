import threading


class UnsafeCounter:
    def __init__(self):
        self.value = 0

    def increment(self):
        current = self.value      # 1. read
        current = current + 1     # 2. add
        self.value = current      # 3. write


class SafeCounter:
    def __init__(self):
        self.value = 0
        self.lock = threading.Lock()

    def increment(self):
        with self.lock:           # only one thread at a time runs the block
            self.value = self.value + 1


def interleaved_lost_update() -> int:
    """Replay the bad interleaving step by step: both threads read 0 before either writes."""
    c = UnsafeCounter()
    a_read = c.value          # thread A reads 0
    b_read = c.value          # thread B reads 0
    c.value = a_read + 1      # A writes 1
    c.value = b_read + 1      # B writes 1 — A's increment is lost
    return c.value
