import math


def percentile(samples: list[float], p: float) -> float:
    """Nearest-rank percentile: the smallest sample that at least p% of samples are <= to."""
    ordered = sorted(samples)
    rank = math.ceil(p / 100 * len(ordered))
    return ordered[max(rank, 1) - 1]


def chance_any_slow(p_slow: float, fanout: int) -> float:
    """If each backend call is slow with probability p_slow, the chance a request waiting on all of them is slow."""
    return 1 - (1 - p_slow) ** fanout
