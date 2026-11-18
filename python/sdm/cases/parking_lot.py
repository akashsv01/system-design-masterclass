from dataclasses import dataclass
from enum import Enum


class Size(Enum):
    SMALL = 1
    MEDIUM = 2
    LARGE = 3


@dataclass
class Spot:
    spot_id: str
    size: Size
    vehicle: str | None = None


class ParkingLot:
    def __init__(self, spots: list[Spot]):
        self.spots = spots
        self.tickets: dict[str, Spot] = {}

    def park(self, plate: str, size: Size) -> str | None:
        """Smallest free spot that fits; invariant: one vehicle per spot, one spot per vehicle."""
        if plate in self.tickets:
            raise ValueError("vehicle already parked")
        fitting = [s for s in self.spots if s.vehicle is None and s.size.value >= size.value]
        if not fitting:
            return None
        spot = min(fitting, key=lambda s: s.size.value)
        spot.vehicle = plate
        self.tickets[plate] = spot
        return spot.spot_id

    def leave(self, plate: str) -> str:
        spot = self.tickets.pop(plate)
        spot.vehicle = None
        return spot.spot_id
