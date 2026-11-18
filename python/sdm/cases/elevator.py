class Elevator:
    """Serves requests in the current direction before turning around (the SCAN idea)."""

    def __init__(self, floors: int):
        self.floors = floors
        self.floor = 0
        self.direction = 1          # 1 = up, -1 = down
        self.stops: set[int] = set()

    def request(self, floor: int) -> None:
        if not 0 <= floor < self.floors:
            raise ValueError("no such floor")
        self.stops.add(floor)

    def next_stop(self) -> int | None:
        if not self.stops:
            return None
        ahead = [f for f in self.stops if (f - self.floor) * self.direction >= 0]
        if not ahead:
            self.direction *= -1
            ahead = list(self.stops)
        target = min(ahead, key=lambda f: abs(f - self.floor))
        self.stops.discard(target)
        self.floor = target
        return target
