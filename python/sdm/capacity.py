def average_rps(requests_per_day: float) -> float:
    return requests_per_day / 86_400


def peak_rps(requests_per_day: float, peak_factor: float) -> float:
    return average_rps(requests_per_day) * peak_factor


def servers_needed(peak: float, rps_per_server: float, headroom: float = 0.7) -> int:
    """Plan to run each server at most `headroom` of its measured capacity."""
    import math
    return math.ceil(peak / (rps_per_server * headroom))


def in_flight(arrivals_per_second: float, seconds_each: float) -> float:
    """Little's law: requests in the system = arrival rate × time each spends in it."""
    return arrivals_per_second * seconds_each
